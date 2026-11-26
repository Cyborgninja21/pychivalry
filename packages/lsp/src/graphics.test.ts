/**
 * `graphics/missing-file` in the editor (docs/PLAN.md item 10.5): the fixture pair's findings over
 * its game stub, the same as the runner's; silent with no game; and a texture the mod adds on disk
 * takes its finding away, the server watching texture files as it watches script.
 */

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { Diagnostic } from 'vscode-languageserver-protocol/node';
import { GAMES, modCopy, serverInProcess, spawnServer, uriOf, write } from './testing.js';

const GAME = path.join(GAMES, 'graphics', 'game');
const CODE = 'graphics/missing-file';
const DECISIONS = path.join('common', 'decisions', 'fixture_graphics_decisions.txt');

const graphics = (d: readonly Diagnostic[]): Diagnostic[] => d.filter((x) => x.code === CODE);

const messageOf = (d: Diagnostic): string =>
    typeof d.message === 'string' ? d.message : d.message.value;

test('the missing textures of the bad fixture, and a texture the mod adds on disk takes its finding away', async (t) => {
    const dir = modCopy(t, 'graphics-missing-file-bad');
    const { client } = spawnServer(t, { gamePath: GAME });
    await client.start([dir]);
    await client.settled();
    const uri = uriOf(path.join(dir, DECISIONS));
    const before = graphics(await client.diagnosticsOf(uri));
    assert.equal(before.length, 4);
    assert.ok(
        before.every((d) => d.severity === 2),
        'warnings',
    );
    assert.ok(
        before.some((d) =>
            messageOf(d).includes(
                'gfx/interface/illustrations/decisions/fixture_missing_picture.dds',
            ),
        ),
    );
    const texture = path.join(
        dir,
        'gfx',
        'interface',
        'illustrations',
        'decisions',
        'fixture_missing_picture.dds',
    );
    write(texture, 'A placeholder of a texture, written for the test.\n');
    const done = client.done.length;
    await client.filesChanged([{ uri: uriOf(texture), type: 1 }]);
    await client.settled(done);
    const after = graphics(await client.diagnosticsOf(uri, (d) => graphics(d).length === 3));
    assert.ok(!after.some((d) => messageOf(d).includes('fixture_missing_picture.dds')));
    rmSync(texture);
    const again = client.done.length;
    await client.filesChanged([{ uri: uriOf(texture), type: 3 }]);
    await client.settled(again);
    assert.equal(
        graphics(await client.diagnosticsOf(uri, (d) => graphics(d).length === 4)).length,
        4,
    );
});

test('with no game folder the check is silent', async (t) => {
    const dir = modCopy(t, 'graphics-missing-file-bad');
    const { client } = serverInProcess(t, { gamePath: '' }, { findGame: () => null });
    await client.start([dir]);
    await client.settled();
    assert.deepEqual(graphics(await client.diagnosticsOf(uriOf(path.join(dir, DECISIONS)))), []);
});
