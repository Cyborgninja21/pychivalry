/**
 * The override rules, as data (docs/PLAN.md item 3.1a; docs/overrides.md). The index holds no
 * rule of its own: which file replaces which, which of two definitions is in force, which
 * top-level keys are containers, how the files of a DLC sit in the game's tree, all come from
 * a table the caller passes in. Where the table has no row for a question, the index names no
 * answer ("defined more than once, winner not known").
 *
 * The table is part D1 of the spec package (`override_rules.data`, read by `rulesFromSpec`),
 * read out of the game's executables by the spec work. Its rows are of pychivalry's nine kinds
 * (one per kind of question docs/overrides.md asks) and of eight kinds the spec work added
 * (`extension`); every row carries a `status` and, per platform, what it rests on
 * (`platform_basis`). `readRulesTable` checks the shape the index reads and the meaning a
 * schema cannot (a row's databases, its fields, two rows answering one question); the
 * package's own JSON Schema is checked by `task spec:check`.
 *
 * Which rows the index builds on (docs/decisions.md, "Awaiting confirmation"): a row whose
 * status is `settled` or `derived` decides; a `partial` or `open` row decides nothing, and a
 * question only such a row answers stays "winner not known". Of the extension kinds the index
 * applies `listing-depth`; the others it reads and does not apply (`APPLIED_KINDS`).
 */

import { createHash } from 'node:crypto';

/** The systems a rule can hold on: Linux and Windows are supported equally (docs/MVP.md). */
export type Platform = 'linux' | 'windows';
export const PLATFORMS: readonly Platform[] = ['linux', 'windows'];

/**
 * The layer a file comes from: one of the install's three folders, a DLC pack, or the mod.
 * In a row, `dlc` stands for every pack; a file's layer is `dlc:<pack folder>`.
 */
export type LayerName = 'clausewitz' | 'jomini' | 'game' | 'dlc' | 'mod';
export const LAYER_NAMES: readonly LayerName[] = ['clausewitz', 'jomini', 'game', 'dlc', 'mod'];

/**
 * How a definition is written (docs/overrides.md, "What this means for step 3"):
 *
 * - `record`: a `key = { ... }` (at the top level, or nested where part D3 says);
 * - `value`: a top-level `key = value`;
 * - `prefixed`: a top-level `word key = { ... }` (`scripted_trigger name = { }`);
 * - `constant`: a top-level `@name = value`;
 * - `container`: a top-level key a `containers` row names, whose entries are the definitions;
 * - `entry`: a definition inside a container;
 * - `key`: a localization key;
 * - `file`: a record named by its file (part D3, `file_named`).
 */
export type Form =
    'record' | 'value' | 'prefixed' | 'constant' | 'container' | 'entry' | 'key' | 'file';
export const FORMS: readonly Form[] = [
    'record',
    'value',
    'prefixed',
    'constant',
    'container',
    'entry',
    'key',
    'file',
];

/** A row's status in the package (`override_rules.data.vocabulary.status`). */
export type RowStatus = 'settled' | 'partial' | 'derived' | 'open';
export const ROW_STATUSES: readonly RowStatus[] = ['settled', 'partial', 'derived', 'open'];

/**
 * The statuses whose rows the index builds on. `settled`: the code in the cited functions
 * shows it. `derived`: reasoned from code that was read plus a stated fact outside the code
 * (the file system's behaviour). `partial` (part of it not shown) and `open` (located, not
 * followed) rows name nothing.
 */
export const DECIDING_STATUSES: ReadonlySet<RowStatus> = new Set<RowStatus>(['settled', 'derived']);

/** What a row rests on for one platform (`platform_basis.<platform>.basis`). */
export type PlatformBasis = 'read' | 'derived' | 'derived-not-read' | 'assumed-same-engine';
export const PLATFORM_BASES: readonly PlatformBasis[] = [
    'read',
    'derived',
    'derived-not-read',
    'assumed-same-engine',
];

/** One piece of evidence for a rule, ranked as in docs/references/README.md. */
export interface RuleEvidence {
    readonly rank: number;
    /** Where it is: the executable, a file with `<game dir>` for the game folder, or a measurement. */
    readonly source: string;
    readonly where: string;
    /** What it shows. */
    readonly says: string;
    readonly [key: string]: unknown;
}

interface RuleBase {
    /** Stable identifier of the row. */
    readonly id: string;
    /** The rule's number in docs/overrides.md. */
    readonly overrides_rule: number;
    readonly title: string;
    readonly platforms: readonly Platform[];
    readonly evidence: readonly RuleEvidence[];
    readonly status: RowStatus;
    /** Per platform the row holds on, what it rests on. */
    readonly platform_basis: Readonly<
        Partial<Record<Platform, { readonly basis: PlatformBasis; readonly text: string }>>
    >;
    /** What the row's kind cannot say (`details.within_one_block`, `details.among_segment`, ...). */
    readonly details?: Readonly<Record<string, unknown>>;
    /** For a row that is not settled: what is not shown. */
    readonly open?: string;
    readonly note?: string;
    /**
     * Format 8: the files the row decides contribute nothing, whatever the row's kind
     * (`msg-localization-missing-bom`: a localization file without a byte-order mark).
     */
    readonly file_condition?: FileCondition;
    /** Format 9: what makes two keys of the row one key (`key_identity`). */
    readonly key_identity?: KeyIdentity;
    /** Format 9: what replacing a definition takes with it (`on_replace`). */
    readonly on_replace?: OnReplace;
    /** Format 9: where the row's main rule does not decide, what does (`within`). */
    readonly within?: readonly Within[];
    /** Format 9: how the definitions of one key add up (`merge`). */
    readonly merge?: Merge;
    /** Format 9, a folder-wins or replace-path row: how a path is tested (`path_match`). */
    readonly path_match?: PathMatch;
    /** Format 9, a file-order row: what its `compare` is applied to (`compare_unit`). */
    readonly compare_unit?: string;
    /** Format 9, a pack-layer row: how deep descriptors are looked for (`pack`). */
    readonly pack?: { readonly descriptors?: string; readonly archive_key?: string };
    readonly [key: string]: unknown;
}

/**
 * Format 9 (D1, `key_identity`): what makes two keys one key. `compare` how the key's first part
 * compares (`bytes`, `hash`, `integer`, `keyword`, `lowercase` or `unknown`), `parts` what the key
 * is made of, `part_compare` how another part compares, `scope` among which keys.
 */
export interface KeyIdentity {
    readonly compare: string;
    readonly parts: readonly string[];
    readonly part_compare?: Readonly<Record<string, string>>;
    readonly scope?: string;
    readonly key_space?: string;
    readonly nested_kinds?: readonly string[];
    readonly status?: string;
}

/**
 * Format 9 (D1, `on_replace`): what the replacement of a definition takes with it. `nested`:
 * `dropped` (the replaced definition's nested definitions of `nested_kinds` go with it), `kept`,
 * `unknown` or `not-applicable`; `position` what becomes of its place in the order.
 */
export interface OnReplace {
    readonly nested: string;
    readonly nested_kinds?: readonly string[];
    readonly position: string;
    readonly status?: string;
}

/**
 * Format 9 (D1, `within`): where the row's main rule does not decide, what does: between two
 * statements of one key in one block (`same-block`), between definitions of equal priority
 * (`same-priority`), between two files under the row's folder (`same-segment`); `resolve` in read
 * order, `combine` what the winner takes, `message` the message row the game logs for it.
 */
export interface Within {
    readonly scope: string;
    readonly resolve: string;
    readonly combine: string;
    readonly message?: string;
}

/**
 * Format 9 (D1, `merge`): how the definitions of one key add up on a row whose `resolve` is
 * `all` (or whose `combine` is partial): what is added (`unit`), how (`how`: `appended`,
 * `read-into-one-object`), in what order they take effect (`applied`), and which is in force where
 * two set the same thing (`same_target`).
 */
export interface Merge {
    readonly unit: string;
    readonly how: string;
    readonly applied: string;
    readonly same_target: string;
    readonly per_field?: string;
    readonly status?: string;
}

/**
 * Format 9 (D1, `path_match`): how a folder-wins or replace-path row tests a path: `compare`
 * (`bytes`), `where` (`anywhere-in-path`, with the `text` searched; `whole-listed-directory`).
 */
export interface PathMatch {
    readonly compare: string;
    readonly where: string;
    readonly text?: string;
}

/**
 * Which files contribute nothing, as data (`file_condition`, format 8): the files (a folder,
 * an extension, whether its subfolders count), the condition they meet and its effect. The
 * index applies the conditions and effects it knows (`FILE_CONDITIONS`, `FILE_EFFECTS`); the
 * words of `which` and `test` are prose and are not read.
 */
export interface FileCondition {
    readonly files: {
        readonly folder: string;
        readonly extension: string;
        readonly recursive: boolean;
        readonly which?: string;
    };
    readonly condition: string;
    readonly effect: string;
    readonly test?: string;
}

/** The file conditions the index tests: `no-utf8-bom`, the file does not start with EF BB BF. */
export const FILE_CONDITIONS: readonly string[] = ['no-utf8-bom'];
/** The effects the index applies: `no-definitions`, none of the file's keys is added. */
export const FILE_EFFECTS: readonly string[] = ['no-definitions'];

/** A file in `layer` replaces, whole, the file at the same relative path in each of `over`. */
export interface FileReplaceRule extends RuleBase {
    readonly kind: 'file-replace';
    readonly layer: LayerName;
    readonly over: readonly LayerName[];
}

/** What identifies a file: its whole relative path. Files at other paths never replace it. */
export interface FileIdentityRule extends RuleBase {
    readonly kind: 'file-identity';
    readonly by: 'relative-path';
}

/** How paths that differ only in letter case compare: as the same path, or as two. */
export interface PathCaseRule extends RuleBase {
    readonly kind: 'path-case';
    readonly compare: 'exact' | 'case-insensitive';
}

/**
 * Packs inside an install folder (the DLCs): every folder holding a descriptor file with this
 * extension is a pack, the descriptor's `path_key` names the pack's folder, and a file of the
 * pack sits in the game's tree at its path inside that folder.
 */
export interface PackLayerRule extends RuleBase {
    readonly kind: 'pack-layer';
    readonly layer: 'game' | 'jomini' | 'clausewitz';
    readonly folder: string;
    readonly descriptor_extension: string;
    readonly path_key: string;
}

/**
 * `replace_path` in a mod's descriptor hides the files of `hides` directly in that folder,
 * written byte for byte as the path (the package's `details.match`).
 */
export interface ReplacePathRule extends RuleBase {
    readonly kind: 'replace-path';
    readonly hides: readonly LayerName[];
    /** True when the files in the path's subfolders are hidden too. */
    readonly subfolders: boolean;
}

/** The order files are read in. */
export interface FileOrderRule extends RuleBase {
    readonly kind: 'file-order';
    /** The databases it holds for; absent, every one. */
    readonly databases?: readonly string[];
    /** How two names compare: by their UTF-8 bytes, or without regard to case. */
    readonly compare: 'bytes' | 'case-insensitive';
    /** Where a subfolder's files fall: by their whole path, or before or after the folder's own. */
    readonly subfolders: 'by-path' | 'files-first' | 'folders-first';
    /** `together`: every layer's files sorted into one list; `in-order`: layer by layer. */
    readonly layers: 'together' | 'in-order';
    /** The layers, first read first: the order for `in-order`, the tie-break for `together`. */
    readonly layer_order: readonly LayerName[];
}

/** How a `key-resolution` row resolves (`resolve`). */
export type Resolve = 'priority' | 'later-wins' | 'earlier-wins' | 'all' | 'statements';
export const RESOLVES: readonly Resolve[] = [
    'priority',
    'later-wins',
    'earlier-wins',
    'all',
    'statements',
];

/** What is in force when a key of a database is defined more than once. */
export interface KeyResolutionRule extends RuleBase {
    readonly kind: 'key-resolution';
    readonly databases: readonly string[];
    /** The forms it holds for; absent, every one. */
    readonly forms?: readonly Form[];
    /**
     * `priority`: the definition with the largest `priority_field` wins, equal largest values
     * are a clash; `later-wins`, `earlier-wins`: by the order of a `file-order` row, then the
     * place in the file; `all`: every definition adds to the result; `statements`: the folder
     * is not keyed, every definition is a statement and is read.
     */
    readonly resolve: Resolve;
    readonly priority_field?: string;
    readonly priority_default?: number;
    /**
     * What the winner takes: `whole`, the record; `fields`, the fields it sets over the
     * others'; `partial`, the fields the rule's note names, the rest adding up.
     */
    readonly combine?: 'whole' | 'fields' | 'partial';
    /** Format 8: the row's form is an alias line, `key = other_key` (`coat-of-arms-alias`). */
    readonly alias?: AliasRule;
}

/**
 * An alias line as data (format 8, `alias` of a key-resolution row): when the alias is made,
 * whether its target must be read first, whether the key and the target share one object, what
 * a missing target keeps, and what holds when the key is also written as a block after the
 * line (`before_block`), before it (`after_block`) or as an alias again (`repeated`). The
 * index applies the values of `ALIAS_APPLIED`; a row with any other value decides nothing.
 */
export interface AliasRule {
    readonly form: string;
    readonly made: string;
    readonly requires_target_read_first: boolean;
    readonly shares_object: boolean;
    readonly target_missing: { readonly keeps: string; readonly message?: string };
    readonly after_block: string;
    readonly before_block: string;
    readonly repeated: string;
}

/** The alias the index replays: made when read, on a target already read, one shared object. */
export const ALIAS_APPLIED = {
    made: 'at-read',
    requires_target_read_first: true,
    shares_object: true,
    target_missing: 'first',
    after_block: 'alias-in-force',
    before_block: 'block-read-into-shared-object',
    repeated: 'later-wins',
} as const;

/** Whether the index can replay an alias row: every value is one it applies. */
export function aliasApplies(alias: AliasRule): boolean {
    return (
        alias.made === ALIAS_APPLIED.made &&
        alias.requires_target_read_first === ALIAS_APPLIED.requires_target_read_first &&
        alias.shares_object === ALIAS_APPLIED.shares_object &&
        alias.target_missing.keeps === ALIAS_APPLIED.target_missing &&
        alias.after_block === ALIAS_APPLIED.after_block &&
        alias.before_block === ALIAS_APPLIED.before_block &&
        alias.repeated === ALIAS_APPLIED.repeated
    );
}

/**
 * Top-level keys that are containers: written in several files, they add up, and the
 * definitions are the entries inside them. `keys` names them, or is `["*"]` for every
 * top-level key of the database.
 */
export interface ContainersRule extends RuleBase {
    readonly kind: 'containers';
    readonly databases: readonly string[];
    readonly keys: readonly string[];
    /** Format 8: what the children of the keys are, and the key space of the definitions. */
    readonly entries?: ContainerEntries;
}

/**
 * What a container's children are (format 8, `entries`): the definitions (`holds:
 * definitions`), or container keys themselves (`holds: containers`, those `containers` lists),
 * whose children are the definitions. Definitions of containers that share a `key_space` are
 * definitions of one map; `not_entries` are child keys that are no definition (a gene
 * container's `portrait_group` line).
 */
export interface ContainerEntries {
    readonly holds: 'definitions' | 'containers';
    readonly of: string;
    readonly key_space: string;
    readonly containers?: readonly string[];
    readonly not_entries?: readonly string[];
}

/** A definition in a file under a folder named `segment`, written byte for byte, wins over every other. */
export interface FolderWinsRule extends RuleBase {
    readonly kind: 'folder-wins';
    readonly databases: readonly string[];
    readonly segment: string;
}

/**
 * Extension kind, applied: whether a folder is read with its subfolders. A file directly in a
 * folder is always read; one below a subfolder only when the folder's row says `recursive`.
 */
export interface ListingDepthRule extends RuleBase {
    readonly kind: 'listing-depth';
    readonly databases: readonly string[];
    /** Folders the spec does not list that are read the same way. */
    readonly other_folders?: readonly string[];
    readonly recursive: boolean;
}

/** Extension kinds the index reads and does not apply (`SKIPPED_KINDS` says why). */
export interface ExtensionRule extends RuleBase {
    readonly kind:
        | 'mount-order'
        | 'mount-dependencies'
        | 'key-identity'
        | 'field-outcomes'
        | 'path-case-mechanism'
        | 'duplicate-message'
        | 'open-question';
}

export type Rule =
    | FileReplaceRule
    | FileIdentityRule
    | PathCaseRule
    | PackLayerRule
    | ReplacePathRule
    | FileOrderRule
    | KeyResolutionRule
    | ContainersRule
    | FolderWinsRule
    | ListingDepthRule
    | ExtensionRule;

export type RuleKind = Rule['kind'];

/** pychivalry's own nine kinds (docs/overrides.md). */
export const PYCHIVALRY_KINDS: readonly RuleKind[] = [
    'file-replace',
    'file-identity',
    'path-case',
    'pack-layer',
    'replace-path',
    'file-order',
    'key-resolution',
    'containers',
    'folder-wins',
];

/** The kinds the spec work added (`override_rules.data.extensions`, `what: kind`). */
export const EXTENSION_KINDS: readonly RuleKind[] = [
    'mount-order',
    'mount-dependencies',
    'listing-depth',
    'key-identity',
    'field-outcomes',
    'path-case-mechanism',
    'duplicate-message',
    'open-question',
];

export const RULE_KINDS: readonly RuleKind[] = [...PYCHIVALRY_KINDS, ...EXTENSION_KINDS];

/** The kinds whose deciding rows the index applies. */
export const APPLIED_KINDS: ReadonlySet<RuleKind> = new Set<RuleKind>([
    ...PYCHIVALRY_KINDS,
    'listing-depth',
]);

/**
 * The extension kinds the index does not apply, and why: what each decides stays as the
 * index answers without it (docs/decisions.md, "Awaiting confirmation").
 */
export const SKIPPED_KINDS: Readonly<Record<string, string>> = {
    'mount-order':
        'the order of mods among themselves and of DLC packs among themselves; the index holds one mod, and two packs at one path stay "not known"',
    'mount-dependencies':
        "what a descriptor's dependencies do to the mount order of several mods; the index holds one mod",
    'key-identity':
        "what makes two keys one key: the text byte for byte (or its hash), case not folded, which is how the index already compares keys; the one row that folds case, key-identity-gui-types, is for GUI type names, and the index reads no .gui file. Format 9's key_identity on a store of statements (a province id compared as an integer) is applied where the store is read",
    'field-outcomes':
        'per field of an on-action declared again; the index resolves an on-action as a whole (its declarations add up)',
    'path-case-mechanism':
        'where letter case is compared; its consequence is the two path-case rows',
    'duplicate-message':
        'the message the game logs for a duplicate: the evidence of definitions/clash (item 4.5), not an answer of what is in force; a row of the kind that carries a file_condition has that field applied (fileConditionRules)',
    'open-question': 'located and not followed: names nothing',
};

/** The table: its format, the game build it was read on, and its rows. */
export interface RulesTable {
    /** The table's own format, 1 (`override_rules.data.format`). */
    readonly format: 1;
    /** The game build the rules were read on. */
    readonly game_build: string;
    readonly rules: readonly Rule[];
}

/** The table failed its check; every problem is listed. */
export class RulesTableError extends Error {
    readonly problems: readonly string[];

    constructor(problems: readonly string[]) {
        super(`the override rules table is not valid:\n  ${problems.join('\n  ')}`);
        this.name = 'RulesTableError';
        this.problems = problems;
    }
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The fields each kind requires beyond the base ones, and the optional ones the index reads. */
const KIND_FIELDS: Record<RuleKind, { required: string[]; optional: string[] }> = {
    'file-replace': { required: ['layer', 'over'], optional: [] },
    'file-identity': { required: ['by'], optional: [] },
    'path-case': { required: ['compare'], optional: [] },
    'pack-layer': {
        required: ['layer', 'folder', 'descriptor_extension', 'path_key'],
        optional: [],
    },
    'replace-path': { required: ['hides', 'subfolders'], optional: [] },
    'file-order': {
        required: ['compare', 'subfolders', 'layers', 'layer_order'],
        optional: ['databases'],
    },
    'key-resolution': {
        required: ['databases', 'resolve'],
        optional: ['forms', 'priority_field', 'priority_default', 'combine', 'alias'],
    },
    containers: { required: ['databases', 'keys'], optional: ['entries'] },
    'folder-wins': { required: ['databases', 'segment'], optional: [] },
    'listing-depth': { required: ['databases', 'recursive'], optional: ['other_folders'] },
    'mount-order': { required: [], optional: [] },
    'mount-dependencies': { required: [], optional: [] },
    'key-identity': { required: [], optional: [] },
    'field-outcomes': { required: [], optional: [] },
    'path-case-mechanism': { required: [], optional: [] },
    'duplicate-message': { required: [], optional: [] },
    'open-question': { required: [], optional: [] },
};

const BASE_REQUIRED = [
    'id',
    'overrides_rule',
    'title',
    'kind',
    'platforms',
    'evidence',
    'status',
    'platform_basis',
];

function stringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Every problem with one row. Fields the index does not read are left to the package's schema. */
function rowProblems(row: unknown, at: string): string[] {
    if (!isJson(row)) {
        return [`${at}: is not an object`];
    }
    const problems: string[] = [];
    const kind = row['kind'];
    if (!oneOf(kind, RULE_KINDS)) {
        return [`${at}: kind ${JSON.stringify(kind)} is not one of ${RULE_KINDS.join(', ')}`];
    }
    const fields = KIND_FIELDS[kind];
    for (const key of [...BASE_REQUIRED, ...fields.required]) {
        if (!(key in row)) {
            problems.push(`${at}: ${key} is missing`);
        }
    }
    if (typeof row['id'] !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(row['id'])) {
        problems.push(`${at}: id must be lower-case words joined by hyphens`);
    }
    const rule = row['overrides_rule'];
    if (typeof rule !== 'number' || !Number.isInteger(rule) || rule < 1) {
        problems.push(`${at}: overrides_rule must be a rule number of docs/overrides.md`);
    }
    if (typeof row['title'] !== 'string' || row['title'] === '') {
        problems.push(`${at}: title must be text`);
    }
    if ('note' in row && (typeof row['note'] !== 'string' || row['note'] === '')) {
        problems.push(`${at}: note must be text`);
    }
    if (!oneOf(row['status'], ROW_STATUSES)) {
        problems.push(`${at}: status must be one of ${ROW_STATUSES.join(', ')}`);
    }
    if ('details' in row && !isJson(row['details'])) {
        problems.push(`${at}: details must be an object`);
    }
    const platforms = row['platforms'];
    if (
        !Array.isArray(platforms) ||
        platforms.length === 0 ||
        !platforms.every((p) => oneOf(p, PLATFORMS))
    ) {
        problems.push(`${at}: platforms must list one or more of ${PLATFORMS.join(', ')}`);
    } else {
        const basis = row['platform_basis'];
        for (const platform of platforms) {
            const entry = isJson(basis) ? basis[platform] : undefined;
            if (!isJson(entry) || !oneOf(entry['basis'], PLATFORM_BASES)) {
                problems.push(
                    `${at}: platform_basis.${platform} must give a basis: ${PLATFORM_BASES.join(', ')}`,
                );
            }
        }
    }
    const evidence = row['evidence'];
    if (!Array.isArray(evidence) || evidence.length === 0) {
        problems.push(`${at}: evidence must list at least one source`);
    } else {
        evidence.forEach((item: unknown, i) => {
            const where = `${at}.evidence[${String(i)}]`;
            if (!isJson(item)) {
                problems.push(`${where}: is not an object`);
                return;
            }
            const rank = item['rank'];
            if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1 || rank > 5) {
                problems.push(`${where}: rank must be 1 to 5 (docs/references/README.md)`);
            }
            for (const key of ['source', 'where', 'says']) {
                if (typeof item[key] !== 'string' || item[key] === '') {
                    problems.push(`${where}: ${key} must be text`);
                }
            }
        });
    }
    const layers = (key: string, allowed: readonly string[] = LAYER_NAMES): void => {
        const value = row[key];
        if (!Array.isArray(value) || value.length === 0 || !value.every((v) => oneOf(v, allowed))) {
            problems.push(`${at}: ${key} must list one or more of ${allowed.join(', ')}`);
        }
    };
    const databases = (key: string, required: boolean): void => {
        if (!(key in row) && !required) {
            return;
        }
        if (!stringList(row[key]) || row[key].length === 0) {
            problems.push(`${at}: ${key} must list one or more databases`);
        }
    };
    if ('file_condition' in row) {
        problems.push(...fileConditionProblems(row['file_condition'], `${at}.file_condition`));
    }
    problems.push(...format9Problems(row, at));
    switch (kind) {
        case 'file-replace':
            if (!oneOf(row['layer'], LAYER_NAMES)) {
                problems.push(`${at}: layer must be one of ${LAYER_NAMES.join(', ')}`);
            }
            layers('over');
            break;
        case 'file-identity':
            if (row['by'] !== 'relative-path') {
                problems.push(`${at}: by must be relative-path`);
            }
            break;
        case 'path-case':
            if (!oneOf(row['compare'], ['exact', 'case-insensitive'])) {
                problems.push(`${at}: compare must be exact or case-insensitive`);
            }
            break;
        case 'pack-layer':
            if (!oneOf(row['layer'], ['game', 'jomini', 'clausewitz'])) {
                problems.push(`${at}: layer must be an install folder: game, jomini or clausewitz`);
            }
            for (const key of ['folder', 'descriptor_extension', 'path_key']) {
                if (typeof row[key] !== 'string' || row[key] === '') {
                    problems.push(`${at}: ${key} must be text`);
                }
            }
            break;
        case 'replace-path':
            layers('hides');
            if (typeof row['subfolders'] !== 'boolean') {
                problems.push(`${at}: subfolders must be true or false`);
            }
            break;
        case 'file-order':
            databases('databases', false);
            if (!oneOf(row['compare'], ['bytes', 'case-insensitive'])) {
                problems.push(`${at}: compare must be bytes or case-insensitive`);
            }
            if (!oneOf(row['subfolders'], ['by-path', 'files-first', 'folders-first'])) {
                problems.push(`${at}: subfolders must be by-path, files-first or folders-first`);
            }
            if (!oneOf(row['layers'], ['together', 'in-order'])) {
                problems.push(`${at}: layers must be together or in-order`);
            }
            layers('layer_order');
            break;
        case 'key-resolution': {
            databases('databases', true);
            if ('forms' in row) {
                layers('forms', FORMS);
            }
            const resolve = row['resolve'];
            if (!oneOf(resolve, RESOLVES)) {
                problems.push(`${at}: resolve must be ${RESOLVES.join(', ')}`);
            }
            if (resolve === 'priority') {
                if (typeof row['priority_field'] !== 'string' || row['priority_field'] === '') {
                    problems.push(`${at}: a priority rule names its priority_field`);
                }
                const fallback = row['priority_default'];
                if (typeof fallback !== 'number' || !Number.isInteger(fallback)) {
                    problems.push(`${at}: a priority rule gives an integer priority_default`);
                }
            } else if ('priority_field' in row || 'priority_default' in row) {
                problems.push(
                    `${at}: only a priority rule has priority_field and priority_default`,
                );
            }
            const winner =
                resolve === 'priority' || resolve === 'later-wins' || resolve === 'earlier-wins';
            if (winner && !oneOf(row['combine'], ['whole', 'fields', 'partial'])) {
                problems.push(`${at}: a rule that names a winner says what it takes: combine`);
            } else if (!winner && 'combine' in row) {
                problems.push(`${at}: combine is for a rule that names a winner`);
            }
            if ('alias' in row) {
                problems.push(...aliasProblems(row['alias'], `${at}.alias`));
            }
            break;
        }
        case 'containers':
            databases('databases', true);
            if (!stringList(row['keys']) || row['keys'].length === 0) {
                problems.push(`${at}: keys must list one or more top-level keys, or "*"`);
            }
            if ('entries' in row) {
                problems.push(...entriesProblems(row['entries'], `${at}.entries`));
            }
            break;
        case 'folder-wins':
            databases('databases', true);
            if (typeof row['segment'] !== 'string' || /[/\\]/.test(row['segment'])) {
                problems.push(`${at}: segment must be one folder name`);
            }
            break;
        case 'listing-depth':
            databases('databases', true);
            if ('other_folders' in row && !stringList(row['other_folders'])) {
                problems.push(`${at}: other_folders must list folders`);
            }
            if (typeof row['recursive'] !== 'boolean') {
                problems.push(`${at}: recursive must be true or false`);
            }
            break;
        default:
            break;
    }
    return problems;
}

/**
 * The shapes of the format 9 fields of a row the index reads (`key_identity`, `on_replace`,
 * `within`, `merge`, `path_match`, `compare_unit`, `pack`); their values are read where the
 * index applies them, and a value it does not know makes the row decide nothing there.
 */
function format9Problems(row: Json, at: string): string[] {
    const problems: string[] = [];
    const text = (value: unknown): boolean => typeof value === 'string' && value !== '';
    const identity = row['key_identity'];
    if (
        'key_identity' in row &&
        (!isJson(identity) || !text(identity['compare']) || !stringList(identity['parts']))
    ) {
        problems.push(`${at}.key_identity: must give compare and parts`);
    }
    const replace = row['on_replace'];
    if (
        'on_replace' in row &&
        (!isJson(replace) || !text(replace['nested']) || !text(replace['position']))
    ) {
        problems.push(`${at}.on_replace: must give nested and position`);
    }
    const within = row['within'];
    if (
        'within' in row &&
        (!Array.isArray(within) ||
            !within.every(
                (w) => isJson(w) && text(w['scope']) && text(w['resolve']) && text(w['combine']),
            ))
    ) {
        problems.push(`${at}.within: must list scope, resolve and combine`);
    }
    const merge = row['merge'];
    if (
        'merge' in row &&
        (!isJson(merge) || !['unit', 'how', 'applied', 'same_target'].every((k) => text(merge[k])))
    ) {
        problems.push(`${at}.merge: must give unit, how, applied and same_target`);
    }
    const match = row['path_match'];
    if (
        'path_match' in row &&
        (!isJson(match) || !text(match['compare']) || !text(match['where']))
    ) {
        problems.push(`${at}.path_match: must give compare and where`);
    }
    if ('compare_unit' in row && !text(row['compare_unit'])) {
        problems.push(`${at}.compare_unit: must be text`);
    }
    if ('pack' in row && !isJson(row['pack'])) {
        problems.push(`${at}.pack: must be an object`);
    }
    return problems;
}

/** The shape of a `file_condition` (format 8). Its values are read where the index applies them. */
function fileConditionProblems(value: unknown, at: string): string[] {
    if (!isJson(value)) {
        return [`${at}: must be an object`];
    }
    const problems: string[] = [];
    const files = value['files'];
    if (
        !isJson(files) ||
        typeof files['folder'] !== 'string' ||
        files['folder'] === '' ||
        typeof files['extension'] !== 'string' ||
        typeof files['recursive'] !== 'boolean'
    ) {
        problems.push(`${at}.files: must give a folder, an extension and recursive`);
    }
    for (const key of ['condition', 'effect']) {
        if (typeof value[key] !== 'string' || value[key] === '') {
            problems.push(`${at}: ${key} must be text`);
        }
    }
    return problems;
}

/** The shape of an `alias` (format 8). A value the index does not replay makes the row decide nothing. */
function aliasProblems(value: unknown, at: string): string[] {
    if (!isJson(value)) {
        return [`${at}: must be an object`];
    }
    const problems: string[] = [];
    for (const key of ['form', 'made', 'after_block', 'before_block', 'repeated']) {
        if (typeof value[key] !== 'string' || value[key] === '') {
            problems.push(`${at}: ${key} must be text`);
        }
    }
    for (const key of ['requires_target_read_first', 'shares_object']) {
        if (typeof value[key] !== 'boolean') {
            problems.push(`${at}: ${key} must be true or false`);
        }
    }
    const missing = value['target_missing'];
    if (!isJson(missing) || typeof missing['keeps'] !== 'string') {
        problems.push(`${at}: target_missing must say what it keeps`);
    }
    return problems;
}

/** The shape of a containers row's `entries` (format 8). */
function entriesProblems(value: unknown, at: string): string[] {
    if (!isJson(value)) {
        return [`${at}: must be an object`];
    }
    const problems: string[] = [];
    const holds = value['holds'];
    if (!oneOf(holds, ['definitions', 'containers'])) {
        problems.push(`${at}: holds must be definitions or containers`);
    } else if (
        holds === 'containers' &&
        (!stringList(value['containers']) || value['containers'].length === 0)
    ) {
        problems.push(`${at}: a row whose keys hold containers lists them: containers`);
    }
    for (const key of ['of', 'key_space']) {
        if (typeof value[key] !== 'string' || value[key] === '') {
            problems.push(`${at}: ${key} must be text`);
        }
    }
    if ('not_entries' in value && !stringList(value['not_entries'])) {
        problems.push(`${at}: not_entries must list keys`);
    }
    return problems;
}

/** Whether a row's database `pattern` covers `database`: the same, or `pattern:` and more. */
export function databaseMatches(pattern: string, database: string): boolean {
    return database === pattern || database.startsWith(`${pattern}:`);
}

/** Two rows of one kind that would answer the same question on one platform. */
function overlapProblems(rules: readonly Rule[]): string[] {
    const problems: string[] = [];
    const seen = new Map<string, string>();
    const claim = (question: string, rule: Rule): void => {
        for (const platform of rule.platforms) {
            const key = `${platform}\u0000${question}`;
            const other = seen.get(key);
            if (other !== undefined && other !== rule.id) {
                problems.push(
                    `rows ${other} and ${rule.id} both answer ${question.replaceAll('\u0000', ' ')} on ${platform}`,
                );
            }
            seen.set(key, rule.id);
        }
    };
    for (const rule of rules) {
        switch (rule.kind) {
            case 'file-replace':
                for (const over of rule.over) {
                    claim(`file-replace\u0000${rule.layer}\u0000${over}`, rule);
                }
                break;
            case 'key-resolution':
                for (const database of rule.databases) {
                    for (const form of rule.forms ?? FORMS) {
                        claim(`key-resolution\u0000${database}\u0000${form}`, rule);
                    }
                }
                break;
            case 'containers':
                for (const database of rule.databases) {
                    for (const key of rule.keys) {
                        claim(`containers\u0000${database}\u0000${key}`, rule);
                    }
                }
                break;
            case 'file-order':
                for (const database of rule.databases ?? ['*']) {
                    claim(`file-order\u0000${database}`, rule);
                }
                break;
            case 'folder-wins':
                for (const database of rule.databases) {
                    claim(`folder-wins\u0000${database}`, rule);
                }
                break;
            case 'listing-depth':
                for (const database of [...rule.databases, ...(rule.other_folders ?? [])]) {
                    claim(`listing-depth\u0000${database}`, rule);
                }
                break;
            case 'file-identity':
            case 'path-case':
            case 'pack-layer':
            case 'replace-path':
                claim(rule.kind, rule);
                break;
            default:
                // An extension the index does not apply answers nothing the index asks.
                break;
        }
    }
    return problems;
}

/**
 * Check a table and return it typed: `{ format, game_build, rules }`, the shape of the spec
 * package's `override_rules.data` (whose other keys are not part of the table). Throws
 * `RulesTableError` listing every problem: an unknown kind or status, a missing field, a value
 * of the wrong kind, two rows with one id, or two rows that answer the same question on one
 * platform.
 */
export function readRulesTable(data: unknown): RulesTable {
    if (!isJson(data)) {
        throw new RulesTableError(['the table is not an object']);
    }
    const problems: string[] = [];
    if (data['format'] !== 1) {
        problems.push(`format is ${JSON.stringify(data['format'])}; this core reads 1`);
    }
    if (typeof data['game_build'] !== 'string' || !/^[0-9]+(\.[0-9]+)+$/.test(data['game_build'])) {
        problems.push('game_build must be a game build such as 1.21.0.3');
    }
    const rows = data['rules'];
    if (!Array.isArray(rows)) {
        problems.push('rules must be a list');
        throw new RulesTableError(problems);
    }
    rows.forEach((row: unknown, i) => {
        problems.push(...rowProblems(row, `rules[${String(i)}]`));
    });
    const ids = new Set<string>();
    for (const row of rows) {
        const id = isJson(row) ? row['id'] : undefined;
        if (typeof id === 'string') {
            if (ids.has(id)) {
                problems.push(`two rows have the id ${id}`);
            }
            ids.add(id);
        }
    }
    if (problems.length > 0) {
        throw new RulesTableError(problems);
    }
    const table: RulesTable = {
        format: 1,
        game_build: data['game_build'] as string,
        rules: rows as Rule[],
    };
    const overlaps = overlapProblems(table.rules);
    if (overlaps.length > 0) {
        throw new RulesTableError(overlaps);
    }
    return table;
}

/** The rules table of a spec package: part D1, `override_rules.data`, checked. */
export function rulesFromSpec(spec: {
    readonly data: { readonly override_rules: unknown };
}): RulesTable {
    const part = spec.data.override_rules;
    if (!isJson(part) || part['status'] !== 'built') {
        throw new RulesTableError([
            'the spec package does not carry part D1 (override_rules) built',
        ]);
    }
    return readRulesTable(part['data']);
}

/** The rows that hold on a platform, whatever their status. */
export function rulesFor(table: RulesTable, platform: Platform): Rule[] {
    return table.rules.filter((rule) => rule.platforms.includes(platform));
}

/** Whether a row decides: its kind is one the index applies, and its status one it builds on. */
export function decides(rule: Rule): boolean {
    return APPLIED_KINDS.has(rule.kind) && DECIDING_STATUSES.has(rule.status);
}

/** The rows the index applies on a platform: those that hold there and decide. */
export function decidingRules(table: RulesTable, platform: Platform): Rule[] {
    return rulesFor(table, platform).filter(decides);
}

/**
 * The rows whose `file_condition` the index applies on a platform: they hold there, their
 * status is one it builds on (`settled`, `derived`), whatever their kind, and their condition
 * and effect are ones it knows. A `duplicate-message` row stays skipped for the rest.
 */
export function fileConditionRules(table: RulesTable, platform: Platform): Rule[] {
    return rulesFor(table, platform).filter(
        (r) =>
            r.file_condition !== undefined &&
            DECIDING_STATUSES.has(r.status) &&
            FILE_CONDITIONS.includes(r.file_condition.condition) &&
            FILE_EFFECTS.includes(r.file_condition.effect),
    );
}

/**
 * The `resolve` word a `details` text starts with (`earlier-wins: a name written twice in one
 * block yields the first of the two`), or undefined when it starts with none.
 */
export function resolveOfDetail(text: unknown): Resolve | undefined {
    if (typeof text !== 'string') {
        return undefined;
    }
    const word = text.split(':')[0]?.trim();
    return oneOf(word, RESOLVES) ? word : undefined;
}

/** The table with one more row (for tests and callers that try a rule out), checked again. */
export function withRule(table: RulesTable, rule: Rule): RulesTable {
    return readRulesTable({ ...table, rules: [...table.rules, rule] });
}

/** The table with the row of an id replaced by `rule` (for tests), checked again. */
export function withRuleReplaced(table: RulesTable, rule: Rule): RulesTable {
    return readRulesTable({
        ...table,
        rules: table.rules.map((r) => (r.id === rule.id ? rule : r)),
    });
}

/** The platform this process runs on, as a rule names it; undefined for any other system. */
export function currentPlatform(): Platform | undefined {
    if (process.platform === 'win32') {
        return 'windows';
    }
    if (process.platform === 'linux') {
        return 'linux';
    }
    return undefined;
}

/** A JSON text of a value with every object's keys sorted, so equal tables give equal text. */
export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(',')}]`;
    }
    if (isJson(value)) {
        const keys = Object.keys(value).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

/** SHA-256 of the table's canonical JSON: part of the index cache's key. */
export function rulesDigest(table: RulesTable): string {
    return createHash('sha256').update(canonicalJson(table)).digest('hex');
}
