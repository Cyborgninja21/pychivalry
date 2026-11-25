/**
 * What the server reads and writes (docs/PLAN.md items 6.5 and 6.6): every tool, called on a
 * mod, leaves the mod folder and the game folder as they were, byte for byte and file for file;
 * the only thing it writes is the base game's index, in the cache folder, when none is there;
 * and when the cache holds an index for the installed game, it loads it and writes nothing.
 */

import assert from 'node:assert/strict';
import {
    currentPlatform,
    defaultCacheDir,
    folderTableFromSpec,
    openGameIndex,
    openSpec,
    rulesFromSpec,
    walkFiles,
} from '@pychivalry/core';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir } from './args.js';
import { cacheEnv, connect, gameStub, modCopy, scratch, type Connection } from './testing.js';

const spec = openSpec(defaultSpecDir());

/** Every file under a folder with its size, time and digest. */
function snapshot(dir: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rel of walkFiles(dir)) {
        const file = path.join(dir, rel);
        const stat = statSync(file);
        const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
        out[rel] = `${String(stat.size)} ${String(stat.mtimeMs)} ${digest}`;
    }
    return out;
}

/** Every tool, called the way an agent would. */
async function everyTool(s: Connection): Promise<void> {
    await s.output('check', { min_severity: 'hint', unused_keys: true });
    await s.output('check', { path: 'events' });
    await s.output('lookup', { names: ['fixture_scripted_trigger', 'add_trait'] });
    await s.output('find_definition', { name: 'fixture_scripted_trigger' });
    await s.output('find_definition', {
        file: 'events/fixture_lookup_mod_events.txt',
        line: 6,
        column: 3,
    });
    await s.output('find_references', { name: 'fixture_scripted_trigger' });
    await s.output('list_definitions', { kind: 'common/scripted_triggers' });
    await s.output('source', {
        layer: 'game',
        file: 'common/scripted_triggers/00_base_triggers.txt',
        line: 1,
    });
    await s.output('source', {
        layer: 'mod',
        file: 'events/fixture_lookup_mod_events.txt',
        line: 5,
    });
    await s.output('explain_code', { codes: ['*'] });
    await s.error('list_definitions', { kind: 'nothing' });
}

test('every tool leaves the mod and the game as they were; only the index cache is written', async (t) => {
    const dir = scratch(t);
    const mod = modCopy(t, 'lookup-definitions-and-uses');
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/00_base_triggers.txt':
            'fixture_scripted_trigger = { always = yes }\n',
    });
    const cache = path.join(dir, 'cache');
    const modBefore = snapshot(mod);
    const gameBefore = snapshot(path.join(dir, 'install'));
    const s = await connect(t, ['--mod', mod, '--vanilla', game], cache);
    await everyTool(s);
    assert.deepEqual(snapshot(mod), modBefore, 'the mod is unchanged');
    assert.deepEqual(snapshot(path.join(dir, 'install')), gameBefore, 'the game is unchanged');
    const written = Object.keys(snapshot(cache));
    assert.equal(written.length, 1, `one file in the cache: ${written.join(', ')}`);
    assert.match(
        written[0] ?? '',
        /^pychivalry\/(Cache\/)?index\/base-game-1\.21\.0\.3-[a-z]+-[0-9a-f]{16}\.idx$/,
    );
});

test('with an index for the installed game in the cache, the server loads it and writes nothing', async (t) => {
    const dir = scratch(t);
    const mod = modCopy(t, 'lookup-definitions-and-uses');
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/00_base_triggers.txt':
            'fixture_scripted_trigger = { always = yes }\n',
    });
    const cache = path.join(dir, 'cache');
    // The index a command-line check would have saved: the core's own, in the user's cache
    // folder as the server's environment names it.
    const built = openGameIndex({
        gameDir: game,
        folders: folderTableFromSpec(spec.data),
        rules: rulesFromSpec(spec),
        platform: currentPlatform(),
        specSha256: spec.sha256,
        cacheDir: defaultCacheDir(cacheEnv(cache), process.platform, cache),
    });
    assert.equal(built.fromCache, false);
    const cacheBefore = snapshot(cache);
    assert.equal(Object.keys(cacheBefore).length, 1);
    const s = await connect(t, ['--mod', mod, '--vanilla', game], cache);
    const out = await s.output('check', {});
    assert.deepEqual(out['game'], { build: '1.21.0.3', from_cache: true });
    await everyTool(s);
    assert.deepEqual(snapshot(cache), cacheBefore, 'the cache is read, not written');
});
