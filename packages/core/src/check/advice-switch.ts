/**
 * Switch blocks, as part D4 names them: the block whose rows have the roles `case_selector`
 * (its `trigger`) and `fallback_case` (its `fallback`), every one written anywhere.
 */

import type { Block, Pair } from '../syntax/tree.js';
import type { AdviceInput } from './advice.js';
import { walkPairs } from './advice.js';
import { bodyOf, keywordRolesOf } from './advice-roles.js';

export interface Switches {
    readonly keyword: string;
    /** The case selector's keyword. */
    readonly selector: string;
    /** The fallback case's keyword, if part D4 has one. */
    readonly fallback: string | null;
    readonly blocks: readonly { readonly pair: Pair; readonly body: Block }[];
}

/** The switch blocks of the file, or undefined when part D4 names no case selector. */
export function switchesOf(input: AdviceInput): Switches | undefined {
    const roles = keywordRolesOf(input.spec);
    const selectors = roles.withRoles('case_selector').filter((r) => r.parents.length === 1);
    const selector = selectors.length === 1 ? selectors[0] : undefined;
    const keyword = selector?.parents[0];
    if (selector === undefined || keyword === undefined) {
        return undefined;
    }
    const fallbacks = roles
        .withRoles('fallback_case')
        .filter((r) => r.parents.length === 1 && r.parents[0] === keyword);
    const blocks: { pair: Pair; body: Block }[] = [];
    walkPairs(input.tree, (pair) => {
        if (pair.key.text !== keyword) {
            return;
        }
        const body = bodyOf(pair);
        if (body !== undefined) {
            blocks.push({ pair, body });
        }
    });
    return {
        keyword,
        selector: selector.keyword,
        fallback: fallbacks.length === 1 ? (fallbacks[0]?.keyword ?? null) : null,
        blocks,
    };
}
