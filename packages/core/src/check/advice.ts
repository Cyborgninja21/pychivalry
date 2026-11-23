/**
 * What the advice checks of item 4.7 share (docs/checks.md, "4.7: advice that holds on 1.21"
 * and "4.7: advice carried over provisionally"). Every one is advice: information or a hint,
 * never an error or a warning (docs/decisions.md, rows 46, 52 and 53).
 *
 * Each check says, beside its findings, how many records (or blocks, or values) it judged on
 * the file: the re-proof of item 4.7 counts, over the base game, the records a rule applies to
 * and the records it fires on, and a rule ships only if it applies to at least 10 and fires on
 * none (row 46).
 */

import type { FolderTable } from '../index/folders.js';
import type { Spec } from '../spec/reader.js';
import {
    blockOf,
    significantItems,
    type Block,
    type FileNode,
    type Item,
    type Pair,
} from '../syntax/tree.js';
import type { DefinedNames } from './context.js';
import type { CheckCode, CheckFinding } from './finding.js';
import type { CheckContext } from './report.js';

/** What an advice check reads: the file, the package, the definitions it can see. */
export interface AdviceInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod or game folder, with `/`. */
    readonly file: string;
    readonly tree: FileNode;
    readonly names: DefinedNames;
    readonly context: CheckContext;
}

/** What an advice check found on one file, and how many units it judged there. */
export interface AdviceResult {
    readonly judged: number;
    readonly findings: CheckFinding[];
}

/** An advice check: its code, and how it reads a file. */
export interface AdviceCheck {
    readonly code: CheckCode;
    run(input: AdviceInput): AdviceResult;
}

/** Nothing judged, nothing found. */
export const NOTHING: AdviceResult = { judged: 0, findings: [] };

/** The spec's folder the file is in, or null. */
export function directoryOf(input: AdviceInput): string | null {
    return input.folders.classify(input.file)?.folder.path ?? null;
}

/**
 * The records of a file: its top-level `key = { ... }` pairs, the way part D4's measurement
 * selects them (not an `@constant`, not a prefixed `word name = { }`).
 */
export function recordsOf(tree: FileNode): { readonly pair: Pair; readonly body: Block }[] {
    const out: { pair: Pair; body: Block }[] = [];
    for (const item of significantItems(tree)) {
        if (item.kind !== 'pair' || item.prefix !== null || item.key.type === 'constant') {
            continue;
        }
        const body = blockOf(item.value);
        if (body !== undefined) {
            out.push({ pair: item, body });
        }
    }
    return out;
}

/** The blocks of a pair's value: its block, or none. */
function bodyBlocks(item: Item): Block[] {
    if (item.kind === 'block') {
        return [item];
    }
    if (item.kind === 'pair') {
        const body = blockOf(item.value);
        return body === undefined ? [] : [body];
    }
    return [];
}

/**
 * Every pair of a file or block at any depth, in the order written, with the block or file it
 * is directly in and its place among that container's significant items.
 */
export function walkPairs(
    container: FileNode | Block,
    visit: (pair: Pair, parent: FileNode | Block, siblings: readonly Item[], at: number) => void,
): void {
    const items = significantItems(container);
    items.forEach((item, at) => {
        if (item.kind === 'pair') {
            visit(item, container, items, at);
        }
        for (const body of bodyBlocks(item)) {
            walkPairs(body, visit);
        }
    });
}

/** The number a scalar value is, when it is written as a number. */
export function numberOf(pair: Pair): number | undefined {
    const value = pair.value;
    if (value?.kind !== 'scalar' || value.type !== 'number') {
        return undefined;
    }
    const n = Number(value.text);
    return Number.isFinite(n) ? n : undefined;
}

/** Words as a message lists them: `'a'`, `'a' or 'b'`, `'a', 'b' or 'c'`. */
export function either(words: readonly string[]): string {
    const quoted = words.map((w) => `'${w}'`);
    if (quoted.length <= 1) {
        return quoted.join('');
    }
    return `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1] ?? ''}`;
}
