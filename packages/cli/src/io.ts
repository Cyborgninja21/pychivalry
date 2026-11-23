/**
 * What a command reads from and writes to: its output streams, the working folder, the
 * environment, where the spec package is, and how the game is found. The command line passes
 * the process's own (`processIo`); a test passes its own.
 */

import { findGameFolders, type SharedBase, type Spec } from '@pychivalry/core';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export interface Io {
    readonly stdout: (text: string) => void;
    readonly stderr: (text: string) => void;
    /** The folder relative paths are read from. */
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly platform: NodeJS.Platform;
    readonly home: string;
    /** The spec folder read when `--spec` is not given. */
    readonly specDir: string;
    /**
     * The game folder of the game `gameId` (the spec's `manifest.game`) when `--vanilla` is
     * not given, or null when it is not installed; by default every Steam library is searched.
     */
    readonly findGame: (gameId: string) => string | null;
    /**
     * A base game another program lends (docs/shared-index.md): a command that reads the base
     * game forks it instead of loading one (`openWorkspace`'s `base`). Only the program that
     * answers for the command line sets it.
     */
    readonly base?: SharedBase | undefined;
    /** How a spec folder is opened; the core's `openSpec` by default. */
    readonly openSpec?: ((dir: string) => Spec) | undefined;
}

/**
 * The spec folder beside this package in the repository: the committed package. The
 * extension that ships the command line (build step 7) keeps the spec as a data file beside
 * it and points here.
 */
export function defaultSpecDir(): string {
    return fileURLToPath(new URL('../../../spec/', import.meta.url));
}

/** The process's own streams, folder and environment, and Steam's libraries. */
export function processIo(): Io {
    const env = process.env;
    const platform = process.platform;
    const home = homedir();
    return {
        stdout: (text) => {
            process.stdout.write(text);
        },
        stderr: (text) => {
            process.stderr.write(text);
        },
        cwd: process.cwd(),
        env,
        platform,
        home,
        specDir: defaultSpecDir(),
        findGame: (gameId) => findGameFolders(gameId, { env, platform, home })[0] ?? null,
    };
}
