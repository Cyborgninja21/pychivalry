/**
 * The scored run's agent-server configuration works with the server as built
 * (`packages/mcp/dist/main.js`, docs/PLAN.md items 6.1 to 6.8): started exactly as a trial's
 * configuration says, on a fresh copy of the planted-defect mod and the game stub, it offers its
 * tools and answers one `check` with the planted defects, its lines counted from 1, and leaves
 * the mod as it was. No model is involved: the test speaks the protocol itself, one JSON
 * message per line over standard input and output.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { tempDir } from '../testing.js';
import { repoRoot } from '../util.js';
import { filesIn } from './graders.js';
import { committedManifest, DEFECTS_DIR, reportedAt } from './manifest.js';
import { mcpConfig, scoredOptions, SERVER_NAME, SERVER_TOOLS } from './run.js';

const root = repoRoot();
const manifest = committedManifest(root);
const original = path.join(root, DEFECTS_DIR, 'mod');

interface ServerEntry {
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
}

interface Reply {
    readonly id?: number;
    readonly result?: Record<string, unknown>;
    readonly error?: unknown;
}

/** Start the server an entry of the configuration names, send `messages`, and collect the replies to the requests. */
async function converse(
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

test(
    "the built agent server, started from a trial's configuration, answers check on the planted mod",
    { timeout: 120_000 },
    async (t) => {
        const dir = tempDir(t);
        const modDir = path.join(dir, 'mod');
        cpSync(original, modDir, { recursive: true });
        const cacheDir = path.join(dir, 'cache');
        mkdirSync(cacheDir);
        const options = scoredOptions(root, { SCORED_SESSION_LIMIT: '1' });
        assert.ok(
            existsSync(options.server),
            `the agent server is built: ${options.server} (task build)`,
        );
        const gameDir = path.join(root, ...manifest.game.split('/'));
        const config = mcpConfig(options, modDir, gameDir, cacheDir) as {
            mcpServers: Record<string, ServerEntry>;
        };
        assert.deepEqual(Object.keys(config.mcpServers), [SERVER_NAME]);
        const entry = config.mcpServers[SERVER_NAME];
        assert.ok(entry !== undefined);

        const replies = await converse(entry, [
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
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
            {
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: { name: 'check', arguments: { min_severity: 'hint', limit: 100 } },
            },
        ]);
        const byId = new Map(replies.map((r) => [r.id, r]));
        for (const id of [1, 2, 3]) {
            assert.equal(byId.get(id)?.error, undefined, `request ${String(id)} succeeded`);
        }

        const tools = (byId.get(2)?.result?.['tools'] as { name: string }[])
            .map((x) => x.name)
            .sort();
        assert.deepEqual(tools, [...SERVER_TOOLS]);

        const call = byId.get(3)?.result ?? {};
        assert.notEqual(call['isError'], true);
        const output = call['structuredContent'] as {
            totals: { by_severity: Record<string, number>; by_code: Record<string, number> };
            findings: {
                file: string;
                line: number;
                code: string;
                data: Record<string, string | string[]>;
            }[];
        };
        assert.deepEqual(output.totals.by_severity, {
            error: 26,
            warning: 7,
            information: 0,
            hint: 0,
        });
        const planted = manifest.defects.flatMap((d) =>
            reportedAt(d).map((p) => `${d.code} ${p.file}:${String(p.line)}`),
        );
        assert.deepEqual(
            output.findings.map((f) => `${f.code} ${f.file}:${String(f.line)}`).sort(),
            planted.sort(),
            'the planted defects, at the lines the manifest counts from 1',
        );
        // The findings say what is valid (item 6.11, proposals 2 and 3): a scope finding the
        // scopes the keyword or link takes and the links that lead there, a missing field the
        // value type and the values the base game writes.
        const dataOf = (code: string, file: string): Record<string, string | string[]> => {
            const found = output.findings.find((f) => f.code === code && f.file === file);
            assert.ok(found !== undefined, `${code} in ${file}`);
            return found.data;
        };
        const effect = dataOf('scope/wrong-scope-for-effect', 'events/harvest_events.txt');
        assert.equal(effect['name'], 'add_county_modifier');
        assert.deepEqual(effect['expected'], ['landed_title']);
        assert.ok(effect['links_from_scope']?.includes('capital_county'));
        const link = dataOf('scope/link-on-wrong-scope', 'common/decisions/harvest_decisions.txt');
        assert.ok(link['links_from_scope']?.includes('primary_title'));
        const index = dataOf(
            'fields/missing-required-field',
            'common/character_interaction_categories/harvest_categories.txt',
        );
        assert.equal(index['value_type'], 'integer');
        assert.ok(index['values']?.includes('15'));

        // The server wrote nothing into the mod.
        assert.deepEqual(filesIn(modDir), filesIn(original));
        for (const file of filesIn(original)) {
            assert.equal(
                readFileSync(path.join(modDir, ...file.split('/')), 'utf8'),
                readFileSync(path.join(original, ...file.split('/')), 'utf8'),
                file,
            );
        }
    },
);
