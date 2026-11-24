/**
 * What the parser reads (docs/PLAN.md item 2.1; the policy is docs/encoding.md).
 *
 * A script file is UTF-8, with or without a byte-order mark. The mark is removed and
 * reported; it is never part of the text, so positions never count it. A file that is not
 * valid UTF-8 is still read in full, because the game itself ships and loads such files:
 * each invalid sequence becomes U+FFFD, the replacement character, and the decoder records
 * where each invalid stretch is and how the file was read, which the one finding about such a
 * file, the warning `style/not-utf8`, reports (since 2026-11-23; the information note
 * `encoding/not-utf8` the decoder gave until then is retired). A caller that names a fallback
 * encoding (only Windows-1252 today; off by default) has the invalid bytes of such a file, and
 * only those, decoded with it, so that both those letters and the file's valid UTF-8 letters
 * read correctly.
 */

import type { InvalidStretch, MessageCatalogue } from './findings.js';

/** The encodings a caller can name for files that are not valid UTF-8. */
export type FallbackEncoding = 'windows-1252';

export interface DecodeOptions {
    /** Decode the invalid bytes of a file that is not valid UTF-8 with this encoding. Off by default. */
    readonly fallbackEncoding?: FallbackEncoding | undefined;
    /** The error catalogue, for the parser's findings (decoding gives none). */
    readonly catalogue?: MessageCatalogue | undefined;
}

export interface Decoded {
    /** The text, without the byte-order mark. */
    readonly text: string;
    /** True when the bytes started with the UTF-8 byte-order mark. */
    readonly bom: boolean;
    /** How the bytes were decoded: as UTF-8 alone, or as UTF-8 with the fallback for its invalid bytes. */
    readonly encoding: 'utf-8' | FallbackEncoding;
    /** True when the bytes after the byte-order mark are valid UTF-8. */
    readonly validUtf8: boolean;
    /** Bytes that are not part of a valid UTF-8 sequence; 0 when the bytes are valid. */
    readonly invalidBytes: number;
    /** Each stretch that is not valid UTF-8, where its text is and what it reads as in Windows-1252. */
    readonly invalid: readonly InvalidStretch[];
}

const utf8Strict = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

/**
 * Windows-1252 as the WHATWG Encoding Standard defines it: Latin-1, except 0x80 to 0x9F,
 * where it has these characters. The five bytes Windows-1252 leaves undefined (0x81, 0x8D,
 * 0x8F, 0x90, 0x9D) map to the control character of the same number, as in that standard.
 */
const WINDOWS_1252_HIGH = [
    0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
    0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

/** Decode bytes as Windows-1252: one UTF-16 code unit per byte. */
export function decodeWindows1252(bytes: Uint8Array): string {
    const units = new Uint16Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i] ?? 0;
        units[i] = byte >= 0x80 && byte <= 0x9f ? (WINDOWS_1252_HIGH[byte - 0x80] ?? byte) : byte;
    }
    let text = '';
    const chunk = 8192;
    for (let i = 0; i < units.length; i += chunk) {
        text += String.fromCharCode(...units.subarray(i, i + chunk));
    }
    return text;
}

/** The invalid stretches of some bytes as UTF-8: their count and where the first starts. */
interface Invalid {
    bytes: number;
    first: number;
}

/** One invalid stretch: from byte `start` up to, not including, byte `end`. */
export interface InvalidRange {
    readonly start: number;
    readonly end: number;
}

/**
 * Find the bytes that are not part of a valid UTF-8 sequence, using the rules of the WHATWG
 * Encoding Standard (the ones `TextDecoder` follows): a lead byte with the wrong
 * continuation bytes after it is invalid together with the continuation bytes it did get.
 */
export function invalidUtf8(bytes: Uint8Array): Invalid {
    const ranges = invalidUtf8Ranges(bytes);
    return {
        bytes: ranges.reduce((sum, range) => sum + (range.end - range.start), 0),
        first: ranges[0]?.start ?? -1,
    };
}

/** Each invalid stretch of some bytes as UTF-8, in order, by the same rules as `invalidUtf8`. */
export function invalidUtf8Ranges(bytes: Uint8Array): InvalidRange[] {
    const ranges: InvalidRange[] = [];
    let i = 0;
    while (i < bytes.length) {
        const byte = bytes[i] ?? 0;
        if (byte < 0x80) {
            i++;
            continue;
        }
        let need = 0;
        let lower = 0x80;
        let upper = 0xbf;
        if (byte >= 0xc2 && byte <= 0xdf) {
            need = 1;
        } else if (byte >= 0xe0 && byte <= 0xef) {
            need = 2;
            if (byte === 0xe0) {
                lower = 0xa0;
            } else if (byte === 0xed) {
                upper = 0x9f;
            }
        } else if (byte >= 0xf0 && byte <= 0xf4) {
            need = 3;
            if (byte === 0xf0) {
                lower = 0x90;
            } else if (byte === 0xf4) {
                upper = 0x8f;
            }
        }
        if (need === 0) {
            ranges.push({ start: i, end: i + 1 });
            i++;
            continue;
        }
        let seen = 0;
        let j = i + 1;
        while (seen < need && j < bytes.length) {
            const next = bytes[j] ?? 0;
            if (next < lower || next > upper) {
                break;
            }
            lower = 0x80;
            upper = 0xbf;
            seen++;
            j++;
        }
        if (seen === need) {
            i = j;
            continue;
        }
        ranges.push({ start: i, end: j });
        i = j;
    }
    return ranges;
}

/** Decode a script file's bytes (docs/encoding.md). */
export function decodeScript(bytes: Uint8Array, options: DecodeOptions = {}): Decoded {
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const body = bom ? bytes.subarray(3) : bytes;
    try {
        const text = utf8Strict.decode(body);
        return {
            text,
            bom,
            encoding: 'utf-8',
            validUtf8: true,
            invalidBytes: 0,
            invalid: [],
        };
    } catch {
        // Not valid UTF-8: read it anyway, below.
    }
    const ranges = invalidUtf8Ranges(body);
    const fallback = options.fallbackEncoding;
    // Valid UTF-8 stays UTF-8; each invalid stretch becomes one U+FFFD, or, with the fallback,
    // its bytes read as Windows-1252. Built stretch by stretch, so where each stretch's text is
    // is known; read as UTF-8 the result is what `TextDecoder` gives (a test holds the two).
    let text = '';
    let from = 0;
    const invalidStretches: InvalidStretch[] = [];
    for (const range of ranges) {
        text += utf8Strict.decode(body.subarray(from, range.start));
        const windows1252 = decodeWindows1252(body.subarray(range.start, range.end));
        const start = text.length;
        text += fallback === 'windows-1252' ? windows1252 : '\ufffd';
        invalidStretches.push({ start, end: text.length, windows1252 });
        from = range.end;
    }
    text += utf8Strict.decode(body.subarray(from));
    return {
        text,
        bom,
        encoding: fallback ?? 'utf-8',
        validUtf8: false,
        invalidBytes: ranges.reduce((sum, range) => sum + (range.end - range.start), 0),
        invalid: invalidStretches,
    };
}

/** How a file not valid UTF-8 was read, in words: what the warning `style/not-utf8` says. */
export function readingOf(encoding: 'utf-8' | FallbackEncoding): string {
    return encoding === 'utf-8'
        ? 'UTF-8 with replacement characters'
        : 'UTF-8, with its invalid bytes read as Windows-1252';
}
