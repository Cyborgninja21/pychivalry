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
 * one. From the package's data:
 *
 * - **An entry of a random list**: a case of a container whose cases take parameters of their
 *   own, from the table its `case_params` names (the package's `random_list_entry`: the entry's
 *   `trigger`, the modifiers of its weight, its `min` and `max`, `show_chance`, `desc`). One
 *   entry is picked by its weight among the others, so an empty one is a chance of nothing, and
 *   taking it away changes the odds of the others. Part D4 does not cover these containers (its
 *   own `not_settled`); the tables do.
 *
 * A case of any other container is read as before.
 */

import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import type { Pair } from '../syntax/tree.js';
import type { BlockKind, JudgedKey } from './context.js';

/** What kind of case an empty block is. */
export type EmptyCaseKind =
    /** An entry of a random list, picked by its weight among the others. */
    'random-entry';

/** An empty case: its kind, and the container as written. */
export interface EmptyCase {
    readonly kind: EmptyCaseKind;
    /** The container's key as the file writes it. */
    readonly container: string;
}

/** Where an empty block is written, as the context reader reads the blocks around it. */
export interface CasePlace {
    /** The folder of the spec's list the file is in, if any. */
    readonly directory: string | null;
    /** The reader's judgement of the key whose block the empty one is written in, if it judged it. */
    readonly container: JudgedKey | undefined;
    /** How the reader reads the block the empty one is written in, if it reads it. */
    readonly parent: BlockKind | undefined;
}

/**
 * What kind of case `pair` is, when it is a case of a container the package describes, or null
 * (see the head of this file).
 */
export function emptyCase(spec: Spec, pair: Pair, place: CasePlace): EmptyCase | null {
    const { container } = place;
    if (
        container === undefined ||
        container.reading.kind !== 'keyword' ||
        (place.parent !== 'trigger' && place.parent !== 'effect')
    ) {
        return null;
    }
    const name = container.folded ?? container.pair.key.text;
    const rule = tablesOf(spec).containers.get(name);
    if (rule === undefined || !rule.cases || rule.params.has(pair.key.text)) {
        return null;
    }
    if (rule.caseParams.size > 0) {
        return { kind: 'random-entry', container: container.pair.key.text };
    }
    return null;
}
