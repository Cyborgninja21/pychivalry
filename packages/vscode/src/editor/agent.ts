/**
 * The agent server started from a harness's entry, exactly as the entry states it (command,
 * arguments, variables over the starting process's own, folder), and asked one `check` through
 * the MCP library's own client. Used by the editor tests and by their runner. Test code only.
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

/** Start the server from `entry`, call `check` on the whole mod, and stop it. */
export async function checkThrough(entry: Entry): Promise<CheckAnswer> {
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
        const tools = (await client.listTools()).tools.map((t) => t.name);
        const result = (await client.callTool(
            { name: 'check', arguments: {} },
            { timeout: 120_000 },
        )) as { structuredContent?: Record<string, unknown>; isError?: boolean };
        if (result.isError === true || result.structuredContent === undefined) {
            throw new Error(`check returned an error: ${JSON.stringify(result)}`);
        }
        return {
            tools,
            server: `${info?.name ?? '?'} ${info?.version ?? '?'}`,
            output: result.structuredContent,
        };
    } catch (err) {
        throw new Error(
            `the server from ${entry.command} ${entry.args.join(' ')} did not answer: ${err instanceof Error ? err.message : String(err)}\nits standard error:\n${stderr}`,
            { cause: err },
        );
    } finally {
        await client.close();
    }
}
