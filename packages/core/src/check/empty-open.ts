/**
 * The empty blocks whose meaning the spec package leaves open, for `style/empty-block` (the
 * owner's decision of 2026-11-26, docs/decisions.md row 172): they are still reported, but
 * never offered for removal, until the spec work says what each evaluates to when empty
 * (decision 169, its fourth point). Everything is read from the package; no keyword is written
 * here.
 *
 * - **A logical operator**: a key part D4 gives the role `combines_conditions`, "a block of
 *   conditions that holds or fails by which of its direct children hold" (`AND`, `OR`, `NOT`,
 *   `NOR`, `NAND`, `all_false`, `any_false`, `calc_true_if`, `weighted_calc_true_if`), whose row
 *   holds in the file's folder, by the name the reader reads the key as. D4's own `not_settled`
 *   says the game's documentation of these does not say what an empty one evaluates to. The
 *   reader reads `and` and `or` as the game's own triggers, of which the part says nothing: they
 *   are triggers written with an empty block (decision 167), as before.
 * - **A trigger block** (the owner's "an empty `limit`"): a structural keyword or a parameter
 *   of the block around it whose block the package reads as triggers, by the tables
 *   `structural`, `iterator_params`, `random_list_entry` and `block_params` (a `limit`, an
 *   `alternative_limit`, a `random_list` entry's `trigger`), and that part D4 gives no
 *   `combines_conditions` row. D4's own `not_settled` names these plain trigger blocks: the
 *   game's documentation tells when such a block is evaluated, not how it combines its
 *   conditions, so what an empty one evaluates to is not known.
 * - **A scope switch**: a key that is a chain (`scope:target`, `root.liege`) or a name of the
 *   links bucket (`liege`, and `root`, which the table `structural` also lists), whose block
 *   the reader reads in the scope it switches to, like the block around it. Part D4 has no row
 *   for one; in a trigger block an empty one may fail where its scope does not exist, and what
 *   it evaluates to is not stated.
 *
 * A logical operator is read first, then a scope switch (whose block is read like the block
 * around it, which in a trigger block is triggers too), then a trigger block. In a trigger or
 * effect block the context reader's judgement of the key decides. Where the reader judges no
 * key, in a block it reads as record fields or as a script value, the key's name decides by the
 * same data: part D4's rows (an `OR` in an AI weight's `modifier`, which the reader reads as a
 * script value), the reader's own rule that a chain or a link there is a scope switch, and a
 * structural keyword whose block the table reads as triggers (a `limit` in a script value's
 * `if`). A key the reader does not judge in a trigger or effect block is a case of the block
 * around it (a `random_list` entry, a `switch` case), which `empty-case.ts` reads (row 174), and
 * a key of a modifier block or of a block the reader does not read is none of these: read as
 * before.
 */

import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import type { Pair } from '../syntax/tree.js';
import type { BlockKind, JudgedKey } from './context.js';
import { holdsIn, keywordRolesOf } from './keyword-roles.js';

/** An empty block whose meaning the package leaves open: what kind of block it is. */
export type OpenEmptyBlock =
    /** A block that combines its conditions: `AND`, `OR`, `NOT`, `all_false`. */
    | 'logical-operator'
    /** Conditions that filter or gate something: a `limit`, a `random_list` entry's `trigger`. */
    | 'trigger-block'
    /** A block run in another scope: `scope:target`, `liege`. */
    | 'scope-switch';

/** The words a message names each kind by. */
export const OPEN_EMPTY_WORDS: Readonly<Record<OpenEmptyBlock, string>> = {
    'logical-operator': 'logical operator',
    'trigger-block': 'trigger block',
    'scope-switch': 'scope switch',
};

/** Part D4's role of a block of conditions that holds or fails by which of its children hold. */
const COMBINES = 'combines_conditions';

/** Where a key is written, as the context reader reads the blocks around it. */
export interface EmptyPlace {
    /** The folder of the spec's list the file is in, if any. */
    readonly directory: string | null;
    /** The reader's judgement of the key, when it judged it (in a trigger or effect block). */
    readonly key: JudgedKey | undefined;
    /** How the reader reads the empty block itself, if it reads it. */
    readonly block: BlockKind | undefined;
    /** How the reader reads the block it is written in, if it reads it. */
    readonly parent: BlockKind | undefined;
}

/** True when part D4 says the keyword combines the conditions of its block, in this folder. */
function combinesConditions(spec: Spec, name: string, directory: string | null): boolean {
    return keywordRolesOf(spec)
        .withRoles(COMBINES)
        .some((row) => row.keyword === name && holdsIn(row, directory));
}

/**
 * What kind of block `pair` is when the package leaves open what it means empty, or null when
 * it is none of the kinds (see the head of this file).
 */
export function openEmptyBlock(spec: Spec, pair: Pair, place: EmptyPlace): OpenEmptyBlock | null {
    const tables = tablesOf(spec);
    const links = (name: string): boolean => vocabularyOf(spec).has('links', name);
    const { key, directory } = place;
    if (key === undefined) {
        if (place.parent !== 'none' && place.parent !== 'script-value') {
            // A case of a container (`empty-case.ts`), a modifier block's key, or a block not read.
            return null;
        }
        const name = pair.key.text;
        if (combinesConditions(spec, name, directory)) {
            return 'logical-operator';
        }
        if (pair.key.type === 'chain' || links(name)) {
            return 'scope-switch';
        }
        return tables.structural.get(name) === 'trigger' ? 'trigger-block' : null;
    }
    const name = key.folded ?? pair.key.text;
    if (combinesConditions(spec, name, directory)) {
        return 'logical-operator';
    }
    const kind = key.reading.kind;
    if (
        kind === 'chain' ||
        kind === 'link' ||
        ((kind === 'structural' || kind === 'keyword') && links(name))
    ) {
        return 'scope-switch';
    }
    if (
        (kind === 'block-param' ||
            (kind === 'structural' && tables.structural.get(name) === 'trigger')) &&
        place.block === 'trigger'
    ) {
        return 'trigger-block';
    }
    return null;
}
