/**
 * `structure/event-empty` (docs/checks.md, item 4.7): an event with nothing in it. Advice:
 * none of the base game's 10,836 events. It tests no keyword: only that the event's block holds
 * nothing but comments.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { eventModelOf, eventsOf } from './advice-events.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import { significantItems } from '../syntax/tree.js';

export const CODE = 'structure/event-empty';

function run(input: AdviceInput): AdviceResult {
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, eventModelOf(input.spec))) {
        judged++;
        if (significantItems(event.body).length === 0) {
            const key = event.pair.key;
            findings.push(finding(CODE, key, [key.text], { event: key.text }, input.context));
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
