/**
 * Localization files as index data (docs/PLAN.md item 3.9). A localization file is UTF-8,
 * usually with the byte-order mark, which is removed and never counted in a position
 * (docs/encoding.md). It starts with a header line naming its language, `l_english:`, and
 * then holds one entry per line: a key, a colon, an optional version number, and the text in
 * double quotes, `key:0 "text"` or `key: "text"`. `#` starts a comment, except inside the text.
 * A second header in the same file starts entries of another language.
 *
 * The reader knows the file's shape and no names: the language is whatever the header says.
 * Inside an entry's text, `$name$` substitutes another entry or a value, and each is recorded
 * as a use of the name before any `|`.
 */

import { decodeScript, type DecodeOptions } from '../syntax/decode.js';
import { LineIndex } from '../syntax/position.js';

/** One entry: `key:version "text"`. Offsets are into the decoded text, without the mark. */
export interface LocalizationEntry {
    readonly key: string;
    readonly start: number;
    readonly end: number;
    /** The version number, or null when the entry has none (`key: "text"`). */
    readonly version: number | null;
    /** The language of the header above it, or null when no header comes before it. */
    readonly language: string | null;
    /** Where the text starts and ends, inside the quotes. */
    readonly textStart: number;
    readonly textEnd: number;
    /** False when the text has no closing quote on its line. */
    readonly terminated: boolean;
    /** Where the entry's line ends: the end of what it covers. */
    readonly lineEnd: number;
}

/** A `$name$` inside an entry's text. */
export interface LocalizationUse {
    readonly name: string;
    readonly start: number;
}

/** A header line: `l_english:`. */
export interface LocalizationHeader {
    readonly language: string;
    readonly start: number;
    readonly end: number;
}

export interface LocalizationFile {
    readonly text: string;
    readonly bom: boolean;
    readonly validUtf8: boolean;
    readonly lines: LineIndex;
    readonly headers: readonly LocalizationHeader[];
    readonly entries: readonly LocalizationEntry[];
    readonly uses: readonly LocalizationUse[];
    /** Lines that are none of a header, an entry, a comment or blank: their start offsets. */
    readonly unread: readonly number[];
}

const HEADER = /^([^\s:#"]+):[ \t]*(?:#.*)?$/;
const ENTRY = /^([ \t]*)([^\s:#"]+):([0-9]*)[ \t]*"/;
const USE_NAME = /^[^\s$|]+$/;

/** The `$name$` uses in an entry's text, which starts at `offset` in the file. */
function usesIn(text: string, offset: number, out: LocalizationUse[]): void {
    let at = text.indexOf('$');
    while (at >= 0) {
        const close = text.indexOf('$', at + 1);
        if (close < 0) {
            return;
        }
        const inner = text.slice(at + 1, close);
        const bar = inner.indexOf('|');
        const name = bar < 0 ? inner : inner.slice(0, bar);
        if (name !== '' && USE_NAME.test(name)) {
            out.push({ name, start: offset + at + 1 });
            at = text.indexOf('$', close + 1);
        } else if (inner === '') {
            // `$$`, an escaped dollar sign.
            at = text.indexOf('$', close + 1);
        } else {
            at = close;
        }
    }
}

/** Read a localization file's text: its headers, entries and the uses inside them. */
export function parseLocalization(source: string): LocalizationFile {
    const bom = source.charCodeAt(0) === 0xfeff;
    const text = bom ? source.slice(1) : source;
    const lines = new LineIndex(text);
    const headers: LocalizationHeader[] = [];
    const entries: LocalizationEntry[] = [];
    const uses: LocalizationUse[] = [];
    const unread: number[] = [];
    let language: string | null = null;
    for (let n = 0; n < lines.lineCount; n++) {
        const start = lines.lineStarts[n] ?? 0;
        const next = lines.lineStarts[n + 1];
        let end = next ?? text.length;
        while (
            end > start &&
            (text.charCodeAt(end - 1) === 10 || text.charCodeAt(end - 1) === 13)
        ) {
            end--;
        }
        const line = text.slice(start, end);
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) {
            continue;
        }
        const header = HEADER.exec(line);
        if (header !== null) {
            language = header[1] ?? '';
            headers.push({ language, start, end: start + language.length });
            continue;
        }
        const entry = ENTRY.exec(line);
        if (entry === null) {
            unread.push(start);
            continue;
        }
        const indent = entry[1] ?? '';
        const key = entry[2] ?? '';
        const digits = entry[3] ?? '';
        const keyStart = start + indent.length;
        const open = start + entry[0].length - 1;
        // The text runs to the last quote on the line after which nothing but a comment
        // follows, so quotes and `#` inside the text stay in it: game 1.21.0.3 writes 776
        // entries whose text holds a quote followed by `#` (`"#emp \"No realm ...\"#!"`).
        let close = -1;
        for (let i = end - 1; i > open; i--) {
            if (text.charCodeAt(i) === 34) {
                const rest = text.slice(i + 1, end).trim();
                if (rest === '' || rest.startsWith('#')) {
                    close = i;
                    break;
                }
            }
        }
        const terminated = close >= 0;
        const textEnd = terminated ? close : end;
        entries.push({
            key,
            start: keyStart,
            end: keyStart + key.length,
            version: digits === '' ? null : Number(digits),
            language,
            textStart: open + 1,
            textEnd,
            terminated,
            lineEnd: end,
        });
        usesIn(text.slice(open + 1, textEnd), open + 1, uses);
    }
    return { text, bom, validUtf8: true, lines, headers, entries, uses, unread };
}

/** Decode a localization file's bytes (docs/encoding.md) and read it. */
export function readLocalization(bytes: Uint8Array, options: DecodeOptions = {}): LocalizationFile {
    const decoded = decodeScript(bytes, options);
    const file = parseLocalization(decoded.text);
    return { ...file, bom: decoded.bom, validUtf8: decoded.validUtf8 };
}
