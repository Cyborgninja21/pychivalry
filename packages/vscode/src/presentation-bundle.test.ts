/**
 * The presentation data in the extension's bundle (`task vscode:bundle`; docs/PLAN.md item
 * 8.8): its `.json` files sit beside the bundled language server, every one of the
 * repository's, and the bundled server reads them from there: over standard input and output,
 * an events file's outline follows the events outline rule. Runs on Linux and Windows with no
 * editor.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LSP_FILE, LSP_FOLDER, SPEC_FOLDER } from './launch.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const LSP_DIR = path.join(PACKAGE, 'dist', 'bundle', LSP_FOLDER);
const SPEC = path.join(PACKAGE, 'dist', 'bundle', 'server', SPEC_FOLDER);

function jsonFiles(dir: string, under = ''): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(dir, under), { withFileTypes: true })) {
        const relative = under === '' ? entry.name : `${under}/${entry.name}`;
        if (entry.isDirectory()) {
            out.push(...jsonFiles(dir, relative));
        } else if (entry.name.endsWith('.json') && entry.name !== 'presentation.schema.json') {
            out.push(relative);
        }
    }
    return out.sort();
}

test("the bundle holds the repository's presentation data beside the language server", () => {
    const shipped = jsonFiles(path.join(LSP_DIR, 'presentation'));
    assert.deepEqual(shipped, jsonFiles(path.join(REPO, 'presentation')));
    assert.ok(shipped.includes('events.json') && shipped.includes('_all.json'));
});

/** A message of the language-server protocol, framed as on standard input and output. */
function frame(message: object): string {
    const body = JSON.stringify({ jsonrpc: '2.0', ...message });
    return `Content-Length: ${String(Buffer.byteLength(body, 'utf8'))}\r\n\r\n${body}`;
}

test('the bundled language server reads its presentation data: an event in the outline', async (t) => {
    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-presentation-'));
    t.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const game = path.join(root, 'install', 'game');
    mkdirSync(path.join(game, 'common'), { recursive: true });
    mkdirSync(path.join(root, 'install', 'launcher'), { recursive: true });
    writeFileSync(
        path.join(root, 'install', 'launcher', 'launcher-settings.json'),
        `${JSON.stringify({ gameId: 'ck3', rawVersion: '1.21.0.3', dlcPath: '../game' })}\n`,
    );
    const mod = path.join(root, 'mod');
    const file = path.join(mod, 'events', 'bundle_events.txt');
    mkdirSync(path.dirname(file), { recursive: true });
    const text = 'namespace = bundle\n\nbundle.1 = {\n\ttype = character_event\n}\n';
    writeFileSync(file, text);
    const child = spawn(
        process.execPath,
        [path.join(LSP_DIR, LSP_FILE), '--stdio', '--spec', SPEC],
        {
            env: {
                PATH: process.env['PATH'] ?? '',
                HOME: root,
                USERPROFILE: root,
                XDG_CACHE_HOME: root,
                LOCALAPPDATA: root,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        },
    );
    t.after(() => {
        child.kill();
    });
    const replies = new Map<number, unknown>();
    let buffer = Buffer.alloc(0);
    let done = false;
    const waiters: (() => void)[] = [];
    child.stdout.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
            const head = buffer.indexOf('\r\n\r\n');
            const length = /Content-Length: (\d+)/i.exec(
                buffer.subarray(0, head).toString('ascii'),
            );
            if (head < 0 || length === null || buffer.length < head + 4 + Number(length[1])) {
                break;
            }
            const body = buffer.subarray(head + 4, head + 4 + Number(length[1]));
            buffer = buffer.subarray(head + 4 + Number(length[1]));
            const message = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
            if (typeof message['id'] === 'number' && !('method' in message)) {
                replies.set(message['id'], message['result']);
            } else if (message['method'] === 'pychivalry/backgroundDone') {
                done = true;
            } else if (typeof message['id'] !== 'undefined') {
                // A request of the server: answered empty.
                child.stdin.write(frame({ id: message['id'], result: null }));
            }
            for (const w of waiters.splice(0)) {
                w();
            }
        }
    });
    const until = async (ready: () => boolean): Promise<void> => {
        const started = Date.now();
        while (!ready()) {
            assert.ok(Date.now() - started < 60_000, 'the bundled server did not answer');
            await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, 200);
                waiters.push(() => {
                    clearTimeout(timer);
                    resolve();
                });
            });
        }
    };
    const uri = pathToFileURL(file).href;
    child.stdin.write(
        frame({
            id: 1,
            method: 'initialize',
            params: {
                processId: null,
                rootUri: pathToFileURL(mod).href,
                workspaceFolders: [{ uri: pathToFileURL(mod).href, name: 'mod' }],
                capabilities: {
                    textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } },
                },
                initializationOptions: { settings: { pychivalry: { gamePath: game } } },
            },
        }),
    );
    await until(() => replies.has(1));
    child.stdin.write(frame({ method: 'initialized', params: {} }));
    await until(() => done);
    child.stdin.write(
        frame({
            method: 'textDocument/didOpen',
            params: { textDocument: { uri, languageId: 'ck3', version: 1, text } },
        }),
    );
    child.stdin.write(
        frame({ id: 2, method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }),
    );
    await until(() => replies.has(2));
    const symbols = replies.get(2) as { name: string; kind: number; detail?: string }[];
    // SymbolKind.Event is 24: the events outline rule, read from the bundled data.
    assert.deepEqual(
        symbols.map((s) => [s.name, s.kind, s.detail]),
        [
            ['namespace', 7, undefined],
            ['bundle.1', 24, 'character_event'],
        ],
    );
    child.stdin.write(frame({ id: 3, method: 'shutdown' }));
    await until(() => replies.has(3));
    child.stdin.write(frame({ method: 'exit' }));
});
