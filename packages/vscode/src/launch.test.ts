import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { folderPath, gameFromSetting, pathFor, serverLaunch, stableRuntime } from './launch.js';

test('the command line names the server file, the mod and the spec, and runs VS Code as Node', () => {
    assert.deepEqual(
        serverLaunch(
            '/usr/share/code/code',
            '/home/u/.config/Code/User/globalStorage/cyborgninja21.pychivalry/agent-server',
            '/home/u/mods/my mod',
            path.posix,
        ),
        {
            command: '/usr/share/code/code',
            args: [
                '/home/u/.config/Code/User/globalStorage/cyborgninja21.pychivalry/agent-server/pychivalry-mcp.mjs',
                '--mod',
                '/home/u/mods/my mod',
                '--spec',
                '/home/u/.config/Code/User/globalStorage/cyborgninja21.pychivalry/agent-server/spec',
            ],
            env: { ELECTRON_RUN_AS_NODE: '1' },
        },
    );
});

test('on Windows the paths are joined with backslashes and kept whole, spaces and all', () => {
    const launch = serverLaunch(
        'C:\\Users\\A B\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
        'C:\\Users\\A B\\AppData\\Roaming\\Code\\User\\globalStorage\\cyborgninja21.pychivalry\\agent-server',
        'D:\\Mods & More (100%)\\my mod',
        pathFor('win32'),
    );
    assert.equal(
        launch.command,
        'C:\\Users\\A B\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    );
    assert.deepEqual(launch.args, [
        'C:\\Users\\A B\\AppData\\Roaming\\Code\\User\\globalStorage\\cyborgninja21.pychivalry\\agent-server\\pychivalry-mcp.mjs',
        '--mod',
        'D:\\Mods & More (100%)\\my mod',
        '--spec',
        'C:\\Users\\A B\\AppData\\Roaming\\Code\\User\\globalStorage\\cyborgninja21.pychivalry\\agent-server\\spec',
    ]);
    assert.deepEqual(launch.env, { ELECTRON_RUN_AS_NODE: '1' });
});

test('the game folder the setting names is passed as --vanilla; without it the server searches Steam', () => {
    const launch = serverLaunch(
        'C:\\VS Code\\Code.exe',
        'C:\\storage\\agent-server',
        'D:\\mods\\m',
        pathFor('win32'),
        'E:\\SteamLibrary\\steamapps\\common\\Crusader Kings III\\game',
    );
    assert.deepEqual(launch.args.slice(-2), [
        '--vanilla',
        'E:\\SteamLibrary\\steamapps\\common\\Crusader Kings III\\game',
    ]);
    assert.ok(!serverLaunch('/c', '/s', '/m', path.posix).args.includes('--vanilla'));
    assert.throws(() => serverLaunch('/c', '/s', '/m', path.posix, 'game'), /game folder/);
});

test('the setting gives a game folder only when it is an absolute path', () => {
    assert.equal(gameFromSetting('  /games/ck3/game  ', path.posix), '/games/ck3/game');
    assert.equal(gameFromSetting('D:\\ck3\\game', pathFor('win32')), 'D:\\ck3\\game');
    for (const value of ['', '   ', 'ck3/game', undefined, null, 3, { dir: '/x' }]) {
        assert.equal(gameFromSetting(value, path.posix), null, JSON.stringify(value));
    }
});

test('a relative path is refused: an entry must work from any folder', () => {
    assert.throws(
        () => serverLaunch('code', '/s', '/m', path.posix),
        /runtime must be an absolute/,
    );
    assert.throws(() => serverLaunch('/c', 's', '/m', path.posix), /server folder/);
    assert.throws(
        () => serverLaunch('C:\\c.exe', 'C:\\s', 'mods\\m', pathFor('win32')),
        /mod folder/,
    );
});

test("a snap's VS Code is written in its current form, which survives a snap refresh", () => {
    const exists = (f: string): boolean => f === '/snap/code/current/usr/share/code/code';
    assert.equal(
        stableRuntime('/snap/code/211/usr/share/code/code', exists),
        '/snap/code/current/usr/share/code/code',
    );
    assert.equal(
        stableRuntime('/snap/code/x3/usr/share/code/code', exists),
        '/snap/code/current/usr/share/code/code',
    );
    // No current link: the path as given.
    assert.equal(
        stableRuntime('/snap/code/211/usr/share/code/code', () => false),
        '/snap/code/211/usr/share/code/code',
    );
    // Every other install keeps one path across updates.
    for (const p of [
        '/usr/share/code/code',
        'C:\\Program Files\\Microsoft VS Code\\Code.exe',
        '/opt/snap/code/1/x',
    ]) {
        assert.equal(
            stableRuntime(p, () => true),
            p,
        );
    }
});

test("on Windows a folder's drive letter is written in upper case, as a terminal there names it", () => {
    assert.equal(folderPath('c:\\Mods\\my mod', 'win32'), 'C:\\Mods\\my mod');
    assert.equal(folderPath('C:\\Mods', 'win32'), 'C:\\Mods');
    assert.equal(folderPath('\\\\server\\share\\mod', 'win32'), '\\\\server\\share\\mod');
    assert.equal(folderPath('/c:/odd', 'linux'), '/c:/odd');
    assert.equal(folderPath('c:/x', 'linux'), 'c:/x');
});
