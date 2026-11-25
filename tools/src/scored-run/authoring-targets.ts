/**
 * The owner's targets for the scored authoring test (docs/decisions.md, decision 127; docs/PLAN.md
 * item 9.8), read from the measures an authoring record states. They are strict, and they hold
 * before any release:
 *
 * 1. every result with no error;
 * 2. every result with no warning and in pychivalry's format;
 * 3. at least 95% of results meeting every expectation checked in code;
 * 4. no judged dimension below 95% yes.
 *
 * The record holds measures only: a target is never written into it, so a record made before the
 * targets were set (the first run's) and one made after are read against them the same way. Every
 * rate is over the trials whose harness held, as every measure of the record is; a dimension's
 * rate is its yes over every question of it the judge was asked in those trials, so an answer
 * that is no, cannot tell, malformed or missing counts against it. A target with nothing to
 * measure is not met. The run prints the reading when it ends (`authoring.ts`); `task
 * scored:targets` reads any authoring record (`readRecordTargets`).
 *
 * **A trial whose harness did not hold never improves a score.** It is never counted as a
 * success. When its authoring session ended by itself (it finished, or reached its session or
 * turn limit), its result is a real result that pychivalry's tools and skills led to, graded like
 * any other and judged: each target part its own grades fail counts it against that part, added
 * to the trials the part is over and not to those meeting it. When a session of it broke (an
 * error, the time limit, no result), its result says nothing either way, and it counts for
 * nothing. Either way the reading names it and why it did not hold, and a run continuing the
 * record tries its request again. And a run is a release run only when every request has
 * `RELEASE_TRIALS` trials whose harness held: a trial that did not hold does not make up the
 * number.
 *
 * The expert requests, added after the second run, are read with and without: the reading over
 * every request of the record decides whether the targets are met, and, when the record has
 * trials of both, the same targets are read again over its other requests alone (summed from its
 * measures per request, which add up to the record's measures over all). A record made before the
 * expert requests were added has no trial of them: it is read over the requests it has, its
 * reading says which requests of the current list it lacks, and it is never a release run of the
 * current list, which a release run must cover whole.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { CommandError, EXIT, isObject } from '../util.js';
import {
    AUTHORING_SUITE,
    authoringProblems,
    type AuthoringRecord,
    type AuthoringResults,
    type AuthoringTask,
    type AuthoringTrial,
    type DimensionCounts,
    type Measures,
} from './authoring-record.js';
import { JUDGE_PROMPT_VERSION, judgePromptVersion } from './judge.js';
import { committedRequests, EXPERT } from './requests.js';
import { RELEASE_TRIALS } from './scored-record.js';
import { ENDED_BY_ITSELF } from './stop-rule.js';

/** The record `task scored:targets` reads unless `SCORED_RECORD` names another. */
export const TARGETS_RECORD_FILE = 'records/scored/authoring.json';

/** The decision of the log that set the targets. */
export const AUTHORING_TARGETS_DECISION = 127;

/** One rate a target reads. */
export interface TargetPart {
    /** What is counted, in words. */
    readonly measure: string;
    readonly count: number;
    /**
     * Out of how many: the trials whose harness held, and the trials that did not hold whose own
     * result fails this part (`against`).
     */
    readonly of: number;
    /** `count / of` to 4 places; null when there is nothing to count. */
    readonly rate: number | null;
    /** How many of `of` are trials whose harness did not hold, counted against this part. */
    readonly against: number;
}

/** A trial whose harness did not hold, as the reading names it. */
export interface NotHeldTrial {
    readonly task: string;
    readonly trial: number;
    /** Why it did not hold: its authoring session's problems, then its judge's. */
    readonly problems: readonly string[];
    /** Whether its authoring session ended by itself, so that its result counts against. */
    readonly ended_by_itself: boolean;
    /** The target parts its own result fails, by their measure: each counts it against. */
    readonly against: readonly string[];
}

/** One target, read from a record's measures. */
export interface TargetReading {
    readonly id: 'no-error' | 'no-warning-in-format' | 'expectations' | 'judged';
    /** The target in words, as the owner set it. */
    readonly target: string;
    /** The rate each part must reach, in per cent. */
    readonly needs_percent: number;
    readonly parts: readonly TargetPart[];
    /** Every part has something to count and reaches `needs_percent`. */
    readonly met: boolean;
}

export interface TargetsReading {
    /**
     * `release` when every request of the record has at least `RELEASE_TRIALS` trials whose
     * harness held (10, the MVP's repetitions before a release) and, when the request list is
     * given, the record has every request of it; else `development`.
     */
    readonly run: 'release' | 'development';
    /** The fewest and the most trials whose harness held of a request of the record. */
    readonly trials_per_request: { readonly fewest: number; readonly most: number };
    /** Every trial of the record, and those whose harness held. */
    readonly trials: number;
    readonly held: number;
    /**
     * The trials whose harness did not hold, in the record's order, each with why and what it
     * counts against. Read from the record's trials: empty when only measures are given.
     */
    readonly not_held: readonly NotHeldTrial[];
    /**
     * The requests of the list given that the record has no trial of, in the list's order: a
     * record made before they were added, or a run of some requests only. Empty without a list.
     */
    readonly missing: readonly string[];
    /** The targets over every request of the record: what decides whether they are met. */
    readonly targets: readonly TargetReading[];
    /** Every target met. */
    readonly met: boolean;
    /**
     * The same targets over the record's requests that are not expert, when it has trials of
     * both kinds; null when it has trials of one kind only, whose reading is the one above.
     */
    readonly without_expert: {
        readonly requests: number;
        readonly targets: readonly TargetReading[];
        readonly met: boolean;
    } | null;
    /**
     * The judge's prompt the record was judged with, by its hash and the version of
     * `JUDGE_PROMPT_VERSIONS` it is (null for a hash no version has), and whether it is the
     * committed one; null when only measures are given. A record judged with another version is
     * read the same way, and its reading says so: its judged parts are that judge's.
     */
    readonly judge: {
        readonly sha256: string;
        readonly version: number | null;
        readonly committed: boolean;
    } | null;
}

/** The measures of the target parts that are not judged dimensions, in their order. */
export const NO_ERROR = 'no error';
export const NO_WARNING = 'no warning';
export const IN_FORMAT = 'in the format';
export const EVERY_EXPECTATION = 'every expectation met';

/**
 * A part: `count` of `held`, with `against` trials that did not hold added to what it is over.
 */
function part(measure: string, count: number, held: number, against = 0): TargetPart {
    const of = held + against;
    return {
        measure,
        count,
        of,
        rate: of === 0 ? null : Math.round((count / of) * 10000) / 10000,
        against,
    };
}

/**
 * A trial that did not hold, as the reading names it: what its own grades fail, when its
 * authoring session ended by itself; nothing, when a session of it broke. A judged dimension
 * counts against only when the judge answered it no or cannot tell: a judge that did not answer
 * says nothing of the result.
 */
export function notHeldOf(t: AuthoringTrial): NotHeldTrial {
    const ended = ENDED_BY_ITSELF.includes(t.stopped);
    const against: string[] = [];
    if (ended) {
        if (!t.validity.zero_errors) {
            against.push(NO_ERROR);
        }
        if (!t.validity.no_warnings) {
            against.push(NO_WARNING);
        }
        if (!t.validity.in_format) {
            against.push(IN_FORMAT);
        }
        if (!t.expectations_met) {
            against.push(EVERY_EXPECTATION);
        }
        if (t.judge.state === 'answered') {
            for (const a of t.judge.answers) {
                if (a.answer !== 'yes') {
                    against.push(a.dimension);
                }
            }
        }
    }
    return {
        task: t.task,
        trial: t.trial,
        problems: [
            ...t.harness_problems,
            ...t.judge.harness_problems.map((p) => `the judge's session: ${p}`),
        ],
        ended_by_itself: ended,
        against,
    };
}

function target(
    id: TargetReading['id'],
    words: string,
    needsPercent: number,
    parts: readonly TargetPart[],
): TargetReading {
    // Whole numbers only, so that 19 of 20 against 95% is decided without a rounding error.
    const met =
        parts.length > 0 && parts.every((p) => p.of > 0 && p.count * 100 >= needsPercent * p.of);
    return { id, target: words, needs_percent: needsPercent, parts, met };
}

/**
 * The four targets, read from one set of measures, each part over the trials whose harness held
 * and the trials that did not hold whose own result fails it (`notHeld`).
 */
function targetsOf(o: Measures, notHeld: readonly NotHeldTrial[]): TargetReading[] {
    const held = o.harness_held;
    const against = (measure: string): number =>
        notHeld.filter((t) => t.against.includes(measure)).length;
    const plain = (measure: string, count: number): TargetPart =>
        part(measure, count, held, against(measure));
    // A dimension no held trial was asked may still have a trial that did not hold against it.
    const dimensions = [
        ...o.judged,
        ...[...new Set(notHeld.flatMap((t) => t.against))]
            .filter(
                (m) =>
                    ![NO_ERROR, NO_WARNING, IN_FORMAT, EVERY_EXPECTATION].includes(m) &&
                    !o.judged.some((d) => d.dimension === m),
            )
            .map((dimension) => ({ dimension, yes: 0, no: 0, cannot_tell: 0, unanswered: 0 })),
    ];
    return [
        target('no-error', 'every result with no error', 100, [plain(NO_ERROR, o.zero_errors)]),
        target(
            'no-warning-in-format',
            "every result with no warning and in pychivalry's format",
            100,
            [plain(NO_WARNING, o.no_warnings), plain(IN_FORMAT, o.in_format)],
        ),
        target('expectations', 'at least 95% of results meeting every expectation', 95, [
            plain(EVERY_EXPECTATION, o.expectations_met),
        ]),
        target(
            'judged',
            'no judged dimension below 95% yes',
            95,
            dimensions.map((d) =>
                part(
                    d.dimension,
                    d.yes,
                    d.yes + d.no + d.cannot_tell + d.unanswered,
                    against(d.dimension),
                ),
            ),
        ),
    ];
}

/**
 * The measures of some requests of a record, summed from its measures per request: each trial is
 * of one request, so the sums are what the record's measures over all would be had it held only
 * these. Each dimension in the order the requests first ask it.
 */
export function sumMeasures(tasks: readonly AuthoringTask[]): Measures {
    const judged = new Map<string, DimensionCounts>();
    for (const t of tasks) {
        for (const d of t.judged) {
            const was = judged.get(d.dimension);
            judged.set(d.dimension, {
                dimension: d.dimension,
                yes: (was?.yes ?? 0) + d.yes,
                no: (was?.no ?? 0) + d.no,
                cannot_tell: (was?.cannot_tell ?? 0) + d.cannot_tell,
                unanswered: (was?.unanswered ?? 0) + d.unanswered,
            });
        }
    }
    const sum = (
        key:
            | 'trials'
            | 'harness_held'
            | 'zero_errors'
            | 'no_warnings'
            | 'in_format'
            | 'expectations_met',
    ): number => tasks.reduce((n, t) => n + t[key], 0);
    return {
        trials: sum('trials'),
        harness_held: sum('harness_held'),
        zero_errors: sum('zero_errors'),
        no_warnings: sum('no_warnings'),
        in_format: sum('in_format'),
        expectations_met: sum('expectations_met'),
        judged: [...judged.values()],
    };
}

/**
 * The four targets, read from the measures over all of a record's requests, with its trials that
 * did not hold (`trials`, when given); and, when the record has expert requests and others, over
 * the others alone. `list` is the ids of the request list the record is read against: the
 * requests it lacks are named, and a record that lacks one is not a release run of it.
 */
export function readTargets(
    results: Pick<AuthoringResults, 'tasks' | 'overall'> & {
        readonly trials?: readonly AuthoringTrial[];
        readonly task?: Pick<AuthoringResults['task'], 'judge_prompt_sha256'>;
    },
    list?: readonly string[],
): TargetsReading {
    const sha = results.task?.judge_prompt_sha256;
    const notHeld = (results.trials ?? []).filter((t) => !t.harness_held);
    const notHeldAll = notHeld.map(notHeldOf);
    const targets = targetsOf(results.overall, notHeldAll);
    const perRequest = results.tasks.map((t) => t.harness_held);
    const fewest = perRequest.length === 0 ? 0 : Math.min(...perRequest);
    const most = perRequest.length === 0 ? 0 : Math.max(...perRequest);
    const have = new Set(results.tasks.map((t) => t.name));
    const missing = (list ?? []).filter((id) => !have.has(id));
    const others = results.tasks.filter((t) => t.difficulty !== EXPERT);
    const withoutExpert =
        others.length > 0 && others.length < results.tasks.length
            ? targetsOf(
                  sumMeasures(others),
                  notHeld.filter((t) => t.difficulty !== EXPERT).map(notHeldOf),
              )
            : null;
    return {
        run: fewest >= RELEASE_TRIALS && missing.length === 0 ? 'release' : 'development',
        trials_per_request: { fewest, most },
        trials: results.overall.trials,
        held: results.overall.harness_held,
        not_held: notHeldAll,
        missing,
        targets,
        met: targets.every((t) => t.met),
        without_expert:
            withoutExpert === null
                ? null
                : {
                      requests: others.length,
                      targets: withoutExpert,
                      met: withoutExpert.every((t) => t.met),
                  },
        judge:
            sha === undefined
                ? null
                : {
                      sha256: sha,
                      version: judgePromptVersion(sha)?.version ?? null,
                      committed: sha === JUDGE_PROMPT_VERSION.sha256,
                  },
    };
}

/** Which judge's prompt a reading's judged parts are of, in words. */
function judgeLine(judge: NonNullable<TargetsReading['judge']>): string {
    const committed = JUDGE_PROMPT_VERSION.version;
    if (judge.committed) {
        return `judged with version ${String(committed)} of the judge's prompt, the committed one`;
    }
    const which =
        judge.version === null
            ? `a judge's prompt no version of this checkout has (sha256 ${judge.sha256.slice(0, 12)}…)`
            : `version ${String(judge.version)} of the judge's prompt`;
    return `judged with ${which}, not the committed version ${String(committed)}: its judged parts are that judge's, and are not comparable with those of a record judged with version ${String(committed)}`;
}

function percent(p: TargetPart): string {
    if (p.rate === null) {
        return 'nothing to count';
    }
    const value = (p.count / p.of) * 100;
    return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}%`;
}

/**
 * An authoring record read from a file: refused unless it is an authoring record valid against
 * the record schema, compiled as `task records:check` compiles it, with figures that agree with
 * each other, since its measures could not be trusted otherwise.
 */
export function readAuthoringRecord(root: string, file: string): AuthoringRecord {
    if (!existsSync(file)) {
        throw new CommandError(`the record does not exist: ${file}`, EXIT.usage);
    }
    let record: unknown;
    try {
        record = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    } catch (err) {
        throw new CommandError(`the record is not JSON: ${(err as Error).message}`, EXIT.usage);
    }
    if (!isObject(record) || record['suite'] !== AUTHORING_SUITE) {
        throw new CommandError(
            `not a record of the scored authoring test (suite ${AUTHORING_SUITE}): ${file}`,
            EXIT.usage,
        );
    }
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
        JSON.parse(
            readFileSync(path.join(root, 'records', 'record.schema.json'), 'utf8'),
        ) as object,
    );
    const problems = validate(record)
        ? authoringProblems(record['results'])
        : ['it is not valid against records/record.schema.json'];
    if (problems.length > 0) {
        throw new CommandError(
            `the record's measures cannot be read:\n  ${problems.join('\n  ')}`,
            EXIT.usage,
        );
    }
    return record as unknown as AuthoringRecord;
}

/**
 * The targets read from an authoring record on disk: `SCORED_RECORD` (from the repository root),
 * or the committed `records/scored/authoring.json`, against the committed request list
 * (`readAuthoringRecord` refuses a file whose measures cannot be trusted).
 */
export function readRecordTargets(
    root: string,
    env: Readonly<Record<string, string | undefined>>,
): { readonly file: string; readonly made_at: string; readonly reading: TargetsReading } {
    const named = env['SCORED_RECORD'];
    const file = path.resolve(
        root,
        named === undefined || named === '' ? TARGETS_RECORD_FILE : named,
    );
    const record = readAuthoringRecord(root, file);
    return {
        file,
        made_at: record.made_at,
        reading: readTargets(
            record.results,
            committedRequests(root).requests.map((r) => r.id),
        ),
    };
}

/** One target in words. */
function targetLine(t: TargetReading): string {
    return `  ${t.target}: ${t.parts
        .map(
            (p) =>
                `${p.measure} ${String(p.count)} of ${String(p.of)} (${percent(p)}${p.against > 0 ? `; ${String(p.against)} ${p.against === 1 ? 'trial' : 'trials'} that did not hold counted against it` : ''})`,
        )
        .join(', ')}; needs ${String(t.needs_percent)}%: ${t.met ? 'met' : 'not met'}`;
}

/** The trials that did not hold, in words: how they are counted, then each with why. */
function notHeldLines(reading: TargetsReading): string[] {
    const count = reading.trials - reading.held;
    if (count === 0) {
        return [`every trial's harness held (${String(reading.trials)})`];
    }
    return [
        `${String(count)} of the ${String(reading.trials)} trials did not hold. A trial that did not hold is never counted as a success: when its authoring session ended by itself, it counts against each target its own result fails; when a session of it broke, it counts for nothing; and a run continuing the record (SCORED_CONTINUE=true) tries its request again`,
        ...reading.not_held.map(
            (t) =>
                `  ${t.task} trial ${String(t.trial)}: ${t.problems.join('; ')}; ${
                    t.against.length > 0
                        ? `counted against: ${t.against.join(', ')}`
                        : t.ended_by_itself
                          ? 'its own result fails no target, so it counts for nothing'
                          : 'a session of it broke, so it counts for nothing'
                }`,
        ),
    ];
}

/** Whether every target of a reading is met, in words. */
function metLine(targets: readonly TargetReading[]): string {
    const not = targets.filter((t) => !t.met).length;
    return not === 0
        ? 'every target met'
        : `${String(not)} of ${String(targets.length)} targets not met`;
}

/** The reading in words, one line per target, for the person running the test. */
export function targetLines(reading: TargetsReading): string[] {
    const { fewest, most } = reading.trials_per_request;
    // The trials of a request counted toward a run's size are those that held.
    const that = reading.held === reading.trials ? '' : ' that held';
    const trials =
        fewest === most
            ? `${String(fewest)} ${fewest === 1 ? 'trial' : 'trials'}${that} of each request`
            : `${String(fewest)} to ${String(most)} trials${that} of a request`;
    const kind =
        reading.run === 'release'
            ? `a release run (${trials})`
            : reading.missing.length > 0 && fewest >= RELEASE_TRIALS
              ? `a development run (${trials}, but not of every request of the list)`
              : `a development run (${trials}; a run before a release has ${String(RELEASE_TRIALS)} of each)`;
    const lines: string[] = [];
    if (reading.judge !== null) {
        lines.push(judgeLine(reading.judge));
    }
    if (reading.missing.length > 0) {
        lines.push(
            `the record has no trial of ${String(reading.missing.length)} request${reading.missing.length === 1 ? '' : 's'} of the list (made before ${reading.missing.length === 1 ? 'it was' : 'they were'} added, or a run of some requests only), so it is read over the requests it has: ${reading.missing.join(', ')}`,
        );
    }
    lines.push(
        ...notHeldLines(reading),
        `the owner's targets (docs/decisions.md, decision ${String(AUTHORING_TARGETS_DECISION)}), which hold before any release; ${kind}:`,
        ...reading.targets.map(targetLine),
        metLine(reading.targets),
    );
    if (reading.without_expert !== null) {
        lines.push(
            `the same targets without the expert requests (${String(reading.without_expert.requests)} requests):`,
            ...reading.without_expert.targets.map(targetLine),
            metLine(reading.without_expert.targets),
        );
    }
    return lines;
}
