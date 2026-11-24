/**
 * The game folder (docs/PLAN.md item 7.6): found in any Steam library on Linux and Windows
 * through the core's `find-game`, overridden by the setting, a clear message once when there is
 * none, silence and not wrong findings without one, and a build that is not the spec's said
 * once.
 */

import { findGameFolders } from '@pychivalry/core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { MessageType } from 'vscode-languageserver-protocol/node';
import { chooseGame, gameNotices } from './game.js';
import {
    committedSpec,
    gameStub,
    scratch,
    serverInProcess,
    spawnServer,
    uriOf,
    write,
} from './testing.js';

const spec = committedSpec();

/** A mod whose event calls a scripted trigger nothing in the mod defines: the game might. */
function modCallingTheGame(t: TestContext): { dir: string; events: string } {
    const dir = path.join(scratch(t), 'mod');
    write(path.join(dir, 'descriptor.mod'), 'name = "Calls the game"\n');
    const events = path.join(dir, 'events', 'calls.txt');
    write(
        events,
        'namespace = calls\ncalls.1 = {\n\ttype = character_event\n\ttrigger = {\n\t\tsome_game_scripted_trigger = yes\n\t}\n}\n',
    );
    return { dir, events };
}

const unknownTriggers = (d: readonly { code?: unknown }[] | undefined): number =>
    (d ?? []).filter((x) => x.code === 'names/unknown-trigger').length;

test('without a game the server says so once and judges no name the game might define', async (t) => {
    const { dir, events } = modCallingTheGame(t);
    const { client } = serverInProcess(t, {}, { findGame: () => null });
    await client.start([dir]);
    await client.settled();
    const notes = client.messages.filter((m) =>
        m.message.includes('did not find Crusader Kings III'),
    );
    assert.equal(notes.length, 1);
    assert.equal(notes[0]?.type, MessageType.Warning);
    assert.match(notes[0].message, /pychivalry\.gamePath/);
    assert.equal(unknownTriggers(client.diagnostics.get(uriOf(events))?.diagnostics), 0);
    // Opening the workspace again does not say it again.
    const before = client.done.length;
    await client.configure({ localization: { unusedKeys: false } });
    await client.settled(before);
    await client.folders([dir], [dir]);
    await client.settled(before + 1);
    assert.equal(
        client.messages.filter((m) => m.message.includes('did not find Crusader Kings III')).length,
        1,
    );
});

test('with a game, the same name is judged: the game does not define it', async (t) => {
    const { dir, events } = modCallingTheGame(t);
    const game = gameStub(path.join(scratch(t), 'install'));
    const { client } = serverInProcess(t, {}, { findGame: () => game });
    await client.start([dir]);
    await client.settled();
    assert.deepEqual(client.messages, []);
    assert.equal(unknownTriggers(client.diagnostics.get(uriOf(events))?.diagnostics), 1);
});

test('the setting overrides the game found in Steam, and a folder that is no game is said once', async (t) => {
    const { dir, events } = modCallingTheGame(t);
    const steam = gameStub(path.join(scratch(t), 'steam-install'), {
        'common/scripted_triggers/00_steam.txt': 'some_game_scripted_trigger = { always = yes }\n',
    });
    const install = path.join(scratch(t), 'set-install');
    gameStub(install);
    // Set to the install folder, not its game folder: said, and no game is used.
    const { client } = serverInProcess(t, { gamePath: install }, { findGame: () => steam });
    await client.start([dir]);
    await client.settled();
    const said = client.messages.filter((m) => m.message.includes('pychivalry.gamePath names'));
    assert.equal(said.length, 1);
    assert.equal(said[0]?.type, MessageType.Error);
    assert.ok(said[0].message.includes(path.join(install, 'game')));
    assert.equal(unknownTriggers(client.diagnostics.get(uriOf(events))?.diagnostics), 0);
    // Set to its game folder: used, not the one in Steam, which defines the trigger.
    let before = client.done.length;
    await client.configure({ gamePath: path.join(install, 'game') });
    await client.settled(before);
    assert.equal(unknownTriggers(client.diagnostics.get(uriOf(events))?.diagnostics), 1);
    // Cleared: the game in Steam is used.
    before = client.done.length;
    await client.configure({ gamePath: '' });
    await client.settled(before);
    assert.equal(unknownTriggers(client.diagnostics.get(uriOf(events))?.diagnostics), 0);
});

test("a game whose build is not the spec package's is said once", async (t) => {
    const { dir } = modCallingTheGame(t);
    const game = gameStub(path.join(scratch(t), 'install'), {}, '1.20.0.1');
    const { client } = spawnServer(t, { gamePath: game });
    await client.start([dir]);
    await client.settled();
    const said = client.messages.filter((m) => m.message.includes('build 1.20.0.1'));
    assert.equal(said.length, 1);
    assert.ok(said[0]?.message.includes(spec.version));
});

test('the game is found in every Steam library, on Linux and on Windows', (t) => {
    const root = scratch(t);
    // Linux: Steam in the home folder lists a second library, which holds the game.
    const home = path.join(root, 'home');
    const library = path.join(root, 'games-disk');
    const install = path.join(library, 'steamapps', 'common', 'Crusader Kings III');
    const game = gameStub(install);
    write(
        path.join(home, '.local', 'share', 'Steam', 'steamapps', 'libraryfolders.vdf'),
        `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${path.join(home, '.local', 'share', 'Steam').replaceAll('\\', '\\\\')}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${library.replaceAll('\\', '\\\\')}"\n\t}\n}\n`,
    );
    const linux = findGameFolders(spec.data.manifest.game, { env: {}, platform: 'linux', home });
    assert.deepEqual(linux, [game]);
    assert.deepEqual(
        chooseGame('', () => linux[0] ?? null),
        { dir: game, source: 'steam', problem: null },
    );
    // Windows: Steam where the registry says, listing the same library.
    const steam = path.join(root, 'Program Files (x86)', 'Steam');
    write(
        path.join(steam, 'steamapps', 'libraryfolders.vdf'),
        `"libraryfolders"\n{\n\t"1"\n\t{\n\t\t"path"\t\t"${library.replaceAll('\\', '\\\\')}"\n\t}\n}\n`,
    );
    const windows = findGameFolders(spec.data.manifest.game, {
        env: {},
        platform: 'win32',
        home,
        registry: () => [steam],
    });
    assert.deepEqual(windows, [game]);
    // Not found anywhere: no game, and the message that says how to set it.
    const none = chooseGame('', () => null);
    assert.deepEqual(none, { dir: null, source: null, problem: 'not-found' });
    assert.equal(gameNotices(none, '', spec.version)[0]?.key, 'game:not-found');
    // The setting wins over Steam.
    assert.deepEqual(
        chooseGame(game, () => null),
        { dir: game, source: 'setting', problem: null },
    );
});
