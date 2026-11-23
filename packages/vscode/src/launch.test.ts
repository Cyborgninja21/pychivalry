import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { folderPath, pathFor, serverLaunch, stableRuntime } from './launch.js';

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
