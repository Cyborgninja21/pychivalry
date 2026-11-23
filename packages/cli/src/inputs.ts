/**
 * The inputs several commands share: the spec package (`--spec`), the game folder
 * (`--vanilla`, `--no-vanilla`, or Steam's libraries) and JSON output (`--json`). Each is
 * read the same way by every command that takes it.
 */

import { isGameFolder, openSpec, packageFileIn, SpecError, type Spec } from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { InputError, oneValue, UsageError, type OptionSpec, type Parsed } from './args.js';
import type { Io } from './io.js';

export const SPEC_OPTION: OptionSpec = {
    name: '--spec',
    value: '<file>',
    help: 'the spec package file (ck3-spec-<version>.json.gz, its .sha256 beside it) or its folder; by default the one pychivalry ships',
};
export const VANILLA_OPTION: OptionSpec = {
    name: '--vanilla',
    value: '<game>',
    help: "the game's game folder (the one holding common/); by default the game is looked for in every Steam library",
};
export const NO_VANILLA_OPTION: OptionSpec = {
    name: '--no-vanilla',
    help: 'run without the base game: names the game defines are not judged',
};
export const JSON_OPTION: OptionSpec = {
    name: '--json',
    help: 'one JSON object per line instead of text',
};

function isDirectory(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory();
}

/**
 * The spec package `--spec` names, or the one pychivalry ships. A file must be the one package
 * file of its folder; a folder must hold exactly one.
 */
export function readSpecOption(parsed: Parsed, io: Io): Spec {
    const given = oneValue(parsed, '--spec');
    const target = given === undefined ? io.specDir : path.resolve(io.cwd, given);
    try {
        if (isDirectory(target)) {
            return openSpec(target);
        }
        if (!existsSync(target)) {
            throw new InputError(`--spec: no such file: ${target}`);
        }
        const dir = path.dirname(target);
        const { file } = packageFileIn(dir);
        if (file !== path.basename(target)) {
            throw new InputError(
                `--spec: ${path.basename(target)} is not a spec package file (ck3-spec-<version>.json.gz)`,
            );
        }
        return openSpec(dir);
    } catch (err) {
        if (err instanceof SpecError) {
            throw new InputError(`the spec package cannot be read: ${err.message}`);
        }
        throw err;
    }
}

/** How the game folder was chosen. */
export type GameSource = 'vanilla' | 'steam';

export interface GameChoice {
    /** The game folder, or null to run without the base game. */
    readonly dir: string | null;
    /** How it was chosen, or null when there is none. */
    readonly source: GameSource | null;
    /** True when the game was looked for in Steam's libraries and not found. */
    readonly notFound: boolean;
}

/** The game folder: `--vanilla`, none with `--no-vanilla`, otherwise Steam's libraries. */
export function readGameOption(parsed: Parsed, io: Io, spec: Spec): GameChoice {
    const given = oneValue(parsed, '--vanilla');
    if (parsed.flags.has('--no-vanilla')) {
        if (given !== undefined) {
            throw new UsageError('--vanilla and --no-vanilla cannot both be given');
        }
        return { dir: null, source: null, notFound: false };
    }
    if (given !== undefined) {
        const dir = path.resolve(io.cwd, given);
        if (!isGameFolder(dir)) {
            const inside = path.join(dir, 'game');
            throw new InputError(
                isGameFolder(inside)
                    ? `--vanilla: ${dir} is the install; its game folder is ${inside}`
                    : `--vanilla: ${dir} is not a game folder (it has no common/ folder)`,
            );
        }
        return { dir, source: 'vanilla', notFound: false };
    }
    const found = io.findGame(spec.data.manifest.game);
    return found === null
        ? { dir: null, source: null, notFound: true }
        : { dir: found, source: 'steam', notFound: false };
}
