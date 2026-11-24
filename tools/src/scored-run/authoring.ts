/**
 * The scored authoring test (docs/PLAN.md items 9.5 and 9.8; docs/MVP.md, "AI tests"), behind
 * `task scored:authoring`, built on the agent-use script (`run.ts`, item 6.8). It is a
 * developer's test script: not shipped, not part of the extension, and never run by CI.
 * pychivalry itself holds no key or token and makes no model call. The script starts the
 * Claude Code program already installed on the developer's machine, as separate test sessions,
 * each counting against the developer's own Claude plan like any session they open, so a run is
 * started by a person, or by an agent on the owner's word.
 *
 * For each content request of `fixtures/requests/requests.json` (`requests.ts`), and for each of
 * its trials:
 *
 * 1. its base mod is copied into a fresh temporary folder, and the skills folder's skills beside
 *    it, in `.claude/skills/`, where Claude Code finds a project's skills;
 * 2. one authoring test session starts there in Claude Code's command-line mode, with the
 *    request in the committed prompt (`tools/scored-run/authoring.prompt.md`), the agent server
 *    over the base game, the skills, and file read, edit and write (`authoringArgs`), with the
 *    session limit and a time limit as safety stops;
 * 3. grade one, validity: pychivalry's own checker on what the session left, over the same base
 *    game: its errors, its warnings and whether the result is in pychivalry's format, each a
 *    measure of its own (`validityOf`);
 * 4. grade two, the match to the request: its expectations checked in code
 *    (`expectations.ts`), then one judge test session, started the same way with no tool, no
 *    server and no skill, which reads the request and the result and answers each judged
 *    dimension from a closed set that includes "cannot tell" (`judge.ts`);
 * 5. the record, `records/scored/authoring.json`, is written again after every trial
 *    (`authoring-record.ts`).
 *
 * A trial whose authoring or judge session had a harness problem (it broke, or was offered
 * more than the run allows) stops the run there: the trials after it would say as little, and
 * each would still count against the developer's plan. Its record is kept; `SCORED_CONTINUE`
 * carries on from it.
 *
 * The parameters, from the environment, beside those of the agent-use run (`scoredOptions`:
 * `SCORED_SESSION_LIMIT`, `SCORED_MODEL`, `SCORED_TRIALS`, `SCORED_SERVER`, `SCORED_SERVER_ARGS`,
 * `SCORED_CLAUDE`, `SCORED_TIMEOUT_MINUTES`, `SCORED_KEEP`, `SCORED_CONTINUE`):
 *
 * | Variable | Meaning | Default |
 * | --- | --- | --- |
 * | `CK3_GAME_PATH` | The base game every session, the checker and the expectations read | none: it must be given |
 * | `SCORED_REQUESTS` | The requests to run, by id, comma-separated | every request |
 * | `SCORED_SKILLS` | The skills folder, from the repository root: each folder in it holding a `SKILL.md` is a skill | `skills` |
 * | `SCORED_JUDGE_MODEL` | The judge's model, by its full name | the authoring model |
 * | `SCORED_JUDGE_SESSION_LIMIT` | The session limit of each judge session | `SCORED_SESSION_LIMIT` |
 * | `SCORED_JUDGE_TIMEOUT_MINUTES` | The time limit of each judge session | 10 |
 *
 * `SCORED_TRIALS` is the number of trials per request. With `SCORED_CONTINUE=true` the run adds
 * to the record already written, made the same way, and brings each request named up to that
 * many trials whose harness held.
 */

import { spawnSync } from 'node:child_process';
import {
    closeSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import {
    checkWorkspace,
    defaultCacheDir,
    openSpec,
    openWorkspace,
    type Spec,
    type WorkspaceFinding,
} from '@pychivalry/core';
import { gameInfo, requireGameDir } from '../game.js';
import { committedSpec, machineInfo, now, toolInfo } from '../record.js';
import { CommandError, EXIT, relativePosix, sha256, sha256OfFile, writeJson } from '../util.js';
import {
    AUTHORING_SUITE,
    summarize,
    type AuthoringRecord,
    type AuthoringResults,
    type AuthoringTrial,
    type MeasuredRequest,
    type Validity,
} from './authoring-record.js';
import { callsOutside, sessionProblems, type Confinement } from './confinement.js';
import { checkExpectations } from './expectations.js';
import { filesIn } from './graders.js';
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
    type JudgeRecord,
} from './judge.js';
import {
    baseDir,
    committedRequests,
    reliedOnProblems,
    REQUESTS_FILE,
    type ContentRequest,
    type RequestList,
} from './requests.js';
import {
    fullModelName,
    harnessVersion,
    mcpConfig,
    positive,
    recordToContinue,
    sanitize,
    scoredOptions,
    SERVER_NAME,
    SERVER_TOOLS,
    SESSION_LIMIT_OPTION,
    sessionRecord,
    stoppedBy,
    trialEnv,
    type ScoredOptions,
} from './run.js';
import { readStream } from './stream.js';

export const AUTHORING_TASK = 'authoring' as const;
/** The authoring session's prompt, from the repository root: `{{request}}` is the request. */
export const AUTHORING_PROMPT_FILE = 'tools/scored-run/authoring.prompt.md';
/** The record a run writes, from the repository root. */
export const AUTHORING_RECORD_FILE = 'records/scored/authoring.json';
/**
 * The built-in tools an authoring session is offered: reading, editing and writing files (it
 * writes new files, which the agent-use task forbids), and `Skill`, the tool by which a session
 * loads a skill.
 */
export const AUTHORING_TOOLS: readonly string[] = ['Read', 'Edit', 'Write', 'Skill'];
/** The built-in tools that name files, which must stay inside the trial's mod. */
export const FILE_TOOLS: readonly string[] = ['Read', 'Edit', 'Write'];
export const DEFAULT_SKILLS = 'skills';
export const DEFAULT_JUDGE_TIMEOUT_MINUTES = 10;
/** Where Claude Code finds a project's skills, inside the folder a session starts in. */
export const PROJECT_SKILLS = '.claude/skills';

export interface AuthoringOptions extends ScoredOptions {
    readonly judgeModel: string;
    readonly judgeSessionLimit: number;
    readonly judgeTimeoutMinutes: number;
    /** The requests to run, by id; null for every request. */
    readonly requests: readonly string[] | null;
    /** The base game's `game` folder. */
    readonly gameDir: string;
    /** The skills folder, absolute. */
    readonly skillsDir: string;
}

/** The run's parameters, from the environment (the table above). */
export function authoringOptions(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
): AuthoringOptions {
    const base = scoredOptions(root, env);
    const named = env['SCORED_REQUESTS'];
    const requests =
        named === undefined || named.trim() === ''
            ? null
            : named
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s !== '');
    const judgeLimit = env['SCORED_JUDGE_SESSION_LIMIT'];
    return {
        ...base,
        judgeModel: fullModelName('SCORED_JUDGE_MODEL', env['SCORED_JUDGE_MODEL'] ?? base.model),
        judgeSessionLimit:
            judgeLimit === undefined || judgeLimit === ''
                ? base.sessionLimit
                : positive('SCORED_JUDGE_SESSION_LIMIT', judgeLimit, false),
        judgeTimeoutMinutes: positive(
            'SCORED_JUDGE_TIMEOUT_MINUTES',
            env['SCORED_JUDGE_TIMEOUT_MINUTES'] ?? String(DEFAULT_JUDGE_TIMEOUT_MINUTES),
            false,
        ),
        requests,
        gameDir: requireGameDir(env['CK3_GAME_PATH']),
        skillsDir: path.resolve(root, env['SCORED_SKILLS'] ?? DEFAULT_SKILLS),
    };
}

/** The SHA-256 of a folder: of its files' paths and hashes, one line each, in path order. */
export function folderSha256(dir: string): string {
    return sha256(
        filesIn(dir)
            .map((f) => `${f}\t${sha256OfFile(path.join(dir, ...f.split('/')))}\n`)
            .join(''),
    );
}

/** A skill of the skills folder. */
export interface Skill {
    /** Its name, as its `SKILL.md` gives it (the `name:` of its front matter), else its folder's. */
    readonly name: string;
    readonly folder: string;
    readonly sha256: string;
}

/** The skills of a skills folder: each folder in it holding a `SKILL.md`, by folder name. */
export function skillsIn(dir: string): Skill[] {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
        return [];
    }
    return readdirSync(dir)
        .sort()
        .filter((folder) => existsSync(path.join(dir, folder, 'SKILL.md')))
        .map((folder) => {
            const text = readFileSync(path.join(dir, folder, 'SKILL.md'), 'utf8').replace(
                /^\uFEFF/,
                '',
            );
            const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
            const name = /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(front)?.[1] ?? folder;
            return { name, folder, sha256: folderSha256(path.join(dir, folder)) };
        });
}

/**
 * Claude Code's arguments for one authoring session: those of an agent-use trial (`claudeArgs`
 * in run.ts, each with its reason there), with two changes. The built-in tools are
 * `AUTHORING_TOOLS`, since an authoring session writes new files and loads skills. And
 * `--disable-slash-commands` is left out: it switches every skill off, the pychivalry skills
 * with Claude Code's own, and a session can be given one set without the other only this way.
 */
export function authoringArgs(
    options: Pick<AuthoringOptions, 'model' | 'sessionLimit'>,
    prompt: string,
    mcpConfigFile: string,
): string[] {
    return [
        '-p',
        prompt,
        '--strict-mcp-config',
        '--mcp-config',
        mcpConfigFile,
        '--tools',
        AUTHORING_TOOLS.join(','),
        '--allowedTools',
        [`mcp__${SERVER_NAME}__*`, ...AUTHORING_TOOLS].join(','),
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
    ];
}

/** What an authoring session may be offered: its tools, the one server, the pychivalry skills. */
export function authoringConfinement(skills: readonly Skill[]): Confinement {
    return {
        builtIn: AUTHORING_TOOLS,
        server: { name: SERVER_NAME, tools: SERVER_TOOLS },
        skills: { required: skills.map((s) => s.name), othersAllowed: true },
    };
}

/** Grade one, from the checker's findings on the result. */
export function validityOf(
    findings: readonly Pick<WorkspaceFinding, 'code' | 'severity'>[],
): Validity {
    const count = (severity: string): number =>
        findings.filter((f) => f.severity === severity).length;
    const codes = new Map<string, { code: string; severity: 'error' | 'warning'; count: number }>();
    for (const f of findings) {
        if (f.severity !== 'error' && f.severity !== 'warning') {
            continue;
        }
        const key = `${f.severity}\u0000${f.code}`;
        const row = codes.get(key) ?? { code: f.code, severity: f.severity, count: 0 };
        row.count++;
        codes.set(key, row);
    }
    const byCode = [...codes.values()].sort(
        (a, b) =>
            (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
            b.count - a.count ||
            (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    );
    const errors = count('error');
    const warnings = count('warning');
    return {
        errors,
        warnings,
        information: count('information'),
        hints: count('hint'),
        zero_errors: errors === 0,
        no_warnings: warnings === 0,
        in_format: !byCode.some((c) => c.severity === 'warning' && c.code.startsWith('style/')),
        by_code: byCode,
    };
}

/** The authoring prompt of a request. */
export function authoringPrompt(template: string, request: ContentRequest): string {
    const parts = template.split('{{request}}');
    if (parts.length !== 2) {
        throw new CommandError(
            `${AUTHORING_PROMPT_FILE} must hold {{request}} exactly once`,
            EXIT.usage,
        );
    }
    return parts.join(request.request).trim();
}

/** The requests a run names, in the list's order; an id the list lacks is a usage error. */
export function selectRequests(list: RequestList, ids: readonly string[] | null): ContentRequest[] {
    if (ids === null) {
        return [...list.requests];
    }
    const unknown = ids.filter((id) => !list.requests.some((r) => r.id === id));
    if (unknown.length > 0) {
        throw new CommandError(
            `SCORED_REQUESTS names no request of ${REQUESTS_FILE}: ${unknown.join(', ')} (the ids: ${list.requests.map((r) => r.id).join(', ')})`,
            EXIT.usage,
        );
    }
    return list.requests.filter((r) => ids.includes(r.id));
}

/** The requests as the measures need them. */
export function measuredRequests(list: RequestList): MeasuredRequest[] {
    return list.requests.map((r) => ({
        id: r.id,
        content_type: r.content_type,
        difficulty: r.difficulty,
        dimensions: r.judged.map((q) => q.dimension),
    }));
}

function commandOf(root: string, options: AuthoringOptions): string {
    const parts = [
        `SCORED_MODEL=${options.model}`,
        `SCORED_TRIALS=${String(options.trials)}`,
        `SCORED_SESSION_LIMIT=${String(options.sessionLimit)}`,
    ];
    if (options.judgeModel !== options.model) {
        parts.push(`SCORED_JUDGE_MODEL=${options.judgeModel}`);
    }
    if (options.judgeSessionLimit !== options.sessionLimit) {
        parts.push(`SCORED_JUDGE_SESSION_LIMIT=${String(options.judgeSessionLimit)}`);
    }
    if (options.requests !== null) {
        parts.push(`SCORED_REQUESTS=${options.requests.join(',')}`);
    }
    const skills = relativePosix(root, options.skillsDir);
    if (skills !== DEFAULT_SKILLS) {
        parts.push(`SCORED_SKILLS=${skills.startsWith('..') ? '<skills folder>' : skills}`);
    }
    if (options.claude.command !== 'claude' || options.claude.args.length > 0) {
        parts.push('SCORED_CLAUDE=<another Claude Code>');
    }
    if (options.continue) {
        parts.push('SCORED_CONTINUE=true');
    }
    parts.push('CK3_GAME_PATH=<game dir>');
    return `${parts.join(' ')} task scored:authoring`;
}

/** Run the scored authoring test and write its record after every trial. */
export function runAuthoring(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
    log: (line: string) => void,
    /** Where to write the record: `AUTHORING_RECORD_FILE` by default; a test writes it elsewhere. */
    recordFile: string = path.join(root, ...AUTHORING_RECORD_FILE.split('/')),
): { readonly file: string; readonly record: AuthoringRecord } {
    const options = authoringOptions(root, env);
    if (!existsSync(options.server)) {
        throw new CommandError(
            `the agent server is not built: ${relativePosix(root, options.server)} does not exist (task build; SCORED_SERVER names another entry point)`,
            EXIT.usage,
        );
    }
    const skills = skillsIn(options.skillsDir);
    if (skills.length === 0) {
        throw new CommandError(
            `no skill in ${relativePosix(root, options.skillsDir)}: the authoring test gives each session the skills folder (docs/PLAN.md item 9.1), each skill a folder holding a SKILL.md; SCORED_SKILLS names another`,
            EXIT.usage,
        );
    }
    const spec: Spec = openSpec(path.join(root, 'spec'));
    const list = committedRequests(root);
    const relied = reliedOnProblems(spec, root, list);
    if (relied.length > 0) {
        throw new CommandError(
            `a request relies on a name the game or its base does not have:\n  ${relied.join('\n  ')}`,
            EXIT.usage,
        );
    }
    const selected = selectRequests(list, options.requests);
    const promptTemplate = readFileSync(path.join(root, AUTHORING_PROMPT_FILE), 'utf8');
    const judgeTemplate = readFileSync(path.join(root, JUDGE_PROMPT_FILE), 'utf8');
    const validate = compileJudgeSchema(path.join(root, JUDGE_SCHEMA_FILE));
    const version = harnessVersion(options.claude);
    const bases = [...new Set(list.requests.map((r) => r.base))].sort();
    const fixed = {
        tool: toolInfo(root),
        spec: committedSpec(root),
        game: gameInfo(options.gameDir),
        task: {
            name: AUTHORING_TASK,
            requests_file: REQUESTS_FILE,
            requests_sha256: sha256OfFile(path.join(root, REQUESTS_FILE)),
            prompt_file: AUTHORING_PROMPT_FILE,
            prompt_sha256: sha256OfFile(path.join(root, AUTHORING_PROMPT_FILE)),
            judge_prompt_file: JUDGE_PROMPT_FILE,
            judge_prompt_sha256: sha256OfFile(path.join(root, JUDGE_PROMPT_FILE)),
            judge_schema_file: JUDGE_SCHEMA_FILE,
            judge_schema_sha256: sha256OfFile(path.join(root, JUDGE_SCHEMA_FILE)),
            bases: bases.map((name) => ({ name, sha256: folderSha256(baseDir(root, name)) })),
            skills: skills.map((s) => ({ name: s.name, sha256: s.sha256 })),
            dimensions: list.dimensions.map((d) => d.id),
            answers: [...JUDGE_ANSWERS],
        },
        harness: { name: 'claude-code' as const, version },
        model: options.model,
        judge_model: options.judgeModel,
        session_limit: options.sessionLimit,
        judge_session_limit: options.judgeSessionLimit,
        timeout_minutes: options.timeoutMinutes,
        judge_timeout_minutes: options.judgeTimeoutMinutes,
        arguments: authoringArgs(
            options,
            `<${AUTHORING_PROMPT_FILE} with the request>`,
            '<agent-server configuration>',
        ),
        judge_arguments: judgeArgs({
            model: options.judgeModel,
            sessionLimit: options.judgeSessionLimit,
        }),
        server: {
            entry: relativePosix(root, options.server).startsWith('..')
                ? '<agent server>'
                : relativePosix(root, options.server),
            arguments: options.serverArgs.map((a) =>
                a.replaceAll('{mod}', '<trial mod>').replaceAll('{game}', '<game dir>'),
            ),
        },
    };
    const { tool, spec: specRef, game, ...stated } = fixed;
    const previous = options.continue
        ? (recordToContinue(
              recordFile,
              AUTHORING_SUITE,
              { tool, spec: specRef, game },
              stated,
          ) as unknown as AuthoringRecord)
        : null;
    const trials: AuthoringTrial[] = [...(previous?.results.trials ?? [])];
    const plan = selected.map((request) => {
        const mine = trials.filter((t) => t.task === request.id);
        const held = mine.filter((t) => t.harness_held).length;
        return {
            request,
            first: mine.length + 1,
            count: options.continue ? Math.max(0, options.trials - held) : options.trials,
        };
    });
    const sessions = plan.reduce((n, p) => n + p.count, 0);
    log(
        `scored:authoring: Claude Code ${version}, model ${options.model}, judge ${options.judgeModel}; ${String(selected.length)} requests, ${String(sessions)} trials${previous === null ? '' : ` added to the ${String(trials.length)} of the record`}: up to ${String(sessions)} authoring test sessions with session limit ${String(options.sessionLimit)} and time limit ${String(options.timeoutMinutes)} minutes, and one judge test session after each, with session limit ${String(options.judgeSessionLimit)} and time limit ${String(options.judgeTimeoutMinutes)} minutes`,
    );

    const madeAt = now();
    const measured = measuredRequests(list);
    const write = (): AuthoringRecord => {
        const summary = summarize(trials, measured);
        const results: AuthoringResults = {
            ...stated,
            trials,
            tasks: summary.tasks,
            overall: summary.overall,
        };
        const continued = previous !== null && trials.length > previous.results.trials.length;
        const record: AuthoringRecord = {
            record_format: 1,
            suite: AUTHORING_SUITE,
            command: commandOf(root, options),
            made_at: madeAt,
            tool,
            machine: machineInfo(),
            game,
            spec: specRef,
            corpus: null,
            notes:
                previous === null
                    ? [
                          `Every authoring session, the agent server, the checker and the expectations read the base game at <game dir>, build ${game.build}.`,
                          'Each trial is one authoring test session of the Claude Code installed on the machine the run was made on, given the request in a fresh copy of its base mod with the agent server and the skills, then one judge test session given the request and what the first left; the script gave neither session credentials, and pychivalry itself makes no model call.',
                          "Grade one is pychivalry's checker on the result: errors, warnings and whether it is in pychivalry's format, each a measure of its own. Grade two is the request's expectations, checked in code, and the judge's answer on each judged dimension. A trial whose harness did not hold is listed and not counted. No target is set yet: the owner sets the targets from the first run.",
                      ]
                    : [
                          ...previous.notes,
                          ...(continued
                              ? [
                                    `Trials were added on ${madeAt.slice(0, 10)} by a run continuing the record (SCORED_CONTINUE=true), made the same way as the record's first (made ${previous.made_at.slice(0, 10)}).`,
                                ]
                              : []),
                      ],
            results,
        };
        writeJson(recordFile, record);
        return record;
    };

    const runDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'pychivalry-authoring-')));
    const cacheDir = path.join(runDir, 'cache');
    mkdirSync(cacheDir);
    // The base game's index, built once into the cache every trial's agent server reads, so that
    // no session waits for it; the grader loads it from there too.
    const indexCache = defaultCacheDir({ XDG_CACHE_HOME: cacheDir, LOCALAPPDATA: cacheDir });
    openWorkspace({ spec, gameDir: options.gameDir, cacheDir: indexCache, modDir: null });
    let stopped = false;
    try {
        for (const { request, first, count } of plan) {
            for (let n = first; n < first + count && !stopped; n++) {
                const trial = runTrial({
                    root,
                    options,
                    spec,
                    skills,
                    request,
                    n,
                    runDir,
                    cacheDir,
                    indexCache,
                    promptTemplate,
                    judgeTemplate,
                    validate,
                    env,
                    log,
                });
                trials.push(trial);
                write();
                if (!trial.harness_held) {
                    stopped = true;
                    log(
                        `scored:authoring: stopped after ${request.id} trial ${String(n)}, whose harness did not hold: the trials after it would say as little (SCORED_CONTINUE=true carries on once it is fixed)`,
                    );
                }
            }
        }
    } finally {
        if (options.keep) {
            log(`scored:authoring: the trials are kept in ${runDir}`);
        } else {
            rmSync(runDir, { recursive: true, force: true });
        }
    }
    const record = write();
    const overall = record.results.overall;
    log(
        `scored:authoring: ${String(overall.harness_held)} of ${String(overall.trials)} trials held; of those, ${String(overall.zero_errors)} without an error, ${String(overall.no_warnings)} without a warning, ${String(overall.in_format)} in the format, ${String(overall.expectations_met)} meeting every expectation; record written to ${relativePosix(root, recordFile)}`,
    );
    return { file: recordFile, record };
}

interface TrialContext {
    readonly root: string;
    readonly options: AuthoringOptions;
    readonly spec: Spec;
    readonly skills: readonly Skill[];
    readonly request: ContentRequest;
    readonly n: number;
    readonly runDir: string;
    readonly cacheDir: string;
    readonly indexCache: string;
    readonly promptTemplate: string;
    readonly judgeTemplate: string;
    readonly validate: ReturnType<typeof compileJudgeSchema>;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly log: (line: string) => void;
}

/** One trial: the authoring session, its two grades, and the judge's session. */
function runTrial(ctx: TrialContext): AuthoringTrial {
    const { options, request, n } = ctx;
    const trialDir = path.join(ctx.runDir, `${request.id}-${String(n)}`);
    const modDir = path.join(trialDir, 'mod');
    const givenDir = baseDir(ctx.root, request.base);
    cpSync(givenDir, modDir, { recursive: true });
    const skillsDir = path.join(modDir, ...PROJECT_SKILLS.split('/'));
    for (const skill of ctx.skills) {
        cpSync(path.join(options.skillsDir, skill.folder), path.join(skillsDir, skill.folder), {
            recursive: true,
        });
    }
    const configFile = path.join(trialDir, 'mcp.json');
    writeFileSync(
        configFile,
        `${JSON.stringify(mcpConfig(options, modDir, options.gameDir, ctx.cacheDir), null, 4)}\n`,
    );
    const streamFile = path.join(trialDir, 'stream.jsonl');
    const out = openSync(streamFile, 'w');
    const err = openSync(path.join(trialDir, 'stderr.txt'), 'w');
    let spawned;
    try {
        spawned = spawnSync(
            options.claude.command,
            [
                ...options.claude.args,
                ...authoringArgs(options, authoringPrompt(ctx.promptTemplate, request), configFile),
            ],
            {
                cwd: modDir,
                stdio: ['ignore', out, err],
                env: trialEnv(ctx.env),
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
            `Claude Code could not be started: ${spawned.error.message}`,
            EXIT.usage,
        );
    }
    const summary = readStream(readFileSync(streamFile, 'utf8'));
    const folders = [
        { path: modDir, name: '<trial mod>' },
        { path: ctx.runDir, name: '<run dir>' },
        { path: options.gameDir, name: '<game dir>' },
        { path: ctx.root, name: '<repository>' },
        { path: homedir(), name: '<home>' },
    ];
    const stopped = stoppedBy(summary, timedOut);
    const problems = sessionProblems(
        summary,
        stopped,
        spawned.status,
        options.timeoutMinutes,
        authoringConfinement(ctx.skills),
    );
    const outside = callsOutside(summary, modDir, FILE_TOOLS);
    if (outside.length > 0) {
        const tools = [...new Set(outside.map((c) => c.tool))].join(', ');
        problems.push(
            `the session named files outside its mod (${String(outside.length)} calls of ${tools})`,
        );
        for (const call of outside) {
            ctx.log(
                `${request.id} trial ${String(n)}: ${call.tool} of ${sanitize(call.file, folders)}`,
            );
        }
    }
    const skillsNow = ctx.skills.filter(
        (s) => folderSha256(path.join(skillsDir, s.folder)) !== s.sha256,
    );
    if (skillsNow.length > 0) {
        problems.push(`the session changed the skills: ${skillsNow.map((s) => s.name).join(', ')}`);
    }
    const errorText = summary.result?.errorText ?? null;
    if (stopped === 'error' && errorText !== null) {
        // The session's own words on its error, for the person running it; never recorded.
        ctx.log(
            `${request.id} trial ${String(n)}: the session's error: ${sanitize(errorText, folders)}`,
        );
    }

    // Grade one, and the expectations of grade two, on what the session left.
    const check = checkWorkspace({
        spec: ctx.spec,
        gameDir: options.gameDir,
        cacheDir: ctx.indexCache,
        modDir,
    });
    const validity = validityOf(check.findings);
    const expectations = checkExpectations(
        { index: check.index, modDir, givenDir },
        request.expect,
    ).map((e) => ({ ...e, problem: e.problem === null ? null : sanitize(e.problem, folders) }));

    // The judge, when the authoring session's harness held.
    const judge = judgeTrial(ctx, trialDir, modDir, givenDir, problems.length === 0, folders);
    const harnessHeld = problems.length === 0 && judge.harness_problems.length === 0;
    const trial: AuthoringTrial = {
        task: request.id,
        content_type: request.content_type,
        difficulty: request.difficulty,
        trial: n,
        harness_held: harnessHeld,
        stopped,
        harness_problems: problems.map((p) => sanitize(p, folders)),
        ...sessionRecord(summary),
        tool_errors: summary.toolErrors.map((e) => ({
            tool: e.name,
            message: sanitize(e.message, folders),
        })),
        exit_code: spawned.status,
        validity,
        expectations,
        expectations_met: expectations.every((e) => e.met),
        judge,
    };
    const answers = judge.answers.map((a) => `${a.dimension} ${a.answer}`).join(', ');
    ctx.log(
        `${request.id} trial ${String(n)}: ${harnessHeld ? 'held' : 'harness problem'} (${stopped}; ${String(summary.toolCalls.length)} tool calls); ${String(validity.errors)} errors, ${String(validity.warnings)} warnings${validity.in_format ? '' : ', not in the format'}; ${String(expectations.filter((e) => e.met).length)} of ${String(expectations.length)} expectations met; judge ${judge.state}${answers === '' ? '' : `: ${answers}`}${trial.harness_problems.length > 0 || judge.harness_problems.length > 0 ? `; harness: ${[...trial.harness_problems, ...judge.harness_problems].join('; ')}` : ''}`,
    );
    return trial;
}

/** The judge's part of a trial: its session on the result, or why there was none. */
function judgeTrial(
    ctx: TrialContext,
    trialDir: string,
    modDir: string,
    givenDir: string,
    authoringHeld: boolean,
    folders: readonly { path: string; name: string }[],
): JudgeRecord {
    if (!authoringHeld) {
        return notJudged("the authoring session's harness did not hold");
    }
    const files = resultFiles(modDir, givenDir);
    const material = resultText(files);
    if (material.length > MATERIAL_LIMIT) {
        return notJudged(
            `the result is ${String(material.length)} characters, over the ${String(MATERIAL_LIMIT)} a judge is given`,
        );
    }
    const run = runJudge({
        claude: ctx.options.claude,
        model: ctx.options.judgeModel,
        sessionLimit: ctx.options.judgeSessionLimit,
        timeoutMinutes: ctx.options.judgeTimeoutMinutes,
        env: ctx.env,
        dir: trialDir,
        prompt: judgePrompt(ctx.judgeTemplate, ctx.request, files),
        request: ctx.request,
        validate: ctx.validate,
    });
    if (run.verdict?.state === 'answered') {
        for (const a of run.verdict.answers) {
            // The judge's reasons, for the person running the test; never recorded.
            ctx.log(
                `${ctx.request.id} trial ${String(ctx.n)}: judge on ${a.dimension}: ${a.answer}: ${sanitize(a.reason, folders)}`,
            );
        }
    }
    return judgeRecord(run, (text) => sanitize(text, folders));
}
