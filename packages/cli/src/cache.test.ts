/**
 * The command uses the on-disk index of the base game (docs/PLAN.md item 5.7): the first run
 * builds it and saves it in the cache folder, the second, a fresh process, loads it instead of
 * reading the game again. The cache folder is a temporary one, and the game a stand-in.
 *
 * What proves the second run did not read the game is the work it did, not how long it took
 * (a comparison of times failed once on a loaded machine): it reports that it loaded the cache
 * and built nothing; the cache file is not written again; and between the runs a game file is
 * changed in a way the listing cannot see (same size, same time) so that the mod's findings
 * would differ had the game been read again. A run on a fresh cache folder shows they would.
 */

import assert from 'node:assert/strict';
import { defaultCacheDir } from '@pychivalry/core';
import { cpSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { cacheEnv, gameStub, REPO_ROOT, scratch, spawnCli, write, type Result } from './testing.js';

const FIXTURE = path.join(REPO_ROOT, 'fixtures', 'mods', 'names-unknown-trigger-bad');
const FILES = 20;
const RECORDS = 40;
const LINES = 20;

/** A stand-in game's script files: 20 files of scripted triggers, 40 to a file. */
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
    readonly findings: string;
    readonly game: { from_cache: boolean; ms: Record<'list' | 'build' | 'save' | 'load', number> };
}

function runCheck(argv: readonly string[], cache: string): Run {
    const result = spawnCli(argv, cache);
    const lines = result.stdout.trimEnd().split('\n');
    const last = lines.pop() ?? '{}';
    const summary = (JSON.parse(last) as { summary: { game: Run['game'] } }).summary;
    return { result, findings: lines.join('\n'), game: summary.game };
}

test('a second run loads the base game from the cache and does not read the game again', (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const game = gameStub(path.join(dir, 'install'), generatedGame());
    // The fixture mod, and a trigger of its own that calls one the game defines.
    const mod = path.join(dir, 'mod');
    cpSync(FIXTURE, mod, { recursive: true });
    write(
        path.join(mod, 'common', 'scripted_triggers', 'uses_the_game.txt'),
        'uses_the_game = { stand_in_trigger_0_0 = yes }\n',
    );
    // The game file changed below gets a whole second as its time, so that setting it back
    // after the change gives exactly the time the first run listed (a time in milliseconds
    // goes through a float on its way to the file system and can come back a hair earlier).
    const changed = path.join(game, 'common', 'scripted_triggers', 'stand_in_0.txt');
    const time = 1_700_000_000;
    utimesSync(changed, time, time);
    const argv = ['check', mod, '--vanilla', game, '--json'];
    const first = runCheck(argv, cache);
    assert.equal(first.result.code, 1, first.result.stderr);
    assert.equal(first.game.from_cache, false, 'the first run reads the game');
    assert.ok(first.game.ms.build > 0);
    assert.doesNotMatch(first.findings, /stand_in_trigger_0_0/, 'the game defines the trigger');
    const cacheDir = defaultCacheDir(cacheEnv(cache), process.platform, cache);
    const files = readdirSync(cacheDir);
    assert.equal(files.length, 1, 'one cache file, in the cache folder');
    const cacheFile = path.join(cacheDir, files[0] ?? '');
    const saved = statSync(cacheFile);

    // The game's file changed where the listing cannot see it: same size, same time.
    const before = statSync(changed);
    const text = readFileSync(changed, 'utf8');
    writeFileSync(changed, text.replaceAll('stand_in_trigger_0_', 'stand_in_triggeR_0_'));
    utimesSync(changed, time, time);
    assert.equal(statSync(changed).size, before.size);
    assert.equal(statSync(changed).mtimeMs, before.mtimeMs);

    const second = runCheck(argv, cache);
    assert.equal(second.result.code, 1, second.result.stderr);
    assert.equal(second.game.from_cache, true, 'the second run loads the cache');
    assert.equal(second.game.ms.build, 0, 'and builds nothing');
    assert.equal(second.game.ms.save, 0, 'and saves nothing');
    const after = statSync(cacheFile);
    assert.equal(after.mtimeMs, saved.mtimeMs, 'the cache file is not written again');
    assert.equal(after.size, saved.size);
    assert.equal(second.findings, first.findings, 'the same findings: the game was not read');

    // Read again, the changed game would have given another answer.
    const fresh = runCheck(argv, path.join(dir, 'fresh-cache'));
    assert.equal(fresh.game.from_cache, false);
    assert.match(fresh.findings, /stand_in_trigger_0_0/, 'read again, the trigger is unknown');
});
