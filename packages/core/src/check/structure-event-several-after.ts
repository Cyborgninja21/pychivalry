/**
 * `structure/event-several-after` (docs/checks.md, item 4.7): an event with more than one
 * `after`. Advice: none of the base game's 10,836 events.
 *
 * The keyword is part D4's event row with the roles `needs_sibling` and `at_most_once`.
 */

import type { AdviceCheck } from './advice.js';
import { writtenTwice } from './advice-twice.js';
import { eventModelOf, eventRows } from './advice-events.js';

export const CODE = 'structure/event-several-after';

export const check: AdviceCheck = {
    code: CODE,
    run: (input) =>
        writtenTwice(
            input,
            CODE,
            eventRows(eventModelOf(input.spec), 'needs_sibling', 'at_most_once'),
        ),
};
