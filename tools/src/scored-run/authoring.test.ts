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
import { checkRecord, compileRecordSchema } from '../records-check.js';
import { tempDir } from '../testing.js';
import { CommandError } from '../util.js';
import { authoringProblems, type AuthoringRecord } from './authoring-record.js';
import {
    authoringArgs,
    authoringOptions,
    AUTHORING_PROMPT_FILE,
    AUTHORING_TOOLS,
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
import { PINNED_MODEL, SESSION_LIMIT_OPTION } from './run.js';

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
}

function run(
    t: TestContext,
    env: Record<string, string>,
    streams: { readonly authoring?: string; readonly judge?: string } = {},
    recordFile = path.join(tempDir(t), 'authoring.json'),
): Run {
    const dir = tempDir(t);
    const argvFile = path.join(dir, 'argv.jsonl');
    const log: string[] = [];
    const { record } = runAuthoring(
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
            ...CREDENTIALS,
            CLAUDECODE: '1',
            MCP_CONNECTION_NONBLOCKING: 'true',
            ...env,
        },
        (line) => log.push(line),
        recordFile,
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
    return { record, calls, log, file: recordFile };
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
    assert.equal(results.judge_model, PINNED_MODEL);
    assert.equal(results.session_limit, 2);
    assert.equal(results.judge_session_limit, 2);
    assert.deepEqual(
        results.task.skills.map((s) => s.name),
        [SKILL_NAME],
    );
    assert.deepEqual(results.task.answers, ['yes', 'no', 'cannot-tell']);
    assert.match(
        record.command,
        /^SCORED_MODEL=claude-opus-5-5 SCORED_TRIALS=1 SCORED_SESSION_LIMIT=2 SCORED_REQUESTS=effect-war-chest SCORED_SKILLS=<skills folder> SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:authoring$/,
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
    const { record } = run(
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
        "the agent server's tools were not offered: check, explain_code, find_definition, find_references, format, list_definitions, lookup",
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

test('the parameters: the game and a session limit are required, the judge follows the run, requests are named by id', (t) => {
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
    assert.equal(options.judgeModel, PINNED_MODEL);
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
