/**
 * What an empty iterator block means, for `style/empty-block` (the owner's decision of
 * 2026-11-26): a block that means something when empty is still reported, but its removal is
 * never offered, since that would change what the script does. Everything is read from the spec
 * package, part D8 (`iterator_kinds`) and the table `iterator_params`; no keyword is written here.
 *
 * What the package shows, confirmed by the game's own documentation output (rank 2):
 *
 * - A prefix whose kind is `trigger` belongs in a trigger block, and its body is conditions,
 *   written with the parameters its usage line names (`any_<list> = { <count=num/all> /
 *   <percent=fixed_point> <triggers> }`): it is a condition, so an empty one is one too, and
 *   taking it away changes the result of the block around it whenever no item exists. The game's
 *   documentation of that parameter in the table (`iterator_params`) is "how many items must
 *   match", for every list; Paradox's `.info` for trigger localization calls the form without it
 *   the regular one, whose negation is every item failing (rank 3): it asks for at least one.
 * - A prefix whose kind is `effect` belongs in an effect block, and its body is effects
 *   (`limit = { <triggers> } <effects>`): an empty one runs none, so it is the rule's usual case.
 *
 * What the package leaves open, so nothing is offered: how an iterator written in a block of the
 * other kind is read (part D8's own first open point), and what an iterator is in a block the
 * context reader does not read as triggers or effects (a script value, a record's own fields, a
 * block the package's rules do not place). The package does not state the default of the count
 * parameter either, so writing it out (`>= 1`, at least one) is a suggestion, never a safe fix: it
 * is the form the base game writes 364 times for the same test, beside 242 empty ones.
 */

import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import type { Pair } from '../syntax/tree.js';
import { iteratorNamed, type Context, type DefinedNames, type JudgedKey } from './context.js';

/** What an empty iterator block means, where it is not the rule's usual case. */
export type EmptyIteratorMeaning =
    /** A condition that asks for at least one item: taking it away can change the result. */
    | 'at-least-one'
    /** An iterator the package does not say how to read here: nothing is offered. */
    | 'not-known';

/** The prefix rows of part D8, as the rule reads them. */
interface PrefixReading {
    /** The kind of block the prefix belongs in: `trigger` or `effect`. */
    readonly kind: Context;
    /** What its body holds: conditions (`trigger`) or effects (`effect`). */
    readonly body: Context;
    /**
     * For a prefix whose body is conditions: its parameter that says how many items must match,
     * written out to ask for at least one (`<parameter> >= 1`); null when the package does not
     * name exactly one.
     */
    readonly atLeastOne: string | null;
}

/** The cross-reference of a D8 row to an entry of the table `iterator_params`. */
const PARAMETER_SEE = 'tables.iterator_params.entries.';

/**
 * The word the game's own documentation output writes, in an iterator's usage line, for a
 * parameter that takes a number (`<name=num/all>`); a share is written `fixed_point`.
 */
const NUMBER_WORD = 'num';

/** A parameter in a usage line: `<name=value/value>`. */
const USAGE_PARAMETER = /<([A-Za-z_]+)=([^<>]*)>/g;

function isContext(value: unknown): value is Context {
    return value === 'trigger' || value === 'effect';
}

/**
 * The one parameter of a prefix row that its documented usage line writes with a number, that
 * the row points to as an entry of `iterator_params`, and that the table reads for every list.
 */
function countParameter(spec: Spec, row: { readonly [key: string]: unknown }): string | null {
    const see = Array.isArray(row['see']) ? (row['see'] as unknown[]) : [];
    const pointed = new Set(
        see
            .filter((s): s is string => typeof s === 'string' && s.startsWith(PARAMETER_SEE))
            .map((s) => s.slice(PARAMETER_SEE.length)),
    );
    const params = tablesOf(spec).iteratorParams;
    const found = new Set<string>();
    const evidence = Array.isArray(row['evidence']) ? (row['evidence'] as unknown[]) : [];
    for (const item of evidence) {
        if (typeof item !== 'object' || item === null) {
            continue;
        }
        const e = item as Readonly<Record<string, unknown>>;
        if (typeof e['rank'] !== 'number' || e['rank'] > 2 || e['supports'] !== 'role') {
            continue;
        }
        const quote = e['quote'];
        if (typeof quote !== 'string') {
            continue;
        }
        for (const [, name = '', values = ''] of quote.matchAll(USAGE_PARAMETER)) {
            if (
                pointed.has(name) &&
                params.get(name)?.lists === '*' &&
                values.split('/').includes(NUMBER_WORD)
            ) {
                found.add(name);
            }
        }
    }
    return found.size === 1 ? ([...found][0] ?? null) : null;
}

const readings = new WeakMap<Spec, ReadonlyMap<string, PrefixReading>>();

/** Every prefix part D8 confirms, with its kind, its body and how it asks for at least one. */
export function prefixReadings(spec: Spec): ReadonlyMap<string, PrefixReading> {
    const known = readings.get(spec);
    if (known !== undefined) {
        return known;
    }
    const out = new Map<string, PrefixReading>();
    for (const row of spec.part('iterator_kinds')?.prefixes ?? []) {
        if (row.status !== 'confirmed' || !isContext(row.kind) || !isContext(row.body)) {
            continue;
        }
        const count = row.body === 'trigger' ? countParameter(spec, row) : null;
        out.set(row.prefix, {
            kind: row.kind,
            body: row.body,
            atLeastOne: count === null ? null : `${count} >= 1`,
        });
    }
    readings.set(spec, out);
    return out;
}

/** What an empty block of an iterator means, and the test written out where it asks for one. */
export interface EmptyIterator {
    readonly means: EmptyIteratorMeaning;
    /** For `at-least-one`: the test written out (`<parameter> >= 1`), or null. */
    readonly writtenOut: string | null;
}

/**
 * What the empty block of `pair` means when its key is an iterator: `at-least-one` for a
 * condition, `not-known` where the package does not say how it is read; null for a key that is
 * no iterator, and for an effect iterator in an effect block, whose empty block does nothing.
 * `key` is the context reader's judgement of the pair, when it judged it.
 */
export function emptyIterator(
    spec: Spec,
    names: DefinedNames,
    pair: Pair,
    key: JudgedKey | undefined,
): EmptyIterator | null {
    if (key === undefined) {
        // Not in a trigger or effect block: what an iterator does there is not decided.
        return iteratorNamed(spec, names, pair.key.text) === undefined
            ? null
            : { means: 'not-known', writtenOut: null };
    }
    if (key.reading.kind !== 'iterator') {
        return null;
    }
    const row = prefixReadings(spec).get(key.reading.prefix);
    if (row === undefined || row.kind !== key.context) {
        return { means: 'not-known', writtenOut: null };
    }
    if (row.body === 'effect') {
        return null;
    }
    return { means: 'at-least-one', writtenOut: row.atLeastOne };
}
