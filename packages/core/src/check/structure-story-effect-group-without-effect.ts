/**
 * `structure/story-effect-group-without-effect` (docs/checks.md, item 4.7): an
 * `effect_group` with no `triggered_effect`, `first_valid` or `random_valid`. Advice: none of
 * the base game's 171. The keywords are part D4's rows inside it with the role
 * `one_of_required` that are no interval.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { effectGroupsOf, written } from './advice-story.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/story-effect-group-without-effect';

function run(input: AdviceInput): AdviceResult {
    const groups = effectGroupsOf(input);
    if (groups === undefined || groups.effects.length === 0) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const block of groups.blocks) {
        if (written(block.body, groups.effects).length === 0) {
            findings.push(
                finding(
                    CODE,
                    block.pair.key,
                    [groups.keyword, either(groups.effects)],
                    { block: groups.keyword, missing: groups.effects },
                    input.context,
                ),
            );
        }
    }
    return { judged: groups.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
