/**
 * The fix of `style/empty-block`: a suggestion, never safe.
 *
 * - **An empty block that means nothing the package knows of:** the empty pair taken away.
 *   Whether such a block means something (an empty list that clears one, a placeholder for
 *   content to come) is the author's to say, so it is a suggestion. Offered only for a block that
 *   is the value of a pair, holds not even a comment, and is not the only thing in the block
 *   around it (which would then be empty in turn); the pair goes with its line when it is alone
 *   on it.
 * - **An iterator that is a condition** (`data.means` `at-least-one`, the owner's decision of
 *   2026-11-26): never taken away, which would change the result of the block around it. The
 *   test is written out instead, by the iterator's own parameter (`data.written_out`, from the
 *   spec package: `check/empty-iterator.ts`), in a block that holds not even a comment. A
 *   suggestion: the package does not state that the parameter's default asks for the same.
 * - **An iterator the package does not say how to read where it is written** (`not-known`),
 *   and **a trigger or an effect** written with an empty block (`trigger`, `effect`), which
 *   taking the block away would take away: nothing.
 * - **A logical operator, a scope switch or a trigger block** (`logical-operator`,
 *   `scope-switch`, `trigger-block`; a `limit`), whose meaning when empty the spec package
 *   leaves open (the owner's decision of 2026-11-26, `check/empty-open.ts`): nothing, until the
 *   spec work says what each evaluates to.
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

/** The empty block of an iterator that is a condition, its test written out. */
function writtenOutFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const written = finding.data['written_out'];
    const found = file.tree === null ? undefined : pairWithParent(file.tree, finding.start);
    const block = found === undefined ? undefined : blockOf(found.pair.value);
    if (typeof written !== 'string' || found === undefined || block === undefined) {
        return null;
    }
    if (block.items.length > 0) {
        // Its comments stay where the author wrote them: no edit is made among them.
        return null;
    }
    return suggestion('iterator-kinds', [
        {
            title: `Write '${written}' in the empty '${found.pair.key.text}'`,
            edits: [file.replace(block.start, block.end, `{ ${written} }`)],
        },
    ]);
}

/** The fix of an empty block. */
export function emptyBlockFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const means = finding.data['means'];
    if (means === 'at-least-one') {
        return writtenOutFix(finding, file);
    }
    if (means !== undefined) {
        return null;
    }
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
