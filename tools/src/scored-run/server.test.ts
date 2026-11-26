/**
 * The scored run's agent-server configuration works with the server as built
 * (`packages/mcp/dist/main.js`, docs/PLAN.md items 6.1 to 6.8): started exactly as a trial's
 * configuration says, on a fresh copy of the planted-defect mod and the game stub, it offers its
 * tools and answers one `check` with the planted defects, its lines counted from 1, and leaves
 * the mod as it was. No model is involved: the test speaks the protocol itself, one JSON
 * message per line over standard input and output.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { tempDir } from '../testing.js';
import { repoRoot } from '../util.js';
import { filesIn } from './graders.js';
import { committedManifest, DEFECTS_DIR, reportedAt } from './manifest.js';
import {
    mcpConfig,
    scoredOptions,
    SERVER_NAME,
    SERVER_SCHEMA_VERSION,
    SERVER_TOOLS,
} from './run.js';
import { converse, type ServerEntry } from '../agent-server-testing.js';

const root = repoRoot();
const manifest = committedManifest(root);
const original = path.join(root, DEFECTS_DIR, 'mod');

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

        const listed = byId.get(2)?.result?.['tools'] as {
            name: string;
            _meta?: Record<string, unknown>;
        }[];
        const tools = listed.map((x) => x.name).sort();
        assert.deepEqual(tools, [...SERVER_TOOLS]);
        // The schema version a record states is the one the built server declares on every tool.
        for (const tool of listed) {
            assert.equal(
                tool._meta?.['pychivalry/schema-version'],
                SERVER_SCHEMA_VERSION,
                tool.name,
            );
        }

        const call = byId.get(3)?.result ?? {};
        assert.notEqual(call['isError'], true);
        interface CheckOutput {
            totals: { by_severity: Record<string, number>; by_code: Record<string, number> };
            findings: {
                file: string;
                line: number;
                code: string;
                data: Record<string, string | string[]>;
            }[];
            next_cursor: string | null;
        }
        const output = call['structuredContent'] as CheckOutput;
        // The findings carry their fixes (build step 8), so the check takes more than one page:
        // the next ones, each from a server started again, by the cursor the last one gave.
        const findings = [...output.findings];
        let cursor = output.next_cursor;
        for (let pages = 1; cursor !== null && pages < 20; pages++) {
            const [, next] = await converse(entry, [
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
                {
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'tools/call',
                    params: {
                        name: 'check',
                        arguments: { min_severity: 'hint', limit: 100, cursor },
                    },
                },
            ]);
            const page = next?.result?.['structuredContent'] as CheckOutput;
            findings.push(...page.findings);
            cursor = page.next_cursor;
        }
        assert.equal(cursor, null, 'every page read');
        // The `style/` family is planted too: a file not in the format (a warning and its
        // rule's hint) and a file not UTF-8 (a warning).
        assert.deepEqual(
            {
                error: output.totals.by_severity['error'] ?? 0,
                warning: output.totals.by_severity['warning'] ?? 0,
                information: output.totals.by_severity['information'] ?? 0,
                hint: output.totals.by_severity['hint'] ?? 0,
            },
            { error: 26, warning: 10, information: 0, hint: 1 },
        );
        const planted = manifest.defects.flatMap((d) =>
            reportedAt(d).map((p) => `${d.code} ${p.file}:${String(p.line)}`),
        );
        assert.deepEqual(
            findings.map((f) => `${f.code} ${f.file}:${String(f.line)}`).sort(),
            planted.sort(),
            'the planted defects, at the lines the manifest counts from 1',
        );
        // The findings say what is valid (item 6.11, proposals 2 and 3): a scope finding the
        // scopes the keyword or link takes and the links that lead there, a missing field the
        // value type and the values the base game writes.
        const dataOf = (code: string, file: string): Record<string, string | string[]> => {
            const found = findings.find((f) => f.code === code && f.file === file);
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
