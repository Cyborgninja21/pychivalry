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
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { CommandError, EXIT, isObject } from '../util.js';
import {
    AUTHORING_SUITE,
    authoringProblems,
    type AuthoringResults,
    type Measures,
} from './authoring-record.js';
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
     * MVP's repetitions before a release), else `development`.
     */
    readonly run: 'release' | 'development';
    /** The fewest and the most trials of a request of the record. */
    readonly trials_per_request: { readonly fewest: number; readonly most: number };
    readonly targets: readonly TargetReading[];
    /** Every target met. */
    readonly met: boolean;
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

/** The four targets, read from the measures over all of a record's requests. */
export function readTargets(results: Pick<AuthoringResults, 'tasks' | 'overall'>): TargetsReading {
    const o: Measures = results.overall;
    const held = o.harness_held;
    const targets = [
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
    const perRequest = results.tasks.map((t) => t.trials);
    const fewest = perRequest.length === 0 ? 0 : Math.min(...perRequest);
    const most = perRequest.length === 0 ? 0 : Math.max(...perRequest);
    return {
        run: fewest >= RELEASE_TRIALS ? 'release' : 'development',
        trials_per_request: { fewest, most },
        targets,
        met: targets.every((t) => t.met),
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
 * or the committed `records/scored/authoring.json`. A file that is not an authoring record valid
 * against the record schema, with figures that agree with each other, is refused: its measures
 * cannot be trusted to read.
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
        reading: readTargets(record['results'] as AuthoringResults),
    };
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
            : `a development run (${trials}; a run before a release has ${String(RELEASE_TRIALS)} of each)`;
    return [
        `the owner's targets (docs/decisions.md, decision ${String(AUTHORING_TARGETS_DECISION)}), which hold before any release; ${kind}:`,
        ...reading.targets.map(
            (t) =>
                `  ${t.target}: ${t.parts
                    .map(
                        (p) => `${p.measure} ${String(p.count)} of ${String(p.of)} (${percent(p)})`,
                    )
                    .join(', ')}; needs ${String(t.needs_percent)}%: ${t.met ? 'met' : 'not met'}`,
        ),
        reading.met
            ? 'every target met'
            : `${String(reading.targets.filter((t) => !t.met).length)} of ${String(reading.targets.length)} targets not met`,
    ];
}
