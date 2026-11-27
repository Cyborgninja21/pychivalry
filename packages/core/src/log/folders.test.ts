/**
 * Where the game writes its logs (docs/PLAN.md item 11.7), on stand-in systems: every folder is a
 * parameter, so no test reads a real Documents folder, Steam library or registry.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { appIdOfInstall, logFolders } from './folders.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-logs-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

test('Windows: the Documents folder Windows names, then Documents in the home folder and in OneDrive', () => {
    const found = logFolders(
        {
            platform: 'win32',
            home: 'C:\\Users\\someone',
            env: { USERPROFILE: 'C:\\Users\\someone', OneDrive: 'C:\\Users\\someone\\OneDrive' },
            documents: () => 'D:\\Docs',
        },
        true,
    );
    assert.deepEqual(
        found.map((f) => [f.dir, f.basis]),
        [
            ['D:\\Docs\\Paradox Interactive\\Crusader Kings III\\logs', 'seen'],
            [
                'C:\\Users\\someone\\Documents\\Paradox Interactive\\Crusader Kings III\\logs',
                'seen',
            ],
            [
                'C:\\Users\\someone\\OneDrive\\Documents\\Paradox Interactive\\Crusader Kings III\\logs',
                'convention',
            ],
        ],
    );
    assert.ok(found.every((f) => f.kind === 'windows'));
});

test('Linux: ~/.local/share, XDG_DATA_HOME first when set, and the Proton prefix of the game', (t) => {
    const root = scratch(t);
    const library = path.join(root, 'library');
    const game = path.join(library, 'steamapps', 'common', 'Crusader Kings III', 'game');
    mkdirSync(game, { recursive: true });
    writeFileSync(
        path.join(library, 'steamapps', 'appmanifest_99.acf'),
        '"AppState"\n{\n\t"appid"\t\t"99"\n\t"installdir"\t\t"Some Other Game"\n}\n',
    );
    writeFileSync(
        path.join(library, 'steamapps', 'appmanifest_42.acf'),
        '"AppState"\n{\n\t"appid"\t\t"42"\n\t"installdir"\t\t"Crusader Kings III"\n}\n',
    );
    assert.equal(appIdOfInstall(library, 'Crusader Kings III'), '42');
    assert.equal(appIdOfInstall(library, 'Nothing'), null);
    const found = logFolders(
        {
            platform: 'linux',
            home: '/home/someone',
            env: { XDG_DATA_HOME: '/data' },
            gameFolders: () => [game],
        },
        true,
    );
    const users = path.posix.join(
        library,
        'steamapps',
        'compatdata',
        '42',
        'pfx',
        'drive_c',
        'users',
        'steamuser',
    );
    assert.deepEqual(
        found.map((f) => [f.dir, f.kind, f.basis]),
        [
            ['/data/Paradox Interactive/Crusader Kings III/logs', 'linux', 'convention'],
            [
                '/home/someone/.local/share/Paradox Interactive/Crusader Kings III/logs',
                'linux',
                'plan',
            ],
            [
                `${users}/Documents/Paradox Interactive/Crusader Kings III/logs`,
                'proton',
                'convention',
            ],
            [
                `${users}/My Documents/Paradox Interactive/Crusader Kings III/logs`,
                'proton',
                'convention',
            ],
        ],
    );
});

test('only folders that exist are offered, unless every candidate is asked for', (t) => {
    const home = scratch(t);
    assert.deepEqual(logFolders({ platform: 'linux', home, env: {} }), []);
    const dir = path.join(
        home,
        '.local',
        'share',
        'Paradox Interactive',
        'Crusader Kings III',
        'logs',
    );
    mkdirSync(dir, { recursive: true });
    assert.deepEqual(
        logFolders({ platform: 'linux', home, env: {} }).map((f) => f.dir),
        [dir],
    );
});
