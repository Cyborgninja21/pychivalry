/**
 * `structure/event-after-without-option` (docs/checks.md, item 4.7): an event that is not
 * hidden, has an `after` and no `option`. Advice: none of the base game's 2,641 such events.
 *
 * The keywords are part D4's event row with the role `needs_sibling` (`after`) and the keys
 * its `needs` names (`option`): the row's role is that it does nothing without one of them.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { childPairs } from './keyword-roles.js';
import { eventModelOf, eventRow, eventsOf, isHidden } from './advice-events.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/event-after-without-option';

function run(input: AdviceInput): AdviceResult {
    const model = eventModelOf(input.spec);
    const row = eventRow(model, 'needs_sibling');
    if (row === undefined || row.needs.length === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        const after = childPairs(event.body, row.keyword)[0];
        if (after === undefined || isHidden(model, event.body) !== false) {
            continue;
        }
        judged++;
        if (row.needs.every((need) => childPairs(event.body, need).length === 0)) {
            const key = event.pair.key;
            findings.push(
                finding(
                    CODE,
                    after.key,
                    [key.text, row.keyword, either(row.needs)],
                    { event: key.text, block: row.keyword, missing: row.needs },
                    input.context,
                ),
            );
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
