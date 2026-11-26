/**
 * The empty options of an event, for `style/empty-block` (the owner's decision of 2026-11-26,
 * docs/decisions.md row 176): still reported as a hint, but never offered for removal, since
 * taking one away takes a choice away from the player or the AI, and the message says so.
 * Everything is read from part D4 of the spec package; no keyword is written here.
 *
 * An event's option is a key of an event's own body, the events as `advice-events.ts` reads them
 * (a record whose key holds a `.`, in a folder of part D4's namespace row), that is the word of
 * the one event row with the role `event_option`, "a choice of an event that the player or the AI
 * picks; its body holds the effects of the choice and the option's own fields", where that row
 * holds in the file's folder. The part confirms the role, on the game's own event documentation
 * (`An option the player/AI can pick`, its rank 3 evidence). The same row has the role `required`
 * for a shown event, so taking a shown event's only option away also leaves it with none, which
 * `structure/event-without-option` reports. Every event is read, shown or hidden: the role holds
 * of both, and only `required`'s condition names the shown ones. The key is matched as the file
 * writes it, as `style/option-without-ai-weight` reads an event's options. The context reader
 * reads an event's own body as record fields and judges none of its keys, so no other kind of
 * `style/empty-block` covers an option; it is read first.
 */

import type { Block, Pair } from '../syntax/tree.js';
import { directoryOf, type AdviceInput } from './advice.js';
import { eventModelOf, eventRow, eventsOf } from './advice-events.js';
import { holdsIn } from './keyword-roles.js';

/** Part D4's role of an event's option: a choice of the event that the player or the AI picks. */
const EVENT_OPTION = 'event_option';

/** Whether a pair is an option of an event, given the block it is written in. */
export type EventOptionTest = (pair: Pair, parent: Block) => boolean;

/** The options of the events of a file, by part D4 (see the head of this file). */
export function eventOptionsOf(input: AdviceInput): EventOptionTest {
    const model = eventModelOf(input.spec);
    const row = eventRow(model, EVENT_OPTION);
    if (row === undefined || !holdsIn(row, directoryOf(input))) {
        return () => false;
    }
    const bodies = new Set<Block>(eventsOf(input, model).map((event) => event.body));
    return (pair, parent) => bodies.has(parent) && pair.key.text === row.keyword;
}
