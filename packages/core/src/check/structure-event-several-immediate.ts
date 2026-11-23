/**
 * `structure/event-several-immediate` (docs/checks.md, item 4.7): an event with more than one
 * `immediate`. Advice: none of the base game's 10,836 events.
 *
 * The keyword is part D4's event row with the roles `runs_before_options` and `at_most_once`.
 */

import type { AdviceCheck } from './advice.js';
import { writtenTwice } from './advice-twice.js';
import { eventModelOf, eventRows } from './advice-events.js';

export const CODE = 'structure/event-several-immediate';

export const check: AdviceCheck = {
    code: CODE,
    run: (input) =>
        writtenTwice(
            input,
            CODE,
            eventRows(eventModelOf(input.spec), 'runs_before_options', 'at_most_once'),
        ),
};
