/**
 * Helpers for the agent server's tests: the server started as its own process and spoken to
 * over standard input and output by the MCP library's own client, a temporary folder, and a
 * stand-in game install. No test reads the real game unless it says so and its variables are
 * set, and no test writes outside its temporary folder: the server's cache folder is always
 * one of the test's own. Not part of the package's surface.
 */

import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

/** The repository root: compiled tests live in `packages/mcp/dist/`. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));

/** The server's entry point, compiled. */
export const MAIN = fileURLToPath(new URL('./main.js', import.meta.url));

export const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');
export const GAMES = path.join(REPO_ROOT, 'fixtures', 'game');

/** A temporary folder, removed when the test ends. */
export function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-mcp-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

export function write(file: string, text: string | Uint8Array): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** A copy of a fixture mod in a temporary folder, which a test may change. */
export function modCopy(t: TestContext, mod: string): string {
    const dir = path.join(scratch(t), mod);
    cpSync(path.join(MODS, mod), dir, { recursive: true });
    return dir;
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

/** An environment whose cache folder, on every system, is `cache`. */
export function cacheEnv(cache: string): Record<string, string> {
    return { ...getDefaultEnvironment(), XDG_CACHE_HOME: cache, LOCALAPPDATA: cache };
}

/** A tool's result as the client receives it. */
export interface ToolResult {
    readonly content: readonly { readonly type: string; readonly text?: string }[];
    readonly structuredContent?: Record<string, unknown>;
    readonly isError?: boolean;
}

/** A client connected to the server over standard input and output. */
export interface Connection {
    readonly client: Client;
    /** A tool's result. */
    readonly call: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
    /** A tool's structured output; fails the test when the result is an error. */
    readonly output: (
        name: string,
        args: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    /** The text of a result marked as an error; fails the test when it is not one. */
    readonly error: (name: string, args: Record<string, unknown>) => Promise<string>;
}

/** How long one tool call may take: the real game's first call loads its whole index. */
const CALL_TIMEOUT_MS = 600_000;

/**
 * The server started on `argv` (which must name its game: `--vanilla` or `--no-vanilla`, so no
 * test looks for the real one unless it means to) with its cache folder `cache`, and a client
 * connected to it. Closed when the test ends. `cache` is null only for the local game-file
 * test, whose server uses the user's own cache folder, where the base game's index already is.
 */
export async function connect(
    t: TestContext,
    argv: readonly string[],
    cache: string | null,
    env: Readonly<Record<string, string>> = {},
): Promise<Connection> {
    if (!argv.includes('--vanilla') && !argv.includes('--no-vanilla')) {
        throw new Error('a test server must name its game: --vanilla or --no-vanilla');
    }
    const userCache: Record<string, string> = {};
    for (const name of ['XDG_CACHE_HOME', 'LOCALAPPDATA']) {
        const value = process.env[name];
        if (value !== undefined) {
            userCache[name] = value;
        }
    }
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [MAIN, ...argv],
        env: {
            ...(cache === null ? { ...getDefaultEnvironment(), ...userCache } : cacheEnv(cache)),
            ...env,
        },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'pychivalry-test', version: '0.0.0' });
    await client.connect(transport);
    t.after(async () => {
        await client.close();
    });
    const call = async (name: string, args: Record<string, unknown>): Promise<ToolResult> =>
        (await client.callTool(
            { name, arguments: args },
            { timeout: CALL_TIMEOUT_MS },
        )) as ToolResult;
    return {
        client,
        call,
        output: async (name, args) => {
            const result = await call(name, args);
            if (result.isError === true || result.structuredContent === undefined) {
                throw new Error(
                    `${name} returned an error: ${result.content.map((c) => c.text ?? '').join(' ')}`,
                );
            }
            return result.structuredContent;
        },
        error: async (name, args) => {
            const result = await call(name, args);
            if (result.isError !== true) {
                throw new Error(`${name} did not return an error: ${JSON.stringify(result)}`);
            }
            return result.content.map((c) => c.text ?? '').join('\n');
        },
    };
}

/** The most characters a whole result may hold: 10,000 tokens at three characters a token. */
export const MAX_RESULT_CHARACTERS = 30_000;

/**
 * The size of a result as a model could be given it: the characters of its text and of its
 * structured output's JSON, both copies counted.
 */
export function resultSize(result: ToolResult): number {
    const text = result.content.reduce((n, c) => n + (c.text ?? '').length, 0);
    return (
        text +
        (result.structuredContent === undefined
            ? 0
            : JSON.stringify(result.structuredContent).length)
    );
}
