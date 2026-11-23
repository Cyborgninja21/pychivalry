/**
 * Events, as the advice checks read them from part D4: which folder holds events, which of
 * its top-level records are events, and the event's own keywords by their role.
 *
 * - The folders are those of the row whose role is `id_prefix` (the namespace: "names the first
 *   part of the ids of the records of its file, `<prefix>.<number>`").
 * - An event is a record of such a folder whose key holds a `.`: an id `<prefix>.<number>`, the
 *   records part D4 measures as events (`records: dotted`).
 * - An event's keyword is the word of the row of those folders, with no parent key, that has
 *   the role asked for: `fire_condition` is the event's trigger, `event_option` its option.
 * - An event is hidden when its `hides_from_player` keyword holds the value the row's
 *   measurement counts hidden events by (`hidden=yes`).
 */

import type { Spec } from '../spec/reader.js';
import type { Block, Pair } from '../syntax/tree.js';
import { directoryOf, recordsOf, type AdviceInput } from './advice.js';
import { childPairs, keywordRolesOf, type KeywordRoles, type RoleRow } from './keyword-roles.js';

/** What part D4 says about events. */
export interface EventModel {
    readonly roles: KeywordRoles;
    /** The folders that hold events. */
    readonly directories: readonly string[];
    /** The rows of an event's own keywords (no parent key), the namespace's excepted. */
    readonly rows: readonly RoleRow[];
}

/** The role of the namespace row: the first part of the ids of the records of its file. */
const ID_PREFIX = 'id_prefix';

const models = new WeakMap<Spec, EventModel>();

/** Part D4's events, read once per package. */
export function eventModelOf(spec: Spec): EventModel {
    let model = models.get(spec);
    if (model === undefined) {
        const roles = keywordRolesOf(spec);
        const prefix = roles.withRoles(ID_PREFIX)[0];
        const directories =
            prefix === undefined || prefix.directories === 'anywhere' ? [] : prefix.directories;
        const rows = roles.rows.filter(
            (r) =>
                r.parents.length === 0 &&
                !r.roles.has(ID_PREFIX) &&
                r.directories !== 'anywhere' &&
                r.directories.length > 0 &&
                r.directories.every((d) => directories.includes(d)),
        );
        model = { roles, directories, rows };
        models.set(spec, model);
    }
    return model;
}

/** The event rows with every one of these roles. */
export function eventRows(model: EventModel, ...roles: readonly string[]): RoleRow[] {
    return model.rows.filter((r) => roles.every((role) => r.roles.has(role)));
}

/** The one event row with these roles, or undefined when there is none or more than one. */
export function eventRow(model: EventModel, ...roles: readonly string[]): RoleRow | undefined {
    const rows = eventRows(model, ...roles);
    return rows.length === 1 ? rows[0] : undefined;
}

/**
 * The event's description: the event row with the role `required` whose block form is a
 * dynamic description (`opens: dynamic_description`, part D4's vocabulary), which the title,
 * the other row whose block form is one, is not required.
 */
export function descriptionRow(model: EventModel): RoleRow | undefined {
    const rows = eventRows(model, 'required').filter(
        (r) => r.row['opens'] === 'dynamic_description',
    );
    return rows.length === 1 ? rows[0] : undefined;
}

/** The events of a file: none unless it is in a folder that holds events. */
export function eventsOf(
    input: AdviceInput,
    model: EventModel,
): { readonly pair: Pair; readonly body: Block }[] {
    const dir = directoryOf(input);
    if (dir === null || !model.directories.includes(dir)) {
        return [];
    }
    return recordsOf(input.tree).filter((r) => r.pair.key.text.includes('.'));
}

/**
 * Whether an event is hidden: true or false, or undefined when part D4 does not say which
 * keyword hides an event or what value it takes.
 */
export function isHidden(model: EventModel, body: Block): boolean | undefined {
    const row = eventRow(model, 'hides_from_player');
    const value = row === undefined ? undefined : model.roles.setValue(row);
    if (row === undefined || value === undefined) {
        return undefined;
    }
    return childPairs(body, row.keyword).some(
        (p) => p.value?.kind === 'scalar' && p.value.text === value,
    );
}
