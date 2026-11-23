/**
 * Finding the game in any Steam library (find-game.ts): Steam's list of libraries in both of
 * its forms, the install folders per system, and a game recognised by its launcher's settings
 * in a library other than Steam's own. Every Steam here is built in a temporary folder.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
    findGameFolders,
    gameFolderOfInstall,
    isGameFolder,
    readLibraryFolders,
    steamLibraries,
    steamRoots,
} from './find-game.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-steam-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

function write(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** A game install under a library: its launcher settings and a game folder with `common/`. */
function install(library: string, folder: string, gameId: string, dlcPath = '../game'): string {
    const dir = path.join(library, 'steamapps', 'common', folder);
    write(
        path.join(dir, 'launcher', 'launcher-settings.json'),
        `${JSON.stringify({ gameId, rawVersion: '1.21.0.3', dlcPath })}\n`,
    );
    mkdirSync(path.join(dir, 'game', 'common'), { recursive: true });
    return path.join(dir, 'game');
}

/** The library list in today's form, each path escaped as Steam writes it. */
function libraryList(paths: readonly string[]): string {
    const entries = paths.map(
        (p, i) =>
            `\t"${String(i)}"\n\t{\n\t\t"path"\t\t"${p.replaceAll('\\', '\\\\')}"\n\t\t"label"\t\t""\n\t\t"apps"\n\t\t{\n\t\t\t"1158310"\t\t"1"\n\t\t}\n\t}\n`,
    );
    return `"libraryfolders"\n{\n${entries.join('')}}\n`;
}

test("Steam's library list is read in today's form and in the older one", () => {
    assert.deepEqual(readLibraryFolders(libraryList(['/a/Steam', 'D:\\SteamLibrary'])), [
        '/a/Steam',
        'D:\\SteamLibrary',
    ]);
    const older = [
        '"LibraryFolders"',
        '{',
        '\t// written by an older Steam',
        '\t"TimeNextStatsReport"\t\t"1700000000"',
        '\t"ContentStatsID"\t\t"-123"',
        '\t"1"\t\t"E:\\\\Games\\\\Steam"',
        '}',
    ].join('\n');
    assert.deepEqual(readLibraryFolders(older), ['E:\\Games\\Steam']);
    assert.deepEqual(readLibraryFolders(''), []);
    assert.deepEqual(readLibraryFolders('"libraryfolders" { "0" { "label" "" } }'), []);
});

test('Linux: Steam is looked for in its own folders, each found once', (t) => {
    const home = scratch(t);
    const root = path.join(home, '.local', 'share', 'Steam');
    mkdirSync(root, { recursive: true });
    mkdirSync(path.join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam'), {
        recursive: true,
    });
    const roots = steamRoots({ platform: 'linux', home, env: {} });
    assert.deepEqual(roots, [
        root,
        path.join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam'),
    ]);
    const data = path.join(home, 'data');
    mkdirSync(path.join(data, 'Steam'), { recursive: true });
    assert.deepEqual(steamRoots({ platform: 'linux', home, env: { XDG_DATA_HOME: data } }), [
        path.join(data, 'Steam'),
        path.join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam'),
    ]);
});

test('Windows: Steam is looked for where the registry and the program folders say', (t) => {
    const dir = scratch(t);
    const fromRegistry = path.join(dir, 'Games', 'Steam');
    const programs = path.join(dir, 'Program Files (x86)');
    mkdirSync(fromRegistry, { recursive: true });
    mkdirSync(path.join(programs, 'Steam'), { recursive: true });
    const roots = steamRoots({
        platform: 'win32',
        home: dir,
        env: { 'ProgramFiles(x86)': programs, ProgramFiles: path.join(dir, 'Program Files') },
        registry: () => [fromRegistry, path.join(dir, 'gone')],
    });
    assert.deepEqual(roots, [fromRegistry, path.join(programs, 'Steam')]);
});

test("the game is found in a library other than Steam's own, by its launcher, not its folder name", (t) => {
    const home = scratch(t);
    const root = path.join(home, '.local', 'share', 'Steam');
    const library = path.join(home, 'disk', 'SteamLibrary');
    mkdirSync(path.join(root, 'steamapps'), { recursive: true });
    write(path.join(root, 'steamapps', 'libraryfolders.vdf'), libraryList([root, library]));
    install(library, 'Some Other Game', 'other');
    const game = install(library, 'A Folder Named Anything', 'ck3');
    const search = { platform: 'linux' as const, home, env: {} };
    assert.deepEqual(steamLibraries(search), [root, library]);
    assert.deepEqual(findGameFolders('ck3', search), [game]);
    assert.deepEqual(findGameFolders('hoi4', search), []);
    assert.ok(isGameFolder(game));
});

test('an install is a game only when its launcher names the game and its game folder has common/', (t) => {
    const library = scratch(t);
    const game = install(library, 'CK3', 'ck3');
    assert.equal(gameFolderOfInstall(path.dirname(game), 'ck3'), game);
    assert.equal(gameFolderOfInstall(path.dirname(game), 'eu5'), null);
    const elsewhere = install(library, 'Moved', 'ck3', '../data');
    assert.equal(gameFolderOfInstall(path.dirname(elsewhere), 'ck3'), null);
    write(path.join(library, 'Broken', 'launcher', 'launcher-settings.json'), '{ not json');
    assert.equal(gameFolderOfInstall(path.join(library, 'Broken'), 'ck3'), null);
    assert.equal(gameFolderOfInstall(path.join(library, 'Missing'), 'ck3'), null);
});

test('no Steam: no library and no game', (t) => {
    const home = scratch(t);
    const search = { platform: 'linux' as const, home, env: {} };
    assert.deepEqual(steamRoots(search), []);
    assert.deepEqual(steamLibraries(search), []);
    assert.deepEqual(findGameFolders('ck3', search), []);
});
