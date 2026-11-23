/**
 * `scope/saved-late-read-in-desc` (docs/checks.md, item 4.7, carried over provisionally): a
 * scope read in an event's `desc` that the event saves only in an option or in `after`.
 * Advice: re-proved on the 1.21.0.3 base game, where it fires on none of the events it judges.
 *
 * The keywords are part D4's event rows: the description (`descriptionRow`), the fire
 * condition (`fire_condition`), the block run when the event fires (`runs_before_options`),
 * the options (`event_option`) and the block that needs them (`needs_sibling`). A scope is
 * saved late when the options or that block save it and neither the fire condition nor the
 * block run when it fires does. Reads inside the trigger of a `triggered_desc` (the row with
 * the roles `closed_body` and `conditional_entry`, and its `entry_condition`) are another
 * row's, retired; they are not judged here. Saves and reads are the index's own reading, as
 * `scope/undefined-event-target` reads them (`advice-scopes.ts`).
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING, walkPairs } from './advice.js';
import { bodyOf, childPairs, keywordRolesOf } from './keyword-roles.js';
import { descriptionRow, eventModelOf, eventRow, eventsOf } from './advice-events.js';
import { savedIn, savedScopeLinks, scopeReadsIn } from './advice-scopes.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { Block, Scalar } from '../syntax/tree.js';

export const CODE = 'scope/saved-late-read-in-desc';

function run(input: AdviceInput): AdviceResult {
    const model = eventModelOf(input.spec);
    const links = savedScopeLinks(input.folders);
    const desc = descriptionRow(model);
    const early = [eventRow(model, 'fire_condition'), eventRow(model, 'runs_before_options')];
    const late = [eventRow(model, 'event_option'), eventRow(model, 'needs_sibling')];
    const entries = keywordRolesOf(input.spec)
        .withRoles('closed_body', 'conditional_entry')
        .filter((r) => r.directories === 'anywhere');
    const entry = entries.length === 1 ? entries[0] : undefined;
    const conditions = keywordRolesOf(input.spec)
        .withRoles('entry_condition')
        .filter(
            (r) => entry !== undefined && r.parents.length === 1 && r.parents[0] === entry.keyword,
        );
    const condition = conditions.length === 1 ? conditions[0] : undefined;
    if (
        links.size === 0 ||
        desc === undefined ||
        entry === undefined ||
        condition === undefined ||
        early.some((r) => r === undefined) ||
        late.some((r) => r === undefined)
    ) {
        return NOTHING;
    }
    const earlyKeys = early.flatMap((r) => (r === undefined ? [] : [r.keyword]));
    const lateKeys = late.flatMap((r) => (r === undefined ? [] : [r.keyword]));
    const blocksOf = (body: Block, keys: readonly string[]): Block[] =>
        keys.flatMap((k) => childPairs(body, k).flatMap((p) => bodyOf(p) ?? []));
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        const descs = childPairs(event.body, desc.keyword);
        if (descs.length === 0) {
            continue;
        }
        const saved = savedIn(input.folders, blocksOf(event.body, earlyKeys));
        const onlyLate = [...savedIn(input.folders, blocksOf(event.body, lateKeys))].filter(
            (n) => !saved.has(n),
        );
        if (onlyLate.length === 0) {
            continue;
        }
        judged++;
        for (const pair of descs) {
            const excluded = new Set<Scalar>();
            const body = bodyOf(pair);
            if (body !== undefined) {
                walkPairs(body, (p) => {
                    if (p.key.text !== entry.keyword) {
                        return;
                    }
                    const entryBody = bodyOf(p);
                    for (const c of entryBody === undefined
                        ? []
                        : childPairs(entryBody, condition.keyword)) {
                        scopeReadsIn(c, links).forEach((r) => excluded.add(r.scalar));
                    }
                });
            }
            for (const read of scopeReadsIn(pair, links)) {
                if (!excluded.has(read.scalar) && onlyLate.includes(read.name)) {
                    findings.push(
                        finding(
                            CODE,
                            read.scalar,
                            [read.scalar.text, desc.keyword, either(lateKeys)],
                            { scope: read.name, block: desc.keyword, saved_in: lateKeys },
                            input.context,
                        ),
                    );
                }
            }
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
