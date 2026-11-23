/**
 * `fields/usually-present` (docs/checks.md, item 4.7): a record without a field that every
 * base-game record of its kind sets. Advice, from the base game's own measurement (part A2,
 * `record_usage`); seventeen pre-2.0 required-field flags return through it.
 *
 * - A field whose `record_usage` equals the folder's `vanilla.records` is set by every record:
 *   a record without it is reported at its key.
 * - A sub-field whose `record_usage` equals its field's is set by every record that sets the
 *   field: a record whose blocks of that field never set it is reported at the field's first
 *   key (the measurement counts records, not blocks).
 * - A field the spec marks required is `fields/missing-required-field`'s, and not judged here.
 * - A rule rests on at least 10 base-game records (`MIN_RECORDS`).
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING } from './advice.js';
import { blocksOf, MIN_RECORDS, pairsByField, schemaRecords } from './advice-fields.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { SchemaField } from '../spec/package.js';

export const CODE = 'fields/usually-present';

function always(field: SchemaField, of: number): boolean {
    return of >= MIN_RECORDS && field.record_usage === of && !field.required;
}

function run(input: AdviceInput): AdviceResult {
    const found = schemaRecords(input);
    const total = found?.schema.vanilla?.records ?? 0;
    if (found === undefined || total < MIN_RECORDS) {
        return NOTHING;
    }
    const fields = Object.entries(found.schema.fields);
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const record of found.records) {
        const written = pairsByField(found.schema.fields, record.body);
        for (const [name, field] of fields) {
            if (always(field, total)) {
                judged++;
                if (!written.has(name)) {
                    findings.push(
                        finding(
                            CODE,
                            record.pair.key,
                            [record.pair.key.text, name, String(total)],
                            {
                                record: record.pair.key.text,
                                field: name,
                                base_game_records: String(total),
                            },
                            input.context,
                        ),
                    );
                }
            }
            const own = written.get(name);
            const sub = field.fields;
            const of = field.record_usage ?? 0;
            if (own === undefined || sub === undefined || of < MIN_RECORDS) {
                continue;
            }
            const blocks = blocksOf(own);
            if (blocks.length === 0) {
                continue;
            }
            const setInBlocks = blocks.map((b) => pairsByField(sub, b));
            for (const [subName, subField] of Object.entries(sub)) {
                if (!always(subField, of)) {
                    continue;
                }
                judged++;
                if (!setInBlocks.some((m) => m.has(subName))) {
                    const at = own[0] ?? record.pair;
                    findings.push(
                        finding(
                            CODE,
                            at.key,
                            [`${record.pair.key.text}.${name}`, subName, String(of)],
                            {
                                record: record.pair.key.text,
                                field: `${name}.${subName}`,
                                base_game_records: String(of),
                            },
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
