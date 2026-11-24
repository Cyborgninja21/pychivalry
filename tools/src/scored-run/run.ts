/**
 * The scored agent-use test (docs/PLAN.md items 6.8 and 6.10; docs/MVP.md, "AI tests"), behind
 * `task scored:agent-use`. It is a developer's test script: not shipped, not part of the
 * extension, and never run by CI. pychivalry itself holds no key, token or login and makes no
 * model call. This script starts the Claude Code program already installed on the developer's
 * machine, signed in however the developer signed it in, once per trial as a separate test
 * session with pychivalry's agent server attached, and grades in code what that session did to
 * a copy of the planted-defect mod. It gives Claude Code no credentials and removes key and
 * token variables from the session's environment (`trialEnv`). Each test session counts
 * against the developer's own Claude plan like any session they open themselves, so a run is
 * started by a person, or by an agent on the owner's word.
 *
 * For each trial it copies `fixtures/defects/mod/` into a fresh temporary folder (a copy of the
 * files, with no git history), writes an agent-server configuration naming only the built agent
 * server (`packages/mcp`, started over the manifest's game stub), and starts the test session
 * in Claude Code's command-line mode in that folder, with the committed task prompt
 * (`tools/scored-run/agent-use.prompt.md`). The session is confined to that server plus file
 * read and edit (`claudeArgs`). It reads the session's output stream for the tool calls and
 * tool errors (`stream.ts`), grades the folder as the session left it (`graders.ts`), and
 * writes the record, `records/scored/agent-use.json` (`scored-record.ts`).
 *
 * Each test session has two safety stops. The session limit, `SCORED_SESSION_LIMIT`, is passed
 * unchanged to Claude Code's own option `--max-budget-usd`, which ends a session early; the
 * script uses it only as that per-session stop and keeps no account of its own. A session still
 * running after the time limit is stopped.
 *
 * The parameters, from the environment:
 *
 * | Variable | Meaning | Default |
 * | --- | --- | --- |
 * | `SCORED_SESSION_LIMIT` | The session limit of each test session, a positive number passed to Claude Code (above) | none: it must be given |
 * | `SCORED_MODEL` | The model, by its full name | `PINNED_MODEL` |
 * | `SCORED_TRIALS` | Trials (test sessions) per task: 5 in development, 10 (`RELEASE_TRIALS`) before a release, where every one must pass (the target, `targetOf`) | 5 |
 * | `SCORED_SERVER` | The agent server's entry point, from the repository root | `packages/mcp/dist/main.js` |
 * | `SCORED_SERVER_ARGS` | Its arguments, a JSON list; `{mod}` and `{game}` stand for the trial's mod and the game stub | `["--mod", "{mod}", "--vanilla", "{game}"]`, as `packages/mcp` reads them |
 * | `SCORED_CLAUDE` | Claude Code's command; a `.js` or `.mjs` file is run with Node | `claude` |
 * | `SCORED_TIMEOUT_MINUTES` | The time limit of each test session | 30 |
 * | `SCORED_KEEP` | `true` keeps the run's temporary folder (each trial's mod, stream and configuration) and prints where | removed |
 * | `SCORED_CONTINUE` | `true` adds this run's trials to the record already written, numbered after its own, when that record was made at the same commit with the same task, Claude Code version, model, session limit, time limit, arguments and agent server (`continuedRecord`) | a new record |
 */

import { spawnSync } from 'node:child_process';
import {
    closeSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { openSpec, type Spec } from '@pychivalry/core';
import { gameInfo } from '../game.js';
import { committedSpec, machineInfo, now, toolInfo } from '../record.js';
import {
    CommandError,
    EXIT,
    isObject,
    readJson,
    relativePosix,
    sha256OfFile,
    writeJson,
} from '../util.js';
import { sessionProblems, type Confinement } from './confinement.js';
import { GRADERS, gradeMod, type GraderResult } from './graders.js';
import { committedManifest, DEFECTS_DIR, type DefectManifest } from './manifest.js';
import { readStream, type StreamSummary } from './stream.js';
import {
    passRate,
    SCORED_SUITE,
    targetOf,
    targetText,
    type ScoredRecord,
    type ScoredResults,
    type TrialRecord,
} from './scored-record.js';

/**
 * The model a run uses when none is given: a full model name, never an alias, so that a record
 * names the model it measured. The owner sets it; changing it is a change to this line and to
 * tools/scored-run/README.md.
 */
export const PINNED_MODEL = 'claude-opus-5-5';
export const DEFAULT_TRIALS = 5;
export const DEFAULT_SERVER = 'packages/mcp/dist/main.js';
export const DEFAULT_SERVER_ARGS: readonly string[] = ['--mod', '{mod}', '--vanilla', '{game}'];
export const DEFAULT_TIMEOUT_MINUTES = 30;
/** The task's prompt, from the repository root. */
export const PROMPT_FILE = 'tools/scored-run/agent-use.prompt.md';
/** The record a run writes, from the repository root. */
export const RECORD_FILE = 'records/scored/agent-use.json';
/** The agent server's name in the configuration, which prefixes its tools: `mcp__pychivalry__`. */
export const SERVER_NAME = 'pychivalry';
export const TASK = 'agent-use';
/**
 * The agent server's tools, as `packages/mcp` registers them; a session offers each as
 * `mcp__pychivalry__<name>`.
 */
export const SERVER_TOOLS: readonly string[] = [
    'apply_format',
    'check',
    'explain_code',
    'find_definition',
    'find_references',
    'format',
    'list_definitions',
    'lookup',
];
/** The built-in tools a trial may use. */
export const BUILT_IN_TOOLS: readonly string[] = ['Read', 'Edit'];

export interface ScoredOptions {
    readonly model: string;
    readonly trials: number;
    /** The session limit of each test session, passed to Claude Code (the header above). */
    readonly sessionLimit: number;
    /** The agent server's entry point, absolute. */
    readonly server: string;
    readonly serverArgs: readonly string[];
    /** Claude Code's command and the arguments before its own. */
    readonly claude: { readonly command: string; readonly args: readonly string[] };
    readonly timeoutMinutes: number;
    readonly keep: boolean;
    /** Add the trials to the record already written (`continuedRecord`). */
    readonly continue: boolean;
}

/** A parameter that must be a positive number (a whole one when `integer`), or a usage error. */
export function positive(name: string, value: string, integer: boolean): number {
    const n = Number(value);
    if (!/^[0-9]+(\.[0-9]+)?$/.test(value) || !(n > 0) || (integer && !Number.isInteger(n))) {
        throw new CommandError(
            `${name} must be a positive ${integer ? 'whole number' : 'number'}, not ${JSON.stringify(value)}`,
            EXIT.usage,
        );
    }
    return n;
}

/**
 * A file's path from the repository root, written with `/`, as a record may name it; `named`
 * (such as `<agent server>`) when the file is outside the repository: above it, or on another
 * drive, where the path between them is absolute.
 */
export function inRepository(root: string, file: string, named: string): string {
    const rel = path.relative(root, file);
    return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)
        ? named
        : rel.split(path.sep).join('/');
}

/** A model's full name, never an alias, so that a record names the model it measured. */
export function fullModelName(variable: string, model: string): string {
    if (!/^claude-[a-z0-9]+(-[a-z0-9]+)*$/.test(model)) {
        throw new CommandError(
            `${variable} must be a model's full name such as ${PINNED_MODEL}, not an alias: ${JSON.stringify(model)}`,
            EXIT.usage,
        );
    }
    return model;
}

/** The run's parameters, from the environment (the table above). */
export function scoredOptions(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
): ScoredOptions {
    const limit = env['SCORED_SESSION_LIMIT'];
    if (limit === undefined || limit === '') {
        throw new CommandError(
            'SCORED_SESSION_LIMIT must be given: the session limit of each test session, a positive number passed to Claude Code, which ends the session early when it is reached; there is no default (tools/scored-run/README.md)',
            EXIT.usage,
        );
    }
    const model = fullModelName('SCORED_MODEL', env['SCORED_MODEL'] ?? PINNED_MODEL);
    let serverArgs: readonly string[] = DEFAULT_SERVER_ARGS;
    const rawArgs = env['SCORED_SERVER_ARGS'];
    if (rawArgs !== undefined && rawArgs !== '') {
        let parsed: unknown;
        try {
            parsed = JSON.parse(rawArgs) as unknown;
        } catch {
            parsed = undefined;
        }
        if (!Array.isArray(parsed) || !parsed.every((a) => typeof a === 'string')) {
            throw new CommandError(
                'SCORED_SERVER_ARGS must be a JSON list of texts, such as ["--mod", "{mod}", "--vanilla", "{game}"]',
                EXIT.usage,
            );
        }
        serverArgs = parsed;
    }
    const claude = env['SCORED_CLAUDE'] ?? 'claude';
    return {
        model,
        trials: positive('SCORED_TRIALS', env['SCORED_TRIALS'] ?? String(DEFAULT_TRIALS), true),
        sessionLimit: positive('SCORED_SESSION_LIMIT', limit, false),
        server: path.resolve(root, env['SCORED_SERVER'] ?? DEFAULT_SERVER),
        serverArgs,
        claude: /\.m?js$/.test(claude)
            ? { command: process.execPath, args: [path.resolve(root, claude)] }
            : { command: claude, args: [] },
        timeoutMinutes: positive(
            'SCORED_TIMEOUT_MINUTES',
            env['SCORED_TIMEOUT_MINUTES'] ?? String(DEFAULT_TIMEOUT_MINUTES),
            false,
        ),
        keep: env['SCORED_KEEP'] === 'true',
        continue: env['SCORED_CONTINUE'] === 'true',
    };
}

/**
 * Claude Code's own option that ends a session early at the session limit, named here once for
 * every scored session (docs/decisions.md, decision 80): the agent-use and authoring trials and
 * the judge's sessions pass the session limit to it unchanged.
 */
export const SESSION_LIMIT_OPTION = '--max-budget-usd';

/**
 * Claude Code's arguments for one trial: the flags of docs/PLAN.md item 6.8, checked against
 * `claude --help` of Claude Code 2.1.220 and again of 2.1.330, which ran item 6.11's test
 * sessions (tools/scored-run/README.md says how each differs):
 *
 * - `-p` with the prompt first: command-line mode, which the plan's other flags need. Three of
 *   the flags take several values (`--mcp-config`, `--tools`, `--allowedTools`), so the prompt
 *   goes before them, as Claude Code's own examples write it.
 * - `--allowedTools` also allows `Read` and `Edit`: under `--permission-mode dontAsk` every
 *   call that would ask is refused, and an edit asks unless it is allowed.
 * - The session limit goes to Claude Code's own session-ending option (the header above), as a
 *   safety stop for each test session.
 * - `--setting-sources project,local` leaves out the user's own settings, instructions and
 *   skills, so that a trial measures the server, not the person's set-up (the plan's open
 *   question; the trial folder has no project settings).
 * - `--disable-slash-commands` leaves out the skills Claude Code brings with it: item 6.11's
 *   first test session listed 16 at its start, none of them the user's.
 */
export function claudeArgs(
    options: Pick<ScoredOptions, 'model' | 'sessionLimit'>,
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
        BUILT_IN_TOOLS.join(','),
        '--allowedTools',
        [`mcp__${SERVER_NAME}__*`, ...BUILT_IN_TOOLS].join(','),
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

/** The same arguments as a record states them: the prompt and the configuration file named. */
export function recordedArgs(options: Pick<ScoredOptions, 'model' | 'sessionLimit'>): string[] {
    return claudeArgs(options, `<${PROMPT_FILE}>`, '<agent-server configuration>');
}

/**
 * Whether a variable belongs to a surrounding Claude Code session (its session id, its
 * messaging socket, its effort, the mark that a session is running, the name it gives the
 * programs it starts, `AI_AGENT`) or sets how Claude Code connects agent servers (`MCP_*`, such
 * as the `MCP_CONNECTION_NONBLOCKING` a host sets for the session it starts, or the discovery
 * cache a person's settings turn on) rather than belonging to the person: a run started from
 * inside a session must not hand them to its trials, and a trial sets its own (`trialEnv`).
 */
export function sessionVariable(name: string): boolean {
    return (
        name === 'CLAUDECODE' ||
        name === 'CLAUDE_PID' ||
        name === 'CLAUDE_EFFORT' ||
        name === 'CLAUDE_AGENT_SDK_VERSION' ||
        name === 'AI_AGENT' ||
        name.startsWith('CLAUDE_CODE_') ||
        name.startsWith('MCP_')
    );
}

/**
 * Whether a variable's name says it may hold a key, a token or another credential: an API key,
 * an access or session token, a secret, a password, a credentials file, a sign-in. Such a
 * variable is never handed to a test session, whoever set it and whatever it is for.
 */
export function credentialVariable(name: string): boolean {
    return /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH/i.test(name);
}

/**
 * The environment of a trial's test session: this one without any variable that may hold a
 * credential (`credentialVariable`), so the script hands Claude Code no key or token and the
 * session runs as the developer's Claude Code is already signed in; without a surrounding
 * Claude Code session's variables (`sessionVariable`); with the other agent servers Claude Code
 * would offer from claude.ai and its automatic memory switched off, so that nothing but the
 * configured server is offered; and with `MCP_CONNECTION_NONBLOCKING=0`, so that Claude Code
 * waits for the agent server to connect before the session's first turn, whatever a
 * surrounding session or a later Claude Code's default would do.
 */
export function trialEnv(
    env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
        if (v !== undefined && !credentialVariable(k) && !sessionVariable(k)) {
            out[k] = v;
        }
    }
    out['ENABLE_CLAUDEAI_MCP_SERVERS'] = 'false';
    out['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] = '1';
    out['MCP_CONNECTION_NONBLOCKING'] = '0';
    return out;
}

/**
 * The agent-server configuration of a trial: the one server, run with this Node, over the trial's
 * mod and the game stub, its index cache in the run's own folder.
 */
export function mcpConfig(
    options: Pick<ScoredOptions, 'server' | 'serverArgs'>,
    modDir: string,
    gameDir: string,
    cacheDir: string,
): unknown {
    const args = options.serverArgs.map((a) =>
        a.replaceAll('{mod}', modDir).replaceAll('{game}', gameDir),
    );
    return {
        mcpServers: {
            [SERVER_NAME]: {
                type: 'stdio',
                command: process.execPath,
                args: [options.server, ...args],
                env: { XDG_CACHE_HOME: cacheDir, LOCALAPPDATA: cacheDir },
            },
        },
    };
}

/** Claude Code's version, from `<claude> --version`. */
export function harnessVersion(claude: ScoredOptions['claude']): string {
    const r = spawnSync(claude.command, [...claude.args, '--version'], {
        encoding: 'utf8',
        timeout: 60_000,
    });
    const match = /^\s*([0-9]+\.[0-9]+\.[0-9]+)/.exec(r.stdout);
    if (r.status !== 0 || match === null) {
        throw new CommandError(
            `Claude Code did not answer --version (${claude.command}); is it installed and on the PATH? SCORED_CLAUDE names another command`,
            EXIT.usage,
        );
    }
    return match[1] as string;
}

/** A text as a record may hold it: the run's folders and the home folder named, no other absolute path, at most 300 characters. */
export function sanitize(text: string, folders: readonly { path: string; name: string }[]): string {
    let out = text;
    for (const { path: p, name } of folders) {
        for (const form of new Set([p, p.split(path.sep).join('/'), p.split('/').join('\\')])) {
            if (form !== '') {
                out = out.split(form).join(name);
            }
        }
    }
    out = out
        .split(/(\s+)/)
        .map((token) =>
            /^["'`(]*(\/[^/\s]|~[\\/]|[A-Za-z]:[\\/]|\\\\)/.test(token) ? '<path>' : token,
        )
        .join('');
    return out.length > 300 ? `${out.slice(0, 297)}...` : out;
}

/**
 * The end Claude Code's stream gives a session that its own session-ending option stopped at
 * the session limit: Claude Code's name for it, read as `session-limit`.
 */
export const SESSION_LIMIT_SUBTYPE = 'error_max_budget_usd';

/**
 * What made a trial's session end, from its stream and its exit. A session ended by itself
 * only when its end is `success` and not an error: Claude Code also ends a session that never
 * reached the model with `success` and `is_error` (stream.ts).
 */
export function stoppedBy(summary: StreamSummary, timedOut: boolean): TrialRecord['stopped'] {
    if (timedOut) {
        return 'timeout';
    }
    const result = summary.result;
    if (result === null) {
        return 'no-result';
    }
    if (result.subtype === SESSION_LIMIT_SUBTYPE) {
        return 'session-limit';
    }
    if (result.subtype === 'error_max_turns') {
        return 'turns';
    }
    if (result.subtype === 'success' && !result.isError) {
        return 'finished';
    }
    return 'error';
}

/** What an agent-use trial's session may be offered: `Read`, `Edit`, the one server, no skill. */
export const AGENT_USE_CONFINEMENT: Confinement = {
    builtIn: BUILT_IN_TOOLS,
    server: { name: SERVER_NAME, tools: SERVER_TOOLS },
    skills: { required: [], othersAllowed: false },
};

/** The problems of a trial's harness: what makes the trial say nothing about the server. */
export function harnessProblems(
    summary: StreamSummary,
    stopped: TrialRecord['stopped'],
    exitCode: number | null,
    timeoutMinutes: number,
): string[] {
    return sessionProblems(summary, stopped, exitCode, timeoutMinutes, AGENT_USE_CONFINEMENT);
}

/**
 * What a trial's record states of its session, from its stream: the tool calls and errors per
 * tool, the calls the permission mode refused, what the session was offered, its turns and its
 * time. Shared by the agent-use and the authoring trials.
 */
export function sessionRecord(
    summary: StreamSummary,
): Pick<TrialRecord, 'tool_calls' | 'permission_denials' | 'session' | 'turns' | 'duration_ms'> {
    const calls = new Map<string, { calls: number; errors: number }>();
    for (const call of summary.toolCalls) {
        const row = calls.get(call.name) ?? { calls: 0, errors: 0 };
        row.calls++;
        calls.set(call.name, row);
    }
    for (const error of summary.toolErrors) {
        const row = calls.get(error.name) ?? { calls: 0, errors: 0 };
        row.errors++;
        calls.set(error.name, row);
    }
    return {
        tool_calls: [...calls]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([tool, row]) => ({ tool, calls: row.calls, errors: row.errors })),
        permission_denials: summary.result?.permissionDenials.length ?? 0,
        session:
            summary.init === null
                ? null
                : {
                      harness_version: summary.init.version,
                      model: summary.init.model,
                      permission_mode: summary.init.permissionMode,
                      tools: [...summary.init.tools].sort(),
                      mcp_servers: summary.init.mcpServers.map((s) => ({ ...s })),
                      skills: [...summary.init.skills].sort(),
                      plugins: summary.init.plugins.map((p) => p.name).sort(),
                  },
        turns: summary.result?.turns ?? null,
        duration_ms: summary.result?.durationMs ?? null,
    };
}

/** One trial's record, from its stream, its exit and its grades. */
export function trialRecord(input: {
    readonly trial: number;
    readonly summary: StreamSummary;
    readonly timedOut: boolean;
    readonly exitCode: number | null;
    readonly timeoutMinutes: number;
    readonly grades: readonly GraderResult[];
    readonly findings: readonly { readonly severity: string }[];
    readonly folders: readonly { path: string; name: string }[];
}): TrialRecord {
    const { summary } = input;
    const stopped = stoppedBy(summary, input.timedOut);
    const problems = harnessProblems(summary, stopped, input.exitCode, input.timeoutMinutes);
    const count = (severity: string): number =>
        input.findings.filter((f) => f.severity === severity).length;
    const session = sessionRecord(summary);
    return {
        task: TASK,
        trial: input.trial,
        passed: problems.length === 0 && input.grades.every((g) => g.passed),
        stopped,
        harness_problems: problems,
        graders: input.grades.map((g) => ({
            name: g.name,
            passed: g.passed,
            problems: g.problems.map((text) => sanitize(text, input.folders)),
        })),
        tool_calls: session.tool_calls,
        tool_errors: summary.toolErrors.map((e) => ({
            tool: e.name,
            message: sanitize(e.message, input.folders),
        })),
        permission_denials: session.permission_denials,
        session: session.session,
        turns: session.turns,
        duration_ms: session.duration_ms,
        exit_code: input.exitCode,
        findings_left: {
            error: count('error'),
            warning: count('warning'),
            information: count('information'),
            hint: count('hint'),
        },
    };
}

/** The command a record states, its parameters as given. */
function commandOf(root: string, options: ScoredOptions): string {
    const parts = [
        `SCORED_MODEL=${options.model}`,
        `SCORED_TRIALS=${String(options.trials)}`,
        `SCORED_SESSION_LIMIT=${String(options.sessionLimit)}`,
    ];
    const server = inRepository(root, options.server, '<agent server>');
    if (server !== DEFAULT_SERVER) {
        parts.push(`SCORED_SERVER=${server}`);
    }
    if (options.claude.command !== 'claude' || options.claude.args.length > 0) {
        parts.push('SCORED_CLAUDE=<another Claude Code>');
    }
    if (options.continue) {
        parts.push('SCORED_CONTINUE=true');
    }
    return `${parts.join(' ')} task scored:agent-use`;
}

/**
 * The record a continued run (`SCORED_CONTINUE=true`) adds its trials to: the one already
 * written, which must state everything a trial depends on exactly as this run would: the same
 * tool (version, commit and whether the checkout had changes), spec, game stub, task (prompt
 * and manifest, by hash), Claude Code version, model, session limit, time limit, arguments and
 * agent server. Otherwise the run stops before any test session, naming what differs, so that
 * one record never mixes trials made two ways.
 */
export function continuedRecord(
    file: string,
    expected: Pick<ScoredRecord, 'tool' | 'spec' | 'game'> &
        Pick<
            ScoredResults,
            | 'task'
            | 'harness'
            | 'model'
            | 'session_limit'
            | 'timeout_minutes'
            | 'arguments'
            | 'server'
        >,
): ScoredRecord {
    const { tool, spec, game, ...results } = expected;
    return recordToContinue(
        file,
        SCORED_SUITE,
        { tool, spec, game },
        results,
    ) as unknown as ScoredRecord;
}

/**
 * The record of `suite` already written at `file`, which a continued run adds its trials to:
 * it must state `top` (the record's own fields: the tool, the spec, the game) and `results`
 * (the fields of its results a trial depends on) exactly as this run would, compared as the
 * record holds them, written as JSON and read back. Otherwise the run stops before any test
 * session, naming what differs.
 */
export function recordToContinue(
    file: string,
    suite: string,
    top: Readonly<Record<string, unknown>>,
    results: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
    if (!existsSync(file)) {
        throw new CommandError(
            `SCORED_CONTINUE=true adds to the record already written, and there is none: ${file}`,
            EXIT.usage,
        );
    }
    const record = readJson(file);
    const written = isObject(record) ? record['results'] : undefined;
    if (
        !isObject(record) ||
        record['suite'] !== suite ||
        !isObject(written) ||
        !Array.isArray(written['trials']) ||
        !Array.isArray(record['notes'])
    ) {
        throw new CommandError(
            `SCORED_CONTINUE=true: ${file} is not a ${suite} record`,
            EXIT.usage,
        );
    }
    // As the record would hold them: written as JSON and read back.
    const asWritten = (value: unknown): Record<string, unknown> =>
        JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const wantedTop = asWritten(top);
    const wantedResults = asWritten(results);
    const differ: string[] = [];
    for (const key of Object.keys(wantedTop)) {
        if (!isDeepStrictEqual(record[key], wantedTop[key])) {
            differ.push(key);
        }
    }
    for (const key of Object.keys(wantedResults)) {
        if (!isDeepStrictEqual(written[key], wantedResults[key])) {
            differ.push(key);
        }
    }
    if (differ.length > 0) {
        throw new CommandError(
            `SCORED_CONTINUE=true: the record already written was made another way (${differ.join(', ')}); its trials and this run's cannot share one record`,
            EXIT.usage,
        );
    }
    return record;
}

/** Run the scored agent-use run and write its record. */
export function runScored(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
    log: (line: string) => void,
    /** Where to write the record: `RECORD_FILE` by default; a test writes it elsewhere. */
    recordFile: string = path.join(root, ...RECORD_FILE.split('/')),
): { readonly file: string; readonly record: ScoredRecord } {
    const options = scoredOptions(root, env);
    if (!existsSync(options.server)) {
        throw new CommandError(
            `the agent server is not built: ${relativePosix(root, options.server)} does not exist (task build; SCORED_SERVER names another entry point)`,
            EXIT.usage,
        );
    }
    const manifest: DefectManifest = committedManifest(root);
    const spec: Spec = openSpec(path.join(root, 'spec'));
    const gameDir = path.join(root, ...manifest.game.split('/'));
    const original = path.join(root, DEFECTS_DIR, 'mod');
    const promptFile = path.join(root, PROMPT_FILE);
    const prompt = readFileSync(promptFile, 'utf8').trim();
    const version = harnessVersion(options.claude);
    // Everything the record states about how its trials were made, fixed before the first one.
    const fixed = {
        tool: toolInfo(root),
        spec: committedSpec(root),
        game: gameInfo(gameDir),
        task: {
            name: TASK,
            prompt_file: PROMPT_FILE,
            prompt_sha256: sha256OfFile(promptFile),
            manifest_sha256: sha256OfFile(path.join(root, DEFECTS_DIR, 'manifest.json')),
            fixture: DEFECTS_DIR,
            game: manifest.game,
            defects: manifest.defects.length,
            look_alikes: manifest.look_alikes.length,
            graders: [...GRADERS],
        },
        harness: { name: 'claude-code' as const, version },
        model: options.model,
        session_limit: options.sessionLimit,
        timeout_minutes: options.timeoutMinutes,
        arguments: recordedArgs(options),
        server: {
            entry: inRepository(root, options.server, '<agent server>'),
            arguments: options.serverArgs.map((a) =>
                a.replaceAll('{mod}', '<trial mod>').replaceAll('{game}', '<game stub>'),
            ),
        },
    };
    const previous = options.continue ? continuedRecord(recordFile, fixed) : null;
    const first = (previous?.results.trials.length ?? 0) + 1;
    log(
        `scored:agent-use: Claude Code ${version}, model ${options.model}, ${String(options.trials)} test sessions${previous === null ? '' : ` added to the ${String(first - 1)} of the record`}, each with session limit ${String(options.sessionLimit)} and time limit ${String(options.timeoutMinutes)} minutes`,
    );

    const runDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'pychivalry-scored-')));
    const cacheDir = path.join(runDir, 'cache');
    mkdirSync(cacheDir);
    const trials: TrialRecord[] = [];
    try {
        for (let n = first; n < first + options.trials; n++) {
            const trialDir = path.join(runDir, `trial-${String(n)}`);
            const modDir = path.join(trialDir, 'mod');
            cpSync(original, modDir, { recursive: true });
            const configFile = path.join(trialDir, 'mcp.json');
            writeFileSync(
                configFile,
                `${JSON.stringify(mcpConfig(options, modDir, gameDir, cacheDir), null, 4)}\n`,
            );
            const streamFile = path.join(trialDir, 'stream.jsonl');
            const out = openSync(streamFile, 'w');
            const err = openSync(path.join(trialDir, 'stderr.txt'), 'w');
            let spawned;
            try {
                spawned = spawnSync(
                    options.claude.command,
                    [...options.claude.args, ...claudeArgs(options, prompt, configFile)],
                    {
                        cwd: modDir,
                        stdio: ['ignore', out, err],
                        env: trialEnv(env),
                        timeout: options.timeoutMinutes * 60_000,
                        killSignal: 'SIGTERM',
                    },
                );
            } finally {
                closeSync(out);
                closeSync(err);
            }
            const timedOut =
                (spawned.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
            if (spawned.error !== undefined && !timedOut) {
                throw new CommandError(
                    `Claude Code could not be started: ${spawned.error.message}`,
                    EXIT.usage,
                );
            }
            const summary = readStream(readFileSync(streamFile, 'utf8'));
            const folders = [
                { path: modDir, name: '<trial mod>' },
                { path: runDir, name: '<run dir>' },
                { path: root, name: '<repository>' },
                { path: homedir(), name: '<home>' },
            ];
            const { findings, grades } = gradeMod({
                root,
                spec,
                manifest,
                original,
                result: modDir,
            });
            const trial = trialRecord({
                trial: n,
                summary,
                timedOut,
                exitCode: spawned.status,
                timeoutMinutes: options.timeoutMinutes,
                grades,
                findings,
                folders,
            });
            trials.push(trial);
            const errorText = summary.result?.errorText ?? null;
            if (trial.stopped === 'error' && errorText !== null) {
                // The session's own words on its error, for the person running it; never recorded.
                log(`trial ${String(n)}: the session's error: ${sanitize(errorText, folders)}`);
            }
            const failed = trial.graders.filter((g) => !g.passed).map((g) => g.name);
            log(
                `trial ${String(n)}: ${trial.passed ? 'passed' : 'failed'} (${trial.stopped}; ${String(summary.toolCalls.length)} tool calls, ${String(summary.toolErrors.length)} tool errors${failed.length > 0 ? `; failed: ${failed.join(', ')}` : ''}${trial.harness_problems.length > 0 ? `; harness: ${trial.harness_problems.join('; ')}` : ''})`,
            );
        }
    } finally {
        if (options.keep) {
            log(`scored:agent-use: the trials are kept in ${runDir}`);
        } else {
            rmSync(runDir, { recursive: true, force: true });
        }
    }

    const all = [...(previous?.results.trials ?? []), ...trials];
    const passed = all.filter((t) => t.passed).length;
    const { tool, spec: specRef, game, ...stated } = fixed;
    const results: ScoredResults = {
        ...stated,
        trials: all,
        tasks: [
            {
                name: TASK,
                trials: all.length,
                passed,
                pass_rate: passRate(passed, all.length),
                target: targetOf(passed, all.length),
            },
        ],
    };
    const madeAt = now();
    const record: ScoredRecord = {
        record_format: 1,
        suite: SCORED_SUITE,
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
                      `The agent server and the graders read the game stub ${manifest.game}, not an installed game.`,
                      'Each trial is one test session of the Claude Code installed on the machine the run was made on, which the script gave no credentials; pychivalry itself makes no model call.',
                      "A trial passes when all five graders pass and its harness had no problem. The tool calls and errors are counted from the session's output stream; their inputs and results are not kept.",
                  ]
                : [
                      ...previous.notes,
                      `Trials ${String(first)} to ${String(all.length)} were added on ${madeAt.slice(0, 10)} by a run continuing the record (SCORED_CONTINUE=true), at the same commit with the same task, Claude Code version, model, session limit, time limit, arguments and agent server as trials 1 to ${String(first - 1)} (made ${previous.made_at.slice(0, 10)}).`,
                  ],
        results,
    };
    const file = recordFile;
    writeJson(file, record);
    log(
        `scored:agent-use: ${String(passed)} of ${String(all.length)} trials passed (pass rate ${String(results.tasks[0]?.pass_rate ?? 0)}); ${targetText(targetOf(passed, all.length), passed)}; record written to ${relativePosix(root, file)}`,
    );
    return { file, record };
}
