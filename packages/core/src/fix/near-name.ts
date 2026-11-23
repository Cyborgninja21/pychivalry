/**
 * "Did you mean" as a fix (docs/PLAN.md item 8.7): an unknown name replaced by a name valid at
 * its place that is near it, by lookup's bounded search (`lookup/suggest.ts`: Levenshtein's
 * distance, letter case ignored, at most 1 for a name of up to 7 characters, 2 up to 11, 3
 * from 12, the work bounded).
 *
 * - **Safe** when the search saw every candidate, exactly one name of the place's whole pool
 *   (`fix/candidates.ts`) is near, that name is valid there, and it is one slip away: one
 *   letter added, left out or changed, two letters next to each other swapped, or the letter
 *   case. A name further away (`heritage_levantine` and `heritage_byzantine` are three letters
 *   apart) is as likely a name the index does not see, of a mod the one checked builds on, or
 *   one the game dropped: a suggestion. A finding of advice is never fixed safely: its name may
 *   be one the index cannot see.
 * - **A suggestion** when several are near: the valid ones, nearest first.
 * - **None** when none is.
 */

import { suggest } from '../lookup/suggest.js';
import type { Candidates } from './candidates.js';
import { safeFix, suggestion, type FindingFix, type FixAlternative } from './fix.js';

/** The most names the search returns: enough to count "more than one" and fill the list. */
const SEARCHED = 50;

/**
 * True when `b` is `a` with one slip: the same in any letter case, or one letter added, left
 * out or changed, or two adjacent letters swapped.
 */
export function oneSlip(a: string, b: string): boolean {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    if (x === y) {
        return true;
    }
    if (Math.abs(x.length - y.length) > 1) {
        return false;
    }
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) {
        i++;
    }
    let j = 0;
    while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) {
        j++;
    }
    const left = x.length - i - j;
    const right = y.length - i - j;
    if (left <= 1 && right <= 1) {
        return true;
    }
    // Two adjacent letters swapped: `ab` against `ba` between the common start and end.
    return left === 2 && right === 2 && x[i] === y[i + 1] && x[i + 1] === y[i];
}

/**
 * The valid names near `name`, nearest first, and whether exactly one of the pool is near and
 * it is one slip away (`oneSlip`).
 */
export function nearNames(
    name: string,
    candidates: Candidates,
): { readonly near: readonly string[]; readonly onlyOne: boolean } {
    const found = suggest(
        name,
        candidates.pool.map((n) => ({ name: n, from: 'package' as const })),
        { limit: SEARCHED },
    );
    const valid = new Set(candidates.valid);
    const near = found.suggestions.map((s) => s.name).filter((n) => valid.has(n));
    const only = near[0];
    return {
        near,
        onlyOne:
            found.complete &&
            found.suggestions.length === 1 &&
            near.length === 1 &&
            only !== undefined &&
            oneSlip(name, only),
    };
}

/**
 * The fix of an unknown name: each near name as an alternative (`replace` makes its edits),
 * safe when exactly one is near and `safeAllowed`; null when none is.
 */
export function nearNameFix(
    name: string,
    candidates: Candidates | null,
    replace: (candidate: string) => FixAlternative | null,
    safeAllowed: boolean,
): FindingFix | null {
    if (candidates === null) {
        return null;
    }
    const { near, onlyOne } = nearNames(name, candidates);
    const alternatives = near.map(replace).filter((a): a is FixAlternative => a !== null);
    const first = alternatives[0];
    if (first === undefined) {
        return null;
    }
    if (safeAllowed && onlyOne && alternatives.length === 1) {
        return safeFix('nearest-name', first);
    }
    return suggestion('nearest-name', alternatives);
}
