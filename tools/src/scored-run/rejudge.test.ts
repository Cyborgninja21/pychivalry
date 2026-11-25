/**
 * Re-judging kept results (`rejudge.ts`), driven against the stand-in for Claude Code
 * (`fake-claude.ts`): an authoring run kept with `SCORED_KEEP=true`, judged by a judge that says
 * no, then judged again with no authoring session. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRecord, compileRecordSchema } from '../records-check.js';
import { fixtureGame, tempDir } from '../testing.js';
import { CommandError } from '../util.js';
import type { AuthoringRecord } from './authoring-record.js';
import { readTargets } from './authoring-targets.js';
import { runAuthoring } from './authoring.js';
import {
    authoringStream,
    emptyGame,
    exampleDir,
    judgeAnswer,
    judgeStream,
    root,
    skillsFolder,
    textFile,
} from './authoring-testing.js';
import { JUDGE_PROMPT_VERSION } from './judge.js';
import { rejudgeRecordFile, runRejudge } from './rejudge.js';
import { committedRequests, type ContentRequest } from './requests.js';

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

const r = request('trigger-loyal-realm');

interface Kept {
    readonly game: string;
    readonly record: string;
    readonly kept: string;
}

/**
 * An authoring run of `trigger-loyal-realm`, two trials writing its example result (the logic
 * every result of the expert run wrote), kept, its judge saying no on conditions-as-asked as the
 * expert run's did; the record in a folder of the test's own.
 */
function keptRun(t: TestContext): Kept {
    const game = emptyGame(t);
    const record = path.join(tempDir(t), 'authoring-expert-run-1.json');
    const log: string[] = [];
    runAuthoring(
        root,
        {
            SCORED_SESSION_LIMIT: '2',
            SCORED_TRIALS: '2',
            SCORED_REQUESTS: r.id,
            SCORED_CLAUDE: fake,
            SCORED_SERVER: fake,
            SCORED_SKILLS: skillsFolder(t),
            SCORED_KEEP: 'true',
            CK3_GAME_PATH: game,
            FAKE_CLAUDE_APPLY: exampleDir(r.id),
            FAKE_CLAUDE_STREAM: textFile(
                t,
                'stream.jsonl',
                authoringStream({ files: ['common/scripted_triggers/x.txt'] }),
            ),
            FAKE_CLAUDE_JUDGE_STREAM: textFile(
                t,
                'judge.jsonl',
                judgeStream(judgeAnswer(r, ['no', 'yes', 'yes'])),
            ),
        },
        (line) => log.push(line),
        record,
    );
    const kept = /the trials are kept in (.+)$/.exec(
        log.find((l) => l.includes('the trials are kept in')) ?? '',
    )?.[1];
    assert.ok(kept !== undefined && existsSync(kept), 'the run kept its trials');
    return { game, record, kept };
}

function rejudge(
    t: TestContext,
    from: Kept,
    env: Record<string, string> = {},
    answers: readonly ('yes' | 'no' | 'cannot-tell')[] = ['yes', 'yes', 'yes'],
): {
    readonly result: ReturnType<typeof runRejudge>;
    readonly prompts: string[];
    readonly argv: Record<string, unknown>[];
    readonly log: string[];
} {
    const argvFile = path.join(tempDir(t), 'argv.jsonl');
    const log: string[] = [];
    const result = runRejudge(
        root,
        {
            SCORED_FROM: 'records/scored/authoring-expert-run-1.json',
            SCORED_KEPT: from.kept,
            SCORED_SESSION_LIMIT: '2',
            SCORED_CLAUDE: fake,
            CK3_GAME_PATH: from.game,
            FAKE_CLAUDE_JUDGE_STREAM: textFile(
                t,
                'judge-2.jsonl',
                judgeStream(judgeAnswer(r, answers)),
            ),
            FAKE_CLAUDE_ARGV: argvFile,
            ANTHROPIC_API_KEY: 'must-not-reach-the-session',
            ...env,
        },
        (line) => log.push(line),
        { from: from.record, record: path.join(tempDir(t), 'rejudged.json') },
    );
    const argv = existsSync(argvFile)
        ? readFileSync(argvFile, 'utf8')
              .trim()
              .split('\n')
              .map((l) => JSON.parse(l) as Record<string, unknown>)
        : [];
    return { result, argv, prompts: argv.map((a) => a['stdin'] as string), log };
}

test("re-judging kept results: no authoring session, the judge's new answers, everything else the record's", (t) => {
    const from = keptRun(t);
    const source = JSON.parse(readFileSync(from.record, 'utf8')) as AuthoringRecord;
    assert.deepEqual(
        source.results.trials.map((x) => x.judge.answers.map((a) => a.answer)),
        [
            ['no', 'yes', 'yes'],
            ['no', 'yes', 'yes'],
        ],
    );
    const { result, argv, prompts, log } = rejudge(t, from);
    assert.equal(result.stopped, null);
    assert.equal(result.sessions, 2);
    const record = result.record;
    assert.ok(record !== null);
    assert.deepEqual(
        checkRecord(JSON.parse(JSON.stringify(record)) as unknown, validate, expected),
        [],
    );
    // Two judge sessions and no authoring session: no session was given the agent server.
    assert.equal(argv.length, 2);
    assert.ok(argv.every((a) => a['mcp_config'] === null && (a['argv'] as string[])[0] === '-p'));
    assert.ok(argv.every((a) => (a['credential_variables'] as string[]).length === 0));
    // Each judge was given the committed judge's material.
    for (const prompt of prompts) {
        assert.ok(
            prompt.includes(
                "<checker>\npychivalry's checker, over the installed game (version 1.21.0.3), reports no error and no warning in this result.\n</checker>",
            ),
        );
        assert.ok(
            prompt.includes(
                '- popular_opinion: a trigger; supported scopes: landed_title; the game\'s description: "Compares the county\'s current opinion of its holder"',
            ),
        );
    }
    // The judge is new; the sessions, results and grades are the record's.
    assert.deepEqual(
        record.results.trials.map((x) => x.judge.answers.map((a) => a.answer)),
        [
            ['yes', 'yes', 'yes'],
            ['yes', 'yes', 'yes'],
        ],
    );
    assert.equal(record.results.task.judge_prompt_sha256, JUDGE_PROMPT_VERSION.sha256);
    for (const [i, trial] of record.results.trials.entries()) {
        const before = source.results.trials[i];
        assert.ok(before !== undefined);
        assert.deepEqual({ ...trial, judge: null }, { ...before, judge: null });
    }
    assert.deepEqual(record.tool, source.tool);
    assert.equal(record.made_at, source.made_at);
    assert.deepEqual(record.game, source.game);
    assert.deepEqual(record.notes.slice(0, source.notes.length), source.notes);
    const note = record.notes.at(-1) ?? '';
    assert.match(
        note,
        /^Re-judged on \d{4}-\d{2}-\d{2} by task scored:rejudge at commit [0-9a-f]+/,
    );
    assert.match(
        note,
        /only the judge was run again \(2 judge test sessions of Claude Code 2\.1\.330\), with version 2 of the judge's prompt/,
    );
    assert.match(
        record.command,
        /^SCORED_FROM=<record file> SCORED_KEPT=<kept folders> SCORED_JUDGE_MODEL=claude-fable-5-2 SCORED_SESSION_LIMIT=2 SCORED_CLAUDE=<another Claude Code> CK3_GAME_PATH=<game dir> task scored:rejudge$/,
    );
    // The measures are summed again: conditions-as-asked yes now.
    const conditions = record.results.overall.judged.find(
        (d) => d.dimension === 'conditions-as-asked',
    );
    assert.deepEqual(conditions, {
        dimension: 'conditions-as-asked',
        yes: 2,
        no: 0,
        cannot_tell: 0,
        unanswered: 0,
    });
    // Its reading names the committed judge.
    assert.equal(readTargets(record.results).judge?.committed, true);
    assert.ok(log.some((l) => l.includes('every kept result graded as the record graded it')));
});

test('refused before any session: a kept result that is not the one the record graded, a trial with no kept folder, another game or another Claude Code', (t) => {
    const from = keptRun(t);
    const refused = (env: Record<string, string>, pattern: RegExp, at = from): void => {
        const argvFile = path.join(tempDir(t), 'argv.jsonl');
        assert.throws(
            () =>
                runRejudge(
                    root,
                    {
                        SCORED_FROM: 'records/scored/authoring-expert-run-1.json',
                        SCORED_KEPT: at.kept,
                        SCORED_SESSION_LIMIT: '2',
                        SCORED_CLAUDE: fake,
                        CK3_GAME_PATH: at.game,
                        FAKE_CLAUDE_ARGV: argvFile,
                        ...env,
                    },
                    () => undefined,
                    { from: at.record, record: path.join(tempDir(t), 'rejudged.json') },
                ),
            (e: unknown) => e instanceof CommandError && pattern.test(e.message),
            pattern.source,
        );
        assert.ok(!existsSync(argvFile), 'no session was started');
    };
    // Another game: its manifest differs.
    refused(
        { CK3_GAME_PATH: fixtureGame(tempDir(t), '1.22.0.0') },
        /CK3_GAME_PATH is not the game the record read/,
    );
    // A trial's kept folder is not there.
    refused(
        { SCORED_KEPT: tempDir(t) },
        /trigger-loyal-realm trial 1: no kept folder trigger-loyal-realm-1\//,
    );
    // Another Claude Code: the record names 2.1.330.
    const other = JSON.parse(readFileSync(from.record, 'utf8')) as {
        results: { harness: { version: string } };
    };
    other.results.harness.version = '2.1.400';
    const otherFile = path.join(tempDir(t), 'other.json');
    writeFileSync(otherFile, JSON.stringify(other));
    refused({}, /Claude Code 2\.1\.330 is not the version the record was made with \(2\.1\.400\)/, {
        ...from,
        record: otherFile,
    });
    // A kept result changed since: graded again, it is not the record's.
    appendFileSync(
        path.join(
            from.kept,
            'trigger-loyal-realm-2',
            'mod',
            'common',
            'scripted_triggers',
            'authoring_loyal_realm_triggers.txt',
        ),
        '\r\nauthoring_extra_trigger = { county_opinion > 0 }\r\n',
    );
    refused(
        {},
        /trigger-loyal-realm trial 2: graded again, its validity and expectations differ from the record's|trigger-loyal-realm trial 2: graded again, its validity differ/,
    );
});

test('where the re-judged record goes: beside the record read, named for the judge version, never over it', () => {
    const env = { SCORED_FROM: 'records/scored/authoring-expert-run-1.json' };
    const from = path.join(root, 'records', 'scored', 'authoring-expert-run-1.json');
    assert.equal(
        rejudgeRecordFile(root, env, from),
        path.join(root, 'records', 'scored', 'authoring-expert-run-1-judge-2.json'),
    );
    assert.throws(
        () =>
            rejudgeRecordFile(
                root,
                { ...env, SCORED_RECORD: 'records/scored/authoring-expert-run-1.json' },
                from,
            ),
        (e: unknown) => e instanceof CommandError && /never over it/.test(e.message),
    );
    assert.throws(
        () => rejudgeRecordFile(root, { ...env, SCORED_RECORD: 'rejudged.json' }, from),
        (e: unknown) =>
            e instanceof CommandError &&
            /SCORED_RECORD must name a \.json file directly in records\/scored\//.test(e.message),
    );
    // The variables it needs, each refused before anything is read.
    for (const [given, pattern] of [
        [{}, /SCORED_FROM must name the authoring record/],
        [
            { SCORED_FROM: 'elsewhere.json' },
            /SCORED_FROM must name a \.json file directly in records\/scored\//,
        ],
        [env, /SCORED_KEPT must name the folders/],
        [
            { ...env, SCORED_KEPT: '/no/such/folder' },
            /SCORED_KEPT names a folder that does not exist/,
        ],
        [{ ...env, SCORED_KEPT: root }, /SCORED_SESSION_LIMIT must be given/],
        [{ ...env, SCORED_KEPT: root, SCORED_SESSION_LIMIT: '1' }, /CK3_GAME_PATH is not set/],
    ] as const) {
        assert.throws(
            () => runRejudge(root, given, () => undefined),
            (e: unknown) => e instanceof CommandError && pattern.test(e.message),
            pattern.source,
        );
    }
});
