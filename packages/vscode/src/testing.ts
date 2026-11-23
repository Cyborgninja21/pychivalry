/**
 * Test helpers for the extension's unit tests and editor tests, never shipped: running the
 * command line's launcher as a terminal runs it. No VS Code import.
 */

import { spawnSync } from 'node:child_process';
import { cmdInvocation } from './claude.js';

/** What a run of a launcher gave. */
export interface LauncherRun {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
}

/**
 * Run the launcher `file` with `args` in `cwd` as a terminal would, in `base` (this process's
 * environment by default) without the variable that makes VS Code run as Node, which the
 * launcher sets itself: `cmd.exe` runs a `.cmd`.
 */
export function runLauncher(
    file: string,
    args: readonly string[],
    cwd: string,
    base: Readonly<Record<string, string | undefined>> = process.env,
): LauncherRun {
    const how =
        process.platform === 'win32'
            ? cmdInvocation(file, args, process.env['ComSpec'] ?? 'cmd.exe')
            : { command: file, args };
    const env = Object.fromEntries(
        Object.entries(base).filter(
            (e): e is [string, string] =>
                e[1] !== undefined && e[0].toUpperCase() !== 'ELECTRON_RUN_AS_NODE',
        ),
    );
    const result = spawnSync(how.command, [...how.args], {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        windowsVerbatimArguments: process.platform === 'win32',
        windowsHide: true,
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
