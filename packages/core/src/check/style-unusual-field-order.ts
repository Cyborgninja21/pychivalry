/**
 * `style/unusual-field-order` (the family `style`, pychivalry's own best-practice rules): a
 * record whose fields are written in another order than its folder's usual one, on the owner's
 * word of 2026-11-23. The usual order is the core's field-order data (`field-order.ts`), which
 * completion also follows.
 *
 * Only where the order has no meaning to the game. Effects and triggers run in the order they
 * are written, so the default is that order matters; a record is judged only when all of this
 * holds, and is otherwise left alone:
 *
 * - **Its folder's records are read field by field.** The spec package gives the folder a record
 *   schema whose body is no trigger or effect block (no `record_body`) and whose records are no
 *   script value (their content type is no value group): the body holds record fields, each
 *   with its own kind, which the game reads by name (the context reader of item 4.3 reads them
 *   so). Which folders that is, and the evidence for each beyond the schema (part D1's field
 *   outcomes of `common/on_action`, part D4's roles, Paradox's `.info` files), is given with
 *   the data (`field-order.ts`).
 * - **The body holds fields only:** every item a `key = value` of a field the folder's schema
 *   has, with no name before the key and no other operator; a bare value, a block without a
 *   key, a `$PARAM$`, an unknown key or a comparison leaves the record unjudged.
 * - **Two fields of the order at least** are written in it.
 * - **The folder is judged** (`JUDGED_FOLDERS`): every folder of the data, since the owner's
 *   word of 2026-11-23, `common/decisions` and `common/character_interactions` among them, whose
 *   orders come from their `.info` files although the base game breaks them more often than it
 *   follows them (best practice over what the base game writes).
 *
 * A field written more than once keeps the order of its copies: the order is judged, and fixed,
 * with each copy at its field's place, never one copy moved past another (part D1 says, per
 * database, which copy of a key written twice the game keeps). Fields the order does not name
 * keep their places. One finding per record, at the first field written after one the order
 * puts after it.
 */

import type { Spec } from '../spec/reader.js';
import { significantItems, type Block, type Pair } from '../syntax/tree.js';
import { directoryOf, recordsOf, type AdviceResult } from './advice.js';
import { bodyFieldOrder, JUDGED_FOLDERS } from './field-order.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';

export const CODE = 'style/unusual-field-order';

/** The value groups of the package's measured value types (part B1): a content type that is one names a script value. */
const groupsCache = new WeakMap<Spec, ReadonlySet<string>>();

function valueGroups(spec: Spec): ReadonlySet<string> {
    let groups = groupsCache.get(spec);
    if (groups === undefined) {
        const out = new Set<string>();
        const collect = (
            fields: Readonly<
                Record<string, { value_type?: string; fields?: Readonly<Record<string, unknown>> }>
            >,
        ): void => {
            for (const field of Object.values(fields)) {
                for (const group of (field.value_type ?? '').split('|')) {
                    if (group !== '') {
                        out.add(group);
                    }
                }
                if (field.fields !== undefined) {
                    collect(field.fields as Readonly<Record<string, { value_type?: string }>>);
                }
            }
        };
        for (const schema of Object.values(spec.data.schema)) {
            collect(schema.fields);
        }
        groups = out;
        groupsCache.set(spec, groups);
    }
    return groups;
}

/**
 * Whether the order of a folder's record fields has no meaning to the game, by the spec
 * package: the folder has a record schema, its body is no trigger or effect block, and its
 * records are no script value.
 */
export function fieldsReadByName(spec: Spec, folder: string): boolean {
    if (!Object.hasOwn(spec.data.schema, folder)) {
        return false;
    }
    const schema = spec.data.schema[folder];
    return (
        schema !== undefined &&
        schema.record_body === undefined &&
        !valueGroups(spec).has(schema.content_type)
    );
}

/** The fields of a record body that may be judged: its pairs, when it holds nothing else. */
export function judgedFields(spec: Spec, folder: string, body: Block): Pair[] | null {
    const fields = spec.data.schema[folder]?.fields ?? {};
    const pairs: Pair[] = [];
    for (const item of significantItems(body)) {
        if (
            item.kind !== 'pair' ||
            item.prefix !== null ||
            item.key.type !== 'name' ||
            item.operator === null ||
            item.operator.parameter ||
            item.operator.text !== '=' ||
            item.value === null ||
            !Object.hasOwn(fields, item.key.text)
        ) {
            return null;
        }
        pairs.push(item);
    }
    return pairs;
}

/**
 * Where a record breaks the order: the first field (in the order written) after a field the
 * order puts after it, and that field; null when the fields the order names are in its order.
 */
export function firstOutOfOrder(
    fields: readonly Pair[],
    order: readonly string[],
): { readonly field: Pair; readonly after: Pair } | null {
    let latest: { pair: Pair; rank: number } | null = null;
    for (const pair of fields) {
        const rank = order.indexOf(pair.key.text);
        if (rank < 0) {
            continue;
        }
        if (latest !== null && rank < latest.rank) {
            return { field: pair, after: latest.pair };
        }
        if (latest === null || rank > latest.rank) {
            latest = { pair, rank };
        }
    }
    return null;
}

function run(input: BestPracticeInput): AdviceResult {
    const folder = directoryOf(input);
    const order = folder === null ? undefined : bodyFieldOrder(folder);
    if (
        folder === null ||
        order === undefined ||
        !JUDGED_FOLDERS.has(folder) ||
        !fieldsReadByName(input.spec, folder)
    ) {
        return { judged: 0, findings: [] };
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const { pair: record, body } of recordsOf(input.tree)) {
        const fields = judgedFields(input.spec, folder, body);
        if (fields === null) {
            continue;
        }
        const named = new Set(fields.map((f) => f.key.text).filter((k) => order.includes(k)));
        if (named.size < 2) {
            continue;
        }
        judged++;
        const out = firstOutOfOrder(fields, order);
        if (out === null) {
            continue;
        }
        findings.push(
            finding(
                CODE,
                out.field.key,
                [out.field.key.text, out.after.key.text, folder],
                {
                    record: record.key.text,
                    field: out.field.key.text,
                    after: out.after.key.text,
                    folder,
                    order: order.filter((k) => named.has(k)),
                },
                input.context,
            ),
        );
    }
    return { judged, findings };
}

export const check: BestPracticeCheck = { code: CODE, run };
