/**
 * The server as an editor starts it (docs/PLAN.md item 7.3): its own process, spoken to over
 * standard input and output; what it announces; bad arguments; the settings it registers for;
 * and a whole session on a fixture mod: open, check in the background, shut down.
 */

import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
    createProtocolConnection,
    DiagnosticSeverity,
    IPCMessageReader,
    IPCMessageWriter,
} from 'vscode-languageserver-protocol/node';
import { gameStub, MAIN, MODS, scratch, spawnServer, TestClient, uriOf } from './testing.js';
import { SERVER_NAME, VERSION } from './version.js';

test('the version is the one in package.json', () => {
    const manifest = JSON.parse(
        readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    assert.equal(VERSION, manifest.version);
});

test('bad arguments stop the server before it speaks, with exit code 2', () => {
    for (const argv of [[], ['--socket=4000'], ['--stdio', '--node-ipc'], ['--stdio', '--spec']]) {
        const run = spawnSync(process.execPath, [MAIN, ...argv], { encoding: 'utf8' });
        assert.equal(run.status, 2, argv.join(' '));
        assert.match(run.stderr, /^pychivalry-lsp: .*\nusage: pychivalry-lsp/, argv.join(' '));
        assert.equal(run.stdout, '');
    }
});

test('it announces its capabilities and checks a fixture mod in the background', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const { client } = spawnServer(t, { gamePath: game });
    const result = await client.start([mod]);
    assert.deepEqual(result['serverInfo'], { name: SERVER_NAME, version: VERSION });
    const capabilities = result['capabilities'] as Record<string, unknown>;
    assert.deepEqual(capabilities['textDocumentSync'], { openClose: true, change: 2 });
    for (const feature of [
        'hoverProvider',
        'definitionProvider',
        'referencesProvider',
        'documentSymbolProvider',
    ]) {
        assert.equal(capabilities[feature], true, feature);
    }
    assert.deepEqual(capabilities['completionProvider'], { resolveProvider: false });
    const done = await client.settled();
    assert.equal(done.cancelled, false);
    assert.equal(done.limited, false);
    assert.ok(done.checked >= 1);
    assert.ok(client.registrations.includes('workspace/didChangeWatchedFiles'));
    assert.ok(client.registrations.includes('workspace/didChangeConfiguration'));
    const errors = [...client.diagnostics.values()].flatMap((d) =>
        d.diagnostics.filter((x) => x.severity === DiagnosticSeverity.Error),
    );
    assert.ok(errors.some((e) => e.code === 'names/unknown-trigger'));
    assert.equal(client.messages.length, 0, JSON.stringify(client.messages));
    assert.ok(uriOf(mod).startsWith('file:'));
});

test('it runs as a Node module over IPC, as the extension starts it', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const cache = path.join(scratch(t), 'cache');
    const child = fork(MAIN, ['--node-ipc', `--clientProcessId=${String(process.pid)}`], {
        env: { ...process.env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    const connection = createProtocolConnection(
        new IPCMessageReader(child),
        new IPCMessageWriter(child),
    );
    const client = new TestClient(connection, { gamePath: game });
    t.after(() => {
        connection.dispose();
        child.kill();
    });
    const result = await client.start([path.join(MODS, 'names-unknown-trigger-bad')]);
    assert.deepEqual(result['serverInfo'], { name: SERVER_NAME, version: VERSION });
    const done = await client.settled();
    assert.equal(done.complete, true);
    assert.ok(client.diagnostics.size > 0);
    await client.shutdown();
});
