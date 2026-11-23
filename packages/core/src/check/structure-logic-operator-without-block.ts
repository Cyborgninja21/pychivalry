/**
 * `structure/logic-operator-without-block` (docs/checks.md, item 4.7): `AND`, `OR`, `NOT`,
 * `NOR` or `NAND` with a single value instead of a block. Advice: none of the base game's.
 *
 * The keywords are those of part D4's rows whose role, stated in the table `structural`, is
 * `logical_operator`. Every pair of the file is judged, as the part's measurement reads them
 * (anywhere), and in any letter case, as the table `structural` reads its names.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING, walkPairs } from './advice.js';
import { keywordRolesOf } from './keyword-roles.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import { blockOf } from '../syntax/tree.js';

export const CODE = 'structure/logic-operator-without-block';

function run(input: AdviceInput): AdviceResult {
    const operators = new Set(
        keywordRolesOf(input.spec)
            .withRoles('logical_operator')
            .map((r) => r.keyword.toLowerCase()),
    );
    if (operators.size === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    walkPairs(input.tree, (pair) => {
        if (!operators.has(pair.key.text.toLowerCase())) {
            return;
        }
        judged++;
        if (pair.value !== null && blockOf(pair.value) === undefined) {
            findings.push(
                finding(
                    CODE,
                    pair.key,
                    [pair.key.text],
                    { operator: pair.key.text },
                    input.context,
                ),
            );
        }
    });
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
