/**
 * The scored authoring run (docs/PLAN.md item 9.5), driven against a stand-in for Claude Code
 * (`fake-claude.ts`): an authoring session that writes a request's example result (or nothing),
 * then a judge's session that answers from a stream written here. No model, key, network or
 * display.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { toolInfo } from '../record.js';
import { checkRecord, compileRecordSchema } from '../records-check.js';
import { fixtureGame, tempDir, writeTree } from '../testing.js';
import { CommandError } from '../util.js';
import { authoringProblems, type AuthoringRecord } from './authoring-record.js';
import { callsOutside } from './confinement.js';
import { readStream } from './stream.js';
import {
    authoringArgs,
    authoringOptions,
    authoringRecordFile,
    AUTHORING_PROMPT_FILE,
    AUTHORING_TOOLS,
    NOT_HELD_NOTE,
    PROJECT_SKILLS,
    runAuthoring,
    skillsIn,
    validityOf,
} from './authoring.js';
import {
    authoringStream,
    emptyGame,
    exampleDir,
    judgeAnswer,
    judgeStream,
    root,
    SKILL_NAME,
    skillsFolder,
    textFile,
} from './authoring-testing.js';
import { committedRequests, type ContentRequest } from './requests.js';
import {
    PINNED_JUDGE_MODEL,
    PINNED_MODEL,
    SERVER_SCHEMA_VERSION,
    SESSION_LIMIT_OPTION,
} from './run.js';

const fake = fileURLToPath(new URL('./fake-claude.js', import.meta.url));
const validate = compileRecordSchema(path.join(root, 'records', 'record.schema.json'));
const expected = {
    spec: { version: '0', sha256: '0'.repeat(64) },
    corpusManifestSha256: undefined,
};
const list = committedRequests(root);

function request(id: string): ContentRequest {
    const found = list.requests.find((r) => r.id === id);
    assert.ok(found !== undefined, id);
    return found;
}

/** Variables that may hold a credential, set around every run: none may reach a session. */
const CREDENTIALS = {
    ANTHROPIC_API_KEY: 'must-not-reach-the-session',
    CLAUDE_CODE_OAUTH_TOKEN: 'must-not-reach-the-session',
    GITHUB_TOKEN: 'must-not-reach-the-session',
};

interface Run {
    readonly record: AuthoringRecord;
    readonly calls: Record<string, unknown>[];
    readonly log: string[];
    readonly file: string;
    readonly stopped: string | null;
    readonly short: readonly { readonly request: string; readonly held: number }[];
}

function run(
    t: TestContext,
    env: Record<string, string>,
    streams: {
        readonly authoring?: string;
        readonly judge?: string;
        /** Streams for some trials, by their folder (`<request>-<n>`), instead of `authoring`. */
        readonly trials?: Readonly<Record<string, string>>;
    } = {},
    recordFile = path.join(tempDir(t), 'authoring.json'),
    build?: Parameters<typeof runAuthoring>[4],
): Run {
    const dir = tempDir(t);
    const argvFile = path.join(dir, 'argv.jsonl');
    const log: string[] = [];
    const own =
        streams.trials === undefined
            ? {}
            : {
                  FAKE_CLAUDE_STREAMS: textFile(
                      t,
                      'streams.json',
                      JSON.stringify(
                          Object.fromEntries(
                              Object.entries(streams.trials).map(([trial, text]) => [
                                  trial,
                                  textFile(t, `${trial}.jsonl`, text),
                              ]),
                          ),
                      ),
                  ),
              };
    const { record, stopped, short } = runAuthoring(
        root,
        {
            SCORED_SESSION_LIMIT: '2',
            SCORED_TRIALS: '1',
            SCORED_CLAUDE: fake,
            SCORED_SERVER: fake,
            SCORED_SKILLS: skillsFolder(t),
            CK3_GAME_PATH: emptyGame(t),
            FAKE_CLAUDE_STREAM: textFile(t, 'stream.jsonl', streams.authoring ?? authoringStream()),
            FAKE_CLAUDE_JUDGE_STREAM: textFile(
                t,
                'judge.jsonl',
                streams.judge ?? judgeStream('{}'),
            ),
            FAKE_CLAUDE_ARGV: argvFile,
            ...own,
            ...CREDENTIALS,
            CLAUDECODE: '1',
            MCP_CONNECTION_NONBLOCKING: 'true',
            ...env,
        },
        (line) => log.push(line),
        recordFile,
        build,
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
    return { record, calls, log, file: recordFile, stopped, short };
}

test('a trial whose session writes a correct result: valid, every expectation met, the judge answered; the record holds', (t) => {
    const r = request('effect-war-chest');
    const { record, calls, log } = run(
        t,
        { SCORED_REQUESTS: r.id, FAKE_CLAUDE_APPLY: exampleDir(r.id) },
        { judge: judgeStream(judgeAnswer(r, 'yes')) },
    );
    const results = record.results;
    assert.equal(record.suite, 'scored:authoring');
    assert.equal(results.harness.version, '2.1.330');
    assert.equal(results.model, PINNED_MODEL);
    assert.equal(results.judge_model, PINNED_JUDGE_MODEL);
    assert.equal(results.session_limit, 2);
    assert.equal(results.judge_session_limit, 2);
    assert.deepEqual(
        results.task.skills.map((s) => s.name),
        [SKILL_NAME],
    );
    assert.deepEqual(results.task.answers, ['yes', 'no', 'cannot-tell']);
    assert.match(
        record.command,
        /^SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=1 SCORED_SESSION_LIMIT=2 SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_REQUESTS=effect-war-chest SCORED_SKILLS=<skills folder> SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring$/,
    );
    const [trial] = results.trials;
    assert.ok(trial !== undefined);
    assert.equal(trial.task, r.id);
    assert.equal(trial.content_type, 'scripted_effect');
    assert.equal(trial.difficulty, 'medium');
    assert.equal(trial.trial, 1);
    assert.deepEqual(trial.harness_problems, []);
    assert.equal(trial.harness_held, true);
    assert.equal(trial.stopped, 'finished');
    assert.deepEqual(trial.validity, {
        errors: 0,
        warnings: 0,
        information: 0,
        hints: 0,
        zero_errors: true,
        no_warnings: true,
        in_format: true,
        by_code: [],
    });
    assert.equal(trial.expectations_met, true);
    assert.equal(trial.expectations.length, r.expect.length);
    assert.deepEqual(trial.judge.state, 'answered');
    assert.deepEqual(
        trial.judge.answers,
        r.judged.map((q) => ({ dimension: q.dimension, answer: 'yes' })),
    );
    // Claude Code's own skill is offered beside the pychivalry one, and recorded.
    assert.deepEqual(trial.session?.skills, [SKILL_NAME, 'simplify']);
    assert.deepEqual(results.tasks, [
        {
            name: r.id,
            content_type: 'scripted_effect',
            difficulty: 'medium',
            trials: 1,
            harness_held: 1,
            zero_errors: 1,
            no_warnings: 1,
            in_format: 1,
            expectations_met: 1,
            judged: r.judged.map((q) => ({
                dimension: q.dimension,
                yes: 1,
                no: 0,
                cannot_tell: 0,
                unanswered: 0,
            })),
        },
    ]);
    assert.deepEqual(authoringProblems(results), []);
    // The judge's reasons reach the person running the test, never the record.
    assert.ok(
        log.some((l) => l.includes('judge on conditions-as-asked: yes: Because the files say so.')),
    );
    assert.ok(!JSON.stringify(record).includes('Because the files say so'));
    for (const kept of ['/somewhere/private', 'must-not-reach', 'session id']) {
        assert.ok(!JSON.stringify(record).includes(kept), kept);
    }
    // The run ends by reading the owner's targets from its measures; the record holds none.
    assert.ok(
        log.includes(
            "scored:authoring: the owner's targets (docs/decisions.md, decision 127), which hold before any release; a development run (1 trial of each request; a run before a release has 10 of each):",
        ),
        log.join('\n'),
    );
    assert.ok(
        log.includes(
            'scored:authoring:   every result with no error: no error 1 of 1 (100%); needs 100%: met',
        ),
    );
    assert.equal(log.at(-1), 'scored:authoring: every target met');
    assert.doesNotMatch(JSON.stringify(record), /"targets?":/);
    assert.match(
        record.notes.join(' '),
        /The record states measures only: the owner's targets \(docs\/decisions\.md, decision 127\)/,
    );

    // Two sessions: the authoring one, then the judge's.
    assert.equal(calls.length, 2);
    const [authoring, judge] = calls;
    assert.ok(authoring !== undefined && judge !== undefined);
    const argv = authoring['argv'] as string[];
    const prompt = readFileSync(path.join(root, AUTHORING_PROMPT_FILE), 'utf8')
        .replace('{{request}}', r.request)
        .trim();
    assert.deepEqual(
        argv,
        authoringArgs(
            { model: PINNED_MODEL, sessionLimit: 2, skillPlace: 'project' },
            prompt,
            argv[argv.indexOf('--mcp-config') + 1] ?? '',
        ),
    );
    assert.deepEqual(authoring['credential_variables'], []);
    assert.deepEqual(authoring['session_variables'], []);
    assert.equal(authoring['mcp_nonblocking'], '0');
    assert.equal(authoring['git'], false);
    const cwd = authoring['cwd'] as string;
    // The skills were in the trial's mod, where Claude Code finds a project's skills, and in no
    // configuration folder of the run's.
    assert.deepEqual(authoring['skills'], { project: ['write-content'], config: [] });
    assert.ok(cwd.endsWith(`${r.id}-1${path.sep}mod`), cwd);
    const config = authoring['mcp_config'] as { mcpServers: Record<string, { args: string[] }> };
    assert.deepEqual(Object.keys(config.mcpServers), ['pychivalry']);
    // The judge: its own empty folder, its prompt on standard input, no configuration.
    assert.equal(judge['mcp_config'], null);
    assert.deepEqual(judge['credential_variables'], []);
    assert.ok((judge['cwd'] as string).endsWith(`${r.id}-1${path.sep}judge`));
    const stdin = judge['stdin'] as string;
    assert.ok(stdin.includes(`<request id="${r.id}">`));
    assert.ok(
        stdin.includes(
            '--- file common/scripted_effects/authoring_war_chest_effects.txt (written while the request was worked on) ---',
        ),
    );
    assert.ok(!stdin.includes(PROJECT_SKILLS), 'the skills are not shown to the judge');
    // With the material from the installed game: the checker's report over it, and the game's
    // own description of every keyword the result writes (judge prompt version 2).
    assert.ok(
        stdin.includes(
            "<checker>\npychivalry's checker, over the installed game (version 1.21.0.3), reports no error and no warning in this result.\n</checker>",
        ),
    );
    assert.ok(
        stdin.includes(
            "<keywords>\nThe game's own description (version 1.21.0.3) of each trigger, effect, iterator and link the result's script files write:\n- ",
        ),
    );
    assert.match(
        stdin,
        /\n- add_gold: an effect; supported scopes: character; the game's description: "/,
    );
    assert.equal((judge['argv'] as string[])[0], '-p');
});

test('a session that writes nothing: no error, but its expectations are not met, and a malformed judge is recorded as such', (t) => {
    const r = request('trigger-can-host');
    const { record } = run(
        t,
        { SCORED_REQUESTS: r.id },
        { judge: judgeStream('The trigger is fine.') },
    );
    const [trial] = record.results.trials;
    assert.ok(trial !== undefined);
    assert.equal(trial.harness_held, true);
    assert.equal(trial.validity.zero_errors, true);
    assert.equal(trial.expectations_met, false);
    assert.equal(
        trial.expectations[1]?.problem,
        'the mod does not define authoring_can_host_trigger in common/scripted_triggers',
    );
    assert.deepEqual(
        { state: trial.judge.state, why: trial.judge.why, answers: trial.judge.answers },
        { state: 'malformed', why: 'the answer is not one JSON object', answers: [] },
    );
    const [task] = record.results.tasks;
    assert.deepEqual(
        task?.judged,
        r.judged.map((q) => ({
            dimension: q.dimension,
            yes: 0,
            no: 0,
            cannot_tell: 0,
            unanswered: 1,
        })),
    );
    assert.equal(task.expectations_met, 0);
    assert.equal(task.zero_errors, 1);
});

test('a result with errors and a file out of the format is measured three ways', (t) => {
    const r = request('effect-reward');
    const dir = tempDir(t);
    // A misspelled effect, written with \n line breaks and no byte-order mark.
    const result = path.join(dir, 'result', 'common', 'scripted_effects');
    mkdirSync(result, { recursive: true });
    writeFileSync(
        path.join(result, 'authoring_reward_effects.txt'),
        'authoring_reward_effect = {\n    add_gold = 50\n    add_prestiege = 25\n}\n',
    );
    const { record, log } = run(
        t,
        { SCORED_REQUESTS: r.id, FAKE_CLAUDE_APPLY: path.join(dir, 'result') },
        { judge: judgeStream(judgeAnswer(r, ['no', 'cannot-tell'])) },
    );
    const [trial] = record.results.trials;
    assert.ok(trial !== undefined);
    assert.equal(trial.validity.zero_errors, false);
    assert.equal(trial.validity.in_format, false);
    assert.ok(
        trial.validity.by_code.some(
            (c) => c.code === 'names/unknown-effect' && c.severity === 'error',
        ),
    );
    assert.ok(
        trial.validity.by_code.some(
            (c) => c.code === 'style/not-formatted' && c.severity === 'warning',
        ),
    );
    assert.equal(
        trial.expectations.find((e) => e.expectation.endsWith('uses add_prestige'))?.met,
        false,
    );
    assert.deepEqual(record.results.tasks[0]?.judged, [
        { dimension: 'effects-as-asked', yes: 0, no: 1, cannot_tell: 0, unanswered: 0 },
        { dimension: 'nothing-unasked', yes: 0, no: 0, cannot_tell: 1, unanswered: 0 },
    ]);
    // Read against the owner's targets, it meets none of them.
    assert.ok(
        log.includes(
            'scored:authoring:   no judged dimension below 95% yes: effects-as-asked 0 of 1 (0%), nothing-unasked 0 of 1 (0%); needs 95%: not met',
        ),
        log.join('\n'),
    );
    assert.equal(log.at(-1), 'scored:authoring: 4 of 4 targets not met');
});

test('a session not confined stops the run after its trial, and the record says why', (t) => {
    const { record, log, calls } = run(
        t,
        { SCORED_REQUESTS: 'effect-reward,effect-war-chest', SCORED_TRIALS: '2' },
        {
            authoring: authoringStream({
                tools: [...AUTHORING_TOOLS, 'Bash'],
                skills: ['simplify'],
                files: ['/somewhere/private/outside.txt'],
            }),
        },
    );
    assert.equal(record.results.trials.length, 1);
    const [trial] = record.results.trials;
    assert.ok(trial !== undefined);
    assert.equal(trial.harness_held, false);
    assert.deepEqual(trial.harness_problems, [
        'tools outside the confinement were offered: Bash',
        `the pychivalry skills were not offered: ${SKILL_NAME}`,
        "the agent server's tools were not offered: apply_format, check, explain_code, find_definition, find_references, format, list_definitions, lookup, source",
        'the session named files outside its mod (2 calls of Write, Read)',
    ]);
    // No judge was asked: only the authoring session started.
    assert.equal(calls.length, 1);
    assert.equal(trial.judge.state, 'not-judged');
    assert.equal(trial.judge.why, "the authoring session's harness did not hold");
    assert.ok(log.some((l) => l.includes('stopped after effect-reward trial 1')));
    assert.ok(!JSON.stringify(record).includes('/somewhere/private'));
    assert.equal(record.results.overall.harness_held, 0);
});

test("a judge's session not confined is a harness problem of its trial, and stops the run", (t) => {
    const r = request('effect-reward');
    const { record } = run(
        t,
        { SCORED_REQUESTS: r.id, SCORED_TRIALS: '3', FAKE_CLAUDE_APPLY: exampleDir(r.id) },
        { judge: judgeStream(judgeAnswer(r, 'yes'), { tools: ['Read'] }) },
    );
    assert.equal(record.results.trials.length, 1);
    const [trial] = record.results.trials;
    assert.ok(trial !== undefined);
    assert.deepEqual(trial.harness_problems, []);
    assert.deepEqual(trial.judge.harness_problems, [
        'tools outside the confinement were offered: Read',
    ]);
    assert.equal(trial.harness_held, false);
    assert.equal(trial.judge.state, 'not-judged');
});

test('a continued run brings each request up to its trials, numbered after its own, and only a record made the same way', (t) => {
    const recordFile = path.join(tempDir(t), 'authoring.json');
    const r = request('effect-reward');
    const env = { FAKE_CLAUDE_APPLY: exampleDir(r.id) };
    const streams = { judge: judgeStream(judgeAnswer(r, 'yes')) };
    assert.throws(
        () =>
            run(t, { ...env, SCORED_REQUESTS: r.id, SCORED_CONTINUE: 'true' }, streams, recordFile),
        (e: unknown) => e instanceof CommandError && /there is none/.test(e.message),
    );
    const first = run(t, { ...env, SCORED_REQUESTS: r.id }, streams, recordFile);
    assert.equal(first.record.results.trials.length, 1);
    const both = run(
        t,
        {
            ...env,
            SCORED_REQUESTS: 'effect-reward,trigger-can-host',
            SCORED_TRIALS: '2',
            SCORED_CONTINUE: 'true',
        },
        streams,
        recordFile,
    );
    assert.deepEqual(
        both.record.results.trials.map((x) => `${x.task} ${String(x.trial)}`),
        ['effect-reward 1', 'effect-reward 2', 'trigger-can-host 1', 'trigger-can-host 2'],
    );
    assert.equal(both.record.notes.length, first.record.notes.length + 1);
    assert.match(both.record.notes.at(-1) ?? '', /^Trials were added on /);
    // Already full: nothing more is run.
    const again = run(
        t,
        { ...env, SCORED_REQUESTS: r.id, SCORED_TRIALS: '2', SCORED_CONTINUE: 'true' },
        streams,
        recordFile,
    );
    assert.equal(again.calls.length, 0);
    assert.equal(again.record.results.trials.length, 4);
    // Made another way: refused, and the record kept.
    assert.throws(
        () =>
            run(
                t,
                { ...env, SCORED_CONTINUE: 'true', SCORED_JUDGE_SESSION_LIMIT: '1' },
                streams,
                recordFile,
            ),
        (e: unknown) =>
            e instanceof CommandError && /\(judge_session_limit, judge_arguments\)/.test(e.message),
    );
    const kept = JSON.parse(readFileSync(recordFile, 'utf8')) as AuthoringRecord;
    assert.equal(kept.results.trials.length, 4);
    // The record names the agent server's tool schema its sessions were given; one made before
    // records named it (every committed record) was given another server: refused, kept.
    assert.equal(kept.results.server.schema_version, SERVER_SCHEMA_VERSION);
    const unnamed = { entry: kept.results.server.entry, arguments: kept.results.server.arguments };
    writeFileSync(
        recordFile,
        `${JSON.stringify({ ...kept, results: { ...kept.results, server: unnamed } }, null, 4)}\n`,
    );
    assert.throws(
        () => run(t, { ...env, SCORED_CONTINUE: 'true', SCORED_TRIALS: '3' }, streams, recordFile),
        (e: unknown) => e instanceof CommandError && /\(server\)/.test(e.message),
    );
});

/**
 * A session that ran to its end and named a game file it had been shown, outside its mod: the
 * fourth trial of `event-county-unrest` in the expert requests' development run did so.
 */
const STRAYED = authoringStream({
    read: '../game/common/casus_belli_types/00_peasant_war_new.txt',
});
/** A session that ended on an error. */
const BROKE = authoringStream({ subtype: 'error_during_execution' });

test('a trial that names a file outside its mod does not stop the run: recorded as not held with its reason, graded and judged, and the run carries on', (t) => {
    const r = request('event-county-unrest');
    const { record, calls, log, stopped, short } = run(
        t,
        { SCORED_REQUESTS: r.id, SCORED_TRIALS: '3', FAKE_CLAUDE_APPLY: exampleDir(r.id) },
        { judge: judgeStream(judgeAnswer(r, 'yes')), trials: { [`${r.id}-2`]: STRAYED } },
    );
    assert.deepEqual(
        record.results.trials.map((x) => [x.trial, x.harness_held]),
        [
            [1, true],
            [2, false],
            [3, true],
        ],
    );
    const strayed = record.results.trials[1];
    assert.ok(strayed !== undefined);
    assert.deepEqual(strayed.harness_problems, [
        'the session named files outside its mod (1 calls of Read)',
    ]);
    // Graded and judged like any other result: it says what it is, and is not counted.
    assert.equal(strayed.stopped, 'finished');
    assert.equal(strayed.expectations_met, true);
    assert.equal(strayed.judge.state, 'answered');
    assert.equal(calls.length, 6);
    assert.equal(record.results.overall.trials, 3);
    assert.equal(record.results.overall.harness_held, 2);
    assert.equal(stopped, null);
    assert.deepEqual(short, [{ request: r.id, held: 2 }]);
    assert.ok(
        log.includes(
            `${r.id} trial 2: Read of ../game/common/casus_belli_types/00_peasant_war_new.txt`,
        ),
        log.join('\n'),
    );
    assert.ok(
        log.includes(
            `scored:authoring: ${r.id} trial 2 did not hold, and the run carries on: it is never counted as a success, and a run continuing the record (SCORED_CONTINUE=true) tries ${r.id} again`,
        ),
    );
    assert.ok(
        log.includes(
            `scored:authoring: requests short of 3 trials whose harness held: ${r.id} (2 held); SCORED_CONTINUE=true tops them up`,
        ),
    );
    assert.ok(log.some((l) => l.startsWith('scored:authoring: 1 of the 3 trials did not hold.')));
    assert.deepEqual(record.notes.slice(-1), [NOT_HELD_NOTE]);
});

test('the run stops after its first trial when a session of it broke, and after three trials in a row that did not hold, and only then', (t) => {
    const r = request('effect-reward');
    const env = { SCORED_REQUESTS: r.id, FAKE_CLAUDE_APPLY: exampleDir(r.id) };
    const judge = judgeStream(judgeAnswer(r, 'yes'));
    const first = run(t, { ...env, SCORED_TRIALS: '3' }, { authoring: BROKE, judge });
    const [broken] = first.record.results.trials;
    assert.ok(broken !== undefined && first.record.results.trials.length === 1);
    assert.equal(broken.stopped, 'error');
    assert.equal(broken.judge.state, 'not-judged');
    assert.match(
        first.stopped ?? '',
        /^effect-reward trial 1: it was the run's first trial and a session of it broke/,
    );
    // A later trial that broke, alone, does not.
    const later = run(
        t,
        { ...env, SCORED_TRIALS: '3' },
        { judge, trials: { [`${r.id}-2`]: BROKE } },
    );
    assert.equal(later.record.results.trials.length, 3);
    assert.equal(later.stopped, null);
    // Three in a row, whatever their reasons, do.
    const row = run(
        t,
        { ...env, SCORED_TRIALS: '5' },
        {
            judge,
            trials: {
                [`${r.id}-2`]: STRAYED,
                [`${r.id}-3`]: BROKE,
                [`${r.id}-4`]: STRAYED,
            },
        },
    );
    assert.equal(row.record.results.trials.length, 4);
    assert.match(row.stopped ?? '', /^effect-reward trial 4: it ended 3 trials in a row/);
    assert.ok(
        row.log.some((l) => l.startsWith('scored:authoring: stopped after effect-reward trial 4,')),
    );
});

test('a continued run from a record ending on a trial that did not hold tops each request up: that request is tried again, numbered after it, then the requests not yet run', (t) => {
    // The expert requests' development run stopped after event-county-unrest trial 4, whose
    // session named a file outside its mod, with nine requests not yet run. Here: two trials of
    // one request, the second not holding, and a request not yet run, of the same questions.
    const recordFile = path.join(tempDir(t), 'authoring.json');
    const a = request('event-county-unrest');
    const b = request('decision-pardon-prisoners');
    assert.deepEqual(
        a.judged.map((q) => q.dimension),
        b.judged.map((q) => q.dimension),
    );
    const env = { FAKE_CLAUDE_APPLY: exampleDir(a.id) };
    const judge = judgeStream(judgeAnswer(a, 'yes'));
    const first = run(
        t,
        { ...env, SCORED_REQUESTS: a.id, SCORED_TRIALS: '2' },
        { judge, trials: { [`${a.id}-2`]: STRAYED } },
        recordFile,
    );
    assert.deepEqual(first.short, [{ request: a.id, held: 1 }]);
    const both = run(
        t,
        { ...env, SCORED_REQUESTS: `${a.id},${b.id}`, SCORED_TRIALS: '2', SCORED_CONTINUE: 'true' },
        { judge },
        recordFile,
    );
    assert.deepEqual(
        both.record.results.trials.map(
            (x) => `${x.task} ${String(x.trial)}${x.harness_held ? '' : ' (not held)'}`,
        ),
        [`${a.id} 1`, `${a.id} 2 (not held)`, `${a.id} 3`, `${b.id} 1`, `${b.id} 2`],
    );
    // One trial of a, two of b: three authoring sessions and three judges.
    assert.equal(both.calls.length, 6);
    assert.equal(both.stopped, null);
    assert.deepEqual(both.short, []);
    assert.ok(
        both.log.includes(
            `scored:authoring: requests tried again for a trial of the record that did not hold: ${a.id} (from trial 3)`,
        ),
    );
    // A continued run's first trial straying again does not stop it: only a first trial that
    // broke does.
    const again = run(
        t,
        { ...env, SCORED_REQUESTS: a.id, SCORED_TRIALS: '4', SCORED_CONTINUE: 'true' },
        { judge, trials: { [`${a.id}-4`]: STRAYED } },
        recordFile,
    );
    assert.deepEqual(
        again.record.results.trials
            .filter((x) => x.task === a.id)
            .map((x) => [x.trial, x.harness_held]),
        [
            [1, true],
            [2, false],
            [3, true],
            [4, false],
            [5, true],
        ],
    );
    assert.equal(again.stopped, null);
    assert.deepEqual(again.short, [{ request: a.id, held: 3 }]);
});

test("a record made at an earlier commit is continued when only the run's own files changed since, and refused when what a trial is made with changed", (t) => {
    const recordFile = path.join(tempDir(t), 'authoring.json');
    const r = request('event-county-unrest');
    const env = { SCORED_REQUESTS: r.id, SCORED_TRIALS: '2', FAKE_CLAUDE_APPLY: exampleDir(r.id) };
    const judge = judgeStream(judgeAnswer(r, 'yes'));
    const OLD = '1'.repeat(40);
    const NEW = '2'.repeat(40);
    const version = toolInfo(root).version;
    const at = (
        commit: string,
        changed: readonly string[] = [],
    ): Parameters<typeof runAuthoring>[4] => ({
        tool: { name: 'pychivalry', version, commit, dirty: false },
        git: {
            isAncestor: (older, newer) => older === OLD && newer === NEW,
            changed: () => [...changed],
        },
    });
    run(t, env, { judge, trials: { [`${r.id}-2`]: STRAYED } }, recordFile, at(OLD));
    // As a record made before the stop rule: its notes say nothing of it.
    const made = JSON.parse(readFileSync(recordFile, 'utf8')) as AuthoringRecord;
    writeFileSync(
        recordFile,
        `${JSON.stringify({ ...made, notes: made.notes.filter((n) => n !== NOT_HELD_NOTE) }, null, 4)}\n`,
    );
    assert.throws(
        () =>
            run(
                t,
                { ...env, SCORED_CONTINUE: 'true' },
                { judge },
                recordFile,
                at(NEW, ['docs/a.md', 'packages/mcp/src/tools/lookup.ts', 'skills/x/notes.txt']),
            ),
        (e: unknown) =>
            e instanceof CommandError &&
            /since then files changed that a trial is made or graded with: packages\/mcp\/src\/tools\/lookup\.ts, skills\/x\/notes\.txt\./.test(
                e.message,
            ),
    );
    const next = run(
        t,
        { ...env, SCORED_CONTINUE: 'true' },
        { judge },
        recordFile,
        at(NEW, [
            'docs/decisions.md',
            'tools/src/scored-run/authoring.ts',
            'tools/src/scored-run/stop-rule.ts',
            'tools/src/scored-run/stop-rule.test.ts',
        ]),
    );
    assert.deepEqual(
        next.record.results.trials.map((x) => [x.trial, x.harness_held]),
        [
            [1, true],
            [2, false],
            [3, true],
        ],
    );
    // The record keeps the build it was first made with; the note names both commits.
    assert.equal(next.record.tool.commit, OLD);
    assert.match(
        next.record.notes.at(-2) ?? '',
        new RegExp(
            `^Trials were added on \\d{4}-\\d{2}-\\d{2} by a run continuing the record \\(SCORED_CONTINUE=true\\) at commit ${NEW}, made the same way as the record's first \\(made \\d{4}-\\d{2}-\\d{2} at commit ${OLD}\\): the same request list, prompts, judge, base mods, skills, Claude Code version, models, limits, arguments and agent server; between the two commits only documents, records, tests and the run's own files changed \\(tools/src/scored-run/authoring\\.ts, tools/src/scored-run/stop-rule\\.ts\\)\\.$`,
        ),
    );
    assert.equal(next.record.notes.at(-1), NOT_HELD_NOTE);
    assert.ok(
        next.log.includes(
            `scored:authoring: the record was made at commit ${OLD}; this checkout differs from it only in the run's own files (tools/src/scored-run/authoring.ts, tools/src/scored-run/stop-rule.ts) and in documents, records and tests`,
        ),
    );
});

test('SCORED_RECORD names the record a run writes and continues: a file directly in records/scored/, nowhere else', (t) => {
    assert.equal(
        authoringRecordFile(root, {}),
        path.join(root, 'records', 'scored', 'authoring.json'),
    );
    assert.equal(
        authoringRecordFile(root, { SCORED_RECORD: 'records/scored/authoring-expert-run-1.json' }),
        path.join(root, 'records', 'scored', 'authoring-expert-run-1.json'),
    );
    for (const named of [
        'records/authoring.json',
        'records/scored/sub/authoring.json',
        'records/scored/authoring.txt',
        'records/scored/record.schema.json',
        '../authoring.json',
    ]) {
        assert.throws(
            () => authoringRecordFile(root, { SCORED_RECORD: named }),
            (e: unknown) =>
                e instanceof CommandError &&
                e.exitCode === 2 &&
                /SCORED_RECORD must name a \.json file directly in records\/scored\//.test(
                    e.message,
                ),
            named,
        );
    }
    // The command the record states names the file from the repository root, however it was
    // given: never a path of the machine the run was made on.
    const r = request('effect-reward');
    const { record } = run(
        t,
        {
            SCORED_REQUESTS: r.id,
            SCORED_RECORD: path.join(root, 'records', 'scored', 'authoring-test-run-1.json'),
            FAKE_CLAUDE_APPLY: exampleDir(r.id),
        },
        { judge: judgeStream(judgeAnswer(r, 'yes')) },
    );
    assert.match(record.command, / SCORED_RECORD=records\/scored\/authoring-test-run-1\.json /);
    assert.ok(!record.command.includes(root), record.command);
});

test("with SCORED_SKILLS_IN=config the skills are in a temporary configuration folder, as the set-up puts them in a person's own", (t) => {
    const r = request('effect-reward');
    const own = path.join(tempDir(t), 'the-developers-own-config');
    const { record, calls } = run(
        t,
        {
            SCORED_REQUESTS: r.id,
            SCORED_SKILLS_IN: 'config',
            CLAUDE_CONFIG_DIR: own,
            FAKE_CLAUDE_APPLY: exampleDir(r.id),
        },
        { judge: judgeStream(judgeAnswer(r, 'yes')) },
    );
    assert.equal(record.results.task.skills_in, 'config');
    assert.match(record.command, / SCORED_SKILLS_IN=config /);
    const [authoring, judge] = calls;
    assert.ok(authoring !== undefined && judge !== undefined);
    const config = authoring['claude_config_dir'] as string;
    assert.notEqual(config, own);
    assert.ok(config.endsWith(`${r.id}-1${path.sep}claude-config`), config);
    assert.deepEqual(authoring['skills'], { project: [], config: ['write-content'] });
    const argv = authoring['argv'] as string[];
    assert.equal(argv[argv.indexOf('--setting-sources') + 1], 'user,project,local');
    // The judge's session is given no skill and the developer's own configuration folder.
    assert.equal(judge['claude_config_dir'], own);
    assert.deepEqual(judge['skills'], { project: [], config: [] });
    assert.equal(record.results.trials[0]?.harness_held, true);
});

test('the parameters: the game and a session limit are required, the judge is the pinned judge, requests are named by id', (t) => {
    const usage = (env: Record<string, string>, pattern: RegExp): void => {
        assert.throws(
            () => authoringOptions(root, env),
            (e: unknown) =>
                e instanceof CommandError && e.exitCode === 2 && pattern.test(e.message),
        );
    };
    const game = emptyGame(t);
    usage({ CK3_GAME_PATH: game }, /SCORED_SESSION_LIMIT must be given/);
    usage({ SCORED_SESSION_LIMIT: '2' }, /CK3_GAME_PATH is not set/);
    usage(
        { SCORED_SESSION_LIMIT: '2', CK3_GAME_PATH: game, SCORED_JUDGE_MODEL: 'sonnet' },
        /SCORED_JUDGE_MODEL must be a model's full name/,
    );
    usage(
        { SCORED_SESSION_LIMIT: '2', CK3_GAME_PATH: game, SCORED_SKILLS_IN: 'home' },
        /SCORED_SKILLS_IN must be one of project, config, not "home"/,
    );
    usage(
        { SCORED_SESSION_LIMIT: '2', CK3_GAME_PATH: game, SCORED_JUDGE_SESSION_LIMIT: '0' },
        /SCORED_JUDGE_SESSION_LIMIT must be a positive number/,
    );
    const options = authoringOptions(root, {
        SCORED_SESSION_LIMIT: '2',
        CK3_GAME_PATH: game,
        SCORED_REQUESTS: ' a , b ',
    });
    // Another model judges, by the owner's answer of 2026-11-24.
    assert.equal(options.judgeModel, PINNED_JUDGE_MODEL);
    assert.notEqual(PINNED_JUDGE_MODEL, PINNED_MODEL);
    assert.equal(options.judgeSessionLimit, 2);
    assert.equal(options.judgeTimeoutMinutes, 10);
    assert.equal(options.trials, 5);
    assert.deepEqual(options.requests, ['a', 'b']);
    assert.equal(options.skillsDir, path.join(root, 'skills'));
    assert.throws(
        () => run(t, { SCORED_REQUESTS: 'no-such-request' }),
        (e: unknown) =>
            e instanceof CommandError &&
            /SCORED_REQUESTS names no request of fixtures\/requests\/requests\.json: no-such-request/.test(
                e.message,
            ),
    );
    // No skill: the run stops before any session.
    assert.throws(
        () => run(t, { SCORED_SKILLS: tempDir(t) }),
        (e: unknown) => e instanceof CommandError && /no skill in /.test(e.message),
    );
    // A retired request is named as retired.
    assert.throws(
        () => run(t, { SCORED_REQUESTS: 'trigger-feast-guest' }),
        (e: unknown) =>
            e instanceof CommandError && /trigger-feast-guest \(retired: /.test(e.message),
    );
});

test('a base mod the checker faults over the installed game stops the run before any session', (t) => {
    // The first run's base defined feast.0001, which the base game defines too: definitions/clash
    // in every result of its two requests. A game that defines the banquet base's event the same
    // way shows the run refusing to start.
    const install = tempDir(t);
    const game = fixtureGame(install);
    writeTree(install, {
        'game/events/other_banquet_events.txt':
            'namespace = banquet\n\nbanquet.0001 = {\n\ttype = character_event\n}\n',
    });
    const recordFile = path.join(tempDir(t), 'authoring.json');
    const argvFile = path.join(tempDir(t), 'argv.jsonl');
    assert.throws(
        () =>
            run(
                t,
                {
                    CK3_GAME_PATH: game,
                    SCORED_REQUESTS: 'effect-reward,trigger-banquet-guest',
                    FAKE_CLAUDE_ARGV: argvFile,
                },
                {},
                recordFile,
            ),
        (e: unknown) =>
            e instanceof CommandError &&
            /a base mod is not clean over the installed game, so no test session was started:\n {2}banquet: definitions\/clash at events\/banquet_events\.txt:4: Duplicated event ID banquet\.0001/.test(
                e.message,
            ),
    );
    assert.ok(!existsSync(argvFile), 'Claude Code was never started');
    assert.ok(!existsSync(recordFile), 'no record was written');
    // Over the empty game the same bases are clean, and the run goes on.
    const { record } = run(t, {
        SCORED_REQUESTS: 'effect-reward,trigger-banquet-guest',
        FAKE_CLAUDE_APPLY: exampleDir('effect-reward'),
    });
    assert.equal(record.results.trials.length, 2);
});

test("an authoring session's arguments: the agent-use flags, file writing and skills, and no switch that turns the skills off", () => {
    const args = authoringArgs(
        { model: 'claude-test-1', sessionLimit: 1.5, skillPlace: 'project' },
        'Write it.',
        'mcp.json',
    );
    assert.deepEqual(args, [
        '-p',
        'Write it.',
        '--strict-mcp-config',
        '--mcp-config',
        'mcp.json',
        '--tools',
        'Read,Edit,Write,Skill',
        '--allowedTools',
        'mcp__pychivalry__*,Read,Edit,Write,Skill',
        '--permission-mode',
        'dontAsk',
        SESSION_LIMIT_OPTION,
        '1.5',
        '--output-format',
        'stream-json',
        '--verbose',
        '--no-session-persistence',
        '--model',
        'claude-test-1',
        '--setting-sources',
        'project,local',
    ]);
    assert.ok(!args.includes('--disable-slash-commands'));
});

test("the repository's skills folder gives the three skills the set-up installs", () => {
    assert.deepEqual(
        skillsIn(path.join(root, 'skills')).map((s) => [s.name, s.folder]),
        [
            ['pychivalry-explain-error', 'pychivalry-explain-error'],
            ['pychivalry-fix-error', 'pychivalry-fix-error'],
            ['pychivalry-write-content', 'pychivalry-write-content'],
        ],
    );
});

test('the skills folder: each folder holding a SKILL.md, by the name its front matter gives', (t) => {
    const skills = skillsIn(skillsFolder(t));
    assert.deepEqual(
        skills.map((s) => [s.name, s.folder]),
        [[SKILL_NAME, 'write-content']],
    );
    assert.match(skills[0]?.sha256 ?? '', /^[0-9a-f]{64}$/);
    assert.deepEqual(skillsIn(path.join(tempDir(t), 'none')), []);
});

test('validity: errors, warnings and the format, each its own measure', () => {
    assert.deepEqual(
        validityOf([
            { code: 'names/unknown-effect', severity: 'error' },
            { code: 'names/unknown-effect', severity: 'error' },
            { code: 'localization/missing-key', severity: 'warning' },
            { code: 'style/indentation', severity: 'hint' },
        ]),
        {
            errors: 2,
            warnings: 1,
            information: 0,
            hints: 1,
            zero_errors: false,
            no_warnings: false,
            in_format: true,
            by_code: [
                { code: 'names/unknown-effect', severity: 'error', count: 2 },
                { code: 'localization/missing-key', severity: 'warning', count: 1 },
            ],
        },
    );
    assert.equal(
        validityOf([{ code: 'style/not-formatted', severity: 'warning' }]).in_format,
        false,
    );
});

test('the record check finds figures that disagree', (t) => {
    const r = request('effect-reward');
    const { record } = run(
        t,
        { SCORED_REQUESTS: r.id, FAKE_CLAUDE_APPLY: exampleDir(r.id) },
        { judge: judgeStream(judgeAnswer(r, 'yes')) },
    );
    const tamper = (change: (results: Record<string, unknown>) => void): string[] => {
        const copy = JSON.parse(JSON.stringify(record)) as { results: Record<string, unknown> };
        change(copy.results);
        return checkRecord(copy, validate, expected);
    };
    type Trial = Record<string, unknown> & {
        validity: Record<string, unknown>;
        judge: Record<string, unknown>;
    };
    const trial0 = (results: Record<string, unknown>): Trial =>
        (results['trials'] as Trial[])[0] as Trial;
    assert.deepEqual(
        tamper((x) => {
            trial0(x).validity['zero_errors'] = false;
        }),
        [
            '/results/trials/0/validity/zero_errors: false with 0 errors',
            '/results/tasks: the measures per request do not agree with the trials',
            '/results/overall: the measures over all requests do not agree with the trials',
        ],
    );
    assert.deepEqual(
        tamper((x) => {
            trial0(x)['harness_held'] = false;
        }),
        [
            '/results/trials/0/harness_held: false, but its harness problems say true',
            '/results/tasks: the measures per request do not agree with the trials',
            '/results/overall: the measures over all requests do not agree with the trials',
        ],
    );
    assert.deepEqual(
        tamper((x) => {
            trial0(x).judge['answers'] = [];
        }),
        [
            '/results/trials/0/judge/answers: not one answer per dimension its request asks, in order',
            '/results/trials/0/judge: the state answered does not agree with its answers and why',
            '/results/tasks: the measures per request do not agree with the trials',
            '/results/overall: the measures over all requests do not agree with the trials',
        ],
    );
    assert.deepEqual(
        tamper((x) => {
            trial0(x)['trial'] = 2;
        }),
        ['/results/trials/0/trial: 2 is not 1 for effect-reward'],
    );
    // A field the schema does not know fails the schema and is checked no further.
    assert.deepEqual(
        tamper((x) => {
            trial0(x)['extra'] = 1;
        }),
        [
            '/results/trials/0: must NOT have additional properties (extra)',
            '(root): must match "then" schema',
        ],
    );
});

test('a session may name files in its mod and in the folder of its skills, and nowhere else', (t) => {
    const dir = tempDir(t);
    const mod = path.join(dir, 'mod');
    const skills = path.join(dir, 'claude-config', 'skills');
    const summary = readStream(
        authoringStream({
            files: [
                'events/x.txt',
                path.join(mod, 'common', 'y.txt'),
                path.join(skills, 'pychivalry-write-content', 'SKILL.md'),
                path.join(dir, 'elsewhere.txt'),
                path.join(mod, '..', 'escaped.txt'),
            ],
        }),
    );
    assert.deepEqual(
        callsOutside(summary, [mod, skills], ['Read', 'Edit', 'Write']).map((c) => [
            c.tool,
            path.basename(c.file),
        ]),
        [
            ['Write', 'elsewhere.txt'],
            ['Write', 'escaped.txt'],
        ],
    );
});
