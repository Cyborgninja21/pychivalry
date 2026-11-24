/**
 * The judge's calibration (docs/PLAN.md item 9.6, `calibration.ts`), built and proved with
 * stand-in data: hand grades written here over the requests' example results, a stand-in judge
 * (`fake-claude.ts`), and the agreement it records. The real calibration needs real results and
 * a person's grades, and runs only on the owner's word. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { cpSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRecord, compileRecordSchema } from '../records-check.js';
import { tempDir } from '../testing.js';
import { CommandError } from '../util.js';
import { exampleDir, judgeAnswer, judgeStream, root, textFile } from './authoring-testing.js';
import {
    agreementOf,
    calibrationProblems,
    gradesProblems,
    runCalibration,
    type CalibrationRecord,
} from './calibration.js';
import type { JudgeAnswer } from './judge.js';
import { baseDir, committedRequests, type ContentRequest } from './requests.js';

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

/** A grades file over one request's example result, with the person's answers. */
function gradesFor(
    t: TestContext,
    r: ContentRequest,
    answers: readonly JudgeAnswer[],
    items = 1,
): string {
    const dir = tempDir(t);
    const result = path.join(dir, 'results', r.id);
    cpSync(baseDir(root, r.base), result, { recursive: true });
    cpSync(exampleDir(r.id), result, { recursive: true });
    const grades = Object.fromEntries(r.judged.map((q, i) => [q.dimension, answers[i] ?? 'yes']));
    const file = path.join(dir, 'grades.json');
    writeFileSync(
        file,
        JSON.stringify({
            grades_format: 1,
            about: 'Stand-in grades for the tests.',
            items: Array.from({ length: items }, () => ({
                request: r.id,
                result: `results/${r.id}`,
                grades,
            })),
        }),
    );
    return file;
}

function calibrate(
    t: TestContext,
    grades: string,
    judge: string,
): { record: CalibrationRecord; log: string[]; stopped: boolean } {
    const log: string[] = [];
    const { record, stopped } = runCalibration(
        root,
        {
            SCORED_SESSION_LIMIT: '1',
            SCORED_GRADES: grades,
            SCORED_CLAUDE: fake,
            FAKE_CLAUDE_JUDGE_STREAM: textFile(t, 'judge.jsonl', judge),
            ANTHROPIC_API_KEY: 'must-not-reach-the-session',
        },
        (line) => log.push(line),
        path.join(tempDir(t), 'calibration.json'),
    );
    assert.deepEqual(
        checkRecord(JSON.parse(JSON.stringify(record)) as unknown, validate, expected),
        [],
    );
    return { record, log, stopped };
}

test('the judge over hand-graded results: agreement per dimension and over all, with the cannot-tell rates', (t) => {
    const r = request('event-letter-from-spouse');
    // The person: yes, no, cannot-tell, yes. The judge: yes, yes, cannot-tell, no.
    const grades = gradesFor(t, r, ['yes', 'no', 'cannot-tell', 'yes'], 2);
    const { record, log, stopped } = calibrate(
        t,
        grades,
        judgeStream(judgeAnswer(r, ['yes', 'yes', 'cannot-tell', 'no'])),
    );
    assert.equal(stopped, false);
    assert.equal(record.suite, 'scored:calibration');
    assert.equal(record.game, null);
    assert.equal(record.results.grades.file, '<grades file>');
    assert.equal(record.results.grades.items, 2);
    assert.equal(record.results.items.length, 2);
    assert.deepEqual(record.results.items[0]?.agrees, [
        { dimension: 'conditions-as-asked', agrees: true },
        { dimension: 'effects-as-asked', agrees: false },
        { dimension: 'scope-as-asked', agrees: true },
        { dimension: 'text-as-asked', agrees: false },
    ]);
    assert.deepEqual(
        record.results.dimensions.map((d) => [d.dimension, d.agree, d.judged, d.agreement]),
        [
            ['conditions-as-asked', 2, 2, 1],
            ['effects-as-asked', 0, 2, 0],
            ['scope-as-asked', 2, 2, 1],
            ['text-as-asked', 0, 2, 0],
        ],
    );
    const o = record.results.overall;
    assert.deepEqual(
        { grades: o.grades, judged: o.judged, agree: o.agree, agreement: o.agreement },
        { grades: 8, judged: 8, agree: 4, agreement: 0.5 },
    );
    assert.equal(o.hand_cannot_tell, 2);
    assert.equal(o.judge_cannot_tell, 2);
    assert.equal(o.judge_cannot_tell_rate, 0.25);
    assert.deepEqual(o.matrix, [
        { hand: 'yes', judge: 'yes', count: 2 },
        { hand: 'yes', judge: 'no', count: 2 },
        { hand: 'no', judge: 'yes', count: 2 },
        { hand: 'cannot-tell', judge: 'cannot-tell', count: 2 },
    ]);
    assert.deepEqual(calibrationProblems(record.results), []);
    assert.ok(log.some((l) => l.includes('agreement 0.5 (4 of 8 judged, 8 grades)')));
    assert.ok(!JSON.stringify(record).includes('must-not-reach'));
});

test("a malformed judge's answer is recorded as such and agrees with nothing", (t) => {
    const r = request('effect-reward');
    const { record } = calibrate(
        t,
        gradesFor(t, r, ['yes', 'yes']),
        judgeStream('Looks right to me.'),
    );
    const [item] = record.results.items;
    assert.equal(item?.judge.state, 'malformed');
    assert.deepEqual(
        item.agrees.map((a) => a.agrees),
        [null, null],
    );
    assert.equal(record.results.overall.judged, 0);
    assert.equal(record.results.overall.agreement, null);
});

test("a judge's session not confined stops the calibration", (t) => {
    const r = request('effect-reward');
    const { record, stopped } = calibrate(
        t,
        gradesFor(t, r, ['yes', 'yes'], 3),
        judgeStream(judgeAnswer(r, 'yes'), { tools: ['Read'] }),
    );
    assert.equal(stopped, true);
    assert.equal(record.results.items.length, 1);
    assert.equal(record.results.grades.items, 1);
});

test('the grades file is checked against the requests before any session', (t) => {
    const r = request('effect-reward');
    const dir = tempDir(t);
    const problems = gradesProblems(
        {
            grades_format: 1,
            about: 'x',
            items: [
                { request: 'no-such-request', result: '.', grades: {} },
                {
                    request: r.id,
                    result: 'missing',
                    grades: { 'effects-as-asked': 'maybe', 'scope-as-asked': 'yes' },
                },
            ],
        },
        list,
        dir,
    );
    assert.deepEqual(problems, [
        'items[0]: "no-such-request" is not a request of fixtures/requests/requests.json',
        'items[1]: the result missing does not exist',
        'items[1]: no grade for nothing-unasked',
        'items[1]: effects-as-asked is graded "maybe", not one of yes, no, cannot-tell',
        'items[1]: a grade for scope-as-asked, which effect-reward does not ask',
    ]);
    assert.deepEqual(
        gradesProblems({ grades_format: 2, about: 'x', items: [], grader: 'x' }, list, dir),
        [
            'the grades have a field the format does not know',
            'grades_format is not 1',
            'items is not a list of graded results',
        ],
    );
    assert.throws(
        () =>
            calibrate(
                t,
                textFile(t, 'grades.json', '{"grades_format":1,"about":"x","items":[]}'),
                judgeStream('{}'),
            ),
        (e: unknown) =>
            e instanceof CommandError && /items is not a list of graded results/.test(e.message),
    );
    assert.throws(
        () => runCalibration(root, { SCORED_SESSION_LIMIT: '1' }, () => undefined),
        (e: unknown) =>
            e instanceof CommandError &&
            /SCORED_GRADES must name the file of hand grades/.test(e.message),
    );
    assert.throws(
        () => runCalibration(root, { SCORED_GRADES: 'x.json' }, () => undefined),
        (e: unknown) =>
            e instanceof CommandError && /SCORED_SESSION_LIMIT must be given/.test(e.message),
    );
});

test('agreement: agreed over answered, cannot-tell counted on both sides, none answered is null', () => {
    assert.deepEqual(agreementOf([]), {
        grades: 0,
        judged: 0,
        agree: 0,
        agreement: null,
        hand_cannot_tell: 0,
        judge_cannot_tell: 0,
        judge_cannot_tell_rate: null,
        matrix: [],
    });
    const a = agreementOf([
        { hand: 'yes', judge: 'yes' },
        { hand: 'no', judge: 'cannot-tell' },
        { hand: 'cannot-tell', judge: null },
    ]);
    assert.deepEqual(
        [
            a.grades,
            a.judged,
            a.agree,
            a.agreement,
            a.hand_cannot_tell,
            a.judge_cannot_tell,
            a.judge_cannot_tell_rate,
        ],
        [3, 2, 1, 0.5, 1, 1, 0.5],
    );
});

test('the record check finds a calibration whose figures disagree', (t) => {
    const r = request('effect-reward');
    const { record } = calibrate(
        t,
        gradesFor(t, r, ['yes', 'no']),
        judgeStream(judgeAnswer(r, 'yes')),
    );
    const copy = JSON.parse(JSON.stringify(record)) as {
        results: { items: { agrees: { agrees: boolean }[] }[] };
    };
    const [item] = copy.results.items;
    assert.ok(item?.agrees[1] !== undefined);
    item.agrees[1].agrees = true;
    assert.deepEqual(checkRecord(copy, validate, expected), [
        "/results/items/0/agrees: does not agree with its grades and the judge's answers",
    ]);
    // A calibration with a game is not one.
    assert.ok(
        checkRecord(
            {
                ...JSON.parse(JSON.stringify(record)),
                game: {
                    build: '1.0',
                    manifest_sha256: '0'.repeat(64),
                    files: 0,
                    content_hashed_files: 0,
                },
            },
            validate,
            expected,
        ).length > 0,
    );
});
