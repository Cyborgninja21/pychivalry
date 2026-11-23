/**
 * `fields/wrong-kind-of-value` (docs/checks.md, item 4.5): a value of another kind than the
 * field takes, such as a word where a number goes or `maybe` where `yes` or `no` goes.
 * Information, and advice: no catalogue message for a script value of the wrong kind was
 * found (the "Expected number" family belongs to the executable's JSON reader).
 *
 * What a field takes is part B1 of the spec package: the field's `value_type`, the value groups
 * the base game's values fall in (`value_type_evidence` counts them). It is a measurement, not
 * a game rule, and PLAN.md item 4.5 asked whether it is clean enough to raise anything. It was
 * measured on game 1.21.0.3: each value-type rule below was run on every value the base game
 * writes in a field of that type, and the check judges only the types whose rule fired on none
 * of them and on no correct value of the five test mods (the numbers are in the pull request
 * of item 4.5). A field is judged only when its `value_type` is exactly one of these groups:
 *
 * - `boolean`: `yes` or `no`, bare or quoted, or a named script value (the script values
 *   `.info`: script values are used "in some cases" for true or false);
 * - `integer`: a whole number, bare or quoted, or a script value: a named one, a scope chain
 *   or a saved value (`scope:x`, `root.age`), or a formula block (script values "can be
 *   referenced virtually anywhere in script that takes a number");
 * - `decimal` and `number`: any number, bare or quoted, or a script value as above;
 * - `date`: a date, bare or quoted;
 * - `list`: a block of values with no `key = value` in it, or an empty block;
 * - `path`: anything written as one word or as quoted text.
 *
 * `block` and `word` fired on none of the base game's values but on correct values of the test
 * mods (`set_relation_rival = character:x` in a history entry, measured a block because the
 * base game writes only the block form; a dynasty's number id where the base game writes
 * names): they are not judged. Nor is a field of any other or of several groups, a field whose
 * kind the spec work marks `kind suspect:`, or a value that is an `@constant`, a `$PARAM$` or
 * `@[ ]` arithmetic. A modifier in a block that holds modifiers (a part D7 row at any status)
 * is the modifier's value, not a field's, and is not judged.
 *
 * Only a record's own fields and the sub-fields the walk of `check/records.ts` reaches are
 * judged. The finding's data says what the field takes: its value type and the values the base
 * game writes in it (`check/field-values.ts`).
 */

import type { FolderTable } from '../index/folders.js';
import type { ModifierBlockAreaRow } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import type { FileNode, Value } from '../syntax/tree.js';
import { modifierAreaRow, type DefinedNames, type FileReading } from './context.js';
import { fieldValueData } from './field-values.js';
import type { CheckFinding } from './finding.js';
import { isSuspect, recordsOf, valueGroupsOf, walkFields } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'fields/wrong-kind-of-value';

/** What the check reads beside the file's reading. */
export interface WrongKindInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
    readonly names: DefinedNames;
}

/** What a value is written as, for the rules: the kinds a rule accepts. */
export type ValueKind =
    | 'yes-or-no'
    | 'whole-number'
    | 'decimal-number'
    | 'date'
    | 'quoted-yes-or-no'
    | 'quoted-whole-number'
    | 'quoted-decimal-number'
    | 'quoted-date'
    | 'quoted-text'
    | 'word'
    | 'link'
    | 'dotted-word'
    | 'scope-chain'
    | 'script-value'
    | 'block'
    | 'empty-block'
    | 'list';

/** The rules: per value group of part B1, the kinds of value it accepts. */
const SCRIPT_VALUE: readonly ValueKind[] = ['script-value', 'scope-chain', 'block'];
const NUMBERS: readonly ValueKind[] = [
    'whole-number',
    'decimal-number',
    'quoted-whole-number',
    'quoted-decimal-number',
];
export const VALUE_TYPE_RULES: Readonly<Record<string, readonly ValueKind[]>> = {
    boolean: ['yes-or-no', 'quoted-yes-or-no', 'script-value'],
    integer: ['whole-number', 'quoted-whole-number', ...SCRIPT_VALUE],
    decimal: [...NUMBERS, ...SCRIPT_VALUE],
    number: [...NUMBERS, ...SCRIPT_VALUE],
    date: ['date', 'quoted-date'],
    list: ['list', 'empty-block'],
    path: [
        'quoted-yes-or-no',
        'quoted-whole-number',
        'quoted-decimal-number',
        'quoted-date',
        'quoted-text',
        'word',
        'link',
        'dotted-word',
        'scope-chain',
        'script-value',
    ],
};

/** The words for a value group and a kind of value, in messages. */
const GROUP_WORDS: Readonly<Record<string, string>> = {
    boolean: 'yes or no',
    integer: 'whole numbers',
    decimal: 'numbers',
    number: 'numbers',
    date: 'dates',
    list: 'lists of values',
    path: 'file paths',
};
const KIND_WORDS: Readonly<Record<ValueKind, string>> = {
    'yes-or-no': 'yes or no',
    'whole-number': 'a whole number',
    'decimal-number': 'a decimal number',
    date: 'a date',
    'quoted-yes-or-no': 'quoted yes or no',
    'quoted-whole-number': 'a quoted whole number',
    'quoted-decimal-number': 'a quoted decimal number',
    'quoted-date': 'a quoted date',
    'quoted-text': 'quoted text',
    word: 'a word',
    link: 'a link',
    'dotted-word': 'a word',
    'scope-chain': 'a scope',
    'script-value': 'a script value',
    block: 'a block',
    'empty-block': 'an empty block',
    list: 'a list of values',
};

/** What a value is written as, or null when it is never judged (see the head of this file). */
export function valueKindOf(
    spec: Spec,
    names: DefinedNames,
    value: Value | null,
): ValueKind | null {
    if (value === null) {
        return null;
    }
    if (value.kind === 'block') {
        const items = value.items.filter((item) => item.kind !== 'comment');
        if (items.length === 0) {
            return 'empty-block';
        }
        return items.some((item) => item.kind === 'pair') ? 'block' : 'list';
    }
    if (value.kind !== 'scalar') {
        return null;
    }
    const text = value.text;
    if (text.includes('$')) {
        return null;
    }
    switch (value.type) {
        case 'constant':
        case 'parameter':
        case 'arithmetic':
            return null;
        case 'number':
            return /^[-+]?[0-9]+$/.test(text) ? 'whole-number' : 'decimal-number';
        case 'date':
            return 'date';
        case 'string': {
            const inner = value.value;
            if (/^(?:yes|no)$/.test(inner)) {
                return 'quoted-yes-or-no';
            }
            if (/^[-+]?[0-9]+$/.test(inner)) {
                return 'quoted-whole-number';
            }
            if (/^[-+]?[0-9]*\.[0-9]+$/.test(inner)) {
                return 'quoted-decimal-number';
            }
            if (/^-?[0-9]+\.[0-9]+\.[0-9]+$/.test(inner)) {
                return 'quoted-date';
            }
            return 'quoted-text';
        }
        case 'chain': {
            const head = value.segments?.[0] ?? '';
            const vocabulary = vocabularyOf(spec);
            if (
                head.includes(':') ||
                vocabulary.has('links', head) ||
                vocabulary.has('links', head.toLowerCase())
            ) {
                return 'scope-chain';
            }
            return 'dotted-word';
        }
        case 'name': {
            if (/^(?:yes|no)$/.test(text)) {
                return 'yes-or-no';
            }
            const vocabulary = vocabularyOf(spec);
            if (vocabulary.has('links', text) || vocabulary.has('links', text.toLowerCase())) {
                return 'link';
            }
            if (valueGroupsOf(spec).folders.some((dir) => names.isDefined(text, dir))) {
                return 'script-value';
            }
            return 'word';
        }
    }
}

const areaRows = new WeakMap<Spec, ReadonlyMap<string, readonly ModifierBlockAreaRow[]>>();

function areaRowsOf(spec: Spec, folder: string): readonly ModifierBlockAreaRow[] {
    let rows = areaRows.get(spec);
    if (rows === undefined) {
        const byFolder = new Map<string, ModifierBlockAreaRow[]>();
        for (const row of spec.part('modifier_block_areas')?.fields ?? []) {
            byFolder.set(row.directory, [...(byFolder.get(row.directory) ?? []), row]);
        }
        rows = byFolder;
        areaRows.set(spec, rows);
    }
    return rows.get(folder) ?? [];
}

export function wrongKindsOfValue(
    reading: FileReading,
    context: CheckContext,
    input: WrongKindInput,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    const folder = records.folder;
    if (folder === null || records.schema === undefined) {
        return out;
    }
    const vocabulary = vocabularyOf(input.spec);
    for (const record of records.records) {
        walkFields(input.spec, records, record, reading, (site) => {
            const field = site.field;
            const type = field?.value_type;
            const rule = type === undefined ? undefined : VALUE_TYPE_RULES[type];
            if (
                field === undefined ||
                type === undefined ||
                rule === undefined ||
                isSuspect(field) ||
                (site.kind !== 'none' && site.kind !== 'script-value')
            ) {
                return;
            }
            const key = site.pair.key.text;
            if (
                modifierAreaRow(areaRowsOf(input.spec, folder.path), site.path.slice(0, -1)) !==
                    null &&
                (vocabulary.has('modifiers', key) ||
                    vocabulary.modifierTemplateMatch(key).kind !== 'none')
            ) {
                return;
            }
            const value = site.pair.value;
            const kind = valueKindOf(input.spec, input.names, value);
            if (kind === null || value === null || rule.includes(kind)) {
                return;
            }
            const written = value.kind === 'scalar' ? value.text : '{ ... }';
            out.push(
                finding(
                    CODE,
                    value,
                    [written, KIND_WORDS[kind], GROUP_WORDS[type] ?? type],
                    {
                        value: written,
                        kind,
                        field: site.path.join('.'),
                        folder: folder.path,
                        ...fieldValueData(field),
                    },
                    context,
                ),
            );
        });
    }
    return out;
}
