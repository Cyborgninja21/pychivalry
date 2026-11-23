/**
 * The record of a scored run (docs/PLAN.md item 6.10; records/README.md, "Scored records"): the
 * harness version, the model, per trial the tool calls, the tool errors and which graders passed,
 * and the pass rate per task. Its schema is `scoredResults` in records/record.schema.json;
 * `scoredProblems` is what `task records:check` adds to the schema: the figures agree with each
 * other.
 *
 * A scored record is not tied to the committed spec as a suite's record is: it states the spec
 * the run used, but a later spec does not fail it, because re-running it spends the login's
 * usage and is started only on the owner's word.
 */

import type { GameInfo } from '../game.js';
import type { CorpusRef, MachineInfo, SpecRef, ToolInfo } from '../record.js';
import { isObject } from '../util.js';
import { GRADERS } from './graders.js';

export const SCORED_SUITE = 'scored:agent-use';

/** One trial, as the record states it. */
export interface TrialRecord {
    readonly task: string;
    /** From 1. */
    readonly trial: number;
    /** No harness problem, and every grader passed. */
    readonly passed: boolean;
    /**
     * What ended the session: `finished` (it stopped by itself), `budget` (Claude Code's
     * `--max-budget-usd`), `turns`, `error` (it ended on another error), `timeout` (the run's
     * time limit), `no-result` (the stream has no end).
     */
    readonly stopped: 'finished' | 'budget' | 'turns' | 'error' | 'timeout' | 'no-result';
    /** What makes the trial say nothing about the server: a session that broke or was not confined. */
    readonly harness_problems: readonly string[];
    readonly graders: readonly {
        readonly name: string;
        readonly passed: boolean;
        readonly problems: readonly string[];
    }[];
    /** Per tool: how many calls, and how many of them ended in an error. */
    readonly tool_calls: readonly {
        readonly tool: string;
        readonly calls: number;
        readonly errors: number;
    }[];
    /** Each tool error, its text with the trial's folders named and no other path. */
    readonly tool_errors: readonly { readonly tool: string; readonly message: string }[];
    readonly permission_denials: number;
    /** The session's start: what it was offered. */
    readonly session: {
        readonly harness_version: string | null;
        readonly model: string | null;
        readonly permission_mode: string | null;
        readonly tools: readonly string[];
        readonly mcp_servers: readonly { readonly name: string; readonly status: string }[];
    } | null;
    readonly cost_usd: number | null;
    readonly turns: number | null;
    readonly duration_ms: number | null;
    readonly exit_code: number | null;
    /** What the checker still reports on the trial's mod, by severity. */
    readonly findings_left: {
        readonly error: number;
        readonly warning: number;
        readonly information: number;
        readonly hint: number;
    };
}

export interface ScoredResults {
    readonly task: {
        readonly name: string;
        readonly prompt_file: string;
        readonly prompt_sha256: string;
        readonly manifest_sha256: string;
        readonly fixture: string;
        readonly game: string;
        readonly defects: number;
        readonly look_alikes: number;
        readonly graders: readonly string[];
    };
    readonly harness: { readonly name: 'claude-code'; readonly version: string };
    readonly model: string;
    readonly budget_usd_per_trial: number;
    readonly timeout_minutes: number;
    /** Claude Code's arguments, the prompt and the configuration file named, not given. */
    readonly arguments: readonly string[];
    readonly server: { readonly entry: string; readonly arguments: readonly string[] };
    readonly trials: readonly TrialRecord[];
    /** Per task: trials, trials passed, and the pass rate (passed / trials, to 4 places). */
    readonly tasks: readonly {
        readonly name: string;
        readonly trials: number;
        readonly passed: number;
        readonly pass_rate: number;
    }[];
    /** The trials' costs added up, where known. */
    readonly cost_usd: number;
}

export interface ScoredRecord {
    readonly record_format: 1;
    readonly suite: typeof SCORED_SUITE;
    readonly command: string;
    readonly made_at: string;
    readonly tool: ToolInfo;
    readonly machine: MachineInfo;
    readonly game: GameInfo;
    readonly spec: SpecRef;
    readonly corpus: CorpusRef | null;
    readonly notes: readonly string[];
    readonly results: ScoredResults;
}

/** The pass rate a record states: passed / trials, to 4 decimal places; 0 for no trial. */
export function passRate(passed: number, trials: number): number {
    return trials === 0 ? 0 : Math.round((passed / trials) * 10000) / 10000;
}

/**
 * A scored record's figures that disagree with each other: a trial's `passed` with its graders
 * and harness problems, its graders with the five, the tasks' counts and pass rates with the
 * trials, and the total cost with the trials' costs.
 */
export function scoredProblems(results: unknown): string[] {
    if (!isObject(results)) {
        return [];
    }
    const problems: string[] = [];
    const trials = Array.isArray(results['trials']) ? results['trials'].filter(isObject) : [];
    trials.forEach((t, i) => {
        const where = `/results/trials/${String(i)}`;
        const graders = Array.isArray(t['graders']) ? t['graders'].filter(isObject) : [];
        const names = graders.map((g) => g['name']);
        if (names.join(',') !== GRADERS.join(',')) {
            problems.push(
                `${where}/graders: ${JSON.stringify(names)} are not the five graders in order`,
            );
        }
        graders.forEach((g, j) => {
            const listed = Array.isArray(g['problems']) ? g['problems'].length : 0;
            if (g['passed'] !== (listed === 0)) {
                problems.push(
                    `${where}/graders/${String(j)}/passed: ${JSON.stringify(g['passed'])} with ${String(listed)} problems`,
                );
            }
        });
        const harness = Array.isArray(t['harness_problems']) ? t['harness_problems'].length : 0;
        const expected = harness === 0 && graders.every((g) => g['passed'] === true);
        if (t['passed'] !== expected) {
            problems.push(
                `${where}/passed: ${JSON.stringify(t['passed'])}, but its graders and harness problems say ${String(expected)}`,
            );
        }
        if (t['trial'] !== i + 1) {
            problems.push(`${where}/trial: ${JSON.stringify(t['trial'])} is not ${String(i + 1)}`);
        }
    });
    const tasks = Array.isArray(results['tasks']) ? results['tasks'].filter(isObject) : [];
    const taskNames = new Set(trials.map((t) => t['task']));
    if (tasks.length !== taskNames.size || !tasks.every((t) => taskNames.has(t['name']))) {
        problems.push(
            `/results/tasks: ${JSON.stringify(tasks.map((t) => t['name']))}, but the trials are of ${JSON.stringify([...taskNames])}`,
        );
    }
    tasks.forEach((task, i) => {
        const mine = trials.filter((t) => t['task'] === task['name']);
        const passed = mine.filter((t) => t['passed'] === true).length;
        const where = `/results/tasks/${String(i)}`;
        if (task['trials'] !== mine.length) {
            problems.push(
                `${where}/trials: ${JSON.stringify(task['trials'])}, but ${String(mine.length)} trials are listed`,
            );
        }
        if (task['passed'] !== passed) {
            problems.push(
                `${where}/passed: ${JSON.stringify(task['passed'])}, but ${String(passed)} trials passed`,
            );
        }
        if (task['pass_rate'] !== passRate(passed, mine.length)) {
            problems.push(
                `${where}/pass_rate: ${JSON.stringify(task['pass_rate'])} is not ${String(passed)} / ${String(mine.length)} (${String(passRate(passed, mine.length))})`,
            );
        }
    });
    const cost = trials.reduce(
        (s, t) => s + (typeof t['cost_usd'] === 'number' ? t['cost_usd'] : 0),
        0,
    );
    if (results['cost_usd'] !== Math.round(cost * 1e6) / 1e6) {
        problems.push(
            `/results/cost_usd: ${JSON.stringify(results['cost_usd'])} is not the trials' total (${String(Math.round(cost * 1e6) / 1e6)})`,
        );
    }
    return problems;
}
