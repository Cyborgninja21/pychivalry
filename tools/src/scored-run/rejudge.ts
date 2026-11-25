/**
 * Re-judging kept results (docs/PLAN.md item 9.8), behind `task scored:rejudge`: the judge of the
 * scored authoring test run again, with the committed judge's prompt, over the results of an
 * authoring record whose trials its run kept (`SCORED_KEEP=true`), with no authoring session
 * started. Like the run it is a developer's test script, never run by CI: each trial judged is
 * one judge test session of the developer's own Claude Code, started exactly as the run starts
 * its judge (`judge.ts`), counting against the developer's own Claude plan. pychivalry makes no
 * model call.
 *
 * **What it may re-judge.** Before any session it refuses, naming every reason, unless the record
 * (`SCORED_FROM`, a file of `records/scored/`) is an authoring record whose figures agree; the
 * request list, the base mods and the spec package are the ones it was made with, by their hashes;
 * the game (`CK3_GAME_PATH`) is the one it read, by its manifest; the Claude Code is the version
 * that made it; and every trial of it has its kept folder (`<request>-<n>/` under one of the
 * folders `SCORED_KEPT` names, with its `mod/` and its `stream.jsonl`), whose stream is the
 * record's session (the same tool calls, turns, time and start) and whose result, graded again
 * over the game, has the record's validity and expectations to the letter. So the record it
 * writes has the trials of the record it read, sessions, results and grades unchanged, with only
 * the judge new.
 *
 * **What it judges.** Every trial whose authoring session was set up as the run asks and ended by
 * itself, by the run's rule of today (`authoring.ts`): a trial that did not hold for what its
 * session did (a file named outside its mod) is judged too, as the run now judges it. The judge is
 * given what the run's judge is given (`judgeMaterial`). It stops as the run does after a judge
 * session that did not hold, when the sessions after it would say as little (`stop-rule.ts`), and
 * then writes nothing: a record judged partly by one prompt and partly by another is never made.
 *
 * **The record**, `SCORED_RECORD` or `records/scored/<record>-judge-<version>.json` beside the one
 * it read, never over it: the record read, with the judge's prompt, schema, model, session limit,
 * time limit and arguments of this run, each trial's judge and `harness_held` anew, the measures
 * summed again, the command of this run, and a note saying what was re-judged, when, at which
 * commit and with which version of the judge's prompt. Its `tool` and `made_at` stay the record's:
 * they say what made the sessions and the results, as a continued record's do.
 */

import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { checkWorkspace, defaultCacheDir, openSpec, openWorkspace } from '@pychivalry/core';
import { gameInfo, requireGameDir } from '../game.js';
import { committedSpec, now, toolInfo } from '../record.js';
import { CommandError, EXIT, relativePosix, sha256OfFile, writeJson } from '../util.js';
import { summarize, type AuthoringRecord, type AuthoringTrial } from './authoring-record.js';
import { readAuthoringRecord } from './authoring-targets.js';
import {
    authoringConfinement,
    DEFAULT_JUDGE_TIMEOUT_MINUTES,
    folderSha256,
    measuredRequests,
    validityOf,
} from './authoring.js';
import { sessionProblems } from './confinement.js';
import { checkExpectations } from './expectations.js';
import {
    compileJudgeSchema,
    JUDGE_CONFINEMENT,
    JUDGE_PROMPT_FILE,
    JUDGE_SCHEMA_FILE,
    judgeArgs,
    judgeMaterial,
    judgePrompt,
    judgePromptVersion,
    judgeRecord,
    MATERIAL_LIMIT,
    notJudged,
    resultFiles,
    resultText,
    runJudge,
    type JudgeRecord,
} from './judge.js';
import { baseDir, committedRequests, REQUESTS_FILE } from './requests.js';
import {
    fullModelName,
    harnessVersion,
    inRepository,
    PINNED_JUDGE_MODEL,
    positive,
    sanitize,
    sessionRecord,
    stoppedBy,
} from './run.js';
import { ENDED_BY_ITSELF, stopReason, type TrialOutcome } from './stop-rule.js';
import { readStream } from './stream.js';

/** Why a trial's judge is not asked, as the run says it. */
const NOT_SET_UP = "the authoring session's harness did not hold";

/** The re-judging's parameters, from the environment. */
export interface RejudgeOptions {
    /** The authoring record whose results are judged again. */
    readonly fromFile: string;
    /** The folders the record's run kept its trials in. */
    readonly keptDirs: readonly string[];
    readonly gameDir: string;
    readonly judgeModel: string;
    readonly judgeSessionLimit: number;
    readonly judgeTimeoutMinutes: number;
    readonly claude: { readonly command: string; readonly args: readonly string[] };
    readonly keep: boolean;
}

/** A `.json` file directly in `records/scored/`, named from the repository root, or why not. */
function scoredFile(root: string, variable: string, named: string): string {
    const file = path.resolve(root, named);
    const folder = path.join(root, 'records', 'scored');
    if (path.dirname(file) !== folder || !file.endsWith('.json') || file.endsWith('.schema.json')) {
        throw new CommandError(
            `${variable} must name a .json file directly in records/scored/ (from the repository root), such as records/scored/authoring-expert-run-1.json; not ${named}`,
            EXIT.usage,
        );
    }
    return file;
}

export function rejudgeOptions(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
): RejudgeOptions {
    const from = env['SCORED_FROM'];
    if (from === undefined || from === '') {
        throw new CommandError(
            'SCORED_FROM must name the authoring record whose kept results are judged again, a .json file of records/scored/ (tools/scored-run/README.md, "Re-judging kept results")',
            EXIT.usage,
        );
    }
    const fromFile = scoredFile(root, 'SCORED_FROM', from);
    const kept = env['SCORED_KEPT'];
    if (kept === undefined || kept === '') {
        throw new CommandError(
            `SCORED_KEPT must name the folders the record's run kept its trials in (the folder a run made with SCORED_KEEP=true printed), separated by "${path.delimiter}"`,
            EXIT.usage,
        );
    }
    const keptDirs = kept
        .split(path.delimiter)
        .filter((d) => d !== '')
        .map((d) => path.resolve(root, d));
    const missing = keptDirs.filter((d) => !existsSync(d));
    if (missing.length > 0) {
        throw new CommandError(
            `SCORED_KEPT names a folder that does not exist: ${missing.join(', ')}`,
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
        fromFile,
        keptDirs,
        gameDir: requireGameDir(env['CK3_GAME_PATH']),
        judgeModel: fullModelName(
            'SCORED_JUDGE_MODEL',
            env['SCORED_JUDGE_MODEL'] ?? PINNED_JUDGE_MODEL,
        ),
        judgeSessionLimit: positive('SCORED_SESSION_LIMIT', limit, false),
        judgeTimeoutMinutes: positive(
            'SCORED_JUDGE_TIMEOUT_MINUTES',
            env['SCORED_JUDGE_TIMEOUT_MINUTES'] ?? String(DEFAULT_JUDGE_TIMEOUT_MINUTES),
            false,
        ),
        claude: /\.m?js$/.test(claude)
            ? { command: process.execPath, args: [path.resolve(root, claude)] }
            : { command: claude, args: [] },
        keep: env['SCORED_KEEP'] === 'true',
    };
}

/**
 * Where the re-judged record is written: `SCORED_RECORD`, or `<record>-judge-<version>.json`
 * beside the record read, `<version>` the committed version of the judge's prompt; never over the
 * record read.
 */
export function rejudgeRecordFile(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
    fromFile: string,
): string {
    const named = env['SCORED_RECORD'];
    const version = judgePromptVersion(sha256OfFile(path.join(root, JUDGE_PROMPT_FILE)));
    const file =
        named === undefined || named === ''
            ? path.join(
                  path.dirname(fromFile),
                  `${path.basename(fromFile, '.json')}-judge-${String(version?.version ?? 'new')}.json`,
              )
            : scoredFile(root, 'SCORED_RECORD', named);
    if (path.resolve(file) === path.resolve(fromFile)) {
        throw new CommandError(
            `SCORED_RECORD names the record that is read (${relativePosix(root, fromFile)}): a re-judged record is written beside it, never over it`,
            EXIT.usage,
        );
    }
    return file;
}

/** The kept folder of a trial (`<request>-<n>/`, with its `mod/` and `stream.jsonl`), or why none. */
export function keptTrial(
    keptDirs: readonly string[],
    task: string,
    trial: number,
): { readonly dir: string } | { readonly problem: string } {
    const name = `${task}-${String(trial)}`;
    const found = keptDirs
        .map((d) => path.join(d, name))
        .filter((d) => existsSync(path.join(d, 'mod')) && existsSync(path.join(d, 'stream.jsonl')));
    if (found.length === 1 && found[0] !== undefined) {
        return { dir: found[0] };
    }
    return {
        problem:
            found.length === 0
                ? `${task} trial ${String(trial)}: no kept folder ${name}/ with its mod/ and stream.jsonl in SCORED_KEPT`
                : `${task} trial ${String(trial)}: kept in more than one folder of SCORED_KEPT (${found.join(', ')})`,
    };
}

/** One trial of the record as planned: its kept folder and whether its judge is asked. */
interface Planned {
    readonly trial: AuthoringTrial;
    readonly dir: string;
    readonly judgeable: boolean;
}

/** What the re-judging did. */
export interface Rejudged {
    /** The record written; null when it stopped, and wrote nothing. */
    readonly file: string | null;
    readonly record: AuthoringRecord | null;
    /** Why it stopped, or null. */
    readonly stopped: string | null;
    /** The judge test sessions started. */
    readonly sessions: number;
}

/**
 * Re-judge an authoring record's kept results with the committed judge and write the record
 * (`recordFile`, `rejudgeRecordFile` by default; a test writes elsewhere).
 */
export function runRejudge(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
    log: (line: string) => void,
    files: { readonly from?: string; readonly record?: string } = {},
): Rejudged {
    const options = rejudgeOptions(root, env);
    const fromFile = files.from ?? options.fromFile;
    const recordFile = files.record ?? rejudgeRecordFile(root, env, fromFile);
    const source = readAuthoringRecord(root, fromFile);
    const results = source.results;
    const spec = openSpec(path.join(root, 'spec'));
    const list = committedRequests(root);
    const template = readFileSync(path.join(root, JUDGE_PROMPT_FILE), 'utf8');
    const promptSha = sha256OfFile(path.join(root, JUDGE_PROMPT_FILE));
    const version = judgePromptVersion(promptSha);
    const validate = compileJudgeSchema(path.join(root, JUDGE_SCHEMA_FILE));
    const harness = harnessVersion(options.claude);
    const game = gameInfo(options.gameDir);

    // What the record was made with, against what this checkout and machine have.
    const problems: string[] = [];
    if (sha256OfFile(path.join(root, REQUESTS_FILE)) !== results.task.requests_sha256) {
        problems.push(
            `the request list (${REQUESTS_FILE}) is not the one the record was made with: its questions would not be the record's`,
        );
    }
    for (const base of results.task.bases) {
        if (folderSha256(baseDir(root, base.name)) !== base.sha256) {
            problems.push(`the base mod ${base.name} is not the one the record was made with`);
        }
    }
    const committed = committedSpec(root);
    if (committed.sha256 !== source.spec.sha256) {
        problems.push(
            `the spec package is not the one the record was made with (${source.spec.version}): the checker and the judge's keywords read it`,
        );
    }
    if (game.build !== source.game.build || game.manifest_sha256 !== source.game.manifest_sha256) {
        problems.push(
            `CK3_GAME_PATH is not the game the record read (build ${source.game.build}, its manifest ${source.game.manifest_sha256.slice(0, 12)}…; here build ${game.build}, ${game.manifest_sha256.slice(0, 12)}…)`,
        );
    }
    if (harness !== results.harness.version) {
        problems.push(
            `Claude Code ${harness} is not the version the record was made with (${results.harness.version}); SCORED_CLAUDE names another`,
        );
    }
    const confinement = authoringConfinement(
        results.task.skills.map((s) => ({ name: s.name, folder: s.name, sha256: s.sha256 })),
    );
    const planned: Planned[] = [];
    for (const trial of results.trials) {
        const kept = keptTrial(options.keptDirs, trial.task, trial.trial);
        if ('problem' in kept) {
            problems.push(kept.problem);
            continue;
        }
        const summary = readStream(readFileSync(path.join(kept.dir, 'stream.jsonl'), 'utf8'));
        const session = sessionRecord(summary);
        const recorded = {
            tool_calls: trial.tool_calls,
            permission_denials: trial.permission_denials,
            session: trial.session,
            turns: trial.turns,
            duration_ms: trial.duration_ms,
        };
        if (
            !isDeepStrictEqual(JSON.parse(JSON.stringify(session)), recorded) ||
            stoppedBy(summary, trial.stopped === 'timeout') !== trial.stopped
        ) {
            problems.push(
                `${trial.task} trial ${String(trial.trial)}: the kept stream is not the record's session (its tool calls, turns, time, start or end differ)`,
            );
            continue;
        }
        const setUp = sessionProblems(
            summary,
            'finished',
            trial.exit_code,
            results.timeout_minutes,
            confinement,
        );
        planned.push({
            trial,
            dir: kept.dir,
            judgeable: setUp.length === 0 && ENDED_BY_ITSELF.includes(trial.stopped),
        });
    }
    if (problems.length > 0) {
        throw new CommandError(
            `the kept results cannot be judged again as ${relativePosix(root, fromFile)}'s, so no test session was started:\n  ${problems.join('\n  ')}`,
            EXIT.usage,
        );
    }

    const runDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'pychivalry-rejudge-')));
    const cacheDir = path.join(runDir, 'cache');
    const indexCache = defaultCacheDir({ XDG_CACHE_HOME: cacheDir, LOCALAPPDATA: cacheDir });
    const trials: AuthoringTrial[] = [];
    const outcomes: TrialOutcome[] = [];
    let stopped: string | null = null;
    let sessions = 0;
    try {
        openWorkspace({ spec, gameDir: options.gameDir, cacheDir: indexCache, modDir: null });
        // Every result graded again before any session: the record's grades, to the letter.
        const graded = planned.map((p) => {
            const modDir = path.join(p.dir, 'mod');
            const folders = [
                { path: modDir, name: '<trial mod>' },
                { path: path.dirname(p.dir), name: '<run dir>' },
                { path: options.gameDir, name: '<game dir>' },
                { path: root, name: '<repository>' },
                { path: homedir(), name: '<home>' },
            ];
            const request = list.requests.find((r) => r.id === p.trial.task);
            if (request === undefined) {
                return {
                    p,
                    folders,
                    problem: `${p.trial.task}: no request of that id`,
                    findings: null,
                };
            }
            const givenDir = baseDir(root, request.base);
            const check = checkWorkspace({
                spec,
                gameDir: options.gameDir,
                cacheDir: indexCache,
                modDir,
            });
            const expectations = checkExpectations(
                { index: check.index, modDir, givenDir },
                request.expect,
            ).map((e) => ({
                ...e,
                problem: e.problem === null ? null : sanitize(e.problem, folders),
            }));
            const differs = [
                ...(isDeepStrictEqual(validityOf(check.findings), p.trial.validity)
                    ? []
                    : ['validity']),
                ...(isDeepStrictEqual(
                    JSON.parse(JSON.stringify(expectations)),
                    p.trial.expectations,
                )
                    ? []
                    : ['expectations']),
            ];
            return {
                p,
                folders,
                request,
                // The findings alone are kept: a check holds the base game's index, and 61 of them
                // would not fit in memory.
                findings: check.findings.map((f) => ({
                    severity: f.severity,
                    code: f.code,
                    file: f.file,
                    range: f.range,
                    message: f.message,
                })),
                problem:
                    differs.length === 0
                        ? null
                        : `${p.trial.task} trial ${String(p.trial.trial)}: graded again, its ${differs.join(' and ')} differ from the record's`,
            };
        });
        const regrade = graded.flatMap((g) => (g.problem === null ? [] : [g.problem]));
        if (regrade.length > 0) {
            throw new CommandError(
                `the kept results are not the results ${relativePosix(root, fromFile)} graded, so no test session was started:\n  ${regrade.join('\n  ')}`,
                EXIT.usage,
            );
        }
        log(
            `scored:rejudge: ${relativePosix(root, fromFile)}: ${String(planned.length)} trials, every kept result graded as the record graded it; ${String(planned.filter((p) => p.judgeable).length)} judge test sessions of Claude Code ${harness}, judge ${options.judgeModel}, each with session limit ${String(options.judgeSessionLimit)}, judge prompt version ${String(version?.version ?? 'unknown')}`,
        );
        for (const g of graded) {
            const { trial } = g.p;
            let judge: JudgeRecord;
            if (!g.p.judgeable || g.request === undefined) {
                judge = notJudged(NOT_SET_UP);
            } else {
                const files = resultFiles(path.join(g.p.dir, 'mod'), baseDir(root, g.request.base));
                const material = resultText(files);
                if (material.length > MATERIAL_LIMIT) {
                    judge = notJudged(
                        `the result is ${String(material.length)} characters, over the ${String(MATERIAL_LIMIT)} a judge is given`,
                    );
                } else {
                    const dir = path.join(runDir, `${trial.task}-${String(trial.trial)}`);
                    mkdirSync(dir, { recursive: true });
                    const run = runJudge({
                        claude: options.claude,
                        model: options.judgeModel,
                        sessionLimit: options.judgeSessionLimit,
                        timeoutMinutes: options.judgeTimeoutMinutes,
                        env,
                        dir,
                        prompt: judgePrompt(
                            template,
                            g.request,
                            judgeMaterial({
                                spec,
                                files,
                                game: game.build,
                                findings: g.findings,
                            }),
                        ),
                        request: g.request,
                        validate,
                    });
                    sessions++;
                    if (run.verdict?.state === 'answered') {
                        for (const a of run.verdict.answers) {
                            // The judge's reasons, for the person running it; never recorded.
                            log(
                                `${trial.task} trial ${String(trial.trial)}: judge on ${a.dimension}: ${a.answer}: ${sanitize(a.reason, g.folders)}`,
                            );
                        }
                    }
                    judge = judgeRecord(run, (text) => sanitize(text, g.folders));
                    outcomes.push({
                        held: judge.harness_problems.length === 0,
                        setUp: sessionProblems(
                            run.summary,
                            'finished',
                            run.exitCode,
                            options.judgeTimeoutMinutes,
                            JUDGE_CONFINEMENT,
                        ).map((p) => `the judge's session: ${sanitize(p, g.folders)}`),
                        broke: judge.harness_problems.length > 0,
                    });
                }
            }
            trials.push({
                ...trial,
                harness_held:
                    trial.harness_problems.length === 0 && judge.harness_problems.length === 0,
                judge,
            });
            log(
                `${trial.task} trial ${String(trial.trial)}: judge ${judge.state}${judge.answers.length === 0 ? '' : `: ${judge.answers.map((a) => `${a.dimension} ${a.answer}`).join(', ')}`}${judge.harness_problems.length > 0 ? `; harness: ${judge.harness_problems.join('; ')}` : ''}`,
            );
            const why = stopReason(outcomes);
            if (why !== null) {
                stopped = `${trial.task} trial ${String(trial.trial)}: ${why}`;
                log(
                    `scored:rejudge: stopped after ${trial.task} trial ${String(trial.trial)}, whose judge's harness did not hold: ${why}; no record is written, since a record judged partly with one prompt and partly with another is never made`,
                );
                break;
            }
        }
    } finally {
        if (options.keep) {
            log(`scored:rejudge: the judge sessions are kept in ${runDir}`);
        } else {
            rmSync(runDir, { recursive: true, force: true });
        }
    }
    if (stopped !== null) {
        return { file: null, record: null, stopped, sessions };
    }
    const summary = summarize(trials, measuredRequests(list));
    const tool = toolInfo(root);
    const named = env['SCORED_RECORD'];
    const judgedNow = trials.filter(
        (t, i) => t.judge.state !== 'not-judged' && results.trials[i]?.judge.state === 'not-judged',
    );
    const record: AuthoringRecord = {
        ...source,
        command: `SCORED_FROM=${inRepository(root, fromFile, '<record file>')} SCORED_KEPT=<kept folders> SCORED_JUDGE_MODEL=${options.judgeModel} SCORED_SESSION_LIMIT=${String(options.judgeSessionLimit)}${named === undefined || named === '' ? '' : ` SCORED_RECORD=${inRepository(root, recordFile, '<record file>')}`}${options.claude.command !== 'claude' || options.claude.args.length > 0 ? ' SCORED_CLAUDE=<another Claude Code>' : ''} CK3_GAME_PATH=<game dir> task scored:rejudge`,
        notes: [
            ...source.notes,
            `Re-judged on ${now().slice(0, 10)} by task scored:rejudge at commit ${tool.commit}${tool.dirty ? ' (with uncommitted changes)' : ''}, starting no authoring session: the trials' sessions, results and grades are those of ${inRepository(root, fromFile, '<record file>')} (its tool, time and notes above), each result read from its run's kept trial folder and graded again over the same game and spec package with the record's validity and expectations to the letter; only the judge was run again (${String(sessions)} judge test sessions of Claude Code ${harness}), with version ${String(version?.version ?? 'unknown')} of the judge's prompt (${JUDGE_PROMPT_FILE}, sha256 ${promptSha}): ${version?.given ?? 'a version this checkout does not know'}.${judgedNow.length === 0 ? '' : ` Judged now and not by its run, by the run's rule of today (a trial whose authoring session was set up as asked and ended by itself is judged, also when it did not hold for what it did): ${judgedNow.map((t) => `${t.task} trial ${String(t.trial)}`).join(', ')}.`}`,
        ],
        results: {
            ...results,
            task: {
                ...results.task,
                judge_prompt_file: JUDGE_PROMPT_FILE,
                judge_prompt_sha256: promptSha,
                judge_schema_file: JUDGE_SCHEMA_FILE,
                judge_schema_sha256: sha256OfFile(path.join(root, JUDGE_SCHEMA_FILE)),
            },
            judge_model: options.judgeModel,
            judge_session_limit: options.judgeSessionLimit,
            judge_timeout_minutes: options.judgeTimeoutMinutes,
            judge_arguments: judgeArgs({
                model: options.judgeModel,
                sessionLimit: options.judgeSessionLimit,
            }),
            trials,
            tasks: summary.tasks,
            overall: summary.overall,
        },
    };
    writeJson(recordFile, record);
    log(
        `scored:rejudge: ${String(sessions)} judge test sessions; record written to ${relativePosix(root, recordFile)}`,
    );
    return { file: recordFile, record, stopped: null, sessions };
}
