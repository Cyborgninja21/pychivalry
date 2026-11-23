/**
 * A command of the command line: its name, its arguments, its options and what it does.
 * The commands are one table (commands.ts); the usage text and the dispatch read it.
 */

import type { OptionSpec, Parsed } from './args.js';
import type { Io } from './io.js';

/** The exit codes: 0 nothing wrong, 1 something found (errors, unknown names), 2 bad usage. */
export const EXIT = { ok: 0, found: 1, usage: 2 } as const;

export interface Command {
    readonly name: string;
    /** Its arguments in the usage text: `<mod>`, `<code>...`. */
    readonly args: string;
    /** One line for the usage text. */
    readonly summary: string;
    readonly options: readonly OptionSpec[];
    /** How many positional arguments it takes; `max` null for no limit. */
    readonly positionals: { readonly min: number; readonly max: number | null };
    /** Run it; returns the exit code. Throws a `UsageError` on bad usage. */
    run(parsed: Parsed, io: Io): number;
}
