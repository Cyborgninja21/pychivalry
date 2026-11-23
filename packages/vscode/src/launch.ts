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
 * in; the game is the server's own default, a search of every Steam library.
 */
export function serverLaunch(
    runtime: string,
    serverDir: string,
    modDir: string,
    paths: PathApi = path,
): ServerLaunch {
    for (const [what, value] of [
        ['runtime', runtime],
        ['server folder', serverDir],
        ['mod folder', modDir],
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
        ],
        env: { ELECTRON_RUN_AS_NODE: '1' },
    };
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
