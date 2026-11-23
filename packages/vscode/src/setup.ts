/**
 * "Set up for Claude Code" (docs/PLAN.md, item 7.8): the agent server added to Claude Code's
 * own configuration for one folder. With Claude Code's `claude` command installed, the command
 * does it (`claude mcp add --scope local`); without it, the user is told so and asked whether to
 * write a project configuration file, `.mcp.json`, in the folder instead, which Claude Code reads
 * from a project's root and asks the user to approve once. Nothing is written before that answer.
 * The questions and the commands are passed in, so this is tested without the editor.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { addArgs, removeArgs, type ClaudeCommand, type RunResult } from './claude.js';
import { SERVER_NAME, type ServerLaunch } from './launch.js';

/** The project configuration file Claude Code reads from a project's root. */
export const PROJECT_FILE = '.mcp.json';

/** The questions the set-up asks. */
export interface SetupUi {
    /** Whether to write `.mcp.json` into `folder`, the `claude` command not being found. */
    readonly confirmProjectFile: (folder: string) => Promise<boolean>;
}

/** What the set-up did. */
export type SetupOutcome =
    | {
          readonly kind: 'claude';
          readonly claude: string;
          readonly folder: string;
          readonly output: string;
      }
    | { readonly kind: 'project-file'; readonly file: string }
    | { readonly kind: 'declined'; readonly folder: string }
    | { readonly kind: 'failed'; readonly message: string };

/** What the set-up needs. */
export interface SetupDeps {
    /** The mod folder: Claude Code's project. */
    readonly folder: string;
    /** The server's command line for that folder. */
    readonly launch: ServerLaunch;
    readonly findClaude: () => ClaudeCommand | null;
    readonly runClaude: (
        claude: ClaudeCommand,
        args: readonly string[],
        cwd: string,
    ) => Promise<RunResult>;
    readonly ui: SetupUi;
}

/** The server's entry as Claude Code writes it into a configuration. */
export function serverEntry(launch: ServerLaunch): Record<string, unknown> {
    return {
        type: 'stdio',
        command: launch.command,
        args: [...launch.args],
        env: { ...launch.env },
    };
}

/**
 * The text of a `.mcp.json` holding the server, from the file's current text (null when there
 * is none): every other entry and key kept, an earlier entry of the same name replaced.
 */
export function withServer(
    existing: string | null,
    launch: ServerLaunch,
    name: string = SERVER_NAME,
): string {
    let data: unknown = {};
    if (existing !== null && existing.trim() !== '') {
        try {
            data = JSON.parse(existing);
        } catch (err) {
            throw new Error(`${PROJECT_FILE} is not valid JSON: ${(err as Error).message}`, {
                cause: err,
            });
        }
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error(`${PROJECT_FILE} does not hold a JSON object`);
    }
    const file = data as Record<string, unknown>;
    const servers = file['mcpServers'] ?? {};
    if (typeof servers !== 'object' || Array.isArray(servers)) {
        throw new Error(`${PROJECT_FILE}'s mcpServers is not an object`);
    }
    const out = { ...file, mcpServers: { ...servers, [name]: serverEntry(launch) } };
    return `${JSON.stringify(out, null, 2)}\n`;
}

function described(run: RunResult): string {
    const text = `${run.stdout}\n${run.stderr}`.trim();
    return run.error ?? (text === '' ? `exit code ${String(run.code)}` : text);
}

/** Add the server to Claude Code's configuration for `deps.folder`. */
export async function setUpClaudeCode(deps: SetupDeps): Promise<SetupOutcome> {
    const claude = deps.findClaude();
    if (claude !== null) {
        // An earlier entry of the same name, from an older set-up, would make `add` refuse.
        await deps.runClaude(claude, removeArgs(), deps.folder);
        const added = await deps.runClaude(claude, addArgs(deps.launch), deps.folder);
        if (added.code !== 0) {
            return {
                kind: 'failed',
                message: `Claude Code's command ${claude.file} could not add the server: ${described(added)}`,
            };
        }
        return {
            kind: 'claude',
            claude: claude.file,
            folder: deps.folder,
            output: added.stdout.trim(),
        };
    }
    if (!(await deps.ui.confirmProjectFile(deps.folder))) {
        return { kind: 'declined', folder: deps.folder };
    }
    const file = path.join(deps.folder, PROJECT_FILE);
    try {
        const text = withServer(existsSync(file) ? readFileSync(file, 'utf8') : null, deps.launch);
        writeFileSync(file, text, 'utf8');
    } catch (err) {
        return { kind: 'failed', message: (err as Error).message };
    }
    return { kind: 'project-file', file };
}
