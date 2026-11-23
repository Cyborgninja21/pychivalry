/**
 * `structure/event-without-option` (docs/checks.md, item 4.7): an event that is not hidden and
 * has no `option`. Advice: the base game's 9,562 shown events all have one.
 *
 * The keyword is part D4's event row with the roles `event_option` and `required`; the events
 * it judges are those its measured condition names (the events that are not hidden).
 */

import type { AdviceCheck } from './advice.js';
import { eventRow } from './advice-events.js';
import { requiredInShownEvents } from './structure-event-without-desc.js';

export const CODE = 'structure/event-without-option';

export const check: AdviceCheck = {
    code: CODE,
    run: (input) =>
        requiredInShownEvents(input, CODE, (model) => eventRow(model, 'required', 'event_option')),
};
