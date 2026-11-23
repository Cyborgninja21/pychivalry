/**
 * The command line on the path of VS Code's integrated terminal (docs/PLAN.md, item 7.7). No
 * VS Code import, so it is tested without the editor, with Linux and Windows inputs alike.
 *
 * The command line is bundled into one file, `pychivalry-cli.mjs`, beside the agent server and
 * its spec package; the extension copies that folder into its global storage folder
 * (`install.ts`). A small launcher named `pychivalry` runs it with VS Code's own executable as
 * Node (`ELECTRON_RUN_AS_NODE=1`), so the user needs no Node of their own: a shell script on
 * Linux, a `pychivalry.cmd` on Windows, which PowerShell and `cmd.exe` both find through
 * `PATHEXT`. The launchers are written into a `bin` folder of the global storage folder, whose
 * path does not change when the extension updates, and the extension puts that folder at the
 * front of the integrated terminal's `PATH` (VS Code's environment-variable collection).
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathFor } from './launch.js';

/** The command's name in the terminal. */
export const CLI_COMMAND = 'pychivalry';

/** The launchers' folder, in the extension's global storage folder. */
export const BIN_FOLDER = 'bin';

/** One launcher: its file name, its text and whether it must be executable. */
export interface Launcher {
    readonly file: string;
    readonly text: string;
    readonly executable: boolean;
}

/** A path inside single quotes for a POSIX shell: each `'` closed, escaped and opened again. */
function shQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * A path inside double quotes in a batch file: `cmd.exe` expands `%` even there, so it is
 * doubled; a double quote cannot appear in a Windows path.
 */
function cmdQuote(value: string): string {
    if (value.includes('"') || /[\r\n]/.test(value)) {
        throw new Error(`a path a batch file names cannot hold a quote or a line break: ${value}`);
    }
    return `"${value.replace(/%/g, '%%')}"`;
}

/** The launcher that runs `cliFile` with `runtime` as Node, on `platform`. */
export function launcherFor(runtime: string, cliFile: string, platform: NodeJS.Platform): Launcher {
    const paths = pathFor(platform);
    for (const [what, value] of [
        ['runtime', runtime],
        ['command line', cliFile],
    ] as const) {
        if (!paths.isAbsolute(value)) {
            throw new Error(`the ${what} must be an absolute path: ${value}`);
        }
    }
    if (platform === 'win32') {
        return {
            file: `${CLI_COMMAND}.cmd`,
            text: [
                '@echo off',
                'rem pychivalry: its command line, run by VS Code as Node. Written by the pychivalry extension.',
                'setlocal',
                'set ELECTRON_RUN_AS_NODE=1',
                `${cmdQuote(runtime)} ${cmdQuote(cliFile)} %*`,
                'exit /b %ERRORLEVEL%',
                '',
            ].join('\r\n'),
            executable: false,
        };
    }
    return {
        file: CLI_COMMAND,
        text: [
            '#!/bin/sh',
            '# pychivalry: its command line, run by VS Code as Node. Written by the pychivalry extension.',
            `ELECTRON_RUN_AS_NODE=1 exec ${shQuote(runtime)} ${shQuote(cliFile)} "$@"`,
            '',
        ].join('\n'),
        executable: true,
    };
}

/**
 * Write the launcher into `binDir` unless the one there is the same; returns its path and
 * whether it was written. The runtime's path changes when VS Code moves (a snap refresh is
 * avoided by `stableRuntime`), so the extension calls this on every activation.
 */
export function writeLauncher(
    binDir: string,
    runtime: string,
    cliFile: string,
    platform: NodeJS.Platform = process.platform,
): { readonly file: string; readonly written: boolean } {
    const launcher = launcherFor(runtime, cliFile, platform);
    const file = path.join(binDir, launcher.file);
    const same = existsSync(file) && readFileSync(file, 'utf8') === launcher.text;
    if (!same) {
        mkdirSync(binDir, { recursive: true });
        writeFileSync(file, launcher.text, 'utf8');
    }
    if (launcher.executable) {
        chmodSync(file, 0o755);
    }
    return { file, written: !same };
}
