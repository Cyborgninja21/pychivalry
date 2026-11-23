/**
 * The script each snippet of the presentation data writes, as a whole file of its folder: what
 * the tests check with pychivalry's own checks (docs/PLAN.md item 8.8: a snippet must produce
 * script those checks accept with no error and no warning).
 *
 * Every snippet is written as the editor leaves it when each tab stop is accepted as offered
 * (`expandSnippet`), after the folder's `file` snippets (a new file's head, such as an events
 * file's `namespace`):
 *
 * - a `file` snippet alone;
 * - a `record` snippet as the file's one record;
 * - a `field` snippet inside the folder's first `record` snippet, in the block it names, in
 *   place of any field of its name the record already writes; in a folder with no `record`
 *   snippet, as the only field of a record of its own, `presentation_record`.
 */

import type { Block, FileNode } from '@pychivalry/core';
import { expandSnippet, snippetText, type Presentation, type Snippet } from './presentation.js';

/** The name of a record written for a field snippet in a folder with no record snippet. */
export const HOST_RECORD = 'presentation_record';

/** One snippet, written as a file of its folder. */
export interface SnippetHost {
    readonly folder: string;
    readonly snippet: Snippet;
    /** The file's path inside a mod, with `/`. */
    readonly file: string;
    readonly text: string;
}

/** The block at a path of keys below a block, the first of each key; null when absent. */
function blockAt(block: Block, path: readonly string[]): Block | null {
    let at: Block = block;
    for (const segment of path) {
        let next: Block | null = null;
        for (const item of at.items) {
            if (item.kind === 'pair' && item.key.text === segment && item.value?.kind === 'block') {
                next = item.value;
                break;
            }
        }
        if (next === null) {
            return null;
        }
        at = next;
    }
    return at;
}

/** A field snippet written into a record's text, or null when the block is not there. */
function intoRecord(
    record: string,
    parse: (text: string) => FileNode,
    path: readonly string[],
    field: string,
    insert: string,
): string | null {
    const tree = parse(record);
    const pair = tree.items.find((i) => i.kind === 'pair' && i.value?.kind === 'block');
    if (pair?.kind !== 'pair' || pair.value?.kind !== 'block') {
        return null;
    }
    const block = blockAt(pair.value, path);
    if (block === null) {
        return null;
    }
    // Remove the record's own pairs of the field, last first, then write the snippet at the end.
    let text = record;
    const own = block.items.filter((i) => i.kind === 'pair' && i.key.text === field);
    const close = block.end - 1;
    let at = close;
    for (const item of [...own].reverse()) {
        text = text.slice(0, item.start) + text.slice(item.end);
        at -= item.end - item.start;
    }
    return `${text.slice(0, at)}\n${insert}\n${text.slice(at)}`;
}

/** Every snippet of the presentation data, written as a file of its folder. */
export function snippetHosts(
    presentation: Presentation,
    parse: (text: string) => FileNode,
): SnippetHost[] {
    const out: SnippetHost[] = [];
    for (const folder of presentation.folders.values()) {
        const file = `${folder.folder}/zz_presentation_snippet.txt`;
        const head = folder.snippets
            .filter((s) => s.at === 'file')
            .map((s) => `${expandSnippet(snippetText(s))}\n`)
            .join('');
        const record = folder.snippets.find((s) => s.at === 'record');
        for (const snippet of folder.snippets) {
            const expanded = expandSnippet(snippetText(snippet));
            let text: string | null;
            if (snippet.at === 'file') {
                text = `${expanded}\n`;
            } else if (snippet.at === 'record') {
                text = `${head}${expanded}\n`;
            } else {
                const path = (snippet.block ?? '') === '' ? [] : (snippet.block ?? '').split('.');
                if (record === undefined) {
                    const open = path.map((p) => `${p} = {\n`).join('');
                    const shut = path.map(() => '}\n').join('');
                    text = `${head}${HOST_RECORD} = {\n${open}${expanded}\n${shut}}\n`;
                } else {
                    const host = intoRecord(
                        expandSnippet(snippetText(record)),
                        parse,
                        path,
                        snippet.field ?? '',
                        expanded,
                    );
                    text = host === null ? null : `${head}${host}\n`;
                }
            }
            if (text !== null) {
                out.push({ folder: folder.folder, snippet, file, text });
            }
        }
    }
    return out;
}
