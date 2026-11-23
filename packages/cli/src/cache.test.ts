/**
 * The command uses the on-disk index of the base game (docs/PLAN.md item 5.7): the first run
 * builds it and saves it in the cache folder, the second, a fresh process, loads it instead of
 * reading the game again, and is faster by about the time the first spent reading it. The
 * cache folder is a temporary one, and the game a stand-in, generated large enough that
 * reading it takes far longer than loading its cache.
 */

import assert from 'node:assert/strict';
import { defaultCacheDir } from '@pychivalry/core';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { cacheEnv, gameStub, REPO_ROOT, scratch, spawnCli, type Result } from './testing.js';

const MOD = path.join(REPO_ROOT, 'fixtures', 'mods', 'names-unknown-trigger-bad');
const FILES = 200;
const RECORDS = 40;
const LINES = 20;

/**
 * A stand-in game's script files: 200 files of scripted triggers, 40 to a file, each of 20
 * lines, about 9 MB in all: reading them takes far longer than loading their index.
 */
function generatedGame(): Record<string, string> {
    const body = '\tOR = { is_adult = yes age >= 16 has_trait = brave }';
    const files: Record<string, string> = {};
    for (let i = 0; i < FILES; i++) {
        const lines: string[] = [];
        for (let j = 0; j < RECORDS; j++) {
            lines.push(`stand_in_trigger_${String(i)}_${String(j)} = {`);
            for (let k = 0; k < LINES; k++) {
                lines.push(body);
            }
            lines.push('}');
        }
        files[`common/scripted_triggers/stand_in_${String(i)}.txt`] = `${lines.join('\n')}\n`;
    }
    return files;
}

interface Run {
    readonly result: Result;
    readonly ms: number;
    readonly game: { from_cache: boolean; ms: Record<'list' | 'build' | 'save' | 'load', number> };
}

function timed(argv: readonly string[], cache: string): Run {
    const started = performance.now();
    const result = spawnCli(argv, cache);
    const ms = performance.now() - started;
    const last = result.stdout.trimEnd().split('\n').pop() ?? '{}';
    const summary = (JSON.parse(last) as { summary: { game: Run['game'] } }).summary;
    return { result, ms, game: summary.game };
}

test('a second run loads the base game from the cache and is faster by the time it took to read it', (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const game = gameStub(path.join(dir, 'install'), generatedGame());
    const argv = ['check', MOD, '--vanilla', game, '--json'];
    const first = timed(argv, cache);
    const second = timed(argv, cache);
    assert.equal(first.result.code, 1, first.result.stderr);
    assert.equal(second.result.code, 1, second.result.stderr);
    assert.equal(first.game.from_cache, false, 'the first run reads the game');
    assert.ok(first.game.ms.build > 0);
    assert.equal(
        readdirSync(defaultCacheDir(cacheEnv(cache), process.platform, cache)).length,
        1,
        'one cache file, in the cache folder',
    );
    assert.equal(second.game.from_cache, true, 'the second run loads it');
    assert.equal(second.game.ms.build, 0, 'and does not read the game again');
    assert.equal(
        second.result.stdout.split('\n').slice(0, -2).join('\n'),
        first.result.stdout.split('\n').slice(0, -2).join('\n'),
        'the same findings',
    );
    const saved = first.game.ms.build + first.game.ms.save - second.game.ms.load;
    assert.ok(
        second.game.ms.load < first.game.ms.build / 4,
        `loading the cache (${String(second.game.ms.load)} ms) takes far less than reading the game (${String(first.game.ms.build)} ms)`,
    );
    assert.ok(
        first.ms - second.ms > saved / 2,
        `the second run is faster by ${String(Math.round(first.ms - second.ms))} ms; reading the game and saving it took ${String(saved)} ms more than loading it`,
    );
});
