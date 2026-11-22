/**
 * The override rules, as data (docs/PLAN.md item 3.1a; docs/overrides.md). The index holds no
 * rule of its own: which file replaces which, which of two definitions is in force, which
 * top-level keys are containers, how the files of a DLC sit in the game's tree, all come from
 * a table the caller passes in. Where the table has no row for a question, the index names no
 * answer ("defined more than once, winner not known").
 *
 * The table's shape is the vocabulary below: one kind of row per kind of question that
 * docs/overrides.md asks, settled or open, so that a rule the spec work reads out of the
 * executable later is a new row, not new code. The stand-in table that carries the rules
 * overrides.md marks settled is `spec/override-rules.json`; its JSON Schema is
 * `spec/override-rules.schema.json`, and `readRulesTable` checks the same shape and the
 * meaning the schema cannot (a row's databases, its fields).
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
 * - `record`: a top-level `key = { ... }`;
 * - `value`: a top-level `key = value`;
 * - `prefixed`: a top-level `word key = { ... }` (`scripted_trigger name = { }`);
 * - `constant`: a top-level `@name = value`;
 * - `container`: a top-level key a `containers` row names, whose entries are the definitions;
 * - `entry`: a definition inside a container;
 * - `key`: a localization key.
 */
export type Form = 'record' | 'value' | 'prefixed' | 'constant' | 'container' | 'entry' | 'key';
export const FORMS: readonly Form[] = [
    'record',
    'value',
    'prefixed',
    'constant',
    'container',
    'entry',
    'key',
];

/** One piece of evidence for a rule, ranked as in docs/references/README.md. */
export interface RuleEvidence {
    readonly rank: number;
    /** Where it is: a file with `<game dir>` for the game folder, or a measurement. */
    readonly source: string;
    readonly where: string;
    /** What it shows, in pychivalry's words. */
    readonly says: string;
}

interface RuleBase {
    /** Stable identifier of the row. */
    readonly id: string;
    /** The rule's number in docs/overrides.md. */
    readonly overrides_rule: number;
    readonly title: string;
    readonly platforms: readonly Platform[];
    readonly evidence: readonly RuleEvidence[];
    readonly note?: string;
}

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

/** `replace_path` in a mod's descriptor hides the files of `hides` under that path. */
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
    /** How two relative paths compare: by their UTF-8 bytes, or without regard to case. */
    readonly compare: 'bytes' | 'case-insensitive';
    /** Where a subfolder's files fall: by their whole path, or before or after the folder's own. */
    readonly subfolders: 'by-path' | 'files-first' | 'folders-first';
    /** `together`: every layer's files sorted into one list; `in-order`: layer by layer. */
    readonly layers: 'together' | 'in-order';
    /** The layers, first read first: the order for `in-order`, the tie-break for `together`. */
    readonly layer_order: readonly LayerName[];
}

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
    readonly resolve: 'priority' | 'later-wins' | 'earlier-wins' | 'all' | 'statements';
    readonly priority_field?: string;
    readonly priority_default?: number;
    /**
     * What the winner takes: `whole`, the record; `fields`, the fields it sets over the
     * others'; `partial`, the fields the rule's note names, the rest adding up.
     */
    readonly combine?: 'whole' | 'fields' | 'partial';
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
}

/** A definition in a file under a folder named `segment` wins over every other. */
export interface FolderWinsRule extends RuleBase {
    readonly kind: 'folder-wins';
    readonly databases: readonly string[];
    readonly segment: string;
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
    | FolderWinsRule;

export type RuleKind = Rule['kind'];
export const RULE_KINDS: readonly RuleKind[] = [
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

/** The table: its format, what it is, and its rows. */
export interface RulesTable {
    readonly rules_format: 1;
    /** `stand-in` until the spec package carries the table; then `spec`. */
    readonly status: 'stand-in' | 'spec';
    /** The game build the rules were established on. */
    readonly game_build: string;
    readonly source: string;
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

const BASE_FIELDS = ['id', 'overrides_rule', 'title', 'kind', 'platforms', 'evidence', 'note'];

/** The fields each kind takes beyond the base ones, and which of them are required. */
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
        optional: ['forms', 'priority_field', 'priority_default', 'combine'],
    },
    containers: { required: ['databases', 'keys'], optional: [] },
    'folder-wins': { required: ['databases', 'segment'], optional: [] },
};

function stringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Every problem with one row. */
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
    const known = new Set([...BASE_FIELDS, ...fields.required, ...fields.optional]);
    for (const key of Object.keys(row)) {
        if (!known.has(key)) {
            problems.push(`${at}: ${kind} has no field ${key}`);
        }
    }
    for (const key of [...BASE_FIELDS.filter((f) => f !== 'note'), ...fields.required]) {
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
    const platforms = row['platforms'];
    if (
        !Array.isArray(platforms) ||
        platforms.length === 0 ||
        !platforms.every((p) => oneOf(p, PLATFORMS))
    ) {
        problems.push(`${at}: platforms must list one or more of ${PLATFORMS.join(', ')}`);
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
            for (const key of Object.keys(item)) {
                if (!['rank', 'source', 'where', 'says'].includes(key)) {
                    problems.push(`${where}: has no field ${key}`);
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
            if (!oneOf(resolve, ['priority', 'later-wins', 'earlier-wins', 'all', 'statements'])) {
                problems.push(
                    `${at}: resolve must be priority, later-wins, earlier-wins, all or statements`,
                );
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
            break;
        }
        case 'containers':
            databases('databases', true);
            if (!stringList(row['keys']) || row['keys'].length === 0) {
                problems.push(`${at}: keys must list one or more top-level keys, or "*"`);
            }
            break;
        case 'folder-wins':
            databases('databases', true);
            if (typeof row['segment'] !== 'string' || /[/\\]/.test(row['segment'])) {
                problems.push(`${at}: segment must be one folder name`);
            }
            break;
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
            default:
                claim(rule.kind, rule);
        }
    }
    return problems;
}

/**
 * Check a parsed table and return it typed. Throws `RulesTableError` listing every problem:
 * an unknown kind or field, a missing one, a value of the wrong kind, two rows that answer
 * the same question, or two rows with one id.
 */
export function readRulesTable(data: unknown): RulesTable {
    if (!isJson(data)) {
        throw new RulesTableError(['the table is not an object']);
    }
    const problems: string[] = [];
    for (const key of Object.keys(data)) {
        if (!['$schema', 'rules_format', 'status', 'game_build', 'source', 'rules'].includes(key)) {
            problems.push(`the table has no field ${key}`);
        }
    }
    if (data['rules_format'] !== 1) {
        problems.push(`rules_format is ${JSON.stringify(data['rules_format'])}; this core reads 1`);
    }
    if (!oneOf(data['status'], ['stand-in', 'spec'])) {
        problems.push('status must be stand-in or spec');
    }
    if (typeof data['game_build'] !== 'string' || !/^[0-9]+(\.[0-9]+)+$/.test(data['game_build'])) {
        problems.push('game_build must be a game build such as 1.21.0.3');
    }
    if (typeof data['source'] !== 'string' || data['source'] === '') {
        problems.push('source must be text');
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
    const table = data as unknown as RulesTable;
    const overlaps = overlapProblems(table.rules);
    if (overlaps.length > 0) {
        throw new RulesTableError(overlaps);
    }
    return table;
}

/** The rows that hold on a platform. */
export function rulesFor(table: RulesTable, platform: Platform): Rule[] {
    return table.rules.filter((rule) => rule.platforms.includes(platform));
}

/** The table with one more row (for tests and callers that try a rule out), checked again. */
export function withRule(table: RulesTable, rule: Rule): RulesTable {
    return readRulesTable({ ...table, rules: [...table.rules, rule] });
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
