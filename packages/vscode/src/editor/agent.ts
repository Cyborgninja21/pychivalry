/**
 * The agent server started from a harness's entry, exactly as the entry states it (command,
 * arguments, variables over the starting process's own, folder), and asked `check` through the
 * MCP library's own client: one page (`checkThrough`), or every finding of every severity, page
 * after page to the end (`checkAll`, for the same-answers test). Used by the editor tests and by
 * their runner. Test code only.
 */

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

/** A server entry as a harness's configuration holds it. */
export interface Entry {
    readonly command: string;
    readonly args: readonly string[];
    readonly env?: Readonly<Record<string, string | number | null>>;
    readonly cwd?: string;
}

/** What one `check` call answered. */
export interface CheckAnswer {
    /** The tools the server listed. */
    readonly tools: readonly string[];
    /** The server's name and version, as it gave them. */
    readonly server: string;
    /** The `check` tool's structured output. */
    readonly output: Record<string, unknown>;
}

/** The environment a harness gives the server: its own, with the entry's variables over it. */
function entryEnv(entry: Entry): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }
    for (const [key, value] of Object.entries(entry.env ?? {})) {
        if (value === null) {
            // A null removes the harness's own variable (VS Code's API states this).
            Reflect.deleteProperty(env, key);
        } else {
            env[key] = String(value);
        }
    }
    return env;
}

/** What `checkAll` gathered: every finding, and the counts the server gave with the first page. */
export interface AllFindings {
    readonly server: string;
    readonly filesChecked: number;
    readonly totals: Record<string, unknown>;
    readonly findings: readonly Record<string, unknown>[];
    /** The pages it took. */
    readonly pages: number;
}

/** Start the server from `entry`, call `check` on the whole mod, and stop it. */
export async function checkThrough(entry: Entry): Promise<CheckAnswer> {
    return withServer(entry, async (client, server) => {
        const tools = (await client.listTools()).tools.map((t) => t.name);
        return { tools, server, output: await callCheck(client, {}) };
    });
}

/**
 * Start the server from `entry` and call `check` on the whole mod with every severity, the
 * largest page and each next cursor until there is none: every finding the agent server reports.
 */
export async function checkAll(entry: Entry): Promise<AllFindings> {
    return withServer(entry, async (client, server) => {
        const findings: Record<string, unknown>[] = [];
        let first: Record<string, unknown> | null = null;
        let cursor: string | null = null;
        let pages = 0;
        do {
            const page = await callCheck(client, {
                min_severity: 'hint',
                limit: 200,
                ...(cursor === null ? {} : { cursor }),
            });
            first ??= page;
            pages++;
            findings.push(...(page['findings'] as Record<string, unknown>[]));
            const next = page['next_cursor'];
            cursor = typeof next === 'string' ? next : null;
        } while (cursor !== null);
        return {
            server,
            filesChecked: first['files_checked'] as number,
            totals: first['totals'] as Record<string, unknown>,
            findings,
            pages,
        };
    });
}

/** What the agent server's `format` gave for one file: its text put together from its pages. */
export interface FormattedByAgent {
    readonly file: string;
    readonly formatted: boolean;
    readonly changed: boolean;
    readonly bom: boolean;
    /** The formatted text without the mark; empty when the file is unchanged or left. */
    readonly text: string;
}

/** Start the server from `entry` and call `format` on each file, page after page. */
export async function formatAll(
    entry: Entry,
    files: readonly string[],
): Promise<FormattedByAgent[]> {
    return withServer(entry, async (client) => {
        const out: FormattedByAgent[] = [];
        for (const file of files) {
            let text = '';
            let cursor: string | null = null;
            let first: Record<string, unknown> | null = null;
            do {
                const result = (await client.callTool(
                    { name: 'format', arguments: { file, ...(cursor === null ? {} : { cursor }) } },
                    { timeout: 600_000 },
                )) as { structuredContent?: Record<string, unknown>; isError?: boolean };
                if (result.isError === true || result.structuredContent === undefined) {
                    throw new Error(`format ${file} returned an error: ${JSON.stringify(result)}`);
                }
                const page = result.structuredContent;
                first ??= page;
                text += String(page['text']);
                const next = page['next_cursor'];
                cursor = typeof next === 'string' ? next : null;
            } while (cursor !== null);
            out.push({
                file,
                formatted: first['formatted'] === true,
                changed: first['changed'] === true,
                bom: first['bom'] === true,
                text,
            });
        }
        return out;
    });
}

/** A place of the mod as the agent server takes it: a file, a line and a column from 1. */
export interface ModPlace {
    readonly file: string;
    readonly line: number;
    readonly column: number;
}

/** Start the server from `entry` and call `find_definition` at each place: its structured outputs. */
export async function findDefinitions(
    entry: Entry,
    places: readonly ModPlace[],
): Promise<Record<string, unknown>[]> {
    return withServer(entry, async (client) => {
        const out: Record<string, unknown>[] = [];
        for (const place of places) {
            const result = (await client.callTool(
                { name: 'find_definition', arguments: { ...place } },
                { timeout: 600_000 },
            )) as { structuredContent?: Record<string, unknown>; isError?: boolean };
            if (result.isError === true || result.structuredContent === undefined) {
                throw new Error(
                    `find_definition at ${JSON.stringify(place)} returned an error: ${JSON.stringify(result)}`,
                );
            }
            out.push(result.structuredContent);
        }
        return out;
    });
}

async function callCheck(
    client: Client,
    args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const result = (await client.callTool(
        { name: 'check', arguments: args },
        { timeout: 600_000 },
    )) as { structuredContent?: Record<string, unknown>; isError?: boolean };
    if (result.isError === true || result.structuredContent === undefined) {
        throw new Error(`check returned an error: ${JSON.stringify(result)}`);
    }
    return result.structuredContent;
}

/** Start the server from `entry`, run `use` with a connected client, and stop it. */
async function withServer<T>(
    entry: Entry,
    use: (client: Client, server: string) => Promise<T>,
): Promise<T> {
    const transport = new StdioClientTransport({
        command: entry.command,
        args: [...entry.args],
        env: entryEnv(entry),
        ...(entry.cwd === undefined ? {} : { cwd: entry.cwd }),
        stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
    });
    const client = new Client({ name: 'pychivalry-editor-test', version: '0.0.0' });
    try {
        await client.connect(transport);
        const info = client.getServerVersion();
        return await use(client, `${info?.name ?? '?'} ${info?.version ?? '?'}`);
    } catch (err) {
        throw new Error(
            `the server from ${entry.command} ${entry.args.join(' ')} did not answer: ${err instanceof Error ? err.message : String(err)}\nits standard error:\n${stderr}`,
            { cause: err },
        );
    } finally {
        await client.close();
    }
}
