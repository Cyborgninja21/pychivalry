/**
 * The command line's arguments: options are `--name` (a flag) or `--name <value>` (also
 * `--name=<value>`), given once or, where an option says so, several times; everything else
 * is a positional argument, and `--` ends the options. A mistake is a `UsageError`, which the
 * command line reports with exit code 2.
 */

/** An option a command takes. */
export interface OptionSpec {
    /** `--json`. */
    readonly name: string;
    /** The value's placeholder in the usage text (`<game>`); absent for a flag. */
    readonly value?: string;
    /** True when the option may be given several times; its values add up. */
    readonly repeat?: boolean;
    /** One line for the usage text. */
    readonly help: string;
}

/** A command's arguments, read. */
export interface Parsed {
    readonly positionals: readonly string[];
    /** The flags given. */
    readonly flags: ReadonlySet<string>;
    /** The values of each option given, in order. */
    readonly values: ReadonlyMap<string, readonly string[]>;
}

/** Bad usage: an unknown option, a missing value, a wrong number of arguments. */
export class UsageError extends Error {
    override name = 'UsageError';
}

/**
 * An input that cannot be used: a mod that is not a folder, a game or spec folder that cannot
 * be read. Exit code 2, as for bad usage, but without the usage text.
 */
export class InputError extends UsageError {
    override name = 'InputError';
}

/** Read `argv` against the options a command takes. */
export function parseArgs(argv: readonly string[], options: readonly OptionSpec[]): Parsed {
    const byName = new Map(options.map((o) => [o.name, o]));
    const positionals: string[] = [];
    const flags = new Set<string>();
    const values = new Map<string, string[]>();
    let ended = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] ?? '';
        if (ended || !arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        if (arg === '--') {
            ended = true;
            continue;
        }
        const eq = arg.indexOf('=');
        const name = eq < 0 ? arg : arg.slice(0, eq);
        const option = byName.get(name);
        if (option === undefined) {
            throw new UsageError(`unknown option ${name}`);
        }
        if (option.value === undefined) {
            if (eq >= 0) {
                throw new UsageError(`${name} takes no value`);
            }
            flags.add(name);
            continue;
        }
        let value: string | undefined;
        if (eq >= 0) {
            value = arg.slice(eq + 1);
        } else {
            value = argv[i + 1];
            i++;
        }
        if (value === undefined) {
            throw new UsageError(`${name} needs a value: ${name} ${option.value}`);
        }
        const given = values.get(name);
        if (given !== undefined && option.repeat !== true) {
            throw new UsageError(`${name} is given more than once`);
        }
        values.set(name, [...(given ?? []), value]);
    }
    return { positionals, flags, values };
}

/** The values of an option that takes comma-separated lists, each value trimmed. */
export function listValues(parsed: Parsed, name: string): string[] {
    return (parsed.values.get(name) ?? [])
        .flatMap((v) => v.split(','))
        .map((v) => v.trim())
        .filter((v) => v !== '');
}

/** The one value of an option, or undefined when it was not given. */
export function oneValue(parsed: Parsed, name: string): string | undefined {
    return parsed.values.get(name)?.[0];
}
