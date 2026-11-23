/**
 * `structure/switch-without-branches` (docs/checks.md, item 4.7): a `switch` block with no
 * branch. Advice: none of the base game's.
 *
 * A branch is any key of the block but the case selector and the fallback case (part D4's
 * rows with the roles `case_selector` and `fallback_case`): every other key of the body is a
 * case label, as the table `containers` says of its `cases`.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { switchesOf } from './advice-switch.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import { significantItems } from '../syntax/tree.js';

export const CODE = 'structure/switch-without-branches';

function run(input: AdviceInput): AdviceResult {
    const switches = switchesOf(input);
    if (switches === undefined) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const block of switches.blocks) {
        const branches = significantItems(block.body).filter(
            (item) =>
                item.kind !== 'pair' ||
                (item.key.text !== switches.selector && item.key.text !== switches.fallback),
        );
        if (branches.length === 0) {
            findings.push(
                finding(
                    CODE,
                    block.pair.key,
                    [switches.keyword],
                    { block: switches.keyword },
                    input.context,
                ),
            );
        }
    }
    return { judged: switches.blocks.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
