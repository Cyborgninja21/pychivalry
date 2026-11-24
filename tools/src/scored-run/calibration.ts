/**
 * The judge's calibration (docs/PLAN.md item 9.6), behind `task scored:calibrate`: the judge of
 * the authoring test (`judge.ts`) run over results a person has graded by hand, and how often it
 * agrees with them, per dimension and over all, with how often each says "cannot tell". Like the
 * authoring test it is a developer's test script, never run by CI: each item is one judge test
 * session of the developer's own Claude Code, started as a child process exactly as the
 * authoring run starts its judge, counting against the developer's own Claude plan. pychivalry
 * makes no model call.
 *
 * **The hand grades** are a JSON file the person writes (`SCORED_GRADES`), `grades_format` 1:
 *
 * - `about`: what the set is, in words: which run the results came from, how they were chosen;
 * - `items[]`: each `request` (a request's id), `result` (the folder of the mod as a session
 *   left it, from the grades file's own folder: a trial's `mod/` folder kept with
 *   `SCORED_KEEP=true`; its `.claude/` folder is not shown to the judge) and `grades` (for every
 *   dimension the request's judge is asked, and no other, the person's answer from the judge's
 *   closed set: `yes`, `no` or `cannot-tell`).
 *
 * Nothing in the format names the person who graded.
 *
 * **The record**, `records/scored/calibration.json`: the grades file by its hash, the judge's
 * prompt, schema, model, session limit and arguments, each item's hand grades and the judge's
 * answers with whether each agrees, and per dimension and over all: the grades, those the judge
 * answered, those it agreed with, the agreement (agreed / answered), how often the person and
 * the judge said "cannot tell", and the full table of hand answer against judge answer.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import {
    committedSpec,
    machineInfo,
    now,
    toolInfo,
    type MachineInfo,
    type SpecRef,
    type ToolInfo,
} from '../record.js';
import { CommandError, EXIT, isObject, relativePosix, sha256OfFile, writeJson } from '../util.js';
import {
    compileJudgeSchema,
    JUDGE_ANSWERS,
    JUDGE_PROMPT_FILE,
    JUDGE_SCHEMA_FILE,
    judgeArgs,
    judgePrompt,
    judgeRecord,
    MATERIAL_LIMIT,
    notJudged,
    resultFiles,
    resultText,
    runJudge,
    type JudgeAnswer,
    type JudgeRecord,
} from './judge.js';
import {
    baseDir,
    committedRequests,
    REQUESTS_FILE,
    type ContentRequest,
    type RequestList,
} from './requests.js';
import {
    fullModelName,
    harnessVersion,
    inRepository,
    PINNED_MODEL,
    positive,
    sanitize,
} from './run.js';

export const CALIBRATION_SUITE = 'scored:calibration';
export const CALIBRATION_RECORD_FILE = 'records/scored/calibration.json';
export const DEFAULT_CALIBRATION_TIMEOUT_MINUTES = 10;

/** One hand-graded result. */
export interface GradedItem {
    readonly request: string;
    /** The result's folder, from the grades file's folder. */
    readonly result: string;
    readonly grades: Readonly<Record<string, JudgeAnswer>>;
}

export interface Grades {
    readonly grades_format: 1;
    readonly about: string;
    readonly items: readonly GradedItem[];
}

/**
 * The problems of a parsed grades file against the request list: its shape, each item's
 * request, its result folder (from `dir`), and its grades, one per dimension the request asks.
 */
export function gradesProblems(value: unknown, list: RequestList, dir: string): string[] {
    if (!isObject(value)) {
        return ['the grades are not a JSON object'];
    }
    const problems: string[] = [];
    if (!Object.keys(value).every((k) => ['grades_format', 'about', 'items'].includes(k))) {
        problems.push('the grades have a field the format does not know');
    }
    if (value['grades_format'] !== 1) {
        problems.push('grades_format is not 1');
    }
    if (typeof value['about'] !== 'string' || value['about'] === '') {
        problems.push('about is not a text');
    }
    const items = value['items'];
    if (!Array.isArray(items) || items.length === 0) {
        problems.push('items is not a list of graded results');
        return problems;
    }
    items.forEach((item: unknown, i) => {
        const where = `items[${String(i)}]`;
        if (
            !isObject(item) ||
            !Object.keys(item).every((k) => ['request', 'result', 'grades'].includes(k)) ||
            typeof item['request'] !== 'string' ||
            typeof item['result'] !== 'string' ||
            !isObject(item['grades'])
        ) {
            problems.push(`${where}: needs a request, a result and its grades`);
            return;
        }
        const request = list.requests.find((r) => r.id === item['request']);
        if (request === undefined) {
            problems.push(
                `${where}: ${JSON.stringify(item['request'])} is not a request of ${REQUESTS_FILE}`,
            );
            return;
        }
        const folder = path.resolve(dir, item['result']);
        if (!existsSync(folder)) {
            problems.push(`${where}: the result ${item['result']} does not exist`);
        }
        const grades = item['grades'];
        const asked = request.judged.map((q) => q.dimension);
        for (const d of asked) {
            if (!(d in grades)) {
                problems.push(`${where}: no grade for ${d}`);
            }
        }
        for (const [d, answer] of Object.entries(grades)) {
            if (!asked.includes(d)) {
                problems.push(`${where}: a grade for ${d}, which ${request.id} does not ask`);
            } else if (!(JUDGE_ANSWERS as readonly unknown[]).includes(answer)) {
                problems.push(
                    `${where}: ${d} is graded ${JSON.stringify(answer)}, not one of ${JUDGE_ANSWERS.join(', ')}`,
                );
            }
        }
    });
    return problems;
}

/** One cell of the table of hand answer against judge answer. */
export interface MatrixCell {
    readonly hand: JudgeAnswer;
    readonly judge: JudgeAnswer;
    readonly count: number;
}

/** How the judge agreed with the person over a set of grades. */
export interface Agreement {
    /** The hand grades. */
    readonly grades: number;
    /** Those the judge answered. */
    readonly judged: number;
    /** Those it answered as the person did. */
    readonly agree: number;
    /** agree / judged, to 4 places; null when the judge answered none. */
    readonly agreement: number | null;
    /** How many of the grades the person gave as "cannot tell". */
    readonly hand_cannot_tell: number;
    /** How many of the judge's answers were "cannot tell". */
    readonly judge_cannot_tell: number;
    /** judge_cannot_tell / judged, to 4 places; null when the judge answered none. */
    readonly judge_cannot_tell_rate: number | null;
    /** Every pair of answers that occurs, hand first, in the order of the closed set. */
    readonly matrix: readonly MatrixCell[];
}

export interface CalibrationItem {
    /** From 1. */
    readonly item: number;
    readonly request: string;
    readonly hand: readonly { readonly dimension: string; readonly answer: JudgeAnswer }[];
    readonly judge: JudgeRecord;
    /** Per dimension, whether the judge agreed; null when it did not answer. */
    readonly agrees: readonly { readonly dimension: string; readonly agrees: boolean | null }[];
}

export interface CalibrationResults {
    readonly grades: { readonly file: string; readonly sha256: string; readonly items: number };
    readonly requests_file: string;
    readonly requests_sha256: string;
    readonly judge_prompt_file: string;
    readonly judge_prompt_sha256: string;
    readonly judge_schema_file: string;
    readonly judge_schema_sha256: string;
    readonly answers: readonly JudgeAnswer[];
    readonly harness: { readonly name: 'claude-code'; readonly version: string };
    readonly judge_model: string;
    readonly judge_session_limit: number;
    readonly judge_timeout_minutes: number;
    readonly judge_arguments: readonly string[];
    readonly items: readonly CalibrationItem[];
    readonly dimensions: readonly ({ readonly dimension: string } & Agreement)[];
    readonly overall: Agreement;
}

export interface CalibrationRecord {
    readonly record_format: 1;
    readonly suite: typeof CALIBRATION_SUITE;
    readonly command: string;
    readonly made_at: string;
    readonly tool: ToolInfo;
    readonly machine: MachineInfo;
    /** The calibration reads no game: the results it judges were made over one already. */
    readonly game: null;
    readonly spec: SpecRef;
    readonly corpus: null;
    readonly notes: readonly string[];
    readonly results: CalibrationResults;
}

function rate(part: number, whole: number): number | null {
    return whole === 0 ? null : Math.round((part / whole) * 10000) / 10000;
}

/** How the judge agreed with the person over a set of (hand answer, judge answer or null) pairs. */
export function agreementOf(
    pairs: readonly { readonly hand: JudgeAnswer; readonly judge: JudgeAnswer | null }[],
): Agreement {
    const judged = pairs.filter(
        (p): p is { hand: JudgeAnswer; judge: JudgeAnswer } => p.judge !== null,
    );
    const agree = judged.filter((p) => p.hand === p.judge).length;
    const judgeCannot = judged.filter((p) => p.judge === 'cannot-tell').length;
    const matrix: MatrixCell[] = [];
    for (const hand of JUDGE_ANSWERS) {
        for (const judge of JUDGE_ANSWERS) {
            const count = judged.filter((p) => p.hand === hand && p.judge === judge).length;
            if (count > 0) {
                matrix.push({ hand, judge, count });
            }
        }
    }
    return {
        grades: pairs.length,
        judged: judged.length,
        agree,
        agreement: rate(agree, judged.length),
        hand_cannot_tell: pairs.filter((p) => p.hand === 'cannot-tell').length,
        judge_cannot_tell: judgeCannot,
        judge_cannot_tell_rate: rate(judgeCannot, judged.length),
        matrix,
    };
}

/** The pairs of answers of a set of items, on one dimension or (null) every one. */
function pairsOf(
    items: readonly CalibrationItem[],
    dimension: string | null,
): { hand: JudgeAnswer; judge: JudgeAnswer | null }[] {
    return items.flatMap((item) =>
        item.hand
            .filter((h) => dimension === null || h.dimension === dimension)
            .map((h) => ({
                hand: h.answer,
                judge:
                    item.judge.state === 'answered'
                        ? (item.judge.answers.find((a) => a.dimension === h.dimension)?.answer ??
                          null)
                        : null,
            })),
    );
}

/** The agreement per dimension, in the order each is first graded, and over all. */
export function calibrationSummary(items: readonly CalibrationItem[]): {
    readonly dimensions: ({ dimension: string } & Agreement)[];
    readonly overall: Agreement;
} {
    const dimensions = [...new Set(items.flatMap((i) => i.hand.map((h) => h.dimension)))];
    return {
        dimensions: dimensions.map((dimension) => ({
            dimension,
            ...agreementOf(pairsOf(items, dimension)),
        })),
        overall: agreementOf(pairsOf(items, null)),
    };
}

/** An item's per-dimension agreement, from its hand grades and its judge's answers. */
export function agreesOf(
    hand: CalibrationItem['hand'],
    judge: JudgeRecord,
): CalibrationItem['agrees'] {
    return hand.map((h) => {
        const answer =
            judge.state === 'answered'
                ? judge.answers.find((a) => a.dimension === h.dimension)?.answer
                : undefined;
        return {
            dimension: h.dimension,
            agrees: answer === undefined ? null : answer === h.answer,
        };
    });
}

/**
 * A calibration record's figures that disagree with each other: each item numbered from 1, its
 * agreement with its grades and its judge's answers, the judge's state with its answers, and the
 * agreement per dimension and over all with the items.
 */
export function calibrationProblems(results: unknown): string[] {
    if (!isObject(results)) {
        return [];
    }
    const problems: string[] = [];
    const items = Array.isArray(results['items'])
        ? (results['items'].filter(isObject) as unknown as CalibrationItem[])
        : [];
    items.forEach((item, i) => {
        const where = `/results/items/${String(i)}`;
        if (item.item !== i + 1) {
            problems.push(`${where}/item: ${String(item.item)} is not ${String(i + 1)}`);
        }
        if (JSON.stringify(item.agrees) !== JSON.stringify(agreesOf(item.hand, item.judge))) {
            problems.push(
                `${where}/agrees: does not agree with its grades and the judge's answers`,
            );
        }
        const j = item.judge;
        if (
            j.state === 'answered'
                ? JSON.stringify(j.answers.map((a) => a.dimension)) !==
                      JSON.stringify(item.hand.map((h) => h.dimension)) || j.why !== null
                : j.answers.length > 0 || j.why === null
        ) {
            problems.push(
                `${where}/judge: the state ${j.state} does not agree with its answers and why`,
            );
        }
    });
    const grades = isObject(results['grades']) ? results['grades'] : {};
    if (grades['items'] !== items.length) {
        problems.push(
            `/results/grades/items: ${JSON.stringify(grades['items'])}, but ${String(items.length)} items are listed`,
        );
    }
    const summary = calibrationSummary(items);
    if (JSON.stringify(results['dimensions']) !== JSON.stringify(summary.dimensions)) {
        problems.push(
            '/results/dimensions: the agreement per dimension does not agree with the items',
        );
    }
    if (JSON.stringify(results['overall']) !== JSON.stringify(summary.overall)) {
        problems.push('/results/overall: the agreement over all does not agree with the items');
    }
    return problems;
}

/** The calibration's parameters, from the environment. */
export interface CalibrationOptions {
    readonly gradesFile: string;
    readonly judgeModel: string;
    readonly judgeSessionLimit: number;
    readonly judgeTimeoutMinutes: number;
    readonly claude: { readonly command: string; readonly args: readonly string[] };
    readonly keep: boolean;
}

export function calibrationOptions(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
): CalibrationOptions {
    const grades = env['SCORED_GRADES'];
    if (grades === undefined || grades === '') {
        throw new CommandError(
            'SCORED_GRADES must name the file of hand grades (tools/scored-run/README.md, "Calibrating the judge")',
            EXIT.usage,
        );
    }
    const limit = env['SCORED_SESSION_LIMIT'];
    if (limit === undefined || limit === '') {
        throw new CommandError(
            'SCORED_SESSION_LIMIT must be given: the session limit of each judge test session, a positive number passed to Claude Code, which ends the session early when it is reached; there is no default (tools/scored-run/README.md)',
            EXIT.usage,
        );
    }
    const claude = env['SCORED_CLAUDE'] ?? 'claude';
    return {
        gradesFile: path.resolve(root, grades),
        judgeModel: fullModelName(
            'SCORED_JUDGE_MODEL',
            env['SCORED_JUDGE_MODEL'] ?? env['SCORED_MODEL'] ?? PINNED_MODEL,
        ),
        judgeSessionLimit: positive('SCORED_SESSION_LIMIT', limit, false),
        judgeTimeoutMinutes: positive(
            'SCORED_JUDGE_TIMEOUT_MINUTES',
            env['SCORED_JUDGE_TIMEOUT_MINUTES'] ?? String(DEFAULT_CALIBRATION_TIMEOUT_MINUTES),
            false,
        ),
        claude: /\.m?js$/.test(claude)
            ? { command: process.execPath, args: [path.resolve(root, claude)] }
            : { command: claude, args: [] },
        keep: env['SCORED_KEEP'] === 'true',
    };
}

/** Read the hand grades, or stop with every problem. */
export function readGrades(file: string, list: RequestList): Grades {
    if (!existsSync(file)) {
        throw new CommandError(`the grades file does not exist: ${file}`, EXIT.usage);
    }
    let value: unknown;
    try {
        value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    } catch (err) {
        throw new CommandError(
            `the grades file is not JSON: ${(err as Error).message}`,
            EXIT.usage,
        );
    }
    const problems = gradesProblems(value, list, path.dirname(file));
    if (problems.length > 0) {
        throw new CommandError(
            `the grades file is not one:\n  ${problems.join('\n  ')}`,
            EXIT.usage,
        );
    }
    return value as Grades;
}

/** Run the judge over every hand-graded result and write the calibration record. */
export function runCalibration(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
    log: (line: string) => void,
    recordFile: string = path.join(root, ...CALIBRATION_RECORD_FILE.split('/')),
): { readonly file: string; readonly record: CalibrationRecord; readonly stopped: boolean } {
    const options = calibrationOptions(root, env);
    const list = committedRequests(root);
    const grades = readGrades(options.gradesFile, list);
    const template = readFileSync(path.join(root, JUDGE_PROMPT_FILE), 'utf8');
    const validate = compileJudgeSchema(path.join(root, JUDGE_SCHEMA_FILE));
    const version = harnessVersion(options.claude);
    const gradesDir = path.dirname(options.gradesFile);
    const gradesName = inRepository(root, options.gradesFile, '<grades file>');
    log(
        `scored:calibrate: Claude Code ${version}, judge ${options.judgeModel}; ${String(grades.items.length)} hand-graded results: up to ${String(grades.items.length)} judge test sessions, each with session limit ${String(options.judgeSessionLimit)} and time limit ${String(options.judgeTimeoutMinutes)} minutes`,
    );
    const runDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'pychivalry-calibration-')));
    const items: CalibrationItem[] = [];
    let stopped = false;
    try {
        for (const [i, graded] of grades.items.entries()) {
            const request = list.requests.find((r) => r.id === graded.request) as ContentRequest;
            const result = path.resolve(gradesDir, graded.result);
            const folders = [
                { path: result, name: '<result>' },
                { path: runDir, name: '<run dir>' },
                { path: root, name: '<repository>' },
                { path: homedir(), name: '<home>' },
            ];
            const hand = request.judged.map((q) => ({
                dimension: q.dimension,
                answer: graded.grades[q.dimension] as JudgeAnswer,
            }));
            const dir = path.join(runDir, `item-${String(i + 1)}`);
            mkdirSync(dir);
            const files = resultFiles(result, baseDir(root, request.base));
            let judge: JudgeRecord;
            if (resultText(files).length > MATERIAL_LIMIT) {
                judge = notJudged(
                    `the result is over the ${String(MATERIAL_LIMIT)} characters a judge is given`,
                );
            } else {
                const run = runJudge({
                    claude: options.claude,
                    model: options.judgeModel,
                    sessionLimit: options.judgeSessionLimit,
                    timeoutMinutes: options.judgeTimeoutMinutes,
                    env,
                    dir,
                    prompt: judgePrompt(template, request, files),
                    request,
                    validate,
                });
                judge = judgeRecord(run, (text) => sanitize(text, folders));
            }
            const item: CalibrationItem = {
                item: i + 1,
                request: request.id,
                hand,
                judge,
                agrees: agreesOf(hand, judge),
            };
            items.push(item);
            const agreed = item.agrees.filter((a) => a.agrees === true).length;
            log(
                `item ${String(i + 1)} (${request.id}): judge ${judge.state}; ${String(agreed)} of ${String(hand.length)} grades agreed${judge.harness_problems.length > 0 ? `; harness: ${judge.harness_problems.join('; ')}` : ''}`,
            );
            if (judge.harness_problems.length > 0) {
                stopped = true;
                log(
                    `scored:calibrate: stopped after item ${String(i + 1)}, whose judge's harness did not hold: the items after it would say as little`,
                );
                break;
            }
        }
    } finally {
        if (options.keep) {
            log(`scored:calibrate: the judge sessions are kept in ${runDir}`);
        } else {
            rmSync(runDir, { recursive: true, force: true });
        }
    }
    const summary = calibrationSummary(items);
    const record: CalibrationRecord = {
        record_format: 1,
        suite: CALIBRATION_SUITE,
        command: `SCORED_JUDGE_MODEL=${options.judgeModel} SCORED_SESSION_LIMIT=${String(options.judgeSessionLimit)} SCORED_GRADES=${gradesName}${options.claude.command !== 'claude' || options.claude.args.length > 0 ? ' SCORED_CLAUDE=<another Claude Code>' : ''} task scored:calibrate`,
        made_at: now(),
        tool: toolInfo(root),
        machine: machineInfo(),
        game: null,
        spec: committedSpec(root),
        corpus: null,
        notes: [
            'Each item is one judge test session of the Claude Code installed on the machine the run was made on, given a request and a result a person graded by hand; the script gave it no credentials, and pychivalry itself makes no model call.',
            `The judge agreed with the person on ${String(summary.overall.agree)} of the ${String(summary.overall.judged)} grades it answered (${String(summary.overall.grades)} in all${stopped ? '; the run stopped at a judge whose harness did not hold' : ''}).`,
        ],
        results: {
            grades: {
                file: gradesName,
                sha256: sha256OfFile(options.gradesFile),
                items: items.length,
            },
            requests_file: REQUESTS_FILE,
            requests_sha256: sha256OfFile(path.join(root, REQUESTS_FILE)),
            judge_prompt_file: JUDGE_PROMPT_FILE,
            judge_prompt_sha256: sha256OfFile(path.join(root, JUDGE_PROMPT_FILE)),
            judge_schema_file: JUDGE_SCHEMA_FILE,
            judge_schema_sha256: sha256OfFile(path.join(root, JUDGE_SCHEMA_FILE)),
            answers: [...JUDGE_ANSWERS],
            harness: { name: 'claude-code', version },
            judge_model: options.judgeModel,
            judge_session_limit: options.judgeSessionLimit,
            judge_timeout_minutes: options.judgeTimeoutMinutes,
            judge_arguments: judgeArgs({
                model: options.judgeModel,
                sessionLimit: options.judgeSessionLimit,
            }),
            items,
            dimensions: summary.dimensions,
            overall: summary.overall,
        },
    };
    writeJson(recordFile, record);
    const o = summary.overall;
    log(
        `scored:calibrate: agreement ${o.agreement === null ? 'none (no grade judged)' : String(o.agreement)} (${String(o.agree)} of ${String(o.judged)} judged, ${String(o.grades)} grades); the judge said cannot-tell ${String(o.judge_cannot_tell)} times, the person ${String(o.hand_cannot_tell)}; record written to ${relativePosix(root, recordFile)}`,
    );
    return { file: recordFile, record, stopped };
}
