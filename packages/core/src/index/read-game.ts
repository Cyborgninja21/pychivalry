/**
 * Reading the game and a mod from the local disk (docs/PLAN.md items 3.5 and 3.6a). In the
 * MVP the game is on the same computer as VS Code (docs/MVP.md, "Where the game is"): the game
 * folder is a parameter, every file is read with the platform's own path functions, and no
 * path is assumed to be in one letter case. Nothing here would stop a later reader from
 * taking the same files from elsewhere: the index is given layers, relative paths and bytes.
 *
 * The base game is three folders of the install, each in the same layout
 * (docs/overrides.md, rule 3): `game/`, and beside it `jomini/` and `clausewitz/`, each its own
 * layer; which copy wins where two share a path is the rules table's `file-replace` rows. The
 * DLC packs inside `game/` are layers of their own only when the table has a deciding
 * `pack-layer` row (rule 10).
 *
 * The files read are the script (`.txt`) and localization (`.yml`) files in the folders the
 * spec lists. Every other file is counted, never read: a `.txt` file in a folder the spec
 * does not describe, by its folder, and every other file, by its extension.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../syntax/parser.js';
import { drain, type Steps } from '../steps.js';
import { decodeScript } from '../syntax/decode.js';
import type { FolderTable } from './folders.js';
import { diskPath, extensionOf, fileNameOf, isWithin, relativePath, segmentsOf } from './paths.js';
import type { PackLayerRule, Rule } from './rules.js';
import { fileKindOf, WorkspaceIndex, type IndexOptions } from './workspace.js';

/** One of the install's folders. */
export interface InstallFolder {
    readonly layer: 'clausewitz' | 'jomini' | 'game';
    readonly dir: string;
}

/**
 * The install's folders that exist, from the game folder (`CK3_GAME_PATH`): the game folder
 * itself and, beside it, `jomini/` and `clausewitz/` (docs/overrides.md, rule 3).
 */
export function installFolders(gameDir: string): InstallFolder[] {
    const install = path.dirname(path.resolve(gameDir));
    const out: InstallFolder[] = [];
    for (const layer of ['clausewitz', 'jomini'] as const) {
        const dir = path.join(install, layer);
        if (existsSync(dir) && statSync(dir).isDirectory()) {
            out.push({ layer, dir });
        }
    }
    out.push({ layer: 'game', dir: path.resolve(gameDir) });
    return out;
}

/** The game build, `rawVersion` of `launcher/launcher-settings.json` beside the game folder. */
export function readGameBuild(gameDir: string): string | null {
    const file = path.join(
        path.dirname(path.resolve(gameDir)),
        'launcher',
        'launcher-settings.json',
    );
    if (!existsSync(file)) {
        return null;
    }
    try {
        const settings = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as unknown;
        const raw =
            typeof settings === 'object' && settings !== null
                ? (settings as Record<string, unknown>)['rawVersion']
                : undefined;
        return typeof raw === 'string' && /^[0-9]+(\.[0-9]+)+$/.test(raw) ? raw : null;
    } catch {
        return null;
    }
}

/** A file to index: its layer, relative path and address on disk, with its size and time. */
export interface SourceFile {
    readonly layer: string;
    readonly path: string;
    readonly disk: string;
    readonly size: number;
    readonly mtimeMs: number;
}

/** The files of a set of folders: those to read, and the counts of those not read. */
export interface SourceListing {
    readonly files: SourceFile[];
    /** `.txt` and `.yml` files in a folder the spec does not describe, by that folder. */
    readonly notDescribed: Map<string, number>;
    /** Every other file, by its extension (`(none)` when it has none). */
    readonly notRead: Map<string, number>;
    /** The packs found, each a layer `dlc:<pack>` and its folder relative to its install folder. */
    readonly packs: { readonly layer: string; readonly folder: string }[];
}

/** Every regular file under `dir`, relative to it with `/`, sorted; links are not followed. */
export function walkFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (at: string): void => {
        for (const entry of readdirSync(at, { withFileTypes: true })) {
            const full = path.join(at, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile()) {
                out.push(relativePath(dir, full));
            }
        }
    };
    walk(dir);
    return out.sort();
}

/** The value of a top-level `key = value` in a descriptor file, each time it is written. */
export function descriptorValues(text: string, key: string): string[] {
    const values: string[] = [];
    for (const item of parse(text).file.items) {
        if (item.kind === 'pair' && item.key.text === key && item.value?.kind === 'scalar') {
            values.push(item.value.value);
        }
    }
    return values;
}

function count(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
}

/** The packs of an install folder, by a `pack-layer` row. */
function packsOf(
    folder: InstallFolder,
    rule: PackLayerRule,
): { layer: string; folder: string; descriptor: string }[] {
    const root = diskPath(folder.dir, rule.folder);
    if (!existsSync(root) || !statSync(root).isDirectory()) {
        return [];
    }
    const out: { layer: string; folder: string; descriptor: string }[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }
        const dir = path.join(root, entry.name);
        for (const name of readdirSync(dir).sort()) {
            if (extensionOf(name) !== rule.descriptor_extension.toLowerCase()) {
                continue;
            }
            const text = decodeScript(readFileSync(path.join(dir, name))).text;
            const [packPath] = descriptorValues(text, rule.path_key);
            if (packPath !== undefined && packPath !== '') {
                const packFolder = segmentsOf(packPath.replaceAll('\\', '/')).join('/');
                out.push({
                    layer: `dlc:${fileNameOf(packFolder)}`,
                    folder: packFolder,
                    descriptor: `${rule.folder}/${entry.name}/${name}`,
                });
            }
        }
    }
    return out.sort((a, b) => (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0));
}

/**
 * The files of the install's folders to index, by the spec's folders and the table's rows
 * that decide on the platform (`decidingRules`: a `pack-layer` row puts a DLC's files at their
 * path inside the pack).
 */
export function listInstall(
    install: readonly InstallFolder[],
    folders: FolderTable,
    rules: readonly Rule[],
): SourceListing {
    return drain(listInstallSteps(install, folders, rules));
}

/** `listInstall` in steps (`steps.ts`): a pause after each file. */
export function* listInstallSteps(
    install: readonly InstallFolder[],
    folders: FolderTable,
    rules: readonly Rule[],
): Steps<SourceListing> {
    const listing: SourceListing = {
        files: [],
        notDescribed: new Map(),
        notRead: new Map(),
        packs: [],
    };
    for (const folder of install) {
        const packRule = rules.find(
            (r): r is PackLayerRule => r.kind === 'pack-layer' && r.layer === folder.layer,
        );
        const packs = packRule === undefined ? [] : packsOf(folder, packRule);
        listing.packs.push(...packs.map((p) => ({ layer: p.layer, folder: p.folder })));
        const descriptors = new Set(packs.map((p) => p.descriptor));
        for (const rel of walkFiles(folder.dir)) {
            if (descriptors.has(rel)) {
                continue;
            }
            const pack = packs.find((p) => isWithin(rel, p.folder));
            const layer = pack?.layer ?? folder.layer;
            const inside = pack === undefined ? rel : rel.slice(pack.folder.length + 1);
            addSource(listing, folders, layer, inside, diskPath(folder.dir, rel));
            yield;
        }
    }
    return listing;
}

function addSource(
    listing: SourceListing,
    folders: FolderTable,
    layer: string,
    rel: string,
    disk: string,
): void {
    if (fileKindOf(rel) === undefined) {
        count(listing.notRead, extensionOf(rel) === '' ? '(none)' : extensionOf(rel));
        return;
    }
    if (folders.classify(rel) === undefined) {
        count(listing.notDescribed, folders.undescribedFolder(rel));
        return;
    }
    const stat = statSync(disk);
    listing.files.push({ layer, path: rel, disk, size: stat.size, mtimeMs: stat.mtimeMs });
}

/**
 * The key a mod's descriptor uses for a path it replaces (docs/overrides.md, rule 8). The index
 * records each value as written; what it hides is the rules table's `replace-path` row.
 */
export const REPLACE_PATH_KEY = 'replace_path';

/** A mod folder: its descriptor's `replace_path` values and the files to index. */
export interface ModListing extends SourceListing {
    readonly replacePaths: readonly string[];
    readonly descriptor: boolean;
}

/** The files of a mod folder to index, each relative to the mod's own folder. */
export function listMod(modDir: string, folders: FolderTable): ModListing {
    const listing: SourceListing = {
        files: [],
        notDescribed: new Map(),
        notRead: new Map(),
        packs: [],
    };
    let replacePaths: string[] = [];
    let descriptor = false;
    for (const rel of walkFiles(modDir)) {
        if (rel === 'descriptor.mod') {
            descriptor = true;
            const text = decodeScript(readFileSync(diskPath(modDir, rel))).text;
            replacePaths = descriptorValues(text, REPLACE_PATH_KEY);
            continue;
        }
        addSource(listing, folders, 'mod', rel, diskPath(modDir, rel));
    }
    return { ...listing, replacePaths, descriptor };
}

/** The text files of a mod that may name a localization key the index cannot see used. */
export const UNREAD_TEXT_EXTENSIONS: readonly string[] = ['.gui', '.txt', '.yml', '.asset'];

const WORD = /[A-Za-z0-9_][A-Za-z0-9_.-]*/g;

/**
 * Every word of the mod's text files the index does not read: its interface files (`.gui`,
 * read by no step before 10), and `.txt`, `.yml` and `.asset` files of folders the spec does
 * not describe (`data_binding/`, a stray folder). A word is a run of letters, digits, `_`,
 * `.` and `-`, wherever it stands: inside quotes, inside a data-binding expression
 * (`[Localize('key')]`), in a comment too, since what such a file does with it is not read.
 * Used by `localization/unused-key`, which must not call a key unused that an interface file
 * shows.
 */
export function unreadWords(modDir: string, index: WorkspaceIndex): Set<string> {
    const out = new Set<string>();
    for (const rel of walkFiles(modDir)) {
        if (
            !UNREAD_TEXT_EXTENSIONS.includes(extensionOf(rel)) ||
            index.getFile('mod', rel) !== undefined
        ) {
            continue;
        }
        for (const match of decodeScript(readFileSync(diskPath(modDir, rel))).text.matchAll(WORD)) {
            out.add(match[0]);
        }
    }
    return out;
}

/**
 * The manifest of the files an index reads: one line per file, its layer, relative path,
 * size and modification time, sorted; and its SHA-256. A patch that changes a file changes
 * its size or time, so the cache keyed by it is rebuilt.
 */
export function sourceManifestSha256(files: readonly SourceFile[]): string {
    const lines = files
        .map((f) => `${f.layer}\t${f.path}\t${String(f.size)}\t${String(Math.trunc(f.mtimeMs))}\n`)
        .sort();
    return createHash('sha256').update(lines.join('')).digest('hex');
}

/** Read every listed file into an index (created, or given). */
export function indexFiles(
    files: readonly SourceFile[],
    target: WorkspaceIndex | IndexOptions,
): WorkspaceIndex {
    return drain(indexFilesSteps(files, target));
}

/** `indexFiles` in steps (`steps.ts`): a pause after each file. */
export function* indexFilesSteps(
    files: readonly SourceFile[],
    target: WorkspaceIndex | IndexOptions,
): Steps<WorkspaceIndex> {
    const index = target instanceof WorkspaceIndex ? target : new WorkspaceIndex(target);
    for (const file of files) {
        index.addFile(file.layer, file.path, readFileSync(file.disk));
        yield;
    }
    return index;
}

/** Index a mod over an index of the base game: its files, and its `replace_path` values. */
export function indexMod(index: WorkspaceIndex, modDir: string): ModListing {
    return drain(indexModSteps(index, modDir));
}

/** `indexMod` in steps (`steps.ts`): a pause after each file. */
export function* indexModSteps(index: WorkspaceIndex, modDir: string): Steps<ModListing> {
    const listing = listMod(modDir, index.folders);
    yield* indexFilesSteps(listing.files, index);
    index.setReplacePaths(listing.replacePaths);
    return listing;
}

/** A mod's listing as `syncMod` took it, and when. */
export interface SyncedMod extends ModListing {
    /** The clock (`Date.now()`) just before the folder was listed. */
    readonly listedAt: number;
    /**
     * Whether this sync changed the index: a file read again or removed, or the `replace_path`
     * values set again. False means the index answers as it did after the previous sync.
     */
    readonly changed: boolean;
}

/**
 * How close to a listing a file's modification time must be for the file to be read again
 * at the next sync even when its size and time look unchanged: a file system's clock can be
 * coarse (two seconds on FAT), so a second write within the same tick as the listing keeps the
 * time the listing saw.
 */
const RACY_MS = 2_000;

/**
 * Bring a mod indexed earlier (`previous`, what this returned before) up to date with its
 * folder as it is now, for a server that keeps one index between requests: a file that is new,
 * whose size or modification time changed, or that was written so close to the previous
 * listing that a change might not show in its time (`RACY_MS`), is read again; a file no longer
 * listed is removed; the descriptor's `replace_path` values are set again. The index then
 * answers as one the mod was freshly indexed into (`indexMod`). Without `previous`, every file
 * is read.
 */
export function syncMod(
    index: WorkspaceIndex,
    modDir: string,
    previous: SyncedMod | null,
): SyncedMod {
    return drain(syncModSteps(index, modDir, previous));
}

/** `syncMod` in steps (`steps.ts`): a pause after each file read again. */
export function* syncModSteps(
    index: WorkspaceIndex,
    modDir: string,
    previous: SyncedMod | null,
): Steps<SyncedMod> {
    const listedAt = Date.now();
    const listing = listMod(modDir, index.folders);
    const before = new Map((previous?.files ?? []).map((f) => [f.path, f]));
    const now = new Set(listing.files.map((f) => f.path));
    let removed = 0;
    for (const file of previous?.files ?? []) {
        if (!now.has(file.path)) {
            index.removeFile(file.layer, file.path);
            removed++;
        }
    }
    const changed = listing.files.filter((f) => {
        const old = before.get(f.path);
        return (
            previous === null ||
            old === undefined ||
            old.size !== f.size ||
            old.mtimeMs !== f.mtimeMs ||
            f.mtimeMs >= previous.listedAt - RACY_MS
        );
    });
    yield* indexFilesSteps(changed, index);
    const replaced =
        previous === null ||
        previous.replacePaths.length !== listing.replacePaths.length ||
        previous.replacePaths.some((p, i) => p !== listing.replacePaths[i]);
    if (replaced) {
        index.setReplacePaths(listing.replacePaths);
    }
    return { ...listing, listedAt, changed: replaced || removed > 0 || changed.length > 0 };
}
