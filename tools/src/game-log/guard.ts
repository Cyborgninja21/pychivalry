/**
 * The guard in front of every launch of the game (docs/PLAN.md items 11.1 and 11.8; AGENTS.md
 * rule 9: game launches happen only on the analysis machine, on the owner's word;
 * docs/decisions.md, decisions 194, 199 and 205).
 *
 * Nothing that starts the game runs without a flag naming the owner's word: the variable
 * `PYCHIVALRY_OWNERS_WORD` set to `decision <n>`, where row `<n>` of docs/decisions.md is a
 * decision of the area `Game launch` whose text opens with `On the owner's word`, holds the words
 * `LAUNCH_WORDS`, and names the command being started as `launchNaming` writes it: its task with
 * the variable set to that row (`task game:capture-log` with `PYCHIVALRY_OWNERS_WORD=decision 200`).
 * A row lets start only the commands it names so (decision 205): a row that mentions another
 * command, to leave it out, does not name it. A row of another area, one that only describes the
 * guard, one that names another command, a number with no row, or no flag at all, and the guard
 * refuses before anything is read, written or started. It is checked first, every time. It does
 * not count launches (decision 205 says why).
 */

import { readFileSync } from 'node:fs';

/** The words a decision must hold to let a launch run. */
export const LAUNCH_WORDS = "the owner's word for a launch of the game on the analysis machine";

/** The area a decision that lets a launch run is filed under. */
export const LAUNCH_AREA = 'Game launch';

/** The variable that names the decision. */
export const OWNERS_WORD_VARIABLE = 'PYCHIVALRY_OWNERS_WORD';

/** The commands that launch the game, each by its task (docs/game-log-capture.md). */
export const LAUNCH_COMMANDS = ['game:capture-log', 'scored:in-game-load'] as const;

/** A command that launches the game. */
export type LaunchCommand = (typeof LAUNCH_COMMANDS)[number];

/**
 * How a decision names a command it lets start: the task, with the variable set to that very
 * decision, `` `task game:capture-log` with `PYCHIVALRY_OWNERS_WORD=decision 200` ``.
 */
export function launchNaming(command: LaunchCommand, decision: number): string {
    return `\`task ${command}\` with \`${OWNERS_WORD_VARIABLE}=decision ${String(decision)}\``;
}

/** A launch refused: no owner's word, or one that does not say a launch may run. */
export class LaunchRefused extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LaunchRefused';
    }
}

/** The decision a launch runs on: its number, its row, and the command it lets start. */
export interface OwnersWord {
    readonly decision: number;
    readonly row: string;
    readonly command: LaunchCommand;
}

/**
 * The owner's word a launch of `command` runs on, read from `given` (the variable's value) and
 * the decisions page; throws `LaunchRefused` when there is none that says this command may start.
 */
export function ownersWord(
    given: string | undefined,
    decisionsFile: string,
    command: LaunchCommand,
): OwnersWord {
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
    // | n | date | area | decision |
    const cells = row.split('|').map((c) => c.trim());
    const area = cells[3] ?? '';
    const text = cells.slice(4).join('|');
    if (
        area !== LAUNCH_AREA ||
        !text.startsWith("On the owner's word") ||
        !text.includes(LAUNCH_WORDS)
    ) {
        throw new LaunchRefused(
            `decision ${String(decision)} does not record ${LAUNCH_WORDS}: no launch`,
        );
    }
    const naming = launchNaming(command, decision);
    if (!text.includes(naming)) {
        throw new LaunchRefused(
            `decision ${String(decision)} records the owner's word for a launch, but not of task ${command}: a decision lets a command start only when it names it as ${naming}; no launch`,
        );
    }
    return { decision, row, command };
}
