/**
 * `names/unknown-on-action` (docs/checks.md, item 4.2): a value naming an on-action the game
 * does not have. Evidence: the catalogue's `unknown_on_action_X` ("Unknown on action: %s").
 *
 * Which values name an on-action is part D6 of the spec package (`field_references`): its rows
 * whose `refers_to` holds the on-action database, the one D6's vocabulary says adds the
 * package's on-actions bucket to its record keys. Only a row whose status is `confirmed` is read
 * (D6's own rule: a check warns only on confirmed rows; a measured-only or unknown row raises
 * nothing). A row is one of:
 *
 * - a field of a directory's records, by its path from the record (`on_actions`,
 *   `random_on_action.<number>`), whose value is one key or a list of keys (`value_form`);
 * - a parameter of a trigger or an effect (`trigger_event.on_action`): the key inside the
 *   block of that keyword, wherever the context reader judges the keyword.
 *
 * An on-action the game has is one the package's on-actions bucket lists (the engine's own),
 * or a key the mod or the base game defines in that database, as D6 counts its keys. A value
 * that is not a plain name (a scope chain, a `$PARAM$`, a number) is not judged.
 */

import type { Spec } from '../spec/reader.js';
import type { BucketName, FieldReferenceRow } from '../spec/package.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import { blockOf, type Block, type FileNode, type Pair, type Scalar } from '../syntax/tree.js';
import type { DefinedNames, FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'names/unknown-on-action';

/** The bucket of the engine's own on-actions, by its name in the package. */
const ON_ACTIONS: BucketName = 'on_actions';

/** What the check reads beside the file's reading. */
export interface OnActionInput {
    readonly spec: Spec;
    readonly tree: FileNode;
    readonly names: DefinedNames;
}

/** D6's confirmed on-action rows, by directory (fields) and by keyword (parameters). */
interface OnActionPlaces {
    /** The on-action database: D6's database whose keys add the on-actions bucket. */
    readonly database: string | null;
    readonly fields: ReadonlyMap<string, readonly FieldReferenceRow[]>;
    readonly parameters: ReadonlyMap<string, readonly FieldReferenceRow[]>;
}

const places = new WeakMap<Spec, OnActionPlaces>();

/** The confirmed rows of D6 whose values are on-action names. */
export function onActionPlaces(spec: Spec): OnActionPlaces {
    const known = places.get(spec);
    if (known !== undefined) {
        return known;
    }
    const part = spec.part('field_references');
    const databases = part?.vocabulary['databases'];
    const database =
        typeof databases === 'object' && databases !== null
            ? (Object.entries(databases as Record<string, unknown>).find(
                  ([, entry]) =>
                      typeof entry === 'object' &&
                      entry !== null &&
                      (entry as Record<string, unknown>)['add_bucket'] === ON_ACTIONS,
              )?.[0] ?? null)
            : null;
    const fields = new Map<string, FieldReferenceRow[]>();
    const parameters = new Map<string, FieldReferenceRow[]>();
    for (const row of part?.fields ?? []) {
        if (row.status !== 'confirmed' || database === null || !row.refers_to.includes(database)) {
            continue;
        }
        if (row.kind === 'field' && row.directory !== undefined) {
            fields.set(row.directory, [...(fields.get(row.directory) ?? []), row]);
        } else if (row.kind === 'parameter' && row.bucket !== undefined) {
            const keyword = row.path.split('.')[0] ?? '';
            const key = `${row.bucket}\u0000${keyword}`;
            parameters.set(key, [...(parameters.get(key) ?? []), row]);
        }
    }
    const out = { database, fields, parameters };
    places.set(spec, out);
    return out;
}

/** Whether a key matches a segment of a D6 path: the key itself, or `<number>`, `<date>`. */
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

/** A value judged as a name: a plain word, no scope chain, no parameter. */
function isPlainName(scalar: Scalar): boolean {
    return scalar.type === 'name' && !scalar.text.includes('$');
}

export function unknownOnActions(
    reading: FileReading,
    context: CheckContext,
    input: OnActionInput,
): CheckFinding[] {
    const { database, fields, parameters } = onActionPlaces(input.spec);
    const vocabulary = vocabularyOf(input.spec);
    const out: CheckFinding[] = [];
    if (database === null) {
        return out;
    }
    const judge = (scalar: Scalar, row: FieldReferenceRow): void => {
        if (!isPlainName(scalar)) {
            return;
        }
        const name = scalar.text;
        if (vocabulary.has(ON_ACTIONS, name) || input.names.isDefined(name, database)) {
            return;
        }
        out.push(finding(CODE, scalar, [name], { name, place: row.id }, context));
    };
    // Fields of the file's records.
    const rows = reading.directory === null ? [] : (fields.get(reading.directory) ?? []);
    if (rows.length > 0) {
        for (const item of input.tree.items) {
            if (item.kind !== 'pair' || item.prefix !== null) {
                continue;
            }
            const record = blockOf(item.value);
            if (record === undefined) {
                continue;
            }
            for (const row of rows) {
                for (const pair of pairsAt(record, row.path.split('.'))) {
                    for (const scalar of valuesOf(pair, row.value_form)) {
                        judge(scalar, row);
                    }
                }
            }
        }
    }
    // Parameters of the triggers and effects the context reader judged.
    for (const judged of reading.keys) {
        if (judged.reading.kind !== 'keyword') {
            continue;
        }
        const keyword = judged.folded ?? judged.pair.key.text;
        const params = parameters.get(`${judged.reading.bucket}\u0000${keyword}`) ?? [];
        const body = blockOf(judged.pair.value);
        if (params.length === 0 || body === undefined) {
            continue;
        }
        for (const row of params) {
            for (const pair of pairsAt(body, row.path.split('.').slice(1))) {
                for (const scalar of valuesOf(pair, row.value_form)) {
                    judge(scalar, row);
                }
            }
        }
    }
    return out;
}
