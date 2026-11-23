/**
 * Claude Code's own command, `claude`, as "Set up for Claude Code" uses it (docs/PLAN.md, item
 * 7.8): where it is, the arguments that add the agent server to Claude Code's configuration for
 * one folder, and how to run it on Linux and Windows. No VS Code import.
 *
 * Claude Code reads its own configuration, not what an extension registers with VS Code
 * (docs/MVP.md, "AI help inside VS Code"). `claude mcp add --scope local` writes the server into
 * that configuration for one project folder, private to the user: the entry names paths on this
 * computer, so it belongs in no file a mod shares. Checked against Claude Code's documentation
 * ("Connect Claude Code to tools via MCP") and `claude mcp add --help` of 2.1.220, 2026-11-23:
 * the options come before the name, `--env` takes several values so another option follows it,
 * and everything after `--` is the server's command line, passed on untouched.
 *
 * On Windows an npm install of Claude Code is a `claude.cmd` file, which only `cmd.exe` can run
 * and which hands its arguments on with `%*` to a second command line. Its arguments are quoted
 * for the program at the end (the rules of `CommandLineToArgvW`) and then every character
 * `cmd.exe` treats specially is escaped with `^`, twice, once for each command line, following
 * the method set out at https://qntm.org/cmd. Claude Code's own Windows installer gives a
 * `claude.exe`, which is run directly.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { SERVER_NAME, type ServerLaunch } from './launch.js';

/** The `claude` command found. */
export interface ClaudeCommand {
    readonly file: string;
    /** A `.cmd` or `.bat` file, run through `cmd.exe`. */
    readonly viaCmd: boolean;
}

/** Where to look for `claude`, as a test or the extension host gives it. */
export interface SearchPlace {
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly platform: NodeJS.Platform;
    readonly home: string;
    /** Whether `file` is a file this user may run. */
    readonly isExecutable: (file: string) => boolean;
}

/** An environment variable, read without regard to letter case on Windows. */
export function envValue(
    env: Readonly<Record<string, string | undefined>>,
    name: string,
    platform: NodeJS.Platform,
): string | undefined {
    if (platform !== 'win32') {
        return env[name];
    }
    const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
    return key === undefined ? undefined : env[key];
}

/**
 * The `claude` command: the first on the search path (on Windows, the first of each folder's
 * `PATHEXT` endings), else the file Claude Code's own installer puts in `~/.local/bin`, which a
 * VS Code started before the install may not have on its path.
 */
export function findClaude(where: SearchPlace): ClaudeCommand | null {
    const win = where.platform === 'win32';
    const paths = win ? path.win32 : path.posix;
    const list = envValue(where.env, 'PATH', where.platform) ?? '';
    const folders = list
        .split(win ? ';' : ':')
        .map((f) => f.trim().replace(/^"(.*)"$/, '$1'))
        .filter((f) => f !== '' && paths.isAbsolute(f));
    const endings = win
        ? (envValue(where.env, 'PATHEXT', where.platform) ?? '.COM;.EXE;.BAT;.CMD')
              .split(';')
              .map((e) => e.trim().toLowerCase())
              .filter((e) => e.startsWith('.'))
        : [''];
    const found = (file: string): ClaudeCommand => ({
        file,
        viaCmd: win && /\.(?:cmd|bat)$/i.test(file),
    });
    for (const folder of folders) {
        for (const ending of endings) {
            const file = paths.join(folder, `claude${ending}`);
            if (where.isExecutable(file)) {
                return found(file);
            }
        }
    }
    const installed = paths.join(where.home, '.local', 'bin', win ? 'claude.exe' : 'claude');
    return where.isExecutable(installed) ? found(installed) : null;
}

/** The arguments that add the server for the folder `claude` runs in, private to the user. */
export function addArgs(launch: ServerLaunch, name: string = SERVER_NAME): string[] {
    const env = Object.entries(launch.env).flatMap(([k, v]) => ['--env', `${k}=${v}`]);
    return [
        'mcp',
        'add',
        '--scope',
        'local',
        ...env,
        '--transport',
        'stdio',
        name,
        '--',
        launch.command,
        ...launch.args,
    ];
}

/** The arguments that remove an earlier entry of the same name, before it is added again. */
export function removeArgs(name: string = SERVER_NAME): string[] {
    return ['mcp', 'remove', '--scope', 'local', name];
}

/** The characters `cmd.exe` treats specially, each escaped with `^`. */
const CMD_SPECIAL = /([()[\]%!^"`<>&|;, *?])/g;

/**
 * One argument for a program a `.cmd` file runs with `%*`: quoted by the rules of
 * `CommandLineToArgvW` (backslashes before a quote and at the end doubled, quotes escaped with a
 * backslash), then each `cmd.exe` special character escaped twice. A line break cannot be passed
 * through `cmd.exe` at all.
 */
export function cmdArgument(arg: string): string {
    if (/[\r\n\0]/.test(arg)) {
        throw new Error('an argument passed through cmd.exe cannot hold a line break');
    }
    const quoted = `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
    return quoted.replace(CMD_SPECIAL, '^$1').replace(CMD_SPECIAL, '^$1');
}

/** The `.cmd` file's own path, read once by `cmd.exe`: its special characters escaped once. */
export function cmdFile(file: string): string {
    return file.replace(CMD_SPECIAL, '^$1');
}

/** How to run `file args` through `cmd.exe`: its arguments, to be passed verbatim. */
export function cmdInvocation(
    file: string,
    args: readonly string[],
    comSpec: string,
): { readonly command: string; readonly args: readonly string[] } {
    const line = [cmdFile(file), ...args.map(cmdArgument)].join(' ');
    return { command: comSpec, args: ['/d', '/s', '/c', `"${line}"`] };
}

/** What a run of `claude` gave. */
export interface RunResult {
    /** The exit code; null when it did not start or was stopped. */
    readonly code: number | null;
    readonly stdout: string;
    readonly stderr: string;
    /** Why it did not run, when it did not. */
    readonly error?: string;
}

/**
 * The environment `claude` runs in: this one, without the variables of the VS Code process that
 * starts it (`VSCODE_*`, `ELECTRON_RUN_AS_NODE`) or of a Claude Code session VS Code was itself
 * started from (`CLAUDECODE`), which would tell it it runs somewhere it does not.
 */
export function claudeEnv(
    env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        const upper = key.toUpperCase();
        if (
            value === undefined ||
            upper.startsWith('VSCODE_') ||
            upper === 'ELECTRON_RUN_AS_NODE' ||
            upper === 'CLAUDECODE'
        ) {
            continue;
        }
        out[key] = value;
    }
    return out;
}

/** Run `claude args` in `cwd`: directly, or through `cmd.exe` for a `.cmd` file. */
export function runClaude(
    claude: ClaudeCommand,
    args: readonly string[],
    cwd: string,
    env: Readonly<Record<string, string | undefined>>,
): Promise<RunResult> {
    const runEnv = claudeEnv(env);
    const how = claude.viaCmd
        ? {
              ...cmdInvocation(claude.file, args, envValue(env, 'ComSpec', 'win32') ?? 'cmd.exe'),
              verbatim: true,
          }
        : { command: claude.file, args, verbatim: false };
    return new Promise((resolve) => {
        execFile(
            how.command,
            [...how.args],
            {
                cwd,
                env: runEnv,
                timeout: 120_000,
                maxBuffer: 4 * 1024 * 1024,
                windowsHide: true,
                windowsVerbatimArguments: how.verbatim,
                encoding: 'utf8',
            },
            (error, stdout, stderr) => {
                const code =
                    error === null ? 0 : typeof error.code === 'number' ? error.code : null;
                resolve({
                    code,
                    stdout,
                    stderr,
                    ...(error !== null && typeof error.code !== 'number'
                        ? { error: error.message }
                        : {}),
                });
            },
        );
    });
}
