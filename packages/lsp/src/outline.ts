/**
 * Document symbols by the presentation data's outline rules (docs/PLAN.md item 8.8). Where a
 * file's folder has an outline rule, each record of the file (a top-level key whose value is a
 * block) is shown as the rule says: its symbol kind, its detail, and under it the fields the
 * rule lists (mostly blocks), each with its own label and kind, in the order they are written. The definitions
 * the index read inside the record stay under it (under the listed block that holds them,
 * where one does). Every other top-level entry, and every file of a folder without a rule,
 * keeps the plain outline of `symbols.ts`.
 */

import type { Block, FileNode, Pair } from '@pychivalry/core';
import { SymbolKind, type DocumentSymbol, type Range } from 'vscode-languageserver/node';
import {
    renderTemplate,
    type OutlineBlockRule,
    type OutlineRule,
    type Presentation,
} from './presentation.js';

/** What the outline of a file reads. */
export interface OutlineInput {
    readonly tree: FileNode;
    /** A range of the file from two offsets. */
    readonly rangeOf: (start: number, end: number) => Range;
    /** The file's folder, as the spec writes it, or null. */
    readonly folder: string | null;
    readonly presentation: Presentation;
}

/** The value a field of a block holds, when it is written once as plain text. */
export function scalarField(block: Block, field: string): string | null {
    let found: string | null = null;
    for (const item of block.items) {
        if (item.kind !== 'pair' || item.key.text !== field) {
            continue;
        }
        if (found !== null || item.value?.kind !== 'scalar') {
            return null;
        }
        found = item.value.value;
    }
    return found;
}

/** The values of a template's placeholders for a pair (`renderTemplate`). */
function valuesOf(pair: Pair, n: number): (name: string) => string | null {
    return (name) => {
        if (name === 'key') {
            return pair.key.text;
        }
        if (name === 'n') {
            return String(n);
        }
        if (name === 'value') {
            return pair.value?.kind === 'scalar' ? pair.value.value : null;
        }
        return pair.value?.kind === 'block' ? scalarField(pair.value, name) : null;
    };
}

function within(range: Range, inner: Range): boolean {
    const before = (a: Range['start'], b: Range['start']): boolean =>
        a.line < b.line || (a.line === b.line && a.character <= b.character);
    return before(range.start, inner.start) && before(inner.end, range.end);
}

function blockSymbol(
    pair: Pair,
    rule: OutlineBlockRule,
    n: number,
    input: OutlineInput,
): DocumentSymbol {
    const values = valuesOf(pair, n);
    const label =
        renderTemplate(rule.label ?? '{key}', values) ??
        (rule.fallback === undefined ? null : renderTemplate(rule.fallback, values)) ??
        pair.key.text;
    const children: DocumentSymbol[] = [];
    if (rule.children === 'blocks' && pair.value?.kind === 'block') {
        for (const item of pair.value.items) {
            if (item.kind === 'pair' && item.value?.kind === 'block') {
                children.push({
                    name: item.key.text === '' ? '(empty)' : item.key.text,
                    kind: SymbolKind.Field,
                    range: input.rangeOf(item.start, item.end),
                    selectionRange: input.rangeOf(item.key.start, item.key.end),
                });
            }
        }
    }
    return {
        name: label === '' ? pair.key.text : label,
        kind: SymbolKind[rule.symbol],
        range: input.rangeOf(pair.start, pair.end),
        selectionRange: input.rangeOf(pair.key.start, pair.key.end),
        ...(children.length === 0 ? {} : { children }),
    };
}

/** One record by its folder's rule, with the plain symbol's children (the definitions in it). */
function recordSymbol(
    pair: Pair & { readonly value: Block },
    rule: OutlineRule,
    plain: DocumentSymbol,
    input: OutlineInput,
): DocumentSymbol {
    const listed: DocumentSymbol[] = [];
    const counts = new Map<string, number>();
    for (const item of pair.value.items) {
        if (item.kind !== 'pair') {
            continue;
        }
        const n = (counts.get(item.key.text) ?? 0) + 1;
        counts.set(item.key.text, n);
        const blockRule = rule.blocks.find((b) => b.field === item.key.text);
        if (blockRule !== undefined) {
            listed.push(blockSymbol(item, blockRule, n, input));
        }
    }
    // The definitions inside the record: under the listed block that holds them, if any.
    const loose: DocumentSymbol[] = [];
    for (const child of plain.children ?? []) {
        const holder = listed.find((s) => within(s.range, child.range));
        if (holder === undefined) {
            loose.push(child);
        } else {
            holder.children = [...(holder.children ?? []), child];
        }
    }
    const children = [...listed, ...loose].sort(
        (a, b) =>
            a.range.start.line - b.range.start.line ||
            a.range.start.character - b.range.start.character,
    );
    const detail =
        rule.detail === undefined ? null : renderTemplate(rule.detail, valuesOf(pair, 1));
    return {
        name: plain.name,
        kind: SymbolKind[rule.symbol],
        range: plain.range,
        selectionRange: plain.selectionRange,
        ...(detail === null || detail === ''
            ? plain.detail === undefined
                ? {}
                : { detail: plain.detail }
            : { detail }),
        ...(children.length === 0 ? {} : { children }),
    };
}

/**
 * A script file's symbols by its folder's outline rule: `plain` is the plain outline of the
 * same file (`documentSymbols`), one symbol per top-level pair in order; a record the rule
 * covers is shown by the rule, everything else as it was.
 */
export function outlineSymbols(plain: DocumentSymbol[], input: OutlineInput): DocumentSymbol[] {
    const rule =
        input.folder === null ? undefined : input.presentation.folders.get(input.folder)?.outline;
    if (rule === undefined || rule === null) {
        return plain;
    }
    const pairs = input.tree.items.filter((item) => item.kind === 'pair');
    if (pairs.length !== plain.length) {
        // Not the plain outline of this tree: leave it as it is.
        return plain;
    }
    return plain.map((symbol, i) => {
        const pair = pairs[i];
        if (pair === undefined || pair.value?.kind !== 'block' || pair.key.text.startsWith('@')) {
            return symbol;
        }
        return recordSymbol({ ...pair, value: pair.value }, rule, symbol, input);
    });
}
