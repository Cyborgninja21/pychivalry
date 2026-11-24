/**
 * The formatter of localization files (docs/formatting.md, rule 13): whitespace only, never the
 * text. A localization file has no tree; it is read line by line by the index's reader
 * (`parseLocalization`), and each line is formatted as what the reader reads it as:
 *
 * - **an entry** (`key:0 "text"`) is indented with one space, with one space between its key
 *   and version and the opening quote; from the quote on, the line is kept as written but for
 *   the spaces and tabs at its end. An entry whose closing quote is missing is kept as written;
 * - **a header** (`l_english:`) keeps its line, but for the spaces and tabs at its end;
 * - **a comment on a line of its own** is indented with one space, its text kept;
 * - **a blank line** holds nothing; a run of them keeps at most the blank lines the rules keep,
 *   and none is left at the start or at the end of the file;
 * - **any other line** is kept exactly as written.
 *
 * The line break and the byte-order mark are the rules' (`rules.ts`), and the file ends with
 * exactly one line break.
 */

import { parseLocalization } from '../index/localization.js';
import { lineEndingOf, type FormatEdit, type FormatResult } from './result.js';
import { DEFAULT_RULES, type LayoutRules } from './rules.js';

/** One line of the text given, and what it becomes. */
export interface LocalizationLine {
    /** Where the line starts, where its content ends, and where its line break ends. */
    readonly start: number;
    readonly contentEnd: number;
    readonly end: number;
    /** What the reader reads it as; `kept` for a line kept exactly as written. */
    readonly kind: 'blank' | 'comment' | 'header' | 'entry' | 'kept';
    /** What the line holds once formatted, or null for a blank line. */
    readonly content: string | null;
    /** Where its indentation ends, and the indentation it gets. */
    readonly indentEnd: number;
    readonly indent: string;
    /** An entry's gap between its key and version and the opening quote, as written. */
    readonly gapStart: number;
    readonly gapEnd: number;
    /** Where the spaces and tabs at the end of the line start (`contentEnd` when none). */
    readonly trailingStart: number;
}

/** The spaces and tabs at the end of a line, removed. */
function trimEnd(text: string): string {
    return text.replace(/[ \t]+$/, '');
}

/** Each line of a localization file's text, and what the formatter makes of it. */
export function readLines(body: string): LocalizationLine[] {
    const file = parseLocalization(body);
    const entries = new Map(file.entries.map((e) => [file.lines.positionAt(e.start).line, e]));
    const headers = new Set(file.headers.map((h) => file.lines.positionAt(h.start).line));
    const out: LocalizationLine[] = [];
    const starts = file.lines.lineStarts;
    for (let n = 0; n < starts.length; n++) {
        const start = starts[n] ?? 0;
        const end = starts[n + 1] ?? body.length;
        let contentEnd = end;
        while (
            contentEnd > start &&
            (body.charCodeAt(contentEnd - 1) === 10 || body.charCodeAt(contentEnd - 1) === 13)
        ) {
            contentEnd--;
        }
        const line = body.slice(start, contentEnd);
        const trimmed = line.trim();
        const indentEnd = start + (line.length - line.replace(/^\s+/, '').length);
        const trailingStart = start + trimEnd(line).length;
        const base = { start, contentEnd, end, indentEnd, gapStart: 0, gapEnd: 0 };
        if (trimmed === '') {
            out.push({ ...base, kind: 'blank', content: null, indent: '', trailingStart: start });
        } else if (trimmed.startsWith('#')) {
            const indent = ' ';
            const content = indent + body.slice(indentEnd, trailingStart);
            out.push({ ...base, kind: 'comment', content, indent, trailingStart });
        } else if (headers.has(n)) {
            const content = body.slice(start, trailingStart);
            out.push({ ...base, kind: 'header', content, indent: '', trailingStart });
        } else {
            const entry = entries.get(n);
            if (entry === undefined || !entry.terminated) {
                out.push({
                    ...base,
                    kind: 'kept',
                    content: line,
                    indent: body.slice(start, indentEnd),
                    trailingStart: contentEnd,
                });
                continue;
            }
            const quote = entry.textStart - 1;
            let gapStart = quote;
            while (
                gapStart > entry.end &&
                (body[gapStart - 1] === ' ' || body[gapStart - 1] === '\t')
            ) {
                gapStart--;
            }
            const indent = ' ';
            const content = `${indent}${body.slice(entry.start, gapStart)} ${body.slice(quote, trailingStart)}`;
            out.push({
                ...base,
                kind: 'entry',
                content,
                indent,
                gapStart,
                gapEnd: quote,
                trailingStart,
            });
        }
    }
    return out;
}

/** What the lines become, in order, and the edits that make it, with the line of each. */
export interface LocalizationLayout {
    readonly result: FormatResult;
    readonly body: string;
    readonly placed: readonly (FormatEdit & { readonly line: number })[];
    readonly lines: readonly LocalizationLine[];
    /** The lines that are kept: blank lines beyond the rules' count, or at an end, are not. */
    readonly keptBlank: ReadonlySet<number>;
    readonly eol: '\r\n' | '\n';
}

/** Lay a localization file's text out. `source` may start with the byte-order mark. */
export function layoutLocalization(
    source: string,
    rules: LayoutRules = DEFAULT_RULES,
): LocalizationLayout {
    const bom = source.charCodeAt(0) === 0xfeff;
    const shift = bom ? 1 : 0;
    const body = bom ? source.slice(1) : source;
    const eol = rules.lineEnding === 'majority' ? lineEndingOf(body) : rules.lineEnding;
    const lines = readLines(body);
    const first = lines.findIndex((l) => l.content !== null);
    let last = -1;
    for (let n = lines.length - 1; n >= 0; n--) {
        if (lines[n]?.content !== null) {
            last = n;
            break;
        }
    }
    const placed: (FormatEdit & { line: number })[] = [];
    const keptBlank = new Set<number>();
    const parts: string[] = [];
    const keep = (n: number, line: LocalizationLine, text: string): void => {
        parts.push(text);
        if (line.end - line.start !== text.length || body.slice(line.start, line.end) !== text) {
            placed.push({ start: line.start, end: line.end, text, line: n });
        }
    };
    let blanksBefore = 0;
    lines.forEach((line, n) => {
        if (line.content === null) {
            // Blank lines are kept, emptied, only between two lines, as many as the rules keep.
            const kept = first >= 0 && n > first && n < last && blanksBefore < rules.blankLines;
            blanksBefore++;
            if (kept) {
                keptBlank.add(n);
            }
            keep(n, line, kept ? eol : '');
            return;
        }
        blanksBefore = 0;
        keep(n, line, line.content + eol);
    });
    // A file with no line left is formatted empty, its mark as it was.
    const outBom = rules.bom === 'keep' || first < 0 ? bom : rules.bom === 'write';
    const text = (outBom ? '\uFEFF' : '') + parts.join('');
    return {
        result: {
            kind: 'localization',
            text,
            changed: text !== source,
            left: null,
            edits: [
                ...(outBom === bom ? [] : [{ start: 0, end: shift, text: outBom ? '\uFEFF' : '' }]),
                ...placed.map((e) => ({
                    start: e.start + shift,
                    end: e.end + shift,
                    text: e.text,
                })),
            ],
            eol,
            split: 0,
        },
        body,
        placed,
        lines,
        keptBlank,
        eol,
    };
}

/** Format a localization file's text (docs/formatting.md, rule 13). */
export function formatLocalization(
    source: string,
    rules: LayoutRules = DEFAULT_RULES,
): FormatResult {
    return layoutLocalization(source, rules).result;
}
