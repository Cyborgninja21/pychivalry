/**
 * The local channel (docs/shared-index.md; AGENTS.md, rule 12): it binds and connects a path and
 * nothing else. Every address that is a port, a host, an IP address, a relative path, an
 * abstract socket or another machine's pipe is refused before Node's networking module sees it;
 * its source passes only `{ path }` to that module; and a message goes both ways on a real local
 * address of this system.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { privateFolder, randomHex } from './address.js';
import { connectLocal, isLocalAddress, listenLocal, localAddress } from './channel.js';

const RANDOM = '0123456789abcdef0123456789abcdef';

/** Addresses that are not a local path, on any system. */
const NOT_LOCAL: readonly string[] = [
    '8080',
    ':8080',
    'localhost',
    'localhost:8080',
    '127.0.0.1',
    '127.0.0.1:8080',
    '0.0.0.0:0',
    '[::1]:8080',
    '::',
    'example.com:443',
    'tcp://127.0.0.1:8080',
    'http://localhost/',
    `pychivalry-${RANDOM}.sock`,
    `./pychivalry-${RANDOM}.sock`,
    `\u0000pychivalry-${RANDOM}`,
    `/tmp/\u0000pychivalry-${RANDOM}.sock`,
    `\\\\server\\pipe\\pychivalry-${RANDOM}`,
    `\\\\?\\pipe\\pychivalry-${RANDOM}`,
    `//./pipe/pychivalry-${RANDOM}`,
    '',
];

test('a port, a host, an IP address or another machine is never a local address', () => {
    for (const platform of ['linux', 'win32', 'darwin'] as const) {
        for (const address of NOT_LOCAL) {
            assert.equal(isLocalAddress(address, platform), false, `${platform}: ${address}`);
        }
    }
    assert.equal(isLocalAddress(`/run/user/1000/pychivalry-${RANDOM}.sock`, 'linux'), true);
    assert.equal(isLocalAddress(`/tmp/other-${RANDOM}.sock`, 'linux'), false);
    assert.equal(isLocalAddress(`/${'a'.repeat(120)}/pychivalry-${RANDOM}.sock`, 'linux'), false);
    assert.equal(isLocalAddress(`\\\\.\\pipe\\pychivalry-${RANDOM}`, 'win32'), true);
    assert.equal(isLocalAddress(`\\\\.\\pipe\\pychivalry-${RANDOM}`, 'linux'), false);
    assert.equal(isLocalAddress(`/tmp/pychivalry-${RANDOM}.sock`, 'win32'), false);
    assert.equal(localAddress('/x', RANDOM, 'win32'), `\\\\.\\pipe\\pychivalry-${RANDOM}`);
    assert.equal(localAddress('/x', RANDOM, 'linux'), `/x/pychivalry-${RANDOM}.sock`);
});

test('the channel refuses to bind or connect anything but a local address', async () => {
    for (const address of NOT_LOCAL) {
        await assert.rejects(
            listenLocal(address, () => undefined),
            /not a local channel address/,
            address,
        );
        await assert.rejects(connectLocal(address, 100), /not a local channel address/, address);
    }
});

test("the channel's source hands Node's networking module a path, never a port or a host", () => {
    const source = readFileSync(
        fileURLToPath(new URL('../../src/share/channel.ts', import.meta.url)),
        'utf8',
    );
    const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const listens = [...code.matchAll(/\.listen\(([^)]*)/g)].map((m) => m[1] ?? '');
    const connects = [...code.matchAll(/\bconnect\(([^)]*)/g)].map((m) => m[1] ?? '');
    assert.equal(listens.length, 1, 'one listen call');
    assert.equal(connects.length, 1, 'one connect call');
    for (const call of [...listens, ...connects]) {
        assert.match(call, /^\{ path: address\b/, call);
        assert.doesNotMatch(call, /\b(port|host)\b/, call);
    }
    assert.equal((code.match(/refuseAddress\(address\)/g) ?? []).length, 2);
    assert.doesNotMatch(code, /\b(port|host|hostname)\s*:/);
});

test('a message goes both ways on a local address of this system', async (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-channel-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    const folder = path.join(dir, 'host');
    assert.ok(privateFolder(folder, true));
    const address = localAddress(folder, randomHex());
    const server = await listenLocal(address, (connection) => {
        connection.onMessage((message) => {
            connection.send({ echo: message });
        });
    });
    if (process.platform !== 'win32') {
        assert.ok(existsSync(address), 'the socket is a file in the folder');
        assert.equal(statSync(folder).mode & 0o077, 0, 'the folder is its owner’s only');
    }
    const client = await connectLocal(address, 1000);
    const reply = await new Promise<unknown>((resolve) => {
        client.onMessage(resolve);
        client.send({ hello: 'world' });
    });
    assert.deepEqual(reply, { echo: { hello: 'world' } });
    client.close();
    await server.close();
    if (process.platform !== 'win32') {
        assert.equal(existsSync(address), false, 'the socket file goes with the channel');
    }
    await assert.rejects(connectLocal(address, 500));
});
