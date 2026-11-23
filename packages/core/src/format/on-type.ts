/**
 * On-type formatting (docs/formatting.md, "On-type formatting"): the formatter's rules applied
 * to the line being typed, and to nothing else, after three keys in a script file.
 *
 * - **Enter.** The line the cursor moves to is indented by rule 1: one tab for each block that
 *   encloses its first token, or, on a line still empty, each block open before it. The line
 *   it leaves loses the spaces and tabs at its end, and is emptied if it holds nothing else.
 * - **`}`, typed as the first thing on its line.** The line is indented as the line holding its
 *   `{`: one tab for each block that encloses the `}`.
 * - **`=`, completing one of the eight operators after a key on the same line.** One space
 *   before the operator, and one after it when something follows on the line.
 *
 * It never acts inside quoted text or a comment, never changes another line, and never joins or
 * splits a line. It works on text with errors, since text being typed is seldom complete: the
 * depth of a line comes from the braces before it, as the lexer reads them; where that depth
 * cannot be known (a `}` before the line closes no block), it changes nothing. Localization
 * files get no on-type formatting: a line typed there may become a header, which has no
 * indentation, or an entry, which has one space.
 */

import { tokenize, type Token } from '../syntax/lexer.js';
import type { FormatEdit, FormatKind } from './result.js';

/** The characters that trigger on-type formatting: Enter, `}` and `=`. */
export const ON_TYPE_TRIGGERS: readonly string[] = ['\n', '}', '='];

/** Where the line holding `offset` starts. */
function lineStart(text: string, offset: number): number {
    let i = offset;
    while (i > 0) {
        const code = text.charCodeAt(i - 1);
        if (code === 10 || code === 13) {
            break;
        }
        i--;
    }
    return i;
}

/** Where the line holding `offset` ends, before its line break. */
function lineEnd(text: string, offset: number): number {
    let i = offset;
    while (i < text.length) {
        const code = text.charCodeAt(i);
        if (code === 10 || code === 13) {
            break;
        }
        i++;
    }
    return i;
}

function isBlank(code: number): boolean {
    return code === 32 || code === 9;
}

/**
 * The blocks open at `offset`, by the braces before it, or null when that is not known (a `}`
 * closed no block) or `offset` is inside quoted text.
 */
function openBlocksAt(text: string, offset: number): number | null {
    let depth = 0;
    for (const token of tokenize(text, 0, offset)) {
        if (token.kind === 'open') {
            depth++;
        } else if (token.kind === 'close') {
            depth--;
            if (depth < 0) {
                return null;
            }
        } else if (token.kind === 'string' && !token.terminated && token.end === offset) {
            return null;
        }
    }
    return depth;
}

/** The edit that makes `[from, to)` read `text`, or nothing when it already does. */
function edit(source: string, from: number, to: number, text: string): FormatEdit[] {
    return source.slice(from, to) === text ? [] : [{ start: from, end: to, text }];
}

/** After Enter: the cursor at `offset`, at or after the start of the new line. */
function afterEnter(text: string, offset: number): FormatEdit[] {
    const start = lineStart(text, offset);
    if (start === 0) {
        return [];
    }
    // The line break just typed, and the line it leaves.
    const breakStart =
        text.charCodeAt(start - 1) === 10 && text.charCodeAt(start - 2) === 13
            ? start - 2
            : start - 1;
    const open = openBlocksAt(text, breakStart);
    if (open === null) {
        return [];
    }
    const leftStart = lineStart(text, breakStart);
    let leftEnd = breakStart;
    while (leftEnd > leftStart && isBlank(text.charCodeAt(leftEnd - 1))) {
        leftEnd--;
    }
    const out = edit(text, leftEnd, breakStart, '');
    // The line the cursor moved to: indented by the depth of its first token.
    let first = start;
    while (first < text.length && isBlank(text.charCodeAt(first))) {
        first++;
    }
    const closes = text.charCodeAt(first) === 125;
    const depth = open - (closes ? 1 : 0);
    if (depth >= 0) {
        out.push(...edit(text, start, first, '\t'.repeat(depth)));
    }
    return out;
}

/** After `}`: the cursor at `offset`, just after the `}`. */
function afterClose(text: string, offset: number): FormatEdit[] {
    const brace = offset - 1;
    if (text.charCodeAt(brace) !== 125) {
        return [];
    }
    const start = lineStart(text, brace);
    for (let i = start; i < brace; i++) {
        if (!isBlank(text.charCodeAt(i))) {
            return [];
        }
    }
    const open = openBlocksAt(text, start);
    if (open === null || open < 1) {
        return [];
    }
    return edit(text, start, brace, '\t'.repeat(open - 1));
}

/** After `=`: the cursor at `offset`, just after the `=`. */
function afterEquals(text: string, offset: number): FormatEdit[] {
    const start = lineStart(text, offset - 1);
    const end = lineEnd(text, offset);
    // Inside quoted text or a comment, the token holding the `=` is that text or comment.
    const tokens = tokenize(text, 0, end);
    let at = -1;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i] as Token;
        if (token.start <= offset - 1 && offset - 1 < token.end) {
            at = i;
            break;
        }
    }
    const operator = tokens[at];
    if (operator === undefined || operator.kind !== 'operator' || operator.end !== offset) {
        return [];
    }
    const key = tokens[at - 1];
    if (
        key === undefined ||
        key.start < start ||
        (key.kind !== 'word' && key.kind !== 'string' && key.kind !== 'arithmetic')
    ) {
        return [];
    }
    const out = edit(text, key.end, operator.start, ' ');
    const next = tokens[at + 1];
    if (next !== undefined && next.kind !== 'eof' && next.start < end) {
        out.push(...edit(text, operator.end, next.start, ' '));
    }
    return out;
}

/**
 * The edits on-type formatting makes after `typed` was typed in a file of kind `kind`, the
 * cursor now at `offset` of `text` (the text with what was typed, without a byte-order mark).
 * For Enter, `typed` is `\n` whatever line break the editor inserted.
 */
export function onTypeEdits(
    text: string,
    offset: number,
    typed: string,
    kind: FormatKind = 'script',
): FormatEdit[] {
    if (kind !== 'script' || offset < 0 || offset > text.length) {
        return [];
    }
    if (typed === '\n' || typed === '\r\n') {
        return afterEnter(text, offset);
    }
    if (typed === '}') {
        return afterClose(text, offset);
    }
    if (typed === '=') {
        return afterEquals(text, offset);
    }
    return [];
}
