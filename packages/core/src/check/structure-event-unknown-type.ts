/**
 * `structure/event-unknown-type` (docs/checks.md, item 4.7): an event `type` that
 * `events/_events.info` does not list. Advice: none of the base game's events.
 *
 * The keyword is part D4's event row with the role `selects_kind`; its `see` names the table
 * whose entries are the types (`tables.<table>.entries.<type>`). The table is read by the trust
 * rule of `spec/tables.ts`: a confirmed entry (the `.info` lists it) is a type; an entry with
 * no evidence, or one the game's output contradicts, may make a value not a finding and never
 * makes one, so a value naming it is not reported either.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING } from './advice.js';
import { childPairs } from './advice-roles.js';
import { eventModelOf, eventRow, eventsOf } from './advice-events.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { Spec } from '../spec/reader.js';

export const CODE = 'structure/event-unknown-type';

/** The types the table names: the documented ones, and every name it holds at all. */
interface Types {
    readonly documented: readonly string[];
    readonly known: ReadonlySet<string>;
}

const SEE = /^tables\.([^.]+)\.entries\.[^.]+$/;

function typesOf(spec: Spec, see: readonly string[]): Types | undefined {
    const tables = new Set(see.map((s) => SEE.exec(s)?.[1]));
    const name = [...tables][0];
    if (tables.size !== 1 || name === undefined) {
        return undefined;
    }
    const table = spec.data.tables.data[name];
    if (table === undefined) {
        return undefined;
    }
    const entries = Object.entries(table.entries);
    return {
        documented: entries.filter(([, e]) => e.evidence_status === 'confirmed').map(([n]) => n),
        known: new Set(entries.map(([n]) => n)),
    };
}

function run(input: AdviceInput): AdviceResult {
    const model = eventModelOf(input.spec);
    const row = eventRow(model, 'selects_kind');
    const see = row?.row['see'];
    const types =
        row === undefined || !Array.isArray(see)
            ? undefined
            : typesOf(
                  input.spec,
                  see.filter((s): s is string => typeof s === 'string'),
              );
    if (row === undefined || types === undefined || types.documented.length === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        for (const pair of childPairs(event.body, row.keyword)) {
            const value = pair.value;
            if (value?.kind !== 'scalar' || value.type !== 'name' || value.text.includes('$')) {
                continue;
            }
            judged++;
            if (!types.known.has(value.text)) {
                findings.push(
                    finding(
                        CODE,
                        value,
                        [value.text, either(types.documented)],
                        { event: event.pair.key.text, type: value.text, types: types.documented },
                        input.context,
                    ),
                );
            }
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
