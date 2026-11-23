/**
 * `localization/missing-key` (docs/checks.md, item 4.6): a localization key defined in no
 * localization file of the mod, the base game or a DLC. Evidence: the catalogue's
 * `unknown_loc_key_X` ("Unknown loc key %s"). A key counts as defined when any language
 * defines it, in a file the index says the game reads or may read: the index applies what the
 * override rules say of localization files, and this check takes its answer.
 *
 * Two kinds of key are judged, each from the spec package:
 *
 * 1. **Keys written in a field.** The record schema marks the fields that hold a localization
 *    key (`loc_key`, part B3: 372 fields and sub-fields, read by their path from the record).
 *    A field is not judged where the package says its values need not be keys: its measured
 *    value type admits free text (the value group `text`: a history character's `name`, which
 *    the game shows as written when no key has its name), Paradox's `.info` documents it as
 *    another kind of value and never as a key (`info_type`: a flag, a database key, free text),
 *    or its key is a trigger and no effect (`government_has_flag` in a scripted modifier's
 *    `modifier` block, which the schema measures as a field): a trigger tests its value and
 *    shows no text of it.
 *    A value that is not a key is not judged: a block (a `triggered_desc`, a `first_valid`, any
 *    dynamic description), a data-binding expression in brackets, a `$PARAM$`, a scope chain, a
 *    number, an empty string. Quoted text with spaces is judged, as the row says: the game reads
 *    it as a key.
 * 2. **Keys a record has by its name** (part D5, `implicit_loc_keys`): for a record of a folder,
 *    each of the folder's patterns `<prefix><name><suffix>`, the name being the record's key, a
 *    nested definition's key (part D3) or the file's stem, as the row's `name_from` says. Only a
 *    row whose `requirement` is `required` and whose status is `confirmed` is a warning: the
 *    package shows the game reports the key missing. A row whose requirement is
 *    `always-present-in-base-game` says what every base-game record does, a measurement, so a
 *    record without the key is advice, at information. Optional and unknown rows raise nothing.
 *    A row with a `condition` (stated in words) is not judged, a row with `overridden_by` is
 *    not judged for a record that writes that field, and a pattern with another placeholder
 *    than the name is not built.
 *
 * Without the base game in the index the check is silent: a key the base game defines must not
 * be reported because the base game was not read.
 */

import { DEF, DEF_STRIDE, extractScript, formOf } from '../index/extract.js';
import type { FolderTable, SpecFolder } from '../index/folders.js';
import { fileNameOf } from '../index/paths.js';
import { StringTable } from '../index/strings.js';
import type { BucketName, ImplicitLocKeyRow, SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import {
    blockOf,
    type Block,
    type FileNode,
    type Item,
    type Pair,
    type Scalar,
} from '../syntax/tree.js';
import type { CheckFinding } from './finding.js';
import { withBaseGame, type WorkspaceNames } from './names.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'localization/missing-key';

/** A field the schema marks as holding a localization key, by its path from the record. */
export interface LocField {
    readonly path: readonly string[];
    readonly field: SchemaField;
}

/** The buckets of the game's triggers and effects, by their names in the package. */
const TRIGGERS: BucketName = 'triggers';
const EFFECTS: BucketName = 'effects';

/** The value group of free text in the package's measured value types (part B1). */
const TEXT_GROUP = 'text';

/** The `.info` value types (part C1) that are a localization key, alone or in a description. */
const KEY_INFO_TYPES: ReadonlySet<string> = new Set(['localization_key', 'dynamic_description']);

/** Whether the package says a field's values need not be keys (see the header). */
function notAlwaysAKey(spec: Spec, name: string, field: SchemaField): boolean {
    if ((field.value_type ?? '').split('|').includes(TEXT_GROUP)) {
        return true;
    }
    const types = field.info_type ?? [];
    if (types.length > 0 && !types.some((t) => KEY_INFO_TYPES.has(t))) {
        return true;
    }
    const vocabulary = vocabularyOf(spec);
    return vocabulary.has(TRIGGERS, name) && !vocabulary.has(EFFECTS, name);
}

const fieldsBySpec = new WeakMap<Spec, ReadonlyMap<string, readonly LocField[]>>();

/** The fields judged, per directory: those marked `loc_key` that always hold a key. */
export function judgedLocFields(spec: Spec): ReadonlyMap<string, readonly LocField[]> {
    const known = fieldsBySpec.get(spec);
    if (known !== undefined) {
        return known;
    }
    const out = new Map<string, LocField[]>();
    const walk = (
        directory: string,
        path: readonly string[],
        fields: Readonly<Record<string, SchemaField>> | undefined,
    ): void => {
        for (const [name, field] of Object.entries(fields ?? {})) {
            const at = [...path, name];
            if (field.loc_key === true && !notAlwaysAKey(spec, name, field)) {
                out.set(directory, [...(out.get(directory) ?? []), { path: at, field }]);
            }
            walk(directory, at, field.fields);
        }
    };
    for (const [directory, schema] of Object.entries(spec.data.schema)) {
        walk(directory, [], schema.fields);
    }
    fieldsBySpec.set(spec, out);
    return out;
}

/** How a D5 row is judged here: a warning, advice, or not at all. */
type RowUse = 'warning' | 'advice';

/** A row's requirement and status as this check reads them (see the header). */
export function implicitRowUse(row: ImplicitLocKeyRow): RowUse | null {
    const condition = row['condition'];
    if (condition !== undefined && condition !== null) {
        return null;
    }
    if (`${row.prefix}${row.suffix}`.includes('<')) {
        return null;
    }
    if (row.requirement === 'required') {
        return row.status === 'confirmed' ? 'warning' : null;
    }
    return row.requirement === 'always-present-in-base-game' ? 'advice' : null;
}

/** Whether a key matches a segment of a schema path: the key itself, or `<number>`, `<date>`. */
function segmentMatches(segment: string, key: Scalar): boolean {
    return segment === key.text || segment === `<${key.type}>`;
}

/** The pairs at a path below a block (`a.b`: the `b` pairs inside each `a` block). */
function pairsAt(block: Block, path: readonly string[]): Pair[] {
    let level: Block[] = [block];
    let pairs: Pair[] = [];
    path.forEach((segment, i) => {
        pairs = [];
        for (const b of level) {
            for (const item of b.items) {
                if (item.kind === 'pair' && segmentMatches(segment, item.key)) {
                    pairs.push(item);
                }
            }
        }
        if (i < path.length - 1) {
            level = pairs.map((p) => blockOf(p.value)).filter((x): x is Block => x !== undefined);
        }
    });
    return pairs;
}

/** The key a value names, when it is one (see the header), with the scalar it is written as. */
function keyOf(pair: Pair): { readonly key: string; readonly scalar: Scalar } | undefined {
    const value = pair.value;
    if (value?.kind !== 'scalar') {
        return undefined;
    }
    let key: string;
    if (value.type === 'name' || value.type === 'chain') {
        key = value.text;
    } else if (value.type === 'string' && value.terminated) {
        key = value.value;
    } else {
        return undefined;
    }
    // A key holds no `:` (a localization file ends a key with it); brackets are data binding.
    if (key === '' || /[[\]$:]/.test(key)) {
        return undefined;
    }
    return { key, scalar: value };
}

/** A record's name, by where D5 takes it from, with its pair (none for a file's stem). */
interface Named {
    readonly name: string;
    readonly start: number;
    readonly end: number;
    readonly pair: Pair | null;
}

/** Every pair of a file by where its key starts. */
function pairsByStart(file: FileNode): Map<number, Pair> {
    const out = new Map<number, Pair>();
    const stack: Item[] = [...file.items];
    for (;;) {
        const item = stack.pop();
        if (item === undefined) {
            return out;
        }
        if (item.kind === 'pair') {
            out.set(item.key.start, item);
            const body = blockOf(item.value);
            if (body !== undefined) {
                stack.push(...body.items);
            }
        } else if (item.kind === 'block') {
            stack.push(...item.items);
        }
    }
}

/** The names a file's records have, per D5 `name_from`, read as the index reads definitions. */
function namesOf(file: string, tree: FileNode, folder: SpecFolder): Map<string, Named[]> {
    const strings = new StringTable();
    const stem = fileNameOf(file);
    const extracted = extractScript(tree, {
        strings,
        database: folder.path,
        containers: null,
        priority: null,
        folder,
        fileStem: stem.includes('.') ? stem.slice(0, stem.lastIndexOf('.')) : stem,
    });
    const pairs = pairsByStart(tree);
    const topLevel = new Set(
        tree.items.filter((i): i is Pair => i.kind === 'pair').map((p) => p.key.start),
    );
    const nestedKinds = new Map(folder.nested.map((rule) => [rule.database, rule.kind]));
    const out = new Map<string, Named[]>();
    const add = (from: string, named: Named): void => {
        out.set(from, [...(out.get(from) ?? []), named]);
    };
    const defs = extracted.defs;
    for (let i = 0; i < defs.length; i += DEF_STRIDE) {
        const name = strings.get(defs[i + DEF.name] ?? 0);
        const database = strings.get(defs[i + DEF.database] ?? 0);
        const form = formOf(defs[i + DEF.form] ?? 0);
        const start = defs[i + DEF.keyStart] ?? 0;
        const named = {
            name,
            start,
            end: defs[i + DEF.keyEnd] ?? 0,
            pair: pairs.get(start) ?? null,
        };
        if (form === 'file') {
            add('file-stem', { ...named, pair: null });
        } else if (form !== 'record') {
            continue;
        } else if (topLevel.has(start) && database === folder.path) {
            add('record-key', named);
        } else if (!topLevel.has(start)) {
            const kind = nestedKinds.get(database);
            if (kind !== undefined) {
                add(`nested:${kind}`, named);
            }
        }
    }
    return out;
}

/** Whether a record's block writes a field. */
function writes(pair: Pair | null, field: string): boolean {
    const body = blockOf(pair?.value ?? null);
    return body?.items.some((i) => i.kind === 'pair' && i.key.text === field) === true;
}

export interface MissingKeyInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
    readonly names: Partial<WorkspaceNames>;
}

export function missingKeys(input: MissingKeyInput, context: CheckContext): CheckFinding[] {
    const names = withBaseGame(input.names);
    const folder = input.folders.classify(input.file)?.folder;
    if (names === undefined || folder === undefined) {
        return [];
    }
    const out: CheckFinding[] = [];
    // 1. Keys written in the fields of the file's records.
    const fields = judgedLocFields(input.spec).get(folder.path) ?? [];
    if (fields.length > 0) {
        for (const item of input.tree.items) {
            const record =
                item.kind === 'pair' && item.prefix === null ? blockOf(item.value) : undefined;
            if (record === undefined) {
                continue;
            }
            for (const { path } of fields) {
                for (const pair of pairsAt(record, path)) {
                    const found = keyOf(pair);
                    if (found !== undefined && !names.isLocalizationKey(found.key)) {
                        out.push(
                            finding(
                                CODE,
                                found.scalar,
                                [found.key],
                                { key: found.key, field: path.join('.') },
                                context,
                            ),
                        );
                    }
                }
            }
        }
    }
    // 2. Keys the file's records have by their names (D5).
    const rows = (input.spec.part('implicit_loc_keys')?.directories[folder.path] ?? []).filter(
        (row) => implicitRowUse(row) !== null,
    );
    if (rows.length === 0) {
        return out;
    }
    const named = namesOf(input.file, input.tree, folder);
    for (const row of rows) {
        const use = implicitRowUse(row);
        for (const record of named.get(row.name_from) ?? []) {
            const by = row['overridden_by'];
            const overridden = typeof by === 'string' && writes(record.pair, by);
            const key = `${row.prefix}${record.name}${row.suffix}`;
            if (overridden || names.isLocalizationKey(key)) {
                continue;
            }
            const data = {
                key,
                pattern: row.pattern,
                directory: folder.path,
                requirement: row.requirement,
                row_status: row.status,
            };
            const made = finding(CODE, record, [key], data, context);
            out.push(
                use === 'warning'
                    ? made
                    : {
                          ...made,
                          severity: 'information',
                          evidence: { kind: 'advice' },
                          args: [folder.path, row.pattern, key],
                      },
            );
        }
    }
    return out;
}
