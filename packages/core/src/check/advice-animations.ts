/**
 * The triggered animations of an event's portraits, as part D4 names them: the row with the
 * role `conditional_entry` whose parents are portrait positions (and the sender), and its
 * blocks written directly in one of those parents in an event.
 */

import type { Block, Pair } from '../syntax/tree.js';
import type { AdviceInput } from './advice.js';
import { bodyOf, childPairs, type RoleRow } from './keyword-roles.js';
import { eventModelOf, eventRows, eventsOf } from './advice-events.js';

export interface TriggeredAnimations {
    readonly row: RoleRow;
    readonly blocks: readonly { readonly pair: Pair; readonly body: Block }[];
}

/** The triggered animations of the file's events, or undefined when part D4 names none. */
export function triggeredAnimations(input: AdviceInput): TriggeredAnimations | undefined {
    const model = eventModelOf(input.spec);
    const slots = new Set(eventRows(model, 'portrait_slot').map((r) => r.keyword));
    const rows = model.roles
        .withRoles('conditional_entry', 'picks_first_valid')
        .filter((r) => r.parents.length > 0 && r.parents.some((p) => slots.has(p)));
    const row = rows.length === 1 ? rows[0] : undefined;
    if (row === undefined) {
        return undefined;
    }
    const blocks: { pair: Pair; body: Block }[] = [];
    for (const event of eventsOf(input, model)) {
        for (const parent of row.parents) {
            for (const holder of childPairs(event.body, parent)) {
                const holderBody = bodyOf(holder);
                if (holderBody === undefined) {
                    continue;
                }
                for (const pair of childPairs(holderBody, row.keyword)) {
                    const body = bodyOf(pair);
                    if (body !== undefined) {
                        blocks.push({ pair, body });
                    }
                }
            }
        }
    }
    return { row, blocks };
}
