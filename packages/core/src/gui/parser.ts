/**
 * The GUI parser (docs/PLAN.md item 10.2; the syntax is docs/gui-syntax.md). It reads a `.gui`
 * file with the script lexer (`syntax/lexer.ts`), whose tokens the GUI syntax shares: words,
 * quoted text, `@[ ... ]`, comments, braces and operators. What differs is the grammar, read
 * here: named blocks (`types Name { ... }`, `block "name" { ... }`), type definitions
 * (`type name = base { ... }`), and no `$PARAM$`, no name before a key, no tagged value.
 *
 * Like the script parser it always returns a tree, keeps its own stack instead of recursing,
 * and has one recovery path per finding, each tested on a fixture pair under
 * `fixtures/mods/gui-*`. Nothing here knows a GUI name beyond the words of the grammar
 * (`GUI_NAMED_KEYWORDS`, `GUI_TYPE_KEYWORDS`).
 *
 * Errors and how each recovers (the findings are `syntax/gui-*`, every one information: no
 * catalogue message is shown to be the GUI reader's):
 *
 * - `}` with no block open: reported and skipped.
 * - An operator with no key: reported and skipped; the value after it is kept and not reported
 *   again.
 * - An operator other than `=`: reported; the statement is read with it.
 * - `key =` with nothing after it (a `}`, the end of the file, another operator): reported;
 *   the property has no value.
 * - `key { ... }` or `key value` among statements: reported where the `=` belongs and read as
 *   `key = { ... }` or `key = value`, a property without its operator. In a block of values
 *   only (`{ 480 770 }`) two values on one line are the values they are.
 * - A value among statements with no key in front of it: reported; kept as a value.
 * - A block with no key among statements: reported; kept as an item.
 * - A named-block keyword followed by its block with no name: reported; the block is read.
 * - A type definition without its `=`, its base or its block: reported; read as far as
 *   written.
 * - A `;` after a statement: reported; written against the word before it (`expanding;`) it
 *   stays part of that word, as the lexer reads it, and written apart it is a value of its own.
 * - A block still open at the end of the file: reported at its `{`; it ends at the end.
 * - Quoted text without its closing quote: reported; it runs to the end of the file.
 * - Malformed or unclosed `@[ ... ]`: reported; the scalar is kept, without an expression.
 */

import { readArithmetic } from '../syntax/arithmetic.js';
import { decodeScript, type DecodeOptions, type FallbackEncoding } from '../syntax/decode.js';
import {
    compareFindings,
    toFinding,
    type Finding,
    type GuiFindingId,
    type InvalidStretch,
    type RawFinding,
} from '../syntax/findings.js';
import { chainSegments, tokenize, unquote, type Token } from '../syntax/lexer.js';
import { LineIndex } from '../syntax/position.js';
import type { Comment, Operator, Scalar } from '../syntax/tree.js';
import {
    isNamedKeyword,
    isTypeKeyword,
    type GuiBlock,
    type GuiFile,
    type GuiItem,
    type GuiNamed,
    type GuiProperty,
    type GuiType,
} from './tree.js';

export interface GuiParseResult {
    /** The text the offsets refer to: what was parsed, without a leading byte-order mark. */
    readonly text: string;
    /** True when the text given started with a byte-order mark (U+FEFF), which was removed. */
    readonly bom: boolean;
    readonly file: GuiFile;
    /** Every finding of the GUI parser, in the order of where it starts. */
    readonly findings: readonly Finding[];
    readonly lines: LineIndex;
}

/** A block being read: its items so far, and how to finish it when its `}` arrives. */
interface Frame {
    /** Items in source order; a slot is null until the item that owns a block is finished. */
    readonly items: (GuiItem | null)[];
    /** The `{`, or null for the file itself. */
    readonly open: Token | null;
    /** True only for the file's top level, which holds statements whatever it holds. */
    readonly file: boolean;
    readonly finish: ((block: GuiBlock) => void) | null;
    /** How many items with a key it holds: properties, named blocks, type definitions. */
    statements: number;
    /** The slots of its bare values, in order. */
    readonly bare: number[];
    /** The slots of its blocks with no key. */
    readonly keyless: number[];
}

function isScalarToken(token: Token): boolean {
    return token.kind === 'word' || token.kind === 'string' || token.kind === 'arithmetic';
}

const LINE_BREAK = /[\n\r]/;

/** The last thing an item writes, for a message about what follows it. */
function endText(item: GuiItem): string {
    switch (item.kind) {
        case 'scalar':
            return item.text;
        case 'gui-property':
            return item.value?.kind === 'scalar' ? item.value.text : item.key.text;
        case 'gui-named':
        case 'gui-type':
        case 'gui-block':
            return '}';
        case 'comment':
            return item.text;
    }
}

/** Parse `text`, a whole GUI file without its byte-order mark. */
function run(text: string): { items: GuiItem[]; findings: RawFinding[] } {
    const tokens = tokenize(text);
    const findings: RawFinding[] = [];
    const report = (id: GuiFindingId, start: number, end: number, args: string[] = []): void => {
        findings.push({ id, start, end, args });
    };

    const tokenAt = (k: number): Token => {
        const token = tokens[k];
        if (token === undefined) {
            throw new Error('the token list always ends with eof');
        }
        return token;
    };

    /** The index of the first token at or after `at` that is not a comment. */
    const significant = (at: number): number => {
        let k = at;
        while (tokens[k]?.kind === 'comment') {
            k++;
        }
        return Math.min(k, tokens.length - 1);
    };

    const scalarOf = (token: Token): Scalar => {
        const source = text.slice(token.start, token.end);
        if (token.kind === 'string') {
            if (!token.terminated) {
                report('syntax/gui-unterminated-string', token.start, token.start + 1);
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
                report('syntax/gui-malformed-arithmetic', token.start, token.end, [
                    inner,
                    "its ']' is missing",
                ]);
                return base;
            }
            const read = readArithmetic(inner);
            if (!read.ok) {
                report('syntax/gui-malformed-arithmetic', token.start, token.end, [
                    inner,
                    read.reason,
                ]);
                return base;
            }
            return { ...base, expression: read.expression };
        }
        const type = token.kind === 'word' ? token.type : 'name';
        if (source.length > 1 && source.endsWith(';')) {
            report('syntax/gui-trailing-semicolon', token.end - 1, token.end, [
                source.slice(0, -1),
                `it is read as part of the word, '${source}'`,
            ]);
        }
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

    /** An operator, reported when it is not `=`. */
    const operatorOf = (token: Token): Operator => {
        const written = token.kind === 'operator' ? token.text : text.slice(token.start, token.end);
        if (written !== '=') {
            report('syntax/gui-operator-not-equals', token.start, token.end, [written]);
        }
        return {
            kind: 'operator',
            start: token.start,
            end: token.end,
            text: written,
            parameter: false,
        };
    };

    const newFrame = (open: Token | null, finish: Frame['finish'], file = false): Frame => ({
        items: [],
        open,
        file,
        finish,
        statements: 0,
        bare: [],
        keyless: [],
    });

    const root = newFrame(null, null, true);
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

    /** Reserve a slot for an item that is finished when its block closes. */
    const reserve = (frame: Frame): number => {
        frame.items.push(null);
        return frame.items.length - 1;
    };

    const openBlock = (open: Token, finish: (block: GuiBlock) => void): void => {
        stack.push(newFrame(open, finish));
    };

    /**
     * Finish a frame's items. Among statements (the file's top level, or a block that holds an
     * item with a key) a value directly followed on its line by another value is a key whose
     * `=` is missing (`align right|top`), any other value stands with no key, and a block with
     * no key is out of place; each is reported. A block of values only is a list, as written.
     */
    const finishItems = (frame: Frame): GuiItem[] => {
        const items = frame.items.filter((item): item is GuiItem => item !== null);
        if (!frame.file && frame.statements === 0) {
            return items;
        }
        for (const slot of frame.keyless) {
            const block = frame.items[slot];
            if (block?.kind === 'gui-block') {
                report('syntax/gui-block-without-key', block.start, block.start + 1);
            }
        }
        if (frame.bare.length === 0) {
            return items;
        }
        const bare = new Set(frame.bare.map((slot) => frame.items[slot]));
        const out: GuiItem[] = [];
        for (let k = 0; k < items.length; k++) {
            const item = items[k];
            if (item === undefined) {
                continue;
            }
            if (item.kind !== 'scalar' || !bare.has(item)) {
                out.push(item);
                continue;
            }
            let n = k + 1;
            while (items[n]?.kind === 'comment') {
                n++;
            }
            const value = items[n];
            if (
                value?.kind === 'scalar' &&
                bare.has(value) &&
                value.text !== ';' &&
                n === k + 1 &&
                !LINE_BREAK.test(text.slice(item.end, value.start))
            ) {
                report('syntax/gui-missing-equals', value.start, value.end, [item.text]);
                const property: GuiProperty = {
                    kind: 'gui-property',
                    start: item.start,
                    end: value.end,
                    key: item,
                    operator: null,
                    value,
                };
                out.push(property);
                k = n;
                continue;
            }
            if (item.text === ';') {
                const before = out.findLast((o) => o.kind !== 'comment');
                report('syntax/gui-trailing-semicolon', item.start, item.end, [
                    before === undefined ? '' : endText(before),
                    'it is read as a value of its own',
                ]);
            } else {
                report('syntax/gui-value-without-key', item.start, item.end, [item.text]);
            }
            out.push(item);
        }
        return out;
    };

    /** Close the innermost block; `close` is its `}`, or null at the end of the file. */
    const closeFrame = (close: Token | null): void => {
        const frame = stack.pop();
        if (frame?.open == null || frame.finish === null) {
            return;
        }
        if (close === null) {
            report('syntax/gui-missing-closing-brace', frame.open.start, frame.open.end);
        }
        const block: GuiBlock = {
            kind: 'gui-block',
            start: frame.open.start,
            end: close === null ? text.length : close.end,
            items: finishItems(frame),
            closed: close !== null,
        };
        frame.finish(block);
    };

    /** `key = value` or `key = { ... }`, the key at token `k` and the operator at token `o`. */
    const readProperty = (frame: Frame, k: number, o: number): number => {
        const key = scalarOf(tokenAt(k));
        const operator = operatorOf(tokenAt(o));
        const slot = reserve(frame);
        frame.statements++;
        pushComments(frame, k, o);
        const v = significant(o + 1);
        const valueToken = tokenAt(v);
        const property = (value: Scalar | GuiBlock | null, end: number): GuiProperty => ({
            kind: 'gui-property',
            start: key.start,
            end,
            key,
            operator,
            value,
        });
        pushComments(frame, o + 1, v);
        if (valueToken.kind === 'open') {
            openBlock(valueToken, (block) => {
                frame.items[slot] = property(block, block.end);
            });
            return v + 1;
        }
        if (isScalarToken(valueToken)) {
            const value = scalarOf(valueToken);
            frame.items[slot] = property(value, value.end);
            return v + 1;
        }
        report('syntax/gui-missing-value', operator.start, operator.end, [key.text]);
        frame.items[slot] = property(null, operator.end);
        return o + 1;
    };

    /** `key { ... }` among statements: a property whose `=` is missing, at the `{` of token `b`. */
    const readMissingEquals = (frame: Frame, k: number, b: number): number => {
        const key = scalarOf(tokenAt(k));
        const open = tokenAt(b);
        report('syntax/gui-missing-equals', open.start, open.end, [key.text]);
        const slot = reserve(frame);
        frame.statements++;
        pushComments(frame, k + 1, b);
        openBlock(open, (block) => {
            frame.items[slot] = {
                kind: 'gui-property',
                start: key.start,
                end: block.end,
                key,
                operator: null,
                value: block,
            };
        });
        return b + 1;
    };

    /**
     * A named block: the keyword at token `k`, then an `=` at `o` (or null), its name at `n` (or
     * null) and its `{` at `b`.
     */
    const readNamed = (
        frame: Frame,
        k: number,
        o: number | null,
        n: number | null,
        b: number,
    ): number => {
        const keyword = scalarOf(tokenAt(k));
        const operator = o === null ? null : operatorOf(tokenAt(o));
        const name = n === null ? null : scalarOf(tokenAt(n));
        const open = tokenAt(b);
        if (name === null) {
            report('syntax/gui-missing-block-name', open.start, open.end, [keyword.text]);
        }
        const slot = reserve(frame);
        frame.statements++;
        pushComments(frame, k + 1, b);
        openBlock(open, (body) => {
            const named: GuiNamed = {
                kind: 'gui-named',
                start: keyword.start,
                end: body.end,
                keyword,
                operator,
                name,
                body,
            };
            frame.items[slot] = named;
        });
        return b + 1;
    };

    /**
     * A type definition: `type` or `local_type` at token `t`, its name at `n`, then an `=` at `o` (or null when
     * the name is followed by its block directly).
     */
    const readType = (frame: Frame, t: number, n: number, o: number | null): number => {
        const keyword = scalarOf(tokenAt(t));
        const name = scalarOf(tokenAt(n));
        const slot = reserve(frame);
        frame.statements++;
        const definition = (
            operator: Operator | null,
            base: Scalar | null,
            body: GuiBlock | null,
            end: number,
        ): GuiType => ({
            kind: 'gui-type',
            start: keyword.start,
            end,
            keyword,
            name,
            operator,
            base,
            body,
        });
        if (o === null) {
            const b = significant(n + 1);
            const open = tokenAt(b);
            report('syntax/gui-malformed-type', open.start, open.end, ["'= <base>' is missing"]);
            pushComments(frame, t + 1, b);
            openBlock(open, (body) => {
                frame.items[slot] = definition(null, null, body, body.end);
            });
            return b + 1;
        }
        const operator = operatorOf(tokenAt(o));
        pushComments(frame, t + 1, o);
        const v = significant(o + 1);
        const after = tokenAt(v);
        if (after.kind === 'open') {
            report('syntax/gui-malformed-type', after.start, after.end, [
                'its base type is missing',
            ]);
            pushComments(frame, o + 1, v);
            openBlock(after, (body) => {
                frame.items[slot] = definition(operator, null, body, body.end);
            });
            return v + 1;
        }
        if (!isScalarToken(after)) {
            report('syntax/gui-malformed-type', operator.start, operator.end, [
                'its base type and its block are missing',
            ]);
            frame.items[slot] = definition(operator, null, null, operator.end);
            return o + 1;
        }
        const base = scalarOf(after);
        const b = significant(v + 1);
        const open = tokenAt(b);
        pushComments(frame, o + 1, v);
        if (open.kind !== 'open') {
            report('syntax/gui-malformed-type', base.start, base.end, ['its block is missing']);
            frame.items[slot] = definition(operator, base, null, base.end);
            return v + 1;
        }
        pushComments(frame, v + 1, b);
        openBlock(open, (body) => {
            frame.items[slot] = definition(operator, base, body, body.end);
        });
        return b + 1;
    };

    let i = 0;
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
            } else {
                report('syntax/gui-unexpected-closing-brace', token.start, token.end);
            }
            i++;
            continue;
        }
        if (token.kind === 'open') {
            const slot = reserve(frame);
            frame.keyless.push(slot);
            openBlock(token, (block) => {
                frame.items[slot] = block;
            });
            i++;
            continue;
        }
        if (token.kind === 'operator') {
            report('syntax/gui-operator-without-key', token.start, token.end, [token.text]);
            // The value written after it is that statement's: kept, and not reported again.
            const v = significant(i + 1);
            const value = tokenAt(v);
            if (isScalarToken(value)) {
                pushComments(frame, i + 1, v);
                frame.items.push(scalarOf(value));
                i = v + 1;
                continue;
            }
            if (value.kind === 'open') {
                pushComments(frame, i + 1, v);
                const slot = reserve(frame);
                openBlock(value, (block) => {
                    frame.items[slot] = block;
                });
                i = v + 1;
                continue;
            }
            i++;
            continue;
        }

        // An item that starts with a scalar.
        const n = significant(i + 1);
        const next = tokenAt(n);
        const word = token.kind === 'word' ? text.slice(token.start, token.end) : null;
        if (word !== null && isTypeKeyword(word) && isScalarToken(next)) {
            const after = tokenAt(significant(n + 1));
            if (after.kind === 'operator') {
                i = readType(frame, i, n, significant(n + 1));
                continue;
            }
            if (after.kind === 'open') {
                i = readType(frame, i, n, null);
                continue;
            }
        }
        if (word !== null && isNamedKeyword(word)) {
            if (isScalarToken(next) && tokenAt(significant(n + 1)).kind === 'open') {
                i = readNamed(frame, i, null, n, significant(n + 1));
                continue;
            }
            if (next.kind === 'operator') {
                const m = significant(n + 1);
                if (isScalarToken(tokenAt(m)) && tokenAt(significant(m + 1)).kind === 'open') {
                    i = readNamed(frame, i, n, m, significant(m + 1));
                    continue;
                }
            }
            if (next.kind === 'open') {
                i = readNamed(frame, i, null, null, n);
                continue;
            }
        }
        if (next.kind === 'operator') {
            i = readProperty(frame, i, n);
            continue;
        }
        if (next.kind === 'open') {
            i = readMissingEquals(frame, i, n);
            continue;
        }
        const scalar = scalarOf(token);
        frame.items.push(scalar);
        frame.bare.push(frame.items.length - 1);
        i++;
    }
    while (stack.length > 1) {
        closeFrame(null);
    }
    return { items: finishItems(root), findings };
}

/** Parse a GUI file's text (docs/gui-syntax.md; a leading byte-order mark is removed). */
export function parseGui(source: string): GuiParseResult {
    const bom = source.charCodeAt(0) === 0xfeff;
    const text = bom ? source.slice(1) : source;
    const result = run(text);
    const lines = new LineIndex(text);
    return {
        text,
        bom,
        file: { kind: 'gui-file', start: 0, end: text.length, items: result.items },
        findings: [...result.findings]
            .sort(compareFindings)
            .map((f) => toFinding(f, lines, undefined)),
        lines,
    };
}

/** A GUI file read from its bytes: decoded as a script file is (docs/encoding.md), then parsed. */
export interface GuiSourceFile extends GuiParseResult {
    readonly encoding: 'utf-8' | FallbackEncoding;
    readonly validUtf8: boolean;
    readonly invalid: readonly InvalidStretch[];
}

/** Decode a GUI file's bytes and parse the text. */
export function readGui(bytes: Uint8Array, options: DecodeOptions = {}): GuiSourceFile {
    const decoded = decodeScript(bytes, options);
    const parsed = parseGui(decoded.text);
    return {
        ...parsed,
        bom: decoded.bom || parsed.bom,
        encoding: decoded.encoding,
        validUtf8: decoded.validUtf8,
        invalid: decoded.invalid,
    };
}
