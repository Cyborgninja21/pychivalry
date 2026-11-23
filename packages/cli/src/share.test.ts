/**
 * The command line and a base game another program lends (docs/shared-index.md): `check` and
 * `lookup` are answered by the lender with exactly what the command line prints alone, the
 * summary saying the base game was shared; a request the lender refuses (another game folder),
 * or no lender at all, and the command line runs alone with the same answer; commands that do
 * not read the base game are never sent.
 */

import assert from 'node:assert/strict';
import {
    drainInSlices,
    IndexHost,
    openSpec,
    openWorkspace,
    currentPlatform,
    shareBase,
    type HostReply,
    type HostRequest,
} from '@pychivalry/core';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './io.js';
import { readsBaseGame, runShared, serveCliSteps } from './share.js';
import {
    cacheEnv,
    gameStub,
    REPO_ROOT,
    runCli,
    scratch,
    spawnCliAsync,
    type Result,
} from './testing.js';

const spec = openSpec(defaultSpecDir());
const GAME = path.join(REPO_ROOT, 'fixtures', 'game', 'planted-defects', 'game');
const MOD = path.join(REPO_ROOT, 'fixtures', 'defects', 'mod');
const OFF = { PYCHIVALRY_SHARED_INDEX: 'off' };

/** A lender of the planted-defect game stub for a user whose cache folder is `cache`. */
async function lend(t: TestContext, cache: string): Promise<IndexHost> {
    const workspace = openWorkspace({ spec, gameDir: GAME, cacheDir: null, modDir: null });
    assert.ok(workspace.game !== null);
    const base = shareBase(workspace.game, {
        specSha256: spec.sha256,
        gameDir: GAME,
        platform: currentPlatform(),
        fallbackEncoding: undefined,
    });
    const host = await IndexHost.start({
        env: cacheEnv(cache),
        platform: process.platform,
        home: cache,
        specSha256: spec.sha256,
        handle: (request: HostRequest) => drainInSlices(serveCliSteps(request, { spec, base })),
    });
    t.after(async () => {
        await host.stop();
    });
    assert.equal(host.lending, true);
    return host;
}

/** Output without the JSON summary's last line, and that summary. */
function split(result: Result): { lines: string; summary: { game: Record<string, unknown> } } {
    const lines = result.stdout.trimEnd().split('\n');
    const last = lines.pop() ?? '{}';
    return {
        lines: lines.join('\n'),
        summary: (JSON.parse(last) as { summary: { game: Record<string, unknown> } }).summary,
    };
}

test('check and lookup are answered by the lender with what the command line prints alone', async (t) => {
    const cache = path.join(scratch(t), 'cache');
    const host = await lend(t, cache);
    const json = ['check', MOD, '--vanilla', GAME, '--json'];
    const shared = await spawnCliAsync(json, cache);
    const alone = await spawnCliAsync(json, cache, OFF);
    assert.equal(shared.code, 1, shared.stderr);
    assert.equal(shared.code, alone.code);
    assert.equal(split(shared).lines, split(alone).lines);
    assert.ok(split(shared).lines.length > 1000, 'the planted mod has findings');
    assert.equal(split(shared).summary.game['shared'], true);
    assert.equal(split(alone).summary.game['shared'], false);
    const text = ['check', MOD, '--vanilla', GAME];
    const sharedText = await spawnCliAsync(text, cache);
    const aloneText = await spawnCliAsync(text, cache, OFF);
    assert.equal(sharedText.stdout, aloneText.stdout);
    assert.equal(sharedText.stderr, aloneText.stderr);
    const lookup = ['lookup', 'is_adult', '--mod', MOD, '--vanilla', GAME, '--json'];
    const sharedLookup = await spawnCliAsync(lookup, cache);
    const aloneLookup = await spawnCliAsync(lookup, cache, OFF);
    assert.equal(sharedLookup.stdout, aloneLookup.stdout);
    assert.equal(sharedLookup.code, aloneLookup.code);
    assert.deepEqual(host.status().answered, { cli: 3 });
});

test('a request the lender refuses, or no lender, and the command line runs alone', async (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const host = await lend(t, cache);
    const other = gameStub(path.join(dir, 'other'), {
        'common/scripted_triggers/other.txt': 'other_trigger = { always = yes }\n',
    });
    const argv = ['check', MOD, '--vanilla', other, '--json'];
    const refused = await spawnCliAsync(argv, cache);
    const alone = await spawnCliAsync(argv, cache, OFF);
    assert.equal(split(refused).lines, split(alone).lines);
    assert.equal(split(refused).summary.game['shared'], false, 'it read its own base game');
    assert.equal(host.status().refused, 1);
    const nobody = await spawnCliAsync(
        ['check', MOD, '--vanilla', GAME, '--json'],
        path.join(dir, 'other-cache'),
    );
    assert.equal(split(nobody).summary.game['shared'], false);
    assert.equal(
        split(nobody).lines,
        split(await spawnCliAsync(['check', MOD, '--vanilla', GAME, '--json'], cache, OFF)).lines,
    );
});

test('only a command that reads the base game is sent, and an answer is printed as it came', async (t) => {
    assert.equal(readsBaseGame(['check', MOD]), true);
    assert.equal(readsBaseGame(['lookup', 'x']), true);
    assert.equal(readsBaseGame(['check', MOD, '--no-vanilla']), false);
    assert.equal(readsBaseGame(['check', '--help']), false);
    assert.equal(readsBaseGame(['explain', '*']), false);
    assert.equal(readsBaseGame(['--version']), false);
    const cache = path.join(scratch(t), 'cache');
    const asked: HostRequest[] = [];
    const answer = (reply: HostReply) => (_spec: string, request: HostRequest) => {
        asked.push(request);
        return Promise.resolve(reply);
    };
    let out = '';
    let err = '';
    const io = {
        ...{
            stdout: (s: string) => {
                out += s;
            },
            stderr: (s: string) => {
                err += s;
            },
        },
        cwd: REPO_ROOT,
        env: cacheEnv(cache),
        platform: process.platform,
        home: cache,
        specDir: defaultSpecDir(),
        findGame: () => null,
    };
    const code = await runShared(
        ['check', MOD, '--vanilla', GAME],
        io,
        answer({
            answered: true,
            answer: { code: 7, stdout: 'from the lender\n', stderr: 'note\n' },
        }),
    );
    assert.equal(code, 7);
    assert.equal(out, 'from the lender\n');
    assert.equal(err, 'note\n');
    const first = asked[0];
    assert.ok(first !== undefined);
    assert.equal(first.kind, 'cli');
    const sent = first['env'];
    assert.ok(typeof sent === 'object' && sent !== null);
    assert.deepEqual(Object.keys(sent).sort(), ['LOCALAPPDATA', 'XDG_CACHE_HOME']);
    out = '';
    const fallback = await runShared(
        ['check', MOD, '--vanilla', GAME],
        io,
        answer({ answered: false, reason: 'no program lends this base game' }),
    );
    const alone = runCli(['check', MOD, '--vanilla', GAME], { cache });
    assert.equal(fallback, alone.code);
    assert.equal(out, alone.stdout);
    asked.length = 0;
    await runShared(
        ['explain', 'names/unknown-trigger'],
        io,
        answer({ answered: false, reason: '' }),
    );
    assert.equal(asked.length, 0, 'explain is not sent');
});
