/**
 * Finding codes as the tools take them: a code (`names/unknown-trigger`), a family
 * (`names/*`) or `*`, as the command line's `--code` and `explain` take them. A pattern that
 * matches no code of this build is bad input, and the text names the codes.
 */

import { codeMatches, familyOf, inventoryRows, type Code } from '@pychivalry/core';
import { BadInput, valueList } from '../result.js';

/** Every code of this build, sorted. */
export function allCodes(): Code[] {
    return inventoryRows().map((row) => row.code);
}

/** The valid patterns, in a sentence: every family as `<family>/*`, then every code. */
export function validCodesText(): string {
    const codes = allCodes();
    const families = [...new Set(codes.map(familyOf))].map((f) => `${f}/*`);
    return `the codes are ${valueList(codes, 4_000)}; a whole family is written ${families.join(', ')}, and every code *`;
}

/** The codes the patterns match, or bad input naming the valid ones for a pattern matching none. */
export function codesOf(patterns: readonly string[], argument: string): Set<Code> {
    const codes = allCodes();
    const out = new Set<Code>();
    for (const pattern of patterns) {
        const matched = codes.filter((code) => codeMatches(pattern, code));
        if (matched.length === 0) {
            throw new BadInput(
                `${argument}: ${pattern} matches no code of this build; ${validCodesText()}`,
            );
        }
        for (const code of matched) {
            out.add(code);
        }
    }
    return out;
}
