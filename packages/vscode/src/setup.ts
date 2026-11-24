/**
 * "Set up for Claude Code" (docs/PLAN.md, items 7.8 and 9.3): the agent server added to Claude
 * Code's own configuration for one folder, and pychivalry's skills to Claude Code's folder of
 * personal skills (`skills.ts`). With Claude Code's `claude` command installed, the command adds
 * the server (`claude mcp add --scope local`); without it, the user is told so and asked whether
 * to write a project configuration file, `.mcp.json`, in the folder instead, which Claude Code
 * reads from a project's root and asks the user to approve once. Nothing is written before that
 * answer, and the skills are installed only once the server is set up. Set up again, it changes
 * nothing that is already as it should be.
 *
 * "Remove from Claude Code" undoes it for one folder: the server's entry, and the skills once no
 * other folder's set-up is left. The questions and the commands are passed in, so this is tested
 * without the editor.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { addArgs, removeArgs, type ClaudeCommand, type RunResult } from './claude.js';
import { SERVER_NAME, type ServerLaunch } from './launch.js';
import type { SkillsInstall, SkillsRemoval } from './skills.js';

/** The project configuration file Claude Code reads from a project's root. */
export const PROJECT_FILE = '.mcp.json';

/** The questions the set-up asks. */
export interface SetupUi {
    /** Whether to write `.mcp.json` into `folder`, the `claude` command not being found. */
    readonly confirmProjectFile: (folder: string) => Promise<boolean>;
}

/** What the installation of the skills did, once the server was set up. */
export type SkillsOutcome =
    | { readonly kind: 'installed'; readonly install: SkillsInstall }
    | { readonly kind: 'failed'; readonly message: string };

/** What the set-up did. */
export type SetupOutcome =
    | {
          readonly kind: 'claude';
          readonly claude: string;
          readonly folder: string;
          readonly output: string;
          readonly skills: SkillsOutcome;
      }
    | { readonly kind: 'project-file'; readonly file: string; readonly skills: SkillsOutcome }
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
    /** Install the skills into Claude Code's skills folder, keeping the extension's record. */
    readonly installSkills: () => Promise<SkillsInstall>;
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

/**
 * The text of a `.mcp.json` without the server's entry, or null when nothing else is left in it
 * (the file can then go); throws when the text is not a configuration.
 */
export function withoutServer(existing: string, name: string = SERVER_NAME): string | null {
    const data: unknown = JSON.parse(existing);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error(`${PROJECT_FILE} does not hold a JSON object`);
    }
    const file = data as Record<string, unknown>;
    const servers = file['mcpServers'];
    if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
        throw new Error(`${PROJECT_FILE}'s mcpServers is not an object`);
    }
    const rest = Object.fromEntries(
        Object.entries(servers as Record<string, unknown>).filter(([key]) => key !== name),
    );
    const others = Object.keys(file).filter((key) => key !== 'mcpServers');
    if (Object.keys(rest).length === 0 && others.length === 0) {
        return null;
    }
    return `${JSON.stringify({ ...file, mcpServers: rest }, null, 2)}\n`;
}

function described(run: RunResult): string {
    const text = `${run.stdout}\n${run.stderr}`.trim();
    return run.error ?? (text === '' ? `exit code ${String(run.code)}` : text);
}

/**
 * What the extension remembers of a set-up it made, in its global state: the folder, how it was
 * written, and the command line Claude Code was given. Claude Code keeps that command line as it
 * was given; the extension's copy of the server keeps its path across updates (`install.ts`), so
 * only a change of the command line itself, such as the game folder setting, leaves the entry
 * out of date.
 */
export interface SetUpRecord {
    readonly folder: string;
    readonly kind: 'claude' | 'project-file';
    readonly launch: ServerLaunch;
}

/** The global-state key the records are kept under. */
export const SET_UPS_KEY = 'pychivalry.claudeCodeSetUps';

function isLaunch(value: unknown): value is ServerLaunch {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (
        typeof v['command'] === 'string' &&
        Array.isArray(v['args']) &&
        v['args'].every((a) => typeof a === 'string') &&
        typeof v['env'] === 'object' &&
        v['env'] !== null &&
        Object.values(v['env']).every((e) => typeof e === 'string')
    );
}

/** The records kept in the global state; anything that is not one is dropped. */
export function readSetUps(value: unknown): SetUpRecord[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((r: unknown): SetUpRecord[] => {
        if (typeof r !== 'object' || r === null) {
            return [];
        }
        const { folder, kind, launch } = r as Record<string, unknown>;
        return typeof folder === 'string' &&
            (kind === 'claude' || kind === 'project-file') &&
            isLaunch(launch)
            ? [{ folder, kind, launch }]
            : [];
    });
}

/** The records with the set-up of `record.folder` replaced by `record`. */
export function withSetUp(records: readonly SetUpRecord[], record: SetUpRecord): SetUpRecord[] {
    return [...records.filter((r) => r.folder !== record.folder), record];
}

/** The record a set-up's outcome leaves, or null when nothing was written. */
export function recordOf(
    outcome: SetupOutcome,
    folder: string,
    launch: ServerLaunch,
): SetUpRecord | null {
    return outcome.kind === 'claude' || outcome.kind === 'project-file'
        ? { folder, kind: outcome.kind, launch }
        : null;
}

function sameLaunch(a: ServerLaunch, b: ServerLaunch): boolean {
    return JSON.stringify(serverEntry(a)) === JSON.stringify(serverEntry(b));
}

/**
 * The set-ups whose command line is no longer the one the extension would give: `current` gives
 * the command line for a folder now, or null for a folder that is not open.
 */
export function outOfDate(
    records: readonly SetUpRecord[],
    current: (folder: string) => ServerLaunch | null,
): SetUpRecord[] {
    return records.filter((r) => {
        const now = current(r.folder);
        return now !== null && !sameLaunch(now, r.launch);
    });
}

async function skillsStep(deps: SetupDeps): Promise<SkillsOutcome> {
    try {
        return { kind: 'installed', install: await deps.installSkills() };
    } catch (err) {
        return {
            kind: 'failed',
            message: `the skills could not be installed: ${(err as Error).message}`,
        };
    }
}

/** Add the server to Claude Code's configuration for `deps.folder`, then the skills. */
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
            skills: await skillsStep(deps),
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
    return { kind: 'project-file', file, skills: await skillsStep(deps) };
}

/** What the removal needs. */
export interface RemoveDeps {
    /** The mod folder whose set-up is removed. */
    readonly folder: string;
    /** The entries the extension would write for the folder: only an entry equal to one of them is taken out of `.mcp.json`. */
    readonly launches: readonly ServerLaunch[];
    readonly findClaude: () => ClaudeCommand | null;
    readonly runClaude: (
        claude: ClaudeCommand,
        args: readonly string[],
        cwd: string,
    ) => Promise<RunResult>;
    /** Remove the skills, or null when another folder's set-up still uses them. */
    readonly removeSkills: (() => Promise<SkillsRemoval>) | null;
}

/** What the removal did. */
export interface RemoveOutcome {
    readonly folder: string;
    /** What Claude Code's command said, or null without it. */
    readonly claude: {
        readonly file: string;
        readonly removed: boolean;
        readonly output: string;
    } | null;
    /** What became of the folder's `.mcp.json`. */
    readonly projectFile:
        'none' | 'entry-removed' | 'file-removed' | 'not-ours' | { readonly failed: string };
    /** The skills: removed, kept for another folder's set-up, or the failure. */
    readonly skills:
        | { readonly kind: 'removed'; readonly removal: SkillsRemoval }
        | { readonly kind: 'kept' }
        | { readonly kind: 'failed'; readonly message: string };
}

/**
 * Take pychivalry out of Claude Code for `deps.folder`: the local entry (`claude mcp remove`),
 * the entry the extension wrote into the folder's `.mcp.json` (an entry of that name that is not
 * the extension's is left), and the skills when no other folder's set-up is left.
 */
export async function removeFromClaudeCode(deps: RemoveDeps): Promise<RemoveOutcome> {
    const claude = deps.findClaude();
    let claudeResult: RemoveOutcome['claude'] = null;
    if (claude !== null) {
        const run = await deps.runClaude(claude, removeArgs(), deps.folder);
        claudeResult = {
            file: claude.file,
            removed: run.code === 0,
            output: run.code === 0 ? run.stdout.trim() : described(run),
        };
    }
    let projectFile: RemoveOutcome['projectFile'] = 'none';
    const file = path.join(deps.folder, PROJECT_FILE);
    if (existsSync(file)) {
        try {
            const text = readFileSync(file, 'utf8');
            const data = JSON.parse(text) as { mcpServers?: Record<string, unknown> };
            const entry = data.mcpServers?.[SERVER_NAME];
            if (entry === undefined) {
                projectFile = 'none';
            } else if (
                deps.launches.some((l) => JSON.stringify(entry) === JSON.stringify(serverEntry(l)))
            ) {
                const left = withoutServer(text);
                if (left === null) {
                    rmSync(file);
                    projectFile = 'file-removed';
                } else {
                    writeFileSync(file, left, 'utf8');
                    projectFile = 'entry-removed';
                }
            } else {
                projectFile = 'not-ours';
            }
        } catch (err) {
            projectFile = { failed: `${PROJECT_FILE}: ${(err as Error).message}` };
        }
    }
    let skills: RemoveOutcome['skills'] = { kind: 'kept' };
    if (deps.removeSkills !== null) {
        try {
            skills = { kind: 'removed', removal: await deps.removeSkills() };
        } catch (err) {
            skills = { kind: 'failed', message: (err as Error).message };
        }
    }
    return { folder: deps.folder, claude: claudeResult, projectFile, skills };
}

/** The records without the set-up of `folder`. */
export function withoutSetUp(records: readonly SetUpRecord[], folder: string): SetUpRecord[] {
    return records.filter((r) => r.folder !== folder);
}
