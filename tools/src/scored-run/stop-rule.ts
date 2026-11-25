/**
 * When a scored authoring run stops (tools/scored-run/README.md, "When a run stops"; docs/PLAN.md
 * item 9.8). A trial whose harness did not hold says nothing about pychivalry, but it does not
 * always say anything about the trials after it either: a session that ran to its end and once
 * named a file outside its mod, refused or failed, is one session's choice, and the next session
 * is a fresh one. The run stops only when the trials after it would most likely say as little:
 *
 * 1. a session was **not set up** as the run asks: what it was offered at its start (its tools,
 *    the agent server and its tools, the skills, the plugins), or a start the stream does not
 *    show, for the authoring session or the judge's. Every later trial is set up the same way;
 * 2. the run's **first trial** did not hold because a session **broke**: it did not end by itself
 *    (an error, the time limit, no result) or the judge's session did not answer. A first trial
 *    that breaks is most likely the run's own set-up (a session given a configuration folder with
 *    no sign-in ends on an error before any model is reached);
 * 3. **`NOT_HELD_IN_A_ROW` trials in a row** did not hold, whatever the reason: something the run
 *    shares has most likely gone wrong.
 *
 * Otherwise the run carries on. The trial stays in the record as not held, with its reasons; it
 * is never counted as a success (`authoring-targets.ts`), and a run continuing the record tries
 * its request again (`SCORED_CONTINUE`). The rule reads the trials of this run only, in the order
 * they were made: a continued run's first trial is its own first.
 */

import type { Stopped } from './confinement.js';

/** The ends of a session that ended by itself: its result is what the session chose to leave. */
export const ENDED_BY_ITSELF: readonly Stopped[] = ['finished', 'session-limit', 'turns'];

/** How many trials in a row that did not hold stop a run. */
export const NOT_HELD_IN_A_ROW = 3;

/** What the stop rule reads of one trial. */
export interface TrialOutcome {
    /** Whether its harness held. */
    readonly held: boolean;
    /**
     * The problems of a session's set-up, the authoring session's and the judge's: what it was
     * offered at its start, or no start in its stream. Empty when both were set up as asked.
     */
    readonly setUp: readonly string[];
    /** A session broke: the authoring session did not end by itself, or the judge's had a problem. */
    readonly broke: boolean;
}

/**
 * Why the run stops after the last of `outcomes`, the trials of this run so far in the order they
 * were made; null when it carries on.
 */
export function stopReason(outcomes: readonly TrialOutcome[]): string | null {
    const last = outcomes.at(-1);
    if (last === undefined || last.held) {
        return null;
    }
    if (last.setUp.length > 0) {
        return `its session was not set up as the run asks (${last.setUp.join('; ')}), and every trial after it would be set up the same way`;
    }
    if (outcomes.length === 1 && last.broke) {
        return "it was the run's first trial and a session of it broke, which the run's own set-up most likely caused";
    }
    const lastFew = outcomes.slice(-NOT_HELD_IN_A_ROW);
    if (lastFew.length === NOT_HELD_IN_A_ROW && lastFew.every((o) => !o.held)) {
        return `it ended ${String(NOT_HELD_IN_A_ROW)} trials in a row whose harness did not hold, so something the trials share has most likely gone wrong`;
    }
    return null;
}
