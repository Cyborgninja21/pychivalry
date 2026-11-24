/**
 * `format`: one file of the mod formatted by pychivalry's rules (docs/formatting.md; docs/PLAN.md
 * item 8.9), returned as a proposal: the agent server writes nothing. The text is the command
 * line's `format` and the editor's Format Document text, paged so that every result fits the
 * budget: each page holds as much of the text as fits, ending at a line break where one fits,
 * and `next_cursor` gives the next. A file with a parse error, or that is not valid UTF-8, is
 * left as it is, with the reason; a file already in the format comes back with no text.
 */

import {
    decodeScript,
    folderTableFromSpec,
    formatKindOf,
    formatText,
    leftMessage,
    listMod,
} from '@pychivalry/core';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
        "One script or localization file of the mod formatted by pychivalry's rules, returned as a proposal: nothing is written. The text is what the editor's Format Document and the command line's format give (tabs, one space between tokens, a block of one simple pair or a list of plain values on one line when it fits in 120 columns, every other block one item a line, Windows line breaks, the UTF-8 byte-order mark). Long files come in pages: follow next_cursor. A file already formatted has changed false and no text; a file with a parse error is left as it is, with the reason. check's style/ findings say where a file is not formatted.",
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
        const target = session.modPath(args.file, 'file');
        if (target.kind !== 'file') {
            throw new BadInput(
                `file: ${args.file} is a folder; give one script (.txt) or localization (.yml) file inside it`,
            );
        }
        const listed = listMod(session.modDir, folderTableFromSpec(session.spec.data)).files.map(
            (f) => f.path,
        );
        const kind = formatKindOf(target.relative);
        if (kind === undefined || !listed.includes(target.relative)) {
            throw new BadInput(
                `file: ${target.relative} is not a script or localization file the game reads (a .txt file of a folder the spec package lists, or a .yml file under localization/)`,
            );
        }
        const bytes = readFileSync(path.join(session.modDir, ...target.relative.split('/')));
        const decoded = decodeScript(bytes);
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
        const state: FileState = {
            file: target.relative,
            kind,
            formatted,
            changed,
            reason,
            bom: formatted ? result.text.startsWith('\uFEFF') : decoded.bom,
            line_ending: (result?.eol ?? '\r\n') === '\n' ? 'lf' : 'crlf',
            total_lines: /(\r\n|\r|\n)$/.test(text) ? lines - 1 : lines,
        };
        const digest = createHash('sha256').update(text).digest('hex').slice(0, 12);
        const key = questionKey('format', { file: target.relative, digest });
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
