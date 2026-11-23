/**
 * `structure/event-triggered-animation-without-trigger` (docs/checks.md, item 4.7): a
 * portrait's `triggered_animation` without `trigger`. Advice: none of the base game's.
 *
 * The keywords are part D4's: the row with the role `conditional_entry` whose parents are an
 * event's portrait positions (`triggered_animation`, with those parents), and the row inside
 * it with the roles `entry_condition` and `required` (`trigger`).
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { childPairs } from './keyword-roles.js';
import { triggeredAnimations } from './advice-animations.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import { keywordRolesOf } from './keyword-roles.js';

export const CODE = 'structure/event-triggered-animation-without-trigger';

function run(input: AdviceInput): AdviceResult {
    const found = triggeredAnimations(input);
    if (found === undefined) {
        return NOTHING;
    }
    const required = keywordRolesOf(input.spec)
        .withRoles('entry_condition', 'required')
        .filter((r) => r.parents.length === 1 && r.parents[0] === found.row.keyword);
    const trigger = required.length === 1 ? required[0] : undefined;
    if (trigger === undefined) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const block of found.blocks) {
        if (childPairs(block.body, trigger.keyword).length === 0) {
            findings.push(
                finding(
                    CODE,
                    block.pair.key,
                    [found.row.keyword, trigger.keyword],
                    { block: found.row.keyword, missing: trigger.keyword },
                    input.context,
                ),
            );
        }
    }
    return { judged: found.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
