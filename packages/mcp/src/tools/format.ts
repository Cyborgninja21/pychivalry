/**
 * `format`: one file of the mod formatted by pychivalry's rules (docs/formatting.md; docs/PLAN.md
 * item 8.9), returned as a proposal: it writes nothing. The text is the command line's `format`
 * and the editor's Format Document text, paged so that every result fits the budget: each page
 * holds as much of the text as fits, ending at a line break where one fits, and `next_cursor`
 * gives the next. A file with a parse error, or that is not valid UTF-8, is left as it is, with
 * the reason; a file already in the format comes back with no text.
 *
 * `apply_format`: the same formatting written to the file, in place, as the command line's
 * `pychivalry format <file>` writes it: the one tool of the agent server that writes (item 9.8).
 * An AI harness's own file tools cannot be relied on to write what the format needs: Claude Code
 * 2.1.330's `Write` saves the text exactly as the model sends it and its `Edit` keeps a file's
 * own line breaks, so a file the model writes with `\n` breaks stays so; the first scored
 * authoring run left every result out of the format that way (tools/scored-run/README.md). The
 * formatter changes only whitespace, line breaks and the byte-order mark, never a token or a
 * comment (docs/formatting.md), so the write changes nothing the game reads.
 */

import {
    decodeScript,
    fileKindOf,
    folderTableFromSpec,
    formatKindOf,
    formatText,
    GUI_NOT_FORMATTED,
    leftMessage,
    listMod,
    type FormatResult,
} from '@pychivalry/core';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    BadInput,
    encodeCursor,
    questionKey,
    readCursor,
    RESULT_BUDGET,
    sizeOf,
} from '../result.js';
import type { Session } from '../session.js';
import { NEXT_CURSOR, type Tool } from '../tool.js';

export interface FormatArgs {
    readonly file: string;
    readonly cursor?: string;
}

/** What the tool says about the file, beside the page of text. */
interface FileState {
    readonly file: string;
    readonly kind: 'script' | 'localization';
    readonly formatted: boolean;
    readonly changed: boolean;
    readonly reason: string | null;
    readonly bom: boolean;
    readonly line_ending: 'crlf' | 'lf';
    readonly total_lines: number;
}

/** One file of the mod, read and formatted: what `format` and `apply_format` both start from. */
interface Formatted {
    readonly state: FileState;
    /** The formatted text without the byte-order mark; empty when nothing changes or it is left. */
    readonly text: string;
    /** The formatter's result when it formatted the file; null when the file is left as it is. */
    readonly result: FormatResult | null;
    /** The file on disk, absolute. */
    readonly disk: string;
}

/** The file an agent named, formatted: bad input when it is not one the formatter formats. */
function formatOf(file: string, session: Session): Formatted {
    const target = session.modPath(file, 'file');
    if (target.kind !== 'file') {
        throw new BadInput(
            `file: ${file} is a folder; give one script (.txt) or localization (.yml) file inside it`,
        );
    }
    const listed = listMod(session.modDir, folderTableFromSpec(session.spec.data)).files.map(
        (f) => f.path,
    );
    const kind = formatKindOf(target.relative);
    if (fileKindOf(target.relative) === 'gui' && listed.includes(target.relative)) {
        throw new BadInput(
            `file: ${target.relative}: ${GUI_NOT_FORMATTED}; give a script (.txt) or localization (.yml) file`,
        );
    }
    if (kind === undefined || !listed.includes(target.relative)) {
        throw new BadInput(
            `file: ${target.relative} is not a script or localization file the game reads (a .txt file of a folder the spec package lists, or a .yml file under localization/)`,
        );
    }
    const disk = path.join(session.modDir, ...target.relative.split('/'));
    const decoded = decodeScript(readFileSync(disk));
    const source = (decoded.bom ? '\uFEFF' : '') + decoded.text;
    const result = decoded.validUtf8 ? formatText(source, kind) : null;
    const formatted = result?.left === null;
    const changed = formatted && result.changed;
    const text = changed ? result.text.replace(/^\uFEFF/, '') : '';
    let reason: string | null = null;
    if (result === null) {
        reason =
            'left as it is: the file is not valid UTF-8, and its bytes could not be written back as they were';
    } else if (result.left !== null) {
        reason = leftMessage(result.left);
    }
    const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
    return {
        state: {
            file: target.relative,
            kind,
            formatted,
            changed,
            reason,
            bom: formatted ? result.text.startsWith('\uFEFF') : decoded.bom,
            line_ending: (result?.eol ?? '\r\n') === '\n' ? 'lf' : 'crlf',
            total_lines: /(\r\n|\r|\n)$/.test(text) ? lines - 1 : lines,
        },
        text,
        result: formatted ? result : null,
        disk,
    };
}

/** The output of one page. */
function output(
    state: FileState,
    firstLine: number,
    text: string,
    nextCursor: string | null,
): Record<string, unknown> {
    return { ...state, first_line: firstLine, text, next_cursor: nextCursor };
}

/** The most characters of `text` from `from` that fit one page, ending at a line break if one fits. */
function pageEnd(
    text: string,
    from: number,
    build: (slice: string) => Record<string, unknown>,
): number {
    let low = from;
    let high = text.length;
    if (sizeOf(build(text.slice(from))) <= RESULT_BUDGET) {
        return text.length;
    }
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (sizeOf(build(text.slice(from, mid))) <= RESULT_BUDGET) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    const lastBreak = text.lastIndexOf('\n', low - 1);
    const end = lastBreak >= from ? lastBreak + 1 : low;
    if (end <= from) {
        throw new Error('not one character of the text fits a result');
    }
    return end;
}

export const formatTool: Tool<FormatArgs> = {
    name: 'format',
    title: 'Format a file',
    description:
        "One script or localization file of the mod formatted by pychivalry's rules, returned as a proposal: nothing is written. The text is what the editor's Format Document and the command line's format give (tabs, one space between tokens, a block of one simple pair or a list of plain values on one line when it fits in 120 columns, every other block one item a line, Windows line breaks, the UTF-8 byte-order mark). Long files come in pages: follow next_cursor. A file already formatted has changed false and no text; a file with a parse error is left as it is, with the reason. check's style/ findings say where a file is not formatted; apply_format writes the formatted file.",
    input: {
        type: 'object',
        properties: {
            file: {
                type: 'string',
                minLength: 1,
                description:
                    "The file's path inside the mod, with / (events/my_events.txt, localization/english/my_l_english.yml)",
            },
            cursor: {
                type: 'string',
                description:
                    'The next_cursor of the previous result, for the next page of the same file; leave it out for the first page',
            },
        },
        required: ['file'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            file: { type: 'string' },
            kind: { type: 'string', enum: ['script', 'localization'] },
            formatted: {
                type: 'boolean',
                description: 'False when the file is left as it is (reason says why)',
            },
            changed: {
                type: 'boolean',
                description: 'True when the formatted text differs from the file',
            },
            reason: {
                type: ['string', 'null'],
                description:
                    'Why the file is left as it is: a parse error and its place, or not UTF-8',
            },
            bom: {
                type: 'boolean',
                description:
                    'True when the formatted file starts with the UTF-8 byte-order mark, which text does not show',
            },
            line_ending: {
                type: 'string',
                enum: ['crlf', 'lf'],
                description: 'The line break the text uses',
            },
            total_lines: {
                type: 'integer',
                minimum: 0,
                description: 'The lines of the formatted text',
            },
            first_line: {
                type: 'integer',
                minimum: 1,
                description: 'The line of the formatted text this page starts on, counted from 1',
            },
            text: {
                type: 'string',
                description:
                    'This page of the formatted text, without the byte-order mark; empty when nothing changes or the file is left as it is',
            },
            next_cursor: NEXT_CURSOR,
        },
        required: [
            'file',
            'kind',
            'formatted',
            'changed',
            'reason',
            'bom',
            'line_ending',
            'total_lines',
            'first_line',
            'text',
            'next_cursor',
        ],
    },
    run(args: FormatArgs, session: Session): Record<string, unknown> {
        const { state, text } = formatOf(args.file, session);
        const digest = createHash('sha256').update(text).digest('hex').slice(0, 12);
        const key = questionKey('format', { file: state.file, digest });
        const from = readCursor(args.cursor, key);
        if (from > text.length) {
            throw new BadInput(
                'cursor: past the end of the text; leave it out to start from the first page',
            );
        }
        const firstLine = text.slice(0, from).split('\n').length;
        const placeholder = encodeCursor(text.length, key);
        const end = pageEnd(text, from, (slice) => output(state, firstLine, slice, placeholder));
        return output(
            state,
            firstLine,
            text.slice(from, end),
            end < text.length ? encodeCursor(end, key) : null,
        );
    },
};

export interface ApplyFormatArgs {
    readonly file: string;
}

export const applyFormatTool: Tool<ApplyFormatArgs> = {
    name: 'apply_format',
    title: 'Write a file in the format',
    description:
        "Writes one script or localization file of the mod in pychivalry's format, in place: the text format proposes, with Windows line breaks and the UTF-8 byte-order mark, as the command line's `pychivalry format <file>` writes it. The only tool that writes, and only the file named; the formatter changes whitespace, line breaks and the byte-order mark, never a token or a comment. Use it on each file you wrote or changed: a file tool of your own may not write Windows line breaks or the mark. A file already formatted is not written (written false); a file with a parse error or not valid UTF-8 is left as it is, with the reason. Read the file again before editing it further.",
    writes: true,
    input: {
        type: 'object',
        properties: {
            file: {
                type: 'string',
                minLength: 1,
                description:
                    "The file's path inside the mod, with / (events/my_events.txt, localization/english/my_l_english.yml)",
            },
        },
        required: ['file'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            file: { type: 'string' },
            kind: { type: 'string', enum: ['script', 'localization'] },
            written: {
                type: 'boolean',
                description: 'True when the file was written in the format',
            },
            formatted: {
                type: 'boolean',
                description: 'False when the file is left as it is (reason says why)',
            },
            changed: {
                type: 'boolean',
                description: 'True when the formatted text differed from the file',
            },
            reason: {
                type: ['string', 'null'],
                description:
                    'Why the file is left as it is: a parse error and its place, or not UTF-8',
            },
            bom: {
                type: 'boolean',
                description: 'True when the file now starts with the UTF-8 byte-order mark',
            },
            line_ending: {
                type: 'string',
                enum: ['crlf', 'lf'],
                description: 'The line break the file now uses',
            },
            total_lines: {
                type: 'integer',
                minimum: 0,
                description: 'The lines of the file as written; 0 when it was not written',
            },
        },
        required: [
            'file',
            'kind',
            'written',
            'formatted',
            'changed',
            'reason',
            'bom',
            'line_ending',
            'total_lines',
        ],
    },
    run(args: ApplyFormatArgs, session: Session): Record<string, unknown> {
        const { state, result, disk } = formatOf(args.file, session);
        const written = state.changed && result !== null;
        if (written) {
            // The bytes the command line's format writes: the formatted text, its byte-order
            // mark included, in UTF-8 (packages/cli/src/format.ts).
            writeFileSync(disk, result.text);
        }
        return { ...state, written };
    },
};
