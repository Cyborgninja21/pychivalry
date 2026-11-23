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
    PINNED_MODEL,
    PROMPT_FILE,
    runScored,
    sanitize,
    scoredOptions,
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
                'mcp__pychivalry__check',
                'mcp__pychivalry__lookup',
            ],
            mcp_servers: options.servers ?? [{ name: 'pychivalry', status: 'connected' }],
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

function run(t: TestContext, env: Record<string, string>, streamText = stream({})): Run {
    const dir = tempDir(t);
    const streamFile = path.join(dir, 'stream.jsonl');
    writeFileSync(streamFile, streamText);
    const argvFile = path.join(dir, 'argv.jsonl');
    const log: string[] = [];
    const { record } = runScored(
        root,
        {
            SCORED_BUDGET_USD: '2',
            SCORED_TRIALS: '2',
            SCORED_CLAUDE: fake,
            SCORED_SERVER: fake,
            FAKE_CLAUDE_STREAM: streamFile,
            FAKE_CLAUDE_ARGV: argvFile,
            ANTHROPIC_API_KEY: 'must-not-reach-the-session',
            CLAUDECODE: '1',
            CLAUDE_CODE_SESSION_ID: 'a-surrounding-session',
            CLAUDE_EFFORT: 'low',
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
    assert.equal(results.cost_usd, 0.84);
    assert.equal(record.corpus, null);
    assert.match(
        record.command,
        /^SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=2 SCORED_BUDGET_USD=2 SCORED_SERVER=\S+ task scored:agent-use$/,
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
    // Nothing from the session's start but what the record names: no folder, id or login.
    const text = JSON.stringify(record);
    for (const kept of ['/somewhere/private', 'not-kept', 'apiKeySource', 'must-not-reach']) {
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
            claudeArgs({ model: PINNED_MODEL, budgetUsd: 2 }, prompt, configFile),
        );
        assert.equal(call['git'], false);
        assert.equal(call['api_key'], false);
        assert.deepEqual(call['session_variables'], []);
        assert.equal(call['claude_ai_servers'], 'false');
        assert.equal(call['auto_memory_off'], '1');
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

test('a trial stopped at its budget is recorded as such, not as a harness problem', (t) => {
    const { record } = run(t, { SCORED_TRIALS: '1' }, stream({ subtype: 'error_max_budget_usd' }));
    assert.equal(record.results.trials[0]?.stopped, 'budget');
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

test('the parameters: a budget is required, a model is a full name, defaults hold', () => {
    const usage = (env: Record<string, string>): void => {
        assert.throws(
            () => scoredOptions(root, env),
            (e: unknown) => e instanceof CommandError && e.exitCode === 2,
        );
    };
    usage({});
    usage({ SCORED_BUDGET_USD: '0' });
    usage({ SCORED_BUDGET_USD: 'two' });
    usage({ SCORED_BUDGET_USD: '2', SCORED_MODEL: 'opus' });
    usage({ SCORED_BUDGET_USD: '2', SCORED_TRIALS: '1.5' });
    usage({ SCORED_BUDGET_USD: '2', SCORED_SERVER_ARGS: '--mod' });
    const options = scoredOptions(root, { SCORED_BUDGET_USD: '2.5' });
    assert.equal(options.model, PINNED_MODEL);
    assert.equal(options.trials, 5);
    assert.equal(options.budgetUsd, 2.5);
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
                { SCORED_BUDGET_USD: '1', SCORED_CLAUDE: fake, SCORED_SERVER: 'no/such/main.js' },
                () => undefined,
            ),
        /the agent server is not built: no\/such\/main\.js/,
    );
});

test('the flags of the plan, as the installed Claude Code takes them', () => {
    assert.deepEqual(
        claudeArgs({ model: 'claude-test-1', budgetUsd: 1.5 }, 'Fix it.', 'mcp.json'),
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
