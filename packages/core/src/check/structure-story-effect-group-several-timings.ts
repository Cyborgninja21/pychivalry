/**
 * `structure/story-effect-group-several-timings` (docs/checks.md, item 4.7): an
 * `effect_group` with more than one of `days`, `weeks`, `months`, `years`. Advice: none of
 * the base game's 171. The keywords are part D4's rows with the role `interval` inside it
 * (`mutually_exclusive`, measured only).
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { effectGroupsOf, written } from './advice-story.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/story-effect-group-several-timings';

function run(input: AdviceInput): AdviceResult {
    const groups = effectGroupsOf(input);
    if (groups === undefined || groups.timings.length === 0) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const block of groups.blocks) {
        const timings = written(block.body, groups.timings).sort((a, b) => a.start - b.start);
        const second = timings[1];
        if (second !== undefined) {
            findings.push(
                finding(
                    CODE,
                    second.key,
                    [groups.keyword, either(groups.timings)],
                    { block: groups.keyword, written: timings.map((p) => p.key.text) },
                    input.context,
                ),
            );
        }
    }
    return { judged: groups.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
