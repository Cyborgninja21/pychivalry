/**
 * The server's own command-line arguments, read once when it starts: which mod, which game,
 * which spec package. A harness starts it as `pychivalry-mcp [--mod <folder>] [--vanilla
 * <game> | --no-vanilla] [--spec <file or folder>]`.
 *
 * - `--mod`: the mod folder; by default the folder the server is started in, which is the
 *   workspace for Claude Code and VS Code.
 * - `--vanilla`: the game's `game` folder; by default the game is looked for in every Steam
 *   library. `--no-vanilla` runs without it: names the game defines are not judged.
 * - `--spec`: another spec package file or its folder; by default the one pychivalry ships.
 *
 * Bad arguments stop the server before it speaks the protocol, with the reason on standard
 * error and exit code 2: a harness shows a server that failed to start in its own log.
 */

import {
    defaultCacheDir,
    findGameFolders,
    isGameFolder,
    openSpec,
    packageFileIn,
    SpecError,
    type Spec,
} from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameChoice, SessionOptions } from './session.js';

/** Bad arguments: the server does not start. */
export class UsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsageError';
    }
}

export const USAGE =
    'usage: pychivalry-mcp [--mod <folder>] [--vanilla <game folder> | --no-vanilla] [--spec <file or folder>]';

/** What the server reads its arguments and surroundings from; a test passes its own. */
export interface Surroundings {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly platform: NodeJS.Platform;
    readonly home: string;
    /** The spec folder read when `--spec` is not given. */
    readonly specDir: string;
    /** The game folder of the game `gameId`, or null; by default every Steam library is searched. */
    readonly findGame: (gameId: string) => string | null;
}

/**
 * The spec folder of the repository, beside this package: the committed package. The
 * extension that ships the server (build step 7) keeps the spec as a data file beside it.
 */
export function defaultSpecDir(): string {
    return fileURLToPath(new URL('../../../spec/', import.meta.url));
}

/** The process's own folder, environment and Steam libraries. */
export function processSurroundings(): Surroundings {
    const env = process.env;
    const platform = process.platform;
    const home = homedir();
    return {
        cwd: process.cwd(),
        env,
        platform,
        home,
        specDir: defaultSpecDir(),
        findGame: (gameId) => findGameFolders(gameId, { env, platform, home })[0] ?? null,
    };
}

function isDirectory(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory();
}

/** The options given, each once at most. */
function readOptions(argv: readonly string[]): Map<string, string | true> {
    const valued = new Set(['--mod', '--vanilla', '--spec']);
    const flags = new Set(['--no-vanilla']);
    const out = new Map<string, string | true>();
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] ?? '';
        if (out.has(arg)) {
            throw new UsageError(`${arg} is given twice`);
        }
        if (valued.has(arg)) {
            const value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new UsageError(`${arg} needs a value`);
            }
            out.set(arg, value);
            i++;
        } else if (flags.has(arg)) {
            out.set(arg, true);
        } else {
            throw new UsageError(`unknown argument: ${arg}`);
        }
    }
    return out;
}

function specFrom(given: string | undefined, where: Surroundings): Spec {
    const target = given === undefined ? where.specDir : path.resolve(where.cwd, given);
    try {
        if (isDirectory(target)) {
            return openSpec(target);
        }
        if (!existsSync(target)) {
            throw new UsageError(`--spec: no such file: ${target}`);
        }
        const dir = path.dirname(target);
        if (packageFileIn(dir).file !== path.basename(target)) {
            throw new UsageError(
                `--spec: ${path.basename(target)} is not a spec package file (ck3-spec-<version>.json.gz)`,
            );
        }
        return openSpec(dir);
    } catch (err) {
        if (err instanceof SpecError) {
            throw new UsageError(`the spec package cannot be read: ${err.message}`);
        }
        throw err;
    }
}

function gameFrom(
    options: Map<string, string | true>,
    where: Surroundings,
    spec: Spec,
): GameChoice {
    const given = options.get('--vanilla');
    if (options.has('--no-vanilla')) {
        if (given !== undefined) {
            throw new UsageError('--vanilla and --no-vanilla cannot both be given');
        }
        return { dir: null, source: null, notFound: false };
    }
    if (typeof given === 'string') {
        const dir = path.resolve(where.cwd, given);
        if (!isGameFolder(dir)) {
            throw new UsageError(
                `--vanilla: ${dir} is not a game folder (it has no common/ folder)`,
            );
        }
        return { dir, source: 'vanilla', notFound: false };
    }
    const found = where.findGame(spec.data.manifest.game);
    return found === null
        ? { dir: null, source: null, notFound: true }
        : { dir: found, source: 'steam', notFound: false };
}

/** The session the arguments describe; `UsageError` when they cannot be used. */
export function sessionOptions(argv: readonly string[], where: Surroundings): SessionOptions {
    const options = readOptions(argv);
    const mod = options.get('--mod');
    const modDir = path.resolve(where.cwd, typeof mod === 'string' ? mod : '.');
    if (!isDirectory(modDir)) {
        throw new UsageError(`--mod: not a folder: ${modDir}`);
    }
    const specGiven = options.get('--spec');
    const spec = specFrom(typeof specGiven === 'string' ? specGiven : undefined, where);
    return {
        spec,
        modDir,
        game: gameFrom(options, where, spec),
        cacheDir: defaultCacheDir(where.env, where.platform, where.home),
        place: { env: where.env, platform: where.platform, home: where.home },
    };
}
