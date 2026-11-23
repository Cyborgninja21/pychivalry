/**
 * `structure/casus-belli-without-outcome` (docs/checks.md, item 4.7): a casus belli with none
 * of `on_victory`, `on_defeat`, `on_white_peace`. Advice: none of the base game's 138.
 *
 * The keywords are part D4's rows with the roles `outcome_effect` and `one_of_required`, with
 * the keys each `pairs_with`; the records judged are those of the folders the rows hold in.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { directoryOf, either, NOTHING, recordsOf } from './advice.js';
import { childPairs, holdsIn, keywordRolesOf } from './keyword-roles.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/casus-belli-without-outcome';

function run(input: AdviceInput): AdviceResult {
    const dir = directoryOf(input);
    const rows = keywordRolesOf(input.spec)
        .withRoles('outcome_effect', 'one_of_required')
        .filter((r) => r.parents.length === 0 && r.directories !== 'anywhere');
    if (rows.length === 0 || !rows.some((r) => holdsIn(r, dir))) {
        return NOTHING;
    }
    const group = new Set<string>();
    for (const row of rows.filter((r) => holdsIn(r, dir))) {
        group.add(row.keyword);
        row.pairsWith.forEach((k) => group.add(k));
    }
    const keys = [...group];
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const record of recordsOf(input.tree)) {
        judged++;
        if (keys.every((k) => childPairs(record.body, k).length === 0)) {
            const key = record.pair.key;
            findings.push(
                finding(
                    CODE,
                    key,
                    [key.text, either(keys)],
                    { record: key.text, missing: keys },
                    input.context,
                ),
            );
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
