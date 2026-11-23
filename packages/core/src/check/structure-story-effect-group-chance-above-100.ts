/**
 * `structure/story-effect-group-chance-above-100` (docs/checks.md, item 4.7): an
 * `effect_group` whose `chance` is above 100. Advice: none of the base game's 50. The keyword
 * is part D4's row with the role `bounded_number` inside it; the bound is the top of its
 * `range` ("0 to 100").
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { chancesOf, upperBound } from './advice-chance.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/story-effect-group-chance-above-100';

function run(input: AdviceInput): AdviceResult {
    const found = chancesOf(input);
    const high = upperBound(found?.range ?? null);
    if (found === undefined || high === undefined) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const c of found.chances) {
        if (c.n > high) {
            findings.push(
                finding(
                    CODE,
                    c.value,
                    [c.pair.key.text, c.value.text, String(high)],
                    { keyword: c.pair.key.text, value: c.value.text, range: found.range ?? '' },
                    input.context,
                ),
            );
        }
    }
    return { judged: found.chances.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
