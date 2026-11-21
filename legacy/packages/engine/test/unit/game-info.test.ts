/**
 * gameInfo(): which game install a record was measured against, compared with the spec
 * package's executable; null values when the launcher settings or the executable are absent.
 */

import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { gameInfo } from '../../src/game-info';

function install(version?: string, exe?: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-install-'));
    fs.mkdirSync(path.join(root, 'game'));
    if (version !== undefined) {
        fs.mkdirSync(path.join(root, 'launcher'));
        fs.writeFileSync(
            path.join(root, 'launcher', 'launcher-settings.json'),
            JSON.stringify({ version: `${version} (Name)`, rawVersion: version })
        );
    }
    if (exe !== undefined) {
        fs.mkdirSync(path.join(root, 'binaries'));
        fs.writeFileSync(path.join(root, 'binaries', 'ck3.exe'), exe);
    }
    return path.join(root, 'game');
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('gameInfo (the game a record was measured against)', () => {
    it("matches when the install's executable is the spec's (case-insensitive hash)", () => {
        const dir = install('1.20.0.2', 'exe-a');
        assert.deepStrictEqual(gameInfo(dir, sha('exe-a').toUpperCase()), {
            version: '1.20.0.2',
            exe_sha256: sha('exe-a'),
            matches_spec_exe: true,
        });
    });

    it('says so when the install is another build', () => {
        const dir = install('1.20.0.3', 'exe-b');
        assert.deepStrictEqual(gameInfo(dir, sha('exe-a')), {
            version: '1.20.0.3',
            exe_sha256: sha('exe-b'),
            matches_spec_exe: false,
        });
    });

    it('records nulls, never a guess, when the launcher file or the executable is absent', () => {
        assert.deepStrictEqual(gameInfo(install(), sha('exe-a')), {
            version: null,
            exe_sha256: null,
            matches_spec_exe: null,
        });
        assert.deepStrictEqual(gameInfo(install('1.20.0.3'), sha('exe-a')), {
            version: '1.20.0.3',
            exe_sha256: null,
            matches_spec_exe: null,
        });
        assert.deepStrictEqual(gameInfo(undefined, sha('exe-a')), {
            version: null,
            exe_sha256: null,
            matches_spec_exe: null,
        });
    });
});
