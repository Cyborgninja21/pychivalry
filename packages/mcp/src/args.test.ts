/**
 * The server's own arguments (args.ts): the mod, the game and the spec it works on, and the
 * server refusing to start, with exit code 2, on arguments it cannot use.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir, sessionOptions, type Surroundings, UsageError } from './args.js';
import { cacheEnv, gameStub, MAIN, MODS, scratch } from './testing.js';

function surroundings(cwd: string, cache: string, found: string | null = null): Surroundings {
    return {
        cwd,
        env: cacheEnv(cache),
        platform: process.platform,
        home: cache,
        specDir: defaultSpecDir(),
        findGame: () => found,
    };
}

test('the mod is the folder the server starts in unless --mod names one', (t) => {
    const dir = scratch(t);
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const here = sessionOptions(['--no-vanilla'], surroundings(mod, dir));
    assert.equal(here.modDir, mod);
    assert.deepEqual(here.game, { dir: null, source: null, notFound: false });
    const named = sessionOptions(
        ['--mod', 'names-unknown-trigger-bad', '--no-vanilla'],
        surroundings(MODS, dir),
    );
    assert.equal(named.modDir, mod);
    assert.equal(named.cacheDir?.startsWith(dir), true, 'the cache folder of the environment');
});

test('the game: --vanilla, found in a Steam library, or not found', (t) => {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'));
    const given = sessionOptions(['--vanilla', game], surroundings(dir, dir));
    assert.deepEqual(given.game, { dir: game, source: 'vanilla', notFound: false });
    const found = sessionOptions([], surroundings(dir, dir, game));
    assert.deepEqual(found.game, { dir: game, source: 'steam', notFound: false });
    const missing = sessionOptions([], surroundings(dir, dir, null));
    assert.deepEqual(missing.game, { dir: null, source: null, notFound: true });
});

test('arguments the server cannot use', (t) => {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'));
    const cases: [string[], RegExp][] = [
        [['--mod', path.join(dir, 'nowhere'), '--no-vanilla'], /--mod: not a folder/],
        [['--vanilla', dir], /--vanilla: .* is not a game folder/],
        [['--vanilla', game, '--no-vanilla'], /cannot both be given/],
        [['--mod'], /--mod needs a value/],
        [['--no-vanilla', '--no-vanilla'], /--no-vanilla is given twice/],
        [['--verbose'], /unknown argument: --verbose/],
        [['--spec', path.join(dir, 'nothing.json.gz'), '--no-vanilla'], /--spec: no such file/],
    ];
    for (const [argv, expected] of cases) {
        assert.throws(
            () => sessionOptions(argv, surroundings(dir, dir)),
            (err: unknown) => {
                assert.ok(err instanceof UsageError);
                assert.match(err.message, expected);
                return true;
            },
        );
    }
});

test('the server does not start on bad arguments: the reason on standard error, exit code 2', (t) => {
    const dir = scratch(t);
    const r = spawnSync(
        process.execPath,
        [MAIN, '--mod', path.join(dir, 'nowhere'), '--no-vanilla'],
        {
            encoding: 'utf8',
            env: cacheEnv(dir),
        },
    );
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '', 'nothing on the protocol channel');
    assert.match(r.stderr, /^pychivalry-mcp: --mod: not a folder: .*\nusage: pychivalry-mcp /);
});

test("the log folders: --logs first, then the game's log folders found, none with --no-log-folders", (t) => {
    const dir = scratch(t);
    const mod = path.join(MODS, 'names-unknown-trigger-bad');
    const found = path.join(dir, 'found');
    mkdirSync(found);
    const where = { ...surroundings(mod, dir), findLogFolders: () => [found] };
    assert.deepEqual(sessionOptions(['--no-vanilla'], where).logDirs, [found]);
    assert.deepEqual(sessionOptions(['--no-vanilla', '--logs', dir], where).logDirs, [dir, found]);
    assert.deepEqual(sessionOptions(['--no-vanilla', '--no-log-folders'], where).logDirs, []);
    // A test's surroundings look for none.
    assert.deepEqual(sessionOptions(['--no-vanilla'], surroundings(mod, dir)).logDirs, []);
    assert.throws(
        () => sessionOptions(['--no-vanilla', '--logs', path.join(dir, 'nothing')], where),
        /--logs: not a folder/,
    );
});
