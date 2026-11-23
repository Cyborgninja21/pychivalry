/**
 * How the agent server is started: the one command line that VS Code's own AI, Claude Code and
 * the tests all use (docs/PLAN.md, item 7.1). No VS Code import, so it is tested without the
 * editor, with Linux and Windows inputs alike.
 *
 * The server is the bundled `pychivalry-mcp.mjs`, run by VS Code's own executable as Node
 * (`ELECTRON_RUN_AS_NODE=1`), so the user needs no Node of their own; VS Code's API says the
 * same of `process.execPath` ("Node.js-based servers may use `process.execPath` to use the
 * editor's version of Node.js"). It runs from the copy in the extension's global storage folder
 * (`install.ts`), whose path does not carry the extension's version, so an entry written into
 * Claude Code's configuration keeps working when the extension updates.
 */

import path from 'node:path';

/** The server's name in both harnesses' configurations. */
export const SERVER_NAME = 'pychivalry';

/** The bundled server's file, in the server folder. */
export const SERVER_FILE = 'pychivalry-mcp.mjs';

/** The spec package's folder, in the server folder. */
export const SPEC_FOLDER = 'spec';

/** The bundled command line's file, in the server folder beside the agent server. */
export const CLI_FILE = 'pychivalry-cli.mjs';

/** The bundled language server's folder in the extension, and its file. */
export const LSP_FOLDER = 'lsp';
export const LSP_FILE = 'pychivalry-lsp.mjs';

/** A command line that starts the server, as a harness's configuration states it. */
export interface ServerLaunch {
    /** The executable: VS Code's own, run as Node. */
    readonly command: string;
    /** The server file, then the server's own arguments. */
    readonly args: readonly string[];
    /** Variables set for the server, over the harness's own environment. */
    readonly env: Readonly<Record<string, string>>;
}

/** The path functions of one system: `path.posix` or `path.win32`. */
export type PathApi = Pick<path.PlatformPath, 'join' | 'sep' | 'isAbsolute'>;

/** The path functions of a platform. */
export function pathFor(platform: NodeJS.Platform): PathApi {
    return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * The command line for the server in `serverDir` on the mod in `modDir`, run by `runtime`. The
 * mod and the spec are named explicitly, so the entry works whatever folder a harness starts it
 * in. The game is `gameDir`, the folder the setting `pychivalry.gamePath` names (`--vanilla`),
 * or, when it is null, the server's own default, a search of every Steam library.
 */
export function serverLaunch(
    runtime: string,
    serverDir: string,
    modDir: string,
    paths: PathApi = path,
    gameDir: string | null = null,
): ServerLaunch {
    for (const [what, value] of [
        ['runtime', runtime],
        ['server folder', serverDir],
        ['mod folder', modDir],
        ['game folder', gameDir ?? serverDir],
    ] as const) {
        if (!paths.isAbsolute(value)) {
            throw new Error(`the ${what} must be an absolute path: ${value}`);
        }
    }
    return {
        command: runtime,
        args: [
            paths.join(serverDir, SERVER_FILE),
            '--mod',
            modDir,
            '--spec',
            paths.join(serverDir, SPEC_FOLDER),
            ...(gameDir === null ? [] : ['--vanilla', gameDir]),
        ],
        env: { ELECTRON_RUN_AS_NODE: '1' },
    };
}

/**
 * The game folder the setting `pychivalry.gamePath` gives the agent server: the setting's value
 * when it is an absolute path, otherwise null, which leaves the server to search every Steam
 * library. The language server reads the same setting and tells the person, once, when it names
 * no game folder (`@pychivalry/lsp`, `game.ts`); the agent server given such a folder refuses to
 * start and says why in the AI harness's log of it.
 */
export function gameFromSetting(value: unknown, paths: PathApi = path): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const dir = value.trim();
    return dir !== '' && paths.isAbsolute(dir) ? dir : null;
}

/**
 * A folder as a terminal started in it names it: on Windows VS Code gives a folder's drive letter
 * in lower case (`c:\mods`), where a terminal and Node's `process.cwd()` give it in upper case.
 * Claude Code keeps a local server under its project's folder, so the set-up and the entries
 * name the folder the way a Claude Code started in a terminal there will.
 */
export function folderPath(fsPath: string, platform: NodeJS.Platform): string {
    return platform === 'win32'
        ? fsPath.replace(/^([a-z]):/, (_m, d: string) => `${d.toUpperCase()}:`)
        : fsPath;
}

/**
 * The executable to write into a configuration that outlives this VS Code: `execPath`, or its
 * snap's `current` form. A snap runs from `/snap/<name>/<revision>/`, and a refresh moves it to
 * a new revision and later removes the old one; `/snap/<name>/current` always points at the
 * revision in use. Other installs keep one path across updates.
 */
export function stableRuntime(execPath: string, exists: (file: string) => boolean): string {
    const snap = /^\/snap\/([^/]+)\/(?:\d+|x\d+)\/(.+)$/.exec(execPath);
    if (snap === null) {
        return execPath;
    }
    const current = `/snap/${snap[1] ?? ''}/current/${snap[2] ?? ''}`;
    return exists(current) ? current : execPath;
}
