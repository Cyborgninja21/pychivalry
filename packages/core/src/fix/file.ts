/**
 * What a fix of one file's findings can read: the file as it was checked (its tree, or its
 * localization entries), the spec package, the definitions the checks saw, the workspace index
 * and the text of the mod's other files. The context reader's and the scope walk's readings of
 * the file are made only when a fix asks for them, once per file.
 */

import { readContext, type DefinedNames, type FileReading } from '../check/context.js';
import type { FindingData } from '../check/finding.js';
import type { Code } from '../check/inventory.js';
import type { WorkspaceNames } from '../check/names.js';
import { readScopes, type ScopeReading } from '../check/scope.js';
import type { FolderTable } from '../index/folders.js';
import type { LocalizationFile } from '../index/localization.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import type { Spec } from '../spec/reader.js';
import type { FindingId } from '../syntax/findings.js';
import { parse, type ParseResult } from '../syntax/parser.js';
import type { LineIndex, Range } from '../syntax/position.js';
import type { Block, FileNode, Item, Pair, Scalar } from '../syntax/tree.js';
import { applyEdits } from './apply.js';
import type { FindingFix, FixAlternative, FixEdit } from './fix.js';

/** A finding as a fix reads it. */
export interface FixableFinding {
    readonly code: Code;
    readonly start: number;
    readonly end: number;
    readonly range: Range;
    readonly data: FindingData;
}

/** What the fixes of one file are given. */
export interface FixFileInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside the mod, with `/`. */
    readonly file: string;
    /** The definitions the checks saw (`checkNames`). */
    readonly names: DefinedNames & Partial<WorkspaceNames>;
    /** The workspace index that holds the file, when there is one. */
    readonly index?: WorkspaceIndex | undefined;
    /** A script file's parse, or a localization file's reading: the text checked. */
    readonly source: { readonly script: ParseResult } | { readonly localization: LocalizationFile };
    /**
     * The text of another file of the mod as the surface holds it now (an editor's unsaved
     * text, or the file on disk), by its path inside the mod; null when there is none. Without
     * it, no fix edits another file.
     */
    readonly modText?: ((path: string) => string | null) | undefined;
}

/** One file, as its fixes read it. */
export class FixFile {
    readonly input: FixFileInput;
    readonly text: string;
    readonly lines: LineIndex;
    readonly tree: FileNode | null;
    private read: { reading: FileReading; scopes: ScopeReading } | null | undefined;
    private syntaxCounts: Map<FindingId, number> | undefined;

    constructor(input: FixFileInput) {
        this.input = input;
        const source = input.source;
        if ('script' in source) {
            this.text = source.script.text;
            this.lines = source.script.lines;
            this.tree = source.script.file;
        } else {
            this.text = source.localization.text;
            this.lines = source.localization.lines;
            this.tree = null;
        }
    }

    get spec(): Spec {
        return this.input.spec;
    }

    get file(): string {
        return this.input.file;
    }

    /** The localization file's reading, for a localization file. */
    get localization(): LocalizationFile | null {
        const source = this.input.source;
        return 'localization' in source ? source.localization : null;
    }

    /** The context reader's and the scope walk's readings of a script file, made once. */
    readings(): { readonly reading: FileReading; readonly scopes: ScopeReading } | null {
        if (this.read === undefined) {
            if (this.tree === null) {
                this.read = null;
            } else {
                const input = {
                    spec: this.input.spec,
                    folders: this.input.folders,
                    file: this.input.file,
                    tree: this.tree,
                    names: this.input.names,
                };
                const reading = readContext(input);
                this.read = { reading, scopes: readScopes(input, reading) };
            }
        }
        return this.read;
    }

    /**
     * True when an alternative, applied to this script file and parsed again, leaves one parse
     * finding of `id` fewer and no more of any other: the parser's own check of a fix that
     * rests on its reading. Edits of other files are not part of it.
     */
    parsesFixed(alternative: FixAlternative, id: FindingId): boolean {
        const source = this.input.source;
        if (!('script' in source)) {
            return true;
        }
        const count = (findings: readonly { readonly id: FindingId }[]): Map<FindingId, number> => {
            const out = new Map<FindingId, number>();
            for (const f of findings) {
                out.set(f.id, (out.get(f.id) ?? 0) + 1);
            }
            return out;
        };
        this.syntaxCounts ??= count(source.script.findings);
        const before = this.syntaxCounts;
        const edits = alternative.edits.filter((e) => e.file === this.input.file);
        const after = count(parse(applyEdits(this.text, edits)).findings);
        if ((after.get(id) ?? 0) >= (before.get(id) ?? 0)) {
            return false;
        }
        return [...after].every(([other, n]) => other === id || n <= (before.get(other) ?? 0));
    }

    /** An edit of this file: `start`..`end` replaced with `text`. */
    replace(start: number, end: number, text: string): FixEdit {
        return {
            file: this.input.file,
            range: { start: this.lines.positionAt(start), end: this.lines.positionAt(end) },
            new_text: text,
        };
    }

    /** An insertion into this file at an offset. */
    insert(at: number, text: string): FixEdit {
        return this.replace(at, at, text);
    }

    /** The text of a span of the file. */
    slice(start: number, end: number): string {
        return this.text.slice(start, end);
    }

    /** The whitespace a line starts with: the line that holds `offset`. */
    indentAt(offset: number): string {
        const line = this.lines.positionAt(offset).line;
        const start = this.lines.lineStarts[line] ?? 0;
        return /^[ \t]*/.exec(this.text.slice(start))?.[0] ?? '';
    }

    /** The line break the file writes: `\r\n` when it has one, otherwise `\n`. */
    get newline(): string {
        return this.text.includes('\r\n') ? '\r\n' : '\n';
    }

    /** The pair whose key starts at `offset`, anywhere in the tree. */
    pairAt(offset: number): Pair | undefined {
        return this.tree === null ? undefined : findPair(this.tree.items, offset);
    }

    /** The scalar that starts at `offset`, anywhere in the tree: a key, a value or a bare value. */
    scalarAt(offset: number): Scalar | undefined {
        return this.tree === null ? undefined : findScalar(this.tree.items, offset);
    }

    /** The block that starts at `offset`, anywhere in the tree. */
    blockAt(offset: number): Block | undefined {
        return this.tree === null ? undefined : findBlock(this.tree.items, offset);
    }
}

function blockOfItem(item: Item): Block | undefined {
    if (item.kind === 'block') {
        return item;
    }
    if (item.kind !== 'pair' || item.value === null) {
        return undefined;
    }
    if (item.value.kind === 'block') {
        return item.value;
    }
    return item.value.kind === 'tagged' && item.value.body.kind === 'block'
        ? item.value.body
        : undefined;
}

/** The items of the one block among `items` that holds `offset`, if any. */
function inside(items: readonly Item[], offset: number): readonly Item[] | undefined {
    for (const item of items) {
        if (item.start <= offset && offset < item.end) {
            return blockOfItem(item)?.items;
        }
    }
    return undefined;
}

function findPair(items: readonly Item[], offset: number): Pair | undefined {
    for (const item of items) {
        if (item.kind === 'pair' && item.key.start === offset) {
            return item;
        }
    }
    const deeper = inside(items, offset);
    return deeper === undefined ? undefined : findPair(deeper, offset);
}

function findScalar(items: readonly Item[], offset: number): Scalar | undefined {
    for (const item of items) {
        if (item.kind === 'scalar' && item.start === offset) {
            return item;
        }
        if (item.kind === 'pair') {
            if (item.key.start === offset) {
                return item.key;
            }
            const value = item.value;
            if (value?.kind === 'scalar' && value.start === offset) {
                return value;
            }
            if (
                value?.kind === 'tagged' &&
                value.body.kind === 'scalar' &&
                value.body.start === offset
            ) {
                return value.body;
            }
        }
    }
    const deeper = inside(items, offset);
    return deeper === undefined ? undefined : findScalar(deeper, offset);
}

function findBlock(items: readonly Item[], offset: number): Block | undefined {
    for (const item of items) {
        const block = blockOfItem(item);
        if (block?.start === offset) {
            return block;
        }
    }
    const deeper = inside(items, offset);
    return deeper === undefined ? undefined : findBlock(deeper, offset);
}

/** A fix of one code: what it makes of a finding of that code, or null for none. */
export type Fixer = (finding: FixableFinding, file: FixFile) => FindingFix | null;

/** A string value of a finding's data, or null. */
export function dataText(data: FindingData, key: string): string | null {
    const value = data[key];
    return typeof value === 'string' ? value : null;
}

/** A list value of a finding's data, or an empty list. */
export function dataList(data: FindingData, key: string): readonly string[] {
    const value = data[key];
    return Array.isArray(value) ? (value as readonly string[]) : [];
}
