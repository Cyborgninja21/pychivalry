/**
 * `references/unknown-key` (docs/checks.md, item 4.5): a value that should be a key of a
 * database names no key of it in the mod, the base game or a DLC. A warning on the catalogue's
 * `failed_to_read_key_reference_X_from_database_X` ("Failed to read key reference %s from
 * database %s").
 *
 * Which values name a key of which database is part D6 of the spec package
 * (`field_references`). Only a row whose status is `confirmed` is read: D6's own rule is that a
 * check warns on confirmed rows only, a measured-only row being advice and an unknown row not
 * checked, and docs/checks.md gives this row no advice. The rows that name the on-action
 * database are `names/unknown-on-action`'s, not this check's. A row is one of:
 *
 * - `field`: a field of a folder's records, by its path from the record (`character.culture`,
 *   `random_events.<number>`);
 * - `info`: the same, as a Paradox `.info` file writes the path (`law_name/succession/x`: the
 *   example record's own key first, then the fields);
 * - `parameter`: a key inside the block of a trigger or an effect (`trigger_event.id`), wherever
 *   the context reader judges that keyword;
 * - `value`: the value of a trigger or an effect written `keyword = value` (`has_tenet = x`).
 *
 * A value is one key or a list of keys as the row's `value_form` says (a row that says nothing
 * takes one key). Only a plain name is judged: a scope chain, `scope:`, `flag:`, a `$PARAM$`,
 * an `@constant` and quoted text are never keys (D6's own rule), a link written as a value
 * (`root`, `prev`) is a scope, not a key, and a number is not judged (D6 measures neither: it
 * sets numbers and references apart, `measured.other_values`). An `info` row whose last
 * segment is a placeholder (`random_traits_list/<trait_key>`) names a key written as a key,
 * not a value, and is not read.
 *
 * A row is read only when two more things hold, each from the package:
 *
 * - the index knows each database it names: a folder of the package's list, or a kind part
 *   D3 finds nested in one (written `<folder>#<kind>`; the folder itself when the kind is the
 *   folder's own content type, as the index records it);
 * - D6's own measurement of the base game at the place agrees with it: every value the base
 *   game writes there that is no key of the databases (`measured.misses`, listed in
 *   `measured.sample_misses`) is a link, which is not judged. A confirmed row the base game
 *   contradicts (`holding = none` of `history/provinces`; `mechanic_type` of
 *   `common/governments`, none of whose base-game values is a government key) would report
 *   correct base-game script; it is not read, and is a question for the spec work.
 */

import type { FolderTable } from '../index/folders.js';
import type { FieldReferenceRow } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import { blockOf, type Block, type FileNode, type Pair, type Scalar } from '../syntax/tree.js';
import { onActionPlaces } from './names-unknown-on-action.js';
import type { DefinedNames, FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { recordsOf } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'references/unknown-key';

/** What the check reads beside the file's reading. */
export interface UnknownKeyInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
    readonly names: DefinedNames;
}

/** A confirmed row of D6, with the index's databases for what it names. */
export interface KeyPlace {
    readonly row: FieldReferenceRow;
    /** The databases its values are keys of, as the index names them. */
    readonly databases: readonly string[];
    /** The path below the record or the keyword, each segment a key or a placeholder. */
    readonly path: readonly string[];
}

/** D6's confirmed rows this check reads, by folder (fields) and by bucket and keyword. */
export interface KeyPlaces {
    readonly fields: ReadonlyMap<string, readonly KeyPlace[]>;
    readonly keywords: ReadonlyMap<string, readonly KeyPlace[]>;
}

const cache = new WeakMap<Spec, WeakMap<FolderTable, KeyPlaces>>();

/**
 * The index's name for a database D6 names, or null when the index holds no such database:
 * a folder of the list; `<folder>#<kind>` for a kind D3 nests in it, the folder itself when the
 * kind is the folder's content type.
 */
export function indexDatabase(folders: FolderTable, database: string): string | null {
    const at = database.indexOf('#');
    const folder = folders.get(at < 0 ? database : database.slice(0, at));
    if (folder === undefined) {
        return null;
    }
    if (at < 0) {
        return folder.path;
    }
    const kind = database.slice(at + 1);
    if (kind === folder.contentType) {
        return folder.path;
    }
    return folder.nested.some((rule) => rule.database === database) ? database : null;
}

/** The confirmed rows of D6 that this check reads (see the head of this file). */
export function keyPlaces(spec: Spec, folders: FolderTable): KeyPlaces {
    let byTable = cache.get(spec);
    if (byTable === undefined) {
        byTable = new WeakMap();
        cache.set(spec, byTable);
    }
    const known = byTable.get(folders);
    if (known !== undefined) {
        return known;
    }
    const onActions = onActionPlaces(spec).database;
    const fields = new Map<string, KeyPlace[]>();
    const keywords = new Map<string, KeyPlace[]>();
    for (const row of spec.part('field_references')?.fields ?? []) {
        if (row.status !== 'confirmed' || row.refers_to.length === 0) {
            continue;
        }
        if (onActions !== null && row.refers_to.includes(onActions)) {
            continue;
        }
        const databases = row.refers_to.map((db) => indexDatabase(folders, db));
        if (databases.some((db) => db === null) || !agreesWithBaseGame(spec, row)) {
            continue;
        }
        const resolved = databases as string[];
        if (row.kind === 'field' && row.directory !== undefined) {
            const place = { row, databases: resolved, path: row.path.split('.') };
            fields.set(row.directory, [...(fields.get(row.directory) ?? []), place]);
        } else if (row.kind === 'info' && row.directory !== undefined) {
            // The example record's own key first: the fields below it are the path.
            const path = row.path.split('/').slice(1);
            const last = path[path.length - 1] ?? '';
            if (
                path.length > 0 &&
                !isPlaceholder(last) &&
                folders.get(row.directory) !== undefined
            ) {
                const place = { row, databases: resolved, path };
                fields.set(row.directory, [...(fields.get(row.directory) ?? []), place]);
            }
        } else if ((row.kind === 'parameter' || row.kind === 'value') && row.bucket !== undefined) {
            const segments = row.path.split('.');
            const keyword = segments[0] ?? '';
            const key = `${row.bucket}\u0000${keyword}`;
            const place = { row, databases: resolved, path: segments.slice(1) };
            keywords.set(key, [...(keywords.get(key) ?? []), place]);
        }
    }
    const out = { fields, keywords };
    byTable.set(folders, out);
    return out;
}

/** True for a `<...>` placeholder segment of a path. */
function isPlaceholder(segment: string): boolean {
    return segment.startsWith('<') && segment.endsWith('>');
}

/** True when a name is a link, which a value names as a scope: `root`, `prev`, in any case. */
function isLink(spec: Spec, name: string): boolean {
    const vocabulary = vocabularyOf(spec);
    return vocabulary.has('links', name) || vocabulary.has('links', name.toLowerCase());
}

/**
 * True when D6's own measurement of the base game at a row's place finds no value there that
 * is no key, links set aside (see the head of this file).
 */
export function agreesWithBaseGame(spec: Spec, row: FieldReferenceRow): boolean {
    const measured = row['measured'];
    if (typeof measured !== 'object' || measured === null) {
        return true;
    }
    const { misses, sample_misses: sample } = measured as {
        misses?: unknown;
        sample_misses?: unknown;
    };
    const count = typeof misses === 'number' ? misses : 0;
    const listed = Array.isArray(sample) ? (sample as unknown[]) : [];
    if (count > listed.length) {
        return false;
    }
    return listed.every((value) => typeof value === 'string' && isLink(spec, value));
}

/** The placeholders that stand for a key of one kind of word: `<number>`, `<date>`. */
const KIND_PLACEHOLDERS: ReadonlySet<string> = new Set(['<number>', '<date>']);

/**
 * Whether a key matches a segment of a path: the key itself; `<number>` or `<date>`, a key of
 * that kind; another `<...>` placeholder of a `.info` path (`<key>`), any name.
 */
function segmentMatches(segment: string, key: Scalar): boolean {
    if (segment === key.text) {
        return true;
    }
    if (KIND_PLACEHOLDERS.has(segment)) {
        return segment === `<${key.type}>`;
    }
    return isPlaceholder(segment) && key.type === 'name';
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

/** The values a pair gives, as its row's `value_form` says: one key, or a list of keys. */
function valuesOf(pair: Pair, form: string | null): Scalar[] {
    const value = pair.value;
    if (value === null) {
        return [];
    }
    if (value.kind === 'scalar') {
        return form === 'list of keys' ? [] : [value];
    }
    if (value.kind === 'block' && form !== 'key' && form !== null) {
        return value.items.filter((i): i is Scalar => i.kind === 'scalar');
    }
    return [];
}

/** A value judged as a key: a plain name, no chain, no parameter, no link. */
function isKeyValue(spec: Spec, scalar: Scalar): boolean {
    return scalar.type === 'name' && !scalar.text.includes('$') && !isLink(spec, scalar.text);
}

export function unknownKeys(
    reading: FileReading,
    context: CheckContext,
    input: UnknownKeyInput,
): CheckFinding[] {
    const places = keyPlaces(input.spec, input.folders);
    const out: CheckFinding[] = [];
    const judge = (scalar: Scalar, place: KeyPlace): void => {
        if (!isKeyValue(input.spec, scalar)) {
            return;
        }
        const name = scalar.text;
        if (place.databases.some((db) => input.names.isDefined(name, db))) {
            return;
        }
        const database = place.databases[0] ?? '';
        out.push(
            finding(
                CODE,
                scalar,
                [name, database],
                { name, database, place: place.row.id },
                context,
            ),
        );
    };
    // Fields of the file's records.
    const rows = reading.directory === null ? [] : (places.fields.get(reading.directory) ?? []);
    if (rows.length > 0) {
        const records = recordsOf(input.spec, input.folders, input.file, input.tree);
        for (const record of records.records) {
            for (const place of rows) {
                for (const pair of pairsAt(record.body, place.path)) {
                    for (const scalar of valuesOf(pair, place.row.value_form)) {
                        judge(scalar, place);
                    }
                }
            }
        }
    }
    // Parameters and values of the triggers and effects the context reader judged.
    for (const judged of reading.keys) {
        if (judged.reading.kind !== 'keyword') {
            continue;
        }
        const keyword = judged.folded ?? judged.pair.key.text;
        for (const place of places.keywords.get(`${judged.reading.bucket}\u0000${keyword}`) ?? []) {
            if (place.row.kind === 'value') {
                for (const scalar of valuesOf(judged.pair, place.row.value_form)) {
                    judge(scalar, place);
                }
                continue;
            }
            const body = blockOf(judged.pair.value);
            if (body === undefined) {
                continue;
            }
            for (const pair of pairsAt(body, place.path)) {
                for (const scalar of valuesOf(pair, place.row.value_form)) {
                    judge(scalar, place);
                }
            }
        }
    }
    return out;
}
