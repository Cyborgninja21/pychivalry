/**
 * `structure/range-min-above-max` (docs/checks.md, item 4.5): a range whose minimum is above
 * its maximum. An error on the catalogue's
 * `min_value_in_range_directive_is_larger_than_the_max_value_un` ("min value in range directive
 * is larger than the max value. Unknown location; yell at a programmer"), which the executable
 * keeps beside its script-value reader (`jomini_scriptvalue.cpp`).
 *
 * Written by hand against that message. A range is what Paradox's script values `.info`
 * documents: a script value written as two values in a block, `add_gold = { 1 5 }` ("Script
 * values can also define ranges"). Where a script value is written comes from the package:
 *
 * - the value of an operation of a formula: a key of the table `value_block_keys` in a block
 *   the context reader reads as a script value (`value = { 1 5 }`);
 * - a record of a folder whose records the context reader reads as script values (its content
 *   type is one of part B1's value groups: `common/script_values`), written `name = { 1 5 }`;
 * - the value of a record field whose measured value type (part B1, `value_type`) holds the
 *   group `script_value`: the base game writes a script value there (`age` of
 *   `common/scripted_character_templates`, `age = { 20 30 }`).
 *
 * A block of two numbers elsewhere in a script value is not a range: the points of a curve
 * (`curve = { { 0.38 0.0 } }` of `common/genes`) are blocks without a key.
 *
 * Only a range of two numbers is judged: one that names script values (`{ low_value
 * high_value }`) has no value until the game evaluates it. The `fixed_range` and
 * `integer_range` operations of a formula, written `{ min = ... max = ... }`, are the script
 * math system's, which the `.info` keeps apart from the range directive; they are not judged.
 * A trigger's or an effect's own value (`add_gold = { 5 1 }` in an effect block) is not
 * judged either: the package does not say which keywords take a script value.
 */

import type { FolderTable } from '../index/folders.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import type { Block, FileNode } from '../syntax/tree.js';
import type { FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { recordsOf, valueGroupsOf, walkFields } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'structure/range-min-above-max';

/** What the check reads beside the file's reading. */
export interface RangeInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
}

/** The two numbers of a range `{ low high }`, or null when the block is not one. */
export function rangeOf(block: Block): readonly [number, number] | null {
    const items = block.items.filter((item) => item.kind !== 'comment');
    if (items.length !== 2) {
        return null;
    }
    const [low, high] = items;
    if (low?.kind !== 'scalar' || high?.kind !== 'scalar') {
        return null;
    }
    if (low.type !== 'number' || high.type !== 'number') {
        return null;
    }
    return [Number(low.text), Number(high.text)];
}

export function rangesMinAboveMax(
    reading: FileReading,
    context: CheckContext,
    input: RangeInput,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    const ranges = new Set<Block>();
    const operations = tablesOf(input.spec).valueBlockKeys;
    const walk = (block: Block): void => {
        const valueBlock = reading.blocks.get(block) === 'script-value';
        for (const item of block.items) {
            if (item.kind === 'block') {
                walk(item);
                continue;
            }
            if (item.kind !== 'pair' || item.value?.kind !== 'block') {
                continue;
            }
            if (valueBlock && operations.has(item.key.text)) {
                ranges.add(item.value);
            }
            walk(item.value);
        }
    };
    for (const item of input.tree.items) {
        if (item.kind === 'pair' && item.value?.kind === 'block') {
            if (reading.blocks.get(item.value) === 'script-value') {
                ranges.add(item.value);
            }
            walk(item.value);
        }
    }
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    const valueGroups = valueGroupsOf(input.spec);
    for (const record of records.records) {
        walkFields(input.spec, records, record, reading, (site) => {
            const groups = (site.field?.value_type ?? '').split('|');
            if (
                site.pair.value?.kind === 'block' &&
                groups.some((group) => valueGroups.groups.has(group))
            ) {
                ranges.add(site.pair.value);
            }
        });
    }
    for (const block of [...ranges].sort((a, b) => a.start - b.start)) {
        const range = rangeOf(block);
        if (range === null || !(range[0] > range[1])) {
            continue;
        }
        out.push(
            finding(CODE, block, [], { min: String(range[0]), max: String(range[1]) }, context),
        );
    }
    return out;
}
