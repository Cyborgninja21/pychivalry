/**
 * The language server lends its base game (docs/shared-index.md): once its mod is open it
 * answers the command line, a real process, with the findings the editor shows, and the agent
 * server's calls with the agent server's own answers; a second language server does not lend
 * while the first does and takes over when the first shuts down; with sharing turned off it
 * lends nothing.
 */

import assert from 'node:assert/strict';
import { askHost, type HostRequest, type Place } from '@pychivalry/core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { SHARING_REQUEST, type SharingStatus } from './lend.js';
import { FINDINGS_REQUEST, type FindingsResult } from './server.js';
import {
    committedSpec,
    GAMES,
    REPO_ROOT,
    scratch,
    serverInProcess,
    uriOf,
    type TestClient,
} from './testing.js';

const GAME = path.join(GAMES, 'planted-defects', 'game');
const MOD = path.join(REPO_ROOT, 'fixtures', 'defects', 'mod');
const CLI = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'main.js');

function placeIn(cache: string): Place {
    return {
        env: { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        platform: process.platform,
        home: cache,
    };
}

/** The command line, a process of its own, with the cache folder `cache`. */
async function commandLine(
    argv: readonly string[],
    cache: string,
): Promise<{ code: number; stdout: string }> {
    const child = spawn(process.execPath, [CLI, ...argv], {
        env: { ...process.env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk;
    });
    const code = await new Promise<number>((resolve) => {
        child.on('close', (status) => {
            resolve(status ?? -1);
        });
    });
    return { code, stdout };
}

async function opened(
    t: TestContext,
    cache: string,
    mod: string,
    env: Readonly<Record<string, string>> = {},
): Promise<TestClient> {
    const { client } = serverInProcess(t, { gamePath: GAME }, { cache, lend: true, env });
    await client.start([mod]);
    await client.until(() => client.done.some((d) => d.complete), 'the first full result');
    return client;
}

async function sharing(client: TestClient): Promise<SharingStatus> {
    return client.connection.sendRequest<SharingStatus>(SHARING_REQUEST);
}

async function until(ready: () => Promise<boolean>, what: string): Promise<void> {
    const started = Date.now();
    while (!(await ready())) {
        if (Date.now() - started > 10_000) {
            throw new Error(`timed out waiting for ${what}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

test('the language server answers the command line with the findings the editor shows', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const client = await opened(t, cache, MOD);
    await until(async () => (await sharing(client)).lending, 'lending');
    const run = await commandLine(['check', MOD, '--vanilla', GAME, '--json'], cache);
    assert.equal(run.code, 1);
    const lines = run.stdout.trimEnd().split('\n');
    const summary = JSON.parse(lines.pop() ?? '{}') as {
        summary: { game: { shared: boolean }; files_checked: number };
    };
    assert.equal(summary.summary.game.shared, true);
    const fromCli = lines
        .map(
            (l) => JSON.parse(l) as { file: string; range: unknown; code: string; message: string },
        )
        .map((f) => JSON.stringify([f.file, f.range, f.code, f.message]))
        .sort();
    const files = [...new Set(lines.map((l) => (JSON.parse(l) as { file: string }).file))];
    const fromEditor: string[] = [];
    for (const file of files) {
        const result = await client.connection.sendRequest<FindingsResult>(FINDINGS_REQUEST, {
            uri: uriOf(path.join(MOD, ...file.split('/'))),
        });
        fromEditor.push(
            ...result.findings.map((f) => JSON.stringify([f.file, f.range, f.code, f.message])),
        );
    }
    assert.ok(fromCli.length > 20, `${String(fromCli.length)} findings`);
    assert.deepEqual(fromEditor.sort(), fromCli);
    const status = await sharing(client);
    assert.deepEqual(status.answered, { cli: 1 });
});

test("the language server answers the agent server's calls with the agent server's answers", async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const client = await opened(t, cache, MOD);
    await until(async () => (await sharing(client)).lending, 'lending');
    const spec = committedSpec();
    const request: HostRequest = {
        kind: 'mcp',
        version: '0.0.0',
        session: 'test',
        pid: process.pid,
        specSha256: spec.sha256,
        modDir: MOD,
        game: { dir: GAME, source: 'vanilla', notFound: false },
        tool: 'check',
        args: { min_severity: 'hint' },
    };
    const reply = await askHost(spec.sha256, request, placeIn(cache));
    assert.equal(reply.answered, true);
    const answer = (
        reply as {
            answer: {
                structuredContent: {
                    totals: {
                        by_severity: Record<string, number>;
                        by_code: Record<string, number>;
                    };
                };
            };
        }
    ).answer;
    // The planted defects, and the `style/` family's findings on its files apart: one warning a
    // file not in pychivalry's format, and hints at each place.
    const totals = answer.structuredContent.totals;
    const style = Object.entries(totals.by_code).filter(([code]) => code.startsWith('style/'));
    const styleWarnings = style
        .filter(([code]) => code === 'style/not-formatted')
        .reduce((n, [, count]) => n + count, 0);
    const styleHints = style
        .filter(([code]) => code !== 'style/not-formatted')
        .reduce((n, [, count]) => n + count, 0);
    assert.ok(styleWarnings > 0 && styleHints > 0);
    assert.deepEqual(totals.by_severity, {
        error: 26,
        warning: 7 + styleWarnings,
        information: 0,
        hint: styleHints,
    });
    const status = await sharing(client);
    assert.equal(status.answered['mcp'], 1);
    assert.equal(status.sessions, 1);
});

test('a second language server lends only once the first has shut down', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const first = await opened(t, cache, MOD);
    await until(async () => (await sharing(first)).lending, 'the first lending');
    const second = await opened(
        t,
        cache,
        path.join(REPO_ROOT, 'fixtures', 'mods', 'names-unknown-trigger-bad'),
    );
    assert.equal((await sharing(second)).lending, false, 'the first lends');
    await first.shutdown();
    await until(async () => (await sharing(second)).lending, 'the second lending');
    const run = await commandLine(['check', MOD, '--vanilla', GAME, '--json'], cache);
    assert.equal(run.code, 1);
    assert.deepEqual((await sharing(second)).answered, { cli: 1 }, 'the second answered it');
});

test('with sharing turned off the language server lends nothing', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const client = await opened(t, cache, MOD, { PYCHIVALRY_SHARED_INDEX: 'off' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await sharing(client)).lending, false);
    const reply = await askHost(committedSpec().sha256, { kind: 'cli' }, placeIn(cache));
    assert.equal(reply.answered, false);
});
