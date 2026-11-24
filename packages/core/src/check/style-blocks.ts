/**
 * The blocks inside the records of a file, for the best-practice rules that judge blocks
 * (`style/empty-block`, `style/deep-nesting`): every block a record's body holds, at any depth,
 * with its depth and the key it is the value of. A record is a top-level item whose value is a
 * block: a `key = { ... }` pair, with or without a name before its key; its own body is depth 1
 * and is not one of the blocks listed (whether a definition may be empty is its folder's
 * business, and an empty definition is how a mod blanks one of the base game's out).
 */

import { blockOf, type Block, type FileNode, type Item, type Pair } from '../syntax/tree.js';

/** A block inside a record. */
export interface InnerBlock {
    readonly block: Block;
    /** Its depth: 2 for a block directly in a record's body, one more for each block around it. */
    readonly depth: number;
    /** The pair whose value it is, or null for a block without a key. */
    readonly pair: Pair | null;
    /** The record it is in: the top-level pair whose body holds it. */
    readonly record: Pair;
}

function blockOfItem(item: Item): { block: Block; pair: Pair | null } | undefined {
    if (item.kind === 'block') {
        return { block: item, pair: null };
    }
    if (item.kind === 'pair') {
        const block = blockOf(item.value);
        return block === undefined ? undefined : { block, pair: item };
    }
    return undefined;
}

/** Every block inside each record of a file, outermost first, in the order written. */
export function innerBlocks(tree: FileNode, visit: (inner: InnerBlock) => void): void {
    const walk = (record: Pair, items: readonly Item[], depth: number): void => {
        for (const item of items) {
            const found = blockOfItem(item);
            if (found === undefined) {
                continue;
            }
            visit({ block: found.block, depth, pair: found.pair, record });
            walk(record, found.block.items, depth + 1);
        }
    };
    for (const record of recordPairs(tree)) {
        const body = blockOf(record.value);
        if (body !== undefined) {
            walk(record, body.items, 2);
        }
    }
}

/** The records of a file: its top-level pairs whose value is a block. */
export function recordPairs(tree: FileNode): Pair[] {
    return tree.items.filter(
        (item): item is Pair => item.kind === 'pair' && blockOf(item.value) !== undefined,
    );
}

/** How a block is named in a message: its key, or `{ }` for a block without one. */
export function blockName(inner: InnerBlock): string {
    return inner.pair === null ? '{ }' : inner.pair.key.text;
}
