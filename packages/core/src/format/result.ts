/**
 * What the formatter returns (docs/formatting.md): the text formatted, or left as it is with
 * the reason, and the edits that turn the one into the other, each placed on the lines it
 * touches so that Format Selection can keep the edits of the lines selected.
 */

import { FINDING_KINDS, findingMessage, type Finding } from '../syntax/findings.js';

/** What a file is formatted as: script (`.txt`) or localization (`.yml`). */
export type FormatKind = 'script' | 'localization';

/** One change: the span `[start, end)` of the text given is replaced by `text`. */
export interface FormatEdit {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

/** Why a file is left as it is. */
export interface FormatLeft {
    /** The finding that keeps it from being formatted (`syntax/missing-closing-brace`, ...). */
    readonly id: string;
    /** Where that finding is, counted from 0, in the text without its byte-order mark. */
    readonly line: number;
    readonly character: number;
    /** What it is, in a sentence. */
    readonly message: string;
}

export interface FormatResult {
    readonly kind: FormatKind;
    /** The formatted text; the text given, unchanged, when the file is left as it is. */
    readonly text: string;
    /** True when `text` differs from the text given. */
    readonly changed: boolean;
    /** Why the file is left as it is, or null when it was formatted. */
    readonly left: FormatLeft | null;
    /** The edits that turn the text given into `text`, in order, none overlapping. */
    readonly edits: readonly FormatEdit[];
    /** The line break the output uses. */
    readonly eol: '\r\n' | '\n';
    /** How many blocks written on one line were split for being too wide (rule 4). */
    readonly split: number;
}

/** The reason a file with this finding is left as it is. */
export function leftFor(finding: Finding): FormatLeft {
    const kind = FINDING_KINDS[finding.id];
    const what = kind.catalogue === null ? findingMessage(finding) : kind.description;
    return {
        id: finding.id,
        line: finding.range.start.line,
        character: finding.range.start.character,
        message: what,
    };
}

/** A sentence saying why a file is left as it is, its place counted from 1. */
export function leftMessage(left: FormatLeft): string {
    return `left as it is: line ${String(left.line + 1)}, column ${String(left.character + 1)}: ${left.message} (${left.id})`;
}

/** The text unchanged, with the reason. */
export function leftAsItIs(kind: FormatKind, text: string, left: FormatLeft): FormatResult {
    return {
        kind,
        text,
        changed: false,
        left,
        edits: [],
        eol: lineEndingOf(text),
        split: 0,
    };
}

/**
 * The line break a file uses most: `\r\n` or `\n` (rule 10). On a tie, and in a text with
 * neither, `\r\n`, the base game's majority. A lone `\r` counts for neither.
 */
export function lineEndingOf(text: string): '\r\n' | '\n' {
    let crlf = 0;
    let lf = 0;
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
        if (i > 0 && text.charCodeAt(i - 1) === 13) {
            crlf++;
        } else {
            lf++;
        }
    }
    return lf > crlf ? '\n' : '\r\n';
}

/** Apply edits (in order, none overlapping) to a text. */
export function applyFormatEdits(text: string, edits: readonly FormatEdit[]): string {
    let out = '';
    let at = 0;
    for (const edit of edits) {
        out += text.slice(at, edit.start) + edit.text;
        at = edit.end;
    }
    return out + text.slice(at);
}
