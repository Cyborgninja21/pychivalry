/**
 * `structure/story-effect-group-without-timing` (docs/checks.md, item 4.7): a story cycle's
 * `effect_group` with none of `days`, `weeks`, `months`, `years`. Advice: none of the base
 * game's 171. The keywords are part D4's rows with the role `interval` inside it.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { effectGroupsOf, written } from './advice-story.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/story-effect-group-without-timing';

function run(input: AdviceInput): AdviceResult {
    const groups = effectGroupsOf(input);
    if (groups === undefined || groups.timings.length === 0) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const block of groups.blocks) {
        if (written(block.body, groups.timings).length === 0) {
            findings.push(
                finding(
                    CODE,
                    block.pair.key,
                    [groups.keyword, either(groups.timings)],
                    { block: groups.keyword, missing: groups.timings },
                    input.context,
                ),
            );
        }
    }
    return { judged: groups.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
