/**
 * Game-path detection (ck3LanguageServer.gamePath, post-2.0 Phase 1 step 1.0).
 */

import * as assert from 'assert';
import {
    GamePathEnvironment,
    resolveGamePath,
    steamDefaultLocations,
} from '../../server/game-path';

function env(
    platform: NodeJS.Platform,
    existing: string[],
    home = platform === 'darwin' ? '/Users/me' : '/home/me'
): GamePathEnvironment & { checked: string[] } {
    const checked: string[] = [];
    const dirs = new Set(existing);
    return {
        platform,
        home,
        checked,
        isDirectory: (dir) => {
            checked.push(dir);
            return dirs.has(dir);
        },
    };
}

describe('Game path detection', () => {
    const linux = steamDefaultLocations('linux', '/home/me');

    it('lists the Steam defaults per platform in the order tried', () => {
        assert.deepStrictEqual(linux, [
            '/home/me/.steam/steam/steamapps/common/Crusader Kings III/game',
            '/home/me/.local/share/Steam/steamapps/common/Crusader Kings III/game',
        ]);
        assert.deepStrictEqual(steamDefaultLocations('win32', 'C:\\Users\\me'), [
            'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crusader Kings III\\game',
        ]);
        assert.deepStrictEqual(steamDefaultLocations('darwin', '/Users/me'), [
            '/Users/me/Library/Application Support/Steam/steamapps/common/Crusader Kings III/game',
        ]);
    });

    it('uses a valid explicit setting without trying the defaults', () => {
        const e = env('linux', ['/games/ck3/game/common', `${linux[0]}/common`]);
        const result = resolveGamePath('/games/ck3/game', e);
        assert.deepStrictEqual(result, {
            path: '/games/ck3/game',
            source: 'setting',
            tried: ['/games/ck3/game'],
        });
        assert.deepStrictEqual(e.checked, ['/games/ck3/game/common']);
    });

    it('reports an invalid explicit setting and runs without a base game', () => {
        const e = env('linux', [`${linux[0]}/common`]);
        const result = resolveGamePath('/nowhere/game', e);
        assert.strictEqual(result.path, undefined);
        assert.strictEqual(result.source, 'none');
        assert.deepStrictEqual(result.tried, ['/nowhere/game']);
        assert.ok(result.error && result.error.includes('/nowhere/game'));
        // The defaults are not tried when the setting is explicit.
        assert.strictEqual(e.checked.length, 1);
    });

    it('takes the first Steam default holding common/ when the setting is empty', () => {
        const both = env('linux', [`${linux[0]}/common`, `${linux[1]}/common`]);
        assert.deepStrictEqual(resolveGamePath('', both), {
            path: linux[0],
            source: 'steam-default',
            tried: [linux[0]],
        });
        const second = env('linux', [`${linux[1]}/common`]);
        assert.deepStrictEqual(resolveGamePath('  ', second), {
            path: linux[1],
            source: 'steam-default',
            tried: linux,
        });
    });

    it('a default without common/ is not taken; none found means no base game', () => {
        const e = env('linux', [linux[0]]);
        const result = resolveGamePath(undefined, e);
        assert.deepStrictEqual(result, { source: 'none', tried: linux });
    });

    it('checks the Windows default with Windows separators', () => {
        const win = steamDefaultLocations('win32', 'C:\\Users\\me')[0];
        const e = env('win32', [`${win}\\common`], 'C:\\Users\\me');
        assert.deepStrictEqual(resolveGamePath('', e), {
            path: win,
            source: 'steam-default',
            tried: [win],
        });
    });
});
