/**
 * The parser (docs/PLAN.md items 2.4 and 2.5). It always returns a tree: every error has one
 * recovery path, and each path is tested on a broken-input fixture under `fixtures/mods/`.
 * It keeps its own stack instead of recursing, so no nesting depth can overflow the call
 * stack.
 *
 * Forms it accepts: `key = value` with any of the eight operators; `key = { ... }`; blocks
 * without a key; lists of bare values and lists that mix values with pairs; numbers, dates
 * and any other scalar as keys; an operator as a value (`OPERATOR = <=`); a `$PARAM$` where an
 * operator goes (`count $OPERATOR$ 3`); a name before a block or quoted text in a value
 * (`rgb { 1 2 3 }`, `hex { 50779b }`, `list "name"`); and a name before a key
 * (`scripted_trigger name = { ... }`). The last two are syntax: no name is looked up.
 *
 * Errors and how each recovers:
 *
 * - `}` with no block open, at the top level: reported and skipped.
 * - A block with no key at the top level: reported; the block is kept as an item.
 * - An operator with no key: reported and skipped.
 * - An operator with no value (a `}`, the end of the file, or another operator follows):
 *   reported; the pair has no value, and what follows is read as usual.
 * - A key at the top level with no operator: reported at the token found where `=` belongs;
 *   the key is kept as a bare value. A token reported that way is not reported again.
 * - `name { ... }` among statements (the base game's own known defect): reported at the `{`
 *   and read as `name = { ... }`, a pair without an operator. In a block that holds no
 *   pairs it is a value followed by a block, which a list may hold.
 * - `?=` after a key that is not a name or a scope chain: reported; read as written.
 * - A block still open at the end of the file: reported at its `{`; it ends at the end.
 * - Quoted text without its closing quote: reported; it runs to the end of the file, as the
 *   lexer reads it.
 * - Malformed or unclosed `@[ ... ]`: reported; the scalar is kept, without an expression.
 */

import { readArithmetic } from './arithmetic.js';
import {
    compareFindings,
    toFinding,
    type Finding,
    type FindingId,
    type MessageCatalogue,
    type RawFinding,
} from './findings.js';
import { chainSegments, tokenize, unquote, type Token } from './lexer.js';
import { LineIndex } from './position.js';
import type {
    Block,
    Comment,
    FileNode,
    Item,
    Operator,
    Pair,
    Scalar,
    Tagged,
    Value,
} from './tree.js';

export interface ParseOptions {
    /** The spec's error catalogue, so findings carry the game's message text as evidence. */
    readonly catalogue?: MessageCatalogue | undefined;
}

export interface ParseResult {
    /** The text the offsets refer to: what was parsed, without a leading byte-order mark. */
    readonly text: string;
    /** True when the text given started with a byte-order mark (U+FEFF), which was removed. */
    readonly bom: boolean;
    readonly file: FileNode;
    /** Every parse finding, in the order of where it starts. */
    readonly findings: readonly Finding[];
    readonly lines: LineIndex;
    /** The span of `text` that was parsed to make this result: all of it, unless re-parsed. */
    readonly reparsed: { readonly start: number; readonly end: number };
}

/** A block being read: its items so far, and how to finish it when its `}` arrives. */
interface Frame {
    /** Items in source order; a slot is null until the pair that owns a block is finished. */
    readonly items: (Item | null)[];
    /** The `{`, or null for the file itself. */
    readonly open: Token | null;
    /** True only for the file's top level, where the top-level rules apply. */
    readonly file: boolean;
    /** Builds the node that holds the finished block and puts it in the parent's slot. */
    readonly finish: ((block: Block) => void) | null;
    pairs: number;
    /** Items that are a bare value directly followed by a block: `name { ... }`. */
    readonly adjacent: Set<number>;
    /** Items that are a bare value followed by a bare `$PARAM$`: `count $OPERATOR$ 3`. */
    readonly parameterOperator: Set<number>;
    /** True when the last item that is not a comment is a bare value. */
    lastWasBare: boolean;
}

interface RunResult {
    readonly items: Item[];
    readonly findings: RawFinding[];
    /** For a block's interior: true when it ended exactly at the `}` at the end of the span. */
    readonly closedAtEnd: boolean;
}

function isScalarToken(token: Token): boolean {
    return token.kind === 'word' || token.kind === 'string' || token.kind === 'arithmetic';
}

const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parse `text` from `from` to `to`. With `interior` false that span is a whole file; with it
 * true it is the inside of a block whose `}` is the last character of the span.
 */
function run(text: string, from: number, to: number, interior: boolean): RunResult {
    const tokens = tokenize(text, from, to);
    const findings: RawFinding[] = [];
    const report = (id: FindingId, start: number, end: number, args: string[] = []): void => {
        findings.push({ id, start, end, args });
    };

    const scalarOf = (token: Token): Scalar => {
        const source = text.slice(token.start, token.end);
        if (token.kind === 'string') {
            if (!token.terminated) {
                report('syntax/unterminated-string', token.start, token.start + 1);
            }
            return {
                kind: 'scalar',
                type: 'string',
                start: token.start,
                end: token.end,
                text: source,
                value: unquote(source, token.terminated),
                terminated: token.terminated,
            };
        }
        if (token.kind === 'arithmetic') {
            const inner = source.slice(2, token.terminated ? -1 : undefined);
            const base = {
                kind: 'scalar',
                type: 'arithmetic',
                start: token.start,
                end: token.end,
                text: source,
                value: source,
                terminated: token.terminated,
            } as const;
            if (!token.terminated) {
                report('syntax/malformed-arithmetic', token.start, token.end, [
                    inner,
                    "its ']' is missing",
                ]);
                return base;
            }
            const read = readArithmetic(inner);
            if (!read.ok) {
                report('syntax/malformed-arithmetic', token.start, token.end, [inner, read.reason]);
                return base;
            }
            return { ...base, expression: read.expression };
        }
        const type = token.kind === 'word' ? token.type : 'name';
        const scalar: Scalar = {
            kind: 'scalar',
            type,
            start: token.start,
            end: token.end,
            text: source,
            value: source,
            terminated: true,
        };
        if (type === 'chain') {
            const segments = chainSegments(source);
            if (segments !== undefined) {
                return { ...scalar, segments };
            }
        }
        return scalar;
    };

    const commentOf = (token: Token): Comment => ({
        kind: 'comment',
        start: token.start,
        end: token.end,
        text: text.slice(token.start, token.end),
    });

    const operatorOf = (token: Token): Operator => ({
        kind: 'operator',
        start: token.start,
        end: token.end,
        text: token.kind === 'operator' ? token.text : text.slice(token.start, token.end),
        parameter: token.kind !== 'operator',
    });

    /** The index of the first token at or after `at` that is not a comment. */
    const significant = (at: number): number => {
        let k = at;
        while (tokens[k]?.kind === 'comment') {
            k++;
        }
        return Math.min(k, tokens.length - 1);
    };

    const tokenAt = (k: number): Token => {
        const token = tokens[k];
        if (token === undefined) {
            throw new Error('the token list always ends with eof');
        }
        return token;
    };

    const newFrame = (open: Token | null, finish: Frame['finish'], file = false): Frame => ({
        items: [],
        open,
        file,
        finish,
        pairs: 0,
        adjacent: new Set(),
        parameterOperator: new Set(),
        lastWasBare: false,
    });

    const root = newFrame(null, null, !interior);
    const stack: Frame[] = [root];
    const top = (): Frame => stack[stack.length - 1] ?? root;

    /** Put the comments among tokens `[a, b)` into the frame, in order. */
    const pushComments = (frame: Frame, a: number, b: number): void => {
        for (let k = a; k < b; k++) {
            const token = tokenAt(k);
            if (token.kind === 'comment') {
                frame.items.push(commentOf(token));
            }
        }
    };

    /**
     * Finish a frame's items. Among statements (a block that holds pairs, or the file's top
     * level), `key $PARAM$ value` is a pair with the parameter as its operator, and
     * `name { ... }` is a pair whose `=` is missing. In a block of values only, both are
     * read as the values they are.
     */
    const finishItems = (frame: Frame): Item[] => {
        const items = frame.items.filter((item): item is Item => item !== null);
        // Every slot is filled by now: each block in it closed before this one finishes.
        if (
            frame.adjacent.size + frame.parameterOperator.size === 0 ||
            items.length !== frame.items.length
        ) {
            return items;
        }
        if (!frame.file && frame.pairs === 0) {
            return items;
        }
        const nextSignificant = (k: number): number => {
            let n = k;
            while (items[n]?.kind === 'comment') {
                n++;
            }
            return n;
        };
        const out: Item[] = [];
        for (let k = 0; k < items.length; k++) {
            const item = items[k];
            if (item === undefined) {
                continue;
            }
            if (item.kind === 'scalar' && frame.parameterOperator.has(k)) {
                const p = nextSignificant(k + 1);
                const v = nextSignificant(p + 1);
                const parameter = items[p];
                const value = items[v];
                if (
                    parameter?.kind === 'scalar' &&
                    parameter.type === 'parameter' &&
                    (value?.kind === 'scalar' || value?.kind === 'block')
                ) {
                    out.push({
                        kind: 'pair',
                        start: item.start,
                        end: value.end,
                        prefix: null,
                        key: item,
                        operator: {
                            kind: 'operator',
                            start: parameter.start,
                            end: parameter.end,
                            text: parameter.text,
                            parameter: true,
                        },
                        value,
                    });
                    for (let c = k + 1; c < v; c++) {
                        const comment = items[c];
                        if (comment?.kind === 'comment') {
                            out.push(comment);
                        }
                    }
                    k = v;
                    continue;
                }
            }
            if (item.kind === 'scalar' && frame.adjacent.has(k)) {
                const b = nextSignificant(k + 1);
                const block = items[b];
                if (block?.kind === 'block') {
                    report('syntax/missing-equals-before-block', block.start, block.start + 1);
                    out.push({
                        kind: 'pair',
                        start: item.start,
                        end: block.end,
                        prefix: null,
                        key: item,
                        operator: null,
                        value: block,
                    });
                    for (let c = k + 1; c < b; c++) {
                        const comment = items[c];
                        if (comment?.kind === 'comment') {
                            out.push(comment);
                        }
                    }
                    k = b;
                    continue;
                }
            }
            out.push(item);
        }
        return out;
    };

    /** Close the innermost block at `end`; `close` is its `}`, or null at the end of the file. */
    const closeFrame = (close: Token | null): void => {
        const frame = stack.pop();
        if (frame?.open == null || frame.finish === null) {
            return;
        }
        if (close === null) {
            report('syntax/missing-closing-brace', frame.open.start, frame.open.end);
        }
        const block: Block = {
            kind: 'block',
            start: frame.open.start,
            end: close === null ? to : close.end,
            items: finishItems(frame),
            closed: close !== null,
        };
        frame.finish(block);
    };

    /** Reserve a slot for an item that is finished when its block closes. */
    const reserve = (frame: Frame): number => {
        frame.items.push(null);
        frame.lastWasBare = false;
        return frame.items.length - 1;
    };

    const openBlock = (open: Token, finish: (block: Block) => void): void => {
        stack.push(newFrame(open, finish));
    };

    /** Read a pair whose key is token `k` and whose operator is token `o`. */
    const readPair = (frame: Frame, prefixAt: number | null, k: number, o: number): number => {
        const prefix = prefixAt === null ? null : scalarOf(tokenAt(prefixAt));
        const keyToken = tokenAt(k);
        const key = scalarOf(keyToken);
        const opToken = tokenAt(o);
        const operator = operatorOf(opToken);
        if (opToken.kind === 'operator' && opToken.text === '?=') {
            // A `$PARAM$` stands for the name or chain it is replaced by.
            if (key.type !== 'name' && key.type !== 'chain' && key.type !== 'parameter') {
                report('syntax/null-safe-operator-after-value', opToken.start, opToken.end, ['?=']);
            }
        }
        const start = prefix?.start ?? key.start;
        const slot = reserve(frame);
        frame.pairs++;
        pushComments(frame, prefixAt ?? k, o);
        const pair = (value: Value | null, end: number): Pair => ({
            kind: 'pair',
            start,
            end,
            prefix,
            key,
            operator,
            value,
        });
        const v = significant(o + 1);
        const valueToken = tokenAt(v);
        if (valueToken.kind === 'open') {
            pushComments(frame, o + 1, v);
            openBlock(valueToken, (block) => {
                frame.items[slot] = pair(block, block.end);
            });
            return v + 1;
        }
        if (isScalarToken(valueToken)) {
            const w = significant(v + 1);
            const after = tokenAt(w);
            // `name { ... }`, or `name "text"` where the text is not the key of the next pair.
            const tagged =
                valueToken.kind === 'word' &&
                valueToken.type === 'name' &&
                (after.kind === 'open' ||
                    (after.kind === 'string' && tokenAt(significant(w + 1)).kind !== 'operator'));
            if (tagged) {
                const tag = scalarOf(valueToken);
                pushComments(frame, o + 1, w);
                if (after.kind === 'open') {
                    openBlock(after, (block) => {
                        const value: Tagged = {
                            kind: 'tagged',
                            start: tag.start,
                            end: block.end,
                            tag,
                            body: block,
                        };
                        frame.items[slot] = pair(value, block.end);
                    });
                } else {
                    const body = scalarOf(after);
                    const value: Tagged = {
                        kind: 'tagged',
                        start: tag.start,
                        end: body.end,
                        tag,
                        body,
                    };
                    frame.items[slot] = pair(value, body.end);
                }
                return w + 1;
            }
            const value = scalarOf(valueToken);
            pushComments(frame, o + 1, v);
            frame.items[slot] = pair(value, value.end);
            return v + 1;
        }
        if (valueToken.kind === 'operator' && opToken.kind === 'operator' && opToken.text === '=') {
            const value = operatorOf(valueToken);
            pushComments(frame, o + 1, v);
            frame.items[slot] = pair(value, value.end);
            return v + 1;
        }
        // No value: a '}', the end of the file, or another operator follows.
        report('syntax/missing-value', valueToken.start, valueToken.end);
        frame.items[slot] = pair(null, operator.end);
        return o + 1;
    };

    let notReported = -1;
    let i = 0;
    let closedAtEnd = false;
    for (;;) {
        const frame = top();
        const token = tokenAt(i);
        if (token.kind === 'eof') {
            break;
        }
        if (token.kind === 'comment') {
            frame.items.push(commentOf(token));
            i++;
            continue;
        }
        if (token.kind === 'close') {
            if (stack.length > 1) {
                closeFrame(token);
            } else if (interior) {
                // The `}` of the block whose inside this is.
                closedAtEnd = tokenAt(i + 1).kind === 'eof' && token.end === to;
                break;
            } else {
                report('syntax/unexpected-closing-brace', token.start, token.end);
            }
            i++;
            continue;
        }
        if (token.kind === 'open') {
            if (frame.file) {
                report('syntax/block-without-key', token.start, token.end);
            }
            const slot = reserve(frame);
            openBlock(token, (block) => {
                frame.items[slot] = block;
            });
            i++;
            continue;
        }
        if (token.kind === 'operator') {
            report('syntax/operator-without-key', token.start, token.end);
            i++;
            continue;
        }

        // An item that starts with a scalar.
        const n = significant(i + 1);
        const next = tokenAt(n);
        // `name key = { ... }` at the top level, the name on the key's line: a name before
        // the key. Inside a block the same tokens are a value followed by a pair, which a
        // mixed list holds; at the top level, on another line, the name is a stray word.
        if (
            frame.file &&
            token.kind === 'word' &&
            token.type === 'name' &&
            !frame.lastWasBare &&
            next.kind === 'word' &&
            (next.type === 'name' || next.type === 'chain') &&
            PLAIN_NAME.test(text.slice(token.start, token.end)) &&
            !/[\n\r]/.test(text.slice(token.end, next.start))
        ) {
            const o = significant(n + 1);
            if (tokenAt(o).kind === 'operator' && tokenAt(significant(o + 1)).kind === 'open') {
                i = readPair(frame, i, n, o);
                continue;
            }
        }
        if (next.kind === 'operator') {
            i = readPair(frame, null, i, n);
            continue;
        }
        const parameterOperator =
            next.kind === 'word' &&
            next.type === 'parameter' &&
            !(token.kind === 'word' && token.type === 'parameter') &&
            (isScalarToken(tokenAt(significant(n + 1))) ||
                tokenAt(significant(n + 1)).kind === 'open');
        if (parameterOperator && frame.file) {
            i = readPair(frame, null, i, n);
            continue;
        }
        const scalar = scalarOf(token);
        if (parameterOperator) {
            // Decided when the block closes: a pair if the block holds pairs (finishItems).
            frame.items.push(scalar);
            frame.parameterOperator.add(frame.items.length - 1);
            frame.lastWasBare = true;
            i++;
            continue;
        }
        if (next.kind === 'open') {
            frame.items.push(scalar);
            frame.adjacent.add(frame.items.length - 1);
            pushComments(frame, i + 1, n);
            const slot = reserve(frame);
            openBlock(next, (block) => {
                frame.items[slot] = block;
            });
            i = n + 1;
            continue;
        }
        frame.items.push(scalar);
        frame.lastWasBare = true;
        if (frame.file) {
            if (i !== notReported) {
                const found = next.kind === 'eof' ? '' : text.slice(next.start, next.end);
                report('syntax/missing-operator', next.start, next.end, [found]);
            }
            notReported = n;
        }
        i++;
    }
    if (interior && !closedAtEnd) {
        return { items: [], findings, closedAtEnd: false };
    }
    while (stack.length > 1) {
        closeFrame(null);
    }
    return { items: finishItems(root), findings, closedAtEnd };
}

/** Parse a script file's text (docs/encoding.md; a leading byte-order mark is removed). */
export function parse(source: string, options: ParseOptions = {}): ParseResult {
    const bom = source.charCodeAt(0) === 0xfeff;
    const text = bom ? source.slice(1) : source;
    const result = run(text, 0, text.length, false);
    const lines = new LineIndex(text);
    return {
        text,
        bom,
        file: { kind: 'file', start: 0, end: text.length, items: result.items },
        findings: placeFindings(result.findings, lines, options.catalogue),
        lines,
        reparsed: { start: 0, end: text.length },
    };
}

function placeFindings(
    raw: readonly RawFinding[],
    lines: LineIndex,
    catalogue: MessageCatalogue | undefined,
): Finding[] {
    return [...raw].sort(compareFindings).map((f) => toFinding(f, lines, catalogue));
}

/** One change to a text: the span `[start, end)` of the old text is replaced by `text`. */
export interface TextEdit {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

/** A copy of a node with every offset moved by `delta`. */
function shifted<T extends Item | Value | Tagged>(node: T, delta: number): T {
    if (delta === 0) {
        return node;
    }
    return shiftAny(node, delta) as T;
}

function shiftAny(node: Item | Value | Tagged, delta: number): Item | Value | Tagged {
    const start = node.start + delta;
    const end = node.end + delta;
    switch (node.kind) {
        case 'scalar':
            return { ...node, start, end };
        case 'comment':
            return { ...node, start, end };
        case 'operator':
            return { ...node, start, end };
        case 'block':
            return { ...node, start, end, items: node.items.map((item) => shifted(item, delta)) };
        case 'tagged':
            return {
                ...node,
                start,
                end,
                tag: shifted(node.tag, delta),
                body: shifted(node.body, delta),
            };
        case 'pair':
            return {
                ...node,
                start,
                end,
                prefix: node.prefix === null ? null : shifted(node.prefix, delta),
                key: shifted(node.key, delta),
                operator: node.operator === null ? null : shifted(node.operator, delta),
                value: node.value === null ? null : shifted(node.value, delta),
            };
    }
}

/** The blocks that contain `[start, end)` strictly inside their braces, outermost first. */
function enclosingBlocks(file: FileNode, start: number, end: number): Block[] {
    const chain: Block[] = [];
    let items: readonly Item[] = file.items;
    for (;;) {
        let found: Block | undefined;
        for (const item of items) {
            if (item.start > start) {
                break;
            }
            const block = blockWithin(item);
            if (block?.closed === true && block.start < start && end < block.end) {
                found = block;
                break;
            }
        }
        if (found === undefined) {
            return chain;
        }
        chain.push(found);
        items = found.items;
    }
}

function blockWithin(item: Item): Block | undefined {
    if (item.kind === 'block') {
        return item;
    }
    if (item.kind === 'pair' && item.value !== null) {
        if (item.value.kind === 'block') {
            return item.value;
        }
        if (item.value.kind === 'tagged' && item.value.body.kind === 'block') {
            return item.value.body;
        }
    }
    return undefined;
}

/** `items` with the block `target` (inside one of them) replaced, and later items moved. */
function replaceIn(
    items: readonly Item[],
    target: Block,
    replacement: Block,
    delta: number,
): Item[] {
    return items.map((item) => {
        if (item.end <= target.start) {
            return item;
        }
        if (item.start > target.start) {
            return shifted(item, delta);
        }
        return replaceItem(item, target, replacement, delta);
    });
}

function replaceItem(item: Item, target: Block, replacement: Block, delta: number): Item {
    if (item === target) {
        return replacement;
    }
    if (item.kind === 'block') {
        return {
            ...item,
            end: item.end + delta,
            items: replaceIn(item.items, target, replacement, delta),
        };
    }
    if (item.kind === 'pair' && item.value !== null) {
        const value = item.value;
        if (value.kind === 'block') {
            const block =
                value === target
                    ? replacement
                    : (replaceItem(value, target, replacement, delta) as Block);
            return { ...item, end: item.end + delta, value: block };
        }
        if (value.kind === 'tagged' && value.body.kind === 'block') {
            const body =
                value.body === target
                    ? replacement
                    : (replaceItem(value.body, target, replacement, delta) as Block);
            return {
                ...item,
                end: item.end + delta,
                value: { ...value, end: value.end + delta, body },
            };
        }
    }
    return item;
}

/**
 * Re-parse after an edit (docs/PLAN.md item 2.7). The innermost block whose braces enclose the
 * edit is re-parsed on its own, and the rest of the old tree is reused: nodes before it are
 * shared, nodes after it are moved by the edit's change in length. If re-parsing that block
 * would change what lies outside it (a brace or a quote that no longer balances), the next
 * block out is tried, and at the top level the whole file is parsed again. The result is the
 * tree and findings a full parse of the new text gives.
 */
export function reparse(
    previous: ParseResult,
    edit: TextEdit,
    options: ParseOptions = {},
): ParseResult {
    const old = previous.text;
    const start = Math.max(0, Math.min(edit.start, old.length));
    const end = Math.max(start, Math.min(edit.end, old.length));
    const text = old.slice(0, start) + edit.text + old.slice(end);
    const delta = edit.text.length - (end - start);
    if (text.charCodeAt(0) === 0xfeff) {
        return { ...parse(text, options), bom: true };
    }
    const candidates = enclosingBlocks(previous.file, start, end);
    for (let c = candidates.length - 1; c >= 0; c--) {
        const block = candidates[c];
        if (block === undefined) {
            continue;
        }
        const inside = block.start + 1;
        const close = block.end - 1 + delta;
        const result = run(text, inside, close + 1, true);
        if (!result.closedAtEnd) {
            continue;
        }
        const replacement: Block = {
            kind: 'block',
            start: block.start,
            end: close + 1,
            items: result.items,
            closed: true,
        };
        const lines = new LineIndex(text);
        const kept: RawFinding[] = [];
        for (const finding of previous.findings) {
            if (finding.start < inside) {
                kept.push(finding);
            } else if (finding.start >= block.end) {
                kept.push({ ...finding, start: finding.start + delta, end: finding.end + delta });
            }
        }
        return {
            text,
            bom: previous.bom,
            file: {
                kind: 'file',
                start: 0,
                end: text.length,
                items: replaceIn(previous.file.items, block, replacement, delta),
            },
            findings: placeFindings([...kept, ...result.findings], lines, options.catalogue),
            lines,
            reparsed: { start: inside, end: close },
        };
    }
    return { ...parse(text, options), bom: previous.bom };
}
