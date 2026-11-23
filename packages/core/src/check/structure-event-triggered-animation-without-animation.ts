/**
 * `structure/event-triggered-animation-without-animation` (docs/checks.md, item 4.7): a
 * `triggered_animation` with neither `animation` nor `scripted_animation`. Advice: none of the
 * base game's.
 *
 * The keywords are part D4's: the `triggered_animation` row (as in
 * `structure/event-triggered-animation-without-trigger`) and the rows inside it with the role
 * `one_of_required`, each with the keys it `pairs_with`.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { childPairs, keywordRolesOf } from './keyword-roles.js';
import { triggeredAnimations } from './advice-animations.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/event-triggered-animation-without-animation';

function run(input: AdviceInput): AdviceResult {
    const found = triggeredAnimations(input);
    if (found === undefined) {
        return NOTHING;
    }
    const group = new Set<string>();
    for (const row of keywordRolesOf(input.spec).withRoles('one_of_required')) {
        if (row.parents.length === 1 && row.parents[0] === found.row.keyword) {
            group.add(row.keyword);
            row.pairsWith.forEach((k) => group.add(k));
        }
    }
    if (group.size === 0) {
        return NOTHING;
    }
    const keys = [...group];
    const findings: CheckFinding[] = [];
    for (const block of found.blocks) {
        if (keys.every((k) => childPairs(block.body, k).length === 0)) {
            findings.push(
                finding(
                    CODE,
                    block.pair.key,
                    [found.row.keyword, either(keys)],
                    { block: found.row.keyword, missing: keys },
                    input.context,
                ),
            );
        }
    }
    return { judged: found.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
