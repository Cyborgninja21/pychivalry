/**
 * The workspace index (docs/PLAN.md step 3): every definition and every use in the files it is
 * given, each with the layer it came from (the install's `clausewitz`, `jomini` and `game`
 * folders, a DLC pack `dlc:<pack>`, the `mod`), its file's relative path and its place in the
 * file; and what the rules table says is in force.
 *
 * It is neutral by default (item 3.6). It records every definition, and names a winner only
 * where a row of the rules table answers the question for that database, form and platform.
 * Where none does, the answer is `unknown`: defined more than once, winner not known, with the
 * reasons. Nothing is guessed, and adding a row changes the answer with no change here.
 *
 * Storage is packed: names are interned, and a file's definitions and uses are integer arrays
 * (`DEF` and `USE_STRIDE` in extract.ts), so the whole base game fits in memory and in the
 * on-disk cache (cache.ts).
 */

import { createHash } from 'node:crypto';
import type { FallbackEncoding } from '../syntax/decode.js';
import { parse } from '../syntax/parser.js';
import type { Position, Range } from '../syntax/position.js';
import { readScript } from '../syntax/read.js';
import {
    DEF,
    DEF_STRIDE,
    extractLocalization,
    extractScript,
    formOf,
    NONE,
    USE_STRIDE,
    type Extracted,
} from './extract.js';
import type { FolderTable } from './folders.js';
import { parseLocalization, readLocalization } from './localization.js';
import { compareFiles, layerMatches } from './order.js';
import {
    extensionOf,
    fileNameOf,
    foldCase,
    isWithin,
    parentOf,
    PathTable,
    segmentsOf,
} from './paths.js';
import {
    databaseMatches,
    rulesFor,
    type ContainersRule,
    type FileOrderRule,
    type Form,
    type KeyResolutionRule,
    type Platform,
    type Rule,
    type RulesTable,
} from './rules.js';
import { StringTable } from './strings.js';

/** Which files the index reads: script files and localization files. */
export type FileKind = 'script' | 'localization';

/** The kind of a file from its extension, or undefined when the index does not read it. */
export function fileKindOf(relative: string): FileKind | undefined {
    const extension = extensionOf(relative);
    if (extension === '.txt') {
        return 'script';
    }
    if (extension === '.yml') {
        return 'localization';
    }
    return undefined;
}

export interface IndexOptions {
    readonly folders: FolderTable;
    readonly rules: RulesTable;
    /** The platform whose rules apply; undefined, none do and nothing has a winner. */
    readonly platform: Platform | undefined;
    /** Passed to the decoder for files that are not valid UTF-8 (docs/encoding.md). */
    readonly fallbackEncoding?: FallbackEncoding | undefined;
}

/** One indexed file, as stored. */
interface FileEntry {
    readonly id: number;
    readonly layer: string;
    readonly path: string;
    readonly kind: FileKind;
    /** The spec folder that holds it, or null. */
    readonly folder: string | null;
    readonly exactCase: boolean;
    readonly lineStarts: Int32Array;
    readonly defs: Int32Array;
    readonly uses: Int32Array;
    /** The names it uses, sorted, each once. */
    readonly names: Int32Array;
}

/** Everything the cache stores of an index. */
export interface IndexState {
    readonly strings: readonly string[];
    readonly files: readonly {
        readonly layer: string;
        readonly path: string;
        readonly kind: FileKind;
        readonly folder: string | null;
        readonly exactCase: boolean;
        readonly lineStarts: Int32Array;
        readonly defs: Int32Array;
        readonly uses: Int32Array;
        readonly names: Int32Array;
    }[];
    readonly replacePaths: readonly string[];
}

/** A file of the index, as callers see it. */
export interface IndexedFile {
    readonly layer: string;
    readonly path: string;
    readonly kind: FileKind;
    /** The spec folder that holds it, or null when the spec describes none. */
    readonly folder: string | null;
    /** False when its path writes that folder in other letter case than the spec. */
    readonly exactCase: boolean;
    readonly lines: number;
    readonly definitions: number;
    readonly uses: number;
}

/** A question about a file that no row of the rules table answers. */
export type FileQuestion =
    | {
          /** Another layer has a file at the same path (or one differing only in case). */
          readonly kind: 'same-path';
          readonly other: { readonly layer: string; readonly path: string };
          readonly caseDiffers: boolean;
      }
    | {
          /** The path writes its spec folder in other letter case. */
          readonly kind: 'path-case';
          readonly folder: string;
      }
    | {
          /** The mod's descriptor names this path in `replace_path`. */
          readonly kind: 'replace-path';
          readonly path: string;
      }
    | {
          /** Another file has the same name in another folder, and no row says paths identify files. */
          readonly kind: 'file-identity';
          readonly other: { readonly layer: string; readonly path: string };
      };

/** Whether the game reads a file, as far as the rules table says. */
export interface FileStatus {
    /** `yes`; `no`, when a row hides or replaces it; `unknown`, when a question is open. */
    readonly read: 'yes' | 'no' | 'unknown';
    /** The file that replaces it, and the row that says so. */
    readonly replacedBy: {
        readonly layer: string;
        readonly path: string;
        readonly rule: string;
    } | null;
    /** The `replace_path` that hides it, and the row that says so. */
    readonly hiddenBy: { readonly path: string; readonly rule: string } | null;
    /** Why the folder is not read: a `path-case` row that compares paths exactly. */
    readonly notReadBecause: { readonly rule: string } | null;
    readonly questions: readonly FileQuestion[];
}

/** One definition. */
export interface Definition {
    readonly name: string;
    readonly database: string;
    readonly form: Form;
    /** The container key, for an entry; otherwise null. */
    readonly container: string | null;
    /** The word before the key, for a prefixed definition; otherwise null. */
    readonly prefix: string | null;
    readonly layer: string;
    readonly file: string;
    /** The key's offsets and range in the file. */
    readonly start: number;
    readonly end: number;
    readonly range: Range;
    /** Where what it defines ends: the end of the pair, or of the localization line. */
    readonly extentEnd: number;
    /** The value of the field a priority rule names, or its default; null when no rule names one. */
    readonly priority: number | null;
    /** A localization entry's version number, or null. */
    readonly version: number | null;
    /** Whether the game reads the file it is in (`FileStatus.read`). */
    readonly read: FileStatus['read'];
}

/** One use of a name. */
export interface Use {
    readonly name: string;
    readonly layer: string;
    readonly file: string;
    readonly start: number;
    readonly end: number;
    readonly range: Range;
    readonly read: FileStatus['read'];
}

/** Why no winner can be named. */
export type UnknownReason =
    | {
          /** No row of the table answers for this database and form. */
          readonly kind: 'no-rule';
          readonly database: string;
          readonly forms: readonly Form[];
      }
    | {
          /** The row needs the order files are read in, and no `file-order` row gives it. */
          readonly kind: 'no-order';
          readonly database: string;
          readonly rule: string;
      }
    | {
          /** Whether the game reads a file that holds a definition is not known. */
          readonly kind: 'file-unknown';
          readonly layer: string;
          readonly file: string;
          readonly questions: readonly FileQuestion[];
      };

/** What is in force for one name of one database. */
export type Resolution =
    | { readonly status: 'not-defined'; readonly definitions: readonly Definition[] }
    | {
          /** One definition is read: it is the one in force. */
          readonly status: 'single';
          readonly definitions: readonly Definition[];
          readonly winner: Definition;
      }
    | {
          /** A row names the winner. */
          readonly status: 'winner';
          readonly definitions: readonly Definition[];
          readonly winner: Definition;
          readonly combine: 'whole' | 'fields' | 'partial';
          readonly rule: string;
      }
    | {
          /** A row says every definition adds to the result. */
          readonly status: 'all';
          readonly definitions: readonly Definition[];
          readonly rule: string;
      }
    | {
          /** A row says the folder is not keyed: every definition is a statement, all read. */
          readonly status: 'statements';
          readonly definitions: readonly Definition[];
          readonly rule: string;
      }
    | {
          /** A row says the definitions clash: the game calls it an error, and names none. */
          readonly status: 'clash';
          readonly definitions: readonly Definition[];
          readonly rule: string;
      }
    | {
          /** Every definition is in a file the game does not read. */
          readonly status: 'not-read';
          readonly definitions: readonly Definition[];
      }
    | {
          /** Defined more than once, winner not known. */
          readonly status: 'unknown';
          readonly definitions: readonly Definition[];
          readonly reasons: readonly UnknownReason[];
      };

/** One name of one database with more than one definition. */
export interface DefinitionGroup {
    readonly database: string;
    readonly container: string | null;
    readonly name: string;
    readonly count: number;
}

/** What changed when a file was set or removed (docs/PLAN.md item 3.7). */
export interface UpdateResult {
    readonly file: IndexedFile | null;
    /** The names the file defined before the change or defines after it. */
    readonly names: readonly string[];
    /** The other files that use one of those names, or a name of a file whose status changed. */
    readonly dependents: readonly IndexedFile[];
}

/** A definition handle: file id and index, in one number. */
const SPAN = 2 ** 22;

const LAYER_SORT = ['clausewitz', 'jomini', 'game', 'dlc', 'mod'];

function layerSortKey(layer: string): number {
    const kind = layer.startsWith('dlc:') ? 'dlc' : layer;
    const at = LAYER_SORT.indexOf(kind);
    return at < 0 ? LAYER_SORT.length : at;
}

function positionIn(lineStarts: Int32Array, offset: number): Position {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if ((lineStarts[mid] ?? 0) <= offset) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return { line: low, character: offset - (lineStarts[low] ?? 0) };
}

function sortedUnique(values: Iterable<number>): Int32Array {
    const out = Int32Array.from(new Set(values));
    out.sort();
    return out;
}

function containsSorted(sorted: Int32Array, value: number): boolean {
    let low = 0;
    let high = sorted.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const at = sorted[mid] ?? 0;
        if (at === value) {
            return true;
        }
        if (at < value) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return false;
}

/** Pack the uses of a file sorted by where each starts. */
function packUses(uses: readonly number[]): Int32Array {
    const count = uses.length / USE_STRIDE;
    const order = Array.from({ length: count }, (_, i) => i);
    order.sort((a, b) => (uses[a * USE_STRIDE + 1] ?? 0) - (uses[b * USE_STRIDE + 1] ?? 0));
    const out = new Int32Array(uses.length);
    order.forEach((from, to) => {
        out[to * USE_STRIDE] = uses[from * USE_STRIDE] ?? 0;
        out[to * USE_STRIDE + 1] = uses[from * USE_STRIDE + 1] ?? 0;
    });
    return out;
}

const NOT_YET: FileStatus = {
    read: 'yes',
    replacedBy: null,
    hiddenBy: null,
    notReadBecause: null,
    questions: [],
};

export class WorkspaceIndex {
    readonly folders: FolderTable;
    readonly table: RulesTable;
    readonly platform: Platform | undefined;
    /** The rows that hold on the index's platform. */
    readonly rules: readonly Rule[];
    private readonly fallbackEncoding: FallbackEncoding | undefined;
    private readonly strings: StringTable;
    private readonly files: (FileEntry | undefined)[] = [];
    private readonly byKey = new Map<string, number>();
    private readonly paths = new PathTable<number>();
    private readonly byName = new Map<number, number[]>();
    private replacePaths: string[] = [];
    private statuses: FileStatus[] | null = null;

    constructor(options: IndexOptions, strings = new StringTable()) {
        this.folders = options.folders;
        this.table = options.rules;
        this.platform = options.platform;
        this.rules =
            options.platform === undefined ? [] : rulesFor(options.rules, options.platform);
        this.fallbackEncoding = options.fallbackEncoding;
        this.strings = strings;
    }

    /** An index holding a cached state (cache.ts). */
    static fromState(state: IndexState, options: IndexOptions): WorkspaceIndex {
        const index = new WorkspaceIndex(options, StringTable.from(state.strings));
        for (const file of state.files) {
            index.store(file);
        }
        index.replacePaths = [...state.replacePaths];
        return index;
    }

    /** Everything the cache stores. */
    state(): IndexState {
        return {
            strings: this.strings.all(),
            files: this.files.filter((f): f is FileEntry => f !== undefined),
            replacePaths: this.replacePaths,
        };
    }

    // ─── Adding, changing and removing files ───────────────────────────────

    /**
     * Add a file, or replace the one already at that layer and path, from its bytes or from
     * text an editor holds. The file's kind comes from its extension and its database from
     * the spec folder that holds its path; a file in no listed folder is read for its uses
     * only. Returns what changed, with the files that use the names it defines (item 3.7).
     */
    setFile(layer: string, path: string, content: Uint8Array | string): UpdateResult {
        const entry = this.read(path, layer, content);
        if (entry === undefined) {
            return { file: null, names: [], dependents: [] };
        }
        const before = this.byKey.get(`${layer}\u0000${path}`);
        const oldNames = before === undefined ? [] : this.definedNames(before);
        const neighbours = this.neighboursOf(path);
        if (before !== undefined) {
            this.unstore(before);
        }
        const id = this.store(entry);
        const names = new Set([...oldNames, ...this.definedNames(id)]);
        for (const other of neighbours) {
            if (other !== id) {
                for (const name of this.definedNames(other)) {
                    names.add(name);
                }
            }
        }
        return {
            file: this.view(id),
            names: [...names].map((n) => this.strings.get(n)).sort(),
            dependents: this.usersOf(names, id),
        };
    }

    /**
     * Add a file, or replace the one at that layer and path, without working out what depends
     * on it: how a whole game or mod is loaded. True when the index reads files of its kind.
     */
    addFile(layer: string, path: string, content: Uint8Array | string): boolean {
        const entry = this.read(path, layer, content);
        if (entry === undefined) {
            return false;
        }
        const before = this.byKey.get(`${layer}\u0000${path}`);
        if (before !== undefined) {
            this.unstore(before);
        }
        this.store(entry);
        return true;
    }

    /** Decode, parse and extract one file. */
    private read(
        path: string,
        layer: string,
        content: Uint8Array | string,
    ): Omit<FileEntry, 'id'> | undefined {
        const kind = fileKindOf(path);
        if (kind === undefined) {
            return undefined;
        }
        const match = this.folders.classify(path);
        const folder = match?.folder.path ?? null;
        let extracted: Extracted;
        let lineStarts: readonly number[];
        if (kind === 'script') {
            const parsed =
                typeof content === 'string'
                    ? parse(content)
                    : readScript(content, { fallbackEncoding: this.fallbackEncoding });
            extracted = extractScript(parsed.file, {
                strings: this.strings,
                database: folder,
                containers: folder === null ? null : this.containersFor(folder),
                priority: folder === null ? null : this.priorityFor(folder),
            });
            lineStarts = parsed.lines.lineStarts;
        } else {
            const loc =
                typeof content === 'string'
                    ? parseLocalization(content)
                    : readLocalization(content, { fallbackEncoding: this.fallbackEncoding });
            const all = extractLocalization(loc, this.strings);
            extracted = folder === null ? { defs: [], uses: all.uses } : all;
            lineStarts = loc.lines.lineStarts;
        }
        return {
            layer,
            path,
            kind,
            folder,
            exactCase: match?.exactCase ?? true,
            lineStarts: Int32Array.from(lineStarts),
            defs: Int32Array.from(extracted.defs),
            uses: packUses(extracted.uses),
            names: sortedUnique(this.useNames(extracted.uses)),
        };
    }

    /** Remove a file; returns what changed, as `setFile` does. */
    removeFile(layer: string, path: string): UpdateResult {
        const id = this.byKey.get(`${layer}\u0000${path}`);
        if (id === undefined) {
            return { file: null, names: [], dependents: [] };
        }
        const names = new Set(this.definedNames(id));
        for (const other of this.neighboursOf(path)) {
            if (other !== id) {
                for (const name of this.definedNames(other)) {
                    names.add(name);
                }
            }
        }
        this.unstore(id);
        return {
            file: null,
            names: [...names].map((n) => this.strings.get(n)).sort(),
            dependents: this.usersOf(names, -1),
        };
    }

    /** The mod's `replace_path` values, from its descriptor (docs/overrides.md, rule 8). */
    setReplacePaths(paths: readonly string[]): void {
        this.replacePaths = paths.map((p) => segmentsOf(p.replaceAll('\\', '/')).join('/'));
        this.statuses = null;
    }

    getReplacePaths(): readonly string[] {
        return this.replacePaths;
    }

    private store(file: Omit<FileEntry, 'id'>): number {
        const id = this.files.length;
        const entry: FileEntry = { ...file, id };
        this.files.push(entry);
        this.byKey.set(`${file.layer}\u0000${file.path}`, id);
        this.paths.add(file.path, id);
        for (let i = 0; i * DEF_STRIDE < file.defs.length; i++) {
            const name = file.defs[i * DEF_STRIDE + DEF.name] ?? 0;
            const handles = this.byName.get(name);
            if (handles === undefined) {
                this.byName.set(name, [id * SPAN + i]);
            } else {
                handles.push(id * SPAN + i);
            }
        }
        this.statuses = null;
        return id;
    }

    private unstore(id: number): void {
        const file = this.files[id];
        if (file === undefined) {
            return;
        }
        for (const name of new Set(this.definedNames(id))) {
            const handles = this.byName.get(name)?.filter((h) => Math.floor(h / SPAN) !== id) ?? [];
            if (handles.length === 0) {
                this.byName.delete(name);
            } else {
                this.byName.set(name, handles);
            }
        }
        this.files[id] = undefined;
        this.byKey.delete(`${file.layer}\u0000${file.path}`);
        this.paths.remove(file.path, id);
        this.statuses = null;
    }

    private *useNames(uses: readonly number[]): Generator<number> {
        for (let i = 0; i < uses.length; i += USE_STRIDE) {
            yield uses[i] ?? 0;
        }
    }

    private definedNames(id: number): number[] {
        const defs = this.files[id]?.defs;
        const out: number[] = [];
        if (defs !== undefined) {
            for (let i = DEF.name; i < defs.length; i += DEF_STRIDE) {
                out.push(defs[i] ?? 0);
            }
        }
        return out;
    }

    /** The files that share a folded path with `path`: their status may change with it. */
    private neighboursOf(path: string): number[] {
        const out = this.paths.find(path).map((entry) => entry.value);
        if (!this.rules.some((r) => r.kind === 'file-identity')) {
            const name = foldCase(fileNameOf(path));
            for (const [i, file] of this.files.entries()) {
                if (file !== undefined && foldCase(fileNameOf(file.path)) === name) {
                    out.push(i);
                }
            }
        }
        return out;
    }

    private usersOf(names: ReadonlySet<number>, except: number): IndexedFile[] {
        const out: IndexedFile[] = [];
        for (const file of this.files) {
            if (file === undefined || file.id === except) {
                continue;
            }
            for (const name of names) {
                if (containsSorted(file.names, name)) {
                    out.push(this.view(file.id));
                    break;
                }
            }
        }
        return out.sort(compareIndexed);
    }

    // ─── What the rules say about a database ──────────────────────────────

    private containersRule(database: string, key: string | null): ContainersRule | undefined {
        return this.rules.find(
            (r): r is ContainersRule =>
                r.kind === 'containers' &&
                r.databases.some((d) => databaseMatches(d, database)) &&
                (key === null || r.keys.includes('*') || r.keys.includes(key)),
        );
    }

    private containersFor(database: string): ReadonlySet<string> | 'all' | null {
        const rows = this.rules.filter(
            (r): r is ContainersRule =>
                r.kind === 'containers' && r.databases.some((d) => databaseMatches(d, database)),
        );
        if (rows.length === 0) {
            return null;
        }
        if (rows.some((r) => r.keys.includes('*'))) {
            return 'all';
        }
        return new Set(rows.flatMap((r) => r.keys));
    }

    private keyRule(database: string, forms: readonly Form[]): KeyResolutionRule | undefined {
        return this.rules.find(
            (r): r is KeyResolutionRule =>
                r.kind === 'key-resolution' &&
                r.databases.some((d) => databaseMatches(d, database)) &&
                forms.every((f) => r.forms === undefined || r.forms.includes(f)),
        );
    }

    private priorityFor(database: string): { field: string; fallback: number } | null {
        const rule = this.keyRule(database, ['record']);
        if (rule?.resolve !== 'priority' || rule.priority_field === undefined) {
            return null;
        }
        return { field: rule.priority_field, fallback: rule.priority_default ?? 0 };
    }

    private orderRule(database: string): FileOrderRule | undefined {
        return this.rules.find(
            (r): r is FileOrderRule =>
                r.kind === 'file-order' &&
                (r.databases === undefined ||
                    r.databases.some((d) => databaseMatches(d, database))),
        );
    }

    // ─── Whether each file is read ─────────────────────────────────────────

    private computeStatuses(): FileStatus[] {
        const questions: FileQuestion[][] = this.files.map(() => []);
        const replaced: (FileStatus['replacedBy'] | null)[] = this.files.map(() => null);
        const hidden: (FileStatus['hiddenBy'] | null)[] = this.files.map(() => null);
        const notRead: (FileStatus['notReadBecause'] | null)[] = this.files.map(() => null);
        const pathCase = this.rules.find((r) => r.kind === 'path-case');
        const live = this.files.filter((f): f is FileEntry => f !== undefined);
        // A spec folder spelled in other letter case (rule 9).
        for (const file of live) {
            if (file.folder !== null && !file.exactCase) {
                if (pathCase === undefined) {
                    questions[file.id]?.push({ kind: 'path-case', folder: file.folder });
                } else if (pathCase.compare === 'exact') {
                    notRead[file.id] = { rule: pathCase.id };
                }
            }
        }
        // The same path in two places (rules 1, 3, 9 and 10).
        const replaceRules = this.rules.filter((r) => r.kind === 'file-replace');
        const replaces = (a: FileEntry, b: FileEntry): string | undefined =>
            replaceRules.find(
                (r) =>
                    layerMatches(r.layer, a.layer) && r.over.some((o) => layerMatches(o, b.layer)),
            )?.id;
        for (const group of this.paths.groups()) {
            if (group.length < 2) {
                continue;
            }
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const a = this.files[group[i]?.value ?? -1];
                    const b = this.files[group[j]?.value ?? -1];
                    if (a === undefined || b === undefined) {
                        continue;
                    }
                    const caseDiffers = a.path !== b.path;
                    if (caseDiffers && pathCase?.compare === 'exact') {
                        continue;
                    }
                    const sameLayer = a.layer === b.layer;
                    const ab = caseDiffers && pathCase === undefined ? undefined : replaces(a, b);
                    const ba = caseDiffers && pathCase === undefined ? undefined : replaces(b, a);
                    if (!sameLayer && ab !== undefined && ba === undefined) {
                        replaced[b.id] = { layer: a.layer, path: a.path, rule: ab };
                    } else if (!sameLayer && ba !== undefined && ab === undefined) {
                        replaced[a.id] = { layer: b.layer, path: b.path, rule: ba };
                    } else {
                        questions[a.id]?.push({
                            kind: 'same-path',
                            other: { layer: b.layer, path: b.path },
                            caseDiffers,
                        });
                        questions[b.id]?.push({
                            kind: 'same-path',
                            other: { layer: a.layer, path: a.path },
                            caseDiffers,
                        });
                    }
                }
            }
        }
        // Two files of one name in different folders, with no row on what identifies a file.
        if (!this.rules.some((r) => r.kind === 'file-identity')) {
            const byName = new Map<string, FileEntry[]>();
            for (const file of live) {
                if (file.folder === null) {
                    continue;
                }
                const key = foldCase(fileNameOf(file.path));
                byName.set(key, [...(byName.get(key) ?? []), file]);
            }
            for (const same of byName.values()) {
                for (const a of same) {
                    for (const b of same) {
                        if (foldCase(parentOf(a.path)) !== foldCase(parentOf(b.path))) {
                            questions[a.id]?.push({
                                kind: 'file-identity',
                                other: { layer: b.layer, path: b.path },
                            });
                        }
                    }
                }
            }
        }
        // `replace_path` in the mod's descriptor (rule 8).
        const replacePath = this.rules.find((r) => r.kind === 'replace-path');
        for (const hiddenPath of this.replacePaths) {
            for (const file of live) {
                if (file.layer === 'mod' || !isWithin(file.path, hiddenPath, true)) {
                    continue;
                }
                const direct = foldCase(parentOf(file.path)) === foldCase(hiddenPath);
                if (replacePath === undefined) {
                    questions[file.id]?.push({ kind: 'replace-path', path: hiddenPath });
                } else if (
                    replacePath.hides.some((layer) => layerMatches(layer, file.layer)) &&
                    (replacePath.subfolders || direct)
                ) {
                    hidden[file.id] = { path: hiddenPath, rule: replacePath.id };
                }
            }
        }
        return this.files.map((file, id) => {
            if (file === undefined) {
                return NOT_YET;
            }
            const replacedBy = replaced[id] ?? null;
            const hiddenBy = hidden[id] ?? null;
            const notReadBecause = notRead[id] ?? null;
            const open = questions[id] ?? [];
            const read =
                replacedBy !== null || hiddenBy !== null || notReadBecause !== null
                    ? 'no'
                    : open.length > 0
                      ? 'unknown'
                      : 'yes';
            return { read, replacedBy, hiddenBy, notReadBecause, questions: open };
        });
    }

    private statusOf(id: number): FileStatus {
        this.statuses ??= this.computeStatuses();
        return this.statuses[id] ?? NOT_YET;
    }

    /** Whether the game reads the file at a layer and path, as far as the table says. */
    fileStatus(layer: string, path: string): FileStatus | undefined {
        const id = this.byKey.get(`${layer}\u0000${path}`);
        return id === undefined ? undefined : this.statusOf(id);
    }

    // ─── Files ────────────────────────────────────────────────────────────

    private view(id: number): IndexedFile {
        const file = this.files[id];
        if (file === undefined) {
            throw new RangeError(`no file ${String(id)}`);
        }
        return {
            layer: file.layer,
            path: file.path,
            kind: file.kind,
            folder: file.folder,
            exactCase: file.exactCase,
            lines: file.lineStarts.length,
            definitions: file.defs.length / DEF_STRIDE,
            uses: file.uses.length / USE_STRIDE,
        };
    }

    /** Every indexed file, sorted by layer and path. */
    allFiles(): IndexedFile[] {
        return this.files
            .filter((f): f is FileEntry => f !== undefined)
            .map((f) => this.view(f.id))
            .sort(compareIndexed);
    }

    /** The files at a relative path in any layer, found without regard to letter case. */
    findFiles(path: string): IndexedFile[] {
        return this.paths
            .find(segmentsOf(path.replaceAll('\\', '/')).join('/'))
            .map((entry) => this.view(entry.value))
            .sort(compareIndexed);
    }

    /** The file at a layer and exact path. */
    getFile(layer: string, path: string): IndexedFile | undefined {
        const id = this.byKey.get(`${layer}\u0000${path}`);
        return id === undefined ? undefined : this.view(id);
    }

    // ─── Definitions and what is in force ─────────────────────────────────

    private definition(handle: number): Definition {
        const id = Math.floor(handle / SPAN);
        const i = handle % SPAN;
        const file = this.files[id];
        if (file === undefined) {
            throw new RangeError(`no file ${String(id)}`);
        }
        const at = (field: number): number => file.defs[i * DEF_STRIDE + field] ?? 0;
        const container = at(DEF.container);
        const prefix = at(DEF.prefix);
        const extra = at(DEF.extra);
        const start = at(DEF.keyStart);
        const end = at(DEF.keyEnd);
        const form = formOf(at(DEF.form));
        return {
            name: this.strings.get(at(DEF.name)),
            database: this.strings.get(at(DEF.database)),
            form,
            container: container < 0 ? null : this.strings.get(container),
            prefix: prefix < 0 ? null : this.strings.get(prefix),
            layer: file.layer,
            file: file.path,
            start,
            end,
            range: {
                start: positionIn(file.lineStarts, start),
                end: positionIn(file.lineStarts, end),
            },
            extentEnd: at(DEF.end),
            priority: form === 'record' && extra !== NONE ? extra : null,
            version: form === 'key' && extra !== NONE ? extra : null,
            read: this.statusOf(id).read,
        };
    }

    private handlesOf(name: string): number[] {
        const id = this.strings.find(name);
        return id < 0 ? [] : (this.byName.get(id) ?? []);
    }

    /**
     * Every definition of a name, in any database, or only in one (and one container), sorted
     * by layer, path and place. The order is for reading, not the order the game reads them in.
     */
    definitions(
        name: string,
        filter: { readonly database?: string; readonly container?: string | null } = {},
    ): Definition[] {
        return this.handlesOf(name)
            .map((h) => this.definition(h))
            .filter(
                (d) =>
                    (filter.database === undefined || d.database === filter.database) &&
                    (filter.container === undefined || d.container === filter.container),
            )
            .sort(compareDefinitions);
    }

    /** What is in force for a name of a database (and a container, for entries). */
    resolve(database: string, name: string, container: string | null = null): Resolution {
        const definitions = this.definitions(name, { database, container });
        if (definitions.length === 0) {
            return { status: 'not-defined', definitions };
        }
        const live = definitions.filter((d) => d.read !== 'no');
        if (live.length === 0) {
            return { status: 'not-read', definitions };
        }
        const fileReasons = (): UnknownReason[] => {
            const seen = new Set<string>();
            const out: UnknownReason[] = [];
            for (const d of live) {
                const key = `${d.layer}\u0000${d.file}`;
                if (d.read === 'unknown' && !seen.has(key)) {
                    seen.add(key);
                    out.push({
                        kind: 'file-unknown',
                        layer: d.layer,
                        file: d.file,
                        questions: this.fileStatus(d.layer, d.file)?.questions ?? [],
                    });
                }
            }
            return out;
        };
        if (live.some((d) => d.read === 'unknown')) {
            return { status: 'unknown', definitions, reasons: fileReasons() };
        }
        if (live.length === 1) {
            const winner = live[0] as Definition;
            return { status: 'single', definitions, winner };
        }
        const forms = [...new Set(live.map((d) => d.form))];
        if (forms.length === 1 && forms[0] === 'container') {
            const rule = this.containersRule(database, name);
            if (rule !== undefined) {
                return { status: 'all', definitions, rule: rule.id };
            }
        }
        let pool = live;
        const folderWins = this.rules.find(
            (r) =>
                r.kind === 'folder-wins' && r.databases.some((d) => databaseMatches(d, database)),
        );
        if (folderWins?.kind === 'folder-wins') {
            const segment = foldCase(folderWins.segment);
            const inFolder = live.filter((d) =>
                segmentsOf(parentOf(d.file)).some((s) => foldCase(s) === segment),
            );
            if (inFolder.length === 1) {
                const winner = inFolder[0] as Definition;
                return {
                    status: 'winner',
                    definitions,
                    winner,
                    combine: 'whole',
                    rule: folderWins.id,
                };
            }
            if (inFolder.length > 1) {
                pool = inFolder;
            }
        }
        const rule = this.keyRule(database, forms);
        if (rule === undefined) {
            return {
                status: 'unknown',
                definitions,
                reasons: [{ kind: 'no-rule', database, forms: forms.sort() }],
            };
        }
        switch (rule.resolve) {
            case 'all':
                return { status: 'all', definitions, rule: rule.id };
            case 'statements':
                return { status: 'statements', definitions, rule: rule.id };
            case 'priority': {
                const value = (d: Definition): number => d.priority ?? rule.priority_default ?? 0;
                const top = Math.max(...pool.map(value));
                const best = pool.filter((d) => value(d) === top);
                if (best.length > 1) {
                    return { status: 'clash', definitions, rule: rule.id };
                }
                return {
                    status: 'winner',
                    definitions,
                    winner: best[0] as Definition,
                    combine: rule.combine ?? 'whole',
                    rule: rule.id,
                };
            }
            case 'later-wins':
            case 'earlier-wins': {
                const order = this.orderRule(database);
                if (order === undefined) {
                    return {
                        status: 'unknown',
                        definitions,
                        reasons: [{ kind: 'no-order', database, rule: rule.id }],
                    };
                }
                const where = (d: Definition): { layer: string; path: string } => ({
                    layer: d.layer,
                    path: d.file,
                });
                const unordered = pool.some((a, i) =>
                    pool
                        .slice(i + 1)
                        .some((b) => compareFiles(where(a), where(b), order) === undefined),
                );
                const sorted = [...pool].sort(
                    (a, b) => (compareFiles(where(a), where(b), order) ?? 0) || a.start - b.start,
                );
                if (unordered) {
                    return {
                        status: 'unknown',
                        definitions,
                        reasons: [{ kind: 'no-order', database, rule: order.id }],
                    };
                }
                const winner = (
                    rule.resolve === 'later-wins' ? sorted.at(-1) : sorted[0]
                ) as Definition;
                return {
                    status: 'winner',
                    definitions,
                    winner,
                    combine: rule.combine ?? 'whole',
                    rule: rule.id,
                };
            }
        }
    }

    /** Every name of every database that has more than one definition, in any file. */
    *groups(): Generator<DefinitionGroup> {
        for (const [name, handles] of this.byName) {
            if (handles.length < 2) {
                continue;
            }
            const counts = new Map<
                string,
                { database: number; container: number; count: number }
            >();
            for (const h of handles) {
                const file = this.files[Math.floor(h / SPAN)];
                const i = h % SPAN;
                if (file === undefined) {
                    continue;
                }
                const database = file.defs[i * DEF_STRIDE + DEF.database] ?? 0;
                const container = file.defs[i * DEF_STRIDE + DEF.container] ?? -1;
                const key = `${String(database)}:${String(container)}`;
                const entry = counts.get(key);
                if (entry === undefined) {
                    counts.set(key, { database, container, count: 1 });
                } else {
                    entry.count++;
                }
            }
            for (const entry of counts.values()) {
                if (entry.count > 1) {
                    yield {
                        database: this.strings.get(entry.database),
                        container: entry.container < 0 ? null : this.strings.get(entry.container),
                        name: this.strings.get(name),
                        count: entry.count,
                    };
                }
            }
        }
    }

    // ─── Uses ─────────────────────────────────────────────────────────────

    /** Every use of a name, sorted by layer, path and place (item 3.4). */
    references(name: string): Use[] {
        const id = this.strings.find(name);
        if (id < 0) {
            return [];
        }
        const out: Use[] = [];
        for (const file of this.files) {
            if (file === undefined || !containsSorted(file.names, id)) {
                continue;
            }
            const read = this.statusOf(file.id).read;
            for (let i = 0; i < file.uses.length; i += USE_STRIDE) {
                if (file.uses[i] === id) {
                    const start = file.uses[i + 1] ?? 0;
                    const end = start + name.length;
                    out.push({
                        name,
                        layer: file.layer,
                        file: file.path,
                        start,
                        end,
                        range: {
                            start: positionIn(file.lineStarts, start),
                            end: positionIn(file.lineStarts, end),
                        },
                        read,
                    });
                }
            }
        }
        return out.sort(
            (a, b) =>
                layerSortKey(a.layer) - layerSortKey(b.layer) ||
                compareStrings(a.layer, b.layer) ||
                compareStrings(a.file, b.file) ||
                a.start - b.start,
        );
    }

    /** Every name used anywhere, each once. */
    *usedNames(): Generator<string> {
        const seen = new Set<number>();
        for (const file of this.files) {
            if (file === undefined) {
                continue;
            }
            for (const name of file.names) {
                if (!seen.has(name)) {
                    seen.add(name);
                    yield this.strings.get(name);
                }
            }
        }
    }

    /** Every name defined anywhere, each once. */
    *definedNamesAll(): Generator<string> {
        for (const name of this.byName.keys()) {
            yield this.strings.get(name);
        }
    }

    // ─── Totals ───────────────────────────────────────────────────────────

    /** Counts over the whole index. */
    totals(): {
        files: number;
        definitions: number;
        uses: number;
        lines: number;
        names: number;
    } {
        let files = 0;
        let definitions = 0;
        let uses = 0;
        let lines = 0;
        for (const file of this.files) {
            if (file !== undefined) {
                files++;
                definitions += file.defs.length / DEF_STRIDE;
                uses += file.uses.length / USE_STRIDE;
                lines += file.lineStarts.length;
            }
        }
        return { files, definitions, uses, lines, names: this.strings.size };
    }

    /**
     * The uses of a defined name, per layer of the file the use is in: the references of
     * item 3.4. A use whose name nothing in the index defines is not counted.
     */
    usesOfDefinedNames(): Map<string, number> {
        const out = new Map<string, number>();
        for (const file of this.files) {
            if (file === undefined) {
                continue;
            }
            let n = 0;
            for (let i = 0; i < file.uses.length; i += USE_STRIDE) {
                if (this.byName.has(file.uses[i] ?? -1)) {
                    n++;
                }
            }
            out.set(file.layer, (out.get(file.layer) ?? 0) + n);
        }
        return out;
    }

    /** The definitions of each file, by form, for a report: callback per file and definition. */
    forEachDefinition(visit: (file: IndexedFile, form: Form, database: string) => void): void {
        for (const file of this.files) {
            if (file === undefined) {
                continue;
            }
            const view = this.view(file.id);
            for (let i = 0; i < file.defs.length; i += DEF_STRIDE) {
                visit(
                    view,
                    formOf(file.defs[i + DEF.form] ?? 0),
                    this.strings.get(file.defs[i + DEF.database] ?? 0),
                );
            }
        }
    }

    /**
     * A digest of everything the index holds, independent of the order files were added in
     * and of how names were numbered: two indexes that answer alike have the same digest.
     */
    digest(): string {
        const hash = createHash('sha256');
        const files = this.files
            .filter((f): f is FileEntry => f !== undefined)
            .sort((a, b) => compareStrings(a.layer, b.layer) || compareStrings(a.path, b.path));
        const s = (id: number): string => (id < 0 ? '' : this.strings.get(id));
        for (const file of files) {
            hash.update(
                `file\u0000${file.layer}\u0000${file.path}\u0000${file.kind}\u0000${file.folder ?? ''}\u0000${String(file.exactCase)}\n`,
            );
            hash.update(
                new Uint8Array(
                    file.lineStarts.buffer,
                    file.lineStarts.byteOffset,
                    file.lineStarts.byteLength,
                ),
            );
            const defs: string[] = [];
            for (let i = 0; i < file.defs.length; i += DEF_STRIDE) {
                const d = file.defs;
                defs.push(
                    [
                        s(d[i + DEF.name] ?? -1),
                        s(d[i + DEF.database] ?? -1),
                        String(d[i + DEF.form]),
                        s(d[i + DEF.container] ?? -1),
                        s(d[i + DEF.prefix] ?? -1),
                        String(d[i + DEF.keyStart]),
                        String(d[i + DEF.keyEnd]),
                        String(d[i + DEF.end]),
                        String(d[i + DEF.extra]),
                    ].join('\u0001'),
                );
            }
            hash.update(defs.join('\n'));
            const uses: string[] = [];
            for (let i = 0; i < file.uses.length; i += USE_STRIDE) {
                uses.push(`${s(file.uses[i] ?? -1)}\u0001${String(file.uses[i + 1])}`);
            }
            hash.update(uses.join('\n'));
        }
        hash.update(`replace\u0000${this.replacePaths.join('\u0000')}`);
        return hash.digest('hex');
    }
}

function compareStrings(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function compareIndexed(a: IndexedFile, b: IndexedFile): number {
    return (
        layerSortKey(a.layer) - layerSortKey(b.layer) ||
        compareStrings(a.layer, b.layer) ||
        compareStrings(a.path, b.path)
    );
}

function compareDefinitions(a: Definition, b: Definition): number {
    return (
        layerSortKey(a.layer) - layerSortKey(b.layer) ||
        compareStrings(a.layer, b.layer) ||
        compareStrings(a.file, b.file) ||
        a.start - b.start
    );
}
