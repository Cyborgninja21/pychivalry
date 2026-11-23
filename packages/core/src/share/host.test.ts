/**
 * Asking and lending (docs/shared-index.md): a program asks the one that lends and gets its
 * answer; with no lender, a lender that is gone, one that refuses, one that falls silent, one
 * that dies in the middle of a request or one that holds another token, the program is told so
 * within a bound and works alone; a second lender waits while the first lends and takes over
 * when it is gone; sharing turned off lends and asks nothing; and the address files' folder is
 * its owner's only.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    statSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
    addressFile,
    hostFolder,
    privateFolder,
    randomHex,
    readAddress,
    writeAddress,
} from './address.js';
import { BaseRefused } from './base.js';
import { askHost, IndexHost, type HostRequest, type Place } from './host.js';

const SPEC = 'a'.repeat(64);

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-host-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A user whose cache folder is `dir`. */
function placeIn(dir: string, extra: Record<string, string> = {}): Place {
    return {
        env: { XDG_CACHE_HOME: dir, LOCALAPPDATA: dir, ...extra },
        platform: process.platform,
        home: dir,
    };
}

async function lender(
    t: TestContext,
    place: Place,
    handle: (request: HostRequest) => Promise<unknown>,
    options: { claimMs?: number; heartbeatMs?: number } = {},
): Promise<IndexHost> {
    const host = await IndexHost.start({ ...place, specSha256: SPEC, handle, ...options });
    t.after(async () => {
        await host.stop();
    });
    return host;
}

const echo = (request: HostRequest): Promise<unknown> => Promise.resolve({ echo: request });

async function timed<T>(work: Promise<T>): Promise<{ value: T; ms: number }> {
    const started = Date.now();
    const value = await work;
    return { value, ms: Date.now() - started };
}

test('a program asks the one that lends, and gets its answer', async (t) => {
    const place = placeIn(scratch(t));
    const host = await lender(t, place, echo);
    assert.equal(host.lending, true);
    const reply = await askHost(SPEC, { kind: 'test', n: 1 }, place);
    assert.deepEqual(reply, { answered: true, answer: { echo: { kind: 'test', n: 1 } } });
    assert.deepEqual(host.status(), {
        lending: true,
        answered: { test: 1 },
        refused: 0,
        failed: 0,
    });
    const other = await askHost('b'.repeat(64), { kind: 'test' }, place);
    assert.equal(other.answered, false, 'another spec package has no lender');
});

test('with no lender, a program is told at once and works alone', async (t) => {
    const place = placeIn(scratch(t));
    const { value, ms } = await timed(askHost(SPEC, { kind: 'test' }, place));
    assert.equal(value.answered, false);
    assert.ok(ms < 1000, `${String(ms)} ms`);
});

test('a lender that is gone leaves an address nothing answers on, and is not waited for', async (t) => {
    const dir = scratch(t);
    const place = placeIn(dir);
    const folder = hostFolder(place.env, place.platform, place.home);
    assert.ok(privateFolder(folder, true));
    const dead = path.join(folder, `pychivalry-${randomHex()}.sock`);
    writeAddress(addressFile(folder, SPEC), {
        format: 1,
        pid: 999_999_999,
        address: process.platform === 'win32' ? `\\\\.\\pipe\\pychivalry-${randomHex()}` : dead,
        token: randomHex(),
        started: new Date().toISOString(),
    });
    const { value, ms } = await timed(askHost(SPEC, { kind: 'test' }, place));
    assert.equal(value.answered, false);
    assert.ok(ms < 1500, `${String(ms)} ms`);
    // A program that would lend takes the address over.
    const host = await lender(t, place, echo);
    assert.equal(host.lending, true);
    assert.deepEqual((await askHost(SPEC, { kind: 'test' }, place)).answered, true);
});

test('a refusal, a failure and a wrong token are told, and the program works alone', async (t) => {
    const place = placeIn(scratch(t));
    const host = await lender(t, place, (request) => {
        if (request.kind === 'refuse') {
            return Promise.reject(new BaseRefused('another game folder'));
        }
        return Promise.reject(new Error('broken'));
    });
    assert.deepEqual(await askHost(SPEC, { kind: 'refuse' }, place), {
        answered: false,
        reason: 'refused: another game folder',
    });
    assert.deepEqual(await askHost(SPEC, { kind: 'fail' }, place), {
        answered: false,
        reason: 'failed: broken',
    });
    const folder = hostFolder(place.env, place.platform, place.home);
    const file = addressFile(folder, SPEC);
    const record = readAddress(file);
    assert.ok(record !== null);
    writeAddress(file, { ...record, token: randomHex() });
    const wrong = await askHost(SPEC, { kind: 'test' }, place);
    assert.deepEqual(wrong, { answered: false, reason: 'refused: a wrong token' });
    assert.equal(host.status().refused, 2);
    assert.equal(host.status().failed, 1);
});

test('a lender that falls silent is given up within the bound', async (t) => {
    const place = placeIn(scratch(t));
    await lender(t, place, () => new Promise(() => undefined), { heartbeatMs: 60_000 });
    const { value, ms } = await timed(
        askHost(SPEC, { kind: 'test' }, { ...place, silenceMs: 300 }),
    );
    assert.deepEqual(value, { answered: false, reason: 'the lending program fell silent' });
    assert.ok(ms < 2000, `${String(ms)} ms`);
});

test('a lender that keeps saying it works is waited for past the silence bound', async (t) => {
    const place = placeIn(scratch(t));
    await lender(
        t,
        place,
        () =>
            new Promise((resolve) =>
                setTimeout(() => {
                    resolve('done');
                }, 900),
            ),
        {
            heartbeatMs: 100,
        },
    );
    const reply = await askHost(SPEC, { kind: 'test' }, { ...place, silenceMs: 300 });
    assert.deepEqual(reply, { answered: true, answer: 'done' });
});

test('a lender that dies in the middle of a request takes nothing with it', async (t) => {
    const dir = scratch(t);
    const place = placeIn(dir);
    const script = path.join(dir, 'lender.mjs');
    const hostModule = pathToFileURL(path.join(import.meta.dirname, 'host.js')).href;
    writeFileSync(
        script,
        [
            `import { IndexHost } from ${JSON.stringify(hostModule)};`,
            `const host = await IndexHost.start({ env: { XDG_CACHE_HOME: ${JSON.stringify(dir)}, LOCALAPPDATA: ${JSON.stringify(dir)} }, platform: process.platform, home: ${JSON.stringify(dir)}, specSha256: ${JSON.stringify(SPEC)}, handle: () => new Promise(() => undefined) });`,
            `process.stdout.write(host.lending ? 'lending\\n' : 'not lending\\n');`,
        ].join('\n'),
    );
    const child = spawn(process.execPath, [script], { stdio: ['ignore', 'pipe', 'inherit'] });
    t.after(() => {
        child.kill();
    });
    const said = await new Promise<string>((resolve) => {
        child.stdout.once('data', (chunk: Buffer) => {
            resolve(chunk.toString('utf8').trim());
        });
    });
    assert.equal(said, 'lending');
    const asked = askHost(SPEC, { kind: 'test' }, { ...place, silenceMs: 30_000 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    child.kill('SIGKILL');
    const { value, ms } = await timed(asked);
    assert.equal(value.answered, false);
    assert.ok(ms < 5000, `${String(ms)} ms after the lender died`);
    // Its address file is left behind, naming a program that is gone: the next one takes over.
    const host = await lender(t, place, echo);
    assert.equal(host.lending, true);
});

test('a second lender waits while the first lends, and takes over when it stops', async (t) => {
    const place = placeIn(scratch(t));
    const first = await lender(t, place, () => Promise.resolve('first'), { claimMs: 100 });
    const second = await lender(t, place, () => Promise.resolve('second'), { claimMs: 100 });
    assert.equal(first.lending, true);
    assert.equal(second.lending, false);
    assert.deepEqual(await askHost(SPEC, { kind: 'test' }, place), {
        answered: true,
        answer: 'first',
    });
    await first.stop();
    const started = Date.now();
    const lendingNow = (): boolean => second.lending;
    while (!lendingNow() && Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(second.lending, true);
    assert.deepEqual(await askHost(SPEC, { kind: 'test' }, place), {
        answered: true,
        answer: 'second',
    });
});

test('sharing turned off lends nothing and asks nothing', async (t) => {
    const dir = scratch(t);
    const on = placeIn(dir);
    const off = placeIn(dir, { PYCHIVALRY_SHARED_INDEX: 'off' });
    const quiet = await lender(t, off, echo);
    assert.equal(quiet.lending, false);
    await lender(t, on, echo);
    assert.deepEqual(await askHost(SPEC, { kind: 'test' }, off), {
        answered: false,
        reason: 'sharing is off',
    });
    assert.equal((await askHost(SPEC, { kind: 'test' }, on)).answered, true);
});

test(
    'the address files are in an owner-only folder, beside the index cache',
    { skip: process.platform === 'win32' },
    (t) => {
        const dir = scratch(t);
        assert.equal(
            hostFolder({ XDG_CACHE_HOME: dir }, 'linux', '/home/u'),
            path.posix.join(dir, 'pychivalry', 'host'),
        );
        assert.equal(
            hostFolder({ LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, 'win32', 'C:\\Users\\u'),
            'C:\\Users\\u\\AppData\\Local\\pychivalry\\Cache\\host',
        );
        const folder = path.join(dir, 'host');
        assert.equal(privateFolder(folder, false), false, 'a missing folder is not made unasked');
        assert.equal(privateFolder(folder, true), true);
        assert.equal(statSync(folder).mode & 0o777, 0o700);
        chmodSync(folder, 0o755);
        assert.equal(privateFolder(folder, false), true, 'what others may do is taken away');
        assert.equal(statSync(folder).mode & 0o077, 0);
        const real = path.join(dir, 'real');
        mkdirSync(real, { mode: 0o700 });
        const link = path.join(dir, 'link');
        symlinkSync(real, link);
        assert.equal(privateFolder(link, false), false, 'a link is not the folder');
        assert.ok(existsSync(real));
    },
);
