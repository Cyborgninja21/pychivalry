/**
 * The records of a file and the fields written in them, as the spec package's record schema
 * describes them (docs/PLAN.md item 4.5). Shared by the checks of fields and structure: which
 * top-level keys of a file are records, which keys of a record are fields, and what the schema
 * says of each.
 *
 * Every line drawn here comes from the package:
 *
 * - The folder: the deepest listed folder of the file's path inside the mod, matched by whole
 *   folder names (`FolderTable.classify`); its record schema (`schema.<folder>`). A folder with
 *   no schema has no records here; nor has a folder whose records are named by their file
 *   (part D3, `file_named`): its top-level keys are the fields of one record, the file.
 * - A record: a top-level `key = { ... }` written without a word before the key, whose key is
 *   a name or a whole number. Not a record: an `@constant`; a top-level form part D2 says
 *   declares something other than a record (`namespace = x`); a container (a part D1
 *   `containers` row, or a part D3 `container-child` row), whose entries are the definitions.
 * - A field: a key of a record's body, looked up in the schema's `fields` (by name, or by the
 *   placeholder of its word's kind: `<date>`, `<number>`); below it, its sub-fields. The walk
 *   goes into a field's block only where the context reader reads that block as record
 *   fields (`none`), the schema lists the field's sub-fields, and the field's kind is not in
 *   doubt (a `note` starting `kind suspect:`). It does not go below a scope chain or a link
 *   written as a key (a scope switch, not a field), nor below a key part D3 says is a
 *   definition of its own.
 */

import type { FolderTable, SpecFolder } from '../index/folders.js';
import { keyMatcher } from '../index/folders.js';
import type { DeclarationRow, DirectorySchema, SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import type { Block, FileNode, Pair } from '../syntax/tree.js';
import { fieldFor, type BlockKind, type FileReading } from './context.js';

/** A field list of the schema: a record's fields, or a field's sub-fields. */
export type Fields = Readonly<Record<string, SchemaField>> | undefined;

/** One record of a file: its top-level pair and its body. */
export interface RecordSite {
    readonly pair: Pair;
    readonly body: Block;
}

/** The records of one file, with the folder and schema they are read by. */
export interface FileRecords {
    /** The folder of the spec's list the file is in, or null. */
    readonly folder: SpecFolder | null;
    readonly schema: DirectorySchema | undefined;
    readonly records: readonly RecordSite[];
}

/** One key written in a record, where the schema has a field list for its block. */
export interface FieldSite {
    readonly record: RecordSite;
    readonly pair: Pair;
    /** The keys from the record's body down to this pair, this pair's key last. */
    readonly path: readonly string[];
    /** The field list the key was looked up in. */
    readonly fields: Readonly<Record<string, SchemaField>>;
    /** The schema's field for the key, or undefined when the list has none. */
    readonly field: SchemaField | undefined;
    /** How the context reader reads the block the pair is written in. */
    readonly kind: BlockKind | undefined;
}

function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
    return record !== undefined && Object.prototype.hasOwnProperty.call(record, key)
        ? record[key]
        : undefined;
}

/** True when the spec work's note says the field's measured kind is in doubt. */
export function isSuspect(field: SchemaField | undefined): boolean {
    return field?.note?.startsWith('kind suspect:') ?? false;
}

/** Per package, values computed once per folder. */
function perFolder<T>(
    cache: WeakMap<Spec, Map<string, T>>,
    spec: Spec,
    folder: string,
    make: () => T,
): T {
    let byFolder = cache.get(spec);
    if (byFolder === undefined) {
        byFolder = new Map();
        cache.set(spec, byFolder);
    }
    let value = byFolder.get(folder);
    if (value === undefined) {
        value = make();
        byFolder.set(folder, value);
    }
    return value;
}

const containerCache = new WeakMap<Spec, Map<string, readonly string[]>>();
const declarationCache = new WeakMap<Spec, Map<string, readonly DeclarationRow[]>>();
const recordCache = new WeakMap<
    FileNode,
    { readonly file: string; readonly records: FileRecords }
>();

/** The top-level keys a D1 `containers` row names for a folder (`*`: every key). */
function containerKeysOf(spec: Spec, folder: string): readonly string[] {
    return perFolder(containerCache, spec, folder, () => containerKeysFrom(spec, folder));
}

function containerKeysFrom(spec: Spec, folder: string): readonly string[] {
    const out: string[] = [];
    for (const row of spec.part('override_rules')?.rules ?? []) {
        const databases = row['databases'];
        const keys = row['keys'];
        if (
            row['kind'] === 'containers' &&
            (row.status === 'settled' || row.status === 'derived') &&
            Array.isArray(databases) &&
            (databases as unknown[]).includes(folder) &&
            Array.isArray(keys)
        ) {
            out.push(...(keys as unknown[]).filter((k): k is string => typeof k === 'string'));
        }
    }
    return out;
}

/** The rows of part D2 for a folder and for every folder: top-level forms that are not records. */
function declarationsOf(spec: Spec, folder: string): readonly DeclarationRow[] {
    return perFolder(declarationCache, spec, folder, () => {
        const part = spec.part('declarations');
        return [...(part?.directories[folder] ?? []), ...(part?.all_directories ?? [])].filter(
            (row) => row.declares !== 'record',
        );
    });
}

/** True when a part D2 row says the top-level key declares something, not a record. */
export function isDeclaration(spec: Spec, folder: string, key: string): boolean {
    return declarationsOf(spec, folder).some((row) => keyMatcher(row.key, row.match)(key));
}

/** The records of a file (see the head of this file). */
export function recordsOf(
    spec: Spec,
    folders: FolderTable,
    file: string,
    tree: FileNode,
): FileRecords {
    const cached = recordCache.get(tree);
    if (cached?.file === file) {
        return cached.records;
    }
    const records = readRecords(spec, folders, file, tree);
    recordCache.set(tree, { file, records });
    return records;
}

function readRecords(spec: Spec, folders: FolderTable, file: string, tree: FileNode): FileRecords {
    const folder = folders.classify(file)?.folder ?? null;
    const schema = folder === null ? undefined : own(spec.data.schema, folder.path);
    if (folder === null || schema === undefined || folder.fileNamed) {
        return { folder, schema, records: [] };
    }
    const containers = containerKeysOf(spec, folder.path);
    const records: RecordSite[] = [];
    for (const item of tree.items) {
        if (
            item.kind !== 'pair' ||
            item.prefix !== null ||
            item.value?.kind !== 'block' ||
            (item.key.type !== 'name' && item.key.type !== 'number')
        ) {
            continue;
        }
        const key = item.key.text;
        if (
            key.includes('$') ||
            containers.includes('*') ||
            containers.includes(key) ||
            isDeclaration(spec, folder.path, key) ||
            folder.nested.some(
                (rule) =>
                    rule.type === 'container-child' &&
                    rule.path.length === 1 &&
                    rule.path[0]?.test(key) === true,
            )
        ) {
            continue;
        }
        records.push({ pair: item, body: item.value });
    }
    return { folder, schema, records };
}

/**
 * True when part D3 says the key at `path` below a record (the record's key first) is a
 * definition of its own: a key of the pattern a `key-pattern` row gives, below a record its
 * path matches; or a child of the block a `parent-field` or `any-block-child` row's path
 * reaches, not among the row's exceptions.
 */
export function isNestedDefinition(folder: SpecFolder, path: readonly string[]): boolean {
    const key = path[path.length - 1] ?? '';
    const parents = path.slice(0, -1);
    return folder.nested.some((rule) => {
        if (rule.type === 'key-pattern') {
            return rule.pattern?.test(key) === true && rule.path[0]?.test(path[0] ?? '') === true;
        }
        if (rule.type === 'parent-field' || rule.type === 'any-block-child') {
            return (
                rule.path.length === parents.length &&
                rule.path.every((segment, i) => segment.test(parents[i] ?? '')) &&
                !rule.except.has(key)
            );
        }
        return false;
    });
}

/**
 * Visit every key written in a record where the schema has a field list for its block: the
 * record's body, and the block of each field whose sub-fields the schema lists (see the head
 * of this file). `deep` false visits the record's body only.
 */
export function walkFields(
    spec: Spec,
    records: FileRecords,
    record: RecordSite,
    reading: FileReading,
    visit: (site: FieldSite) => void,
    deep = true,
): void {
    const folder = records.folder;
    const schema = records.schema;
    if (folder === null || schema === undefined) {
        return;
    }
    const vocabulary = vocabularyOf(spec);
    const walk = (
        block: Block,
        fields: Readonly<Record<string, SchemaField>>,
        above: readonly string[],
    ): void => {
        const kind = reading.blocks.get(block);
        for (const item of block.items) {
            if (item.kind !== 'pair') {
                continue;
            }
            const path = [...above, item.key.text];
            const field = fieldFor(fields, item.key);
            visit({ record, pair: item, path, fields, field, kind });
            const child = item.value?.kind === 'block' ? item.value : undefined;
            if (
                !deep ||
                child === undefined ||
                field?.fields === undefined ||
                isSuspect(field) ||
                reading.blocks.get(child) !== 'none' ||
                item.key.type === 'chain' ||
                vocabulary.has('links', item.key.text) ||
                isNestedDefinition(folder, [record.pair.key.text, ...path])
            ) {
                continue;
            }
            walk(child, field.fields, path);
        }
    };
    walk(record.body, schema.fields, []);
}

/** Part B1's value groups that name the records of a folder, and those folders. */
export interface ValueGroups {
    /** The groups (`script_value` in 1.21.0.3): a value of the group names such a record. */
    readonly groups: ReadonlySet<string>;
    /** The folders whose content type is one of them (`common/script_values`). */
    readonly folders: readonly string[];
}

const valueGroupCache = new WeakMap<Spec, ValueGroups>();

/**
 * The value groups of part B1 that are also a folder's content type: the package's own word
 * for a value that names a record of that folder. The context reader reads such a folder's
 * records as script values.
 */
export function valueGroupsOf(spec: Spec): ValueGroups {
    let known = valueGroupCache.get(spec);
    if (known === undefined) {
        const groups = new Set<string>();
        const collect = (fields: Readonly<Record<string, SchemaField>>): void => {
            for (const field of Object.values(fields)) {
                for (const group of (field.value_type ?? '').split('|')) {
                    groups.add(group);
                }
                if (field.fields !== undefined) {
                    collect(field.fields);
                }
            }
        };
        for (const schema of Object.values(spec.data.schema)) {
            collect(schema.fields);
        }
        const folders = spec.data.directories.filter((d) => groups.has(d.content_type));
        known = {
            groups: new Set(folders.map((d) => d.content_type)),
            folders: folders.map((d) => d.path),
        };
        valueGroupCache.set(spec, known);
    }
    return known;
}
