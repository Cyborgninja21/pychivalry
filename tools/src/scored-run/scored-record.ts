/**
 * The record of a scored run (docs/PLAN.md item 6.10; records/README.md, "Scored records"): the
 * harness version, the model, per trial the tool calls, the tool errors and which graders passed,
 * and per task the pass rate, the owner's target and whether the run met it. Its schema is `scoredResults` in records/record.schema.json;
 * `scoredProblems` is what `task records:check` adds to the schema: the figures agree with each
 * other.
 *
 * A scored record is not tied to the committed spec as a suite's record is: it states the spec
 * the run used, but a later spec does not fail it, because making it again means new test
 * sessions of Claude Code, which are started only on the owner's word.
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
     * What ended the session: `finished` (it stopped by itself), `session-limit` (Claude Code
     * ended it at the session limit), `turns`, `error` (it ended on another error), `timeout`
     * (the run's time limit), `no-result` (the stream has no end).
     */
    readonly stopped: 'finished' | 'session-limit' | 'turns' | 'error' | 'timeout' | 'no-result';
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
        /** The skills offered, by name: none, when the session is confined. */
        readonly skills: readonly string[];
        /**
         * The plugins loaded, each by its source (`<name>@<marketplace>`) or name: when the
         * session is confined, only Claude Code's own (`<name>@builtin`).
         */
        readonly plugins: readonly string[];
    } | null;
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
    /** The session limit each test session was given (`SCORED_SESSION_LIMIT`). */
    readonly session_limit: number;
    readonly timeout_minutes: number;
    /** Claude Code's arguments, the prompt and the configuration file named, not given. */
    readonly arguments: readonly string[];
    readonly server: {
        readonly entry: string;
        readonly arguments: readonly string[];
        /** The agent server's tool schema version; absent in a record made before it was named (`SERVER_SCHEMA_VERSION`). */
        readonly schema_version?: number;
    };
    readonly trials: readonly TrialRecord[];
    /**
     * Per task: trials, trials passed, the pass rate (passed / trials, to 4 places), and the
     * target and whether the run met it (`targetOf`). A record made before the owner set the
     * target (item 6.11's) has none.
     */
    readonly tasks: readonly {
        readonly name: string;
        readonly trials: number;
        readonly passed: number;
        readonly pass_rate: number;
        readonly target?: TaskTarget;
    }[];
}

/**
 * The owner's target for the agent-use test (docs/decisions.md, decision 82): every test
 * session passes. A release run is `RELEASE_TRIALS` test sessions and must pass all of them; a
 * development run (`DEFAULT_TRIALS` in run.ts, 5) that passes fewer than all is looked into.
 */
export const RELEASE_TRIALS = 10;

/** A task's target, as its record states it. */
export interface TaskTarget {
    /** What the run is: `release` with `RELEASE_TRIALS` trials or more, else `development`. */
    readonly run: 'release' | 'development';
    /** The trials that must pass: all of them. */
    readonly needs: number;
    /** True when the run met it: every trial passed. */
    readonly met: boolean;
}

/** The target of a run of `trials` test sessions of which `passed` passed. */
export function targetOf(passed: number, trials: number): TaskTarget {
    return {
        run: trials >= RELEASE_TRIALS ? 'release' : 'development',
        needs: trials,
        met: trials > 0 && passed === trials,
    };
}

/** The target in words, for the person running the test. */
export function targetText(target: TaskTarget, passed: number): string {
    const met = target.met ? 'met' : 'not met';
    return target.run === 'release'
        ? `release target (every test session passes, ${String(target.needs)} of ${String(target.needs)}): ${met}`
        : `development target (every test session passes; fewer is looked into): ${String(passed)} of ${String(target.needs)}, ${met}`;
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
 * and harness problems, its graders with the five, and the tasks' counts, pass rates and
 * targets with the trials.
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
        const target = task['target'];
        if (target !== undefined) {
            const expected = targetOf(passed, mine.length);
            if (JSON.stringify(target) !== JSON.stringify(expected)) {
                problems.push(
                    `${where}/target: ${JSON.stringify(target)}, but ${String(passed)} of ${String(mine.length)} trials passed: ${JSON.stringify(expected)}`,
                );
            }
        }
    });
    return problems;
}
