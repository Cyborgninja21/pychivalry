/**
 * The scored agent-use run (docs/PLAN.md items 6.8 and 6.10; docs/MVP.md, "AI tests"), behind
 * `task scored:agent-use`. Never part of `task ci`: each trial starts Claude Code, which draws
 * on the login's usage limits, so a run is started by a person, or by an agent on the owner's
 * word.
 *
 * For each trial it copies `fixtures/defects/mod/` into a fresh temporary folder (a copy of the
 * files, with no git history), writes an agent-server configuration naming only the built agent
 * server (`packages/mcp`, started over the manifest's game stub), and starts Claude Code's
 * command-line mode once in that folder, on the existing login, with the committed task prompt
 * (`tools/scored-run/agent-use.prompt.md`). The session is confined to that server plus file
 * read and edit (`claudeArgs`). It reads the session's output stream for the tool calls and
 * tool errors (`stream.ts`), grades the folder as the session left it (`graders.ts`), and
 * writes the record, `records/scored/agent-use.json` (`scored-record.ts`).
 *
 * A trial stops at its budget: Claude Code's own `--max-budget-usd` ends the session when its
 * estimate of the cost passes the budget (it can pass it by the one response that crossed it),
 * and a session still running after the time limit is stopped.
 *
 * The parameters, from the environment:
 *
 * | Variable | Meaning | Default |
 * | --- | --- | --- |
 * | `SCORED_BUDGET_USD` | The budget per trial, in US dollars | none: it must be given |
 * | `SCORED_MODEL` | The model, by its full name | `PINNED_MODEL` |
 * | `SCORED_TRIALS` | Trials per task | 5 |
 * | `SCORED_SERVER` | The agent server's entry point, from the repository root | `packages/mcp/dist/main.js` |
 * | `SCORED_SERVER_ARGS` | Its arguments, a JSON list; `{mod}` and `{game}` stand for the trial's mod and the game stub | `["{mod}", "--vanilla", "{game}"]` |
 * | `SCORED_CLAUDE` | Claude Code's command; a `.js` or `.mjs` file is run with Node | `claude` |
 * | `SCORED_TIMEOUT_MINUTES` | The time limit per trial | 30 |
 * | `SCORED_KEEP` | `true` keeps the run's temporary folder (each trial's mod, stream and configuration) and prints where | removed |
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
import { openSpec, type Spec } from '@pychivalry/core';
import { gameInfo } from '../game.js';
import { committedSpec, machineInfo, now, toolInfo } from '../record.js';
import { CommandError, EXIT, relativePosix, sha256OfFile, writeJson } from '../util.js';
import { GRADERS, gradeMod, type GraderResult } from './graders.js';
import { committedManifest, DEFECTS_DIR, type DefectManifest } from './manifest.js';
import { readStream, type StreamSummary } from './stream.js';
import {
    passRate,
    SCORED_SUITE,
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
export const DEFAULT_SERVER_ARGS: readonly string[] = ['{mod}', '--vanilla', '{game}'];
export const DEFAULT_TIMEOUT_MINUTES = 30;
/** The task's prompt, from the repository root. */
export const PROMPT_FILE = 'tools/scored-run/agent-use.prompt.md';
/** The record a run writes, from the repository root. */
export const RECORD_FILE = 'records/scored/agent-use.json';
/** The agent server's name in the configuration, which prefixes its tools: `mcp__pychivalry__`. */
export const SERVER_NAME = 'pychivalry';
export const TASK = 'agent-use';
/** The built-in tools a trial may use. */
export const BUILT_IN_TOOLS: readonly string[] = ['Read', 'Edit'];

export interface ScoredOptions {
    readonly model: string;
    readonly trials: number;
    readonly budgetUsd: number;
    /** The agent server's entry point, absolute. */
    readonly server: string;
    readonly serverArgs: readonly string[];
    /** Claude Code's command and the arguments before its own. */
    readonly claude: { readonly command: string; readonly args: readonly string[] };
    readonly timeoutMinutes: number;
    readonly keep: boolean;
}

function positive(name: string, value: string, integer: boolean): number {
    const n = Number(value);
    if (!/^[0-9]+(\.[0-9]+)?$/.test(value) || !(n > 0) || (integer && !Number.isInteger(n))) {
        throw new CommandError(
            `${name} must be a positive ${integer ? 'whole number' : 'number'}, not ${JSON.stringify(value)}`,
            EXIT.usage,
        );
    }
    return n;
}

/** The run's parameters, from the environment (the table above). */
export function scoredOptions(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
): ScoredOptions {
    const budget = env['SCORED_BUDGET_USD'];
    if (budget === undefined || budget === '') {
        throw new CommandError(
            'SCORED_BUDGET_USD must give the budget per trial in US dollars; a run spends up to trials x budget (tools/scored-run/README.md)',
            EXIT.usage,
        );
    }
    const model = env['SCORED_MODEL'] ?? PINNED_MODEL;
    if (!/^claude-[a-z0-9]+(-[a-z0-9]+)*$/.test(model)) {
        throw new CommandError(
            `SCORED_MODEL must be a model's full name such as ${PINNED_MODEL}, not an alias: ${JSON.stringify(model)}`,
            EXIT.usage,
        );
    }
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
                'SCORED_SERVER_ARGS must be a JSON list of texts, such as ["{mod}", "--vanilla", "{game}"]',
                EXIT.usage,
            );
        }
        serverArgs = parsed;
    }
    const claude = env['SCORED_CLAUDE'] ?? 'claude';
    return {
        model,
        trials: positive('SCORED_TRIALS', env['SCORED_TRIALS'] ?? String(DEFAULT_TRIALS), true),
        budgetUsd: positive('SCORED_BUDGET_USD', budget, false),
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
    };
}

/**
 * Claude Code's arguments for one trial: the flags of docs/PLAN.md item 6.8, checked against
 * `claude --help` of Claude Code 2.1.220 (tools/scored-run/README.md says how each differs):
 *
 * - `-p` with the prompt first: command-line mode, which the plan's other flags need. Three of
 *   the flags take several values (`--mcp-config`, `--tools`, `--allowedTools`), so the prompt
 *   goes before them, as Claude Code's own examples write it.
 * - `--allowedTools` also allows `Read` and `Edit`: under `--permission-mode dontAsk` every
 *   call that would ask is refused, and an edit asks unless it is allowed.
 * - `--setting-sources project,local` leaves out the user's own settings, instructions and
 *   skills, so that a trial measures the server, not the person's set-up (the plan's open
 *   question; the trial folder has no project settings).
 */
export function claudeArgs(
    options: Pick<ScoredOptions, 'model' | 'budgetUsd'>,
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
        '--max-budget-usd',
        String(options.budgetUsd),
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

/** The same arguments as a record states them: the prompt and the configuration file named. */
export function recordedArgs(options: Pick<ScoredOptions, 'model' | 'budgetUsd'>): string[] {
    return claudeArgs(options, `<${PROMPT_FILE}>`, '<agent-server configuration>');
}

/**
 * Whether a variable belongs to a surrounding Claude Code session (its session id, its
 * messaging socket, its effort, the mark that a session is running) rather than to the person:
 * a run started from inside a session must not hand them to its trials.
 */
function sessionVariable(name: string): boolean {
    return (
        name === 'CLAUDECODE' ||
        name === 'CLAUDE_PID' ||
        name === 'CLAUDE_EFFORT' ||
        name === 'CLAUDE_AGENT_SDK_VERSION' ||
        name.startsWith('CLAUDE_CODE_')
    );
}

/**
 * The environment of a trial's Claude Code: this one, without an API key, so the session runs
 * on the existing login (no key is stored anywhere), and without a surrounding Claude Code
 * session's variables; with claude.ai's own connectors and the automatic memory turned off, so
 * that nothing but the configured server is offered.
 */
export function trialEnv(
    env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
        if (
            v !== undefined &&
            k !== 'ANTHROPIC_API_KEY' &&
            k !== 'ANTHROPIC_AUTH_TOKEN' &&
            !sessionVariable(k)
        ) {
            out[k] = v;
        }
    }
    out['ENABLE_CLAUDEAI_MCP_SERVERS'] = 'false';
    out['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] = '1';
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

/** What made a trial's session end, from its stream and its exit. */
function stoppedBy(summary: StreamSummary, timedOut: boolean): TrialRecord['stopped'] {
    if (timedOut) {
        return 'timeout';
    }
    const subtype = summary.result?.subtype;
    if (subtype === undefined) {
        return 'no-result';
    }
    if (subtype === 'success') {
        return 'finished';
    }
    if (subtype === 'error_max_budget_usd') {
        return 'budget';
    }
    if (subtype === 'error_max_turns') {
        return 'turns';
    }
    return 'error';
}

/** The problems of a trial's harness: what makes the trial say nothing about the server. */
export function harnessProblems(
    summary: StreamSummary,
    stopped: TrialRecord['stopped'],
    exitCode: number | null,
    timeoutMinutes: number,
): string[] {
    const problems: string[] = [];
    if (stopped === 'timeout') {
        problems.push(
            `the session was stopped after the time limit of ${String(timeoutMinutes)} minutes`,
        );
    } else if (stopped === 'no-result') {
        problems.push(`the stream has no result; Claude Code exited with ${String(exitCode)}`);
    } else if (stopped === 'error') {
        problems.push(`the session ended with ${summary.result?.subtype ?? 'an error'}`);
    }
    const init = summary.init;
    if (init === null) {
        problems.push('the stream has no init event: the confinement was not seen');
        return problems;
    }
    const outside = init.tools.filter(
        (t) => !BUILT_IN_TOOLS.includes(t) && !t.startsWith(`mcp__${SERVER_NAME}__`),
    );
    if (outside.length > 0) {
        problems.push(`tools outside the confinement were offered: ${outside.join(', ')}`);
    }
    const others = init.mcpServers.filter((s) => s.name !== SERVER_NAME).map((s) => s.name);
    if (others.length > 0) {
        problems.push(`other agent servers were offered: ${others.join(', ')}`);
    }
    const server = init.mcpServers.find((s) => s.name === SERVER_NAME);
    if (server === undefined) {
        problems.push('the agent server is not in the session');
    } else if (server.status === 'failed') {
        problems.push('the agent server failed to start');
    }
    return problems;
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
    const count = (severity: string): number =>
        input.findings.filter((f) => f.severity === severity).length;
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
        tool_calls: [...calls]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([tool, row]) => ({ tool, calls: row.calls, errors: row.errors })),
        tool_errors: summary.toolErrors.map((e) => ({
            tool: e.name,
            message: sanitize(e.message, input.folders),
        })),
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
                  },
        cost_usd: summary.result?.costUsd ?? null,
        turns: summary.result?.turns ?? null,
        duration_ms: summary.result?.durationMs ?? null,
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
        `SCORED_BUDGET_USD=${String(options.budgetUsd)}`,
    ];
    const server = relativePosix(root, options.server);
    if (server !== DEFAULT_SERVER) {
        parts.push(`SCORED_SERVER=${server.startsWith('..') ? '<agent server>' : server}`);
    }
    return `${parts.join(' ')} task scored:agent-use`;
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
    log(
        `scored:agent-use: Claude Code ${version}, model ${options.model}, ${String(options.trials)} trials, at most ${String(options.budgetUsd)} USD each (${String(options.trials * options.budgetUsd)} USD in all)`,
    );

    const runDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'pychivalry-scored-')));
    const cacheDir = path.join(runDir, 'cache');
    mkdirSync(cacheDir);
    const trials: TrialRecord[] = [];
    try {
        for (let n = 1; n <= options.trials; n++) {
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
                folders: [
                    { path: modDir, name: '<trial mod>' },
                    { path: runDir, name: '<run dir>' },
                    { path: root, name: '<repository>' },
                    { path: homedir(), name: '<home>' },
                ],
            });
            trials.push(trial);
            const failed = trial.graders.filter((g) => !g.passed).map((g) => g.name);
            log(
                `trial ${String(n)}: ${trial.passed ? 'passed' : 'failed'} (${trial.stopped}; ${String(summary.toolCalls.length)} tool calls, ${String(summary.toolErrors.length)} tool errors; cost ${String(trial.cost_usd ?? 'unknown')} USD${failed.length > 0 ? `; failed: ${failed.join(', ')}` : ''}${trial.harness_problems.length > 0 ? `; harness: ${trial.harness_problems.join('; ')}` : ''})`,
            );
        }
    } finally {
        if (options.keep) {
            log(`scored:agent-use: the trials are kept in ${runDir}`);
        } else {
            rmSync(runDir, { recursive: true, force: true });
        }
    }

    const passed = trials.filter((t) => t.passed).length;
    const results: ScoredResults = {
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
        harness: { name: 'claude-code', version },
        model: options.model,
        budget_usd_per_trial: options.budgetUsd,
        timeout_minutes: options.timeoutMinutes,
        arguments: recordedArgs(options),
        server: {
            entry: relativePosix(root, options.server).startsWith('..')
                ? '<agent server>'
                : relativePosix(root, options.server),
            arguments: options.serverArgs.map((a) =>
                a.replaceAll('{mod}', '<trial mod>').replaceAll('{game}', '<game stub>'),
            ),
        },
        trials,
        tasks: [
            {
                name: TASK,
                trials: trials.length,
                passed,
                pass_rate: passRate(passed, trials.length),
            },
        ],
        cost_usd: Math.round(trials.reduce((s, t) => s + (t.cost_usd ?? 0), 0) * 1e6) / 1e6,
    };
    const record: ScoredRecord = {
        record_format: 1,
        suite: SCORED_SUITE,
        command: commandOf(root, options),
        made_at: now(),
        tool: toolInfo(root),
        machine: machineInfo(),
        game: gameInfo(gameDir),
        spec: committedSpec(root),
        corpus: null,
        notes: [
            `The agent server and the graders read the game stub ${manifest.game}, not an installed game.`,
            "cost_usd is Claude Code's own estimate (total_cost_usd). On a subscription login it is not charged per call: the run draws on the login's usage limits instead.",
            "A trial passes when all five graders pass and its harness had no problem. The tool calls and errors are counted from the session's output stream; their inputs and results are not kept.",
        ],
        results,
    };
    const file = recordFile;
    writeJson(file, record);
    log(
        `scored:agent-use: ${String(passed)} of ${String(trials.length)} trials passed (pass rate ${String(results.tasks[0]?.pass_rate ?? 0)}); record written to ${relativePosix(root, file)}`,
    );
    return { file, record };
}
