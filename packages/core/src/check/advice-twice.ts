/**
 * Keywords an event takes at most once (part D4's role `at_most_once`), shared by the checks
 * of an event block or a portrait position written twice.
 */

import type { AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { childPairs, type RoleRow } from './advice-roles.js';
import { eventModelOf, eventsOf } from './advice-events.js';
import type { AdviceCode, CheckFinding } from './finding.js';
import { finding } from './report.js';

/** Every event judged; a finding at the second of each keyword of `rows` written twice. */
export function writtenTwice(
    input: AdviceInput,
    code: AdviceCode,
    rows: readonly RoleRow[],
): AdviceResult {
    if (rows.length === 0) {
        return NOTHING;
    }
    const model = eventModelOf(input.spec);
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        judged++;
        for (const row of rows) {
            const again = childPairs(event.body, row.keyword)[1];
            if (again !== undefined) {
                const key = event.pair.key;
                findings.push(
                    finding(
                        code,
                        again.key,
                        [key.text, row.keyword],
                        { event: key.text, keyword: row.keyword },
                        input.context,
                    ),
                );
            }
        }
    }
    return { judged, findings };
}
