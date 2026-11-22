/**
 * The on-disk cache (docs/PLAN.md item 3.8; MVP.md, row "Index cache"): a reloaded index
 * answers exactly as a fresh one; a changed spec, rules table, game manifest, platform or
 * format forces a rebuild; the file is written atomically; and the cache lives in the user's
 * cache folder, never in the mod. Every test points the cache at a temporary folder.
 */

import assert from 'node:assert/strict';
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import {
    CACHE_FORMAT,
    cacheFileName,
    defaultCacheDir,
    loadIndex,
    saveIndex,
    type CacheKey,
} from './cache.js';
import { openGameIndex } from './game-index.js';
import { indexMod } from './read-game.js';
import { withRule, type Rule } from './rules.js';
import { repoPath, specFolders, standInRules, stubIndex, TEST_ROW } from './testing.js';
import type { WorkspaceIndex } from './workspace.js';

let scratch = '';

before(() => {
    scratch = mkdtempSync(path.join(tmpdir(), 'pychivalry-cache-'));
});

after(() => {
    rmSync(scratch, { recursive: true, force: true });
});

const KEY: CacheKey = {
    format: CACHE_FORMAT,
    spec_sha256: 'a'.repeat(64),
    rules_sha256: 'b'.repeat(64),
    platform: 'linux',
    game_build: '1.21.0.3',
    manifest_sha256: 'c'.repeat(64),
    fallback_encoding: null,
};

const OPTIONS = { folders: specFolders(), rules: standInRules(), platform: 'linux' } as const;

/** Every answer an index gives on its own names, as one value to compare. */
function answers(index: WorkspaceIndex): unknown {
    const names = [...index.definedNamesAll(), ...index.usedNames()].sort();
    return {
        files: index.allFiles().map((f) => ({ ...f, status: index.fileStatus(f.layer, f.path) })),
        names: names.map((name) => ({
            name,
            definitions: index.definitions(name),
            resolutions: [
                ...new Set(
                    index.definitions(name).map((d) => `${d.database}\u0000${d.container ?? ''}`),
                ),
            ]
                .sort()
                .map((k) => {
                    const [database = '', container = ''] = k.split('\u0000');
                    return index.resolve(database, name, container === '' ? null : container);
                }),
            references: index.references(name),
        })),
        totals: index.totals(),
        replacePaths: index.getReplacePaths(),
    };
}

test('a reloaded index answers exactly as the fresh one, mod and all', () => {
    const fresh = stubIndex('override-rules');
    indexMod(fresh, repoPath('fixtures/mods/override-rules-replace-path'));
    const file = path.join(scratch, 'reload', cacheFileName(KEY));
    const bytes = saveIndex(fresh, file, KEY);
    assert.equal(bytes, readFileSync(file).length);
    const loaded = loadIndex(file, KEY, OPTIONS);
    assert.ok('index' in loaded);
    assert.deepEqual(answers(loaded.index), answers(fresh));
    assert.equal(loaded.index.digest(), fresh.digest());
    // The reloaded index takes updates like a fresh one.
    const update = loaded.index.setFile('mod', 'common/traits/x.txt', 'fixture_new_trait = { }\n');
    assert.equal(update.file?.definitions, 1);
});

test('a cache made from other input is not used: spec, rules, platform, build, manifest, encoding, format', () => {
    const index = stubIndex('override-rules');
    const file = path.join(scratch, 'keys', 'index.idx');
    saveIndex(index, file, KEY);
    for (const change of [
        { spec_sha256: 'd'.repeat(64) },
        { rules_sha256: 'd'.repeat(64) },
        { platform: 'windows' },
        { game_build: '1.21.0.4' },
        { manifest_sha256: 'd'.repeat(64) },
        { fallback_encoding: 'windows-1252' },
        { format: CACHE_FORMAT + 1 },
    ]) {
        assert.deepEqual(
            loadIndex(file, { ...KEY, ...change }, OPTIONS),
            { miss: 'key' },
            JSON.stringify(change),
        );
    }
    assert.ok('index' in loadIndex(file, KEY, OPTIONS));
});

test('a file of another format, not a cache, cut short or missing is not used', () => {
    const index = stubIndex('override-rules');
    const file = path.join(scratch, 'bad', 'index.idx');
    saveIndex(index, file, KEY);
    const good = readFileSync(file);
    const format = Buffer.from(good);
    format.writeUInt32LE(CACHE_FORMAT + 1, 8);
    writeFileSync(file, format);
    assert.deepEqual(loadIndex(file, KEY, OPTIONS), { miss: 'format' });
    writeFileSync(file, 'not a cache at all');
    assert.deepEqual(loadIndex(file, KEY, OPTIONS), { miss: 'not-a-cache' });
    writeFileSync(file, good.subarray(0, good.length - 8));
    assert.deepEqual(loadIndex(file, KEY, OPTIONS), { miss: 'corrupt' });
    writeFileSync(file, Buffer.concat([good, Buffer.alloc(4)]));
    assert.deepEqual(loadIndex(file, KEY, OPTIONS), { miss: 'corrupt' });
    assert.deepEqual(loadIndex(path.join(scratch, 'bad', 'absent.idx'), KEY, OPTIONS), {
        miss: 'absent',
    });
});

test('the cache is written atomically: no temporary file is left, and an old cache is replaced whole', () => {
    const dir = path.join(scratch, 'atomic');
    const file = path.join(dir, 'index.idx');
    saveIndex(stubIndex('override-rules'), file, KEY);
    const first = readFileSync(file);
    const other = stubIndex('override-rules');
    other.addFile('game', 'common/traits/extra.txt', 'fixture_extra = { }\n');
    saveIndex(other, file, KEY);
    assert.notDeepEqual(readFileSync(file), first);
    assert.deepEqual(readdirSync(dir), ['index.idx']);
    const loaded = loadIndex(file, KEY, OPTIONS);
    assert.ok('index' in loaded && loaded.index.definitions('fixture_extra').length === 1);
});

test("the default cache folder is the user's cache folder on each platform, never the mod", () => {
    assert.equal(
        defaultCacheDir(
            { LOCALAPPDATA: 'C:\\The\\Home\\AppData\\Local' },
            'win32',
            'C:\\The\\Home',
        ),
        'C:\\The\\Home\\AppData\\Local\\pychivalry\\Cache\\index',
    );
    assert.equal(
        defaultCacheDir({}, 'win32', 'C:\\The\\Home'),
        'C:\\The\\Home\\AppData\\Local\\pychivalry\\Cache\\index',
    );
    assert.equal(
        defaultCacheDir({ XDG_CACHE_HOME: '/x/cache' }, 'linux', '/the/home'),
        '/x/cache/pychivalry/index',
    );
    assert.equal(
        defaultCacheDir({ XDG_CACHE_HOME: 'relative' }, 'linux', '/the/home'),
        '/the/home/.cache/pychivalry/index',
    );
    assert.equal(defaultCacheDir({}, 'linux', '/the/home'), '/the/home/.cache/pychivalry/index');
    assert.equal(
        defaultCacheDir({}, 'darwin', '/the/home'),
        '/the/home/Library/Caches/pychivalry/index',
    );
    assert.ok(path.isAbsolute(defaultCacheDir()));
});

test('the game index is built once, then loaded from the cache; a changed game file forces a rebuild', () => {
    const game = path.join(scratch, 'install');
    cpSync(repoPath('fixtures/game/override-rules'), game, { recursive: true });
    const options = {
        gameDir: path.join(game, 'game'),
        folders: specFolders(),
        rules: standInRules(),
        platform: 'linux' as const,
        specSha256: 'e'.repeat(64),
        cacheDir: path.join(scratch, 'game-cache'),
    };
    const first = openGameIndex(options);
    assert.equal(first.fromCache, false);
    assert.equal(first.miss, 'absent');
    assert.ok((first.cacheBytes ?? 0) > 0);
    assert.ok(first.cacheFile !== null && existsSync(first.cacheFile));
    assert.ok(!first.cacheFile.startsWith(game), 'the cache is not in the game folder');
    const second = openGameIndex(options);
    assert.equal(second.fromCache, true);
    assert.deepEqual(answers(second.index), answers(first.index));

    // A patch: one script file changes size.
    const traits = path.join(game, 'game', 'common', 'traits', '00_fixture_traits.txt');
    writeFileSync(traits, `${readFileSync(traits, 'utf8')}fixture_patched = { }\n`);
    const third = openGameIndex(options);
    assert.equal(third.fromCache, false);
    assert.equal(third.miss, 'key', 'the old cache of this build is replaced');
    assert.equal(third.index.definitions('fixture_patched').length, 1);
    // Same size, new time: still a new manifest.
    const later = new Date(Date.now() + 60_000);
    utimesSync(traits, later, later);
    assert.equal(openGameIndex(options).fromCache, false);
    assert.equal(openGameIndex(options).fromCache, true);

    // A changed spec checksum or rules table forces a rebuild too.
    assert.equal(openGameIndex({ ...options, specSha256: 'f'.repeat(64) }).fromCache, false);
    const row = {
        id: 'test-row',
        overrides_rule: 9,
        title: 'test',
        kind: 'path-case',
        compare: 'exact',
        ...TEST_ROW,
    } as unknown as Rule;
    assert.equal(
        openGameIndex({ ...options, rules: withRule(standInRules(), row) }).fromCache,
        false,
    );
    // With no cache folder nothing is read or written.
    const none = openGameIndex({ ...options, cacheDir: null });
    assert.equal(none.cacheFile, null);
    assert.equal(none.fromCache, false);
});
