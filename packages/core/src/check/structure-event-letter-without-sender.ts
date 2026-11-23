/**
 * `structure/event-letter-without-sender` (docs/checks.md, item 4.7): a letter event without
 * `sender`. Advice (decision 52: the `.info` line "required for letter events" is no required
 * schema field): the base game's 705 letter events all have one.
 *
 * The keyword is part D4's event row with the roles `required` and `restricted`; the events it
 * judges are those the row's measured count names (`type=letter_event`), read from the count,
 * not from the row's words.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { childPairs, termsHold } from './keyword-roles.js';
import { eventModelOf, eventRow, eventsOf } from './advice-events.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/event-letter-without-sender';

function run(input: AdviceInput): AdviceResult {
    const model = eventModelOf(input.spec);
    const row = eventRow(model, 'required', 'restricted');
    const when = row === undefined ? undefined : model.roles.condition(row, `no:${row.keyword}`);
    if (row === undefined || when === undefined || when.length === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        if (!termsHold(when, event.body)) {
            continue;
        }
        judged++;
        if (childPairs(event.body, row.keyword).length === 0) {
            const key = event.pair.key;
            findings.push(
                finding(
                    CODE,
                    key,
                    [key.text, row.keyword],
                    { event: key.text, missing: row.keyword },
                    input.context,
                ),
            );
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
