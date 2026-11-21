/**
 * The installed game a suite reads: its build and the hash of its file manifest
 * (records/README.md, "The game's file manifest").
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileManifest, inChecksumScope, manifestSha256, readChecksumManifest } from './manifest.js';
import { CommandError, EXIT, isObject } from './util.js';

export interface GameInfo {
    /** `rawVersion` of `<install>/launcher/launcher-settings.json`. */
    build: string;
    manifest_sha256: string;
    files: number;
    content_hashed_files: number;
}

/** Check that `gameDir` is a CK3 `game` folder: it exists and holds `common/`. */
export function requireGameDir(gameDir: string | undefined): string {
    if (gameDir === undefined || gameDir === '') {
        throw new CommandError(
            'CK3_GAME_PATH is not set: point it at the game\'s "game" folder (docs/PLAN.md, "Environment for the game-file suites")',
            EXIT.usage,
        );
    }
    const dir = path.resolve(gameDir);
    if (
        !existsSync(path.join(dir, 'common')) ||
        !statSync(path.join(dir, 'common')).isDirectory()
    ) {
        throw new CommandError(
            'CK3_GAME_PATH is not a CK3 "game" folder (it has no common/ folder)',
            EXIT.usage,
        );
    }
    return dir;
}

/** The game build, from the launcher's settings file beside the `game` folder. */
export function readGameBuild(gameDir: string): string {
    const file = path.join(path.dirname(gameDir), 'launcher', 'launcher-settings.json');
    if (!existsSync(file)) {
        throw new CommandError(
            'the game build is unknown: launcher/launcher-settings.json is missing beside the game folder',
            EXIT.usage,
        );
    }
    const settings = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as unknown;
    const raw = isObject(settings) ? settings['rawVersion'] : undefined;
    if (typeof raw !== 'string' || !/^[0-9]+(\.[0-9]+)+$/.test(raw)) {
        throw new CommandError(
            'the game build is unknown: launcher-settings.json has no rawVersion of the form 1.2.3.4',
            EXIT.usage,
        );
    }
    return raw;
}

/**
 * The game's build and file manifest. Every file under the game folder is listed with its
 * size; the files the game's own `checksum_manifest.txt` covers are hashed as well.
 */
export function gameInfo(gameDir: string): GameInfo {
    const build = readGameBuild(gameDir);
    const checksumFile = path.join(gameDir, 'checksum_manifest.txt');
    const scope = existsSync(checksumFile)
        ? readChecksumManifest(readFileSync(checksumFile, 'utf8'))
        : { directories: [], files: [] };
    const entries = fileManifest(gameDir, (rel) => inChecksumScope(scope, rel));
    return {
        build,
        manifest_sha256: manifestSha256(entries),
        files: entries.length,
        content_hashed_files: entries.filter((e) => e.sha256 !== null).length,
    };
}
