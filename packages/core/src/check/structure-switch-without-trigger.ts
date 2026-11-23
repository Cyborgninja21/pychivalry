/**
 * `structure/switch-without-trigger` (docs/checks.md, item 4.7): a `switch` block without
 * `trigger`. Advice: none of the base game's.
 *
 * The keywords are part D4's row with the role `case_selector` and the parent it holds in.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { childPairs } from './keyword-roles.js';
import { switchesOf } from './advice-switch.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/switch-without-trigger';

function run(input: AdviceInput): AdviceResult {
    const switches = switchesOf(input);
    if (switches === undefined) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const block of switches.blocks) {
        if (childPairs(block.body, switches.selector).length === 0) {
            findings.push(
                finding(
                    CODE,
                    block.pair.key,
                    [switches.keyword, switches.selector],
                    { block: switches.keyword, missing: switches.selector },
                    input.context,
                ),
            );
        }
    }
    return { judged: switches.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
