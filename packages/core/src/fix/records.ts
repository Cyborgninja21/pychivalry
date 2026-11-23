/**
 * The fixes of record findings that write or rewrite a field from the spec package's schema:
 *
 * - `fields/missing-required-field`: the field written as the block's first line with a
 *   placeholder of its measured kind, for a field whose value type is a number or a boolean
 *   (`index = 0` in an interaction category): a suggestion, its value the modder's to set. No
 *   fix for a field whose value is a key or text (`on_invalidated_desc`, `chain`): no
 *   placeholder of those is valid.
 * - `fields/bare-value-in-record`: a bare word that is a field of the record whose value type is
 *   boolean (`important_decision_group`) written as `= yes`: safe when the base game writes
 *   only `yes` in it, a suggestion of the values it writes otherwise. None for any other word.
 * - `structure/range-min-above-max`: the two bounds written the other way round. Safe: a range
 *   is its two bounds, which the game reads low first.
 * - `structure/event-non-character-shown`: each keyword the game's message names, one of which
 *   the event needs (part D4: `hidden`, `major`), written as `= yes` at the top of the event,
 *   where the schema measures it a boolean: a suggestion, as which one is a choice.
 */

import type { Block } from '../syntax/tree.js';
import { blockOf } from '../syntax/tree.js';
import { dataList, dataText, type FixableFinding, type FixFile } from './file.js';
import { safeFix, suggestion, type FindingFix, type FixEdit } from './fix.js';

/** The placeholder a field of a value type is written with, or null when none is valid. */
function placeholderOf(valueType: string | null): string | null {
    switch (valueType) {
        case 'integer':
        case 'decimal':
        case 'number':
            return '0';
        case 'boolean':
            return 'yes';
        default:
            return null;
    }
}

/** An edit that writes `line` as the first line of a block (on the `{`'s line if it holds more). */
export function firstLine(file: FixFile, block: Block, line: string): FixEdit {
    const open = block.start + 1;
    const first = block.items[0];
    const sameLine =
        first !== undefined
            ? file.lines.positionAt(first.start).line === file.lines.positionAt(block.start).line
            : file.lines.positionAt(block.end).line === file.lines.positionAt(block.start).line;
    if (sameLine) {
        return file.insert(open, ` ${line}`);
    }
    const indent = file.indentAt(block.start);
    const inner = first === undefined ? `${indent}\t` : file.indentAt(first.start) || `${indent}\t`;
    return file.insert(open, `${file.newline}${inner}${line}`);
}

export function missingRequiredFieldFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const field = dataText(finding.data, 'field');
    const value = placeholderOf(dataText(finding.data, 'value_type'));
    const pair = file.pairAt(finding.start);
    const block = pair === undefined ? undefined : blockOf(pair.value);
    if (field === null || value === null || block === undefined) {
        return null;
    }
    const name = field.split('.').at(-1) ?? field;
    const values = dataList(finding.data, 'values');
    const seen =
        values.length === 0
            ? ''
            : ` (the base game writes ${values.slice(0, 5).join(', ')}${values.length > 5 ? ', ...' : ''})`;
    return suggestion('required-field', [
        {
            title: `Add the required ${name} = ${value}, a placeholder to set${seen}`,
            edits: [firstLine(file, block, `${name} = ${value}`)],
        },
    ]);
}

export function bareValueFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const value = dataText(finding.data, 'value');
    const folder = file.input.folders.classify(file.file)?.folder.path;
    if (value === null || folder === undefined || file.tree === null) {
        return null;
    }
    const field = file.spec.data.schema[folder]?.fields[value];
    if (field?.value_type !== 'boolean') {
        return null;
    }
    // The bare word: the last scalar with its text before the token the game reports.
    let bare: { start: number; end: number } | undefined;
    const visit = (items: Block['items']): void => {
        for (const item of items) {
            if (item.end > finding.start) {
                const inner = item.kind === 'pair' ? blockOf(item.value) : undefined;
                if (inner !== undefined && item.start < finding.start) {
                    visit(inner.items);
                }
                continue;
            }
            if (item.kind === 'scalar' && item.text === value) {
                bare = item;
            }
        }
    };
    visit(file.tree.items);
    if (bare === undefined) {
        return null;
    }
    const at = bare.end;
    const written = (field.values ?? []).map((v) => v.value);
    const alternatives = (written.length === 0 ? ['yes'] : written).map((v) => ({
        title: `Write ${value} = ${v}`,
        edits: [file.insert(at, ` = ${v}`)],
    }));
    const only = alternatives[0];
    if (written.length === 1 && written[0] === 'yes' && only !== undefined) {
        return safeFix('observed-values', only);
    }
    return suggestion('observed-values', alternatives);
}

export function rangeSwapFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const block = file.blockAt(finding.start);
    const items = block?.items.filter((i) => i.kind !== 'comment') ?? [];
    const [low, high] = items;
    if (items.length !== 2 || low?.kind !== 'scalar' || high?.kind !== 'scalar') {
        return null;
    }
    return safeFix('range', {
        title: `Write the range low first: { ${high.text} ${low.text} }`,
        edits: [
            file.replace(low.start, low.end, high.text),
            file.replace(high.start, high.end, low.text),
        ],
    });
}

export function eventShownFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const pair = file.pairAt(finding.start);
    const block = pair === undefined ? undefined : blockOf(pair.value);
    const folder = file.input.folders.classify(file.file)?.folder.path;
    if (block === undefined || folder === undefined) {
        return null;
    }
    const fields = file.spec.data.schema[folder]?.fields ?? {};
    const alternatives = dataList(finding.data, 'needs')
        .filter((need) => fields[need]?.value_type === 'boolean')
        .map((need) => ({
            title: `Make the event ${need}: ${need} = yes`,
            edits: [firstLine(file, block, `${need} = yes`)],
        }));
    return suggestion('game-message', alternatives);
}
