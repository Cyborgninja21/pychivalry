/**
 * Document symbols (docs/PLAN.md item 7.5), from the syntax tree and the definitions the index
 * holds for the file. A script file's symbols are its top-level keys, each with the
 * definitions written inside it (an entry of a container, a nested name) as its children; a
 * localization file's are its language headers, each with the keys written under it. A GUI
 * file's (build step 10) are its `types` blocks, each with the types defined in it, and its
 * templates. A key's symbol kind says what the index read it as (a record, a constant, a
 * localization key), and its detail names the database it is a definition of.
 */

import { parseGui, parseLocalization, type Definition, type Form } from '@pychivalry/core';
import { SymbolKind, type DocumentSymbol, type Range } from 'vscode-languageserver/node';
import type { OpenDocument } from './documents.js';

const KIND: Readonly<Record<Form, SymbolKind>> = {
    record: SymbolKind.Object,
    value: SymbolKind.Variable,
    prefixed: SymbolKind.Function,
    constant: SymbolKind.Constant,
    container: SymbolKind.Module,
    entry: SymbolKind.Field,
    key: SymbolKind.String,
    file: SymbolKind.File,
};

function symbol(
    name: string,
    kind: SymbolKind,
    range: Range,
    selectionRange: Range,
    detail: string,
    children: DocumentSymbol[] = [],
): DocumentSymbol {
    return {
        name: name === '' ? '(empty)' : name,
        kind,
        range,
        selectionRange,
        ...(detail === '' ? {} : { detail }),
        ...(children.length === 0 ? {} : { children }),
    };
}

/** The symbols of an open file, with the index's definitions of it. */
export function documentSymbols(
    doc: OpenDocument,
    definitions: readonly Definition[],
): DocumentSymbol[] {
    const lines = doc.lines;
    if (doc.kind === 'gui') {
        return guiSymbols(doc, definitions);
    }
    if (doc.kind === 'localization') {
        const file = parseLocalization(doc.text);
        const out: DocumentSymbol[] = [];
        // Each entry belongs to the last header before it; entries before any header stand alone.
        const headers = file.headers.map((h) => ({
            header: h,
            children: [] as DocumentSymbol[],
            end: h.end,
        }));
        for (const e of file.entries) {
            const s = symbol(
                e.key,
                SymbolKind.String,
                lines.rangeOf(e.start, e.lineEnd),
                lines.rangeOf(e.start, e.end),
                '',
            );
            const owner = headers.filter((h) => h.header.start < e.start).at(-1);
            if (owner === undefined) {
                out.push(s);
            } else {
                owner.children.push(s);
                owner.end = Math.max(owner.end, e.lineEnd);
            }
        }
        for (const h of headers) {
            out.push(
                symbol(
                    h.header.language,
                    SymbolKind.Namespace,
                    lines.rangeOf(h.header.start, h.end),
                    lines.rangeOf(h.header.start, h.header.end),
                    '',
                    h.children,
                ),
            );
        }
        return out;
    }
    const tree = doc.script().file;
    const out: DocumentSymbol[] = [];
    for (const item of tree.items) {
        if (item.kind !== 'pair') {
            continue;
        }
        const own = definitions.find((d) => d.start === item.key.start);
        const inside = definitions
            .filter((d) => d !== own && d.start > item.key.start && d.start < item.end)
            .map((d) =>
                symbol(
                    d.name,
                    KIND[d.form],
                    lines.rangeOf(d.start, Math.max(d.end, d.extentEnd)),
                    lines.rangeOf(d.start, d.end),
                    d.database,
                ),
            );
        out.push(
            symbol(
                item.key.text,
                own === undefined ? SymbolKind.Property : KIND[own.form],
                lines.rangeOf(item.start, item.end),
                lines.rangeOf(item.key.start, item.key.end),
                own?.database ?? '',
                inside,
            ),
        );
    }
    return out;
}

/**
 * A GUI file's symbols: each `types` block at the top level, with the types defined in it as its
 * children, and each template; the index's definitions of the file, by the key they are at.
 */
function guiSymbols(doc: OpenDocument, definitions: readonly Definition[]): DocumentSymbol[] {
    const lines = doc.lines;
    const out: DocumentSymbol[] = [];
    const symbolOf = (d: Definition): DocumentSymbol =>
        symbol(
            d.name,
            d.database.endsWith('templates') ? SymbolKind.Struct : SymbolKind.Class,
            lines.rangeOf(d.start, Math.max(d.end, d.extentEnd)),
            lines.rangeOf(d.start, d.end),
            d.database,
        );
    for (const item of parseGui(doc.text).file.items) {
        if (item.kind !== 'gui-named') {
            continue;
        }
        // A template's own definition: its key, between the keyword and the block.
        const own = definitions.find((d) => d.start >= item.start && d.start < item.body.start);
        if (own !== undefined) {
            out.push(symbolOf(own));
            continue;
        }
        if (item.keyword.text.toLowerCase() !== 'types') {
            continue;
        }
        const inside = definitions
            .filter((d) => d.start > item.body.start && d.start < item.body.end)
            .map(symbolOf);
        const name = item.name ?? item.keyword;
        out.push(
            symbol(
                name.text,
                SymbolKind.Namespace,
                lines.rangeOf(item.start, item.end),
                lines.rangeOf(name.start, name.end),
                '',
                inside,
            ),
        );
    }
    return out;
}
