/**
 * Finding the installed game in any Steam library (docs/MVP.md, "Where the game is"; a lesson
 * of release 2.3.0, which tried only the default folders). Steam keeps a list of its
 * libraries, `libraryfolders.vdf`, in its own install folder; each library holds its games
 * under `steamapps/common/`. A game is recognised by its own launcher's settings, not by the
 * name of its folder: `launcher/launcher-settings.json` names the game (`gameId`, which the
 * spec package's manifest names too, `manifest.game`) and where its game folder is
 * (`dlcPath`, relative to the launcher folder; `../game` for CK3).
 *
 * Where Steam itself is installed:
 *
 * - Linux: `~/.steam/steam`, `~/.steam/root`, `$XDG_DATA_HOME/Steam` (by default
 *   `~/.local/share/Steam`), and the Flatpak and Snap installs' folders.
 * - Windows: the folder the registry names (`SteamPath` of `HKCU\Software\Valve\Steam`,
 *   `InstallPath` of the 32-bit `HKLM\SOFTWARE\Valve\Steam`), and `Steam` under
 *   `%ProgramFiles(x86)%` and `%ProgramFiles%`.
 * - macOS: `~/Library/Application Support/Steam` (untested).
 *
 * Every folder is a parameter (`SteamSearch`), so a test builds its own Steam in a temporary
 * folder. Nothing here writes anything.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Where to look for Steam: the environment, the system and the home folder. */
export interface SteamSearch {
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly platform?: NodeJS.Platform;
    readonly home?: string;
    /**
     * The Steam install folders the Windows registry names. By default the registry is asked
     * (`reg query`) on Windows only.
     */
    readonly registry?: () => readonly string[];
}

function isDirectory(dir: string): boolean {
    try {
        return statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

function isFile(file: string): boolean {
    try {
        return statSync(file).isFile();
    } catch {
        return false;
    }
}

/** A folder's real path, so one folder reached by two links is listed once. */
function identity(dir: string): string {
    try {
        return realpathSync(dir);
    } catch {
        return path.resolve(dir);
    }
}

/** The folders that exist, each once, in the order given. */
function existing(dirs: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const dir of dirs) {
        if (dir === '' || !isDirectory(dir)) {
            continue;
        }
        const id = identity(dir);
        if (!seen.has(id)) {
            seen.add(id);
            out.push(dir);
        }
    }
    return out;
}

/** The Steam install folders the Windows registry names, asked with `reg query`. */
export function windowsRegistrySteamFolders(): string[] {
    const out: string[] = [];
    const queries: readonly (readonly [string, string])[] = [
        ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
        ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
        ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
    ];
    for (const [key, value] of queries) {
        try {
            const text = execFileSync('reg', ['query', key, '/v', value], {
                encoding: 'utf8',
                timeout: 5000,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore'],
            });
            const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(value));
            const found = line?.split(/\s+REG_[A-Z_]+\s+/)[1]?.trim();
            if (found !== undefined && found !== '') {
                out.push(path.win32.normalize(found));
            }
        } catch {
            // No such key: Steam is not installed for this user, or not there.
        }
    }
    return out;
}

/** The folders Steam may be installed in, that exist. */
export function steamRoots(search: SteamSearch = {}): string[] {
    const env = search.env ?? process.env;
    const platform = search.platform ?? process.platform;
    const home = search.home ?? homedir();
    if (platform === 'win32') {
        const registry = search.registry ?? windowsRegistrySteamFolders;
        const programs = [env['ProgramFiles(x86)'], env['ProgramFiles']]
            .filter((dir): dir is string => dir !== undefined && dir !== '')
            .map((dir) => path.join(dir, 'Steam'));
        return existing([...registry(), ...programs]);
    }
    if (platform === 'darwin') {
        return existing([path.join(home, 'Library', 'Application Support', 'Steam')]);
    }
    const xdg = env['XDG_DATA_HOME'];
    const data = xdg !== undefined && path.isAbsolute(xdg) ? xdg : path.join(home, '.local/share');
    return existing([
        path.join(home, '.steam/steam'),
        path.join(home, '.steam/root'),
        path.join(data, 'Steam'),
        path.join(home, '.var/app/com.valvesoftware.Steam/.local/share/Steam'),
        path.join(home, 'snap/steam/common/.local/share/Steam'),
    ]);
}

/** A value of Valve's KeyValues text: a string, or a list of keys and values. */
type KeyValue = string | readonly (readonly [string, KeyValue])[];

/** Read Valve's KeyValues text (`"key" "value"`, `"key" { ... }`, `//` comments). */
function readKeyValues(text: string): (readonly [string, KeyValue])[] {
    const tokens: string[] = [];
    const kinds: ('string' | 'open' | 'close')[] = [];
    let at = 0;
    while (at < text.length) {
        const c = text[at] ?? '';
        if (/\s/.test(c)) {
            at++;
        } else if (c === '/' && text[at + 1] === '/') {
            while (at < text.length && text[at] !== '\n') {
                at++;
            }
        } else if (c === '{' || c === '}') {
            tokens.push(c);
            kinds.push(c === '{' ? 'open' : 'close');
            at++;
        } else if (c === '"') {
            let value = '';
            at++;
            while (at < text.length && text[at] !== '"') {
                if (text[at] === '\\' && at + 1 < text.length) {
                    const next = text[at + 1] ?? '';
                    value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
                    at += 2;
                } else {
                    value += text[at] ?? '';
                    at++;
                }
            }
            at++;
            tokens.push(value);
            kinds.push('string');
        } else {
            let value = '';
            while (at < text.length && !/[\s{}"]/.test(text[at] ?? '')) {
                value += text[at] ?? '';
                at++;
            }
            tokens.push(value);
            kinds.push('string');
        }
    }
    let next = 0;
    const list = (): (readonly [string, KeyValue])[] => {
        const out: (readonly [string, KeyValue])[] = [];
        while (next < tokens.length && kinds[next] !== 'close') {
            if (kinds[next] !== 'string') {
                next++;
                continue;
            }
            const key = tokens[next] ?? '';
            next++;
            if (kinds[next] === 'open') {
                next++;
                out.push([key, list()]);
                next++;
            } else if (kinds[next] === 'string') {
                out.push([key, tokens[next] ?? '']);
                next++;
            }
        }
        return out;
    };
    return list();
}

/**
 * The library folders a `libraryfolders.vdf` lists: in today's form each numbered entry's
 * `path`, in the older form each numbered entry's value.
 */
export function readLibraryFolders(text: string): string[] {
    const out: string[] = [];
    for (const [, root] of readKeyValues(text)) {
        if (typeof root === 'string') {
            continue;
        }
        for (const [key, entry] of root) {
            if (!/^[0-9]+$/.test(key)) {
                continue;
            }
            if (typeof entry === 'string') {
                out.push(entry);
            } else {
                const found = entry.find(([k]) => k.toLowerCase() === 'path')?.[1];
                if (typeof found === 'string') {
                    out.push(found);
                }
            }
        }
    }
    return out;
}

/** Every Steam library: each Steam install folder and every library its lists name. */
export function steamLibraries(search: SteamSearch = {}): string[] {
    const found: string[] = [];
    for (const root of steamRoots(search)) {
        found.push(root);
        for (const list of [
            path.join(root, 'steamapps', 'libraryfolders.vdf'),
            path.join(root, 'config', 'libraryfolders.vdf'),
        ]) {
            if (isFile(list)) {
                found.push(...readLibraryFolders(readFileSync(list, 'utf8')));
            }
        }
    }
    return existing(found);
}

/**
 * The game folder of an install whose launcher names `gameId`: `dlcPath` of its
 * `launcher/launcher-settings.json`, from the launcher folder, when that folder holds
 * `common/`; otherwise null.
 */
export function gameFolderOfInstall(install: string, gameId: string): string | null {
    const launcher = path.join(install, 'launcher');
    const file = path.join(launcher, 'launcher-settings.json');
    if (!isFile(file)) {
        return null;
    }
    try {
        const settings = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as unknown;
        if (typeof settings !== 'object' || settings === null) {
            return null;
        }
        const { gameId: id, dlcPath } = settings as Record<string, unknown>;
        if (id !== gameId || typeof dlcPath !== 'string' || dlcPath === '') {
            return null;
        }
        const game = path.resolve(launcher, dlcPath);
        return isDirectory(path.join(game, 'common')) ? game : null;
    } catch {
        return null;
    }
}

/**
 * The game folder of every install of the game `gameId` (the spec's `manifest.game`) in any
 * Steam library, in the order Steam lists its libraries.
 */
export function findGameFolders(gameId: string, search: SteamSearch = {}): string[] {
    const out: string[] = [];
    for (const library of steamLibraries(search)) {
        const common = path.join(library, 'steamapps', 'common');
        if (!isDirectory(common)) {
            continue;
        }
        let installs: string[];
        try {
            installs = readdirSync(common).sort();
        } catch {
            continue;
        }
        for (const name of installs) {
            const game = gameFolderOfInstall(path.join(common, name), gameId);
            if (game !== null) {
                out.push(game);
            }
        }
    }
    return existing(out);
}

/** Whether `dir` is a game folder: it holds `common/`. */
export function isGameFolder(dir: string): boolean {
    return isDirectory(path.join(dir, 'common'));
}
