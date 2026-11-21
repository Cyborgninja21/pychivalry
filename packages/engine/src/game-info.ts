/**
 * Which CK3 game a record was measured against (the acceptance and corpus records). The spec
 * package describes one executable (manifest.exe.sha256); the game directory a run reads can
 * be another build (Steam updates the install in place), so every record says which one it was.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface GameInfo {
    /** `rawVersion` of `<game dir>/../launcher/launcher-settings.json`; null when absent. */
    version: string | null;
    /** SHA-256 (lower-case hex) of `<game dir>/../binaries/ck3.exe`; null when absent. */
    exe_sha256: string | null;
    /** The executable is the spec package's; null when there is no executable to compare. */
    matches_spec_exe: boolean | null;
}

/** Describe the game install `gameDir` (the `game` folder) against the spec's executable. */
export function gameInfo(gameDir: string | undefined, specExeSha256: string): GameInfo {
    if (!gameDir) {
        return { version: null, exe_sha256: null, matches_spec_exe: null };
    }
    const install = path.dirname(path.resolve(gameDir));
    let version: string | null = null;
    try {
        const settings: unknown = JSON.parse(
            fs.readFileSync(path.join(install, 'launcher', 'launcher-settings.json'), 'utf8')
        );
        const raw =
            typeof settings === 'object' && settings !== null
                ? Reflect.get(settings, 'rawVersion')
                : undefined;
        version = typeof raw === 'string' && raw !== '' ? raw : null;
    } catch {
        version = null;
    }
    let exe: string | null = null;
    try {
        exe = crypto
            .createHash('sha256')
            .update(fs.readFileSync(path.join(install, 'binaries', 'ck3.exe')))
            .digest('hex');
    } catch {
        exe = null;
    }
    return {
        version,
        exe_sha256: exe,
        matches_spec_exe: exe === null ? null : exe === specExeSha256.toLowerCase(),
    };
}
