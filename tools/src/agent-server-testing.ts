/**
 * Speaking to the built agent server over its protocol, as a client does, for the scored-run
 * tests that start it from a trial's configuration (`scored-run/server.test.ts`,
 * `scored-run/repair.test.ts`): one JSON message per line over standard input and output, no
 * model. Test support only, kept out of `scored-run/`, whose scripts start no program but the
 * Claude Code a run names (`scored-run/no-model-call.test.ts`). Not a test file itself, so that
 * importing it runs no test.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

/** A server entry of a trial's configuration (`mcpConfig`). */
export interface ServerEntry {
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
}

export interface Reply {
    readonly id?: number;
    readonly result?: Record<string, unknown>;
    readonly error?: unknown;
}

/** Start the server an entry of the configuration names, send `messages`, and collect the replies to the requests. */
export async function converse(
    entry: ServerEntry,
    messages: readonly Record<string, unknown>[],
): Promise<Reply[]> {
    const child = spawn(entry.command, [...entry.args], {
        env: { ...process.env, ...entry.env },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const wanted = messages.filter((m) => m['id'] !== undefined).length;
    const replies: Reply[] = [];
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
    });
    let buffer = '';
    const closed = new Promise<number | null>((resolve) => {
        child.on('close', (code) => {
            resolve(code);
        });
    });
    child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        let at = buffer.indexOf('\n');
        while (at >= 0) {
            const reply = JSON.parse(buffer.slice(0, at)) as Reply;
            buffer = buffer.slice(at + 1);
            if (reply.id !== undefined) {
                replies.push(reply);
            }
            at = buffer.indexOf('\n');
        }
        if (replies.length === wanted) {
            child.stdin.end();
        }
    });
    for (const message of messages) {
        child.stdin.write(`${JSON.stringify(message)}\n`);
    }
    const code = await closed;
    assert.equal(
        replies.length,
        wanted,
        `the server answered every request (exit ${String(code)}): ${stderr}`,
    );
    return replies;
}

/** The first two messages of every conversation: the client says who it is. */
export const OPENING: readonly Record<string, unknown>[] = [
    {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'scored-run-test', version: '0' },
        },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
];
