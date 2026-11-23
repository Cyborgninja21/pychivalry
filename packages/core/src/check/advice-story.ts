/**
 * A story cycle's effect groups, as part D4 names them: the row with the role
 * `periodic_block` (`effect_group`), its blocks written directly in a record of the folders
 * the row holds in, and the rows that hold inside it: those with the role `interval` (its
 * durations), those with `one_of_required` that are no interval (what it runs), and the one
 * with `bounded_number` (its chance).
 */

import type { Block, Pair } from '../syntax/tree.js';
import type { AdviceInput } from './advice.js';
import { directoryOf, recordsOf } from './advice.js';
import { bodyOf, childPairs, holdsIn, keywordRolesOf, type RoleRow } from './advice-roles.js';

export interface EffectGroups {
    readonly keyword: string;
    readonly timings: readonly string[];
    readonly effects: readonly string[];
    readonly chance: RoleRow | undefined;
    readonly blocks: readonly { readonly pair: Pair; readonly body: Block }[];
}

/** The effect groups of the file, or undefined when it is in no folder the row holds in. */
export function effectGroupsOf(input: AdviceInput): EffectGroups | undefined {
    const roles = keywordRolesOf(input.spec);
    const periodic = roles
        .withRoles('periodic_block')
        .filter((r) => r.parents.length === 0 && r.directories !== 'anywhere');
    const row = periodic.length === 1 ? periodic[0] : undefined;
    if (row === undefined || !holdsIn(row, directoryOf(input))) {
        return undefined;
    }
    const inside = roles.rows.filter((r) => r.parents.length === 1 && r.parents[0] === row.keyword);
    const timings = inside.filter((r) => r.roles.has('interval')).map((r) => r.keyword);
    const effects = inside
        .filter((r) => r.roles.has('one_of_required') && !r.roles.has('interval'))
        .map((r) => r.keyword);
    const chances = inside.filter((r) => r.roles.has('bounded_number'));
    const blocks: { pair: Pair; body: Block }[] = [];
    for (const record of recordsOf(input.tree)) {
        for (const pair of childPairs(record.body, row.keyword)) {
            const body = bodyOf(pair);
            if (body !== undefined) {
                blocks.push({ pair, body });
            }
        }
    }
    return {
        keyword: row.keyword,
        timings,
        effects,
        chance: chances.length === 1 ? chances[0] : undefined,
        blocks,
    };
}

/** How many of these keys the block writes, each counted once per pair. */
export function written(body: Block, keys: readonly string[]): Pair[] {
    return keys.flatMap((k) => childPairs(body, k));
}
