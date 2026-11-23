/**
 * Files on Windows and elsewhere (docs/MVP.md, "Lessons from 2.3.0"): file addresses built with
 * the platform's own function, and a file of the mod found without regard to letter case where
 * the platform ignores it. The Windows cases run on every system, by the flavour each function
 * takes; the last test speaks to the server on Windows itself.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { knownPath, pathInside, pathOnDisk, pathToUri, uriToPath } from './paths.js';
import { gameStub, modCopy, scratch, spawnServer, uriOf } from './testing.js';

const WINDOWS = { windows: true };
const POSIX = { windows: false };

test('a Windows file URI as the editor writes it is a Windows path', () => {
    // VS Code writes the drive letter in lower case and its colon escaped.
    assert.equal(
        uriToPath('file:///c%3A/Work/My%20Mod/events/a.txt', WINDOWS),
        'c:\\Work\\My Mod\\events\\a.txt',
    );
    assert.equal(uriToPath('file:///C:/Work/mod/a.txt', WINDOWS), 'C:\\Work\\mod\\a.txt');
    assert.equal(
        uriToPath('file://server/share/mod/a.txt', WINDOWS),
        '\\\\server\\share\\mod\\a.txt',
    );
    assert.equal(uriToPath('untitled:Untitled-1', WINDOWS), null);
    assert.equal(uriToPath('file:///work/mod/a%23b.txt', POSIX), '/work/mod/a#b.txt');
});

test('a path becomes a URI with the platform function, and back', () => {
    const windows = 'C:\\Work\\My Mod\\events\\a#1.txt';
    assert.equal(pathToUri(windows, WINDOWS), 'file:///C:/Work/My%20Mod/events/a%231.txt');
    assert.equal(uriToPath(pathToUri(windows, WINDOWS), WINDOWS), windows);
    assert.equal(pathToUri('/work/my mod/a.txt', POSIX), 'file:///work/my%20mod/a.txt');
});

test('a file inside the mod, found without regard to case on Windows only', () => {
    assert.equal(
        pathInside('C:\\Work\\Mod', 'c:\\work\\mod\\Events\\A.txt', WINDOWS),
        'Events/A.txt',
    );
    assert.equal(pathInside('C:\\Work\\Mod', 'D:\\Work\\Mod\\a.txt', WINDOWS), null);
    assert.equal(pathInside('C:\\Work\\Mod', 'C:\\Work\\Mod2\\a.txt', WINDOWS), null);
    assert.equal(pathInside('C:\\Work\\Mod', 'C:\\Work\\Mod', WINDOWS), null);
    assert.equal(pathInside('/work/mod', '/work/mod/events/a.txt', POSIX), 'events/a.txt');
    assert.equal(pathInside('/work/mod', '/work/Mod/events/a.txt', POSIX), null);
    assert.equal(pathInside('/work/mod', '/work/mod-old/a.txt', POSIX), null);
    // The mod's own spelling of a path the editor wrote in another case.
    assert.equal(knownPath('Events/A.txt', ['common/x.txt', 'events/a.txt']), 'events/a.txt');
    assert.equal(knownPath('events/a.txt', ['events/a.txt', 'Events/a.txt']), 'events/a.txt');
    assert.equal(knownPath('EVENTS/A.TXT', ['events/a.txt', 'Events/a.txt']), 'EVENTS/A.TXT');
    assert.equal(knownPath('events/b.txt', ['events/a.txt']), 'events/b.txt');
});

test('a path inside the mod is an address on disk built with the platform function', () => {
    assert.equal(
        pathOnDisk('C:\\Mods\\Mine', 'events/sub/a.txt', WINDOWS),
        'C:\\Mods\\Mine\\events\\sub\\a.txt',
    );
    assert.equal(
        pathOnDisk('/mods/mine', 'events/sub/a.txt', POSIX),
        '/mods/mine/events/sub/a.txt',
    );
});

test(
    'on Windows, a file opened with another drive-letter and folder case is the mod file',
    { skip: process.platform !== 'win32' },
    async (t) => {
        const game = gameStub(path.join(scratch(t), 'install'));
        const mod = modCopy(t, 'names-unknown-trigger-bad');
        const { client } = spawnServer(t, { gamePath: game });
        await client.start([mod]);
        await client.settled();
        const file = path.join(mod, 'events');
        const name = readdirSync(file)[0] ?? '';
        const disk = path.join(file, name);
        const canonical = client.diagnostics.get(uriOf(disk))?.diagnostics ?? [];
        assert.ok(canonical.length > 0);
        // The editor's spelling: the drive letter in lower case with its colon escaped, the
        // folder in upper case.
        const upper = path.join(mod, 'EVENTS', name);
        const uri = uriOf(upper).replace(
            /^file:\/\/\/([A-Za-z]):/,
            (_m, d: string) => `file:///${d.toLowerCase()}%3A`,
        );
        await client.open(upper, readFileSync(disk, 'utf8'), 'ck3', uri);
        const opened = await client.findings(uri);
        assert.equal(opened.file, `events/${name}`);
        assert.ok(opened.findings.length > 0);
    },
);
