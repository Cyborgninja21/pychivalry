/**
 * `structure/event-portrait-position-twice` (docs/checks.md, item 4.7): one portrait position
 * given twice in an event. Advice: none of the base game's 10,836 events.
 *
 * The keywords are part D4's event rows with the roles `portrait_slot` and `at_most_once`.
 */

import type { AdviceCheck } from './advice.js';
import { writtenTwice } from './advice-twice.js';
import { eventModelOf, eventRows } from './advice-events.js';

export const CODE = 'structure/event-portrait-position-twice';

export const check: AdviceCheck = {
    code: CODE,
    run: (input) =>
        writtenTwice(
            input,
            CODE,
            eventRows(eventModelOf(input.spec), 'portrait_slot', 'at_most_once'),
        ),
};
