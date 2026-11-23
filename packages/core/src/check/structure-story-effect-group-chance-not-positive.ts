/**
 * `structure/story-effect-group-chance-not-positive` (docs/checks.md, item 4.7): an
 * `effect_group` whose `chance` is zero or less. Advice: none of the base game's 50. The
 * keyword is part D4's row with the role `bounded_number` inside it.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { chancesOf } from './advice-chance.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/story-effect-group-chance-not-positive';

function run(input: AdviceInput): AdviceResult {
    const found = chancesOf(input);
    if (found === undefined) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const c of found.chances) {
        if (c.n <= 0) {
            findings.push(
                finding(
                    CODE,
                    c.value,
                    [c.pair.key.text, c.value.text],
                    { keyword: c.pair.key.text, value: c.value.text },
                    input.context,
                ),
            );
        }
    }
    return { judged: found.chances.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
