/**
 * `structure/event-without-desc` (docs/checks.md, item 4.7): an event that is not hidden and
 * has no `desc`. Advice: the base game's 9,562 shown events all have one.
 *
 * The keyword is part D4's event description (`descriptionRow`: the required event row whose
 * block form is a dynamic description); the events it judges are those its measured condition
 * names (`condition_from: measured`: the events that are not hidden).
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { childPairs, termsHold, type RoleRow } from './advice-roles.js';
import { descriptionRow, eventModelOf, eventsOf, type EventModel } from './advice-events.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';

export const CODE = 'structure/event-without-desc';

/** Events the row's measured condition names that lack the row's keyword. */
export function requiredInShownEvents(
    input: AdviceInput,
    code: typeof CODE | 'structure/event-without-option',
    pick: (model: EventModel) => RoleRow | undefined,
): AdviceResult {
    const model = eventModelOf(input.spec);
    const row = pick(model);
    const when = row === undefined ? undefined : model.roles.condition(row, `no:${row.keyword}`);
    if (row === undefined || when === undefined) {
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
                    code,
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

export const check: AdviceCheck = {
    code: CODE,
    run: (input) => requiredInShownEvents(input, CODE, descriptionRow),
};
