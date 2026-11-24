/**
 * The judge of the scored authoring test (docs/PLAN.md items 9.5 and 9.6): grade two, the match
 * of a result to its request, on the request's judged dimensions. pychivalry makes no model call:
 * the judge is one more test session of the developer's own Claude Code, started as a child
 * process exactly as the authoring trials are (`runJudge`), with no tool, no agent server and no
 * skill, its whole prompt on its standard input. It counts against the developer's own Claude
 * plan like any session they open.
 *
 * Three fixed files make it, each held by `judge.test.ts`:
 *
 * - the prompt, `tools/scored-run/judge.prompt.md`: the instructions, then the request, its
 *   questions and the result, filled into its four slots (`judgePrompt`);
 * - the answer's schema, `tools/scored-run/judge.schema.json`: one JSON object naming the
 *   request and answering each question `yes`, `no` or `cannot-tell`, with a reason;
 * - the parsing (`parseJudgeAnswer`): the session's last words, trimmed, and if they are one
 *   fenced code block, its inside; that text must be JSON valid against the schema, name the
 *   request it was asked about, and answer exactly the request's questions. Anything else is
 *   recorded as malformed, with what was wrong, and nothing is guessed from it.
 *
 * The reasons are printed for the person running the test and never recorded, as no session's
 * own words are.
 */

import { spawnSync } from 'node:child_process';
import {
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    readdirSync,
    readFileSync,
    statSync,
} from 'node:fs';
import path from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { CommandError, EXIT, isObject } from '../util.js';
import { sessionProblems, type Confinement, type Stopped } from './confinement.js';
import type { ContentRequest } from './requests.js';
import { SESSION_LIMIT_OPTION, stoppedBy, trialEnv } from './run.js';
import { readStream, type StreamSummary } from './stream.js';

export const JUDGE_PROMPT_FILE = 'tools/scored-run/judge.prompt.md';
export const JUDGE_SCHEMA_FILE = 'tools/scored-run/judge.schema.json';

/** The closed set a judge answers each question from. */
export const JUDGE_ANSWERS = ['yes', 'no', 'cannot-tell'] as const;
export type JudgeAnswer = (typeof JUDGE_ANSWERS)[number];

/** The slots of the judge's prompt, each written `{{name}}` once in the template. */
export const JUDGE_SLOTS = ['request_id', 'request', 'questions', 'result'] as const;

/**
 * The most characters of result a judge is given. A larger result is not judged (its record
 * says why): a mod written for one request is a few files, and a result larger than this is not
 * one the judge could read whole.
 */
export const MATERIAL_LIMIT = 200_000;

/** What a judge's session may be offered: nothing at all. */
export const JUDGE_CONFINEMENT: Confinement = {
    builtIn: [],
    server: null,
    skills: { required: [], othersAllowed: false },
};

/** Folders of a trial's mod that are the harness's, not the result: the skills the run put there. */
export const HARNESS_FOLDERS: readonly string[] = ['.claude'];

/** A file of a result, as the judge is shown it. */
export interface ResultFile {
    /** Inside the mod, with `/`. */
    readonly path: string;
    /** Whether the session wrote it, changed it, removed it, or left it as the mod was given. */
    readonly state: 'written' | 'changed' | 'removed' | 'as given';
    /** Its text, without the byte-order mark and with `\n` line breaks; null when removed. */
    readonly text: string | null;
}

function filesUnder(dir: string, rel = ''): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    const out: string[] = [];
    for (const name of readdirSync(dir).sort()) {
        const inside = rel === '' ? name : `${rel}/${name}`;
        if (rel === '' && HARNESS_FOLDERS.includes(name)) {
            continue;
        }
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...filesUnder(full, inside));
        } else {
            out.push(inside);
        }
    }
    return out;
}

function textOf(bytes: Uint8Array): string {
    try {
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
            .decode(bytes)
            .replace(/^\uFEFF/, '')
            .replace(/\r\n/g, '\n');
    } catch {
        return `(not valid UTF-8 text: ${String(bytes.length)} bytes)`;
    }
}

/**
 * The files of a result: every file of `modDir` but the harness's folders, each marked against
 * the mod as it was given (`givenDir`), and every file given that is gone, in path order.
 */
export function resultFiles(modDir: string, givenDir: string): ResultFile[] {
    const now = new Set(filesUnder(modDir));
    const given = new Set(filesUnder(givenDir));
    const out: ResultFile[] = [];
    for (const file of [...new Set([...now, ...given])].sort()) {
        if (!now.has(file)) {
            out.push({ path: file, state: 'removed', text: null });
            continue;
        }
        const bytes = readFileSync(path.join(modDir, ...file.split('/')));
        const state = !given.has(file)
            ? 'written'
            : Buffer.compare(bytes, readFileSync(path.join(givenDir, ...file.split('/')))) === 0
              ? 'as given'
              : 'changed';
        out.push({ path: file, state, text: textOf(bytes) });
    }
    return out;
}

const STATE_WORDS: Readonly<Record<ResultFile['state'], string>> = {
    written: 'written while the request was worked on',
    changed: 'changed while the request was worked on',
    removed: 'removed while the request was worked on',
    'as given': 'as it was given',
};

/** The result as the judge's prompt shows it: each file between two marker lines. */
export function resultText(files: readonly ResultFile[]): string {
    if (files.length === 0) {
        return '(the mod holds no file)';
    }
    return files
        .map((f) =>
            f.text === null
                ? `--- file ${f.path} (${STATE_WORDS[f.state]}) ---`
                : `--- file ${f.path} (${STATE_WORDS[f.state]}) ---\n${f.text.replace(/\n$/, '')}\n--- end of ${f.path} ---`,
        )
        .join('\n\n');
}

/**
 * The template with each `{{slot}}` filled once. The values are put in as they are: a slot
 * written inside a value is not filled again. A slot missing from the template, or one the
 * template has that no value fills, is an error.
 */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
    const parts = template.split(/(\{\{[a-z_]+\}\})/);
    const used = new Set<string>();
    const out = parts.map((part) => {
        const slot = /^\{\{([a-z_]+)\}\}$/.exec(part)?.[1];
        if (slot === undefined) {
            return part;
        }
        const value = values[slot];
        if (value === undefined) {
            throw new CommandError(
                `the template has a slot no value fills: {{${slot}}}`,
                EXIT.usage,
            );
        }
        if (used.has(slot)) {
            throw new CommandError(`the template has the slot {{${slot}}} twice`, EXIT.usage);
        }
        used.add(slot);
        return value;
    });
    const unused = Object.keys(values).filter((k) => !used.has(k));
    if (unused.length > 0) {
        throw new CommandError(
            `the template has no slot for: ${unused.map((k) => `{{${k}}}`).join(', ')}`,
            EXIT.usage,
        );
    }
    return out.join('');
}

/** The judge's whole prompt for one result of a request. */
export function judgePrompt(
    template: string,
    request: ContentRequest,
    files: readonly ResultFile[],
): string {
    return fillTemplate(template, {
        request_id: request.id,
        request: request.request,
        questions: request.judged.map((q) => `- ${q.dimension}: ${q.question}`).join('\n'),
        result: resultText(files),
    });
}

/**
 * Claude Code's arguments for a judge's session: command-line mode with the prompt on standard
 * input (`-p` and no prompt argument, so that a large result is never bound by the length of a
 * command line), no tool (`--tools ""`), no agent server (`--strict-mcp-config` and no
 * configuration), no skill (`--disable-slash-commands`), none of the person's own settings
 * (`--setting-sources project,local`, in an empty folder), the session limit, and the stream the
 * run reads.
 */
export function judgeArgs(options: {
    readonly model: string;
    readonly sessionLimit: number;
}): string[] {
    return [
        '-p',
        '--tools',
        '',
        '--strict-mcp-config',
        '--permission-mode',
        'dontAsk',
        SESSION_LIMIT_OPTION,
        String(options.sessionLimit),
        '--output-format',
        'stream-json',
        '--verbose',
        '--no-session-persistence',
        '--model',
        options.model,
        '--setting-sources',
        'project,local',
        '--disable-slash-commands',
    ];
}

/** Compile the answer's schema (strict, as the record schema is). */
export function compileJudgeSchema(file: string): ValidateFunction {
    const ajv = new Ajv2020({ allErrors: false, strict: true });
    return ajv.compile(JSON.parse(readFileSync(file, 'utf8')) as object);
}

/** One answer of a judge, as parsed. */
export interface JudgedAnswer {
    readonly dimension: string;
    readonly answer: JudgeAnswer;
    /** The judge's sentence: printed for the person running the test, never recorded. */
    readonly reason: string;
}

/** What a judge's answer was: answers to every question, or malformed and why. */
export type JudgeVerdict =
    | { readonly state: 'answered'; readonly answers: readonly JudgedAnswer[] }
    | { readonly state: 'malformed'; readonly why: string };

function malformed(why: string): JudgeVerdict {
    return { state: 'malformed', why };
}

/**
 * Parse a judge's last words (`parseJudgeAnswer`, the rule of the header above): answered, in
 * the order of the request's questions, or malformed with what was wrong.
 */
export function parseJudgeAnswer(
    text: string | null,
    request: ContentRequest,
    validate: ValidateFunction,
): JudgeVerdict {
    if (text === null || text.trim() === '') {
        return malformed('the session gave no answer');
    }
    let body = text.trim();
    const fence = /^```[a-z]*\n([\s\S]*?)\n```$/.exec(body);
    if (fence !== null) {
        body = (fence[1] ?? '').trim();
    }
    let value: unknown;
    try {
        value = JSON.parse(body) as unknown;
    } catch {
        return malformed('the answer is not one JSON object');
    }
    if (!validate(value)) {
        const error = validate.errors?.[0];
        const where =
            error === undefined || error.instancePath === '' ? 'the answer' : error.instancePath;
        return malformed(
            `${where} does not match the answer's schema (${error?.message ?? 'invalid'})`,
        );
    }
    if (!isObject(value) || !isObject(value['answers'])) {
        return malformed("the answer does not match the answer's schema");
    }
    if (value['request'] !== request.id) {
        return malformed(
            `the answer is about the request ${JSON.stringify(value['request'])}, not ${request.id}`,
        );
    }
    const given = value['answers'];
    const asked = request.judged.map((q) => q.dimension);
    const missing = asked.filter((d) => !(d in given));
    if (missing.length > 0) {
        return malformed(`no answer to: ${missing.join(', ')}`);
    }
    const extra = Object.keys(given).filter((d) => !asked.includes(d));
    if (extra.length > 0) {
        return malformed(`answers to questions it was not asked: ${extra.join(', ')}`);
    }
    return {
        state: 'answered',
        answers: asked.map((dimension) => {
            const entry = given[dimension] as { answer: JudgeAnswer; reason: string };
            return { dimension, answer: entry.answer, reason: entry.reason };
        }),
    };
}

/** The judge's part of a trial or a calibration item, as a record states it. */
export interface JudgeRecord {
    /**
     * `answered`: every question answered; `malformed`: the session answered, but not in the
     * answer's shape (`why` says how); `not-judged`: no judge was asked or its session said
     * nothing (`why`).
     */
    readonly state: 'answered' | 'malformed' | 'not-judged';
    readonly why: string | null;
    /** How the judge's session ended; null when none was started. */
    readonly stopped: Stopped | null;
    readonly harness_problems: readonly string[];
    /** One per question of the request, in its order, when answered; otherwise none. */
    readonly answers: readonly { readonly dimension: string; readonly answer: JudgeAnswer }[];
    readonly turns: number | null;
    readonly duration_ms: number | null;
    readonly exit_code: number | null;
}

/** The record of a judge that was not asked, and why. */
export function notJudged(why: string): JudgeRecord {
    return {
        state: 'not-judged',
        why,
        stopped: null,
        harness_problems: [],
        answers: [],
        turns: null,
        duration_ms: null,
        exit_code: null,
    };
}

/**
 * The record of a judge's session: its end, its problems (each passed through `clean`, which
 * names the run's folders), and its answers or why there are none. The reasons are left out.
 */
export function judgeRecord(run: JudgeRun, clean: (text: string) => string): JudgeRecord {
    const base = {
        stopped: run.stopped,
        harness_problems: run.problems.map(clean),
        turns: run.summary.result?.turns ?? null,
        duration_ms: run.summary.result?.durationMs ?? null,
        exit_code: run.exitCode,
    };
    const verdict = run.verdict;
    if (verdict === null) {
        return {
            ...base,
            state: 'not-judged',
            why: "the judge's session had a harness problem",
            answers: [],
        };
    }
    if (verdict.state === 'malformed') {
        return { ...base, state: 'malformed', why: verdict.why, answers: [] };
    }
    return {
        ...base,
        state: 'answered',
        why: null,
        answers: verdict.answers.map((a) => ({ dimension: a.dimension, answer: a.answer })),
    };
}

/** What a judge's session gave. */
export interface JudgeRun {
    readonly summary: StreamSummary;
    readonly stopped: Stopped;
    readonly exitCode: number | null;
    /** What makes the session say nothing: it broke, was not confined, or ended unanswered. */
    readonly problems: readonly string[];
    /** Its answer, parsed; null when the session had a problem. */
    readonly verdict: JudgeVerdict | null;
}

/**
 * Start one judge's session: Claude Code in an empty folder of its own, the prompt on its
 * standard input, its stream and its error output written into that folder's parent. The
 * session's environment is a trial's (`trialEnv`): no key or token variable, nothing of a
 * surrounding session.
 */
export function runJudge(options: {
    readonly claude: { readonly command: string; readonly args: readonly string[] };
    readonly model: string;
    readonly sessionLimit: number;
    readonly timeoutMinutes: number;
    readonly env: Readonly<Record<string, string | undefined>>;
    /** The folder the judge's files go in; its `judge/` subfolder is the session's folder. */
    readonly dir: string;
    readonly prompt: string;
    readonly request: ContentRequest;
    readonly validate: ValidateFunction;
}): JudgeRun {
    const cwd = path.join(options.dir, 'judge');
    mkdirSync(cwd, { recursive: true });
    const streamFile = path.join(options.dir, 'judge-stream.jsonl');
    const out = openSync(streamFile, 'w');
    const err = openSync(path.join(options.dir, 'judge-stderr.txt'), 'w');
    let spawned;
    try {
        spawned = spawnSync(
            options.claude.command,
            [
                ...options.claude.args,
                ...judgeArgs({ model: options.model, sessionLimit: options.sessionLimit }),
            ],
            {
                cwd,
                input: options.prompt,
                stdio: ['pipe', out, err],
                env: trialEnv(options.env),
                timeout: options.timeoutMinutes * 60_000,
                killSignal: 'SIGTERM',
            },
        );
    } finally {
        closeSync(out);
        closeSync(err);
    }
    const timedOut = (spawned.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
    if (spawned.error !== undefined && !timedOut) {
        throw new CommandError(
            `Claude Code could not be started for the judge: ${spawned.error.message}`,
            EXIT.usage,
        );
    }
    const summary = readStream(readFileSync(streamFile, 'utf8'));
    const stopped = stoppedBy(summary, timedOut);
    const problems = sessionProblems(
        summary,
        stopped,
        spawned.status,
        options.timeoutMinutes,
        JUDGE_CONFINEMENT,
    );
    if (stopped === 'session-limit' || stopped === 'turns') {
        problems.push(`the judge's session ended before it answered (${stopped})`);
    }
    return {
        summary,
        stopped,
        exitCode: spawned.status,
        problems,
        verdict:
            problems.length === 0
                ? parseJudgeAnswer(summary.result?.text ?? null, options.request, options.validate)
                : null,
    };
}
