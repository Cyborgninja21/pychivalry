/**
 * The CK3 base game for the server's workspace (the `ck3LanguageServer.gamePath` setting).
 *
 * An explicit setting is used when it holds `common/`; an invalid one is reported and the
 * server runs without a base game. With the setting empty, the Steam default install
 * locations of the platform are tried once, in order, and the first holding `common/` is
 * taken.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const STEAM_GAME = ['steamapps', 'common', 'Crusader Kings III', 'game'];

export interface GamePathEnvironment {
    platform: NodeJS.Platform;
    home: string;
    /** Does `dir` exist and is it a directory? */
    isDirectory: (dir: string) => boolean;
}

export interface GamePathResult {
    /** The game directory to use, or undefined to run without a base game. */
    path?: string;
    /** Where it came from. */
    source: 'setting' | 'steam-default' | 'none';
    /** The directories that were tried, in order. */
    tried: string[];
    /** Set when the explicit setting is not a CK3 game directory. */
    error?: string;
}

export function defaultEnvironment(): GamePathEnvironment {
    return {
        platform: process.platform,
        home: os.homedir(),
        isDirectory: (dir) => {
            try {
                return fs.statSync(dir).isDirectory();
            } catch {
                return false;
            }
        },
    };
}

/** The Steam default locations of the game directory on a platform, in the order tried. */
export function steamDefaultLocations(platform: NodeJS.Platform, home: string): string[] {
    switch (platform) {
        case 'win32':
            return [path.win32.join('C:\\Program Files (x86)', 'Steam', ...STEAM_GAME)];
        case 'darwin':
            return [
                path.posix.join(home, 'Library', 'Application Support', 'Steam', ...STEAM_GAME),
            ];
        default:
            return [
                path.posix.join(home, '.steam', 'steam', ...STEAM_GAME),
                path.posix.join(home, '.local', 'share', 'Steam', ...STEAM_GAME),
            ];
    }
}

function holdsCommon(dir: string, env: GamePathEnvironment): boolean {
    const join = env.platform === 'win32' ? path.win32.join : path.posix.join;
    return env.isDirectory(join(dir, 'common'));
}

/** Resolve the base game directory from the setting (possibly empty) and the platform. */
export function resolveGamePath(
    setting: string | undefined,
    env: GamePathEnvironment = defaultEnvironment()
): GamePathResult {
    const explicit = (setting ?? '').trim();
    if (explicit !== '') {
        if (holdsCommon(explicit, env)) {
            return { path: explicit, source: 'setting', tried: [explicit] };
        }
        return {
            source: 'none',
            tried: [explicit],
            error: `ck3LanguageServer.gamePath '${explicit}' is not a CK3 game directory (no common/ in it); running without a base game`,
        };
    }
    const tried: string[] = [];
    for (const candidate of steamDefaultLocations(env.platform, env.home)) {
        tried.push(candidate);
        if (holdsCommon(candidate, env)) {
            return { path: candidate, source: 'steam-default', tried };
        }
    }
    return { source: 'none', tried };
}
