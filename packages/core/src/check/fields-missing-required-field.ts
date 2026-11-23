/**
 * `fields/missing-required-field` (docs/checks.md, item 4.5): a field the spec package marks
 * required is missing. An error whose evidence is the field's own: the package's `required`
 * flag with the game's message for the field (`required_evidence`), and the catalogue entry
 * that holds that text. In the 1.21.0.3 package three fields are marked, each with its
 * message: a casus belli's `on_invalidated_desc`, an interaction category's `index`, a
 * tutorial lesson's `chain`; the check holds none of them, it reads every field the schema
 * marks.
 *
 * Only the package's own `required` counts. A field a Paradox `.info` file calls required is
 * not a required schema field (docs/decisions.md, row 52), nor is one the base game always
 * sets: neither is read here.
 *
 * The records are `check/records.ts`'s. A required field of a record's body must be written
 * in the body; a required sub-field, in every block of its field that the record writes (as
 * the walk of `walkFields` reaches it). The finding is at the record's key, or at the key of
 * the field whose block lacks the sub-field, and its message is the game's, filled with the
 * record's key. Its data says what the field takes: its measured value type and the values the
 * base game writes in it (`check/field-values.ts`).
 */

import type { FolderTable } from '../index/folders.js';
import type { SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import type { Evidence } from '../syntax/findings.js';
import type { Block, FileNode, Pair } from '../syntax/tree.js';
import type { FileReading } from './context.js';
import { fieldValueData } from './field-values.js';
import type { CheckFinding } from './finding.js';
import { recordsOf, walkFields, type RecordSite } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'fields/missing-required-field';

/** What the check reads beside the file's reading. */
export interface RequiredFieldInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
}

/** A field the schema marks required, with the path from the record's body to it. */
export interface RequiredField {
    readonly directory: string;
    readonly path: readonly string[];
    readonly field: SchemaField;
}

const marked = new WeakMap<Spec, readonly RequiredField[]>();

/** Every field and sub-field the package's schema marks required, in every folder. */
export function requiredFields(spec: Spec): readonly RequiredField[] {
    let out = marked.get(spec);
    if (out === undefined) {
        const found: RequiredField[] = [];
        const walk = (
            directory: string,
            fields: Readonly<Record<string, SchemaField>>,
            above: readonly string[],
        ): void => {
            for (const [name, field] of Object.entries(fields)) {
                const path = [...above, name];
                if (field.required) {
                    found.push({ directory, path, field });
                }
                if (field.fields !== undefined) {
                    walk(directory, field.fields, path);
                }
            }
        };
        for (const [directory, schema] of Object.entries(spec.data.schema)) {
            walk(directory, schema.fields, []);
        }
        out = found;
        marked.set(spec, out);
    }
    return out;
}

/** The evidence of a required field: its message, and the catalogue entry with that text. */
function evidenceOf(spec: Spec, required: RequiredField): Evidence {
    const text = required.field.required_evidence ?? '';
    const entry = text === '' ? undefined : spec.data.errors.find((e) => e.text === text);
    return {
        kind: 'required-field',
        directory: required.directory,
        field: required.path.join('.'),
        id: entry?.id ?? null,
        text,
    };
}

/** True when a block writes the key, as a pair or by its placeholder kind. */
function writes(block: Block, name: string): boolean {
    return block.items.some((item) => item.kind === 'pair' && item.key.text === name);
}

export function missingRequiredFields(
    reading: FileReading,
    context: CheckContext,
    input: RequiredFieldInput,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    const directory = records.folder?.path;
    const wanted = requiredFields(input.spec).filter((r) => r.directory === directory);
    if (wanted.length === 0) {
        return out;
    }
    const report = (record: RecordSite, at: Pair, required: RequiredField): void => {
        const key = record.pair.key.text;
        out.push(
            finding(
                CODE,
                at.key,
                [key],
                {
                    record: key,
                    field: required.path.join('.'),
                    ...fieldValueData(required.field),
                },
                context,
                evidenceOf(input.spec, required),
            ),
        );
    };
    for (const record of records.records) {
        for (const required of wanted.filter((r) => r.path.length === 1)) {
            if (!writes(record.body, required.path[0] ?? '')) {
                report(record, record.pair, required);
            }
        }
        const deeper = wanted.filter((r) => r.path.length > 1);
        if (deeper.length === 0) {
            continue;
        }
        walkFields(input.spec, records, record, reading, (site) => {
            const block = site.pair.value?.kind === 'block' ? site.pair.value : undefined;
            if (block === undefined) {
                return;
            }
            for (const required of deeper) {
                const parent = required.path.slice(0, -1);
                if (
                    parent.length === site.path.length &&
                    parent.every((name, i) => name === site.path[i] || name.startsWith('<')) &&
                    !writes(block, required.path[required.path.length - 1] ?? '')
                ) {
                    report(record, site.pair, required);
                }
            }
        });
    }
    return out;
}
