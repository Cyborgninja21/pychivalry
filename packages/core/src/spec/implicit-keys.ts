/**
 * Part D5's keys of names that are no record of a folder (format 9, `implicit_loc_keys.data
 * .buckets`): the localization key of a modifier. The key is a literal of the executable per
 * modifier; the package gives it as data: `literal_keys[name]` where the executable's literal is
 * another word, otherwise the row's `prefix`, the name as `transform` says, and the row's
 * `suffix` (`MOD_` + the name in upper case). A name that fills a modifier template has its own
 * row (`<name>`, measured only).
 */

import type { ImplicitLocKeyBucketRow } from './package.js';
import type { Spec } from './reader.js';

/** The transforms of D5's vocabulary the core applies (`vocabulary.transform`). */
const TRANSFORMS: Readonly<Record<string, (name: string) => string>> = {
    upper: (name) => name.toUpperCase(),
};

/**
 * The key a bucket row gives a name: its `literal_keys` entry, or prefix, the name transformed,
 * suffix; null when the row's transform is one the core does not know (then it says nothing).
 */
export function bucketRowKey(row: ImplicitLocKeyBucketRow, name: string): string | null {
    const literal = row.literal_keys;
    if (literal !== undefined && Object.prototype.hasOwnProperty.call(literal, name)) {
        return literal[name] ?? null;
    }
    let text = name;
    if (row.transform !== undefined) {
        const transform = Object.prototype.hasOwnProperty.call(TRANSFORMS, row.transform)
            ? TRANSFORMS[row.transform]
            : undefined;
        if (transform === undefined) {
            return null;
        }
        text = transform(name);
    }
    return `${row.prefix}${text}${row.suffix}`;
}

/**
 * The rows of D5 for the names of one bucket that are no record (`buckets.<bucket>`) whose
 * `name_from` is the one given: `bucket:modifiers` for the bucket's own names,
 * `bucket:modifier_templates` for a name that fills a modifier template.
 */
export function bucketRows(spec: Spec, bucket: string, nameFrom: string): ImplicitLocKeyBucketRow[] {
    const rows = spec.part('implicit_loc_keys')?.buckets?.[bucket] ?? [];
    return rows.filter((row) => row.name_from === nameFrom);
}
