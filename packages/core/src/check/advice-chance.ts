/**
 * An effect group's chance (part D4's row with the role `bounded_number` inside it): every
 * chance written as a number, for the two checks of a chance out of its range.
 */

import type { Pair, Scalar } from '../syntax/tree.js';
import type { AdviceInput } from './advice.js';
import { numberOf } from './advice.js';
import { childPairs } from './advice-roles.js';
import { effectGroupsOf } from './advice-story.js';

export interface Chance {
    readonly pair: Pair;
    readonly value: Scalar;
    readonly n: number;
}

/** The chances of the file's effect groups, and the row's `range`, or undefined. */
export function chancesOf(
    input: AdviceInput,
): { readonly range: string | null; readonly chances: readonly Chance[] } | undefined {
    const groups = effectGroupsOf(input);
    const row = groups?.chance;
    if (groups === undefined || row === undefined) {
        return undefined;
    }
    const chances: Chance[] = [];
    for (const block of groups.blocks) {
        for (const pair of childPairs(block.body, row.keyword)) {
            const n = numberOf(pair);
            if (n !== undefined && pair.value?.kind === 'scalar') {
                chances.push({ pair, value: pair.value, n });
            }
        }
    }
    return { range: row.range, chances };
}

/** The upper bound of a range written `<low> to <high>`, as part D4 writes its `range`. */
export function upperBound(range: string | null): number | undefined {
    const m = range === null ? null : /^\s*-?[0-9.]+\s+to\s+(-?[0-9.]+)\s*$/.exec(range);
    const high = m?.[1] === undefined ? undefined : Number(m[1]);
    return high !== undefined && Number.isFinite(high) ? high : undefined;
}
