/**
 * The fix of `style/redundant-condition` and `style/redundant-false-condition`: safe, the
 * condition taken away. Part D4 says a child that always holds, or always fails, changes nothing
 * in its block while another child remains (the block's `child_always_true`, or
 * `child_always_false`, is `neutral`), and each check reports one only while the block keeps
 * another item, so the block reads the same after it. The pair goes with its line when it is
 * alone on it, otherwise with the spaces after it. Like every safe fix, it is checked by
 * construction (`fix/verify.ts`): where taking it away leaves the file out of pychivalry's format
 * (a block left with one simple pair over several lines), it is offered as a suggestion.
 */

import type { FixableFinding, FixFile } from './file.js';
import { safeFix, type FindingFix } from './fix.js';
import { blockOf, significantItems, type Block, type FileNode, type Pair } from '../syntax/tree.js';

/** The pair that spans exactly the finding, and the block it is directly in. */
function pairAt(
    container: FileNode | Block,
    start: number,
    end: number,
): { readonly pair: Pair; readonly parent: Block } | undefined {
    for (const item of container.items) {
        if (item.start > start || item.end < end) {
            continue;
        }
        if (item.kind === 'pair' && item.start === start && item.end === end) {
            return container.kind === 'block' ? { pair: item, parent: container } : undefined;
        }
        const inner =
            item.kind === 'block' ? item : item.kind === 'pair' ? blockOf(item.value) : undefined;
        return inner === undefined ? undefined : pairAt(inner, start, end);
    }
    return undefined;
}

export function redundantConditionFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const found = file.tree === null ? undefined : pairAt(file.tree, finding.start, finding.end);
    if (found === undefined || significantItems(found.parent).length < 2) {
        return null;
    }
    const { pair } = found;
    const line = file.lines.positionAt(pair.start).line;
    const lineStart = file.lines.lineStarts[line] ?? 0;
    const lineEnd = file.lines.lineStarts[file.lines.positionAt(pair.end).line + 1];
    const alone =
        lineEnd !== undefined &&
        file.slice(lineStart, pair.start).trim() === '' &&
        file.slice(pair.end, lineEnd).trim() === '';
    let edit;
    if (alone) {
        edit = file.replace(lineStart, lineEnd, '');
    } else {
        const after = /^[ \t]*/.exec(file.text.slice(pair.end))?.[0].length ?? 0;
        edit = file.replace(pair.start, pair.end + after, '');
    }
    const written = file.slice(pair.start, pair.end);
    return safeFix('keyword-roles', { title: `Take '${written}' away`, edits: [edit] });
}
