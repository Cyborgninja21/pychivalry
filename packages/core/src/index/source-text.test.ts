/**
 * The text of an indexed file by its place (`source-text.ts`): a path checked before anything is
 * looked up, found only in the listings the index was built from, read as the index reads it
 * (decoded with its fallback encoding, split where its positions split lines), never through a
 * link or outside its layer's folder.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { listMod } from './read-game.js';
import {
    checkGivenPath,
    findListedFile,
    readListedFile,
    rootOf,
    SourceRefused,
} from './source-text.js';
import { packageRules, specFolders } from './testing.js';
import { WorkspaceIndex } from './workspace.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-source-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

const folders = specFolders();

function index(fallback?: 'windows-1252'): WorkspaceIndex {
    return new WorkspaceIndex({
        folders,
        rules: packageRules(),
        platform: undefined,
        fallbackEncoding: fallback,
    });
}

test('a given path is a relative path with /, no empty, . or .. part', () => {
    assert.equal(checkGivenPath('common/x.txt'), 'common/x.txt');
    for (const [given, why] of [
        ['', /empty/],
        ['/etc/x', /absolute/],
        ['C:/x.txt', /absolute/],
        ['c:x.txt', /absolute/],
        ['common\\x.txt', /written with \\/],
        ['../x.txt', /no empty, \. or \.\./],
        ['common/./x.txt', /no empty, \. or \.\./],
        ['common//x.txt', /no empty, \. or \.\./],
        ['common/x.txt/', /no empty, \. or \.\./],
        ['a\u0000b', /NUL/],
    ] as const) {
        assert.throws(
            () => checkGivenPath(given),
            (err) => err instanceof SourceRefused && why.test(err.message),
            given,
        );
    }
});

test('a listed file is found by its layer and path, read and split as the index reads it', (t) => {
    const mod = scratch(t);
    const dir = path.join(mod, 'common', 'scripted_effects');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'a.txt'), Buffer.from('\ufeffone\r\ntwo\rthree\nfour', 'utf8'));
    writeFileSync(path.join(dir, 'b.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]));
    const listing = listMod(mod, folders);
    const found = findListedFile([listing], 'mod', 'common/scripted_effects/a.txt');
    assert.equal(rootOf(found.file), mod);
    const text = readListedFile(index(), found);
    assert.deepEqual(text.lines, ['one', 'two', 'three', 'four']);
    assert.equal(text.bom, true);
    const latin = readListedFile(
        index(),
        findListedFile([listing], 'mod', 'common/scripted_effects/b.txt'),
    );
    assert.deepEqual(latin.lines, ['caf\ufffd', '']);
    assert.equal(latin.validUtf8, false);
    const fallback = readListedFile(
        index('windows-1252'),
        findListedFile([listing], 'mod', 'common/scripted_effects/b.txt'),
    );
    assert.deepEqual(fallback.lines, ['café', ''], 'the fallback the index was given');
    assert.throws(
        () => findListedFile([listing], 'mod', 'common/scripted_effects/A.txt'),
        /has no file common\/scripted_effects\/A\.txt; it has common\/scripted_effects\/a\.txt/,
    );
    assert.throws(
        () => findListedFile([listing], 'game', 'common/x.txt'),
        /no file of the layer game is read/,
    );
});

test(
    'never through a link, never outside the layer',
    { skip: process.platform === 'win32' ? 'links need a privilege on Windows' : false },
    (t) => {
        const root = scratch(t);
        const mod = path.join(root, 'mod');
        const dir = path.join(mod, 'common', 'scripted_effects');
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(root, 'outside.txt'), 'leak\n');
        symlinkSync(path.join(root, 'outside.txt'), path.join(dir, 'linked.txt'));
        writeFileSync(path.join(dir, 'real.txt'), 'real\n');
        const listing = listMod(mod, folders);
        assert.deepEqual(
            listing.files.map((f) => f.path),
            ['common/scripted_effects/real.txt'],
            'a link is never listed',
        );
        const found = findListedFile([listing], 'mod', 'common/scripted_effects/real.txt');
        rmSync(path.join(dir, 'real.txt'));
        symlinkSync(path.join(root, 'outside.txt'), path.join(dir, 'real.txt'));
        assert.throws(() => readListedFile(index(), found), /is a link; source reads no link/);
    },
);
