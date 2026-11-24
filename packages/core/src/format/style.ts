/**
 * The places a file is not in pychivalry's format, as findings (docs/formatting.md, "Style
 * findings"; docs/checks.md, the `style/` family). Every edit the formatter would make is
 * given to exactly one rule's hint, with a safe fix for that place, and a file with any of them
 * gets one warning, `style/not-formatted`, whose safe fix formats the whole file:
 *
 * - `style/indentation`: a line's indentation (script: one tab per enclosing block;
 *   localization: one space before an entry or a comment);
 * - `style/spacing`: the space between two tokens on a line (around an operator, inside the
 *   braces of a block on one line, between values; in localization, between an entry's key and
 *   its text);
 * - `style/comment-spacing`: the one space before a comment at the end of a line;
 * - `style/trailing-whitespace`: spaces and tabs at the end of a line, or on a blank line;
 * - `style/blank-lines`: blank lines beyond one, after `{`, before `}`, or at either end;
 * - `style/block-layout`: a block that goes on one line or over several, one item a line (and a
 *   pair whose key, operator and value go on one line), one hint per block;
 * - `style/line-endings`: line breaks of another kind than the rules', or none at the end of the
 *   file, one hint per file;
 * - `style/byte-order-mark`: the byte-order mark missing (or present where the rules have none),
 *   one hint per file.
 *
 * A file the formatter leaves as it is (a parse error) has none. Offsets are into the text
 * without the byte-order mark; the mark is added by an insertion of U+FEFF at the start, which a
 * file's writer turns into the mark.
 */

import { layoutLocalization } from './localization.js';
import type { FormatEdit, FormatKind } from './result.js';
import { DEFAULT_RULES, type LayoutRules } from './rules.js';
import { layoutScript, type PlacedEdit } from './script.js';
import type { ParseResult } from '../syntax/parser.js';

/** The codes of the formatting findings. */
export type StyleCode =
    | 'style/not-formatted'
    | 'style/indentation'
    | 'style/spacing'
    | 'style/comment-spacing'
    | 'style/trailing-whitespace'
    | 'style/blank-lines'
    | 'style/block-layout'
    | 'style/line-endings'
    | 'style/byte-order-mark';

/** One place a file is not formatted, with the fix for it. */
export interface StylePlace {
    readonly code: StyleCode;
    readonly start: number;
    readonly end: number;
    /** The values of the code's message, in order. */
    readonly args: readonly string[];
    /** The fix's title. */
    readonly title: string;
    /** The fix's edits, in order, none overlapping. */
    readonly edits: readonly FormatEdit[];
}

/** The fix titles, by code. */
export const STYLE_TITLES: Readonly<Record<StyleCode, string>> = {
    'style/not-formatted': 'Format the file',
    'style/indentation': 'Indent the line',
    'style/spacing': 'Space the tokens',
    'style/comment-spacing': 'Put one space before the comment',
    'style/trailing-whitespace': 'Remove the spaces and tabs at the end of the line',
    'style/blank-lines': 'Remove the extra blank lines',
    'style/block-layout': 'Lay the block out',
    'style/line-endings': 'Use the line breaks of the format',
    'style/byte-order-mark': 'Add the byte-order mark',
};

/** The order the warning's summary counts the hints in. */
const HINT_ORDER: readonly StyleCode[] = [
    'style/indentation',
    'style/spacing',
    'style/comment-spacing',
    'style/trailing-whitespace',
    'style/blank-lines',
    'style/block-layout',
    'style/line-endings',
    'style/byte-order-mark',
];

const HINT_NAMES: Readonly<Partial<Record<StyleCode, string>>> = {
    'style/indentation': 'indentation',
    'style/spacing': 'spacing',
    'style/comment-spacing': 'comment spacing',
    'style/trailing-whitespace': 'trailing whitespace',
    'style/blank-lines': 'blank lines',
    'style/block-layout': 'layout',
    'style/line-endings': 'line breaks',
    'style/byte-order-mark': 'byte-order mark',
};

/** How an indentation is described in a message. */
function indentation(text: string): string {
    if (text === '') {
        return 'no indentation';
    }
    if (/^\t+$/.test(text)) {
        return text.length === 1 ? 'one tab' : `${String(text.length)} tabs`;
    }
    return text === ' ' ? 'one space' : `${String(text.length)} spaces`;
}

/** A line break written so a person can read it. */
function breakName(eol: string): string {
    return eol === '\r\n' ? '\\r\\n' : '\\n';
}

/** `1 blank line`, `3 blank lines`; `none` for none. */
function blankText(count: number): string {
    return count === 0 ? 'none' : count === 1 ? '1 blank line' : `${String(count)} blank lines`;
}

/** `1 line break is` or `n line breaks are`. */
function breaksText(count: number): string {
    return count === 1 ? '1 line break is' : `${String(count)} line breaks are`;
}

/** A text for a message: at most 60 characters, on one line. */
function shortened(text: string): string {
    const flat = text.replace(/\r\n|\r|\n/g, ' ');
    return flat.length <= 60 ? flat : `${flat.slice(0, 57)}...`;
}

/** The places, with the warning for the file first when there is any. */
function withWarning(places: StylePlace[], whole: readonly FormatEdit[]): StylePlace[] {
    if (places.length === 0) {
        return [];
    }
    const counts = new Map<StyleCode, number>();
    for (const p of places) {
        counts.set(p.code, (counts.get(p.code) ?? 0) + 1);
    }
    const summary = HINT_ORDER.filter((c) => counts.has(c))
        .map((c) => `${HINT_NAMES[c] ?? c} ${String(counts.get(c))}`)
        .join(', ');
    const first = places.reduce((a, b) => (b.start < a.start ? b : a));
    return [
        {
            code: 'style/not-formatted',
            start: first.start,
            end: first.end,
            args: [
                `${String(places.length)} ${places.length === 1 ? 'place' : 'places'} (${summary})`,
            ],
            title: STYLE_TITLES['style/not-formatted'],
            edits: whole,
        },
        ...places,
    ];
}

/** True when the file's mark is not what the rules ask for. */
function wrongMark(rules: LayoutRules, bom: boolean): boolean {
    return rules.bom === 'write' ? !bom : rules.bom === 'omit' ? bom : false;
}

/** The byte-order mark's hint and edit, when the rules ask for another mark. */
function markPlace(rules: LayoutRules, bom: boolean): StylePlace | null {
    if (!wrongMark(rules, bom)) {
        return null;
    }
    // Removing a mark is not an edit of the text without it: only adding is offered.
    return {
        code: 'style/byte-order-mark',
        start: 0,
        end: 0,
        args: [],
        title: STYLE_TITLES['style/byte-order-mark'],
        edits: bom ? [] : [{ start: 0, end: 0, text: '\uFEFF' }],
    };
}

/**
 * The style findings of a script file: `body` is its text without the byte-order mark, `bom`
 * whether the file has the mark; `parsed`, the parse of `body` when the caller has it.
 */
export function scriptStyle(
    body: string,
    bom: boolean,
    options: { readonly rules?: LayoutRules; readonly parsed?: ParseResult } = {},
): StylePlace[] {
    const rules = options.rules ?? DEFAULT_RULES;
    const layout = layoutScript(body, {
        rules: { ...rules, bom: 'keep' },
        ...(options.parsed === undefined ? {} : { parsed: options.parsed }),
    });
    if (layout.result.left !== null) {
        return [];
    }
    // An empty file stays empty: nothing to mark.
    const mark = layout.result.text === '' ? null : markPlace(rules, bom);
    if (!layout.result.changed && mark === null) {
        return [];
    }
    const eol = layout.result.eol;
    const places: StylePlace[] = [];
    const add = (
        code: StyleCode,
        start: number,
        end: number,
        edits: readonly FormatEdit[],
        args: readonly string[] = [],
    ): void => {
        places.push({ code, start, end, args, title: STYLE_TITLES[code], edits });
    };
    const trailing = (start: number, end: number): void => {
        if (end > start) {
            add('style/trailing-whitespace', start, end, [{ start, end, text: '' }]);
        }
    };
    const indent = (start: number, end: number, text: string, around: number): void => {
        if (body.slice(start, end) !== text) {
            add(
                'style/indentation',
                start,
                Math.max(end, around),
                [{ start, end, text }],
                [indentation(text)],
            );
        }
    };
    const groups = new Map<number, PlacedEdit[]>();
    for (const e of layout.placed) {
        if (e.where === 'comment') {
            trailing(e.start, e.end);
            continue;
        }
        if (e.where === 'start') {
            if (e.breaksBefore > 0) {
                add(
                    'style/blank-lines',
                    e.start,
                    e.afterLastBreak,
                    [{ start: e.start, end: e.afterLastBreak, text: '' }],
                    [blankText(e.breaksBefore), 'none'],
                );
            }
            indent(e.breaksBefore > 0 ? e.afterLastBreak : e.start, e.end, '', e.aroundEnd);
            continue;
        }
        if (e.where === 'end') {
            trailing(e.start, e.firstBreak);
            if (e.breaksBefore >= 2) {
                add(
                    'style/blank-lines',
                    e.firstBreak,
                    e.end,
                    [{ start: e.firstBreak, end: e.end, text: eol }],
                    [blankText(e.breaksBefore - 1), 'none'],
                );
            }
            continue;
        }
        if ((e.breaksBefore === 0) !== (e.breaksAfter === 0)) {
            if (e.inPair) {
                // A pair written over lines: its key, operator and value go on one line.
                add(
                    'style/block-layout',
                    e.aroundStart,
                    e.aroundEnd,
                    [{ start: e.start, end: e.end, text: e.text }],
                    ["a pair's key, operator and value go on one line"],
                );
                continue;
            }
            const key = e.block >= 0 ? e.block : -2 - e.start;
            groups.set(key, [...(groups.get(key) ?? []), e]);
            continue;
        }
        if (e.breaksBefore === 0) {
            const before = body.slice(e.aroundStart, e.start);
            const after = body.slice(e.end, e.aroundEnd);
            if (e.beforeComment) {
                add('style/comment-spacing', e.start, e.end + 1, [
                    { start: e.start, end: e.end, text: e.text },
                ]);
            } else {
                add(
                    'style/spacing',
                    e.aroundStart,
                    e.aroundEnd,
                    [{ start: e.start, end: e.end, text: e.text }],
                    [shortened(before + e.text + after)],
                );
            }
            continue;
        }
        trailing(e.start, e.firstBreak);
        const middle = body.slice(e.firstBreak, e.afterLastBreak);
        const target = eol.repeat(e.breaksAfter);
        if (e.breaksBefore > e.breaksAfter) {
            add(
                'style/blank-lines',
                e.firstBreak,
                e.afterLastBreak,
                [{ start: e.firstBreak, end: e.afterLastBreak, text: target }],
                [blankText(e.breaksBefore - 1), blankText(e.breaksAfter - 1)],
            );
        } else if (/[^\r\n]/.test(middle)) {
            add('style/trailing-whitespace', e.firstBreak, e.afterLastBreak, [
                { start: e.firstBreak, end: e.afterLastBreak, text: target },
            ]);
        }
        indent(e.afterLastBreak, e.end, e.indent ?? '', e.aroundEnd);
    }
    for (const [key, edits] of groups) {
        const first = edits[0] as PlacedEdit;
        const flat = key >= 0 && layout.flatBlocks.has(key);
        const what =
            key < 0
                ? 'each item at the top level starts a line of its own'
                : flat
                  ? 'this block goes on one line'
                  : 'this block goes over several lines, one item a line';
        const start = key >= 0 ? key : first.start;
        add(
            'style/block-layout',
            start,
            key >= 0 ? key + 1 : first.aroundEnd,
            edits.map((e) => ({
                start: e.start,
                end: e.end,
                text: e.text,
            })),
            [what],
        );
    }
    if (layout.wrongBreaks.length > 0 || layout.noFinalBreak) {
        const at = layout.wrongBreaks[0];
        const edits: FormatEdit[] = layout.wrongBreaks.map((b) => ({ ...b, text: eol }));
        if (layout.noFinalBreak) {
            edits.push({ start: body.length, end: body.length, text: eol });
        }
        const what: string[] = [];
        if (layout.wrongBreaks.length > 0) {
            what.push(`${breaksText(layout.wrongBreaks.length)} not ${breakName(eol)}`);
        }
        if (layout.noFinalBreak) {
            what.push('the file does not end with a line break');
        }
        add('style/line-endings', at?.start ?? body.length, at?.end ?? body.length, edits, [
            what.join('; '),
        ]);
    }
    if (mark !== null) {
        places.push(mark);
    }
    const whole = [...(mark?.edits ?? []), ...layout.result.edits];
    return withWarning(sortPlaces(places), whole);
}

/** Places in the order of where each starts. */
function sortPlaces(places: StylePlace[]): StylePlace[] {
    return places.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The style findings of a localization file: `body` without the mark, `bom` the file's. */
export function localizationStyle(
    body: string,
    bom: boolean,
    rules: LayoutRules = DEFAULT_RULES,
): StylePlace[] {
    const layout = layoutLocalization(body, { ...rules, bom: 'keep' });
    const mark = layout.result.text === '' ? null : markPlace(rules, bom);
    if (!layout.result.changed && mark === null) {
        return [];
    }
    const eol = layout.eol;
    const places: StylePlace[] = [];
    const add = (
        code: StyleCode,
        start: number,
        end: number,
        edits: readonly FormatEdit[],
        args: readonly string[] = [],
    ): void => {
        places.push({ code, start, end, args, title: STYLE_TITLES[code], edits });
    };
    const wrong: FormatEdit[] = [];
    let blankRun: { start: number; end: number; count: number } | null = null;
    const endRun = (): void => {
        if (blankRun !== null) {
            add(
                'style/blank-lines',
                blankRun.start,
                blankRun.end,
                [{ start: blankRun.start, end: blankRun.end, text: '' }],
                [blankText(blankRun.count), 'none'],
            );
            blankRun = null;
        }
    };
    let lastContent = -1;
    layout.lines.forEach((line, n) => {
        const lineBreak = body.slice(line.contentEnd, line.end);
        if (lineBreak !== '' && lineBreak !== eol) {
            wrong.push({ start: line.contentEnd, end: line.end, text: eol });
        }
        if (line.kind === 'blank') {
            if (layout.keptBlank.has(n)) {
                endRun();
                if (line.contentEnd > line.start) {
                    add('style/trailing-whitespace', line.start, line.contentEnd, [
                        { start: line.start, end: line.contentEnd, text: '' },
                    ]);
                }
            } else if (line.end > line.start) {
                blankRun ??= { start: line.start, end: line.end, count: 0 };
                blankRun.end = line.end;
                blankRun.count++;
            }
            return;
        }
        endRun();
        lastContent = n;
        if (line.kind === 'kept') {
            return;
        }
        if (line.kind !== 'header' && body.slice(line.start, line.indentEnd) !== line.indent) {
            add(
                'style/indentation',
                line.start,
                line.indentEnd,
                [{ start: line.start, end: line.indentEnd, text: line.indent }],
                [indentation(line.indent)],
            );
        }
        if (line.kind === 'entry' && body.slice(line.gapStart, line.gapEnd) !== ' ') {
            add(
                'style/spacing',
                line.gapStart,
                line.gapEnd + 1,
                [{ start: line.gapStart, end: line.gapEnd, text: ' ' }],
                [shortened(body.slice(line.indentEnd, line.gapStart) + ' "')],
            );
        }
        if (line.contentEnd > line.trailingStart) {
            add('style/trailing-whitespace', line.trailingStart, line.contentEnd, [
                { start: line.trailingStart, end: line.contentEnd, text: '' },
            ]);
        }
    });
    endRun();
    const last = layout.lines[lastContent];
    const noFinalBreak = last !== undefined && last.end === last.contentEnd;
    if (wrong.length > 0 || noFinalBreak) {
        const edits = [...wrong];
        if (noFinalBreak) {
            edits.push({ start: last.contentEnd, end: last.contentEnd, text: eol });
        }
        const what: string[] = [];
        if (wrong.length > 0) {
            what.push(`${breaksText(wrong.length)} not ${breakName(eol)}`);
        }
        if (noFinalBreak) {
            what.push('the file does not end with a line break');
        }
        const at = edits[0] as FormatEdit;
        add('style/line-endings', at.start, at.end, edits, [what.join('; ')]);
    }
    if (mark !== null) {
        places.push(mark);
    }
    const whole = [...(mark?.edits ?? []), ...layout.result.edits];
    return withWarning(sortPlaces(places), whole);
}

/** The style findings of a file of either kind. */
export function styleOf(
    kind: FormatKind,
    body: string,
    bom: boolean,
    options: { readonly rules?: LayoutRules; readonly parsed?: ParseResult } = {},
): StylePlace[] {
    return kind === 'script'
        ? scriptStyle(body, bom, options)
        : localizationStyle(body, bom, options.rules);
}
