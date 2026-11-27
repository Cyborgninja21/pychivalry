/**
 * The agent server and a base game another program lends (docs/shared-index.md): over a real
 * round trip, every tool's answer through the lender is the one the agent server gives alone,
 * page after page; when the lender stops between two calls, the next is answered alone, the
 * same; while the lender answers, the server holds no base game of its own; and a request of
 * another spec package is refused.
 */

import assert from 'node:assert/strict';
import {
    currentPlatform,
    drain,
    drainInSlices,
    IndexHost,
    openSpec,
    openWorkspace,
    shareBase,
    BaseRefused,
    type HostRequest,
} from '@pychivalry/core';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './args.js';
import { McpHost, askForTool, type McpRequest } from './share.js';
import { Session } from './session.js';
import { cacheEnv, connect, GAMES, scratch, type Connection } from './testing.js';
import { VERSION } from './version.js';

const spec = openSpec(defaultSpecDir());
const GAME = path.join(GAMES, 'planted-defects', 'game');
const MOD = path.resolve(GAMES, '..', 'defects', 'mod');
const OFF = { PYCHIVALRY_SHARED_INDEX: 'off' };

function lent() {
    const workspace = openWorkspace({ spec, gameDir: GAME, cacheDir: null, modDir: null });
    assert.ok(workspace.game !== null);
    return shareBase(workspace.game, {
        specSha256: spec.sha256,
        gameDir: GAME,
        platform: currentPlatform(),
        fallbackEncoding: undefined,
    });
}

async function lend(t: TestContext, cache: string): Promise<{ host: IndexHost; mcp: McpHost }> {
    const mcp = new McpHost({ spec, base: lent(), cacheDir: null });
    const host = await IndexHost.start({
        env: cacheEnv(cache),
        platform: process.platform,
        home: cache,
        specSha256: spec.sha256,
        handle: (request: HostRequest) => drainInSlices(mcp.serveSteps(request)),
    });
    t.after(async () => {
        await host.stop();
    });
    assert.equal(host.lending, true);
    return { host, mcp };
}

/** Every page of a tool, following the cursor. */
async function allPages(
    server: Connection,
    tool: string,
    args: Record<string, unknown>,
): Promise<unknown[]> {
    const pages: unknown[] = [];
    let cursor: unknown = undefined;
    do {
        const out = await server.output(tool, cursor === undefined ? args : { ...args, cursor });
        pages.push(out);
        cursor = out['next_cursor'];
    } while (cursor !== undefined && cursor !== null);
    return pages;
}

const CALLS: readonly [string, Record<string, unknown>][] = [
    ['check', { min_severity: 'hint', limit: 5 }],
    ['check', { path: 'events', min_severity: 'warning' }],
    ['lookup', { names: ['is_adult', 'planted_unknown_thing'] }],
    ['lookup', { names: ['is_adult', 'option'], folder: 'events', language: 'l_english' }],
    ['source', { layer: 'mod', file: 'events/harvest_events.txt', line: 3 }],
    ['source', { layer: 'game', file: 'common/scripted_effects/00_feast_effects.txt', line: 1 }],
    ['find_references', { name: 'is_adult', limit: 5 }],
    ['list_definitions', { kind: 'common/scripted_effects', limit: 20 }],
    ['find_definition', { name: 'is_adult' }],
    ['explain_code', { codes: ['names/unknown-trigger'] }],
];

test("every tool's answer through the lender is the agent server's own", async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const { host, mcp } = await lend(t, cache);
    const argv = ['--mod', MOD, '--vanilla', GAME];
    const shared = await connect(t, argv, cache);
    const alone = await connect(t, argv, cache, OFF);
    for (const [tool, args] of CALLS) {
        assert.deepEqual(
            await allPages(shared, tool, args),
            await allPages(alone, tool, args),
            `${tool} ${JSON.stringify(args)}`,
        );
    }
    assert.ok((host.status().answered['mcp'] ?? 0) >= CALLS.length);
    assert.equal(mcp.size, 1, 'one session for the one server');
});

test('when the lender stops between two calls, the next is answered alone, the same', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const { host } = await lend(t, cache);
    const server = await connect(t, ['--mod', MOD, '--vanilla', GAME], cache);
    const first = await allPages(server, 'check', { min_severity: 'hint' });
    assert.equal(host.status().answered['mcp'], first.length);
    await host.stop();
    const second = await allPages(server, 'check', { min_severity: 'hint' });
    assert.deepEqual(second, first);
    assert.equal(host.status().lending, false);
});

test('while the lender answers, the server holds no base game of its own', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const session = new Session({
        spec,
        modDir: MOD,
        game: { dir: GAME, source: 'vanilla', notFound: false },
        cacheDir: null,
        place: { env: cacheEnv(cache), platform: process.platform, home: cache },
    });
    session.workspace();
    assert.equal(session.holdsIndex, true);
    const answered = await askForTool(session, 'lookup', { name: 'is_adult' }, () =>
        Promise.resolve({ answered: true, answer: { content: [{ type: 'text', text: '{}' }] } }),
    );
    assert.deepEqual(answered, { content: [{ type: 'text', text: '{}' }] });
    assert.equal(session.holdsIndex, false, 'its own copy is let go');
    const unanswered = await askForTool(session, 'lookup', { name: 'is_adult' }, () =>
        Promise.resolve({ answered: false, reason: 'no program lends this base game' }),
    );
    assert.equal(unanswered, null, 'then the tool runs here');
    const off = new Session({
        spec,
        modDir: MOD,
        game: { dir: GAME, source: 'vanilla', notFound: false },
        cacheDir: null,
        place: { env: { ...cacheEnv(cache), ...OFF }, platform: process.platform, home: cache },
    });
    let asked = false;
    await askForTool(off, 'lookup', {}, () => {
        asked = true;
        return Promise.resolve({ answered: false, reason: '' });
    });
    assert.equal(asked, false, 'sharing turned off asks nothing');
});

test('a request of another spec package, version or tool is refused', () => {
    const mcp = new McpHost({ spec, base: lent(), cacheDir: null });
    const request: McpRequest = {
        kind: 'mcp',
        version: VERSION,
        session: 'x',
        pid: process.pid,
        specSha256: spec.sha256,
        modDir: MOD,
        game: { dir: GAME, source: 'vanilla', notFound: false },
        tool: 'lookup',
        args: { names: ['is_adult'] },
    };
    assert.equal(drain(mcp.serveSteps(request)).isError, undefined, 'answered');
    assert.throws(() => drain(mcp.serveSteps({ ...request, version: 'another' })), BaseRefused);
    assert.throws(() => drain(mcp.serveSteps({ ...request, tool: 'no_such_tool' })), BaseRefused);
    assert.throws(
        () => drain(mcp.serveSteps({ ...request, specSha256: '0'.repeat(64) })),
        BaseRefused,
    );
    assert.throws(() => drain(mcp.serveSteps({ kind: 'mcp' })), BaseRefused);
});
