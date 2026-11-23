/**
 * Helpers for the command line's tests: the command run in this process with streams it
 * captures, or as its own process; a temporary folder; and a stand-in game install. No test
 * reads the real game, and no test writes outside its temporary folder: the cache folder is
 * always one of its own. Not part of the package's surface.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaultSpecDir, type Io } from './io.js';
import { run } from './run.js';

/** The repository root: compiled tests live in `packages/cli/dist/`. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));

/** The command line's entry point, compiled. */
export const MAIN = fileURLToPath(new URL('./main.js', import.meta.url));

/** A temporary folder, removed when the test ends. */
export function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-cli-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

export function write(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** An environment whose cache folder, on every system, is `cache`. */
export function cacheEnv(cache: string): Record<string, string> {
    return { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache };
}

/**
 * A game install at `root`: its launcher settings stating the build and its game folder with
 * the given files (and `common/`). Returns the game folder.
 */
export function gameStub(
    root: string,
    files: Readonly<Record<string, string>> = {},
    build = '1.21.0.3',
): string {
    write(
        path.join(root, 'launcher', 'launcher-settings.json'),
        `${JSON.stringify({ gameId: 'ck3', rawVersion: build, dlcPath: '../game' })}\n`,
    );
    const game = path.join(root, 'game');
    mkdirSync(path.join(game, 'common'), { recursive: true });
    for (const [rel, text] of Object.entries(files)) {
        write(path.join(game, ...rel.split('/')), text);
    }
    return game;
}

export interface Result {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

/**
 * The command line run in this process. The cache folder is `cache`, the game is never looked
 * for in Steam unless `findGame` says where it is, and relative paths are read from `cwd`.
 */
export function runCli(
    argv: readonly string[],
    options: {
        readonly cache: string;
        readonly cwd?: string;
        readonly findGame?: (gameId: string) => string | null;
        readonly env?: Readonly<Record<string, string>>;
    },
): Result {
    let stdout = '';
    let stderr = '';
    const io: Io = {
        stdout: (text) => {
            stdout += text;
        },
        stderr: (text) => {
            stderr += text;
        },
        cwd: options.cwd ?? REPO_ROOT,
        env: { ...cacheEnv(options.cache), ...options.env },
        platform: process.platform,
        home: options.cache,
        specDir: defaultSpecDir(),
        findGame: options.findGame ?? (() => null),
    };
    const code = run(argv, io);
    return { code, stdout, stderr };
}

/**
 * The command line run as its own process, with its cache folder `cache`. A check must name
 * its game (`--vanilla` or `--no-vanilla`), so that no test looks for the real one.
 */
export function spawnCli(argv: readonly string[], cache: string): Result {
    if (argv[0] === 'check' && !argv.includes('--vanilla') && !argv.includes('--no-vanilla')) {
        throw new Error('a spawned check must name its game: --vanilla or --no-vanilla');
    }
    const r = spawnSync(process.execPath, [MAIN, ...argv], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: { ...process.env, ...cacheEnv(cache) },
        maxBuffer: 64 * 1024 * 1024,
    });
    return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
