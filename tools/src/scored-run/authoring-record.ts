/**
 * The record of a scored authoring run (docs/PLAN.md item 9.5; records/README.md, "Scored
 * records"): the record format of the agent-use run (`scored-record.ts`), its results shaped for
 * authoring. Per trial: what the session was offered and did, as for agent use; grade one, the
 * checker's validity (errors, warnings, and whether the result is in pychivalry's format, each a
 * measure of its own); grade two, the expectations checked in code and the judge's answer per
 * dimension. Per request and over all of them: how many trials measured each. There is no
 * target yet: the owner sets the targets from the first run (item 9.8). Its schema is
 * `authoringResults` in records/record.schema.json; `authoringProblems` is what `task
 * records:check` adds to the schema: the figures agree with each other.
 *
 * Like the agent-use record it is not tied to the committed spec: making it again means new test
 * sessions, which only the owner starts.
 */

import type { GameInfo } from '../game.js';
import type { MachineInfo, SpecRef, ToolInfo } from '../record.js';
import { isObject } from '../util.js';
import type { Stopped } from './confinement.js';
import { JUDGE_ANSWERS, type JudgeAnswer, type JudgeRecord } from './judge.js';
import type { ContentType, Difficulty } from './requests.js';
import type { TrialRecord } from './scored-record.js';

export const AUTHORING_SUITE = 'scored:authoring';

export type { JudgeRecord };

/** Grade one: the checker on the result, over the base game. */
export interface Validity {
    readonly errors: number;
    readonly warnings: number;
    readonly information: number;
    readonly hints: number;
    /** No error: the measure the run is graded on first. */
    readonly zero_errors: boolean;
    /** No warning either, counted apart under the owner's principle (decision 101). */
    readonly no_warnings: boolean;
    /** No warning of the family `style/`: the result is in pychivalry's format. */
    readonly in_format: boolean;
    /** The errors and warnings, by code: what the result still gets wrong. */
    readonly by_code: readonly {
        readonly code: string;
        readonly severity: 'error' | 'warning';
        readonly count: number;
    }[];
}

/** One trial: one authoring test session, then one judge's session on what it left. */
export interface AuthoringTrial {
    /** The request's id. */
    readonly task: string;
    readonly content_type: ContentType;
    readonly difficulty: Difficulty;
    /** From 1, within its request. */
    readonly trial: number;
    /** Neither the authoring session nor the judge's had a harness problem. */
    readonly harness_held: boolean;
    readonly stopped: Stopped;
    readonly harness_problems: readonly string[];
    readonly tool_calls: TrialRecord['tool_calls'];
    readonly tool_errors: TrialRecord['tool_errors'];
    readonly permission_denials: number;
    readonly session: TrialRecord['session'];
    readonly turns: number | null;
    readonly duration_ms: number | null;
    readonly exit_code: number | null;
    readonly validity: Validity;
    readonly expectations: readonly {
        readonly expectation: string;
        readonly met: boolean;
        readonly problem: string | null;
    }[];
    readonly expectations_met: boolean;
    readonly judge: JudgeRecord;
}

/** How many trials of a set answered each way on one dimension. */
export interface DimensionCounts {
    readonly dimension: string;
    readonly yes: number;
    readonly no: number;
    readonly cannot_tell: number;
    /** Malformed or not judged. */
    readonly unanswered: number;
}

/**
 * The measures of a set of trials. Every count but `trials` and `harness_held` is over the
 * trials whose harness held, the only ones that say anything.
 */
export interface Measures {
    readonly trials: number;
    readonly harness_held: number;
    readonly zero_errors: number;
    readonly no_warnings: number;
    readonly in_format: number;
    readonly expectations_met: number;
    readonly judged: readonly DimensionCounts[];
}

export interface AuthoringTask extends Measures {
    /** The request's id. */
    readonly name: string;
    readonly content_type: ContentType;
    readonly difficulty: Difficulty;
}

export interface AuthoringResults {
    readonly task: {
        readonly name: 'authoring';
        readonly requests_file: string;
        readonly requests_sha256: string;
        readonly prompt_file: string;
        readonly prompt_sha256: string;
        readonly judge_prompt_file: string;
        readonly judge_prompt_sha256: string;
        readonly judge_schema_file: string;
        readonly judge_schema_sha256: string;
        /** The base mods, by the hash of their files (`folderSha256`). */
        readonly bases: readonly { readonly name: string; readonly sha256: string }[];
        /** The skills each trial's session was given, by name and the hash of their files. */
        readonly skills: readonly { readonly name: string; readonly sha256: string }[];
        /** Where each session was given them: its project's or a temporary configuration folder. */
        readonly skills_in: 'project' | 'config';
        /** The closed set of judged dimensions of the request list. */
        readonly dimensions: readonly string[];
        readonly answers: readonly JudgeAnswer[];
    };
    readonly harness: { readonly name: 'claude-code'; readonly version: string };
    readonly model: string;
    readonly judge_model: string;
    readonly session_limit: number;
    readonly judge_session_limit: number;
    readonly timeout_minutes: number;
    readonly judge_timeout_minutes: number;
    readonly arguments: readonly string[];
    readonly judge_arguments: readonly string[];
    readonly server: { readonly entry: string; readonly arguments: readonly string[] };
    readonly trials: readonly AuthoringTrial[];
    readonly tasks: readonly AuthoringTask[];
    readonly overall: Measures;
}

export interface AuthoringRecord {
    readonly record_format: 1;
    readonly suite: typeof AUTHORING_SUITE;
    readonly command: string;
    readonly made_at: string;
    readonly tool: ToolInfo;
    readonly machine: MachineInfo;
    readonly game: GameInfo;
    readonly spec: SpecRef;
    readonly corpus: null;
    readonly notes: readonly string[];
    readonly results: AuthoringResults;
}

const ANSWER_KEY: Readonly<Record<JudgeAnswer, 'yes' | 'no' | 'cannot_tell'>> = {
    yes: 'yes',
    no: 'no',
    'cannot-tell': 'cannot_tell',
};

/**
 * The measures of a set of trials on `dimensions`, in that order. `asked` gives the dimensions
 * each request asks: a trial whose judge did not answer counts as unanswered on those only.
 */
export function measuresOf(
    trials: readonly AuthoringTrial[],
    dimensions: readonly string[],
    asked: ReadonlyMap<string, readonly string[]>,
): Measures {
    const held = trials.filter((t) => t.harness_held);
    const judged = dimensions.map((dimension) => {
        const counts = { dimension, yes: 0, no: 0, cannot_tell: 0, unanswered: 0 };
        for (const t of held) {
            if (!(asked.get(t.task) ?? []).includes(dimension)) {
                continue;
            }
            const answer = t.judge.answers.find((a) => a.dimension === dimension);
            if (t.judge.state !== 'answered' || answer === undefined) {
                counts.unanswered++;
            } else {
                counts[ANSWER_KEY[answer.answer]]++;
            }
        }
        return counts;
    });
    return {
        trials: trials.length,
        harness_held: held.length,
        zero_errors: held.filter((t) => t.validity.zero_errors).length,
        no_warnings: held.filter((t) => t.validity.no_warnings).length,
        in_format: held.filter((t) => t.validity.in_format).length,
        expectations_met: held.filter((t) => t.expectations_met).length,
        judged,
    };
}

/** A request as the measures need it. */
export interface MeasuredRequest {
    readonly id: string;
    readonly content_type: ContentType;
    readonly difficulty: Difficulty;
    /** The dimensions its judge is asked, in order. */
    readonly dimensions: readonly string[];
}

/**
 * The measures per request that has a trial, in the order of `requests`, and over all of them,
 * each dimension in the order it is first asked.
 */
export function summarize(
    trials: readonly AuthoringTrial[],
    requests: readonly MeasuredRequest[],
): { readonly tasks: AuthoringTask[]; readonly overall: Measures } {
    const run = requests.filter((r) => trials.some((t) => t.task === r.id));
    const asked = new Map(run.map((r) => [r.id, r.dimensions]));
    const tasks = run.map((r) => ({
        name: r.id,
        content_type: r.content_type,
        difficulty: r.difficulty,
        ...measuresOf(
            trials.filter((t) => t.task === r.id),
            r.dimensions,
            asked,
        ),
    }));
    const all = [...new Set(run.flatMap((r) => r.dimensions))];
    return { tasks, overall: measuresOf(trials, all, asked) };
}

/**
 * An authoring record's figures that disagree with each other: each trial's grades with their
 * own parts, its `harness_held` with its problems, the trials numbered from 1 within each
 * request, the judge's answers with its state, and the measures per request and over all with
 * the trials.
 */
export function authoringProblems(results: unknown): string[] {
    if (!isObject(results)) {
        return [];
    }
    const problems: string[] = [];
    const trials = Array.isArray(results['trials'])
        ? (results['trials'].filter(isObject) as unknown as AuthoringTrial[])
        : [];
    const tasks = Array.isArray(results['tasks'])
        ? (results['tasks'].filter(isObject) as unknown as AuthoringTask[])
        : [];
    const numbers = new Map<string, number>();
    trials.forEach((t, i) => {
        const where = `/results/trials/${String(i)}`;
        const v = t.validity;
        const style = v.by_code.some(
            (c) => c.severity === 'warning' && c.code.startsWith('style/'),
        );
        const sum = (severity: string): number =>
            v.by_code.filter((c) => c.severity === severity).reduce((n, c) => n + c.count, 0);
        if (sum('error') !== v.errors || sum('warning') !== v.warnings) {
            problems.push(`${where}/validity/by_code: does not add up to its errors and warnings`);
        }
        if (v.zero_errors !== (v.errors === 0)) {
            problems.push(
                `${where}/validity/zero_errors: ${String(v.zero_errors)} with ${String(v.errors)} errors`,
            );
        }
        if (v.no_warnings !== (v.warnings === 0)) {
            problems.push(
                `${where}/validity/no_warnings: ${String(v.no_warnings)} with ${String(v.warnings)} warnings`,
            );
        }
        if (v.in_format === style) {
            problems.push(
                `${where}/validity/in_format: ${String(v.in_format)}, but its style/ warnings say ${String(!style)}`,
            );
        }
        t.expectations.forEach((e, j) => {
            if (e.met !== (e.problem === null)) {
                problems.push(
                    `${where}/expectations/${String(j)}: met is ${String(e.met)} with problem ${JSON.stringify(e.problem)}`,
                );
            }
        });
        if (t.expectations_met !== t.expectations.every((e) => e.met)) {
            problems.push(
                `${where}/expectations_met: ${String(t.expectations_met)}, but its expectations say otherwise`,
            );
        }
        const j = t.judge;
        const dimensions = tasks
            .find((task) => task.name === t.task)
            ?.judged.map((d) => d.dimension);
        if (
            j.state === 'answered' &&
            dimensions !== undefined &&
            JSON.stringify(j.answers.map((a) => a.dimension)) !== JSON.stringify(dimensions)
        ) {
            problems.push(
                `${where}/judge/answers: not one answer per dimension its request asks, in order`,
            );
        }
        if (
            j.state === 'answered'
                ? j.answers.length === 0 || j.why !== null
                : j.answers.length > 0 || j.why === null
        ) {
            problems.push(
                `${where}/judge: the state ${j.state} does not agree with its answers and why`,
            );
        }
        if (j.answers.some((a) => !(JUDGE_ANSWERS as readonly string[]).includes(a.answer))) {
            problems.push(`${where}/judge/answers: an answer outside the closed set`);
        }
        const held = t.harness_problems.length === 0 && j.harness_problems.length === 0;
        if (t.harness_held !== held) {
            problems.push(
                `${where}/harness_held: ${String(t.harness_held)}, but its harness problems say ${String(held)}`,
            );
        }
        const expected = (numbers.get(t.task) ?? 0) + 1;
        if (t.trial !== expected) {
            problems.push(
                `${where}/trial: ${String(t.trial)} is not ${String(expected)} for ${t.task}`,
            );
        }
        numbers.set(t.task, t.trial);
    });
    const requests = tasks.map((task) => ({
        id: task.name,
        content_type: task.content_type,
        difficulty: task.difficulty,
        dimensions: task.judged.map((d) => d.dimension),
    }));
    const summary = summarize(trials, requests);
    if (JSON.stringify(tasks) !== JSON.stringify(summary.tasks)) {
        problems.push('/results/tasks: the measures per request do not agree with the trials');
    }
    if (JSON.stringify(results['overall']) !== JSON.stringify(summary.overall)) {
        problems.push(
            '/results/overall: the measures over all requests do not agree with the trials',
        );
    }
    const named = new Set(trials.map((t) => t.task));
    if (named.size !== tasks.length || !tasks.every((t) => named.has(t.name))) {
        problems.push(
            `/results/tasks: ${JSON.stringify(tasks.map((t) => t.name))}, but the trials are of ${JSON.stringify([...named])}`,
        );
    }
    return problems;
}
