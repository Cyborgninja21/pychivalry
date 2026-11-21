/**
 * Workspace.useVanilla: the base game loaded asynchronously into the same instance (the
 * editor's game-path setting, post-2.0 Phase 1 step 1.0).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { diagnose } from '../../src/diagnostics';
import { SymbolType } from '../../src/index/indexer';
import { Workspace } from '../../src/index/workspace';
import { VIRTUAL_ROOT } from '../helpers/engine';

function makeGame(): string {
    const game = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-vanilla-'));
    const dir = path.join(game, 'common', 'scripted_effects');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '00_test_effects.txt'), 'vanilla_test_effect = { }\n');
    return game;
}

const callingEvent = [
    'namespace = t',
    't.1 = {',
    '\ttype = character_event',
    '\timmediate = { vanilla_test_effect = yes }',
    '}',
].join('\n');

describe('Workspace.useVanilla', () => {
    let game: string;
    before(() => {
        game = makeGame();
    });
    after(() => {
        fs.rmSync(game, { recursive: true, force: true });
    });

    it('loads the base game into the same instance and sets vanillaRoot when done', async () => {
        const ws = new Workspace(VIRTUAL_ROOT);
        const index = ws.vanillaIndex;
        const loading = ws.useVanilla(game, { yieldEvery: 1 });
        // Until the load finishes the workspace runs without a base game.
        assert.strictEqual(ws.vanillaRoot, undefined);
        const result = await loading;
        assert.strictEqual(result.files, 1);
        assert.ok(result.milliseconds >= 0);
        assert.strictEqual(ws.vanillaRoot, path.resolve(game));
        assert.strictEqual(ws.vanillaIndex, index);
        assert.ok(ws.isDefined('vanilla_test_effect', SymbolType.SCRIPTED_EFFECT));
        const diags = diagnose(ws, path.join(VIRTUAL_ROOT, 'events/test.txt'), {
            text: callingEvent,
        });
        assert.deepStrictEqual(
            diags.filter((d) => d.code === 'unknown_effect_X'),
            []
        );
    });

    it('useVanilla(undefined) drops the base game', async () => {
        const ws = new Workspace(VIRTUAL_ROOT);
        await ws.useVanilla(game);
        const result = await ws.useVanilla(undefined);
        assert.deepStrictEqual(result, { files: 0, milliseconds: 0 });
        assert.strictEqual(ws.vanillaRoot, undefined);
        assert.ok(!ws.isDefined('vanilla_test_effect', SymbolType.SCRIPTED_EFFECT));
        const diags = diagnose(ws, path.join(VIRTUAL_ROOT, 'events/test.txt'), {
            text: callingEvent,
        });
        assert.deepStrictEqual(
            diags.filter((d) => d.code === 'unknown_effect_X').map((d) => d.severity),
            ['error']
        );
    });
});
