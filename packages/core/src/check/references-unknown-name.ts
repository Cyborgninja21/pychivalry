/**
 * `references/unknown-name` (docs/checks.md, item 4.7): a value naming a definition the index
 * does not hold, where no game message is known. Built for a portrait animation; the other half
 * of the row, a game concept named in localization text (`[concept|E]`), is not built: the
 * package carries that form only in the prose of an `.info` file (docs/checks.md, the report of
 * item 4.7).
 *
 * The keys are part D4's: the animation keys (the rows with the role `one_of_required` inside a
 * `triggered_animation`, `animation` and `scripted_animation`), written in an event's portrait
 * position (the rows with the role `portrait_slot`) or in a `triggered_animation` of one. The
 * database each names is the one part D6 gives for that key in a portrait position
 * (`events::left_portrait.animation`), when every such row gives the same one. A value that is
 * not a plain name is not judged.
 *
 * A reference check: a base-game value it reports names something the base game does not
 * define either, and is listed, not taken to disprove the rule (docs/checks.md, "The verdict
 * rule").
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { bodyOf, childPairs } from './advice-roles.js';
import { triggeredAnimations } from './advice-animations.js';
import { eventModelOf, eventRows, eventsOf, type EventModel } from './advice-events.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { Spec } from '../spec/reader.js';
import type { Block, Pair } from '../syntax/tree.js';

export const CODE = 'references/unknown-name';

/** The database each animation key names, from part D6's rows for the portrait positions. */
function databasesOf(
    spec: Spec,
    model: EventModel,
    slots: readonly string[],
    keys: readonly string[],
): Map<string, string> {
    const rows = spec.part('field_references')?.fields ?? [];
    const out = new Map<string, string>();
    for (const key of keys) {
        const named = new Set<string>();
        for (const row of rows) {
            if (
                row.kind === 'field' &&
                row.directory !== undefined &&
                model.directories.includes(row.directory) &&
                slots.some((slot) => row.path === `${slot}.${key}`)
            ) {
                row.refers_to.forEach((db) => named.add(db));
            }
        }
        const db = [...named][0];
        if (named.size === 1 && db !== undefined) {
            out.set(key, db);
        }
    }
    return out;
}

function run(input: AdviceInput): AdviceResult {
    const model = eventModelOf(input.spec);
    const animations = triggeredAnimations(input);
    if (animations === undefined) {
        return NOTHING;
    }
    const keys = new Set<string>();
    for (const row of model.roles.withRoles('one_of_required')) {
        if (row.parents.length === 1 && row.parents[0] === animations.row.keyword) {
            keys.add(row.keyword);
            row.pairsWith.forEach((k) => keys.add(k));
        }
    }
    const slots = eventRows(model, 'portrait_slot').map((r) => r.keyword);
    const databases = databasesOf(input.spec, model, slots, [...keys]);
    if (databases.size === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    const judge = (block: Block): void => {
        for (const [key, db] of databases) {
            for (const pair of childPairs(block, key)) {
                if (!plainName(pair) || pair.value?.kind !== 'scalar') {
                    continue;
                }
                judged++;
                const name = pair.value.text;
                if (!input.names.isDefined(name, db)) {
                    findings.push(
                        finding(
                            CODE,
                            pair.value,
                            [name, db],
                            { name, database: db },
                            input.context,
                        ),
                    );
                }
            }
        }
    };
    for (const event of eventsOf(input, model)) {
        for (const slot of slots) {
            for (const pair of childPairs(event.body, slot)) {
                const body = bodyOf(pair);
                if (body !== undefined) {
                    judge(body);
                }
            }
        }
    }
    for (const block of animations.blocks) {
        judge(block.body);
    }
    return { judged, findings };
}

function plainName(pair: Pair): boolean {
    return (
        pair.value?.kind === 'scalar' &&
        pair.value.type === 'name' &&
        !pair.value.text.includes('$')
    );
}

export const check: AdviceCheck = { code: CODE, run };
