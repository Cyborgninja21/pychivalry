/**
 * `source <layer> <file> <line>`: the text around a place a result named, from the base game's
 * own files or the mod's, read-only (the owner's decision of 2026-11-25): the same reading as the
 * agent server's `source` tool, from the same core code (`readSource`), so that the terminal and
 * the agent server show the same lines, refuse the same places and keep the same limits.
 *
 * A place is given as every result writes it: its layer (`game`, `jomini`, `clausewitz`,
 * `dlc:<pack>`, or `mod` with `--mod`), its file's path inside that layer with `/`, and its line,
 * counted from 1; `--end-line` for a place of several lines, `--context` for the lines around it.
 * Only a script or localization file the index reads is shown, never an address on disk.
 *
 * The base game is found as `lookup` finds it (`--vanilla`, `--no-vanilla`, or Steam's
 * libraries), but nothing is indexed: the folders are listed as the index would list them
 * (`openSources`), and one file is read.
 *
 * Exit codes: 0 when the lines are shown; 1 when no such place is read (a layer not read, a file
 * its layer does not list, a link, a file outside its layer's folder, a line past the end); 2 on
 * bad usage, which includes a place no game or mod could hold (an absolute path, a `..`, a
 * backslash, a line before 1).
 */

import {
    openSources,
    readSource,
    SourceRefused,
    type SourceArgument,
    type SourceExcerpt,
} from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { InputError, oneValue, type OptionSpec, type Parsed } from './args.js';
import { EXIT, type Command } from './command.js';
import {
    JSON_OPTION,
    readGameOption,
    readSpecOption,
    SPEC_OPTION,
    VANILLA_OPTION,
    type GameChoice,
} from './inputs.js';
import type { Io } from './io.js';
import { TOOL } from './version.js';

const END_LINE_OPTION: OptionSpec = {
    name: '--end-line',
    value: '<line>',
    help: 'the last line of the place, for a place of several lines; the line given when left out',
};
const CONTEXT_OPTION: OptionSpec = {
    name: '--context',
    value: '<lines>',
    help: 'how many lines to show before and after the place, 0 to 20; 10 by default, fewer when the 40 lines shown would be passed',
};
const NO_VANILLA_OPTION: OptionSpec = {
    name: '--no-vanilla',
    help: 'read no base game: only the layer mod, with --mod',
};
const MOD_OPTION: OptionSpec = {
    name: '--mod',
    value: '<mod>',
    help: 'a mod folder, whose script and localization files are then read as the layer mod',
};

/** Each argument the core names, as this command takes it. */
const ARGUMENT: Readonly<Record<SourceArgument, string>> = {
    layer: '<layer>',
    file: '<file>',
    line: '<line>',
    end_line: '--end-line',
    context: '--context',
};

/** A whole number as given, or bad usage naming the argument. */
function wholeNumber(given: string, argument: string): number {
    if (!/^[0-9]+$/.test(given)) {
        throw new InputError(`${argument}: ${given} is not a whole number`);
    }
    return Number(given);
}

function optionalNumber(parsed: Parsed, name: string): number | undefined {
    const given = oneValue(parsed, name);
    return given === undefined ? undefined : wholeNumber(given, name);
}

function isDirectory(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory();
}

/** What to do about a layer that is not read here, when this command can say. */
function layerHint(layer: string, game: GameChoice, modDir: string | null): string | null {
    if (layer === 'mod' && modDir === null) {
        return `${TOOL}: the layer mod is read only with --mod <mod>`;
    }
    if (layer !== 'mod' && game.dir === null && game.notFound) {
        return `${TOOL}: the game was not found in any Steam library and --vanilla was not given: give its game folder with --vanilla <game>`;
    }
    return null;
}

export const sourceCommand: Command = {
    name: 'source',
    args: '<layer> <file> <line>',
    summary:
        "The text around a place a result named: the base game's own script or localization, or the mod's, at most 40 lines",
    options: [
        END_LINE_OPTION,
        CONTEXT_OPTION,
        MOD_OPTION,
        VANILLA_OPTION,
        NO_VANILLA_OPTION,
        SPEC_OPTION,
        JSON_OPTION,
    ],
    positionals: { min: 3, max: 3 },
    run(parsed: Parsed, io: Io): number {
        const [layer = '', file = '', lineGiven = ''] = parsed.positionals;
        const line = wholeNumber(lineGiven, ARGUMENT.line);
        const endLine = optionalNumber(parsed, '--end-line');
        const context = optionalNumber(parsed, '--context');
        const given = oneValue(parsed, '--mod');
        const modDir = given === undefined ? null : path.resolve(io.cwd, given);
        if (modDir !== null && !isDirectory(modDir)) {
            throw new InputError(`--mod: not a folder: ${modDir}`);
        }
        const spec = readSpecOption(parsed, io);
        const game = readGameOption(parsed, io, spec);
        const json = parsed.flags.has('--json');
        let excerpt: SourceExcerpt;
        try {
            excerpt = readSource(openSources({ spec, gameDir: game.dir, modDir }), {
                layer,
                file,
                line,
                endLine,
                context,
            });
        } catch (err) {
            if (!(err instanceof SourceRefused)) {
                throw err;
            }
            const message = `${ARGUMENT[err.argument]}: ${err.message}`;
            if (err.kind === 'form') {
                throw new InputError(message);
            }
            const hint = err.argument === 'layer' ? layerHint(layer, game, modDir) : null;
            io.stderr(`${TOOL} source: ${message}\n${hint === null ? '' : `${hint}\n`}`);
            return EXIT.found;
        }
        if (json) {
            io.stdout(
                `${JSON.stringify({
                    layer: excerpt.layer,
                    file: excerpt.file,
                    line: excerpt.from,
                    end_line: excerpt.to,
                    line_count: excerpt.lineCount,
                    lines: excerpt.lines,
                    cut_lines: excerpt.cutLines,
                    encoding: excerpt.encoding,
                    notes: excerpt.notes,
                })}\n`,
            );
            return EXIT.ok;
        }
        const read = excerpt.encoding === 'utf-8' ? '' : ` (${excerpt.encoding})`;
        io.stdout(
            [
                `${excerpt.layer} ${excerpt.file}, lines ${String(excerpt.from)} to ${String(excerpt.to)} of ${String(excerpt.lineCount)}${read}`,
                ...excerpt.lines,
                '',
            ].join('\n'),
        );
        for (const note of excerpt.notes) {
            io.stderr(`${TOOL} source: ${note}\n`);
        }
        if (game.notFound) {
            io.stderr(
                `${TOOL}: the game was not found in any Steam library and --vanilla was not given: only the mod was read\n`,
            );
        }
        return EXIT.ok;
    },
};
