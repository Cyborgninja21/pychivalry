/**
 * The language server's features that read the presentation data (docs/PLAN.md item 8.8), in
 * one place, so that the server (`server.ts`) only hands its requests over: the outline by the
 * folder's outline rule (`outline.ts`), completion with snippets and field order
 * (`presented-completion.ts`) and inlay hints (`inlay-hints.ts`). What it needs of the server's
 * state it asks through `PresentationHost`.
 */

import {
    LocalizationReader,
    type DefinedNames,
    type FolderTable,
    type ParseResult,
    type Spec,
    type WorkspaceIndex,
} from '@pychivalry/core';
import type {
    CancellationToken,
    CompletionList,
    DocumentSymbol,
    InlayHint,
    Range,
} from 'vscode-languageserver/node';
import { inlayHints } from './inlay-hints.js';
import { outlineSymbols } from './outline.js';
import { presentCompletion } from './presented-completion.js';
import type { Presentation } from './presentation.js';

/** What the presentation features ask of the server. */
export interface PresentationHost {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The workspace index, or null before the mod is opened. */
    readonly index: () => WorkspaceIndex | null;
    /** A number that changes whenever the index changes. */
    readonly generation: () => number;
    /** An indexed file's content: the editor's text when it is open, otherwise the file on disk. */
    readonly contentOf: (layer: string, file: string) => Uint8Array | string | undefined;
    /** The definitions the checks see. */
    readonly names: () => DefinedNames;
}

/** A script file open in the editor, as the features read it. */
export interface PresentedFile {
    /** The file's path inside its mod or game folder, with `/`, or null. */
    readonly file: string | null;
    readonly parsed: ParseResult;
    readonly rangeOf: (start: number, end: number) => Range;
}

export class PresentationFeatures {
    readonly presentation: Presentation;
    private readonly host: PresentationHost;
    private texts: { readonly generation: number; readonly reader: LocalizationReader } | null =
        null;

    constructor(host: PresentationHost, presentation: Presentation) {
        this.host = host;
        this.presentation = presentation;
    }

    /** The spec's folder of a file's path inside its mod or game folder, or null. */
    folderOf(file: string | null): string | null {
        return file === null ? null : (this.host.folders.classify(file)?.folder.path ?? null);
    }

    /** A script file's symbols, the plain outline changed by its folder's outline rule. */
    symbols(plain: DocumentSymbol[], at: PresentedFile): DocumentSymbol[] {
        return outlineSymbols(plain, {
            tree: at.parsed.file,
            rangeOf: at.rangeOf,
            folder: this.folderOf(at.file),
            presentation: this.presentation,
        });
    }

    /** The core's completion list with the folder's snippets and field order. */
    completion(
        list: CompletionList,
        at: PresentedFile,
        offset: number,
        snippets: boolean,
    ): CompletionList {
        return presentCompletion(list, {
            tree: at.parsed.file,
            text: at.parsed.text,
            offset,
            rangeOf: at.rangeOf,
            folder: this.folderOf(at.file),
            presentation: this.presentation,
            snippets,
        });
    }

    /** The inlay hints of a script file in a range. */
    async inlayHints(
        at: PresentedFile & { readonly file: string },
        range: Range,
        token: CancellationToken,
    ): Promise<InlayHint[]> {
        const lines = at.parsed.lines;
        return inlayHints({
            spec: this.host.spec,
            folders: this.host.folders,
            file: at.file,
            folder: this.folderOf(at.file),
            tree: at.parsed.file,
            start: lines.offsetAt(range.start),
            end: lines.offsetAt(range.end),
            positionAt: (offset) => lines.rangeOf(offset, offset).start,
            presentation: this.presentation,
            names: this.host.names(),
            text: (key, language) => this.text(key, language),
            token,
        });
    }

    /** The text in force of a localization key in a language, read through the index. */
    text(key: string, language: string): string | null {
        const index = this.host.index();
        if (index === null) {
            return null;
        }
        const generation = this.host.generation();
        if (this.texts?.generation !== generation) {
            this.texts = {
                generation,
                reader: new LocalizationReader((layer, file) => this.host.contentOf(layer, file)),
            };
        }
        const copies = this.texts.reader
            .texts(index, key, language)
            .filter((t) => t.inForce !== 'no' && t.text !== null);
        const inForce = copies.find((t) => t.inForce === 'yes');
        if (inForce !== undefined) {
            return inForce.text;
        }
        // No rule says which copy is in force: a text only when every copy says the same.
        const distinct = new Set(copies.map((t) => t.text));
        return distinct.size === 1 ? (copies[0]?.text ?? null) : null;
    }
}
