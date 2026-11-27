/**
 * A log file read into lines (docs/game-log.md). Nothing about the game's log is assumed but what
 * a text file is: lines end at `\n`, a `\r` before it is the Windows line break, a UTF-8
 * byte-order mark at the start is no text. A line that is not valid UTF-8 is read as
 * Windows-1252, the encoding the game's own `script_docs` logs were found to hold a byte of
 * (`pdx-parser-re`, `research/oracle/1.21.0.3/README.md`), and counted.
 *
 * Whether the game writes one line per message or several is not known before a real log is
 * read: each line is matched on its own, and a template whose text spans several lines is
 * matched over as many (`analyze.ts`).
 */

import { decodeWindows1252 } from '../syntax/decode.js';

/** One line of a log, as read. */
export interface LogLine {
    /** Its number in the file, counted from 1. */
    readonly number: number;
    /** Its text, without the line break. */
    readonly text: string;
    /** True when its bytes are not valid UTF-8 and were read as Windows-1252. */
    readonly notUtf8: boolean;
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function lineText(bytes: Uint8Array): { text: string; notUtf8: boolean } {
    try {
        return { text: utf8.decode(bytes), notUtf8: false };
    } catch {
        return { text: decodeWindows1252(bytes), notUtf8: true };
    }
}

/** The lines of a log's bytes (or text): a last line with no line break counts; a final empty one does not. */
export function logLines(input: Uint8Array | string): LogLine[] {
    const out: LogLine[] = [];
    if (typeof input === 'string') {
        const text = input.startsWith('﻿') ? input.slice(1) : input;
        const lines = text.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        lines.forEach((line, i) => {
            out.push({ number: i + 1, text: line.replace(/\r$/, ''), notUtf8: false });
        });
        return out;
    }
    let start =
        input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf ? 3 : 0;
    let number = 1;
    while (start < input.length) {
        let end = input.indexOf(0x0a, start);
        const next = end < 0 ? input.length : end + 1;
        if (end < 0) {
            end = input.length;
        }
        const stop = end > start && input[end - 1] === 0x0d ? end - 1 : end;
        const { text, notUtf8 } = lineText(input.subarray(start, stop));
        out.push({ number, text, notUtf8 });
        number++;
        start = next;
    }
    return out;
}
