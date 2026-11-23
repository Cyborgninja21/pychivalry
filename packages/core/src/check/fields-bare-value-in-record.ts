/**
 * `fields/bare-value-in-record` (docs/checks.md, item 4.5): a bare value directly in a record
 * body that holds statements, where the game expects `key =`. An error on the catalogue's
 * `unexpected_token_X_found_at_X_expected` ("Unexpected token '%s' found at '%s', '=' expected"):
 * the game's reader takes the bare value for a key and reports the token it finds where the
 * `=` belongs, so the finding is at that token: the next item of the body, or its `}`.
 *
 * The records are `check/records.ts`'s. A record body that holds only values is a list, not a
 * record of fields, and is not judged; nor is a folder whose records are trigger or effect
 * blocks (`record_body`) or script values (a folder whose content type is one of part B1's
 * value groups), whose bodies the context reader reads in their own way. Only the record's
 * own body is judged: a field's block may hold a list beside its statements.
 */

import type { FolderTable } from '../index/folders.js';
import type { Spec } from '../spec/reader.js';
import { blockShape, type FileNode, type Item } from '../syntax/tree.js';
import type { FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { recordsOf } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'fields/bare-value-in-record';

/** What the check reads beside the file's reading. */
export interface BareValueInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
}

/** The text of the token an item starts with, as the game's reader would meet it. */
function tokenOf(item: Item): string {
    switch (item.kind) {
        case 'pair':
            return item.key.text;
        case 'scalar':
            return item.text;
        case 'block':
            return '{';
        case 'comment':
            return item.text;
    }
}

export function bareValuesInRecords(
    reading: FileReading,
    context: CheckContext,
    input: BareValueInput,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    if (records.schema === undefined || records.schema.record_body !== undefined) {
        return out;
    }
    for (const record of records.records) {
        const body = record.body;
        if (reading.blocks.get(body) !== 'none' || blockShape(body) !== 'statements') {
            continue;
        }
        const items = body.items.filter((item) => item.kind !== 'comment');
        const reported = new Set<Item>();
        items.forEach((item, i) => {
            if (item.kind !== 'scalar' || reported.has(item)) {
                return;
            }
            const next = items[i + 1];
            const span =
                next !== undefined
                    ? { start: next.start, end: next.kind === 'pair' ? next.key.end : next.end }
                    : { start: Math.max(body.start, body.end - 1), end: body.end };
            const token = next === undefined ? '}' : tokenOf(next);
            if (next !== undefined) {
                reported.add(next);
            }
            out.push(
                finding(
                    CODE,
                    span,
                    [token],
                    { value: item.text, record: record.pair.key.text },
                    context,
                ),
            );
        });
    }
    return out;
}
