/**
 * `structure/round-to-not-positive` (docs/checks.md, item 4.7): `round_to` with zero or a
 * negative number. Advice: none of the base game's 20.
 *
 * The keyword is part D4's row with the role `bounded_number` that holds anywhere, inside no
 * parent key (its `range` is "not 0"; the row also judges a negative number, as checks.md
 * writes it). Only a value written as a number is judged.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING, numberOf, walkPairs } from './advice.js';
import { keywordRolesOf } from './keyword-roles.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/round-to-not-positive';

function run(input: AdviceInput): AdviceResult {
    const keywords = new Set(
        keywordRolesOf(input.spec)
            .withRoles('bounded_number')
            .filter((r) => r.directories === 'anywhere' && r.parents.length === 0)
            .map((r) => r.keyword),
    );
    if (keywords.size === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    walkPairs(input.tree, (pair) => {
        const n = keywords.has(pair.key.text) ? numberOf(pair) : undefined;
        if (n === undefined || pair.value?.kind !== 'scalar') {
            return;
        }
        judged++;
        if (n <= 0) {
            findings.push(
                finding(
                    CODE,
                    pair.value,
                    [pair.key.text, pair.value.text],
                    { keyword: pair.key.text, value: pair.value.text },
                    input.context,
                ),
            );
        }
    });
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
