/**
 * The guard in front of every launch of the game (docs/PLAN.md items 11.1 and 11.8; AGENTS.md
 * rule 9: game launches happen only on the analysis machine, on the owner's word;
 * docs/decisions.md, decision 194: no capture until he says).
 *
 * Nothing that starts the game runs without a flag naming the owner's word: the variable
 * `PYCHIVALRY_OWNERS_WORD` set to `decision <n>`, where row `<n>` of docs/decisions.md records
 * that word in the words this guard asks for, `the owner's word for a launch of the game on the
 * analysis machine`. A row that says something else, a number with no row, or no flag at all, and
 * the guard refuses before anything is read, written or started. It is checked first, every time.
 */

import { readFileSync } from 'node:fs';

/** The words a decision must hold to let a launch run. */
export const LAUNCH_WORDS = "the owner's word for a launch of the game on the analysis machine";

/** The variable that names the decision. */
export const OWNERS_WORD_VARIABLE = 'PYCHIVALRY_OWNERS_WORD';

/** A launch refused: no owner's word, or one that does not say a launch may run. */
export class LaunchRefused extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LaunchRefused';
    }
}

/** The decision a launch runs on: its number and its row. */
export interface OwnersWord {
    readonly decision: number;
    readonly row: string;
}

/**
 * The owner's word a launch runs on, read from `given` (the variable's value) and the decisions
 * page; throws `LaunchRefused` when there is none that says a launch may run.
 */
export function ownersWord(given: string | undefined, decisionsFile: string): OwnersWord {
    if (given === undefined || given.trim() === '') {
        throw new LaunchRefused(
            `no launch without the owner's word: set ${OWNERS_WORD_VARIABLE} to "decision <n>", the row of docs/decisions.md that records ${LAUNCH_WORDS}`,
        );
    }
    const m = /^decision (\d+)$/.exec(given.trim());
    if (m === null) {
        throw new LaunchRefused(
            `${OWNERS_WORD_VARIABLE} must be "decision <n>", the row of docs/decisions.md that records the owner's word; it is "${given}"`,
        );
    }
    const decision = Number(m[1]);
    const row = readFileSync(decisionsFile, 'utf8')
        .split(/\r?\n/)
        .find((line) => line.startsWith(`| ${String(decision)} |`));
    if (row === undefined) {
        throw new LaunchRefused(`docs/decisions.md has no decision ${String(decision)}`);
    }
    if (!row.includes(LAUNCH_WORDS)) {
        throw new LaunchRefused(
            `decision ${String(decision)} does not record ${LAUNCH_WORDS}: no launch`,
        );
    }
    return { decision, row };
}
