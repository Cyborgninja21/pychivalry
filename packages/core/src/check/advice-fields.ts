/**
 * Records against their folder's schema, for the two checks built from the base game's own
 * measurements (part A2, how often each field is set per record: `record_usage`; part B2, the
 * values written where there are at most 20: `values`). A key is the field of its name, or a
 * placeholder field named for its kind (`<date>`, `<number>`), as the context reader reads it.
 *
 * A field's rule applies only where the base game has at least 10 records it measures it on
 * (docs/decisions.md, row 46): for a field, the folder's records; for a sub-field, the records
 * whose field sets it.
 */

import type { DirectorySchema, SchemaField } from '../spec/package.js';
import type { Block, Pair } from '../syntax/tree.js';
import { blockOf, significantItems } from '../syntax/tree.js';
import type { AdviceInput } from './advice.js';
import { directoryOf, recordsOf } from './advice.js';

/** The fewest base-game records a measured rule must rest on. */
export const MIN_RECORDS = 10;

/** The schema field name a key is read as, or undefined when the schema has none for it. */
export function fieldNameOf(
    fields: Readonly<Record<string, SchemaField>>,
    key: Pair['key'],
): string | undefined {
    if (Object.prototype.hasOwnProperty.call(fields, key.text)) {
        return key.text;
    }
    const placeholder = `<${key.type}>`;
    return Object.prototype.hasOwnProperty.call(fields, placeholder) ? placeholder : undefined;
}

/** A block's direct pairs, by the schema field each is read as. */
export function pairsByField(
    fields: Readonly<Record<string, SchemaField>>,
    block: Block,
): Map<string, Pair[]> {
    const out = new Map<string, Pair[]>();
    for (const item of significantItems(block)) {
        if (item.kind !== 'pair') {
            continue;
        }
        const name = fieldNameOf(fields, item.key);
        if (name !== undefined) {
            const list = out.get(name) ?? [];
            list.push(item);
            out.set(name, list);
        }
    }
    return out;
}

/** The blocks of these pairs' values. */
export function blocksOf(pairs: readonly Pair[]): Block[] {
    return pairs.flatMap((p) => blockOf(p.value) ?? []);
}

/** The file's folder schema and records, when the folder has a schema. */
export function schemaRecords(input: AdviceInput):
    | {
          readonly schema: DirectorySchema;
          readonly records: { readonly pair: Pair; readonly body: Block }[];
      }
    | undefined {
    const dir = directoryOf(input);
    const schema = dir === null ? undefined : input.spec.data.schema[dir];
    if (schema === undefined) {
        return undefined;
    }
    return { schema, records: recordsOf(input.tree) };
}
