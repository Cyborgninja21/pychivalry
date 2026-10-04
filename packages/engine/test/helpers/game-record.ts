/**
 * The `game` field of an acceptance or corpus record: which game the run read. A record made
 * against another build than the spec package's executable is valid evidence for that build;
 * it must say so (matches_spec_exe false) rather than claim the spec's.
 */

import * as assert from 'assert';

import { defaultSpec } from '../../src/spec/spec';

export function assertGameRecord(where: string, game: unknown): void {
    assert.ok(typeof game === 'object' && game !== null, `${where}: a game object`);
    const version: unknown = Reflect.get(game, 'version');
    const exe: unknown = Reflect.get(game, 'exe_sha256');
    const matches: unknown = Reflect.get(game, 'matches_spec_exe');
    assert.ok(version === null || typeof version === 'string', `${where}: game.version`);
    if (exe === null) {
        assert.strictEqual(matches, null, `${where}: no executable, so no comparison`);
        return;
    }
    assert.ok(typeof exe === 'string' && /^[0-9a-f]{64}$/.test(exe), `${where}: game.exe_sha256`);
    const spec = defaultSpec().data.manifest.exe.sha256.toLowerCase();
    assert.strictEqual(
        matches,
        exe === spec,
        `${where}: matches_spec_exe says whether the game is the spec's executable`
    );
}
