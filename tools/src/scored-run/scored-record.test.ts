/**
 * A scored run's record (docs/PLAN.md item 6.10) as `task records:check` checks it: valid
 * against the schema, not tied to the committed spec, and agreeing with itself.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { checkRecord, compileRecordSchema } from '../records-check.js';
import { repoRoot } from '../util.js';
import { GRADERS } from './graders.js';
import {
    passRate,
    RELEASE_TRIALS,
    scoredProblems,
    targetOf,
    targetText,
    type ScoredRecord,
    type TrialRecord,
} from './scored-record.js';

const validate = compileRecordSchema(path.join(repoRoot(), 'records', 'record.schema.json'));
const expected = {
    spec: { version: '1.21.0.3', sha256: 'a'.repeat(64) },
    corpusManifestSha256: undefined,
};

function trial(n: number, passed: boolean): TrialRecord {
    return {
        task: 'agent-use',
        trial: n,
        passed,
        stopped: passed ? 'finished' : 'session-limit',
        harness_problems: [],
        graders: GRADERS.map((name) => ({
            name,
            passed: passed || name !== 'zero-errors',
            problems:
                passed || name !== 'zero-errors'
                    ? []
                    : ['events/x.txt:3 error names/unknown-trigger'],
        })),
        tool_calls: [{ tool: 'mcp__pychivalry__check', calls: 3, errors: 0 }],
        tool_errors: [],
        permission_denials: 0,
        session: {
            harness_version: '2.1.220',
            model: 'claude-opus-5-5',
            permission_mode: 'dontAsk',
            tools: ['Edit', 'Read', 'mcp__pychivalry__check'],
            mcp_servers: [{ name: 'pychivalry', status: 'connected' }],
            skills: [],
            plugins: [],
        },
        turns: 12,
        duration_ms: 60000,
        exit_code: 0,
        findings_left: { error: passed ? 0 : 1, warning: 0, information: 0, hint: 0 },
    };
}

function record(): ScoredRecord {
    const trials = [trial(1, true), trial(2, false)];
    return {
        record_format: 1,
        suite: 'scored:agent-use',
        command:
            'SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=2 SCORED_SESSION_LIMIT=3 task scored:agent-use',
        made_at: '2026-11-23T12:00:00.000Z',
        tool: { name: 'pychivalry', version: '0.0.0', commit: 'c'.repeat(40), dirty: false },
        machine: { os: 'linux', arch: 'x64', logical_cpus: 16, memory_gib: 62, node: 'v22.23.4' },
        game: {
            build: '1.21.0.3',
            manifest_sha256: 'd'.repeat(64),
            files: 3,
            content_hashed_files: 2,
        },
        // Another spec than the committed one: a scored record is not failed by it.
        spec: { version: '1.21.0.2', sha256: 'e'.repeat(64), package_format: 7 },
        corpus: null,
        notes: ['A note.'],
        results: {
            task: {
                name: 'agent-use',
                prompt_file: 'tools/scored-run/agent-use.prompt.md',
                prompt_sha256: 'f'.repeat(64),
                manifest_sha256: '1'.repeat(64),
                fixture: 'fixtures/defects',
                game: 'fixtures/game/planted-defects/game',
                defects: 27,
                look_alikes: 10,
                graders: [...GRADERS],
            },
            harness: { name: 'claude-code', version: '2.1.220' },
            model: 'claude-opus-5-5',
            session_limit: 3,
            timeout_minutes: 30,
            arguments: ['-p', '<tools/scored-run/agent-use.prompt.md>'],
            server: { entry: 'packages/mcp/dist/main.js', arguments: ['<trial mod>'] },
            trials,
            tasks: [
                {
                    name: 'agent-use',
                    trials: 2,
                    passed: 1,
                    pass_rate: 0.5,
                    target: { run: 'development', needs: 2, met: false },
                },
            ],
        },
    };
}

/** A copy of the record as plain JSON, to be changed by a test. */
function plain(): Record<string, unknown> & { results: Record<string, unknown> } {
    return JSON.parse(JSON.stringify(record())) as Record<string, unknown> & {
        results: Record<string, unknown>;
    };
}

test('a scored record is valid, and another spec does not fail it', () => {
    assert.deepEqual(checkRecord(plain(), validate, expected), []);
});

test('a scored record that disagrees with itself fails', () => {
    const r = plain();
    const results = r.results as unknown as {
        trials: { passed: boolean; graders: { name: string; passed: boolean }[]; trial: number }[];
        tasks: { passed: number; pass_rate: number }[];
    };
    const second = results.trials[1];
    assert.ok(second !== undefined);
    second.passed = true;
    second.trial = 5;
    const task = results.tasks[0];
    assert.ok(task !== undefined);
    task.pass_rate = 0.4;
    assert.deepEqual(scoredProblems(r.results), [
        '/results/trials/1/passed: true, but its graders and harness problems say false',
        '/results/trials/1/trial: 5 is not 2',
        '/results/tasks/0/passed: 1, but 2 trials passed',
        '/results/tasks/0/pass_rate: 0.4 is not 2 / 2 (1)',
        '/results/tasks/0/target: {"run":"development","needs":2,"met":false}, but 2 of 2 trials passed: {"run":"development","needs":2,"met":true}',
    ]);
});

test('the target: every test session passes; 10 of 10 is a release run, 5 a development run', () => {
    // docs/decisions.md, decision 82: a release run of 10 test sessions must pass all 10; a
    // development run of 5 that passes fewer than 5 is looked into.
    assert.equal(RELEASE_TRIALS, 10);
    assert.deepEqual(targetOf(10, 10), { run: 'release', needs: 10, met: true });
    assert.deepEqual(targetOf(9, 10), { run: 'release', needs: 10, met: false });
    assert.deepEqual(targetOf(5, 5), { run: 'development', needs: 5, met: true });
    assert.deepEqual(targetOf(4, 5), { run: 'development', needs: 5, met: false });
    assert.deepEqual(targetOf(0, 0), { run: 'development', needs: 0, met: false });
    assert.match(targetText(targetOf(9, 10), 9), /release target .*10 of 10.*: not met/);
    assert.match(targetText(targetOf(4, 5), 4), /development target .*4 of 5, not met/);
});

test('a record made before the target was set has none, and is valid', () => {
    // Item 6.11's record (records/scored/agent-use.json) states no target.
    const r = plain();
    delete (r.results as unknown as { tasks: Record<string, unknown>[] }).tasks[0]?.['target'];
    assert.deepEqual(checkRecord(r, validate, expected), []);
});

test('a grader missing, or passing with problems, fails', () => {
    const r = plain();
    const trials = (r.results as unknown as { trials: { graders: { passed: boolean }[] }[] })
        .trials;
    trials[0]?.graders.pop();
    const g = trials[1]?.graders[0];
    assert.ok(g !== undefined);
    g.passed = true;
    const problems = scoredProblems(r.results);
    assert.ok(problems.some((p) => p.startsWith('/results/trials/0/graders: ')));
    assert.ok(problems.includes('/results/trials/1/graders/0/passed: true with 1 problems'));
});

test('the schema refuses an alias for the model and an unknown field', () => {
    const r = plain();
    (r.results as { model: string }).model = 'opus';
    r.results['extra'] = 1;
    const problems = checkRecord(r, validate, expected);
    assert.ok(problems.some((p) => p.includes('/results/model')));
    assert.ok(problems.some((p) => p.includes('(extra)')));
});

test('the schema requires the session limit each test session was given', () => {
    const r = plain();
    delete r.results['session_limit'];
    assert.ok(checkRecord(r, validate, expected).some((p) => p.includes('session_limit')));
});

test('the pass rate is passed over trials, to 4 places', () => {
    assert.equal(passRate(2, 3), 0.6667);
    assert.equal(passRate(0, 0), 0);
    assert.equal(passRate(5, 5), 1);
});
