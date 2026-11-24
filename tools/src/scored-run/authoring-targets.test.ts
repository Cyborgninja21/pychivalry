/**
 * The owner's targets for the scored authoring test (`authoring-targets.ts`; docs/decisions.md,
 * decision 127), read from an authoring record's measures: each rate against its threshold, in
 * whole numbers, and a record on disk refused when its measures cannot be trusted. No model, key,
 * network or display.
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { tempDir } from '../testing.js';
import { CommandError } from '../util.js';
import type { AuthoringTask, DimensionCounts, Measures } from './authoring-record.js';
import type { AuthoringResults } from './authoring-record.js';
import {
    AUTHORING_TARGETS_DECISION,
    readRecordTargets,
    readTargets,
    sumMeasures,
    targetLines,
    type TargetsReading,
} from './authoring-targets.js';
import { root } from './authoring-testing.js';
import { committedRequests, type Difficulty } from './requests.js';

function dimension(
    name: string,
    yes: number,
    no = 0,
    cannotTell = 0,
    unanswered = 0,
): DimensionCounts {
    return { dimension: name, yes, no, cannot_tell: cannotTell, unanswered };
}

/** A run's measures: every trial held, every measure at `held` unless given. */
function measures(held: number, over: Partial<Measures> = {}): Measures {
    return {
        trials: held,
        harness_held: held,
        zero_errors: held,
        no_warnings: held,
        in_format: held,
        expectations_met: held,
        judged: [dimension('effects-as-asked', held), dimension('scope-as-asked', held)],
        ...over,
    };
}

function tasks(...trials: number[]): AuthoringTask[] {
    return trials.map((n, i) => ({
        name: `request-${String(i)}`,
        content_type: 'event',
        difficulty: 'easy',
        ...measures(n),
    }));
}

/** A request's measures at a difficulty, every measure at `held` unless given. */
function task(
    name: string,
    difficulty: Difficulty,
    held: number,
    over: Partial<Measures> = {},
): AuthoringTask {
    return { name, content_type: 'event', difficulty, ...measures(held, over) };
}

function met(reading: TargetsReading): Record<string, boolean> {
    return Object.fromEntries(reading.targets.map((t) => [t.id, t.met]));
}

test('every measure at its ceiling meets all four targets', () => {
    const reading = readTargets({ tasks: tasks(5, 5), overall: measures(10) });
    assert.deepEqual(met(reading), {
        'no-error': true,
        'no-warning-in-format': true,
        expectations: true,
        judged: true,
    });
    assert.equal(reading.met, true);
    assert.equal(reading.run, 'development');
    assert.deepEqual(reading.trials_per_request, { fewest: 5, most: 5 });
});

test('no error and no warning in the format: every result, not one fewer', () => {
    const one = readTargets({ tasks: tasks(60), overall: measures(60, { zero_errors: 59 }) });
    assert.equal(met(one)['no-error'], false);
    assert.equal(one.met, false);
    // In the format alone short: the target of the two together is not met.
    const format = readTargets({ tasks: tasks(60), overall: measures(60, { in_format: 59 }) });
    assert.deepEqual(met(format), {
        'no-error': true,
        'no-warning-in-format': false,
        expectations: true,
        judged: true,
    });
    const target = format.targets.find((t) => t.id === 'no-warning-in-format');
    assert.deepEqual(target?.parts, [
        { measure: 'no warning', count: 60, of: 60, rate: 1 },
        { measure: 'in the format', count: 59, of: 60, rate: 0.9833 },
    ]);
});

test('every expectation met: 95% is met exactly, one result below is not', () => {
    // 57 of 60 is 95%: met; 56 of 60 is 93.3%: not.
    assert.equal(
        met(readTargets({ tasks: tasks(60), overall: measures(60, { expectations_met: 57 }) }))
            .expectations,
        true,
    );
    assert.equal(
        met(readTargets({ tasks: tasks(60), overall: measures(60, { expectations_met: 56 }) }))
            .expectations,
        false,
    );
});

test('a judged dimension: its yes over every question of it, a no, a cannot-tell or no answer counting against', () => {
    const judged = (d: DimensionCounts): boolean =>
        met(
            readTargets({
                tasks: tasks(20),
                overall: measures(20, { judged: [dimension('effects-as-asked', 20), d] }),
            }),
        ).judged ?? false;
    assert.equal(judged(dimension('scope-as-asked', 19, 1)), true);
    assert.equal(judged(dimension('scope-as-asked', 18, 2)), false);
    assert.equal(judged(dimension('scope-as-asked', 18, 0, 2)), false);
    assert.equal(judged(dimension('scope-as-asked', 18, 0, 0, 2)), false);
    // One dimension below is enough: the others at 100% do not carry it.
    const reading = readTargets({
        tasks: tasks(20),
        overall: measures(20, {
            judged: [dimension('effects-as-asked', 20), dimension('scope-as-asked', 18, 2)],
        }),
    });
    assert.deepEqual(
        reading.targets.find((t) => t.id === 'judged')?.parts.map((p) => [p.measure, p.rate]),
        [
            ['effects-as-asked', 1],
            ['scope-as-asked', 0.9],
        ],
    );
});

test('nothing measured meets nothing', () => {
    const reading = readTargets({
        tasks: tasks(1),
        overall: { ...measures(0), trials: 1, judged: [] },
    });
    assert.equal(
        reading.targets.every((t) => !t.met),
        true,
    );
    assert.equal(reading.targets.find((t) => t.id === 'no-error')?.parts[0]?.rate, null);
});

test('a run of 10 trials of each request is a release run', () => {
    assert.equal(readTargets({ tasks: tasks(10, 10), overall: measures(20) }).run, 'release');
    assert.equal(readTargets({ tasks: tasks(10, 5), overall: measures(15) }).run, 'development');
});

test('the reading in words names the decision, each part, its threshold and met or not', () => {
    const lines = targetLines(
        readTargets({ tasks: tasks(5, 5), overall: measures(10, { zero_errors: 9 }) }),
    );
    assert.deepEqual(lines, [
        `the owner's targets (docs/decisions.md, decision ${String(AUTHORING_TARGETS_DECISION)}), which hold before any release; a development run (5 trials of each request; a run before a release has 10 of each):`,
        '  every result with no error: no error 9 of 10 (90%); needs 100%: not met',
        "  every result with no warning and in pychivalry's format: no warning 10 of 10 (100%), in the format 10 of 10 (100%); needs 100%: met",
        '  at least 95% of results meeting every expectation: every expectation met 10 of 10 (100%); needs 95%: met',
        '  no judged dimension below 95% yes: effects-as-asked 10 of 10 (100%), scope-as-asked 10 of 10 (100%); needs 95%: met',
        '1 of 4 targets not met',
    ]);
});

test("the first run's record, read against the targets set after it: two met, two not", () => {
    // records/scored/authoring-run-1.json is the first run's record, kept as the run wrote it.
    const { reading, made_at } = readRecordTargets(root, {
        SCORED_RECORD: 'records/scored/authoring-run-1.json',
    });
    assert.equal(made_at.slice(0, 10), '2026-11-24');
    assert.deepEqual(met(reading), {
        'no-error': false,
        'no-warning-in-format': false,
        expectations: true,
        judged: true,
    });
    assert.deepEqual(
        reading.targets.flatMap((t) =>
            t.parts.map((p) => `${p.measure} ${String(p.count)}/${String(p.of)}`),
        ),
        [
            'no error 50/60',
            'no warning 0/60',
            'in the format 0/60',
            'every expectation met 58/60',
            'effects-as-asked 45/45',
            'text-as-asked 30/30',
            'nothing-unasked 35/35',
            'conditions-as-asked 50/50',
            'scope-as-asked 20/20',
        ],
    );
});

test('a record that is not an authoring record, or whose figures disagree, is refused', (t) => {
    const refused = (env: Record<string, string>, pattern: RegExp): void => {
        assert.throws(
            () => readRecordTargets(root, env),
            (e: unknown) => e instanceof CommandError && pattern.test(e.message),
        );
    };
    refused(
        { SCORED_RECORD: 'records/scored/agent-use.json' },
        /not a record of the scored authoring test/,
    );
    refused({ SCORED_RECORD: 'records/scored/no-such-record.json' }, /does not exist/);
    const dir = tempDir(t);
    const record = JSON.parse(
        readFileSync(path.join(root, 'records', 'scored', 'authoring-run-1.json'), 'utf8'),
    ) as { results: { overall: { zero_errors: number } } };
    record.results.overall.zero_errors = 60;
    const forged = path.join(dir, 'authoring.json');
    writeFileSync(forged, JSON.stringify(record));
    refused(
        { SCORED_RECORD: forged },
        /the measures over all requests do not agree with the trials/,
    );
    writeFileSync(forged, '{');
    refused({ SCORED_RECORD: forged }, /not JSON/);
});

test('with and without the expert requests: the reading over all decides, the other is read beside it', () => {
    const all = [
        task('easy-one', 'easy', 5),
        task('hard-one', 'hard', 5),
        task('expert-one', 'expert', 5, {
            zero_errors: 3,
            expectations_met: 4,
            judged: [dimension('effects-as-asked', 4, 1), dimension('scope-as-asked', 3, 2)],
        }),
    ];
    const overall = sumMeasures(all);
    assert.deepEqual([overall.trials, overall.zero_errors, overall.expectations_met], [15, 13, 14]);
    const reading = readTargets({ tasks: all, overall });
    assert.equal(reading.met, false);
    assert.deepEqual(met(reading), {
        'no-error': false,
        'no-warning-in-format': true,
        expectations: false,
        judged: false,
    });
    assert.ok(reading.without_expert !== null);
    assert.equal(reading.without_expert.requests, 2);
    assert.equal(reading.without_expert.met, true);
    const lines = targetLines(reading);
    assert.equal(lines[5], '3 of 4 targets not met');
    assert.equal(lines[6], 'the same targets without the expert requests (2 requests):');
    assert.equal(
        lines[7],
        '  every result with no error: no error 10 of 10 (100%); needs 100%: met',
    );
    assert.equal(lines.at(-1), 'every target met');
    // A record of one kind only is read once: there is nothing to read it without.
    assert.equal(readTargets({ tasks: tasks(5, 5), overall: measures(10) }).without_expert, null);
    const expertOnly = [task('expert-one', 'expert', 5)];
    assert.equal(
        readTargets({ tasks: expertOnly, overall: sumMeasures(expertOnly) }).without_expert,
        null,
    );
});

test('a record that lacks requests of the list names them, and is not a release run of it', () => {
    const ten = [task('a', 'easy', 10), task('b', 'expert', 10)];
    const whole = readTargets({ tasks: ten, overall: sumMeasures(ten) }, ['a', 'b']);
    assert.equal(whole.run, 'release');
    assert.deepEqual(whole.missing, []);
    const part = readTargets({ tasks: ten.slice(0, 1), overall: sumMeasures(ten.slice(0, 1)) }, [
        'a',
        'b',
    ]);
    assert.equal(part.run, 'development');
    assert.deepEqual(part.missing, ['b']);
    assert.deepEqual(targetLines(part).slice(0, 2), [
        'the record has no trial of 1 request of the list (made before it was added, or a run of some requests only), so it is read over the requests it has: b',
        `the owner's targets (docs/decisions.md, decision ${String(AUTHORING_TARGETS_DECISION)}), which hold before any release; a development run (10 trials of each request, but not of every request of the list):`,
    ]);
    assert.equal(targetLines(part).at(-1), 'every target met');
});

test("the second run's record, made before the expert requests: read over its twelve, the twelve it lacks named", () => {
    const { reading } = readRecordTargets(root, {});
    const expert = committedRequests(root)
        .requests.filter((r) => r.difficulty === 'expert')
        .map((r) => r.id);
    assert.equal(expert.length, 12);
    assert.deepEqual(reading.missing, expert);
    assert.equal(reading.without_expert, null);
    assert.equal(reading.met, true);
    assert.equal(reading.run, 'development');
    // The measures per request add up to the measures over all, as the reading without the
    // expert requests relies on.
    const record = JSON.parse(
        readFileSync(path.join(root, 'records', 'scored', 'authoring.json'), 'utf8'),
    ) as { results: AuthoringResults };
    assert.deepEqual(sumMeasures(record.results.tasks), record.results.overall);
});
