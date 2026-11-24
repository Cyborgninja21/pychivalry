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
    type AuthoringResults,
    type AuthoringTask,
    type DimensionCounts,
    type Measures,
} from './authoring-record.js';
import { committedRequests, EXPERT } from './requests.js';
import { RELEASE_TRIALS } from './scored-record.js';

/** The record `task scored:targets` reads unless `SCORED_RECORD` names another. */
export const TARGETS_RECORD_FILE = 'records/scored/authoring.json';

/** The decision of the log that set the targets. */
export const AUTHORING_TARGETS_DECISION = 127;

/** One rate a target reads. */
export interface TargetPart {
    /** What is counted, in words. */
    readonly measure: string;
    readonly count: number;
    /** Out of how many. */
    readonly of: number;
    /** `count / of` to 4 places; null when there is nothing to count. */
    readonly rate: number | null;
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
     * `release` when every request of the record has at least `RELEASE_TRIALS` trials (10, the
     * MVP's repetitions before a release) and, when the request list is given, the record has
     * every request of it; else `development`.
     */
    readonly run: 'release' | 'development';
    /** The fewest and the most trials of a request of the record. */
    readonly trials_per_request: { readonly fewest: number; readonly most: number };
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
}

function part(measure: string, count: number, of: number): TargetPart {
    return { measure, count, of, rate: of === 0 ? null : Math.round((count / of) * 10000) / 10000 };
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

/** The four targets, read from one set of measures. */
function targetsOf(o: Measures): TargetReading[] {
    const held = o.harness_held;
    return [
        target('no-error', 'every result with no error', 100, [
            part('no error', o.zero_errors, held),
        ]),
        target(
            'no-warning-in-format',
            "every result with no warning and in pychivalry's format",
            100,
            [part('no warning', o.no_warnings, held), part('in the format', o.in_format, held)],
        ),
        target('expectations', 'at least 95% of results meeting every expectation', 95, [
            part('every expectation met', o.expectations_met, held),
        ]),
        target(
            'judged',
            'no judged dimension below 95% yes',
            95,
            o.judged.map((d) =>
                part(d.dimension, d.yes, d.yes + d.no + d.cannot_tell + d.unanswered),
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
 * The four targets, read from the measures over all of a record's requests; and, when the
 * record has expert requests and others, over the others alone. `list` is the ids of the request
 * list the record is read against: the requests it lacks are named, and a record that lacks one
 * is not a release run of it.
 */
export function readTargets(
    results: Pick<AuthoringResults, 'tasks' | 'overall'>,
    list?: readonly string[],
): TargetsReading {
    const targets = targetsOf(results.overall);
    const perRequest = results.tasks.map((t) => t.trials);
    const fewest = perRequest.length === 0 ? 0 : Math.min(...perRequest);
    const most = perRequest.length === 0 ? 0 : Math.max(...perRequest);
    const have = new Set(results.tasks.map((t) => t.name));
    const missing = (list ?? []).filter((id) => !have.has(id));
    const others = results.tasks.filter((t) => t.difficulty !== EXPERT);
    const withoutExpert =
        others.length > 0 && others.length < results.tasks.length
            ? targetsOf(sumMeasures(others))
            : null;
    return {
        run: fewest >= RELEASE_TRIALS && missing.length === 0 ? 'release' : 'development',
        trials_per_request: { fewest, most },
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
    };
}

function percent(p: TargetPart): string {
    if (p.rate === null) {
        return 'nothing to count';
    }
    const value = (p.count / p.of) * 100;
    return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}%`;
}

/**
 * The targets read from an authoring record on disk: `SCORED_RECORD` (from the repository root),
 * or the committed `records/scored/authoring.json`, against the committed request list. A file
 * that is not an authoring record valid against the record schema, with figures that agree with
 * each other, is refused: its measures cannot be trusted to read.
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
    // The record schema, compiled as `task records:check` compiles it.
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
    return {
        file,
        made_at: String(record['made_at']),
        reading: readTargets(
            record['results'] as AuthoringResults,
            committedRequests(root).requests.map((r) => r.id),
        ),
    };
}

/** One target in words. */
function targetLine(t: TargetReading): string {
    return `  ${t.target}: ${t.parts
        .map((p) => `${p.measure} ${String(p.count)} of ${String(p.of)} (${percent(p)})`)
        .join(', ')}; needs ${String(t.needs_percent)}%: ${t.met ? 'met' : 'not met'}`;
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
    const trials =
        fewest === most
            ? `${String(fewest)} ${fewest === 1 ? 'trial' : 'trials'} of each request`
            : `${String(fewest)} to ${String(most)} trials of a request`;
    const kind =
        reading.run === 'release'
            ? `a release run (${trials})`
            : reading.missing.length > 0 && fewest >= RELEASE_TRIALS
              ? `a development run (${trials}, but not of every request of the list)`
              : `a development run (${trials}; a run before a release has ${String(RELEASE_TRIALS)} of each)`;
    const lines: string[] = [];
    if (reading.missing.length > 0) {
        lines.push(
            `the record has no trial of ${String(reading.missing.length)} request${reading.missing.length === 1 ? '' : 's'} of the list (made before ${reading.missing.length === 1 ? 'it was' : 'they were'} added, or a run of some requests only), so it is read over the requests it has: ${reading.missing.join(', ')}`,
        );
    }
    lines.push(
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
