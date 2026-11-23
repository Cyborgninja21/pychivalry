/**
 * The command line's dispatch: `pychivalry <command> [arguments] [options]`, the usage text
 * (`--help`, `help`, `<command> --help`), the version (`--version`), and the exit codes. Bad
 * usage, and anything that keeps a command from running, is reported on standard error with
 * exit code 2.
 */

import { BaseRefused, drain, type Steps } from '@pychivalry/core';
import { InputError, parseArgs, UsageError } from './args.js';
import { EXIT, type Command } from './command.js';
import { COMMANDS } from './commands.js';
import type { Io } from './io.js';
import { TOOL, version } from './version.js';

function commandUsage(command: Command): string {
    const lines = [`usage: ${TOOL} ${command.name} ${command.args} [options]`, '', command.summary];
    if (command.options.length > 0) {
        lines.push('', 'Options:');
        const labels = command.options.map((o) =>
            o.value === undefined ? o.name : `${o.name} ${o.value}`,
        );
        const width = Math.max(...labels.map((l) => l.length));
        command.options.forEach((o, i) => {
            lines.push(`  ${(labels[i] ?? '').padEnd(width)}  ${o.help}`);
        });
    }
    return `${lines.join('\n')}\n`;
}

/** The usage text of the whole command line. */
export function usage(commands: readonly Command[] = COMMANDS): string {
    const labels = commands.map((c) => `${c.name} ${c.args}`);
    const width = Math.max(...labels.map((l) => l.length));
    const lines = [
        `usage: ${TOOL} <command> [arguments] [options]`,
        '',
        'Commands:',
        ...commands.map((c, i) => `  ${(labels[i] ?? '').padEnd(width)}  ${c.summary}`),
        '',
        `${TOOL} <command> --help shows a command's options.`,
        'Exit codes: 0 nothing wrong; 1 errors found (check), or a name or code not known (lookup, explain); 2 bad usage.',
    ];
    return `${lines.join('\n')}\n`;
}

/** Run the command line on `argv` (without the program's own name); returns the exit code. */
export function run(argv: readonly string[], io: Io, commands = COMMANDS): number {
    return drain(runSteps(argv, io, commands));
}

/**
 * `run` in steps (`Steps`): a command that reads a whole mod pauses after each file
 * (`Command.steps`). `BaseRefused`, when the base game `io.base` lends is not the one the
 * command asks for, is thrown, not reported: the command is then run by its own program.
 */
export function* runSteps(argv: readonly string[], io: Io, commands = COMMANDS): Steps<number> {
    const [name, ...rest] = argv;
    if (name === undefined) {
        io.stderr(usage(commands));
        return EXIT.usage;
    }
    if (name === '--help' || name === '-h' || name === 'help') {
        io.stdout(usage(commands));
        return EXIT.ok;
    }
    if (name === '--version') {
        io.stdout(`${TOOL} ${version}\n`);
        return EXIT.ok;
    }
    const command = commands.find((c) => c.name === name);
    if (command === undefined) {
        io.stderr(`${TOOL}: unknown command ${name}\n\n${usage(commands)}`);
        return EXIT.usage;
    }
    if (rest.includes('--help') || rest.includes('-h')) {
        io.stdout(commandUsage(command));
        return EXIT.ok;
    }
    try {
        const parsed = parseArgs(rest, command.options);
        const count = parsed.positionals.length;
        const { min, max } = command.positionals;
        if (count < min || (max !== null && count > max)) {
            throw new UsageError(
                count < min ? `${command.name} needs ${command.args}` : `too many arguments`,
            );
        }
        return command.steps === undefined
            ? command.run(parsed, io)
            : yield* command.steps(parsed, io);
    } catch (err) {
        if (err instanceof BaseRefused) {
            throw err;
        }
        if (err instanceof InputError) {
            io.stderr(`${TOOL} ${command.name}: ${err.message}\n`);
            return EXIT.usage;
        }
        if (err instanceof UsageError) {
            io.stderr(`${TOOL} ${command.name}: ${err.message}\n\n${commandUsage(command)}`);
            return EXIT.usage;
        }
        const message = err instanceof Error ? err.message : String(err);
        io.stderr(`${TOOL} ${command.name}: ${message}\n`);
        return EXIT.usage;
    }
}
