/**
 * The server as a client sees it (docs/PLAN.md items 6.1 and 6.2), through a real round trip
 * over standard input and output: its name and version, its written instructions, and its
 * tools, each named in lower case with underscores, declaring what it takes and returns, and
 * marked read-only but `apply_format`, the one that writes (`source` came with schema version 4);
 * the tools later steps fill in are not there yet. Also the protocol as a
 * client of the 2025 revisions speaks it, by hand, which is how today's harnesses start.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { INPUT_KEYWORDS, type Schema } from './schema.js';
import { cacheEnv, connect, gameStub, MAIN, scratch } from './testing.js';
import { SCHEMA_VERSION, SERVER_NAME, VERSION } from './version.js';

const TOOL_NAMES = [
    'check',
    'lookup',
    'find_definition',
    'find_references',
    'list_definitions',
    'source',
    'call_graph',
    'analyze_log',
    'explain_code',
    'format',
    'apply_format',
];

/** The one tool that writes (a file of the mod, in the format): every other only reads. */
const WRITES = ['apply_format'];

interface ListedTool {
    readonly name: string;
    readonly description?: string;
    readonly inputSchema: Schema & Record<string, unknown>;
    readonly outputSchema?: Schema & Record<string, unknown>;
    readonly annotations?: Record<string, unknown>;
}

test('the server names itself, its version and its schema version, and says how to start', async (t) => {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'));
    const { client } = await connect(t, ['--mod', dir, '--vanilla', game], path.join(dir, 'cache'));
    const info = client.getServerVersion();
    assert.equal(info?.name, SERVER_NAME);
    assert.equal(info.version, VERSION);
    const manifest = JSON.parse(
        readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    assert.equal(VERSION, manifest.version);
    const instructions = client.getInstructions() ?? '';
    assert.match(instructions, /Crusader Kings 3/);
    assert.match(instructions, /Start with check/);
    // A client may show the tools under a prefix; the instructions say so, that the names they
    // use are the short ones, and that a call of the short name reaches nothing in Claude Code
    // (item 6.11 and both scored authoring runs: test sessions called tools by their short names).
    assert.match(instructions, /names here are the short ones/);
    assert.match(instructions, /mcp__pychivalry__check/);
    assert.match(instructions, /mcp__pychivalry__lookup/);
    assert.match(instructions, /a call of the short name reaches nothing/);
    assert.match(instructions, new RegExp(`tool schema version ${String(SCHEMA_VERSION)}`));
    // Since schema version 4: a place outside the mod is read with source, never with the
    // session's own file tools (the expert run's one trial that did not hold), and lookup answers
    // every name whole, with no cursor.
    assert.match(instructions, /mcp__pychivalry__source/);
    assert.match(instructions, /says read_with: source: your own file tools cannot reach it/);
    assert.match(instructions, /every name asked answered whole/);
    assert.match(instructions, /lookup has no cursor/);
    assert.ok(instructions.includes(dir), 'it names the mod folder it works on');
});

test('the ten tools, each read-only but apply_format, declaring what it takes and what it returns', async (t) => {
    const dir = scratch(t);
    const { client } = await connect(t, ['--mod', dir, '--no-vanilla'], path.join(dir, 'cache'));
    const { tools } = (await client.listTools()) as { tools: ListedTool[] };
    assert.deepEqual(
        tools.map((tool) => tool.name),
        TOOL_NAMES,
    );
    for (const tool of tools) {
        assert.match(tool.name, /^[a-z]+(_[a-z]+)*$/, 'lower case with underscores');
        assert.ok((tool.description ?? '').length > 40, `${tool.name} says what it does`);
        assert.equal(tool.inputSchema.type, 'object');
        assert.equal(
            tool.inputSchema.additionalProperties,
            false,
            `${tool.name} names its arguments`,
        );
        assert.equal(tool.outputSchema?.type, 'object', `${tool.name} declares its output`);
        assert.deepEqual(tool.annotations, {
            title: tool.annotations?.['title'],
            readOnlyHint: !WRITES.includes(tool.name),
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        });
    }
    // `call_graph` came with build step 10 (schema version 6), `analyze_log` with step 11 (7).
    assert.equal(SCHEMA_VERSION, 7);
});

/** Every keyword an input shape uses, at any depth. */
function keywords(schema: Schema, out = new Set<string>()): Set<string> {
    for (const [key, value] of Object.entries(schema)) {
        out.add(key);
        if (key === 'properties') {
            for (const inner of Object.values(value as Record<string, Schema>)) {
                keywords(inner, out);
            }
        } else if (
            key === 'items' ||
            (key === 'additionalProperties' && typeof value === 'object')
        ) {
            keywords(value as Schema, out);
        }
    }
    return out;
}

test('every input shape uses only what the argument check reads, so every bad value is named', async (t) => {
    const dir = scratch(t);
    const { client } = await connect(t, ['--mod', dir, '--no-vanilla'], path.join(dir, 'cache'));
    const { tools } = (await client.listTools()) as { tools: ListedTool[] };
    for (const tool of tools) {
        for (const keyword of keywords(tool.inputSchema)) {
            assert.ok(
                INPUT_KEYWORDS.includes(keyword) || keyword === '$schema',
                `${tool.name} uses ${keyword}`,
            );
        }
    }
});

/** The server spoken to by hand: one JSON message per line each way. */
async function handshake(argv: readonly string[], env: Record<string, string>): Promise<unknown[]> {
    const child = spawn(process.execPath, [MAIN, ...argv], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    const replies: unknown[] = [];
    let buffer = '';
    const done = new Promise<void>((resolve) => {
        child.stdout.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            let at = buffer.indexOf('\n');
            while (at >= 0) {
                replies.push(JSON.parse(buffer.slice(0, at)));
                buffer = buffer.slice(at + 1);
                at = buffer.indexOf('\n');
            }
            if (replies.length === 2) {
                child.stdin.end();
                resolve();
            }
        });
    });
    const send = (message: unknown): void => {
        child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'by-hand', version: '0' },
        },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'explain_code', arguments: { codes: ['names/unknown-effect'] } },
    });
    await done;
    await new Promise<void>((resolve) =>
        child.on('close', () => {
            resolve();
        }),
    );
    return replies;
}

test('a client of the 2025 protocol, by hand: initialize, then a tool call', async (t) => {
    const dir = scratch(t);
    const replies = (await handshake(
        ['--mod', dir, '--no-vanilla'],
        cacheEnv(path.join(dir, 'cache')),
    )) as { id: number; result: Record<string, unknown> }[];
    const init = replies.find((r) => r.id === 1)?.result ?? {};
    assert.equal(init['protocolVersion'], '2025-06-18');
    assert.equal((init['serverInfo'] as { name: string }).name, SERVER_NAME);
    assert.match(String(init['instructions']), /Start with check/);
    const call = replies.find((r) => r.id === 2)?.result ?? {};
    const output = call['structuredContent'] as { codes: { code: string; severity: string }[] };
    assert.deepEqual(
        output.codes.map((c) => [c.code, c.severity]),
        [['names/unknown-effect', 'error']],
    );
    const text = (call['content'] as { type: string; text: string }[])[0];
    assert.deepEqual(JSON.parse(text?.text ?? ''), output, 'the text is the same JSON');
});
