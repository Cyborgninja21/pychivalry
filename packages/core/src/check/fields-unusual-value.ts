/**
 * `fields/unusual-value` (docs/checks.md, item 4.7): a value no base-game record writes in a
 * field whose values form a small set. A hint, from the base game's own measurement (part B2,
 * `values`: every distinct value the base game writes, when there are at most 20 and the field
 * is not free text).
 *
 * A field's or sub-field's value is judged when the schema lists its values, the base game
 * sets it in at least 10 records (`MIN_RECORDS`), and every value it writes is a word or a
 * boolean (`value_type`, part B1: numbers, script values, scopes and paths are no closed
 * set). A value is judged only when it is written as a bare word, and compared as written. A
 * field whose values are keys of a database (a row of part D6, `field_references`, for it) or
 * localization keys (`loc_key`) is not judged: a mod adds keys of its own there, so the base
 * game's few values are no closed set either.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { directoryOf, either, NOTHING } from './advice.js';
import { blocksOf, MIN_RECORDS, pairsByField, schemaRecords } from './advice-fields.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import type { Pair } from '../syntax/tree.js';

export const CODE = 'fields/unusual-value';

/** The value groups of part B1 whose values can form a closed set. */
const CLOSED_GROUPS: ReadonlySet<string> = new Set(['boolean', 'word']);

function judgeable(pair: Pair): boolean {
    const v = pair.value;
    return v?.kind === 'scalar' && v.type === 'name' && !v.text.includes('$');
}

const references = new WeakMap<Spec, ReadonlySet<string>>();

/** The fields part D6 says name a database's keys, as `<folder>::<field>[.<sub-field>]`. */
function referenceFields(spec: Spec): ReadonlySet<string> {
    let found = references.get(spec);
    if (found === undefined) {
        const rows = spec.part('field_references')?.fields ?? [];
        found = new Set(
            rows
                .filter((r) => r.kind === 'field' && r.directory !== undefined)
                .map((r) => `${r.directory ?? ''}::${r.path}`),
        );
        references.set(spec, found);
    }
    return found;
}

function run(input: AdviceInput): AdviceResult {
    const found = schemaRecords(input);
    const dir = directoryOf(input);
    if (found === undefined || dir === null) {
        return NOTHING;
    }
    const open = referenceFields(input.spec);
    let judged = 0;
    const findings: CheckFinding[] = [];
    const judge = (pairs: readonly Pair[], path: string, field: SchemaField): void => {
        const values = field.values;
        if (
            values === undefined ||
            (field.record_usage ?? 0) < MIN_RECORDS ||
            field.loc_key === true ||
            !CLOSED_GROUPS.has(field.value_type ?? '') ||
            open.has(`${dir}::${path}`)
        ) {
            return;
        }
        for (const pair of pairs) {
            if (!judgeable(pair) || pair.value?.kind !== 'scalar') {
                continue;
            }
            judged++;
            const text = pair.value.text;
            if (!values.some((v) => v.value === text)) {
                const observed = values.map((v) => v.value);
                findings.push(
                    finding(
                        CODE,
                        pair.value,
                        [text, path, either(observed)],
                        { field: path, value: text, observed },
                        input.context,
                    ),
                );
            }
        }
    };
    for (const record of found.records) {
        const written = pairsByField(found.schema.fields, record.body);
        for (const [name, pairs] of written) {
            const field = found.schema.fields[name];
            if (field === undefined) {
                continue;
            }
            judge(pairs, name, field);
            const sub = field.fields;
            if (sub === undefined) {
                continue;
            }
            for (const block of blocksOf(pairs)) {
                for (const [subName, subPairs] of pairsByField(sub, block)) {
                    const subField = sub[subName];
                    if (subField !== undefined) {
                        judge(subPairs, `${name}.${subName}`, subField);
                    }
                }
            }
        }
    }
    return { judged, findings };
}

export const check: AdviceCheck = { code: CODE, run };
