/**
 * Completion with the presentation data (docs/PLAN.md item 8.8), over the core's answer
 * (`completion.ts`):
 *
 * - **Snippets where they are valid.** At the top level of a file, outside any block, comment
 *   or quoted text, the folder's `file` and `record` snippets (a new event, a new decision). In
 *   a block, a `field` snippet of the folder for that block, only where the core offers its
 *   field there, that is where the spec says the field may be written. Snippets are offered
 *   only to an editor that says it takes them.
 * - **Fields in their order.** In a block the folder's field order covers, the fields the core
 *   offers are sorted by that order, ahead of the other fields and of everything else; the
 *   first field of the order not yet written after the last one written before the place is
 *   preselected.
 *
 * Nothing is offered that the core does not already accept there, but a file or record
 * snippet at the top level, where the core offers nothing (a record's name is the modder's).
 */

import type { Block, FileNode, Pair } from '@pychivalry/core';
import {
    CompletionItemKind,
    InsertTextFormat,
    type CompletionItem,
    type CompletionList,
    type Range,
} from 'vscode-languageserver/node';
import { fieldOrderOf, snippetText, type Presentation, type Snippet } from './presentation.js';

/** What the presented completion reads besides the core's list. */
export interface PresentedCompletionInput {
    readonly tree: FileNode;
    readonly text: string;
    readonly offset: number;
    readonly rangeOf: (start: number, end: number) => Range;
    /** The file's folder, as the spec writes it, or null. */
    readonly folder: string | null;
    readonly presentation: Presentation;
    /** Whether the editor takes snippets (`completionItem.snippetSupport`). */
    readonly snippets: boolean;
}

/** The characters of a word completion replaces, as the core reads them. */
const WORD_CHAR = /[A-Za-z0-9_$@\-']/;

/** The span of the word written before `offset`, as the core's completion reads it. */
function wordAt(text: string, offset: number): { start: number; end: number } {
    let start = offset;
    while (start > 0 && WORD_CHAR.test(text.charAt(start - 1))) {
        start--;
    }
    let end = offset;
    while (end < text.length && WORD_CHAR.test(text.charAt(end))) {
        end++;
    }
    return { start, end };
}

/** Whether a place is in quoted text or a comment of its line. */
function inTextOrComment(text: string, offset: number): boolean {
    let at = offset;
    while (at > 0 && text.charAt(at - 1) !== '\n' && text.charAt(at - 1) !== '\r') {
        at--;
    }
    let quoted = false;
    for (let i = at; i < offset; i++) {
        const c = text.charAt(i);
        if (c === '"') {
            quoted = !quoted;
        } else if (c === '#' && !quoted) {
            return true;
        }
    }
    return quoted;
}

/** Whether a word is a value: an operator is written before it. */
function isValue(text: string, start: number): boolean {
    let at = start;
    while (at > 0 && /\s/.test(text.charAt(at - 1))) {
        at--;
    }
    return at > 0 && /[=<>!?]/.test(text.charAt(at - 1));
}

/**
 * The pairs from the top level to the innermost block that holds `offset`; empty at the top
 * level. A bare block (`{ ... }` with no key) ends the path: no field of a record is there.
 */
export function pathAt(file: FileNode, offset: number): { pairs: Pair[]; bare: boolean } {
    const pairs: Pair[] = [];
    const holds = (block: Block): boolean =>
        offset > block.start && (block.closed ? offset < block.end : offset <= block.end);
    let items = file.items;
    for (;;) {
        let next: Block | null = null;
        for (const item of items) {
            if (item.kind === 'block' && holds(item)) {
                return { pairs, bare: true };
            }
            if (item.kind === 'pair' && item.value?.kind === 'block' && holds(item.value)) {
                pairs.push(item);
                next = item.value;
                break;
            }
        }
        if (next === null) {
            return { pairs, bare: false };
        }
        items = next.items;
    }
}

function snippetItem(snippet: Snippet, range: Range, sortText: string): CompletionItem {
    return {
        label: snippet.label,
        kind: CompletionItemKind.Snippet,
        detail: snippet.description,
        documentation: { kind: 'markdown', value: `\`\`\`ck3\n${snippetText(snippet)}\n\`\`\`` },
        insertTextFormat: InsertTextFormat.Snippet,
        textEdit: { range, newText: snippetText(snippet) },
        sortText,
        filterText: snippet.at === 'field' ? (snippet.field ?? snippet.label) : snippet.label,
    };
}

/** The core's completion list with the folder's snippets and field order. */
export function presentCompletion(
    list: CompletionList,
    input: PresentedCompletionInput,
): CompletionList {
    const folder = input.folder === null ? undefined : input.presentation.folders.get(input.folder);
    if (folder === undefined) {
        return list;
    }
    const { text, offset } = input;
    const word = wordAt(text, offset);
    if (inTextOrComment(text, word.start) || isValue(text, word.start)) {
        return list;
    }
    const range = input.rangeOf(word.start, word.end);
    const { pairs, bare } = pathAt(input.tree, offset);
    if (pairs.length === 0) {
        if (bare || !input.snippets) {
            return list;
        }
        const items = folder.snippets
            .filter((s) => s.at === 'file' || s.at === 'record')
            .map((s, i) => snippetItem(s, range, `0${String(i).padStart(4, '0')}`));
        return { isIncomplete: list.isIncomplete, items: [...list.items, ...items] };
    }
    if (bare) {
        return list;
    }
    const block = pairs
        .slice(1)
        .map((p) => p.key.text)
        .join('.');
    const offered = new Set(
        list.items.filter((i) => i.kind === CompletionItemKind.Field).map((i) => i.label),
    );
    const order = fieldOrderOf(input.presentation, folder.folder, block) ?? [];
    const position = new Map(order.map((name, i) => [name, i]));
    const pad = (n: number): string => String(n).padStart(4, '0');
    // The next field: the first of the order, not yet written, after the last written before.
    const inner = pairs.at(-1)?.value;
    const written = new Set<string>();
    let last = -1;
    if (inner?.kind === 'block') {
        for (const item of inner.items) {
            if (item.kind !== 'pair' || (item.start <= offset && offset <= item.end)) {
                continue;
            }
            written.add(item.key.text);
            const at = position.get(item.key.text);
            if (at !== undefined && item.end <= offset) {
                last = Math.max(last, at);
            }
        }
    }
    const next = order.find((name, i) => i > last && !written.has(name) && offered.has(name));
    const items: CompletionItem[] = list.items.map((item) => {
        const at = item.kind === CompletionItemKind.Field ? position.get(item.label) : undefined;
        if (at !== undefined) {
            return {
                ...item,
                sortText: `0${pad(at)}a`,
                ...(item.label === next ? { preselect: true } : {}),
            };
        }
        if (order.length === 0) {
            return item;
        }
        return {
            ...item,
            sortText: `${item.kind === CompletionItemKind.Field ? '1' : '2'}${item.label}`,
        };
    });
    if (input.snippets) {
        for (const snippet of folder.snippets) {
            if (
                snippet.at === 'field' &&
                (snippet.block ?? '') === block &&
                snippet.field !== undefined &&
                offered.has(snippet.field)
            ) {
                const at = position.get(snippet.field);
                items.push(
                    snippetItem(
                        snippet,
                        range,
                        at === undefined ? `1${snippet.field}~` : `0${pad(at)}b`,
                    ),
                );
            }
        }
    }
    return { isIncomplete: list.isIncomplete, items };
}
