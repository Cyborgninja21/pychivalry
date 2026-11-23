/**
 * The files open in the editor: their text as the editor holds it, kept up to date with each
 * change the editor sends (incremental changes, or the whole text), and, for a script file,
 * the parse of that text, re-parsed after each change by the core's incremental `reparse`
 * (docs/PLAN.md item 2.7): only the innermost block that holds the change is read again.
 */

import {
    fileKindOf,
    LineIndex,
    parse,
    reparse,
    type FileKind,
    type MessageCatalogue,
    type ParseResult,
} from '@pychivalry/core';
import type { TextDocumentContentChangeEvent } from 'vscode-languageserver/node';

/** One file open in the editor. */
export class OpenDocument {
    readonly uri: string;
    /** The file's path inside the mod, with `/`; null for a file outside the mod. */
    readonly path: string | null;
    /** Script or localization, by the file's extension; null for any other file. */
    readonly kind: FileKind | null;
    version: number;
    private current: string;
    private index: LineIndex | null = null;
    private parsed: ParseResult | null = null;
    /** How many changes were read by `reparse`, and how many by a parse of the whole text. */
    readonly parses = { incremental: 0, whole: 0 };

    constructor(
        uri: string,
        path: string | null,
        version: number,
        text: string,
        private readonly catalogue: MessageCatalogue,
    ) {
        this.uri = uri;
        this.path = path;
        this.kind = path === null ? null : (fileKindOf(path) ?? null);
        this.version = version;
        this.current = text;
    }

    get text(): string {
        return this.current;
    }

    /** Line starts of the text, for turning positions into offsets. */
    get lines(): LineIndex {
        if (this.parsed !== null) {
            return this.parsed.lines;
        }
        this.index ??= new LineIndex(this.current);
        return this.index;
    }

    /** The script file's parse of the text; parsed once, then re-parsed after each change. */
    script(): ParseResult {
        if (this.parsed === null) {
            this.parsed = parse(this.current, { catalogue: this.catalogue });
            this.parses.whole++;
        }
        return this.parsed;
    }

    /** Apply the editor's changes, in order, each to the text the one before left. */
    change(version: number, changes: readonly TextDocumentContentChangeEvent[]): void {
        for (const change of changes) {
            if (!('range' in change)) {
                this.current = change.text;
                this.index = null;
                if (this.parsed !== null) {
                    this.parsed = null;
                }
                continue;
            }
            const lines = this.lines;
            const start = lines.offsetAt(change.range.start);
            const end = Math.max(start, lines.offsetAt(change.range.end));
            this.current = this.current.slice(0, start) + change.text + this.current.slice(end);
            this.index = null;
            if (this.parsed !== null) {
                this.parsed = reparse(
                    this.parsed,
                    { start, end, text: change.text },
                    { catalogue: this.catalogue },
                );
                this.parses.incremental++;
            }
        }
        this.version = version;
    }
}
