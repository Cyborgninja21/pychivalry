/**
 * Where the game writes its logs (docs/PLAN.md item 11.7; docs/game-log.md, "Where the logs
 * are"). Each folder is a candidate with what it rests on; only one that exists is offered, and
 * nothing here writes anything, there or anywhere.
 *
 * - **Windows.** `Paradox Interactive/Crusader Kings III/logs` in the user's Documents folder.
 *   Seen on the analysis machine: a launch record of the spec work lists the folder under
 *   `Documents` and its 25 files (`pdx-parser-re`, `research/oracle/1.21.0.3/run-record.txt`).
 *   The Documents folder itself is the one Windows names (the `Personal` value of the user's
 *   shell folders in the registry, which follows a move to OneDrive), then `Documents` in the
 *   home folder and in each OneDrive folder the environment names (`OneDrive`,
 *   `OneDriveConsumer`, `OneDriveCommercial`) and `OneDrive/Documents` in the home folder:
 *   Windows' and OneDrive's documented places, not yet seen with the game.
 * - **Linux.** `~/.local/share/Paradox Interactive/Crusader Kings III/logs`, the folder
 *   docs/PLAN.md names for the game's own Linux build; `$XDG_DATA_HOME` in its place when set.
 *   Not yet seen on a machine of this project.
 * - **Proton**, the game's Windows build run on Linux: the Windows folder inside the game's
 *   Proton prefix, which Valve's Proton FAQ places in the game's own Steam library at
 *   `steamapps/compatdata/<app id>/pfx/`; Windows' Documents there is
 *   `drive_c/users/steamuser/Documents` (`My Documents` in older prefixes). The app id is the one
 *   Steam's own `appmanifest_<id>.acf` gives the game's install folder, never written here. Not
 *   yet seen on a machine of this project.
 * - **macOS**: `~/Documents/Paradox Interactive/Crusader Kings III/logs`. Untested.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** The game's own folder under the user's Documents (or data) folder. */
const GAME_FOLDER = ['Paradox Interactive', 'Crusader Kings III'];

/** What a candidate log folder rests on. */
export type LogFolderBasis =
    /** Seen with the game: the analysis machine's launch record. */
    | 'seen'
    /** The folder docs/PLAN.md names. */
    | 'plan'
    /** The platform's or Steam's documented convention, not yet seen with the game. */
    | 'convention';

/** A folder the game may write its logs in. */
export interface LogFolder {
    readonly dir: string;
    /** `windows`, `linux`, `proton` (the Windows build under Proton) or `macos`. */
    readonly kind: 'windows' | 'linux' | 'proton' | 'macos';
    readonly basis: LogFolderBasis;
    /** How it was found, in a few words. */
    readonly how: string;
}

/** Where to look: the environment, the system, the home folder, and the Steam libraries. */
export interface LogFolderSearch {
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly platform?: NodeJS.Platform;
    readonly home?: string;
    /** The Documents folder the Windows registry names; by default asked with `reg query`. */
    readonly documents?: () => string | null;
    /** The game's game folders found in Steam's libraries (`findGameFolders`), for Proton. */
    readonly gameFolders?: () => readonly string[];
}

function isDirectory(dir: string): boolean {
    try {
        return statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

/** `%NAME%` in a registry value, from the environment, the name matched in any letter case. */
function expand(value: string, env: Readonly<Record<string, string | undefined>>): string {
    return value.replace(/%([^%]+)%/g, (whole, name: string) => {
        const key = Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase());
        const found = key === undefined ? undefined : env[key];
        return found ?? whole;
    });
}

/** The Documents folder the Windows registry names (`User Shell Folders`, `Personal`). */
export function windowsRegistryDocuments(
    env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
    try {
        const text = execFileSync(
            'reg',
            [
                'query',
                'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
                '/v',
                'Personal',
            ],
            {
                encoding: 'utf8',
                timeout: 5000,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore'],
            },
        );
        const line = text.split(/\r?\n/).find((l) => l.trim().startsWith('Personal'));
        const found = line?.split(/\s+REG_[A-Z_]+\s+/)[1]?.trim();
        return found === undefined || found === '' ? null : expand(found, env);
    } catch {
        return null;
    }
}

/** The app id Steam's `appmanifest_<id>.acf` of a library gives an install folder's name. */
export function appIdOfInstall(library: string, install: string): string | null {
    const apps = path.join(library, 'steamapps');
    let names: string[];
    try {
        names = readdirSync(apps)
            .filter((n) => /^appmanifest_\d+\.acf$/.test(n))
            .sort();
    } catch {
        return null;
    }
    for (const name of names) {
        let text: string;
        try {
            text = readFileSync(path.join(apps, name), 'utf8');
        } catch {
            continue;
        }
        const dir = /"installdir"\s+"([^"]*)"/i.exec(text)?.[1];
        const id = /"appid"\s+"(\d+)"/i.exec(text)?.[1];
        if (dir !== undefined && id !== undefined && dir === install) {
            return id;
        }
    }
    return null;
}

/**
 * Every candidate log folder for this system, in the order above, each once; those that do not
 * exist are left out unless `all` is set.
 */
export function logFolders(search: LogFolderSearch = {}, all = false): LogFolder[] {
    const env = search.env ?? process.env;
    const platform = search.platform ?? process.platform;
    const home = search.home ?? homedir();
    const out: LogFolder[] = [];
    const seen = new Set<string>();
    const add = (folder: LogFolder): void => {
        const key = platform === 'win32' ? folder.dir.toLowerCase() : folder.dir;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        if (all || isDirectory(folder.dir)) {
            out.push(folder);
        }
    };
    if (platform === 'win32') {
        const p = path.win32;
        const logs = (documents: string): string => p.join(documents, ...GAME_FOLDER, 'logs');
        const registry = (search.documents ?? (() => windowsRegistryDocuments(env)))();
        if (registry !== null) {
            add({
                dir: logs(registry),
                kind: 'windows',
                basis: 'seen',
                how: 'the Documents folder Windows names',
            });
        }
        const profile = env['USERPROFILE'] ?? home;
        add({
            dir: logs(p.join(profile, 'Documents')),
            kind: 'windows',
            basis: 'seen',
            how: 'Documents in the home folder',
        });
        for (const name of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
            const dir = env[name];
            if (dir !== undefined && dir !== '') {
                add({
                    dir: logs(p.join(dir, 'Documents')),
                    kind: 'windows',
                    basis: 'convention',
                    how: `Documents in the OneDrive folder ${name} names`,
                });
            }
        }
        add({
            dir: logs(p.join(profile, 'OneDrive', 'Documents')),
            kind: 'windows',
            basis: 'convention',
            how: 'Documents in OneDrive in the home folder',
        });
        return out;
    }
    const p = path.posix;
    if (platform === 'darwin') {
        add({
            dir: p.join(home, 'Documents', ...GAME_FOLDER, 'logs'),
            kind: 'macos',
            basis: 'convention',
            how: 'Documents in the home folder',
        });
        return out;
    }
    const xdg = env['XDG_DATA_HOME'];
    if (xdg !== undefined && p.isAbsolute(xdg)) {
        add({
            dir: p.join(xdg, ...GAME_FOLDER, 'logs'),
            kind: 'linux',
            basis: 'convention',
            how: 'XDG_DATA_HOME',
        });
    }
    add({
        dir: p.join(home, '.local', 'share', ...GAME_FOLDER, 'logs'),
        kind: 'linux',
        basis: 'plan',
        how: '~/.local/share',
    });
    for (const game of search.gameFolders?.() ?? []) {
        // <library>/steamapps/common/<install>/game
        const installDir = path.dirname(game);
        const library = path.dirname(path.dirname(path.dirname(installDir)));
        const id = appIdOfInstall(library, path.basename(installDir));
        if (id === null) {
            continue;
        }
        const users = p.join(
            library,
            'steamapps',
            'compatdata',
            id,
            'pfx',
            'drive_c',
            'users',
            'steamuser',
        );
        for (const documents of ['Documents', 'My Documents']) {
            add({
                dir: p.join(users, documents, ...GAME_FOLDER, 'logs'),
                kind: 'proton',
                basis: 'convention',
                how: `the Proton prefix of app ${id}`,
            });
        }
    }
    return out;
}

/** The log a folder holds that pychivalry reads by default: the game's error log. */
export const ERROR_LOG = 'error.log';
