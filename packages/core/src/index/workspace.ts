/**
 * The workspace index (docs/PLAN.md step 3): every definition and every use in the files it is
 * given, each with the layer it came from (the install's `clausewitz`, `jomini` and `game`
 * folders, a DLC pack `dlc:<pack>`, the `mod`), its file's relative path and its place in the
 * file; and what the rules table says is in force.
 *
 * It is neutral by default (item 3.6). It records every definition, and names a winner only
 * where a row of the rules table that decides (rules.ts: a settled or derived row of a kind
 * the index applies) answers the question for that database, form and platform. Where none
 * does, the answer is `unknown`: defined more than once, winner not known, with the reasons
 * (no row; a row that is partial or open; no order; a file whose reading is not known).
 * Nothing is guessed, and adding a row changes the answer with no change here.
 *
 * Storage is packed: names are interned, and a file's definitions and uses are integer arrays
 * (`DEF` and `USE_STRIDE` in extract.ts), so the whole base game fits in memory and in the
 * on-disk cache (cache.ts).
 */

import { createHash } from 'node:crypto';
import { decodeScript, type Decoded, type FallbackEncoding } from '../syntax/decode.js';
import { parse } from '../syntax/parser.js';
import type { Position, Range } from '../syntax/position.js';
import { readScript } from '../syntax/read.js';
import {
    CONSTANTS_DATABASE,
    DEF,
    DEF_STRIDE,
    extractLocalization,
    extractScript,
    fileConstantsDatabase,
    FLAG_SCOPE_NOT_SETTLED,
    formOf,
    NONE,
    USE_STRIDE,
    variableKey,
    variableKeyParts,
    type ContainerReading,
    type Extracted,
    type StatementStore,
} from './extract.js';
import type { FolderTable } from './folders.js';
import { parseLocalization, readLocalization } from './localization.js';
import { layerMatches, sortByOrder } from './order.js';
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
    aliasApplies,
    APPLIED_KINDS,
    databaseMatches,
    decides,
    fileConditionRules,
    ROW_STATUSES,
    rulesFor,
    type ContainerEntries,
    type ContainersRule,
    type FileOrderRule,
    type FolderWinsRule,
    type Form,
    type KeyResolutionRule,
    type ListingDepthRule,
    type Merge,
    type OnReplace,
    type Platform,
    type Within,
    type Resolve,
    type Rule,
    type RulesTable,
    type RowStatus,
} from './rules.js';
import { LayeredMap } from './layered.js';
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
    /** The row whose `file_condition` says the file contributes no definitions, or null. */
    readonly noDefinitions: string | null;
    readonly lineStarts: Int32Array;
    readonly defs: Int32Array;
    readonly uses: Int32Array;
    /** The names it uses, sorted, each once. */
    readonly names: Int32Array;
    /** The names it saves a scope as, each with where it starts (`USE_STRIDE`). */
    readonly saves: Int32Array;
    /** The names it reads as a saved scope (`scope:name`), each with where it starts. */
    readonly reads: Int32Array;
    /** The words it writes with a `$PARAM$` beside literal text, each with where it starts. */
    readonly templates: Int32Array;
    /** Format 9: the variables it sets (`variableKey`), each with where its name starts. */
    readonly varSets: Int32Array;
    /** Format 9: the plain name of every variable statement it writes, with where it starts. */
    readonly varNames: Int32Array;
    /** Format 9, a localization file: the names its texts read as a saved scope or value. */
    readonly textReads: Int32Array;
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
        readonly noDefinitions: string | null;
        readonly lineStarts: Int32Array;
        readonly defs: Int32Array;
        readonly uses: Int32Array;
        readonly names: Int32Array;
        readonly saves: Int32Array;
        readonly reads: Int32Array;
        readonly templates: Int32Array;
        readonly varSets: Int32Array;
        readonly varNames: Int32Array;
        readonly textReads: Int32Array;
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
    /**
     * The row whose `file_condition` (format 8) says the file contributes no definitions
     * (`msg-localization-missing-bom`: a localization file without a byte-order mark), or null.
     */
    readonly noDefinitions: string | null;
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
      }
    | {
          /** The file is below a subfolder of `folder`, and no deciding row says the folder is read with its subfolders. */
          readonly kind: 'listing-depth';
          readonly folder: string;
          /** The row that would say, when one is partial or open; null when none does. */
          readonly rule: string | null;
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
    /**
     * Why the file is not read: a `path-case` row that compares paths exactly, or a
     * `listing-depth` row that lists its folder without subfolders.
     */
    readonly notReadBecause: { readonly rule: string } | null;
    readonly questions: readonly FileQuestion[];
}

/** One definition. */
export interface Definition {
    readonly name: string;
    readonly database: string;
    readonly form: Form;
    /**
     * The container key, for an entry; for a nested definition found by its place (part D3),
     * its parent: the keys from the top-level key down to the block that holds it, joined by
     * `/`; otherwise null.
     */
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
    /** For an entry, where its container's block starts in the file; otherwise null. */
    readonly containerBlock: number | null;
    /**
     * Where it is written, when that is not part of its identity (`container`): for an entry
     * of a key space, the containers down to it (`special_genes/morph_genes`); for a nested
     * definition (part D3), the keys down to the block that holds it. Otherwise null.
     */
    readonly parent: string | null;
    /** For a top-level `key = value`, the value when it is one word (an alias line's target). */
    readonly value: string | null;
    /**
     * Part D3's scope of a nested name (format 8): `settled`, or `not-settled` when the row's
     * scope is unknown or rests on the measurement alone; such a name written under two
     * parents is "winner not known".
     */
    readonly scope: 'settled' | 'not-settled';
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
          /**
           * A row answers for this database and form, but its status is one the index does
           * not build on (partial, open), or the package's details it needs are not given.
           */
          readonly kind: 'not-settled';
          readonly database: string;
          readonly rule: string;
          readonly status: RowStatus;
          /** The docs/overrides.md rule of the row. */
          readonly overrides_rule: number;
      }
    | {
          /**
           * Part D3 does not settle whether a nested name is known by itself or only with its
           * parent (its scope is unknown or rests on the measurement alone), and the name is
           * written under more than one parent: whether that is one name or several is not known.
           */
          readonly kind: 'name-scope';
          readonly database: string;
          /** The blocks it is written in. */
          readonly parents: readonly string[];
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
          /**
           * The object the name shares with other names (an alias line, `coat-of-arms-alias`):
           * the name an alias line in force points it to (null when its own block binds it),
           * the block whose content is in force for the object, and every name on it.
           */
          readonly shared?: SharedObject;
      }
    | {
          /** A row says every definition adds to the result. */
          readonly status: 'all';
          readonly definitions: readonly Definition[];
          readonly rule: string;
          /** Format 9: how they add up, where the row says (`merge`: appended, by date then read). */
          readonly merge?: Merge;
      }
    | {
          /** A row says the folder is not keyed: every definition is a statement, all read. */
          readonly status: 'statements';
          readonly definitions: readonly Definition[];
          readonly rule: string;
      }
    | {
          /**
           * A row says the definitions clash: the game calls it an error. Since format 9 the row
           * may say which it keeps all the same (`within`, scope `same-priority`: the first read):
           * `kept`, with the message the game logs (`message`, a row of the table).
           */
          readonly status: 'clash';
          readonly definitions: readonly Definition[];
          readonly rule: string;
          readonly kept?: Definition;
          readonly message?: string;
      }
    | {
          /** Every definition is in a file the game does not read. */
          readonly status: 'not-read';
          readonly definitions: readonly Definition[];
      }
    | {
          /**
           * Defined, and nothing is in force: each definition is an alias line whose target was
           * not read when it was, and such a line does nothing (`alias.target_missing`); or, since
           * format 9, each is a nested definition dropped with the definition it was written in,
           * which a later one replaced (`on_replace.nested` `dropped`: a gene's templates).
           */
          readonly status: 'not-in-force';
          readonly definitions: readonly Definition[];
          readonly rule: string;
      }
    | {
          /** Defined more than once, winner not known. */
          readonly status: 'unknown';
          readonly definitions: readonly Definition[];
          readonly reasons: readonly UnknownReason[];
      };

/** What an alias replay says of a name's object (`Resolution.shared`). */
export interface SharedObject {
    readonly target: string | null;
    readonly filledBy: Definition;
    readonly names: readonly string[];
}

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

/** What replaying a database's alias lines found (`WorkspaceIndex.replay`). */
interface AliasReplay {
    /** The file-order row that could not order the statements, or null. */
    readonly unordered: string | null;
    /** Per name, the object it points to and the statement that made it point there. */
    readonly bound: Map<string, { readonly object: number; readonly by: Definition }>;
    readonly objects: { filledBy: Definition; readonly names: Set<string> }[];
    /** The names an alias line touches: written as one, or on an object with another name. */
    readonly involved: Set<string>;
    /** Per name, the statements in files whose reading is not known that its object rests on. */
    readonly uncertain: Map<string, Definition[]>;
}

/** The container an entry of a key space is written in, its type (`morph_genes`). */
function typeOf(d: Definition | undefined): string | undefined {
    return d?.parent?.split('/').at(-1);
}

/** The block an entry is written in: its file and where its container's block starts. */
function blockKeyOf(d: Definition): string {
    return `${d.layer}\u0000${d.file}\u0000@${String(d.containerBlock ?? d.start)}`;
}

/** A definition handle: file id and index, in one number. */
const SPAN = 2 ** 22;

/** A list copied, for a fork to change apart from the index it was forked from. */
function copyList(list: number[]): number[] {
    return [...list];
}

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

function isJson(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    /** The rows the index applies on its platform: they hold there and decide. */
    readonly rules: readonly Rule[];
    /** Every row that holds on the platform, deciding or not: for the reasons of an unknown. */
    readonly platformRules: readonly Rule[];
    /** The rows whose `file_condition` the index applies on its platform (format 8). */
    readonly fileConditions: readonly Rule[];
    private readonly fallbackEncoding: FallbackEncoding | undefined;
    private readonly strings: StringTable;
    private readonly files: (FileEntry | undefined)[];
    private readonly byKey: Map<string, number>;
    private readonly paths: PathTable<number>;
    /** Where each name is defined: a handle per definition (`SPAN`). */
    private readonly byName: LayeredMap<number, number[]>;
    /** The files that save a scope as each name. */
    private readonly bySave: LayeredMap<number, number[]>;
    /** The files that read each name as a saved scope. */
    private readonly byRead: LayeredMap<number, number[]>;
    /** The files that set each variable (`variableKey`). */
    private readonly byVarSet: LayeredMap<number, number[]>;
    /** True once a fork shares this index: it changes no more (`fork`). */
    private frozen = false;
    /** One byte per interned name: 1 when a file uses it. Built when asked, dropped on a change. */
    private usedBits: Uint8Array | null = null;
    /** Every template word of every file, each once. Built when asked, dropped on a change. */
    private templateWords: string[] | null = null;
    /** Every variable set whose name is a template, each once. Built when asked, dropped on a change. */
    private variableTemplates: string[] | null = null;
    private replacePaths: string[];
    private statuses: FileStatus[] | null = null;
    /** Per database, what a pass over all its definitions found; dropped on every change. */
    private replays = new Map<string, AliasReplay>();
    private refused = new Map<string, Map<string, number>>();
    /**
     * What is in force for each name asked about that has more than one definition, by
     * database, name and container; dropped on every change. A check asks once per definition,
     * so a name defined in n files would otherwise be resolved n times over all n definitions.
     * On the base game, 1,322 names have more than one definition (5,773 in all); keeping every
     * answer holds about 6 MB.
     */
    private resolutions = new Map<string, Resolution>();

    /**
     * An empty index; with `base` (by `fork` only), an index over `base`'s files, which shares
     * them and their tables, `strings` being the fork of `base`'s string table.
     */
    constructor(options: IndexOptions, strings = new StringTable(), base?: WorkspaceIndex) {
        this.files = base === undefined ? [] : [...base.files];
        this.byKey = new Map(base?.byKey);
        this.paths = base === undefined ? new PathTable<number>() : base.paths.copy();
        this.byName = base === undefined ? new LayeredMap() : base.byName.fork();
        this.bySave = base === undefined ? new LayeredMap() : base.bySave.fork();
        this.byRead = base === undefined ? new LayeredMap() : base.byRead.fork();
        this.byVarSet = base === undefined ? new LayeredMap() : base.byVarSet.fork();
        this.replacePaths = base === undefined ? [] : [...base.replacePaths];
        this.folders = options.folders;
        this.table = options.rules;
        this.platform = options.platform;
        this.platformRules =
            options.platform === undefined ? [] : rulesFor(options.rules, options.platform);
        this.rules = this.platformRules.filter(decides);
        this.fileConditions =
            options.platform === undefined
                ? []
                : fileConditionRules(options.rules, options.platform);
        this.fallbackEncoding = options.fallbackEncoding;
        this.strings = strings;
    }

    /**
     * An index over this one (docs/shared-index.md): it holds every file of this one and shares
     * them, their names and their tables, and keeps what is added, changed or removed after
     * apart, copying a table's entry only when it changes it. It answers as an index that had
     * the same files added after this one's would: the same numbers for the same names, in the
     * same order. This index is frozen from then on (`freeze`), so that every fork of it stays
     * true; many forks may share it.
     */
    fork(): WorkspaceIndex {
        this.frozen = true;
        return new WorkspaceIndex(
            {
                folders: this.folders,
                rules: this.table,
                platform: this.platform,
                fallbackEncoding: this.fallbackEncoding,
            },
            this.strings.fork(),
            this,
        );
    }

    /** No file is added, changed or removed from now on: adding one throws. */
    freeze(): void {
        this.frozen = true;
    }

    /** True when the index changes no more (`fork`, `freeze`). */
    get isFrozen(): boolean {
        return this.frozen;
    }

    /**
     * A file's bytes decoded as this index decodes the files it reads (docs/encoding.md): its
     * byte-order mark removed, a file not valid UTF-8 read with the fallback encoding it was
     * given, if any. What the agent server's `source` shows (`source-text.ts`).
     */
    decode(bytes: Uint8Array): Decoded {
        return decodeScript(bytes, { fallbackEncoding: this.fallbackEncoding });
    }

    private refuseChange(): void {
        if (this.frozen) {
            throw new Error('the index is shared by its forks and changes no more');
        }
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
        if (kind === 'script' && this.folders.scriptStatus(path)?.script === false) {
            // The spec says the file is no script (format 9, `directories[].files`): not read.
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
            const stem = fileNameOf(path);
            extracted = extractScript(parsed.file, {
                strings: this.strings,
                database: folder,
                containers: folder === null ? null : this.containersFor(folder),
                priority: folder === null ? null : this.priorityFor(folder),
                folder: match?.folder ?? null,
                constants:
                    this.folders.constantScope === 'file'
                        ? fileConstantsDatabase(path)
                        : CONSTANTS_DATABASE,
                fileStem: stem.includes('.') ? stem.slice(0, stem.lastIndexOf('.')) : stem,
                saveRules: this.folders.saveRules,
                scopeLinks: this.folders.scopeLinks,
                variables: this.folders.variables,
                entries: folder === null ? null : this.entriesFor(folder),
                stores: folder === null ? null : this.storesFor(folder),
            });
            lineStarts = parsed.lines.lineStarts;
        } else {
            const loc =
                typeof content === 'string'
                    ? parseLocalization(content)
                    : readLocalization(content, { fallbackEncoding: this.fallbackEncoding });
            const all = extractLocalization(loc, this.strings, this.folders.textScopeForms);
            extracted = folder === null ? { defs: [], uses: all.uses } : all;
            lineStarts = loc.lines.lineStarts;
        }
        const noDefinitions = this.noDefinitionsRule(path, content);
        if (noDefinitions !== null) {
            extracted = { ...extracted, defs: [] };
        }
        return {
            layer,
            path,
            kind,
            folder,
            exactCase: match?.exactCase ?? true,
            noDefinitions,
            lineStarts: Int32Array.from(lineStarts),
            defs: Int32Array.from(extracted.defs),
            uses: packUses(extracted.uses),
            names: sortedUnique(this.useNames(extracted.uses)),
            saves: packUses(extracted.saves ?? []),
            reads: packUses(extracted.reads ?? []),
            templates: packUses(extracted.templates ?? []),
            varSets: packUses(extracted.varSets ?? []),
            varNames: packUses(extracted.varNames ?? []),
            textReads: packUses(extracted.textReads ?? []),
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

    /**
     * The mod's `replace_path` values, from its descriptor (docs/overrides.md, rule 8), kept as
     * written: the game compares the folder byte for byte.
     */
    setReplacePaths(paths: readonly string[]): void {
        this.refuseChange();
        this.replacePaths = [...paths];
        this.changed();
    }

    getReplacePaths(): readonly string[] {
        return this.replacePaths;
    }

    private store(file: Omit<FileEntry, 'id'>): number {
        this.refuseChange();
        const id = this.files.length;
        const entry: FileEntry = { ...file, id };
        this.files.push(entry);
        this.byKey.set(`${file.layer}\u0000${file.path}`, id);
        this.paths.add(file.path, id);
        for (let i = 0; i * DEF_STRIDE < file.defs.length; i++) {
            const name = file.defs[i * DEF_STRIDE + DEF.name] ?? 0;
            const handles = this.byName.mutable(name, copyList);
            if (handles === undefined) {
                this.byName.set(name, [id * SPAN + i]);
            } else {
                handles.push(id * SPAN + i);
            }
        }
        for (const [array, map] of [
            [file.saves, this.bySave],
            [file.reads, this.byRead],
            [file.varSets, this.byVarSet],
        ] as const) {
            for (const name of new Set(this.useNames(array))) {
                const ids = map.mutable(name, copyList);
                if (ids === undefined) {
                    map.set(name, [id]);
                } else {
                    ids.push(id);
                }
            }
        }
        this.changed();
        return id;
    }

    private unstore(id: number): void {
        this.refuseChange();
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
        for (const [array, map] of [
            [file.saves, this.bySave],
            [file.reads, this.byRead],
            [file.varSets, this.byVarSet],
        ] as const) {
            for (const name of new Set(this.useNames(array))) {
                const ids = map.get(name)?.filter((i) => i !== id) ?? [];
                if (ids.length === 0) {
                    map.delete(name);
                } else {
                    map.set(name, ids);
                }
            }
        }
        this.files[id] = undefined;
        this.byKey.delete(`${file.layer}\u0000${file.path}`);
        this.paths.remove(file.path, id);
        this.changed();
    }

    private *useNames(uses: ArrayLike<number>): Generator<number> {
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

    /**
     * The row whose `file_condition` says a file contributes no definitions, when the file is
     * one it names and meets its condition; else null. The condition is a test of the file's
     * bytes (`no-utf8-bom`: they do not start with EF BB BF); text an editor hands in has no
     * bytes to test and is read as written.
     */
    private noDefinitionsRule(path: string, content: Uint8Array | string): string | null {
        if (typeof content === 'string') {
            return null;
        }
        for (const rule of this.fileConditions) {
            const condition = rule.file_condition;
            if (condition === undefined) {
                continue;
            }
            const { folder, extension, recursive } = condition.files;
            const inFolder = recursive ? isWithin(path, folder) : parentOf(path) === folder;
            if (!inFolder || extensionOf(path) !== extension) {
                continue;
            }
            if (
                condition.condition === 'no-utf8-bom' &&
                !(
                    content.length >= 3 &&
                    content[0] === 0xef &&
                    content[1] === 0xbb &&
                    content[2] === 0xbf
                )
            ) {
                return rule.id;
            }
        }
        return null;
    }

    /**
     * What the children of a database's container keys are (format 8): the deciding containers
     * rows with `entries`, each read with the key space it names and the parts of an entry's
     * key the database's key-resolution row lists beside the name (`details.key.parts`).
     */
    private entriesFor(database: string): ReadonlyMap<string, ContainerReading> | null {
        const rows = this.rules.filter(
            (r): r is ContainersRule & { entries: ContainerEntries } =>
                r.kind === 'containers' &&
                r.entries !== undefined &&
                r.databases.some((d) => databaseMatches(d, database)),
        );
        if (rows.length === 0) {
            return null;
        }
        const key = this.keyRule(database, ['entry'])?.details?.['key'];
        const qualifiersOf = (entries: ContainerEntries): Set<string> => {
            const parts =
                isJson(key) && key['key_space'] === entries.key_space && Array.isArray(key['parts'])
                    ? (key['parts'] as unknown[]).filter((p): p is string => typeof p === 'string')
                    : [];
            const notEntries = entries.not_entries ?? [];
            return new Set(parts.filter((p) => p !== 'name' && notEntries.includes(p)));
        };
        const out = new Map<string, ContainerReading>();
        for (const row of rows) {
            const entries = row.entries;
            const definitions: ContainerReading = {
                holds: 'definitions',
                containers: new Set(),
                keySpace: entries.key_space,
                notEntries: new Set(entries.not_entries ?? []),
                qualifiers: qualifiersOf(entries),
                inner: null,
            };
            const reading: ContainerReading =
                entries.holds === 'containers'
                    ? {
                          ...definitions,
                          holds: 'containers',
                          containers: new Set(entries.containers ?? []),
                          inner: definitions,
                      }
                    : definitions;
            for (const k of row.keys) {
                out.set(k, reading);
            }
        }
        return out;
    }

    /**
     * The stores of a folder that holds statements (format 8, `details.statements` of a
     * deciding key-resolution row whose `resolve` is `statements`): per kind of statement, its
     * form and its keys (a key written `<...>` stands for any other key). Null otherwise.
     */
    private storesFor(database: string): StatementStore[] | null {
        const rule = this.keyRule(database, ['record', 'value']);
        const statements =
            rule?.resolve === 'statements' ? rule.details?.['statements'] : undefined;
        if (!isJson(statements)) {
            return null;
        }
        const out: StatementStore[] = [];
        for (const [store, s] of Object.entries(statements)) {
            if (
                !isJson(s) ||
                (s['form'] !== 'value' && s['form'] !== 'block') ||
                !Array.isArray(s['keys'])
            ) {
                continue;
            }
            const keys = (s['keys'] as unknown[]).filter((k): k is string => typeof k === 'string');
            const placeholder = keys.every((k) => /^<.+>$/.test(k));
            // Format 9: how two keys of the store compare (`key_identity`: a province id as an
            // integer, `007` and `7` one key).
            const identity = s['key_identity'];
            const compare =
                isJson(identity) && typeof identity['compare'] === 'string'
                    ? identity['compare']
                    : undefined;
            out.push({
                store,
                form: s['form'],
                keys: placeholder ? null : new Set(keys),
                ...(compare === undefined ? {} : { compare }),
            });
        }
        return out.length === 0 ? null : out;
    }

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

    /** A row of an applied kind that would answer, but does not decide (partial, open). */
    private pendingRule(
        kind: Rule['kind'],
        database: string,
        forms: readonly Form[] | null,
    ): Rule | undefined {
        return this.platformRules.find(
            (r) =>
                r.kind === kind &&
                APPLIED_KINDS.has(r.kind) &&
                !decides(r) &&
                'databases' in r &&
                Array.isArray(r.databases) &&
                (r.databases as readonly string[]).some((d) => databaseMatches(d, database)) &&
                (forms === null ||
                    r.kind !== 'key-resolution' ||
                    forms.every((f) => r.forms === undefined || r.forms.includes(f))),
        );
    }

    private priorityFor(database: string): { field: string; fallback: number } | null {
        const rule = this.keyRule(database, ['record']);
        if (rule?.resolve !== 'priority' || rule.priority_field === undefined) {
            return null;
        }
        return { field: rule.priority_field, fallback: rule.priority_default ?? 0 };
    }

    /** The order of a database's files: a row naming the database before one for every database. */
    private orderRule(database: string): FileOrderRule | undefined {
        const rows = this.rules.filter((r): r is FileOrderRule => r.kind === 'file-order');
        return (
            rows.find((r) => r.databases?.some((d) => databaseMatches(d, database)) === true) ??
            rows.find((r) => r.databases === undefined)
        );
    }

    /**
     * Whether a file below a subfolder of its folder is read (docs/overrides.md, rule 4): by
     * the `listing-depth` row of the nearest folder above it that a row names, the file's own
     * spec folder or a folder of a row's `other_folders`. A file directly in such a folder is
     * read; below a subfolder, it is read when the row says `recursive`, not read when it says
     * not, and not known when no deciding row says.
     */
    private listingOf(file: FileEntry): {
        read: 'yes' | 'no' | 'unknown';
        rule: string | null;
        folder: string;
    } {
        const folder = file.folder ?? '';
        const rows = this.platformRules.filter(
            (r): r is ListingDepthRule => r.kind === 'listing-depth',
        );
        // The path with its spec folder spelled as the spec writes it (letter case is rule 9's).
        const path = folder + file.path.slice(folder.length);
        let dir = parentOf(path);
        let direct = true;
        while (dir !== '' && (dir === folder || isWithin(dir, folder))) {
            const row = rows.find(
                (r) => r.databases.includes(dir) || (r.other_folders ?? []).includes(dir),
            );
            if (row !== undefined) {
                if (direct) {
                    return { read: 'yes', rule: row.id, folder: dir };
                }
                if (!decides(row)) {
                    return { read: 'unknown', rule: row.id, folder: dir };
                }
                return { read: row.recursive ? 'yes' : 'no', rule: row.id, folder: dir };
            }
            if (dir === folder) {
                break;
            }
            dir = parentOf(dir);
            direct = false;
        }
        const below = parentOf(path) !== folder;
        return { read: below ? 'unknown' : 'yes', rule: null, folder };
    }

    // ─── Whether each file is read ─────────────────────────────────────────

    private computeStatuses(): FileStatus[] {
        const questions: FileQuestion[][] = this.files.map(() => []);
        const replaced: (FileStatus['replacedBy'] | null)[] = this.files.map(() => null);
        const hidden: (FileStatus['hiddenBy'] | null)[] = this.files.map(() => null);
        const notRead: (FileStatus['notReadBecause'] | null)[] = this.files.map(() => null);
        const pathCase = this.rules.find((r) => r.kind === 'path-case');
        const live = this.files.filter((f): f is FileEntry => f !== undefined);
        // A file below a subfolder of its folder (rule 4, the listing-depth rows).
        for (const file of live) {
            if (file.folder === null) {
                continue;
            }
            const listing = this.listingOf(file);
            if (listing.read === 'no' && listing.rule !== null) {
                notRead[file.id] = { rule: listing.rule };
            } else if (listing.read === 'unknown') {
                questions[file.id]?.push({
                    kind: 'listing-depth',
                    folder: listing.folder,
                    rule: listing.rule,
                });
            }
        }
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
        // `replace_path` in the mod's descriptor (rule 8). The row's folder is written byte
        // for byte as the listed directory: format 9's `path_match` (`bytes`,
        // `whole-listed-directory`; format 8 said it in the words of `details.match`). A row
        // whose path test the index does not know decides nothing: the files stay "not known".
        const replaceRow = this.rules.find((r) => r.kind === 'replace-path');
        const replacePath =
            replaceRow === undefined ||
            replaceRow.path_match === undefined ||
            (replaceRow.path_match.compare === 'bytes' &&
                replaceRow.path_match.where === 'whole-listed-directory')
                ? replaceRow
                : undefined;
        for (const hiddenPath of this.replacePaths) {
            for (const file of live) {
                if (file.layer === 'mod') {
                    continue;
                }
                if (replacePath === undefined) {
                    if (isWithin(file.path, hiddenPath, true)) {
                        questions[file.id]?.push({ kind: 'replace-path', path: hiddenPath });
                    }
                    continue;
                }
                const direct = parentOf(file.path) === hiddenPath;
                const below = file.path.startsWith(`${hiddenPath}/`);
                if (
                    replacePath.hides.some((layer) => layerMatches(layer, file.layer)) &&
                    (direct || (replacePath.subfolders && below))
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
            noDefinitions: file.noDefinitions,
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

    /**
     * The names the file at a layer and exact path writes, each once, sorted: those it uses,
     * saves a scope as, reads as a saved scope, and writes with a `$PARAM$` (`nameTemplates`).
     * With its definitions (`definitionsIn`), what another file's findings can depend on: a
     * server compares them before and after an edit to know which files to check again
     * (`filesNaming`). Undefined when no such file is indexed.
     */
    namesIn(
        layer: string,
        path: string,
    ):
        | {
              readonly uses: readonly string[];
              readonly saves: readonly string[];
              readonly reads: readonly string[];
              readonly templates: readonly string[];
              /** The variables it sets, by name (format 9). */
              readonly variables: readonly string[];
              /** The keys whose text reads a saved scope, each `<key>\u0000<name>` (format 9). */
              readonly texts: readonly string[];
          }
        | undefined {
        const id = this.byKey.get(`${layer}\u0000${path}`);
        const file = id === undefined ? undefined : this.files[id];
        if (file === undefined) {
            return undefined;
        }
        const words = (ids: Iterable<number>): string[] =>
            [...new Set(ids)].map((n) => this.strings.get(n)).sort(compareStrings);
        return {
            uses: words(file.names),
            saves: words(this.useNames(file.saves)),
            reads: words(this.useNames(file.reads)),
            templates: words(this.useNames(file.templates)),
            variables: [
                ...new Set(
                    [...this.useNames(file.varSets)].map(
                        (n) => variableKeyParts(this.strings.get(n))?.name ?? '',
                    ),
                ),
            ].sort(compareStrings),
            texts: this.textReadsOf(file).sort(compareStrings),
        };
    }

    /** A localization file's text reads, each `<key>\u0000<name>`, by the entry they are in. */
    private textReadsOf(file: FileEntry): string[] {
        const out = new Set<string>();
        if (file.textReads.length === 0) {
            return [];
        }
        for (let i = 0; i * DEF_STRIDE < file.defs.length; i++) {
            const at = i * DEF_STRIDE;
            const start = file.defs[at + DEF.keyStart] ?? 0;
            const end = file.defs[at + DEF.end] ?? 0;
            const key = this.strings.get(file.defs[at + DEF.name] ?? -1);
            for (let j = 0; j < file.textReads.length; j += USE_STRIDE) {
                const read = file.textReads[j + 1] ?? -1;
                if (read >= start && read < end) {
                    out.add(`${key}\u0000${this.strings.get(file.textReads[j] ?? -1)}`);
                }
            }
        }
        return [...out];
    }

    /**
     * The paths of the files of a layer that define, use, save a scope as, or read as a saved
     * scope any of `names`, sorted: the files whose findings can change when those names do.
     */
    filesNaming(names: Iterable<string>, layer: string): string[] {
        const ids = new Set<number>();
        for (const name of names) {
            const id = this.strings.find(name);
            if (id >= 0) {
                ids.add(id);
            }
        }
        if (ids.size === 0) {
            return [];
        }
        const holds = (array: Int32Array, from: number, stride: number): boolean => {
            for (let i = from; i < array.length; i += stride) {
                if (ids.has(array[i] ?? -1)) {
                    return true;
                }
            }
            return false;
        };
        const out: string[] = [];
        for (const file of this.files) {
            if (file === undefined || file.layer !== layer) {
                continue;
            }
            if (
                [...ids].some((id) => containsSorted(file.names, id)) ||
                holds(file.defs, DEF.name, DEF_STRIDE) ||
                holds(file.saves, 0, USE_STRIDE) ||
                holds(file.reads, 0, USE_STRIDE)
            ) {
                out.push(file.path);
            }
        }
        return out.sort(compareStrings);
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
        const detail = at(DEF.detail);
        const detailText = detail < 0 ? null : this.strings.get(detail);
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
            containerBlock: form === 'entry' && extra !== NONE ? extra : null,
            parent: form === 'value' ? null : detailText,
            value: form === 'value' ? detailText : null,
            scope: (at(DEF.flags) & FLAG_SCOPE_NOT_SETTLED) !== 0 ? 'not-settled' : 'settled',
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

    /** Every definition of the file at a layer and exact path, in the order they are written. */
    definitionsIn(layer: string, path: string): Definition[] {
        const id = this.byKey.get(`${layer}\u0000${path}`);
        const file = id === undefined ? undefined : this.files[id];
        if (id === undefined || file === undefined) {
            return [];
        }
        const out: Definition[] = [];
        for (let i = 0; i < file.defs.length / DEF_STRIDE; i++) {
            out.push(this.definition(id * SPAN + i));
        }
        return out.sort((a, b) => a.start - b.start);
    }

    /**
     * The name written at a place of the file at a layer and exact path: the key of a
     * definition, or a use, whose span holds the place (its end included, where a cursor
     * after the last letter stands). Lines and characters count from 0, as the index's
     * positions; undefined when the file is not indexed or no name is written there.
     */
    nameAt(
        layer: string,
        path: string,
        position: Position,
    ):
        | { readonly name: string; readonly kind: 'definition' | 'use'; readonly range: Range }
        | undefined {
        const id = this.byKey.get(`${layer}\u0000${path}`);
        const file = id === undefined ? undefined : this.files[id];
        if (file === undefined || position.line < 0 || position.line >= file.lineStarts.length) {
            return undefined;
        }
        const offset = (file.lineStarts[position.line] ?? 0) + position.character;
        const span = (start: number, end: number): Range => ({
            start: positionIn(file.lineStarts, start),
            end: positionIn(file.lineStarts, end),
        });
        for (let i = 0; i < file.defs.length; i += DEF_STRIDE) {
            const start = file.defs[i + DEF.keyStart] ?? 0;
            const end = file.defs[i + DEF.keyEnd] ?? 0;
            if (start <= offset && offset <= end) {
                const name = this.strings.get(file.defs[i + DEF.name] ?? 0);
                return { name, kind: 'definition', range: span(start, end) };
            }
        }
        for (let i = 0; i < file.uses.length; i += USE_STRIDE) {
            const start = file.uses[i + 1] ?? 0;
            if (start > offset) {
                break;
            }
            const name = this.strings.get(file.uses[i] ?? 0);
            const end = start + name.length;
            if (offset <= end) {
                return { name, kind: 'use', range: span(start, end) };
            }
        }
        return undefined;
    }

    /** Every database that holds a definition, with how many, sorted by name. */
    databases(): Map<string, number> {
        const counts = new Map<number, number>();
        for (const file of this.files) {
            if (file === undefined) {
                continue;
            }
            for (let i = DEF.database; i < file.defs.length; i += DEF_STRIDE) {
                const database = file.defs[i] ?? 0;
                counts.set(database, (counts.get(database) ?? 0) + 1);
            }
        }
        return new Map(
            [...counts]
                .map(([id, n]): [string, number] => [this.strings.get(id), n])
                .sort(([a], [b]) => compareStrings(a, b)),
        );
    }

    /**
     * Every definition of a database, sorted by layer, path and place, as `definitions` sorts
     * the definitions of one name.
     */
    definitionsOf(database: string): Definition[] {
        const id = this.strings.find(database);
        if (id < 0) {
            return [];
        }
        const out: Definition[] = [];
        for (const file of this.files) {
            if (file === undefined) {
                continue;
            }
            for (let i = 0; i * DEF_STRIDE < file.defs.length; i++) {
                if (file.defs[i * DEF_STRIDE + DEF.database] === id) {
                    out.push(this.definition(file.id * SPAN + i));
                }
            }
        }
        return out.sort(compareDefinitions);
    }

    /** What is in force for a name of a database (and a container, for entries). */
    resolve(database: string, name: string, container: string | null = null): Resolution {
        const definitions = this.definitions(name, { database, container });
        if (definitions.length < 2) {
            return this.resolveDefinitions(database, name, container, definitions);
        }
        const key = `${database}\u0000${name}\u0000${container ?? '\u0001'}`;
        const known = this.resolutions.get(key);
        if (known !== undefined) {
            return known;
        }
        const resolution = this.resolveDefinitions(database, name, container, definitions);
        this.resolutions.set(key, resolution);
        return resolution;
    }

    /** What is in force among a name's definitions (`resolve`, without its memory). */
    private resolveDefinitions(
        database: string,
        name: string,
        container: string | null,
        definitions: readonly Definition[],
    ): Resolution {
        if (definitions.length === 0) {
            return { status: 'not-defined', definitions };
        }
        let live = definitions.filter((d) => d.read !== 'no');
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
        // Part D3: a nested name whose scope is not settled, under more than one parent.
        if (live.some((d) => d.scope === 'not-settled')) {
            const parents = [...new Set(live.map((d) => d.parent ?? ''))].sort();
            if (parents.length > 1) {
                return {
                    status: 'unknown',
                    definitions,
                    reasons: [{ kind: 'name-scope', database, parents }],
                };
            }
        }
        // Format 9, `on_replace`: a nested definition written in a definition that a later one
        // replaced goes with it (`dropped`: a gene's templates), stays (`kept`), or nothing says
        // (`unknown`: winner not known).
        const replace = this.onReplaceOf(database);
        if (replace !== undefined) {
            const fates = live.map((d) => this.parentFate(d, replace.folder));
            const reason: UnknownReason = {
                kind: 'not-settled',
                database,
                rule: replace.rule.id,
                status: replace.status,
                overrides_rule: replace.rule.overrides_rule,
            };
            if (fates.some((f) => f === 'unknown')) {
                return { status: 'unknown', definitions, reasons: [reason] };
            }
            if (fates.some((f) => f === 'replaced')) {
                if (replace.nested !== 'dropped') {
                    return { status: 'unknown', definitions, reasons: [reason] };
                }
                const kept = live.filter((_, i) => fates[i] !== 'replaced');
                if (kept.length === 0) {
                    return { status: 'not-in-force', definitions, rule: replace.rule.id };
                }
                if (kept.length === 1) {
                    const winner = kept[0] as Definition;
                    return {
                        status: 'winner',
                        definitions,
                        winner,
                        combine: 'whole',
                        rule: replace.rule.id,
                    };
                }
                live = kept;
            }
        }
        // An entry after a refused one in its block (`details.type_mismatch`, genes): the reader
        // returns from the block there, and what is made of the entries after it is not
        // followed (the row's `open`).
        const entryRule = live.every((d) => d.form === 'entry')
            ? this.keyRule(database, ['entry'])
            : undefined;
        if (entryRule !== undefined && this.typeMismatch(entryRule, live) !== undefined) {
            const refused = this.refusals(database, entryRule);
            const after = live.some((d) => {
                const cut = refused.get(blockKeyOf(d));
                return cut !== undefined && d.start > cut;
            });
            if (after) {
                return {
                    status: 'unknown',
                    definitions,
                    reasons: [
                        {
                            kind: 'not-settled',
                            database,
                            rule: entryRule.id,
                            status: entryRule.status,
                            overrides_rule: entryRule.overrides_rule,
                        },
                    ],
                };
            }
        }
        // An alias line (`coat-of-arms-alias`): what is in force comes from replaying the folder.
        if (container === null) {
            const replayed = this.aliasAnswer(database, name, definitions);
            if (replayed !== undefined) {
                return replayed;
            }
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
            (r): r is FolderWinsRule =>
                r.kind === 'folder-wins' && r.databases.some((d) => databaseMatches(d, database)),
        );
        const pathTest = folderWins === undefined ? null : folderPathTest(folderWins);
        if (folderWins !== undefined && pathTest === undefined) {
            // A path test the index does not know (format 9, `path_match`): the row decides nothing.
            return {
                status: 'unknown',
                definitions,
                reasons: [
                    {
                        kind: 'not-settled',
                        database,
                        rule: folderWins.id,
                        status: folderWins.status,
                        overrides_rule: folderWins.overrides_rule,
                    },
                ],
            };
        }
        if (folderWins !== undefined && pathTest !== undefined && pathTest !== null) {
            const inFolder = live.filter((d) => pathTest(d.file));
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
                // Which of two under the folder wins: the row's `within`, scope `same-segment`
                // (format 9; format 8 said it in the words of `details.among_segment`).
                const among = withinOf(folderWins, SAME_SEGMENT)?.resolve;
                if (among !== 'later-wins' && among !== 'earlier-wins') {
                    return {
                        status: 'unknown',
                        definitions,
                        reasons: [
                            {
                                kind: 'not-settled',
                                database,
                                rule: folderWins.id,
                                status: folderWins.status,
                                overrides_rule: folderWins.overrides_rule,
                            },
                        ],
                    };
                }
                return this.byOrder(database, definitions, inFolder, among, 'whole', folderWins.id);
            }
        }
        const rule = this.keyRule(database, forms);
        if (rule === undefined) {
            const pending = this.pendingRule('key-resolution', database, forms);
            if (pending !== undefined) {
                return {
                    status: 'unknown',
                    definitions,
                    reasons: [
                        {
                            kind: 'not-settled',
                            database,
                            rule: pending.id,
                            status: pending.status,
                            overrides_rule: pending.overrides_rule,
                        },
                    ],
                };
            }
            return {
                status: 'unknown',
                definitions,
                reasons: [{ kind: 'no-rule', database, forms: forms.sort() }],
            };
        }
        switch (rule.resolve) {
            case 'all':
                return rule.merge === undefined
                    ? { status: 'all', definitions, rule: rule.id }
                    : { status: 'all', definitions, rule: rule.id, merge: rule.merge };
            case 'statements': {
                // A folder of statements in stores of their own (format 8, `details.statements`):
                // within one store, what a statement written again does.
                const store = container === null ? undefined : rule.details?.['statements'];
                const kind = isJson(store) ? store[container ?? ''] : undefined;
                const onRepeat = isJson(kind) ? kind['on_repeat'] : undefined;
                const combine = isJson(kind) ? kind['combine'] : undefined;
                if (
                    (onRepeat === 'later-wins' || onRepeat === 'earlier-wins') &&
                    (combine === 'whole' || combine === 'fields')
                ) {
                    return this.byOrder(database, definitions, pool, onRepeat, combine, rule.id);
                }
                return { status: 'statements', definitions, rule: rule.id };
            }
            case 'priority': {
                const value = (d: Definition): number => d.priority ?? rule.priority_default ?? 0;
                const top = Math.max(...pool.map(value));
                const best = pool.filter((d) => value(d) === top);
                if (best.length > 1) {
                    // A tie: the game logs its error, and (format 9, `within` scope
                    // `same-priority`) keeps one by the read order where the row says which.
                    const tie = withinOf(rule, SAME_PRIORITY);
                    const ordered =
                        tie?.resolve === 'earlier-wins' || tie?.resolve === 'later-wins'
                            ? this.inOrder(database, best)
                            : undefined;
                    if (tie === undefined || ordered === undefined) {
                        return { status: 'clash', definitions, rule: rule.id };
                    }
                    const kept = (
                        tie.resolve === 'earlier-wins' ? ordered[0] : ordered.at(-1)
                    ) as Definition;
                    return tie.message === undefined
                        ? { status: 'clash', definitions, rule: rule.id, kept }
                        : {
                              status: 'clash',
                              definitions,
                              rule: rule.id,
                              kept,
                              message: tie.message,
                          };
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
                // Two definitions inside one container block: the row's `within`, scope
                // `same-block` (format 9; format 8 said it in the words of `details.within_one_block`).
                const blocks = new Map<string, Definition[]>();
                for (const d of pool) {
                    const key =
                        d.containerBlock === null
                            ? `${d.layer}\u0000${d.file}\u0000${String(d.start)}`
                            : `${d.layer}\u0000${d.file}\u0000@${String(d.containerBlock)}`;
                    blocks.set(key, [...(blocks.get(key) ?? []), d]);
                }
                if ([...blocks.values()].some((group) => group.length > 1)) {
                    const inBlock = withinOf(rule, SAME_BLOCK)?.resolve ?? rule.resolve;
                    if (inBlock !== 'later-wins' && inBlock !== 'earlier-wins') {
                        return {
                            status: 'unknown',
                            definitions,
                            reasons: [
                                {
                                    kind: 'not-settled',
                                    database,
                                    rule: rule.id,
                                    status: rule.status,
                                    overrides_rule: rule.overrides_rule,
                                },
                            ],
                        };
                    }
                    pool = [...blocks.values()].map((group) => {
                        const sorted = [...group].sort((a, b) => a.start - b.start);
                        return (inBlock === 'later-wins' ? sorted.at(-1) : sorted[0]) as Definition;
                    });
                }
                // Entries of a key space whose row says what a later entry of another type does
                // (`details.type_mismatch`, genes): it is refused and the earlier stays.
                const mismatch = this.typeMismatch(rule, live);
                if (mismatch !== undefined) {
                    const ordered = this.inOrder(database, pool);
                    if (ordered === undefined) {
                        return {
                            status: 'unknown',
                            definitions,
                            reasons: [{ kind: 'no-order', database, rule: rule.id }],
                        };
                    }
                    const first = ordered[0];
                    const kept = ordered.filter((d) => typeOf(d) === typeOf(first));
                    const winner = (rule.resolve === 'later-wins' ? kept.at(-1) : kept[0]) ?? first;
                    if (winner === undefined) {
                        return {
                            status: 'unknown',
                            definitions,
                            reasons: [{ kind: 'no-order', database, rule: rule.id }],
                        };
                    }
                    return {
                        status: 'winner',
                        definitions,
                        winner,
                        combine: rule.combine ?? 'whole',
                        rule: rule.id,
                    };
                }
                return this.byOrder(
                    database,
                    definitions,
                    pool,
                    rule.resolve,
                    rule.combine ?? 'whole',
                    rule.id,
                );
            }
        }
    }

    /** Something changed: what was worked out from the files is worked out again. */
    private changed(): void {
        this.statuses = null;
        this.replays = new Map();
        this.refused = new Map();
        this.resolutions = new Map();
        this.usedBits = null;
        this.templateWords = null;
        this.variableTemplates = null;
    }

    /** A pool sorted in the order the game reads it, or undefined when no row orders it. */
    private inOrder(database: string, pool: readonly Definition[]): Definition[] | undefined {
        const order = this.orderRule(database);
        return order === undefined ? undefined : sortByOrder(pool, order);
    }

    /**
     * The row's `details.type_mismatch` when it applies to these definitions: entries of the key
     * space it names, each with the container it is written in, and the row keeps the first.
     */
    private typeMismatch(
        rule: KeyResolutionRule,
        live: readonly Definition[],
    ): Readonly<Record<string, unknown>> | undefined {
        const mismatch = rule.details?.['type_mismatch'];
        if (
            !isJson(mismatch) ||
            mismatch['keeps'] !== 'first' ||
            typeof mismatch['key_space'] !== 'string'
        ) {
            return undefined;
        }
        const space = mismatch['key_space'];
        const fits = live.every(
            (d) =>
                d.form === 'entry' &&
                d.parent !== null &&
                (d.container ?? '').split('|')[0] === space,
        );
        return fits ? mismatch : undefined;
    }

    /**
     * Per container block of a key space's entries, where the first refused entry starts: an
     * entry of the same key as one read earlier, of another type (`details.type_mismatch`).
     */
    private refusals(database: string, rule: KeyResolutionRule): ReadonlyMap<string, number> {
        const known = this.refused.get(database);
        if (known !== undefined) {
            return known;
        }
        const out = new Map<string, number>();
        const groups = new Map<string, Definition[]>();
        for (const d of this.allDefinitions(database)) {
            if (
                d.form === 'entry' &&
                d.read !== 'no' &&
                this.typeMismatch(rule, [d]) !== undefined
            ) {
                const key = `${d.container ?? ''}\u0000${d.name}`;
                groups.set(key, [...(groups.get(key) ?? []), d]);
            }
        }
        for (const group of groups.values()) {
            const ordered = group.length < 2 ? undefined : this.inOrder(database, group);
            const first = ordered?.[0];
            for (const d of ordered ?? []) {
                if (typeOf(d) !== typeOf(first)) {
                    const block = blockKeyOf(d);
                    out.set(block, Math.min(out.get(block) ?? d.start, d.start));
                }
            }
        }
        this.refused.set(database, out);
        return out;
    }

    /** Every definition of a database, in every file. */
    private allDefinitions(database: string): Definition[] {
        const id = this.strings.find(database);
        const out: Definition[] = [];
        if (id < 0) {
            return out;
        }
        for (const file of this.files) {
            if (file === undefined) {
                continue;
            }
            for (let i = 0; i * DEF_STRIDE < file.defs.length; i++) {
                if (file.defs[i * DEF_STRIDE + DEF.database] === id) {
                    out.push(this.definition(file.id * SPAN + i));
                }
            }
        }
        return out;
    }

    /**
     * An alias line's answer (format 8, `coat-of-arms-alias`): the deciding key-resolution row
     * of the database that carries `alias` is replayed over every top-level statement of the
     * database in the order the game reads them. Undefined when no such row holds, or when the
     * name has nothing to do with an alias line (then the other rows answer as before).
     */
    private aliasAnswer(
        database: string,
        name: string,
        definitions: readonly Definition[],
    ): Resolution | undefined {
        const rows = this.platformRules.filter(
            (r): r is KeyResolutionRule =>
                r.kind === 'key-resolution' &&
                r.alias !== undefined &&
                r.databases.some((d) => databaseMatches(d, database)),
        );
        if (rows.length === 0) {
            return undefined;
        }
        const row = rows.find((r) => decides(r) && r.alias !== undefined && aliasApplies(r.alias));
        const hasLine = definitions.some((d) => d.form === 'value' && d.read !== 'no');
        if (row === undefined) {
            // A row says what an alias line is, but decides nothing the index can replay.
            const pending = rows[0];
            return hasLine && pending !== undefined
                ? {
                      status: 'unknown',
                      definitions,
                      reasons: [
                          {
                              kind: 'not-settled',
                              database,
                              rule: pending.id,
                              status: pending.status,
                              overrides_rule: pending.overrides_rule,
                          },
                      ],
                  }
                : undefined;
        }
        const replay = this.replay(database);
        if (!replay.involved.has(name)) {
            return undefined;
        }
        if (replay.unordered !== null) {
            return {
                status: 'unknown',
                definitions,
                reasons: [{ kind: 'no-order', database, rule: replay.unordered }],
            };
        }
        const uncertain = replay.uncertain.get(name);
        if (uncertain !== undefined) {
            return {
                status: 'unknown',
                definitions,
                reasons: uncertain.map((d) => ({
                    kind: 'file-unknown' as const,
                    layer: d.layer,
                    file: d.file,
                    questions: this.fileStatus(d.layer, d.file)?.questions ?? [],
                })),
            };
        }
        const binding = replay.bound.get(name);
        const object = binding === undefined ? undefined : replay.objects[binding.object];
        if (binding === undefined || object === undefined) {
            // Every line of the name had a target not read yet: none did anything.
            return { status: 'not-in-force', definitions, rule: row.id };
        }
        const recordRule = this.keyRule(database, ['record'])?.id ?? row.id;
        return {
            status: 'winner',
            definitions,
            winner: binding.by,
            combine: 'whole',
            rule: binding.by.form === 'value' ? row.id : recordRule,
            shared: {
                target: binding.by.form === 'value' ? binding.by.value : null,
                filledBy: object.filledBy,
                names: [...object.names].sort(),
            },
        };
    }

    /**
     * Replay a database's top-level statements as an alias row says (`ALIAS_APPLIED`): in read
     * order, a block for a name that points to an object is read into that object (the name's
     * own, or the one it shares), else makes a new one; a line `key = other_key` points the key
     * to the object `other_key` points to when that name is read already, and does nothing when
     * it is not. A value line whose key is a container key is no alias line.
     */
    private replay(database: string): AliasReplay {
        const known = this.replays.get(database);
        if (known !== undefined) {
            return known;
        }
        const containers = this.containersFor(database);
        const statements = this.allDefinitions(database).filter(
            (d) =>
                d.read !== 'no' &&
                d.container === null &&
                (d.form === 'record' ||
                    (d.form === 'value' &&
                        d.value !== null &&
                        containers !== 'all' &&
                        containers?.has(d.name) !== true)),
        );
        const ordered = this.inOrder(database, statements);
        const replay: AliasReplay = {
            unordered:
                ordered === undefined ? (this.orderRule(database)?.id ?? 'file-order') : null,
            bound: new Map(),
            objects: [],
            involved: new Set(),
            uncertain: new Map(),
        };
        const touched: (Definition[] | undefined)[] = [];
        for (const s of ordered ?? statements) {
            if (s.form === 'value') {
                replay.involved.add(s.name);
            }
        }
        for (const s of ordered ?? []) {
            const bound = replay.bound.get(s.name);
            if (s.form === 'record') {
                if (bound === undefined) {
                    replay.objects.push({ filledBy: s, names: new Set([s.name]) });
                    touched.push(s.read === 'unknown' ? [s] : []);
                    replay.bound.set(s.name, { object: replay.objects.length - 1, by: s });
                } else {
                    const object = replay.objects[bound.object];
                    if (object !== undefined) {
                        object.filledBy = s;
                    }
                    if (s.read === 'unknown') {
                        touched[bound.object]?.push(s);
                    }
                    replay.bound.set(s.name, { object: bound.object, by: s });
                }
                continue;
            }
            const target = replay.bound.get(s.value ?? '');
            if (target === undefined) {
                // The target is not read yet: the line does nothing (`target_missing`).
                continue;
            }
            if (bound !== undefined) {
                replay.objects[bound.object]?.names.delete(s.name);
            }
            replay.objects[target.object]?.names.add(s.name);
            if (s.read === 'unknown') {
                touched[target.object]?.push(s);
            }
            replay.bound.set(s.name, { object: target.object, by: s });
        }
        for (const [name, binding] of replay.bound) {
            const object = replay.objects[binding.object];
            if (object !== undefined && object.names.size > 1) {
                for (const n of object.names) {
                    replay.involved.add(n);
                }
            }
            const unsure = touched[binding.object] ?? [];
            if (unsure.length > 0) {
                replay.uncertain.set(name, unsure);
            }
        }
        this.replays.set(database, replay);
        return replay;
    }

    /** The definition read last, or first, of a pool, by the database's `file-order` row. */
    private byOrder(
        database: string,
        definitions: readonly Definition[],
        pool: readonly Definition[],
        resolve: Extract<Resolve, 'later-wins' | 'earlier-wins'>,
        combine: 'whole' | 'fields' | 'partial',
        rule: string,
    ): Resolution {
        const order = this.orderRule(database);
        if (order === undefined) {
            return {
                status: 'unknown',
                definitions,
                reasons: [{ kind: 'no-order', database, rule }],
            };
        }
        const sorted = sortByOrder(pool, order);
        if (sorted === undefined) {
            return {
                status: 'unknown',
                definitions,
                reasons: [{ kind: 'no-order', database, rule: order.id }],
            };
        }
        const winner = (resolve === 'later-wins' ? sorted.at(-1) : sorted[0]) as Definition;
        return { status: 'winner', definitions, winner, combine, rule };
    }

    /**
     * The `on_replace` (format 9) a deciding key-resolution row of a nested definition's folder
     * gives its kind (`<folder>#<kind>`): on the row itself or in an entry of its
     * `details.key_spaces`, with the kind among `nested_kinds`. Only `dropped` and `unknown` act;
     * `kept` and `not-applicable` leave the name as the index answers it without them.
     */
    private onReplaceOf(database: string):
        | {
              readonly folder: string;
              readonly nested: string;
              readonly status: RowStatus;
              readonly rule: KeyResolutionRule;
          }
        | undefined {
        const at = database.indexOf('#');
        if (at < 0) {
            return undefined;
        }
        const folder = database.slice(0, at);
        const kind = database.slice(at + 1);
        for (const rule of this.rules) {
            if (
                rule.kind !== 'key-resolution' ||
                !rule.databases.some((d) => databaseMatches(d, folder))
            ) {
                continue;
            }
            const found: OnReplace[] = rule.on_replace === undefined ? [] : [rule.on_replace];
            const spaces = rule.details?.['key_spaces'];
            for (const space of isJson(spaces) ? Object.values(spaces) : []) {
                if (isJson(space) && isJson(space['on_replace'])) {
                    found.push(space['on_replace'] as unknown as OnReplace);
                }
            }
            const own = found.find((r) => (r.nested_kinds ?? []).includes(kind));
            if (own !== undefined && (own.nested === 'dropped' || own.nested === 'unknown')) {
                const status =
                    own.status !== undefined && oneOfStatus(own.status) ? own.status : rule.status;
                return { folder, nested: own.nested, status, rule };
            }
        }
        return undefined;
    }

    /**
     * What became of the definition a nested definition is written in (format 9, `on_replace`):
     * the innermost definition of the folder's database in the same file whose block holds it.
     * `in-force` when that definition is the one in force (or is the only one), `replaced` when
     * another definition of it is, `unknown` when which one is in force is not known.
     */
    private parentFate(d: Definition, folder: string): 'in-force' | 'replaced' | 'unknown' {
        const parent = this.definitionsIn(d.layer, d.file)
            .filter(
                (p) =>
                    p.database === folder &&
                    (p.form === 'record' || p.form === 'entry') &&
                    p.start < d.start &&
                    d.start <= p.extentEnd,
            )
            .at(-1);
        if (parent === undefined) {
            return 'in-force';
        }
        const resolution = this.resolve(parent.database, parent.name, parent.container);
        switch (resolution.status) {
            case 'single':
            case 'winner':
                return resolution.winner.layer === parent.layer &&
                    resolution.winner.file === parent.file &&
                    resolution.winner.start === parent.start
                    ? 'in-force'
                    : 'replaced';
            case 'unknown':
                return 'unknown';
            default:
                return 'in-force';
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

    /**
     * Every place a scope is saved as `name` (`save_scope_as = name`; `FolderTable.saveKeys`),
     * sorted by layer, path and place: where `scope:name` can come from.
     */
    savedScopes(name: string): Use[] {
        return this.placesOf(name, this.bySave, (file) => file.saves);
    }

    /** Every place `name` is read as a saved scope (`scope:name`), sorted as `savedScopes`. */
    scopeReads(name: string): Use[] {
        return this.placesOf(name, this.byRead, (file) => file.reads);
    }

    /**
     * Whether some file writes `name` other than as the name of a saved-scope read
     * (`scope:name`): as any other word, a save among them. A name no file writes otherwise is
     * saved by no script at all.
     */
    isUsedBesideScopeReads(name: string): boolean {
        const id = this.strings.find(name);
        if (id < 0) {
            return false;
        }
        const readers = new Set(this.byRead.get(id) ?? []);
        for (const file of this.files) {
            if (file === undefined || !containsSorted(file.names, id)) {
                continue;
            }
            if (!readers.has(file.id)) {
                return true;
            }
            const count = (array: Int32Array): number => {
                let n = 0;
                for (let i = 0; i < array.length; i += USE_STRIDE) {
                    if (array[i] === id) {
                        n++;
                    }
                }
                return n;
            };
            if (count(file.uses) > count(file.reads)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Every word a file writes with a `$PARAM$` beside literal text (`been_to_$SCENE$`), each
     * once, sorted: each stands for every name it can become (`nameTemplatePattern`).
     */
    nameTemplates(): readonly string[] {
        if (this.templateWords === null) {
            const ids = new Set<number>();
            for (const file of this.files) {
                for (const id of this.useNames(file?.templates ?? [])) {
                    ids.add(id);
                }
            }
            this.templateWords = [...ids].map((id) => this.strings.get(id)).sort(compareStrings);
        }
        return this.templateWords;
    }

    /**
     * Format 9: every place a variable of this namespace and kind (`holds`) is set as `name`
     * (`set_variable = { name = x }`, `add_to_variable_list`; the table `variables`), sorted as
     * `savedScopes`. A set whose name holds a `$PARAM$` is found under its template
     * (`variableSetTemplates`).
     */
    variableSets(namespace: string, holds: string, name: string): Use[] {
        return this.placesOf(
            variableKey(namespace, holds, name),
            this.byVarSet,
            (file) => file.varSets,
        );
    }

    /**
     * Format 9: every variable set whose name holds a `$PARAM$`, each once, sorted, as
     * `variableKey` writes it: each stands for every name it can become (`nameTemplatePattern`),
     * and one that is only a `$PARAM$` (`name = $VAR$`) for any name its callers pass.
     */
    variableSetTemplates(): readonly string[] {
        if (this.variableTemplates === null) {
            const ids = new Set<number>();
            for (const file of this.files) {
                for (const id of this.useNames(file?.varSets ?? [])) {
                    if (this.strings.get(id).includes('$')) {
                        ids.add(id);
                    }
                }
            }
            this.variableTemplates = [...ids]
                .map((id) => this.strings.get(id))
                .sort(compareStrings);
        }
        return this.variableTemplates;
    }

    /**
     * Whether some file writes `name` other than as the name of a variable statement (a keyword
     * of the table `variables`, or `var:name`): as any other word, a value passed to a parameter
     * among them. A name no file writes otherwise reaches no set whose name is a `$PARAM$`.
     */
    isUsedBesideVariableStatements(name: string): boolean {
        const id = this.strings.find(name);
        if (id < 0) {
            return false;
        }
        const count = (array: Int32Array): number => {
            let n = 0;
            for (let i = 0; i < array.length; i += USE_STRIDE) {
                if (array[i] === id) {
                    n++;
                }
            }
            return n;
        };
        for (const file of this.files) {
            if (file === undefined || !containsSorted(file.names, id)) {
                continue;
            }
            if (count(file.uses) > count(file.varNames)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Format 9: the names the text of the localization key `key` reads as a saved scope or value
     * (part D9's forms, `FolderTable.textScopeForms`), in any language, in files the game reads
     * or may read; each once, sorted.
     */
    textScopeReads(key: string): string[] {
        const out = new Set<string>();
        for (const d of this.definitions(key)) {
            if (d.read === 'no' || d.form !== 'key') {
                continue;
            }
            const id = this.byKey.get(`${d.layer}\u0000${d.file}`);
            const file = id === undefined ? undefined : this.files[id];
            if (file === undefined) {
                continue;
            }
            for (let i = 0; i < file.textReads.length; i += USE_STRIDE) {
                const at = file.textReads[i + 1] ?? -1;
                if (at >= d.start && at < d.extentEnd) {
                    out.add(this.strings.get(file.textReads[i] ?? -1));
                }
            }
        }
        return [...out].sort(compareStrings);
    }

    /** The places of a name in one of the per-file arrays of names and offsets. */
    private placesOf(
        name: string,
        byName: { get(key: number): readonly number[] | undefined },
        arrayOf: (file: FileEntry) => Int32Array,
    ): Use[] {
        const id = this.strings.find(name);
        const out: Use[] = [];
        for (const fileId of id < 0 ? [] : (byName.get(id) ?? [])) {
            const file = this.files[fileId];
            if (file === undefined) {
                continue;
            }
            const read = this.statusOf(fileId).read;
            const array = arrayOf(file);
            for (let i = 0; i < array.length; i += USE_STRIDE) {
                if (array[i] === id) {
                    const start = array[i + 1] ?? 0;
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

    /** Whether the index holds any definition of `name`, in any database. */
    hasDefinition(name: string): boolean {
        return this.handlesOf(name).length > 0;
    }

    /** Whether any file uses `name` (`references` would list a use of it). */
    isUsed(name: string): boolean {
        const id = this.strings.find(name);
        if (id < 0) {
            return false;
        }
        if (this.usedBits === null) {
            const bits = new Uint8Array(this.strings.size);
            for (const file of this.files) {
                for (const n of file?.names ?? []) {
                    bits[n] = 1;
                }
            }
            this.usedBits = bits;
        }
        return this.usedBits[id] === 1;
    }

    /**
     * Whether a file writes `word` as one scope chain (`my_mod.event.t`): the index records a
     * chain's segments as uses of their own, so the whole word is found as consecutive uses of
     * its segments, each where the one before ends past its `.`.
     */
    isUsedAsChain(word: string): boolean {
        const segments = word.split('.');
        const ids = segments.map((s) => this.strings.find(s));
        if (segments.length < 2 || ids.some((id) => id < 0)) {
            return false;
        }
        const first = ids[0] ?? -1;
        for (const file of this.files) {
            if (file === undefined || !ids.every((id) => containsSorted(file.names, id))) {
                continue;
            }
            const uses = file.uses;
            for (let i = 0; i < uses.length; i += USE_STRIDE) {
                if (uses[i] !== first) {
                    continue;
                }
                let at = (uses[i + 1] ?? 0) + (segments[0]?.length ?? 0) + 1;
                let ok = true;
                for (let j = 1; j < segments.length && ok; j++) {
                    const k = i + j * USE_STRIDE;
                    ok = uses[k] === ids[j] && uses[k + 1] === at;
                    at += (segments[j]?.length ?? 0) + 1;
                }
                if (ok) {
                    return true;
                }
            }
        }
        return false;
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
            const saves: string[] = [];
            for (let i = 0; i < file.saves.length; i += USE_STRIDE) {
                saves.push(`${s(file.saves[i] ?? -1)}\u0001${String(file.saves[i + 1])}`);
            }
            hash.update(`saves\u0000${saves.join('\n')}`);
            const reads: string[] = [];
            for (let i = 0; i < file.reads.length; i += USE_STRIDE) {
                reads.push(`${s(file.reads[i] ?? -1)}\u0001${String(file.reads[i + 1])}`);
            }
            hash.update(`reads\u0000${reads.join('\n')}`);
            const templates: string[] = [];
            for (let i = 0; i < file.templates.length; i += USE_STRIDE) {
                templates.push(
                    `${s(file.templates[i] ?? -1)}\u0001${String(file.templates[i + 1])}`,
                );
            }
            hash.update(`templates\u0000${templates.join('\n')}`);
            for (const [label, array] of [
                ['varSets', file.varSets],
                ['varNames', file.varNames],
                ['textReads', file.textReads],
            ] as const) {
                const out: string[] = [];
                for (let i = 0; i < array.length; i += USE_STRIDE) {
                    out.push(`${s(array[i] ?? -1)}\u0001${String(array[i + 1])}`);
                }
                hash.update(`${label}\u0000${out.join('\n')}`);
            }
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

/** The scopes of a row's `within` (format 9, D1's `vocabulary.within.scopes`). */
const SAME_BLOCK = 'same-block';
const SAME_PRIORITY = 'same-priority';
const SAME_SEGMENT = 'same-segment';

/** A row's `within` entry for one scope (format 9), or undefined when the row gives none. */
function withinOf(rule: Rule, scope: string): Within | undefined {
    return rule.within?.find((w) => w.scope === scope);
}

/**
 * How a folder-wins row tests a file's path: its `path_match` (format 9): `anywhere-in-path`
 * with `bytes`, its `text` searched in the whole relative path. Without a `path_match`, the
 * row's folder name written byte for byte at any depth (format 8's reading of `segment`).
 * Undefined for a path test the index does not know: the row then decides nothing.
 */
function folderPathTest(rule: FolderWinsRule): ((file: string) => boolean) | undefined {
    const match = rule.path_match;
    if (match === undefined) {
        return (file) => segmentsOf(parentOf(file)).includes(rule.segment);
    }
    if (
        match.compare === 'bytes' &&
        match.where === 'anywhere-in-path' &&
        match.text !== undefined
    ) {
        const text = match.text;
        return (file) => file.includes(text);
    }
    return undefined;
}

/** Whether a word is a row status of the table (`settled`, `partial`, `derived`, `open`). */
function oneOfStatus(value: string): value is RowStatus {
    return (ROW_STATUSES as readonly string[]).includes(value);
}
