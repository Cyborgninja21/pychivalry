/**
 * The empty cases of a container, for `style/empty-block` (the owner's decision of 2026-11-26,
 * docs/decisions.md row 174): still reported as a hint, but never offered for removal, since
 * taking one away changes what the script does, and the message says what it would change.
 * Everything is read from the spec package; no keyword is written here.
 *
 * A case is a key of the body of a container, as the context reader reads it: a key the reader
 * judged in a trigger or effect block as a keyword of the table `containers` whose rule has
 * `cases` ("every other key of the body is a case label whose block keeps the context"), and
 * whose body it read as triggers or effects; the case is any key of that body that is not one of
 * the rule's `params`. The reader judges no case's key, so neither row 167 nor row 172 covers
 * one. Where the reader judges no key, in a block it reads as record fields or as a script value
 * (inside the body of an effect the package gives no rule for), the container's name decides by
 * the same table, as it does for a `limit` there (`empty-open.ts`). Two kinds, each from the
 * package's data:
 *
 * - **An entry of a random list**: a case of a container whose cases take parameters of their
 *   own, from the table its `case_params` names (the package's `random_list_entry`: the entry's
 *   `trigger`, the modifiers of its weight, its `min` and `max`, `show_chance`, `desc`). One
 *   entry is picked by its weight among the others, so an empty one is a chance of nothing, and
 *   taking it away changes the odds of the others. Part D4 does not cover these containers (its
 *   own `not_settled`); the tables do.
 * - **A case of a case list**: a case of a container part D4 gives the role `case_list`, "picks
 *   one of its case blocks by the value of its selector, else its fallback", in the file's folder.
 *   Taking an empty case away lets the fallback run for its value, or, where none is written,
 *   leaves that value with no case. The fallback is a case too: the key of a D4 row with the role
 *   `fallback_case` ("the case used when no other matches") whose parents name the container;
 *   taking an empty one away leaves every value no case names with no case.
 *
 * A case of any other container (none the package confirms today) is read as before.
 */

import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import type { Pair } from '../syntax/tree.js';
import type { BlockKind, JudgedKey } from './context.js';
import { bodyOf, childPairs, holdsIn, keywordRolesOf } from './keyword-roles.js';

/** What kind of case an empty block is. */
export type EmptyCaseKind =
    /** An entry of a random list, picked by its weight among the others. */
    | 'random-entry'
    /** A case of a case list, picked by the value of its selector. */
    | 'case'
    /** The fallback of a case list, used when no other case matches. */
    | 'fallback-case';

/** An empty case: its kind, the container as written, and the fallback written beside it. */
export interface EmptyCase {
    readonly kind: EmptyCaseKind;
    /** The container's key as the file writes it. */
    readonly container: string;
    /** For a `case`: the key of the fallback the container holds, or null when it holds none. */
    readonly fallback: string | null;
}

/** Part D4's role of a container that picks one of its cases by the value of its selector. */
const CASE_LIST = 'case_list';

/** Part D4's role of the case of a case list used when no other matches. */
const FALLBACK_CASE = 'fallback_case';

/** Where an empty block is written, as the context reader reads the blocks around it. */
export interface CasePlace {
    /** The folder of the spec's list the file is in, if any. */
    readonly directory: string | null;
    /** The pair whose block the empty one is written in, if it is written in a pair's block. */
    readonly around: Pair | undefined;
    /** The reader's judgement of that pair's key, when it judged it. */
    readonly container: JudgedKey | undefined;
    /** How the reader reads the block the empty one is written in, if it reads it. */
    readonly parent: BlockKind | undefined;
}

/**
 * What kind of case `pair` is, when it is a case of a container the package describes, or null
 * (see the head of this file).
 */
export function emptyCase(spec: Spec, pair: Pair, place: CasePlace): EmptyCase | null {
    const { around, container, parent, directory } = place;
    if (around === undefined) {
        return null;
    }
    let name: string;
    if (container === undefined) {
        // Not judged: read by its name, in a block read as record fields or as a script value.
        if (parent !== 'none' && parent !== 'script-value') {
            return null;
        }
        name = around.key.text;
    } else {
        if (container.reading.kind !== 'keyword' || (parent !== 'trigger' && parent !== 'effect')) {
            return null;
        }
        name = container.folded ?? around.key.text;
    }
    const rule = tablesOf(spec).containers.get(name);
    if (rule === undefined || !rule.cases || rule.params.has(pair.key.text)) {
        return null;
    }
    const written = around.key.text;
    const roles = keywordRolesOf(spec);
    if (roles.withRoles(CASE_LIST).some((r) => r.keyword === name && holdsIn(r, directory))) {
        const fallbacks = roles
            .withRoles(FALLBACK_CASE)
            .filter((r) => r.parents.includes(name) && holdsIn(r, directory))
            .map((r) => r.keyword);
        if (fallbacks.includes(pair.key.text)) {
            return { kind: 'fallback-case', container: written, fallback: null };
        }
        const body = bodyOf(around);
        const fallback =
            body === undefined
                ? undefined
                : fallbacks.find((keyword) => childPairs(body, keyword).length > 0);
        return { kind: 'case', container: written, fallback: fallback ?? null };
    }
    if (rule.caseParams.size > 0) {
        return { kind: 'random-entry', container: written, fallback: null };
    }
    return null;
}
