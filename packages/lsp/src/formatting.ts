/**
 * Formatting in the editor (docs/formatting.md; docs/PLAN.md items 8.5 and 8.9): Format
 * Document, Format Selection and on-type formatting, all from the core's formatter, so that the
 * editor's text is the command line's `format` and the agent server's `format` text.
 *
 * - **The text is the editor's,** without a byte-order mark: VS Code keeps the mark as the file's
 *   encoding, which the extension makes UTF-8 with the mark for CK3 files (a configuration
 *   default), so no edit here writes one. Every other rule is applied as the core applies it,
 *   Windows line breaks included; the extension turns the document's own line breaks to `\r\n`
 *   with the edits, which an edit's text alone cannot do in VS Code.
 * - **A file the formatter leaves as it is** (a parse error) gets no edit, and the reason is
 *   returned for the server to say once.
 */

import {
    DEFAULT_RULES,
    formatRangeEdits,
    formatText,
    leftMessage,
    onTypeEdits,
    type FormatEdit,
    type FormatKind,
    type LayoutRules,
    type LineIndex,
} from '@pychivalry/core';
import type { Range, TextEdit } from 'vscode-languageserver/node';

/** The rules in the editor: every rule, but the mark, which is the file's encoding there. */
export const EDITOR_RULES: LayoutRules = { ...DEFAULT_RULES, bom: 'keep' };

/** Edits as the protocol writes them, against the text whose lines are `lines`. */
export function toTextEdits(edits: readonly FormatEdit[], lines: LineIndex): TextEdit[] {
    return edits.map((e) => ({ range: lines.rangeOf(e.start, e.end), newText: e.text }));
}

/** What a formatting request answers: its edits, and why the file was left, if it was. */
export interface Formatted {
    readonly edits: TextEdit[];
    readonly left: string | null;
}

/** Format Document: the whole text. */
export function formatDocument(text: string, kind: FormatKind, lines: LineIndex): Formatted {
    const result = formatText(text, kind, { rules: EDITOR_RULES });
    return {
        edits: toTextEdits(result.edits, lines),
        left: result.left === null ? null : leftMessage(result.left),
    };
}

/** Format Selection: the edits of the whole format on the lines `range` touches. */
export function formatRange(
    text: string,
    kind: FormatKind,
    range: Range,
    lines: LineIndex,
): Formatted {
    // A range that ends at the start of a line selects the lines before it.
    const last =
        range.end.character === 0 && range.end.line > range.start.line
            ? range.end.line - 1
            : range.end.line;
    const { result, edits } = formatRangeEdits(text, kind, range.start.line, last, {
        rules: EDITOR_RULES,
    });
    return {
        edits: toTextEdits(edits, lines),
        left: result.left === null ? null : leftMessage(result.left),
    };
}

/** On-type formatting after `typed` (Enter, `}` or `=`), the cursor at `offset`. */
export function formatOnType(
    text: string,
    kind: FormatKind,
    offset: number,
    typed: string,
    lines: LineIndex,
): TextEdit[] {
    return toTextEdits(onTypeEdits(text, offset, typed, kind), lines);
}
