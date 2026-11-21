import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { gameInfo, readGameBuild, requireGameDir } from './game.js';
import {
    fileManifest,
    inChecksumScope,
    listFiles,
    manifestSha256,
    readChecksumManifest,
    renderManifest,
} from './manifest.js';
import { fixtureGame, tempDir, writeTree } from './testing.js';
import { CommandError, sha256 } from './util.js';

test('files are listed with forward slashes, sorted by their UTF-8 bytes', (t) => {
    const root = tempDir(t);
    writeTree(root, { 'b.txt': 'b', 'a/z.txt': 'zz', 'a/B.txt': '', 'é.txt': 'e' });
    assert.deepEqual(listFiles(root), [
        { path: 'a/B.txt', size: 0 },
        { path: 'a/z.txt', size: 2 },
        { path: 'b.txt', size: 1 },
        { path: 'é.txt', size: 1 },
    ]);
});

test('the text form is path, size and hash or "-", tab-separated, one line per file', (t) => {
    const root = tempDir(t);
    writeTree(root, { 'common/a.txt': 'x', 'gfx/b.dds': 'yy' });
    const entries = fileManifest(root, (rel) => rel.startsWith('common/'));
    assert.equal(renderManifest(entries), `common/a.txt\t1\t${sha256('x')}\ngfx/b.dds\t2\t-\n`);
    assert.equal(manifestSha256(entries), sha256(renderManifest(entries)));
});

test("the game's checksum manifest is read as the game writes it", () => {
    const scope = readChecksumManifest(
        '\uFEFFdirectory\nname = common\nsub_directories = yes\n\ndirectory\nname = gfx/court_scene/scene_settings\nsub_directories = yes\n\ndirectory\nname = flat\nsub_directories = no\n\nfile\nname = paths_checksummed.settings\n',
    );
    assert.deepEqual(scope, {
        directories: [
            { name: 'common', recursive: true },
            { name: 'gfx/court_scene/scene_settings', recursive: true },
            { name: 'flat', recursive: false },
        ],
        files: ['paths_checksummed.settings'],
    });
    assert.ok(inChecksumScope(scope, 'common/traits/00_traits.txt'));
    assert.ok(inChecksumScope(scope, 'gfx/court_scene/scene_settings/a.txt'));
    assert.ok(!inChecksumScope(scope, 'gfx/interface/icon.dds'));
    assert.ok(inChecksumScope(scope, 'flat/a.txt'));
    assert.ok(!inChecksumScope(scope, 'flat/deeper/a.txt'));
    assert.ok(inChecksumScope(scope, 'paths_checksummed.settings'));
    assert.ok(!inChecksumScope(scope, 'commonwealth/a.txt'));
});

test('the game info lists every file and hashes those in the checksum scope', (t) => {
    const game = fixtureGame(tempDir(t));
    const info = gameInfo(game);
    assert.equal(info.build, '1.21.0.3');
    assert.equal(info.files, 3);
    assert.equal(info.content_hashed_files, 1);
    assert.match(info.manifest_sha256, /^[0-9a-f]{64}$/);
});

test('a change to a hashed file changes the manifest hash even at the same size', (t) => {
    const game = fixtureGame(tempDir(t));
    const before = gameInfo(game).manifest_sha256;
    writeTree(game, { 'common/traits/00_traits.txt': 'brave = []\n' });
    assert.notEqual(gameInfo(game).manifest_sha256, before);
});

test('a folder that is not a game folder, or no build, is a usage error', (t) => {
    const root = tempDir(t);
    assert.throws(
        () => requireGameDir(undefined),
        (err: unknown) => err instanceof CommandError && err.exitCode === 2,
    );
    assert.throws(() => requireGameDir(root), /no common\/ folder/);
    writeTree(root, { 'game/common/a.txt': '' });
    assert.throws(
        () => readGameBuild(path.join(root, 'game')),
        /launcher-settings\.json is missing/,
    );
});
