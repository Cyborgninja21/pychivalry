/**
 * The scored run (docs/PLAN.md items 6.8 and 6.10), driven against a stand-in for Claude Code
 * (`fake-claude.ts`) that plays back a stream written here in the documented shape and, where a
 * test says so, edits the trial's mod. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileRecordSchema, checkRecord } from '../records-check.js';
import { tempDir } from '../testing.js';
import { CommandError, repoRoot } from '../util.js';
import { DEFECTS_DIR } from './manifest.js';
import {
    claudeArgs,
    credentialVariable,
    PINNED_MODEL,
    PROMPT_FILE,
    runScored,
    sanitize,
    scoredOptions,
    SERVER_TOOLS,
    SESSION_LIMIT_SUBTYPE,
    sessionVariable,
    trialEnv,
} from './run.js';
import { readStream } from './stream.js';
import type { ScoredRecord } from './scored-record.js';

const root = repoRoot();
const fake = fileURLToPath(new URL('./fake-claude.js', import.meta.url));
const validate = compileRecordSchema(path.join(root, 'records', 'record.schema.json'));
const expected = {
    spec: { version: '0', sha256: '0'.repeat(64) },
    corpusManifestSha256: undefined,
};

/** A session's stream in the shape Claude Code writes with stream-json and verbose. */
function stream(options: {
    readonly tools?: readonly string[];
    readonly servers?: readonly { name: string; status: string }[];
    readonly skills?: readonly string[];
    readonly subtype?: string;
    readonly errorText?: string;
}): string {
    const events: unknown[] = [
        {
            type: 'system',
            subtype: 'init',
            cwd: '/somewhere/private',
            session_id: 'not-kept',
            claude_code_version: '2.1.220',
            model: PINNED_MODEL,
            permissionMode: 'dontAsk',
            tools: options.tools ?? [
                'Read',
                'Edit',
                ...SERVER_TOOLS.map((n) => `mcp__pychivalry__${n}`),
            ],
            mcp_servers: options.servers ?? [{ name: 'pychivalry', status: 'connected' }],
            skills: options.skills ?? [],
            plugins: [],
            apiKeySource: 'none',
        },
        {
            type: 'assistant',
            message: {
                content: [
                    { type: 'text', text: 'Checking the mod.' },
                    {
                        type: 'tool_use',
                        id: 'call-1',
                        name: 'mcp__pychivalry__check',
                        input: { severity: 'warning' },
                    },
                ],
            },
        },
        {
            type: 'user',
            message: {
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'call-1',
                        content: [{ type: 'text', text: '28 findings' }],
                    },
                ],
            },
        },
        {
            type: 'assistant',
            message: {
                content: [
                    {
                        type: 'tool_use',
                        id: 'call-2',
                        name: 'Read',
                        input: { file_path: '/somewhere/private/x.txt' },
                    },
                ],
            },
        },
        {
            type: 'user',
            message: {
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'call-2',
                        is_error: true,
                        content:
                            options.errorText ?? 'File does not exist: /somewhere/private/x.txt',
                    },
                ],
            },
        },
        {
            type: 'assistant',
            message: { content: [{ type: 'tool_use', id: 'call-3', name: 'Edit', input: {} }] },
        },
        {
            type: 'user',
            message: { content: [{ type: 'tool_result', tool_use_id: 'call-3', content: 'ok' }] },
        },
        {
            type: 'result',
            subtype: options.subtype ?? 'success',
            is_error: (options.subtype ?? 'success') !== 'success',
            total_cost_usd: 0.42,
            num_turns: 3,
            duration_ms: 1234,
            session_id: 'not-kept',
            permission_denials: [{ tool_name: 'Bash', tool_use_id: 'call-9', tool_input: {} }],
        },
    ];
    return `${events.map((e) => JSON.stringify(e)).join('\n')}\nnot json\n`;
}

interface Run {
    readonly record: ScoredRecord;
    readonly calls: Record<string, unknown>[];
    readonly log: string[];
}

/**
 * Variables that may hold a key, a token or another credential, set around every run of these
 * tests: none may reach a test session.
 */
const CREDENTIALS: Readonly<Record<string, string>> = {
    ANTHROPIC_API_KEY: 'must-not-reach-the-session',
    ANTHROPIC_AUTH_TOKEN: 'must-not-reach-the-session',
    CLAUDE_CODE_OAUTH_TOKEN: 'must-not-reach-the-session',
    AWS_BEARER_TOKEN_BEDROCK: 'must-not-reach-the-session',
    AWS_SECRET_ACCESS_KEY: 'must-not-reach-the-session',
    GITHUB_TOKEN: 'must-not-reach-the-session',
    SOME_SERVICE_PASSWORD: 'must-not-reach-the-session',
    GOOGLE_APPLICATION_CREDENTIALS: 'must-not-reach-the-session',
    openai_api_key: 'must-not-reach-the-session',
};

function run(t: TestContext, env: Record<string, string>, streamText = stream({})): Run {
    const dir = tempDir(t);
    const streamFile = path.join(dir, 'stream.jsonl');
    writeFileSync(streamFile, streamText);
    const argvFile = path.join(dir, 'argv.jsonl');
    const log: string[] = [];
    const { record } = runScored(
        root,
        {
            SCORED_SESSION_LIMIT: '2',
            SCORED_TRIALS: '2',
            SCORED_CLAUDE: fake,
            SCORED_SERVER: fake,
            FAKE_CLAUDE_STREAM: streamFile,
            FAKE_CLAUDE_ARGV: argvFile,
            ...CREDENTIALS,
            CLAUDECODE: '1',
            CLAUDE_CODE_SESSION_ID: 'a-surrounding-session',
            CLAUDE_EFFORT: 'low',
            AI_AGENT: 'claude-code_agent',
            MCP_CONNECTION_NONBLOCKING: 'true',
            MCP_DISCOVERY_CACHE: '1',
            ...env,
        },
        (line) => log.push(line),
        path.join(dir, 'agent-use.json'),
    );
    assert.deepEqual(
        checkRecord(JSON.parse(JSON.stringify(record)) as unknown, validate, expected),
        [],
    );
    const calls = existsSync(argvFile)
        ? readFileSync(argvFile, 'utf8')
              .trim()
              .split('\n')
              .map((l) => JSON.parse(l) as Record<string, unknown>)
        : [];
    return { record, calls, log };
}

test('a run whose agent fixes the mod: every trial passes, and the record holds', (t) => {
    const { record, calls, log } = run(t, {
        FAKE_CLAUDE_APPLY: path.join(root, DEFECTS_DIR, 'reference'),
    });
    const results = record.results;
    assert.equal(results.trials.length, 2);
    assert.deepEqual(results.tasks, [{ name: 'agent-use', trials: 2, passed: 2, pass_rate: 1 }]);
    assert.equal(results.harness.version, '2.1.220');
    assert.equal(results.model, PINNED_MODEL);
    assert.equal(results.session_limit, 2);
    assert.equal(record.corpus, null);
    assert.match(
        record.command,
        /^SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=2 SCORED_SESSION_LIMIT=2 SCORED_SERVER=\S+ SCORED_CLAUDE=<another Claude Code> task scored:agent-use$/,
    );
    const trial = results.trials[0];
    assert.ok(trial !== undefined);
    assert.equal(trial.passed, true);
    assert.equal(trial.stopped, 'finished');
    assert.deepEqual(trial.harness_problems, []);
    assert.deepEqual(trial.tool_calls, [
        { tool: 'Edit', calls: 1, errors: 0 },
        { tool: 'Read', calls: 1, errors: 1 },
        { tool: 'mcp__pychivalry__check', calls: 1, errors: 0 },
    ]);
    assert.deepEqual(trial.tool_errors, [{ tool: 'Read', message: 'File does not exist: <path>' }]);
    assert.equal(trial.permission_denials, 1);
    assert.deepEqual(trial.findings_left, { error: 0, warning: 0, information: 0, hint: 0 });
    assert.deepEqual(trial.session?.mcp_servers, [{ name: 'pychivalry', status: 'connected' }]);
    // Nothing from the session but what the record names: no folder, no id, nothing about how
    // Claude Code is signed in, and none of the figures Claude Code reports about the session's
    // use of the developer's plan (the stream's `total_cost_usd`).
    const text = JSON.stringify(record);
    for (const kept of [
        '/somewhere/private',
        'not-kept',
        'apiKeySource',
        'must-not-reach',
        'cost',
        '0.42',
    ]) {
        assert.ok(!text.includes(kept), `the record holds ${kept}`);
    }
    assert.ok(log.some((l) => l.includes('2 of 2 trials passed')));

    // Each trial: a fresh copy of the mod, no git history, the flags, the one server.
    assert.equal(calls.length, 2);
    const prompt = readFileSync(path.join(root, PROMPT_FILE), 'utf8').trim();
    for (const call of calls) {
        const argv = call['argv'] as string[];
        const configFile = argv[argv.indexOf('--mcp-config') + 1] ?? '';
        assert.deepEqual(
            argv,
            claudeArgs({ model: PINNED_MODEL, sessionLimit: 2 }, prompt, configFile),
        );
        assert.equal(call['git'], false);
        assert.deepEqual(call['credential_variables'], []);
        const cwd = call['cwd'] as string;
        assert.notEqual(path.resolve(cwd), path.resolve(root, DEFECTS_DIR, 'mod'));
        const config = call['mcp_config'] as { mcpServers: Record<string, { args: string[] }> };
        assert.deepEqual(Object.keys(config.mcpServers), ['pychivalry']);
        const args = config.mcpServers['pychivalry']?.args ?? [];
        assert.equal(args[0], fake);
        assert.equal(args[1], '--mod');
        assert.equal(path.resolve(args[2] ?? ''), path.resolve(cwd));
        assert.equal(args[3], '--vanilla');
        assert.equal(
            path.resolve(args[4] ?? ''),
            path.join(root, 'fixtures', 'game', 'planted-defects', 'game'),
        );
    }
    assert.notEqual(calls[0]?.['cwd'], calls[1]?.['cwd']);
});

test('a run whose agent changes nothing: the trials fail on the checker graders', (t) => {
    const { record } = run(t, { SCORED_TRIALS: '1' });
    const trial = record.results.trials[0];
    assert.equal(trial?.passed, false);
    assert.deepEqual(
        trial.graders.filter((g) => !g.passed).map((g) => g.name),
        ['zero-errors', 'defects-gone'],
    );
    assert.deepEqual(record.results.tasks[0], {
        name: 'agent-use',
        trials: 1,
        passed: 0,
        pass_rate: 0,
    });
    // 21 error codes, the clash reported at both its definitions.
    assert.equal(trial.findings_left.error, 22);
});

test("the test session's environment drops every key and token variable, and a surrounding session's", (t) => {
    // What the session was given, as the stand-in for Claude Code saw it.
    const { calls } = run(t, { SCORED_TRIALS: '1' });
    assert.equal(calls.length, 1);
    const call = calls[0] ?? {};
    assert.deepEqual(call['credential_variables'], []);
    assert.deepEqual(call['session_variables'], []);
    assert.equal(call['claude_ai_servers'], 'false');
    assert.equal(call['auto_memory_off'], '1');
    assert.equal(call['mcp_nonblocking'], '0');

    // The rule itself: every variable named like a key, a token or another credential goes,
    // whatever its letter case; the rest of the environment stays.
    const env = trialEnv({
        ...CREDENTIALS,
        PATH: 'bin',
        LANG: 'C.UTF-8',
        CK3_GAME_PATH: '<game dir>',
        CLAUDECODE: '1',
        CLAUDE_CODE_SESSION_ID: 'a-surrounding-session',
        AI_AGENT: 'claude-code_agent',
        MCP_CONNECTION_NONBLOCKING: 'true',
        MCP_DISCOVERY_CACHE: '1',
        PLAYWRIGHT_MCP_BROWSER: 'firefox',
    });
    for (const name of Object.keys(CREDENTIALS)) {
        assert.ok(credentialVariable(name), name);
        assert.ok(!(name in env), `${name} reached the session`);
    }
    for (const name of ['AI_AGENT', 'MCP_DISCOVERY_CACHE', 'CLAUDECODE']) {
        assert.ok(sessionVariable(name), name);
    }
    // Another program's variable that only names agent servers stays: it is not Claude Code's.
    assert.ok(!sessionVariable('PLAYWRIGHT_MCP_BROWSER'));
    assert.deepEqual(env, {
        PATH: 'bin',
        LANG: 'C.UTF-8',
        CK3_GAME_PATH: '<game dir>',
        PLAYWRIGHT_MCP_BROWSER: 'firefox',
        ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
        MCP_CONNECTION_NONBLOCKING: '0',
    });
});

test('a test session ended at its session limit is recorded as such, not as a harness problem', (t) => {
    const { record } = run(t, { SCORED_TRIALS: '1' }, stream({ subtype: SESSION_LIMIT_SUBTYPE }));
    assert.equal(record.results.trials[0]?.stopped, 'session-limit');
    assert.deepEqual(record.results.trials[0].harness_problems, []);
});

test('a session that is not confined is a harness problem and fails its trial', (t) => {
    const { record } = run(
        t,
        { SCORED_TRIALS: '1', FAKE_CLAUDE_APPLY: path.join(root, DEFECTS_DIR, 'reference') },
        stream({
            tools: ['Read', 'Edit', 'Bash', 'mcp__pychivalry__check', 'mcp__other__tool'],
            servers: [
                { name: 'pychivalry', status: 'failed' },
                { name: 'other', status: 'connected' },
            ],
        }),
    );
    const trial = record.results.trials[0];
    assert.equal(trial?.passed, false);
    assert.deepEqual(trial.harness_problems, [
        'tools outside the confinement were offered: Bash, mcp__other__tool',
        'other agent servers were offered: other',
        'the agent server failed to start',
    ]);
    assert.ok(trial.graders.every((g) => g.passed));
});

test('a connected server whose tools were not offered is a harness problem', (t) => {
    const { record } = run(
        t,
        { SCORED_TRIALS: '1', FAKE_CLAUDE_APPLY: path.join(root, DEFECTS_DIR, 'reference') },
        stream({ tools: ['Read', 'Edit', 'mcp__pychivalry__check'] }),
    );
    assert.deepEqual(record.results.trials[0]?.harness_problems, [
        "the agent server's tools were not offered: explain_code, find_definition, find_references, list_definitions, lookup",
    ]);
    // Still starting when the session began: no tools yet, and no problem.
    const pending = run(
        t,
        { SCORED_TRIALS: '1', FAKE_CLAUDE_APPLY: path.join(root, DEFECTS_DIR, 'reference') },
        stream({ tools: ['Read', 'Edit'], servers: [{ name: 'pychivalry', status: 'pending' }] }),
    );
    assert.deepEqual(pending.record.results.trials[0]?.harness_problems, []);
    assert.equal(pending.record.results.trials[0].passed, true);
});

test('a session past the time limit is stopped and recorded', (t) => {
    const { record } = run(
        t,
        { SCORED_TRIALS: '1', SCORED_TIMEOUT_MINUTES: '0.02', FAKE_CLAUDE_SLEEP_MS: '20000' },
        '',
    );
    const trial = record.results.trials[0];
    assert.equal(trial?.stopped, 'timeout');
    assert.deepEqual(trial.harness_problems, [
        'the session was stopped after the time limit of 0.02 minutes',
        'the stream has no init event: the confinement was not seen',
    ]);
});

test('the parameters: a session limit is required with no default, a model is a full name, defaults hold', () => {
    const usage = (env: Record<string, string>): void => {
        assert.throws(
            () => scoredOptions(root, env),
            (e: unknown) => e instanceof CommandError && e.exitCode === 2,
        );
    };
    usage({});
    usage({ SCORED_SESSION_LIMIT: '' });
    usage({ SCORED_SESSION_LIMIT: '0' });
    usage({ SCORED_SESSION_LIMIT: 'two' });
    usage({ SCORED_SESSION_LIMIT: '2', SCORED_MODEL: 'opus' });
    usage({ SCORED_SESSION_LIMIT: '2', SCORED_TRIALS: '1.5' });
    usage({ SCORED_SESSION_LIMIT: '2', SCORED_SERVER_ARGS: '--mod' });
    const options = scoredOptions(root, { SCORED_SESSION_LIMIT: '2.5' });
    assert.equal(options.model, PINNED_MODEL);
    assert.equal(options.trials, 5);
    assert.equal(options.sessionLimit, 2.5);
    assert.equal(options.server, path.join(root, 'packages', 'mcp', 'dist', 'main.js'));
    assert.deepEqual(options.serverArgs, ['--mod', '{mod}', '--vanilla', '{game}']);
    assert.deepEqual(options.claude, { command: 'claude', args: [] });
    assert.equal(options.timeoutMinutes, 30);
    assert.equal(options.keep, false);
});

test('a missing agent server stops the run before any trial', () => {
    assert.throws(
        () =>
            runScored(
                root,
                {
                    SCORED_SESSION_LIMIT: '1',
                    SCORED_CLAUDE: fake,
                    SCORED_SERVER: 'no/such/main.js',
                },
                () => undefined,
            ),
        /the agent server is not built: no\/such\/main\.js/,
    );
});

test('the flags of the plan, as the installed Claude Code takes them', () => {
    assert.deepEqual(
        claudeArgs({ model: 'claude-test-1', sessionLimit: 1.5 }, 'Fix it.', 'mcp.json'),
        [
            '-p',
            'Fix it.',
            '--strict-mcp-config',
            '--mcp-config',
            'mcp.json',
            '--tools',
            'Read,Edit',
            '--allowedTools',
            'mcp__pychivalry__*,Read,Edit',
            '--permission-mode',
            'dontAsk',
            '--max-budget-usd',
            '1.5',
            '--output-format',
            'stream-json',
            '--verbose',
            '--no-session-persistence',
            '--model',
            'claude-test-1',
            '--setting-sources',
            'project,local',
            '--disable-slash-commands',
        ],
    );
});

test('sanitize names the known folders and hides any other absolute path', () => {
    const folders = [
        { path: path.join(path.sep, 'tmp', 'run', 'trial-1', 'mod'), name: '<trial mod>' },
    ];
    assert.equal(
        sanitize(
            `Cannot read ${path.join(path.sep, 'tmp', 'run', 'trial-1', 'mod', 'x.txt')}: no`,
            folders,
        ),
        `Cannot read <trial mod>${path.sep}x.txt: no`,
    );
    assert.equal(
        sanitize('see C:\\Users\\someone\\x and ~/y and /etc/z', []),
        'see <path> and <path> and <path>',
    );
    assert.equal(sanitize('x'.repeat(400), []).length, 300);
    assert.equal(sanitize('value = 5 / 2', []), 'value = 5 / 2');
});

test('the stream reader keeps the calls, errors, start and end, and counts unread lines', () => {
    const summary = readStream(stream({ errorText: 'boom' }));
    assert.deepEqual(
        summary.toolCalls.map((c) => c.name),
        ['mcp__pychivalry__check', 'Read', 'Edit'],
    );
    assert.deepEqual(summary.toolErrors, [{ name: 'Read', message: 'boom' }]);
    assert.equal(summary.init?.version, '2.1.220');
    assert.equal(summary.result?.subtype, 'success');
    assert.equal(summary.result.isError, false);
    assert.equal(summary.result.errorText, null);
    assert.deepEqual(summary.result.permissionDenials, ['Bash']);
    assert.equal(summary.unreadLines, 1);
    assert.deepEqual(readStream(''), {
        init: null,
        toolCalls: [],
        toolErrors: [],
        result: null,
        unreadLines: 0,
    });
});

test('a continued run adds its trials to the record, numbered after its own, and only to one made the same way', (t) => {
    const dir = tempDir(t);
    const recordFile = path.join(dir, 'agent-use.json');
    const streamFile = path.join(dir, 'stream.jsonl');
    writeFileSync(streamFile, stream({}));
    const base = {
        SCORED_SESSION_LIMIT: '2',
        SCORED_CLAUDE: fake,
        SCORED_SERVER: fake,
        FAKE_CLAUDE_STREAM: streamFile,
    };
    const go = (env: Record<string, string>): ScoredRecord =>
        runScored(root, { ...base, ...env }, () => undefined, recordFile).record;

    // There is nothing to continue yet.
    assert.throws(
        () => go({ SCORED_TRIALS: '1', SCORED_CONTINUE: 'true' }),
        (e: unknown) => e instanceof CommandError && /there is none/.test(e.message),
    );
    const first = go({
        SCORED_TRIALS: '1',
        FAKE_CLAUDE_APPLY: path.join(root, DEFECTS_DIR, 'reference'),
    });
    assert.deepEqual(first.results.tasks[0], {
        name: 'agent-use',
        trials: 1,
        passed: 1,
        pass_rate: 1,
    });
    const both = go({ SCORED_TRIALS: '2', SCORED_CONTINUE: 'true' });
    assert.deepEqual(
        both.results.trials.map((x) => [x.trial, x.passed]),
        [
            [1, true],
            [2, false],
            [3, false],
        ],
    );
    assert.deepEqual(both.results.tasks[0], {
        name: 'agent-use',
        trials: 3,
        passed: 1,
        pass_rate: 0.3333,
    });
    assert.match(both.command, / SCORED_CONTINUE=true task scored:agent-use$/);
    assert.equal(both.notes.length, first.notes.length + 1);
    assert.match(both.notes[both.notes.length - 1] ?? '', /^Trials 2 to 3 were added on /);
    assert.deepEqual(
        checkRecord(JSON.parse(JSON.stringify(both)) as unknown, validate, expected),
        [],
    );

    // A run made another way (here, another session limit) is never added: the record is kept.
    assert.throws(
        () => go({ SCORED_TRIALS: '1', SCORED_CONTINUE: 'true', SCORED_SESSION_LIMIT: '3' }),
        (e: unknown) =>
            e instanceof CommandError &&
            e.exitCode === 2 &&
            /\(session_limit, arguments\)/.test(e.message),
    );
    const kept = JSON.parse(readFileSync(recordFile, 'utf8')) as ScoredRecord;
    assert.equal(kept.results.trials.length, 3);
});

/**
 * The whole stream of item 6.11's first test session, as Claude Code 2.1.220 wrote it, with its
 * identifiers, folder and figures replaced: the installed Claude Code refused the pinned model
 * before any request and still ended the session with the subtype `success`.
 */
const REFUSED_MODEL_STREAM = [
    {
        type: 'system',
        subtype: 'init',
        cwd: '<trial mod>',
        session_id: '<session id>',
        tools: ['Edit', 'Read', ...SERVER_TOOLS.map((n) => `mcp__pychivalry__${n}`)],
        mcp_servers: [{ name: 'pychivalry', status: 'connected' }],
        model: PINNED_MODEL,
        permissionMode: 'dontAsk',
        slash_commands: ['debug', 'simplify', 'clear', 'compact', 'context'],
        apiKeySource: 'none',
        claude_code_version: '2.1.220',
        output_style: 'default',
        agents: ['claude', 'Explore', 'general-purpose', 'Plan', 'statusline-setup'],
        skills: ['debug', 'simplify'],
        plugins: [],
        capabilities: ['interrupt_receipt_v1', 'interrupt_cancel_queued_v1', 'msg_lifecycle_v1'],
        analytics_disabled: false,
        product_feedback_disabled: false,
        fast_mode_state: 'off',
        fast_mode_disabled_reason: 'sdk_opt_in_required',
        uuid: '<uuid>',
    },
    {
        type: 'assistant',
        message: {
            id: '<id>',
            container: null,
            model: '<synthetic>',
            role: 'assistant',
            stop_details: null,
            stop_reason: 'stop_sequence',
            stop_sequence: '',
            type: 'message',
            usage: {},
            content: [
                {
                    type: 'text',
                    text: 'API Error: 400 Claude Code 2.1.220 does not support this model; version 2.1.280 or newer is required.',
                },
            ],
            context_management: null,
        },
        parent_tool_use_id: null,
        session_id: '<session id>',
        uuid: '<uuid>',
        timestamp: '2026-11-23T00:00:00.000Z',
        error: 'unknown',
        request_id: '<request id>',
        is_api_error_message: true,
    },
    {
        is_error: true,
        duration_api_ms: 0,
        num_turns: 1,
        stop_reason: 'stop_sequence',
        session_id: '<session id>',
        total_cost_usd: 0,
        usage: {},
        modelUsage: {},
        permission_denials: [],
        terminal_reason: 'api_error',
        fast_mode_state: 'off',
        fast_mode_disabled_reason: 'sdk_opt_in_required',
        subtype: 'success',
        api_error_status: 400,
        result: 'API Error: 400 Claude Code 2.1.220 does not support this model; version 2.1.280 or newer is required.',
        type: 'result',
        duration_ms: 267,
        uuid: '<uuid>',
    },
]
    .map((e) => JSON.stringify(e))
    .join('\n');

test('a session that never reached the model ends on an error, though its subtype is success', (t) => {
    const summary = readStream(REFUSED_MODEL_STREAM);
    assert.equal(summary.result?.subtype, 'success');
    assert.equal(summary.result.isError, true);
    assert.equal(summary.result.terminalReason, 'api_error');
    assert.equal(summary.result.apiErrorStatus, 400);
    assert.match(summary.result.errorText ?? '', /does not support this model/);
    assert.deepEqual(summary.toolCalls, []);
    assert.equal(summary.unreadLines, 0);

    const { record, log } = run(t, { SCORED_TRIALS: '1' }, REFUSED_MODEL_STREAM);
    const trial = record.results.trials[0];
    assert.equal(trial?.stopped, 'error');
    assert.equal(trial.passed, false);
    assert.deepEqual(trial.harness_problems, [
        'the session ended on an error (success, api_error, status 400)',
        'skills were offered: debug, simplify',
    ]);
    assert.deepEqual(trial.session?.skills, ['debug', 'simplify']);
    assert.deepEqual(trial.session.plugins, []);
    // The error's words reach the person running the test, never the record.
    assert.ok(log.some((l) => /trial 1: the session's error: API Error: 400/.test(l)));
    assert.ok(!JSON.stringify(record).includes('does not support'));
});
