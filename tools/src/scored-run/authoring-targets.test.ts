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
import {
    summarize,
    type AuthoringResults,
    type AuthoringTask,
    type AuthoringTrial,
    type DimensionCounts,
    type Measures,
} from './authoring-record.js';
import {
    AUTHORING_TARGETS_DECISION,
    readRecordTargets,
    readTargets,
    sumMeasures,
    targetLines,
    type TargetsReading,
} from './authoring-targets.js';
import { root } from './authoring-testing.js';
import { JUDGE_PROMPT_VERSION, JUDGE_PROMPT_VERSIONS } from './judge.js';
import type { Stopped } from './confinement.js';
import type { JudgeAnswer } from './judge.js';
import { committedRequests, type Difficulty } from './requests.js';
import { SERVER_SCHEMA_VERSION } from './run.js';

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
        { measure: 'no warning', count: 60, of: 60, rate: 1, against: 0 },
        { measure: 'in the format', count: 59, of: 60, rate: 0.9833, against: 0 },
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
        "every trial's harness held (10)",
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

test("the expert requests' development run: filed, read over its twelve requests, conditions-as-asked 52 of 55, judged with version 1 of the judge's prompt", () => {
    // records/scored/authoring-expert-run-1.json, the run continued from its record (decision 137)
    // and filed as the run wrote it.
    const { reading, made_at } = readRecordTargets(root, {
        SCORED_RECORD: 'records/scored/authoring-expert-run-1.json',
    });
    assert.equal(made_at.slice(0, 10), '2026-11-25');
    assert.equal(reading.trials, 61);
    assert.equal(reading.held, 60);
    assert.deepEqual(
        reading.not_held.map((t) => `${t.task} ${String(t.trial)} ${t.against.join(', ')}`),
        ['event-county-unrest 4 '],
    );
    assert.deepEqual(met(reading), {
        'no-error': true,
        'no-warning-in-format': true,
        expectations: true,
        judged: false,
    });
    const judged = reading.targets.find((t) => t.id === 'judged');
    assert.deepEqual(
        judged?.parts.map((p) => `${p.measure} ${String(p.count)}/${String(p.of)}`),
        [
            'effects-as-asked 45/45',
            'scope-as-asked 55/55',
            'text-as-asked 30/30',
            'nothing-unasked 35/35',
            'conditions-as-asked 52/55',
        ],
    );
    // Judged with the first version of the judge's prompt, which the reading says first.
    assert.deepEqual(reading.judge, {
        sha256: JUDGE_PROMPT_VERSIONS[0]?.sha256,
        version: 1,
        committed: false,
    });
    // Its sessions were given the agent server before tool schema version 4, which the reading
    // says first, then the judge.
    assert.deepEqual(reading.server, { schema_version: null, committed: false });
    assert.deepEqual(targetLines(reading).slice(0, 2), [
        `its sessions were given the agent server's tool schema version 3 or earlier (the record was made before records named it: no source tool, lookup answered in pages cut inside a name, game places that did not say how to read them), not the committed version ${String(SERVER_SCHEMA_VERSION)}: they were given other tools and answers, so its measures are not comparable with those of a record of version ${String(SERVER_SCHEMA_VERSION)} without saying so`,
        "judged with version 1 of the judge's prompt, not the committed version 2: its judged parts are that judge's, and are not comparable with those of a record judged with version 2",
    ]);
});

test("the expert run's kept results judged again with version 2: every target met, the sessions' server unchanged", () => {
    // records/scored/authoring-expert-run-1-judge-2.json, written by task scored:rejudge on the
    // owner's word of 2026-11-25: the same trials, sessions and grades, only the judge new.
    const { reading } = readRecordTargets(root, {
        SCORED_RECORD: 'records/scored/authoring-expert-run-1-judge-2.json',
    });
    assert.equal(reading.trials, 61);
    assert.equal(reading.held, 60);
    assert.deepEqual(met(reading), {
        'no-error': true,
        'no-warning-in-format': true,
        expectations: true,
        judged: true,
    });
    assert.deepEqual(
        reading.targets
            .find((t) => t.id === 'judged')
            ?.parts.map((p) => `${p.measure} ${String(p.count)}/${String(p.of)}`),
        [
            'effects-as-asked 45/45',
            'scope-as-asked 55/55',
            'text-as-asked 30/30',
            'nothing-unasked 35/35',
            'conditions-as-asked 55/55',
        ],
    );
    assert.equal(reading.judge?.version, 2);
    assert.equal(reading.judge.committed, true);
    assert.deepEqual(reading.server, { schema_version: null, committed: false });
});

test("the agent server a record's sessions were given: the committed schema version, another, or none named", () => {
    const record = JSON.parse(
        readFileSync(path.join(root, 'records', 'scored', 'authoring-run-1.json'), 'utf8'),
    ) as { results: AuthoringResults };
    const lineFor = (schema: number | undefined): string | undefined =>
        targetLines(
            readTargets({
                ...record.results,
                server: {
                    ...record.results.server,
                    ...(schema === undefined ? {} : { schema_version: schema }),
                },
            }),
        )[0];
    assert.equal(
        lineFor(SERVER_SCHEMA_VERSION),
        `its sessions were given the agent server's tool schema version ${String(SERVER_SCHEMA_VERSION)}, the committed one`,
    );
    assert.match(
        lineFor(SERVER_SCHEMA_VERSION + 1) ?? '',
        /^its sessions were given the agent server's tool schema version \d+, not the committed version \d+: they were given other tools and answers/,
    );
    assert.match(lineFor(undefined) ?? '', /tool schema version 3 or earlier/);
    // Measures alone name no server.
    assert.equal(
        readTargets({ tasks: record.results.tasks, overall: record.results.overall }).server,
        null,
    );
});

test("the judge's prompt a record names: the committed one, an earlier one, or one this checkout does not know", () => {
    const record = JSON.parse(
        readFileSync(path.join(root, 'records', 'scored', 'authoring-run-1.json'), 'utf8'),
    ) as { results: AuthoringResults };
    // The judge's line comes after the server's.
    const lineFor = (sha256: string): string | undefined =>
        targetLines(
            readTargets({
                ...record.results,
                task: { ...record.results.task, judge_prompt_sha256: sha256 },
            }),
        )[1];
    assert.equal(
        lineFor(JUDGE_PROMPT_VERSION.sha256),
        "judged with version 2 of the judge's prompt, the committed one",
    );
    assert.match(
        lineFor(JUDGE_PROMPT_VERSIONS[0]?.sha256 ?? '') ?? '',
        /^judged with version 1 of the judge's prompt, not the committed version 2:/,
    );
    assert.match(
        lineFor('ab'.repeat(32)) ?? '',
        /^judged with a judge's prompt no version of this checkout has \(sha256 abababababab…\), not the committed version 2:/,
    );
    // Measures alone name no prompt.
    assert.equal(
        readTargets({ tasks: record.results.tasks, overall: record.results.overall }).judge,
        null,
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
    assert.equal(lines[0], "every trial's harness held (15)");
    assert.equal(lines[6], '3 of 4 targets not met');
    assert.equal(lines[7], 'the same targets without the expert requests (2 requests):');
    assert.equal(
        lines[8],
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
    assert.deepEqual(targetLines(part).slice(0, 3), [
        'the record has no trial of 1 request of the list (made before it was added, or a run of some requests only), so it is read over the requests it has: b',
        "every trial's harness held (10)",
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

/** One trial of a record: held and clean unless given otherwise. */
function trialOf(
    task: string,
    n: number,
    over: {
        readonly difficulty?: Difficulty;
        readonly held?: boolean;
        readonly stopped?: Stopped;
        readonly errors?: number;
        readonly expectationsMet?: boolean;
        readonly answers?: readonly JudgeAnswer[] | null;
    } = {},
): AuthoringTrial {
    const errors = over.errors ?? 0;
    const held = over.held ?? true;
    const met = over.expectationsMet ?? true;
    const answers: readonly JudgeAnswer[] | null =
        over.answers === undefined ? ['yes', 'yes'] : over.answers;
    return {
        task,
        content_type: 'event',
        difficulty: over.difficulty ?? 'easy',
        trial: n,
        harness_held: held,
        stopped: over.stopped ?? 'finished',
        harness_problems: held ? [] : ['the session named files outside its mod (1 calls of Read)'],
        tool_calls: [],
        tool_errors: [],
        permission_denials: 0,
        session: null,
        turns: 10,
        duration_ms: 20_000,
        exit_code: 0,
        validity: {
            errors,
            warnings: 0,
            information: 0,
            hints: 0,
            zero_errors: errors === 0,
            no_warnings: true,
            in_format: true,
            by_code:
                errors === 0
                    ? []
                    : [{ code: 'names/unknown-trigger', severity: 'error', count: errors }],
        },
        expectations: [
            { expectation: 'it is there', met, problem: met ? null : 'it is not there' },
        ],
        expectations_met: met,
        judge:
            answers === null
                ? {
                      state: 'not-judged',
                      why: "the authoring session's harness did not hold",
                      stopped: null,
                      harness_problems: [],
                      answers: [],
                      turns: null,
                      duration_ms: null,
                      exit_code: null,
                  }
                : {
                      state: 'answered',
                      why: null,
                      stopped: 'finished',
                      harness_problems: [],
                      answers: [
                          { dimension: 'effects-as-asked', answer: answers[0] ?? 'yes' },
                          { dimension: 'scope-as-asked', answer: answers[1] ?? 'yes' },
                      ],
                      turns: 1,
                      duration_ms: 3_000,
                      exit_code: 0,
                  },
    };
}

/** A record's results from its trials, as the run writes them. */
function resultsOf(
    trials: readonly AuthoringTrial[],
): Pick<AuthoringResults, 'tasks' | 'overall' | 'trials'> {
    const requests = [...new Set(trials.map((t) => t.task))].map((id) => ({
        id,
        content_type: 'event' as const,
        difficulty: trials.find((t) => t.task === id)?.difficulty ?? 'easy',
        dimensions: ['effects-as-asked', 'scope-as-asked'],
    }));
    return { ...summarize(trials, requests), trials };
}

/** Four clean trials that held, of one request, then `last`. */
function fourAnd(last: AuthoringTrial): AuthoringTrial[] {
    return [1, 2, 3, 4].map((n) => trialOf('event-x', n)).concat(last);
}

function partsOf(reading: TargetsReading): string[] {
    return reading.targets.flatMap((t) =>
        t.parts.map(
            (p) =>
                `${p.measure} ${String(p.count)}/${String(p.of)}${p.against > 0 ? ` (${String(p.against)} against)` : ''}`,
        ),
    );
}

test('a trial that did not hold, whose session ended by itself, counts against each target its own result fails', () => {
    const reading = readTargets(
        resultsOf(
            fourAnd(
                trialOf('event-x', 5, {
                    held: false,
                    errors: 1,
                    expectationsMet: false,
                    answers: ['no', 'yes'],
                }),
            ),
        ),
    );
    assert.deepEqual(partsOf(reading), [
        'no error 4/5 (1 against)',
        'no warning 4/4',
        'in the format 4/4',
        'every expectation met 4/5 (1 against)',
        'effects-as-asked 4/5 (1 against)',
        'scope-as-asked 4/4',
    ]);
    assert.deepEqual(met(reading), {
        'no-error': false,
        'no-warning-in-format': true,
        expectations: false,
        judged: false,
    });
    assert.deepEqual(reading.not_held, [
        {
            task: 'event-x',
            trial: 5,
            problems: ['the session named files outside its mod (1 calls of Read)'],
            ended_by_itself: true,
            against: ['no error', 'every expectation met', 'effects-as-asked'],
        },
    ]);
    const lines = targetLines(reading);
    assert.equal(
        lines[0],
        '1 of the 5 trials did not hold. A trial that did not hold is never counted as a success: when its authoring session ended by itself, it counts against each target its own result fails; when a session of it broke, it counts for nothing; and a run continuing the record (SCORED_CONTINUE=true) tries its request again',
    );
    assert.equal(
        lines[1],
        '  event-x trial 5: the session named files outside its mod (1 calls of Read); counted against: no error, every expectation met, effects-as-asked',
    );
    assert.equal(
        lines[3],
        '  every result with no error: no error 4 of 5 (80%; 1 trial that did not hold counted against it); needs 100%: not met',
    );
});

test('a trial that did not hold never improves a score: a clean one, or one whose session broke, counts for nothing', () => {
    // Its own result clean: it is left out, and the four that held decide.
    const clean = readTargets(resultsOf(fourAnd(trialOf('event-x', 5, { held: false }))));
    assert.deepEqual(partsOf(clean), [
        'no error 4/4',
        'no warning 4/4',
        'in the format 4/4',
        'every expectation met 4/4',
        'effects-as-asked 4/4',
        'scope-as-asked 4/4',
    ]);
    assert.equal(clean.met, true);
    assert.equal(
        targetLines(clean)[1],
        '  event-x trial 5: the session named files outside its mod (1 calls of Read); its own result fails no target, so it counts for nothing',
    );
    // A session that broke says nothing of its result, which is not counted either way.
    const broke = readTargets(
        resultsOf(
            fourAnd(
                trialOf('event-x', 5, {
                    held: false,
                    stopped: 'error',
                    errors: 3,
                    expectationsMet: false,
                    answers: null,
                }),
            ),
        ),
    );
    assert.deepEqual(partsOf(broke), partsOf(clean));
    assert.equal(broke.not_held[0]?.ended_by_itself, false);
    assert.match(targetLines(broke)[1] ?? '', /a session of it broke, so it counts for nothing$/);
    // Counted against, it can only lower a rate: the same trial holding would raise it.
    const failing = trialOf('event-x', 5, { held: false, errors: 1 });
    const asIfHeld = trialOf('event-x', 5, { errors: 1 });
    const against = readTargets(resultsOf(fourAnd(failing))).targets[0]?.parts[0];
    const heldPart = readTargets(resultsOf(fourAnd(asIfHeld))).targets[0]?.parts[0];
    assert.deepEqual([against?.count, against?.of], [heldPart?.count, heldPart?.of]);
});

test('a release run needs 10 trials that held of each request: a trial that did not hold does not make up the number', () => {
    const ten = (task: string, notHeld: number): AuthoringTrial[] =>
        Array.from({ length: 10 }, (_, i) =>
            trialOf(task, i + 1, { held: i >= 10 - notHeld ? false : true }),
        );
    assert.equal(readTargets(resultsOf([...ten('a', 0), ...ten('b', 0)])).run, 'release');
    const short = readTargets(resultsOf([...ten('a', 0), ...ten('b', 1)]));
    assert.equal(short.run, 'development');
    assert.deepEqual(short.trials_per_request, { fewest: 9, most: 10 });
    assert.match(
        targetLines(short)[2] ?? '',
        /a development run \(9 to 10 trials that held of a request; a run before a release has 10 of each\):$/,
    );
});

test('without the expert requests, only their own trials that did not hold count against', () => {
    const trials = [
        trialOf('easy-one', 1),
        trialOf('easy-one', 2, { held: false, errors: 1 }),
        trialOf('expert-one', 1, { difficulty: 'expert' }),
        trialOf('expert-one', 2, { difficulty: 'expert', held: false, expectationsMet: false }),
    ];
    const reading = readTargets(resultsOf(trials));
    assert.deepEqual(partsOf(reading).slice(0, 4), [
        'no error 2/3 (1 against)',
        'no warning 2/2',
        'in the format 2/2',
        'every expectation met 2/3 (1 against)',
    ]);
    assert.ok(reading.without_expert !== null);
    assert.deepEqual(
        reading.without_expert.targets
            .flatMap((t) => t.parts.map((p) => `${p.measure} ${String(p.count)}/${String(p.of)}`))
            .slice(0, 4),
        ['no error 1/2', 'no warning 1/1', 'in the format 1/1', 'every expectation met 1/1'],
    );
});
