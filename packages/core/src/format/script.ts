/**
 * The formatter of script files (docs/formatting.md). It works from the tree and the tokens:
 * every token is written exactly as it is, but for the spaces and tabs at the end of a comment,
 * and only the whitespace between two tokens is decided again, gap by gap, from the layout
 * rules (`rules.ts`). The tree says what each token is (the key of a pair, its operator, the
 * head of its value, a bare value, a block without a key, a comment) and which block holds it;
 * the text says where the author broke lines and left blank lines.
 *
 * First each block is given its layout, from the innermost out: on one line, or over several.
 * A block can be on one line only when nothing in it runs to the end of its line (a comment,
 * quoted text over several lines, `@[` without its `]`) and every block in it is on one line too;
 * otherwise the rule for its shape says (`BlockRule`). Then the width: every line wider than the
 * rules allow that holds a block on one line has its outermost such block put over several
 * lines; the lines are measured again, and so on, until every line fits or holds no block left
 * to split.
 *
 * Then a gap between two tokens becomes nothing (the `{}` of an empty block on one line), one
 * space, or a line break with the next line's indentation, one tab per enclosing block, after at
 * most the blank lines the rules keep:
 *
 * - after a comment, always a line break; before one, a line break when the comment stood on a
 *   line of its own, otherwise one space;
 * - inside a block on one line, one space;
 * - after the `{` and before the `}` of a block over several lines, a line break with no blank
 *   line;
 * - before a pair or a block without a key in a block over several lines, or at the top level,
 *   a line break;
 * - before a bare value in a block over several lines, a line break or a space, as the rules
 *   for values say;
 * - inside a pair, between its key (and a name before it), its operator and the head of its
 *   value, one space: the line breaks written there are removed, unless a comment stands
 *   between them, or the token before runs to the end of its line.
 *
 * A file with a parse error (an error finding), or with quoted text that has no closing quote,
 * is left as it is, with the first such finding as the reason: the parser's recovery guesses
 * the structure, and formatting from a guess would move lines the author never touched.
 */

import { tokenize, type Token } from '../syntax/lexer.js';
import { parse, type ParseResult } from '../syntax/parser.js';
import { blockShape, type Block, type FileNode, type Item, type Pair } from '../syntax/tree.js';
import {
    leftAsItIs,
    leftFor,
    lineEndingOf,
    type FormatEdit,
    type FormatLeft,
    type FormatResult,
} from './result.js';
import { DEFAULT_RULES, type BlockRule, type LayoutRules } from './rules.js';
import { columnsAfter, TAB_COLUMNS } from './width.js';

export interface FormatOptions {
    /** The layout rules; `DEFAULT_RULES`, which every surface uses, when not given. */
    readonly rules?: LayoutRules;
    /** The text already parsed (`parse` of the text given, or `reparse` to the same text). */
    readonly parsed?: ParseResult;
}

/** What a token is in the tree, for deciding the gap before it (0: a `}`). */
/** The first token of an item that starts a line: a pair's key (or prefix), a block's `{`. */
const ITEM = 1;
/** A token that goes on a pair: its key after a prefix, operator, value head, tagged body. */
const CONTINUES = 2;
/** A bare value: a scalar standing alone in a block. */
const VALUE = 3;
const COMMENT = 4;

/** What a gap becomes: nothing, one space, or a line break after that many blank lines. */
const NONE = -2;
const SPACE = -1;

/** A block's shape, for its rule. */
const EMPTY = 0;
const LIST = 1;
const STATEMENTS = 2;

/** The formatted text, with what Format Selection needs. */
export interface ScriptLayout {
    readonly result: FormatResult;
    /** The text the edits are placed in: the text given without its byte-order mark. */
    readonly body: string;
    /** Each edit to `body`, with the lines it spans. */
    readonly placed: readonly PlacedEdit[];
    /** The line breaks between tokens that are not the rules' kind. */
    readonly wrongBreaks: readonly WrongBreak[];
    /** True when the text does not end with a line break after its last token. */
    readonly noFinalBreak: boolean;
    /** Where each block on one line in the output starts (its `{`). */
    readonly flatBlocks: ReadonlySet<number>;
}

/** An edit to the text without the mark, with the parts a partial selection may take. */
export interface PlacedEdit extends FormatEdit {
    /**
     * What it changes: the whitespace between two tokens (`gap`), before the first (`start`) or
     * after the last (`end`), or the spaces and tabs at the end of a comment (`comment`).
     */
    readonly where: 'gap' | 'start' | 'end' | 'comment';
    readonly startLine: number;
    readonly endLine: number;
    /** For an edit across lines: where its first line break starts, and where its last ends. */
    readonly firstBreak: number;
    readonly afterLastBreak: number;
    /** The indentation the edit gives its last line, or null when it joins the lines. */
    readonly indent: string | null;
    /** The line breaks written in the span, and in its new text. */
    readonly breaksBefore: number;
    readonly breaksAfter: number;
    /** The token before the span starts and the one after it ends (the span itself at an end). */
    readonly aroundStart: number;
    readonly aroundEnd: number;
    /** True when the token after the span is a comment. */
    readonly beforeComment: boolean;
    /** True when the token after the span goes on a pair: its key after a name, operator, value. */
    readonly inPair: boolean;
    /** Where the innermost block around the span starts (its `{`), or -1 at the top level. */
    readonly block: number;
}

/** A line break of the text that is not the rules' kind: outside quoted text, between tokens. */
export interface WrongBreak {
    readonly start: number;
    readonly end: number;
}

/** The index of the token that starts at `offset` (tokens are in order). */
function tokenAt(tokens: readonly Token[], offset: number): number {
    let low = 0;
    let high = tokens.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const start = tokens[mid]?.start ?? 0;
        if (start === offset) {
            return mid;
        }
        if (start < offset) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    throw new Error(`no token starts at ${String(offset)}`);
}

/** How many line breaks `text` holds between `from` and `to`: `\r\n`, `\n` and `\r` each one. */
export function lineBreaks(text: string, from: number, to: number): number {
    let count = 0;
    for (let i = from; i < to; i++) {
        const code = text.charCodeAt(i);
        if (code === 10) {
            count++;
        } else if (code === 13) {
            count++;
            if (i + 1 < to && text.charCodeAt(i + 1) === 10) {
                i++;
            }
        }
    }
    return count;
}

/** A comment's text without the spaces and tabs at its end. */
export function trimComment(text: string): string {
    let end = text.length;
    while (end > 0) {
        const code = text.charCodeAt(end - 1);
        if (code !== 32 && code !== 9) {
            break;
        }
        end--;
    }
    return end === text.length ? text : text.slice(0, end);
}

/** The first parse finding that keeps a file from being formatted, or null. */
function blocking(findings: ReturnType<typeof parse>['findings']): FormatLeft | null {
    for (const finding of findings) {
        if (finding.severity === 'error' || finding.id === 'syntax/unterminated-string') {
            return leftFor(finding);
        }
    }
    return null;
}

/** What the tree says of each token, and of each block's `{`. */
interface Roles {
    readonly role: Uint8Array;
    /** For an item's first token: the `{` of the block that holds it, or -1 at the top level. */
    readonly container: Int32Array;
    /** For a `{`: its block's shape, how many items it holds, whether every item is simple. */
    readonly shape: Uint8Array;
    readonly items: Int32Array;
    readonly simple: Uint8Array;
}

/** A single token, or a pair with no name before its key whose value is a single token. */
function isSimple(item: Item): boolean {
    if (item.kind === 'scalar') {
        return true;
    }
    return (
        item.kind === 'pair' &&
        item.prefix === null &&
        item.value !== null &&
        (item.value.kind === 'scalar' || item.value.kind === 'operator')
    );
}

/** Mark each token with what it is in the tree, and the block that holds each item. */
function markRoles(file: FileNode, tokens: readonly Token[]): Roles {
    const n = tokens.length;
    const roles: Roles = {
        role: new Uint8Array(n),
        container: new Int32Array(n).fill(-1),
        shape: new Uint8Array(n),
        items: new Int32Array(n),
        simple: new Uint8Array(n),
    };
    const stack: { readonly items: readonly Item[]; readonly holder: number }[] = [
        { items: file.items, holder: -1 },
    ];
    const enter = (block: Block): void => {
        const open = tokenAt(tokens, block.start);
        const shape = blockShape(block);
        roles.shape[open] = shape === 'empty' ? EMPTY : shape === 'list' ? LIST : STATEMENTS;
        const items = block.items.filter((item) => item.kind !== 'comment');
        roles.items[open] = items.length;
        roles.simple[open] = items.every(isSimple) ? 1 : 0;
        stack.push({ items: block.items, holder: open });
    };
    const mark = (offset: number, what: number): number => {
        const t = tokenAt(tokens, offset);
        roles.role[t] = what;
        return t;
    };
    for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
        for (const item of frame.items) {
            switch (item.kind) {
                case 'comment':
                    mark(item.start, COMMENT);
                    break;
                case 'scalar':
                    roles.container[mark(item.start, VALUE)] = frame.holder;
                    break;
                case 'block':
                    roles.container[mark(item.start, ITEM)] = frame.holder;
                    enter(item);
                    break;
                case 'pair':
                    markPair(item, frame.holder, mark, roles, enter);
                    break;
            }
        }
    }
    return roles;
}

function markPair(
    pair: Pair,
    holder: number,
    mark: (offset: number, what: number) => number,
    roles: Roles,
    enter: (block: Block) => void,
): void {
    if (pair.prefix !== null) {
        roles.container[mark(pair.prefix.start, ITEM)] = holder;
        mark(pair.key.start, CONTINUES);
    } else {
        roles.container[mark(pair.key.start, ITEM)] = holder;
    }
    if (pair.operator !== null) {
        mark(pair.operator.start, CONTINUES);
    }
    const value = pair.value;
    if (value === null) {
        return;
    }
    mark(value.start, CONTINUES);
    if (value.kind === 'block') {
        enter(value);
    } else if (value.kind === 'tagged') {
        mark(value.body.start, CONTINUES);
        if (value.body.kind === 'block') {
            enter(value.body);
        }
    }
}

/** True when the rule puts a block on one line, before the width is measured. */
function wantsOneLine(
    rule: BlockRule,
    writtenOnOneLine: boolean,
    items: number,
    simple: boolean,
): boolean {
    switch (rule.layout) {
        case 'as-written':
            return writtenOnOneLine;
        case 'several':
            return false;
        case 'one-line':
            return (
                (rule.maxItems === undefined || items <= rule.maxItems) &&
                (rule.simple !== true || simple)
            );
    }
}

/**
 * Lay a script file's text out by the rules. `source` may start with the byte-order mark; every
 * offset of the result's edits counts it.
 */
export function layoutScript(source: string, options: FormatOptions = {}): ScriptLayout {
    const rules = options.rules ?? DEFAULT_RULES;
    const bom = source.charCodeAt(0) === 0xfeff;
    const shift = bom ? 1 : 0;
    const parsed = options.parsed ?? parse(source);
    const body = parsed.text;
    const left = blocking(parsed.findings);
    if (left !== null) {
        return {
            result: leftAsItIs('script', source, left),
            body,
            placed: [],
            wrongBreaks: [],
            noFinalBreak: false,
            flatBlocks: new Set(),
        };
    }
    const eol = rules.lineEnding === 'majority' ? lineEndingOf(body) : rules.lineEnding;
    const tokens = tokenize(body);
    tokens.pop(); // eof
    const n = tokens.length;
    const lines = parsed.lines;
    const { role, container, shape, items, simple } = markRoles(parsed.file, tokens);

    // Tokens that run to the end of their line: no block that holds one can be on one line.
    const openEnded = (i: number): boolean => {
        const token = tokens[i] as Token;
        return token.kind === 'arithmetic' && !token.terminated;
    };
    const breaksLine = (i: number): boolean => {
        const token = tokens[i] as Token;
        return (
            token.kind === 'comment' ||
            openEnded(i) ||
            (token.kind === 'string' && lineBreaks(body, token.start, token.end) > 0)
        );
    };

    // Depth and matching braces; each block's layout, from the innermost out.
    const depth = new Int32Array(n);
    const match = new Int32Array(n).fill(-1);
    const oneLine = new Uint8Array(n);
    const writtenOneLine = new Uint8Array(n);
    /** Per `{`: a token in the block runs to the end of its line, or a block in it is over several. */
    const mustBreak = new Uint8Array(n);
    const opens: number[] = [];
    for (let i = 0; i < n; i++) {
        const token = tokens[i] as Token;
        if (token.kind === 'open') {
            depth[i] = opens.length;
            opens.push(i);
            continue;
        }
        if (token.kind !== 'close') {
            depth[i] = opens.length;
            const holder = opens[opens.length - 1];
            if (holder !== undefined && breaksLine(i)) {
                mustBreak[holder] = 1;
            }
            continue;
        }
        const open = opens.pop() ?? -1;
        depth[i] = opens.length;
        if (open < 0) {
            continue;
        }
        match[i] = open;
        match[open] = i;
        const written = lineBreaks(body, (tokens[open] as Token).end, token.start) === 0;
        writtenOneLine[open] = written ? 1 : 0;
        const rule =
            shape[open] === EMPTY
                ? rules.empty
                : shape[open] === LIST
                  ? rules.lists
                  : rules.statements;
        const flat =
            mustBreak[open] === 0 &&
            wantsOneLine(rule, written, items[open] ?? 0, simple[open] === 1);
        oneLine[open] = flat ? 1 : 0;
        const parent = opens[opens.length - 1];
        if (parent !== undefined && (!flat || mustBreak[open] === 1)) {
            mustBreak[parent] = 1;
        }
    }

    // The line breaks written in each gap: gap `i` is before token `i`, gap `n` after the last.
    const breaks = new Int32Array(n + 1);
    for (let i = 0; i <= n; i++) {
        const from = i === 0 ? 0 : (tokens[i - 1] as Token).end;
        const to = i === n ? body.length : (tokens[i] as Token).start;
        breaks[i] = lineBreaks(body, from, to);
    }
    const flat = (open: number): boolean => oneLine[open] === 1;

    /** What the gap before token `b` (not the first) becomes. */
    const decide = (b: number): number => {
        const a = b - 1;
        const before = tokens[a] as Token;
        const after = tokens[b] as Token;
        const blankAllowed = before.kind !== 'open' && after.kind !== 'close';
        const lineBreak = (blank: boolean): number =>
            blank && blankAllowed ? Math.max(0, Math.min(rules.blankLines, breaks[b]! - 1)) : 0;
        if (before.kind === 'comment') {
            return lineBreak(role[b] !== CONTINUES);
        }
        if (after.kind === 'comment') {
            return breaks[b]! > 0 ? lineBreak(true) : SPACE;
        }
        if (after.kind === 'close') {
            const open = match[b]!;
            if (open >= 0 && flat(open)) {
                return open === a ? NONE : SPACE;
            }
            return 0;
        }
        if (before.kind === 'open') {
            return flat(a) ? SPACE : 0;
        }
        const holder = container[b]!;
        switch (role[b]) {
            case CONTINUES:
                return openEnded(a) ? 0 : SPACE;
            case ITEM:
                return holder >= 0 && flat(holder) ? SPACE : lineBreak(true);
            case VALUE:
                if (holder >= 0 && flat(holder)) {
                    return SPACE;
                }
                if (rules.values === 'one-per-line') {
                    return lineBreak(true);
                }
                if (holder >= 0 && writtenOneLine[holder] === 1) {
                    return 0;
                }
                return breaks[b]! > 0 || openEnded(a) ? lineBreak(true) : SPACE;
            default:
                return breaks[b]! > 0 || openEnded(a) ? lineBreak(true) : SPACE;
        }
    };

    const tokenText = (i: number): string => {
        const token = tokens[i] as Token;
        const text = body.slice(token.start, token.end);
        return token.kind === 'comment' ? trimComment(text) : text;
    };

    // Each gap's text; a pass returns true when it split a block for being too wide.
    const gaps: string[] = new Array<string>(n + 1).fill('');
    const render = (): boolean => {
        let column = 0;
        let candidates: number[] = [];
        let insideFlat = -1;
        let marked = false;
        const endLine = (): void => {
            if (column > rules.width) {
                for (const open of candidates) {
                    oneLine[open] = 0;
                    marked = true;
                }
            }
            candidates = [];
            insideFlat = -1;
        };
        for (let i = 0; i < n; i++) {
            const gap = i === 0 ? NONE : decide(i);
            if (gap === NONE) {
                gaps[i] = '';
            } else if (gap === SPACE) {
                gaps[i] = ' ';
                column++;
            } else {
                endLine();
                gaps[i] = eol.repeat(gap + 1) + '\t'.repeat(depth[i]!);
                column = depth[i]! * TAB_COLUMNS;
            }
            const token = tokens[i] as Token;
            if (token.kind === 'open' && insideFlat < 0 && flat(i)) {
                candidates.push(i);
                insideFlat = match[i]!;
            }
            const text = tokenText(i);
            if (token.kind === 'string' && /[\r\n]/.test(text)) {
                // Quoted text over several lines: its first line ends this one.
                const parts = text.split(/\r\n|\r|\n/);
                column = columnsAfter(parts[0] ?? '', column);
                endLine();
                column = columnsAfter(parts[parts.length - 1] ?? '', 0);
            } else {
                column = columnsAfter(text, column);
            }
            if (i === insideFlat) {
                insideFlat = -1;
            }
        }
        endLine();
        gaps[n] = n > 0 ? eol : '';
        return marked;
    };
    while (render()) {
        // A block was split: measure the lines again.
    }

    // The innermost block around each token: its own block for a `}`.
    const around = new Int32Array(n).fill(-1);
    {
        const stack: number[] = [];
        for (let i = 0; i < n; i++) {
            const token = tokens[i] as Token;
            if (token.kind === 'close') {
                around[i] = stack.pop() ?? -1;
                continue;
            }
            around[i] = stack[stack.length - 1] ?? -1;
            if (token.kind === 'open') {
                stack.push(i);
            }
        }
    }

    // The output, and the edits that make it.
    const placed: PlacedEdit[] = [];
    const wrongBreaks: WrongBreak[] = [];
    const parts: string[] = [];
    for (let i = 0; i <= n; i++) {
        const from = i === 0 ? 0 : (tokens[i - 1] as Token).end;
        const to = i === n ? body.length : (tokens[i] as Token).start;
        const gap = gaps[i] ?? '';
        parts.push(gap);
        for (let k = from; k < to; k++) {
            const code = body.charCodeAt(k);
            if (code === 13 && body.charCodeAt(k + 1) === 10 && k + 1 < to) {
                if (eol !== '\r\n') {
                    wrongBreaks.push({ start: k, end: k + 2 });
                }
                k++;
            } else if ((code === 10 || code === 13) && (eol !== '\n' || code === 13)) {
                wrongBreaks.push({ start: k, end: k + 1 });
            }
        }
        if (to - from !== gap.length || body.slice(from, to) !== gap) {
            const b = i < n ? i : -1;
            const token = b >= 0 ? (tokens[b] as Token) : undefined;
            const holder = i < n ? around[i]! : -1;
            placed.push({
                ...placeGap(body, lines.positionAt.bind(lines), from, to, gap),
                where: i === 0 ? 'start' : i === n ? 'end' : 'gap',
                aroundStart: i === 0 ? from : (tokens[i - 1] as Token).start,
                aroundEnd: token?.end ?? to,
                beforeComment: token?.kind === 'comment',
                inPair: b >= 0 && role[b] === CONTINUES,
                block: holder >= 0 ? (tokens[holder] as Token).start : -1,
            });
        }
        if (i < n) {
            const token = tokens[i] as Token;
            const text = tokenText(i);
            parts.push(text);
            if (text.length !== token.end - token.start) {
                const line = lines.positionAt(token.start).line;
                placed.push({
                    start: token.start + text.length,
                    end: token.end,
                    text: '',
                    where: 'comment',
                    startLine: line,
                    endLine: line,
                    firstBreak: token.end,
                    afterLastBreak: token.start + text.length,
                    indent: null,
                    breaksBefore: 0,
                    breaksAfter: 0,
                    aroundStart: token.start,
                    aroundEnd: token.end,
                    beforeComment: false,
                    inPair: false,
                    block: -1,
                });
            }
        }
    }
    let splitCount = 0;
    const flatBlocks = new Set<number>();
    for (let i = 0; i < n; i++) {
        if ((tokens[i] as Token).kind !== 'open') {
            continue;
        }
        if (oneLine[i] === 1) {
            flatBlocks.add((tokens[i] as Token).start);
        } else if (writtenOneLine[i] === 1) {
            splitCount++;
        }
    }
    // A file with no token is formatted empty, its mark as it was: there is nothing to mark.
    const outBom = rules.bom === 'keep' || n === 0 ? bom : rules.bom === 'write';
    const text = (outBom ? '\uFEFF' : '') + parts.join('');
    const edits: FormatEdit[] = placed.map((e) => ({
        start: e.start + shift,
        end: e.end + shift,
        text: e.text,
    }));
    if (outBom !== bom) {
        edits.unshift({ start: 0, end: shift, text: outBom ? '\uFEFF' : '' });
    }
    return {
        result: {
            kind: 'script',
            text,
            changed: text !== source,
            left: null,
            edits,
            eol,
            split: splitCount,
        },
        body,
        placed,
        wrongBreaks,
        noFinalBreak: n > 0 && breaks[n] === 0,
        flatBlocks,
    };
}

/** A gap's edit, with the lines it spans and where its line breaks are. */
function placeGap(
    body: string,
    positionAt: (offset: number) => { line: number },
    from: number,
    to: number,
    gap: string,
): Omit<PlacedEdit, 'where' | 'aroundStart' | 'aroundEnd' | 'beforeComment' | 'inPair' | 'block'> {
    let firstBreak = to;
    let afterLastBreak = from;
    for (let i = from; i < to; i++) {
        const code = body.charCodeAt(i);
        if (code === 10 || code === 13) {
            if (firstBreak === to) {
                firstBreak = i;
            }
            if (code === 13 && body.charCodeAt(i + 1) === 10) {
                i++;
            }
            afterLastBreak = i + 1;
        }
    }
    const lastBreak = Math.max(gap.lastIndexOf('\n'), gap.lastIndexOf('\r'));
    return {
        start: from,
        end: to,
        text: gap,
        startLine: positionAt(from).line,
        endLine: positionAt(to).line,
        firstBreak,
        afterLastBreak,
        indent: lastBreak < 0 ? null : gap.slice(lastBreak + 1),
        breaksBefore: lineBreaks(body, from, to),
        breaksAfter: lineBreaks(gap, 0, gap.length),
    };
}

/** Format a script file's text (docs/formatting.md). */
export function formatScript(source: string, options: FormatOptions = {}): FormatResult {
    return layoutScript(source, options).result;
}

/**
 * The edits of Format Selection on lines `from` to `to` (counted from 0, both included, in
 * `body`, the text without the mark): the edits of formatting the whole file that lie on those
 * lines. An edit across a line break is taken whole when the lines on both of its sides are
 * selected; otherwise only its part on a selected line: the spaces and tabs it removes at the
 * end of its first line, or the indentation it gives its last.
 */
export function selectEdits(
    body: string,
    placed: readonly PlacedEdit[],
    from: number,
    to: number,
): FormatEdit[] {
    const inside = (line: number): boolean => line >= from && line <= to;
    const out: FormatEdit[] = [];
    const take = (start: number, end: number, text: string): void => {
        if (body.slice(start, end) !== text) {
            out.push({ start, end, text });
        }
    };
    for (const edit of placed) {
        if (edit.startLine === edit.endLine || (inside(edit.startLine) && inside(edit.endLine))) {
            if (inside(edit.startLine)) {
                take(edit.start, edit.end, edit.text);
            }
            continue;
        }
        if (inside(edit.startLine)) {
            take(edit.start, edit.firstBreak, '');
        }
        if (inside(edit.endLine) && edit.indent !== null) {
            take(edit.afterLastBreak, edit.end, edit.indent);
        }
    }
    return out;
}
