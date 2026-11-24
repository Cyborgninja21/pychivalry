/**
 * The judge's calibration (docs/PLAN.md item 9.6, `calibration.ts`), built and proved with
 * stand-in data: hand grades written here over the requests' example results, a stand-in judge
 * (`fake-claude.ts`), and the agreement it records. The real calibration needs real results and
 * a person's grades, and runs only on the owner's word. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRecord, compileRecordSchema } from '../records-check.js';
import { tempDir } from '../testing.js';
import { CommandError } from '../util.js';
import { exampleDir, judgeAnswer, judgeStream, root, textFile } from './authoring-testing.js';
import { formatKindOf, formatText } from '@pychivalry/core';
import {
    agreementOf,
    calibrationProblems,
    calibrationRecordFile,
    gradesProblems,
    runCalibration,
    type CalibrationRecord,
} from './calibration.js';
import { resultFiles, type JudgeAnswer } from './judge.js';
import { baseDir, committedRequests, REQUESTS_DIR, type ContentRequest } from './requests.js';
import { PINNED_JUDGE_MODEL } from './run.js';

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

/** The hand-made stand-ins and their sheet (docs/guide/judge-calibration.md). */
const SHEET_DIR = path.join(root, REQUESTS_DIR, 'calibration');

function filesUnder(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
}

test('the hand-grading sheet: every result there, every question of its request asked, every answer left to the person', (t) => {
    const sheet = JSON.parse(readFileSync(path.join(SHEET_DIR, 'grades.json'), 'utf8')) as {
        items: { request: string; result: string; grades: Record<string, string> }[];
    };
    const problems = gradesProblems(sheet, list, SHEET_DIR);
    const blanks = sheet.items.flatMap((item, i) =>
        Object.keys(item.grades).map(
            (d) => `items[${String(i)}]: ${d} is graded "?", not one of yes, no, cannot-tell`,
        ),
    );
    // Unfilled, it is refused before any session; filled, it is a grades file.
    assert.deepEqual(problems, blanks);
    assert.equal(sheet.items.length, 10);
    assert.equal(blanks.length, 26);
    const filled = JSON.parse(JSON.stringify(sheet)) as typeof sheet;
    for (const item of filled.items) {
        for (const d of Object.keys(item.grades)) {
            item.grades[d] = 'cannot-tell';
        }
    }
    assert.deepEqual(gradesProblems(filled, list, SHEET_DIR), []);
    const argv = path.join(tempDir(t), 'argv.jsonl');
    assert.throws(
        () =>
            runCalibration(
                root,
                {
                    SCORED_SESSION_LIMIT: '1',
                    SCORED_GRADES: path.join(SHEET_DIR, 'grades.json'),
                    SCORED_CLAUDE: fake,
                    FAKE_CLAUDE_ARGV: argv,
                },
                () => undefined,
                path.join(tempDir(t), 'calibration.json'),
            ),
        (e: unknown) => e instanceof CommandError && /is graded "\?"/.test(e.message),
    );
    assert.ok(!existsSync(argv), 'no session was started');
    // Every result folder is on the sheet, and its README gives each one's request and questions.
    assert.deepEqual(
        readdirSync(path.join(SHEET_DIR, 'results')).sort(),
        sheet.items.map((i) => path.basename(i.result)).sort(),
    );
    const readme = readFileSync(path.join(SHEET_DIR, 'README.md'), 'utf8');
    assert.match(readme, /\*\*Hand-made, not the work of a test session\.\*\*/);
    for (const item of sheet.items) {
        const r = request(item.request);
        assert.ok(readme.includes(`### \`${item.result}\``), item.result);
        for (const q of r.judged) {
            assert.ok(readme.includes(`- \`${q.dimension}\`: ${q.question}`), q.question);
        }
    }
    // The results are in pychivalry's format, so that the format is not what is judged.
    for (const full of filesUnder(path.join(SHEET_DIR, 'results'))) {
        const kind = formatKindOf(full);
        if (kind !== undefined) {
            const text = readFileSync(full, 'utf8');
            assert.ok(text.startsWith('\uFEFF'), full);
            assert.equal(formatText(text, kind).changed, false, full);
        }
    }
});

/** Real results of the second scored authoring run, one of each request, and their sheet. */
const RUN_2_DIR = path.join(SHEET_DIR, 'run-2');

test('the sheet of real results: trial 1 of each request, every question asked, every answer left to the person', (t) => {
    const sheet = JSON.parse(readFileSync(path.join(RUN_2_DIR, 'grades.json'), 'utf8')) as {
        about: string;
        items: { request: string; result: string; grades: Record<string, string> }[];
    };
    // One result of each request, in the list's order: each request's first trial, none picked.
    assert.deepEqual(
        sheet.items.map((i) => [i.request, i.result]),
        list.requests.map((r) => [r.id, `results/${r.id}-1`]),
    );
    assert.match(sheet.about, /not hand-made: trial 1 of each of the twelve requests/);
    const problems = gradesProblems(sheet, list, RUN_2_DIR);
    const blanks = sheet.items.flatMap((item, i) =>
        Object.keys(item.grades).map(
            (d) => `items[${String(i)}]: ${d} is graded "?", not one of yes, no, cannot-tell`,
        ),
    );
    assert.deepEqual(problems, blanks);
    assert.equal(sheet.items.length, 12);
    assert.equal(blanks.length, 36);
    const filled = JSON.parse(JSON.stringify(sheet)) as typeof sheet;
    for (const item of filled.items) {
        for (const d of Object.keys(item.grades)) {
            item.grades[d] = 'yes';
        }
    }
    assert.deepEqual(gradesProblems(filled, list, RUN_2_DIR), []);
    const argv = path.join(tempDir(t), 'argv.jsonl');
    assert.throws(
        () =>
            runCalibration(
                root,
                {
                    SCORED_SESSION_LIMIT: '1',
                    SCORED_GRADES: path.join(RUN_2_DIR, 'grades.json'),
                    SCORED_CLAUDE: fake,
                    FAKE_CLAUDE_ARGV: argv,
                },
                () => undefined,
                path.join(tempDir(t), 'calibration.json'),
            ),
        (e: unknown) => e instanceof CommandError && /is graded "\?"/.test(e.message),
    );
    assert.ok(!existsSync(argv), 'no session was started');
    assert.deepEqual(
        readdirSync(path.join(RUN_2_DIR, 'results')).sort(),
        sheet.items.map((i) => path.basename(i.result)).sort(),
    );
    const readme = readFileSync(path.join(RUN_2_DIR, 'README.md'), 'utf8');
    assert.match(readme, /\*\*Real results of test sessions, not hand-made\.\*\*/);
    for (const item of sheet.items) {
        const r = request(item.request);
        assert.ok(readme.includes(`### \`${item.result}\``), item.result);
        assert.ok(readme.includes(`Request \`${r.id}\`: ${r.request}`), r.id);
        for (const q of r.judged) {
            assert.ok(readme.includes(`- \`${q.dimension}\`: ${q.question}`), q.question);
        }
    }
});

test('a real result holds only the mod its session left: its base, what it wrote, nothing of the machine', () => {
    const sheet = JSON.parse(readFileSync(path.join(RUN_2_DIR, 'grades.json'), 'utf8')) as {
        items: { request: string; result: string }[];
    };
    for (const item of sheet.items) {
        const r = request(item.request);
        const result = path.join(RUN_2_DIR, item.result);
        const files = filesUnder(result).map((f) =>
            path.relative(result, f).split(path.sep).join('/'),
        );
        // The skills folder the run gave the session, and the trial's stream, error output and
        // server configuration, are not committed: only the mod's own files.
        for (const file of files) {
            assert.ok(
                file === 'descriptor.mod' || /\.(txt|yml)$/.test(file),
                `${item.result}: ${file}`,
            );
            assert.ok(
                !file.split('/').some((part) => part.startsWith('.')),
                `${item.result}: ${file}`,
            );
        }
        // The judge is shown the result against its base: no base file may look removed, and
        // the session wrote something.
        const shown = resultFiles(result, baseDir(root, r.base));
        assert.ok(!shown.some((f) => f.state === 'removed'), item.result);
        assert.ok(
            shown.some((f) => f.state === 'written'),
            item.result,
        );
        for (const full of filesUnder(result)) {
            const text = readFileSync(full, 'utf8');
            // Nothing of the machine the run was made on.
            assert.doesNotMatch(
                text,
                /(^|[\s"'=])(\/(home|tmp|Users|root)\/|~\/|[A-Za-z]:[\\/])/m,
                full,
            );
            // In pychivalry's format, as the run measured each: the format is not what is judged.
            const kind = formatKindOf(full);
            if (kind !== undefined) {
                assert.ok(text.startsWith('\uFEFF'), full);
                assert.equal(formatText(text, kind).changed, false, full);
            }
        }
    }
});

test('SCORED_RECORD: the calibration of each sheet writes a record of its own, in records/scored/ only', (t) => {
    const scored = path.join(root, 'records', 'scored');
    assert.equal(calibrationRecordFile(root, {}), path.join(scored, 'calibration.json'));
    assert.equal(
        calibrationRecordFile(root, { SCORED_RECORD: 'records/scored/calibration-run-2.json' }),
        path.join(scored, 'calibration-run-2.json'),
    );
    for (const named of [
        'calibration.json',
        'records/calibration.json',
        'records/scored/old/calibration.json',
        'records/scored/calibration.txt',
        'records/scored/record.schema.json',
        '../records/scored/calibration.json',
        path.join(tempDir(t), 'calibration.json'),
    ]) {
        assert.throws(
            () => calibrationRecordFile(root, { SCORED_RECORD: named }),
            (e: unknown) =>
                e instanceof CommandError &&
                /SCORED_RECORD must name a \.json file/.test(e.message),
            named,
        );
    }
    // Refused before any session starts.
    const argv = path.join(tempDir(t), 'argv.jsonl');
    assert.throws(
        () =>
            runCalibration(
                root,
                {
                    SCORED_SESSION_LIMIT: '1',
                    SCORED_GRADES: path.join(SHEET_DIR, 'grades.json'),
                    SCORED_RECORD: 'calibration.json',
                    SCORED_CLAUDE: fake,
                    FAKE_CLAUDE_ARGV: argv,
                },
                () => undefined,
            ),
        (e: unknown) => e instanceof CommandError && /SCORED_RECORD/.test(e.message),
    );
    assert.ok(!existsSync(argv), 'no session was started');
    // The record's command names the record it was written to.
    const r = request('effect-reward');
    const log: string[] = [];
    const { record } = runCalibration(
        root,
        {
            SCORED_SESSION_LIMIT: '1',
            SCORED_GRADES: gradesFor(t, r, ['yes', 'yes']),
            SCORED_RECORD: 'records/scored/calibration-run-2.json',
            SCORED_CLAUDE: fake,
            FAKE_CLAUDE_JUDGE_STREAM: textFile(
                t,
                'judge.jsonl',
                judgeStream(judgeAnswer(r, 'yes')),
            ),
        },
        (line) => log.push(line),
        path.join(tempDir(t), 'calibration.json'),
    );
    assert.match(record.command, / SCORED_RECORD=<record file> /);
});

test('the judge is Fable 5.2 unless SCORED_JUDGE_MODEL names another', (t) => {
    const r = request('effect-reward');
    const { record } = calibrate(
        t,
        gradesFor(t, r, ['yes', 'yes']),
        judgeStream(judgeAnswer(r, 'yes')),
    );
    assert.equal(record.results.judge_model, PINNED_JUDGE_MODEL);
    assert.match(record.command, /^SCORED_JUDGE_MODEL=claude-fable-5-2 /);
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
