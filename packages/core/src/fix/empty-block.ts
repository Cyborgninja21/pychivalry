/**
 * The fix of `style/empty-block`: a suggestion, the empty pair taken away. Whether the empty
 * block means something (an empty list that clears one, a placeholder for content to come) is
 * the author's to say, so it is never safe. Offered only for a block that is the value of a
 * pair, holds not even a comment, and is not the only thing in the block around it (which would
 * then be empty in turn); the pair goes with its line when it is alone on it.
 */

import {
    blockOf,
    significantItems,
    type Block,
    type FileNode,
    type Item,
    type Pair,
} from '../syntax/tree.js';
import type { FixableFinding, FixFile } from './file.js';
import { suggestion, type FindingFix } from './fix.js';

/** The pair that starts at `offset`, and the block or file it is in. */
function pairWithParent(
    container: FileNode | Block,
    offset: number,
): { pair: Pair; parent: FileNode | Block } | undefined {
    for (const item of container.items) {
        if (item.kind === 'pair' && item.start === offset) {
            return { pair: item, parent: container };
        }
        if (item.start <= offset && offset < item.end) {
            const inner = innerBlock(item);
            return inner === undefined ? undefined : pairWithParent(inner, offset);
        }
    }
    return undefined;
}

function innerBlock(item: Item): Block | undefined {
    if (item.kind === 'block') {
        return item;
    }
    return item.kind === 'pair' ? blockOf(item.value) : undefined;
}

/** The fix of an empty block. */
export function emptyBlockFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const found = file.tree === null ? undefined : pairWithParent(file.tree, finding.start);
    const block = found === undefined ? undefined : blockOf(found.pair.value);
    if (
        found === undefined ||
        block === undefined ||
        block.items.length > 0 ||
        found.parent.kind === 'file' ||
        significantItems(found.parent).length < 2
    ) {
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
        // The pair and the spaces after it.
        const after = /^[ \t]*/.exec(file.text.slice(pair.end))?.[0].length ?? 0;
        edit = file.replace(pair.start, pair.end + after, '');
    }
    return suggestion('parser', [
        { title: `Take the empty '${pair.key.text}' away`, edits: [edit] },
    ]);
}
