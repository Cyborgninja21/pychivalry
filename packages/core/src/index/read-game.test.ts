/**
 * Reading the game and a mod from the local disk (docs/PLAN.md items 3.5 and 3.6a): the
 * install's three folders, the DLC packs as the rules table's `pack-layer` row places them,
 * what is read and what is only counted, a mod's descriptor, and the manifest the cache is
 * keyed by.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
    descriptorValues,
    installFolders,
    listInstall,
    listMod,
    readGameBuild,
    sourceManifestSha256,
    walkFiles,
} from './read-game.js';
import { rulesFor } from './rules.js';
import { repoPath, specFolders, standInRules } from './testing.js';

const STUB = repoPath('fixtures/game/override-rules');

test('the install is the game folder and, beside it, jomini/ and clausewitz/', () => {
    const folders = installFolders(path.join(STUB, 'game'));
    assert.deepEqual(
        folders.map((f) => [f.layer, f.dir]),
        [
            ['clausewitz', path.join(STUB, 'clausewitz')],
            ['jomini', path.join(STUB, 'jomini')],
            ['game', path.join(STUB, 'game')],
        ],
    );
    const scratch = mkdtempSync(path.join(tmpdir(), 'pychivalry-install-'));
    try {
        mkdirSync(path.join(scratch, 'game', 'common'), { recursive: true });
        assert.deepEqual(
            installFolders(path.join(scratch, 'game')).map((f) => f.layer),
            ['game'],
        );
        assert.equal(readGameBuild(path.join(scratch, 'game')), null);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
    assert.equal(readGameBuild(path.join(STUB, 'game')), '1.21.0.3');
});

test("with the pack-layer row, a DLC's files sit at their path inside the pack", () => {
    const listing = listInstall(
        installFolders(path.join(STUB, 'game')),
        specFolders(),
        rulesFor(standInRules(), 'linux'),
    );
    assert.deepEqual(listing.packs, [{ layer: 'dlc:dlc_fixture', folder: 'dlc/dlc_fixture' }]);
    const dlc = listing.files.filter((f) => f.layer.startsWith('dlc:')).map((f) => f.path);
    assert.deepEqual(dlc, [
        'music/fixture_dlc_music.txt',
        'music/music_player_categories/fixture_dlc_categories.txt',
    ]);
    for (const file of listing.files) {
        assert.ok(!file.path.includes('\\'), file.path);
        assert.ok(path.isAbsolute(file.disk), file.disk);
    }
    // The pack's descriptor is not a file of the pack; the checksum manifest is counted, not read.
    assert.equal(listing.notRead.get('.dlc'), undefined, 'the pack descriptor is the pack');
    assert.equal(listing.notDescribed.get('(top level)'), 1, 'checksum_manifest.txt');
});

test('without the pack-layer row, a DLC is a folder of game/ that no spec folder describes', () => {
    const listing = listInstall(installFolders(path.join(STUB, 'game')), specFolders(), []);
    assert.deepEqual(listing.packs, []);
    assert.equal(listing.files.filter((f) => f.path.startsWith('dlc/')).length, 0);
    assert.equal(listing.notDescribed.get('dlc'), 2);
    assert.equal(listing.notRead.get('.dlc'), 1);
});

test("a mod's descriptor is read for replace_path; every other file by its path", () => {
    const listing = listMod(repoPath('fixtures/mods/override-rules-replace-path'), specFolders());
    assert.deepEqual(listing.replacePaths, ['common/decisions']);
    assert.equal(listing.descriptor, true);
    assert.deepEqual(
        listing.files.map((f) => `${f.layer}:${f.path}`),
        ['mod:common/decisions/fixture_mod_decisions.txt'],
    );
    assert.deepEqual(descriptorValues('a = "1"\nb = 2\na = "3"\nc = { }\n', 'a'), ['1', '3']);
});

test('files are walked in a fixed order, and links are not followed', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'pychivalry-walk-'));
    try {
        mkdirSync(path.join(scratch, 'b'), { recursive: true });
        writeFileSync(path.join(scratch, 'b', 'z.txt'), '');
        writeFileSync(path.join(scratch, 'a.txt'), '');
        assert.deepEqual(walkFiles(scratch), ['a.txt', 'b/z.txt']);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test("the manifest of the files read changes with a file's size or time, not with the order listed", () => {
    const file = { layer: 'game', path: 'common/x.txt', disk: '/x', size: 10, mtimeMs: 1000 };
    const other = { ...file, path: 'common/y.txt' };
    const base = sourceManifestSha256([file, other]);
    assert.equal(sourceManifestSha256([other, file]), base);
    assert.notEqual(sourceManifestSha256([{ ...file, size: 11 }, other]), base);
    assert.notEqual(sourceManifestSha256([{ ...file, mtimeMs: 2000 }, other]), base);
    assert.equal(
        sourceManifestSha256([{ ...file, mtimeMs: 1000.4 }, other]),
        base,
        'whole milliseconds',
    );
});
