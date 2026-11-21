/**
 * CK3 script parser: text → AST plus parse errors with the engine's own message texts.
 *
 * Ported from the extension's `core/parser.ts` (same node shape and position model) and
 * extended to the grammar vanilla 1.20 actually uses: bare-value lists, date literals,
 * `@name = value` constants and `@name` references, full `@[ ... ]` arithmetic, a leading
 * UTF-8 BOM, scope chains as single tokens, `?=` only after a scope reference or
 * identifier, comparisons on identifiers and chains, and newlines anywhere between a key,
 * its operator and its value.
 */

import { defaultSpec, Spec } from '../spec/spec';
import { messageText } from '../messages';
import { ASTNode, NodeType, ParsedDocument, ParseError, Position, TokenKind } from './ast';
import { ExpressionError, parseExpression } from './expression';
import { isOperator, isScalar, Lexer, Token, TokenType } from './lexer';

export { NodeType } from './ast';
export type {
    ASTNode,
    ChainKind,
    Expr,
    ParsedDocument,
    ParseError,
    Position,
    Range,
    ScopeChain,
    TokenKind,
} from './ast';

/** Value prefixes that take a bare-number block: `color = rgb { 255 0 0 }`. */
const COLOR_PREFIXES: ReadonlySet<string> = new Set([
    'rgb',
    'hsv',
    'hsv360',
    'RGB',
    'HSV',
    'HSV360',
]);

/** Key prefixes of file-local definitions: `scripted_trigger name = { ... }`. */
/** A scripted-effect parameter standing where an operator goes: `count $OPERATOR$ 3`. */
const PARAMETER_RE = /^\$[A-Za-z0-9_]+\$$/;

const DEFINITION_PREFIXES: ReadonlySet<string> = new Set(['scripted_trigger', 'scripted_effect']);

export interface ParserOptions {
    /** Source of message texts; the bundled spec when omitted. */
    spec?: Spec;
    /** File name used in "found at" locations (mod-relative path). */
    file?: string;
}

interface BareItem {
    node: ASTNode;
    token: Token;
    next: Token;
}

interface AdjacentBlock {
    value: ASTNode;
    block: ASTNode;
    keyToken: Token;
    brace: Token;
}

interface ItemsResult {
    children: ASTNode[];
    statements: number;
    bare: BareItem[];
}

function tokenKind(token: Token): TokenKind {
    switch (token.type) {
        case TokenType.SCOPE_CHAIN:
            return 'chain';
        case TokenType.NUMBER:
            return 'number';
        case TokenType.DATE:
            return 'date';
        case TokenType.STRING:
            return 'string';
        case TokenType.CONSTANT:
            return 'constant';
        case TokenType.EXPRESSION:
            return 'expression';
        default:
            return token.value === 'yes' || token.value === 'no' ? 'bool' : 'identifier';
    }
}

/**
 * CK3 Script Parser
 */
export class CK3Parser {
    private tokens: Token[] = [];
    private index = 0;
    private errors: ParseError[] = [];
    private constants = new Map<string, ASTNode>();
    private spec: Spec | undefined;
    private file: string | undefined;
    private depth = 0;

    constructor(options: ParserOptions = {}) {
        this.spec = options.spec;
        this.file = options.file;
    }

    /** Change the file name used in error locations for subsequent parses. */
    public setFile(file: string | undefined): void {
        this.file = file;
    }

    /**
     * Parse CK3 script text into an AST
     */
    public parse(text: string): ParsedDocument {
        const lexed = new Lexer().tokenize(text);
        this.tokens = lexed.tokens;
        this.index = 0;
        this.errors = [];
        this.constants = new Map();
        this.depth = 0;

        const ast = this.parseRoot();
        return { ast, errors: this.errors, bom: lexed.bom, constants: this.constants };
    }

    // ── structure ────────────────────────────────────────────────────────

    private parseRoot(): ASTNode {
        const start = this.current().range.start;
        const items = this.parseItems(true);
        for (const bare of items.bare) {
            this.reportBare(bare, items.bare);
        }
        return {
            type: NodeType.ROOT,
            range: { start, end: this.current().range.start },
            children: items.children,
        };
    }

    /**
     * Parse statements and bare items until '}' (blocks) or EOF (root). The closing brace
     * is not consumed.
     */
    private parseItems(isRoot: boolean): ItemsResult {
        const children: ASTNode[] = [];
        const bare: BareItem[] = [];
        const adjacent: AdjacentBlock[] = [];
        let statements = 0;

        for (;;) {
            const token = this.current();
            if (token.type === TokenType.EOF) {
                break;
            }
            if (token.type === TokenType.NEWLINE) {
                this.index++;
                continue;
            }
            if (token.type === TokenType.COMMENT) {
                children.push(this.commentNode(token));
                this.index++;
                continue;
            }
            if (token.type === TokenType.RIGHT_BRACE) {
                if (!isRoot) {
                    break;
                }
                this.error('unexpected_token_expected_key', token, []);
                this.index++;
                continue;
            }
            if (token.type === TokenType.LEFT_BRACE) {
                // Anonymous block item: `{ { 1 2 } { 3 4 } }`
                if (isRoot) {
                    this.error('unexpected_token_expected_key', token, []);
                }
                children.push(this.parseBlockBody(undefined, token.range.start, token));
                continue;
            }
            if (isOperator(token.type)) {
                // An operator with no key in front of it.
                this.error('unexpected_token_expected_key', token, []);
                this.index++;
                continue;
            }
            if (!isScalar(token.type)) {
                this.index++;
                continue;
            }

            const nextIndex = this.significant(this.index + 1);
            const next = this.tokens[nextIndex];
            if (
                token.type === TokenType.IDENTIFIER &&
                DEFINITION_PREFIXES.has(token.value) &&
                (next.type === TokenType.IDENTIFIER || next.type === TokenType.SCOPE_CHAIN)
            ) {
                // `scripted_trigger name = { ... }`: a file-local scripted trigger or effect.
                const opIndex = this.significant(nextIndex + 1);
                const op = this.tokens[opIndex];
                if (isOperator(op.type)) {
                    this.index = opIndex;
                    const node = this.parseStatement(next, op);
                    node.keyPrefix = token.value;
                    node.range = { start: token.range.start, end: node.range.end };
                    children.push(node);
                    statements++;
                    continue;
                }
            }
            if (isOperator(next.type)) {
                const comments = this.skippedComments(this.index + 1, nextIndex);
                this.index = nextIndex;
                children.push(this.parseStatement(token, next));
                children.push(...comments);
                statements++;
                continue;
            }
            if (next.type === TokenType.LEFT_BRACE) {
                if (token.type === TokenType.IDENTIFIER && COLOR_PREFIXES.has(token.value)) {
                    // Bare color value inside a list: `{ rgb { 1 2 3 } }`
                    this.index = nextIndex;
                    const list = this.parseBlockBody(undefined, token.range.start, next);
                    list.value = token.value;
                    list.valueKind = 'color';
                    children.push(list);
                    continue;
                }
                // A value followed by an anonymous block. In a list (`{ dynn_a { "p" "b" } }`)
                // that is two items; among statements it is `key { ... }` with the '='
                // missing, which is decided once the whole block has been read.
                const valueNode = this.valueNode(token);
                children.push(valueNode);
                this.index = nextIndex;
                const block = this.parseBlockBody(undefined, next.range.start, next);
                children.push(block);
                adjacent.push({ value: valueNode, block, keyToken: token, brace: next });
                continue;
            }

            if (next.type === TokenType.IDENTIFIER && PARAMETER_RE.test(next.value)) {
                // `count $OPERATOR$ $COUNT$`: the operator is a scripted-effect parameter.
                const valueIndex = this.significant(nextIndex + 1);
                const valueToken = this.tokens[valueIndex];
                if (isScalar(valueToken.type) || valueToken.type === TokenType.LEFT_BRACE) {
                    this.index = nextIndex;
                    children.push(this.parseStatement(token, next));
                    statements++;
                    continue;
                }
            }

            // A bare value.
            const node = this.valueNode(token);
            children.push(node);
            bare.push({ node, token, next });
            this.index++;
        }

        if (adjacent.length > 0 && (statements > 0 || isRoot)) {
            // Among statements, `key { ... }` is a block whose '=' is missing.
            for (const pair of adjacent) {
                const at = children.indexOf(pair.value);
                if (at < 0 || children[at + 1] !== pair.block) {
                    continue;
                }
                this.error('expected_between_block_name_and_body', pair.brace, []);
                const merged = pair.block;
                merged.key = pair.keyToken.value;
                merged.range = { start: pair.keyToken.range.start, end: merged.range.end };
                merged.operator = '=';
                this.decorateKey(merged, pair.keyToken);
                children.splice(at, 1);
                statements++;
                const b = bare.findIndex((x) => x.node === pair.value);
                if (b >= 0) {
                    bare.splice(b, 1);
                }
            }
        }

        return { children, statements, bare };
    }

    /**
     * `{ ... }` with the opening brace at the current index. Returns a BLOCK, or a LIST
     * when every item is a bare value. Reports unclosed braces at the opening brace.
     */
    private parseBlockBody(key: string | undefined, start: Position, open: Token): ASTNode {
        this.index++; // consume '{'
        this.depth++;
        const items = this.parseItems(false);
        this.depth--;
        const end = this.current().range.start;
        const close = this.current();
        if (close.type === TokenType.RIGHT_BRACE) {
            this.index++;
        } else {
            this.error('expected_after_arguments', open, []);
        }

        const significant = items.children.filter((c) => c.type !== NodeType.COMMENT);
        const isList =
            significant.length > 0 &&
            items.statements === 0 &&
            significant.every((c) => c.type === NodeType.VALUE);

        const node: ASTNode = {
            type: isList ? NodeType.LIST : NodeType.BLOCK,
            children: items.children,
            range: { start, end },
        };
        if (key !== undefined) {
            node.key = key;
        }
        return node;
    }

    /** Key token at index-before-operator; `op` is the operator at the current index. */
    private parseStatement(keyToken: Token, op: Token): ASTNode {
        this.index++; // consume operator
        const operator = op.value;

        if (op.type === TokenType.NULL_SAFE_EQUALS) {
            const ok =
                keyToken.type === TokenType.IDENTIFIER || keyToken.type === TokenType.SCOPE_CHAIN;
            if (!ok) {
                this.error('unexpected_token_X_found_at_X_expected', op, [
                    op.value,
                    this.where(op),
                ]);
            }
        }

        const valueIndex = this.significant(this.index);
        const valueToken = this.tokens[valueIndex];
        const comments = this.skippedComments(this.index, valueIndex);

        if (valueToken.type === TokenType.LEFT_BRACE) {
            this.index = valueIndex;
            const node = this.parseBlockBody(keyToken.value, keyToken.range.start, valueToken);
            this.decorateKey(node, keyToken);
            if (operator !== '=') {
                node.operator = operator;
            }
            this.pushComments(node, comments);
            return node;
        }

        if (isScalar(valueToken.type)) {
            this.index = valueIndex + 1;
            if (valueToken.type === TokenType.IDENTIFIER && valueToken.value === 'list') {
                const nameIndex = this.significant(this.index);
                const name = this.tokens[nameIndex];
                if (name.type === TokenType.STRING) {
                    // `pattern = list "faction_patterns_list"`: a named random list.
                    this.index = nameIndex + 1;
                    const node: ASTNode = {
                        type: NodeType.ASSIGNMENT,
                        key: keyToken.value,
                        value: name.value,
                        range: { start: keyToken.range.start, end: name.range.end },
                    };
                    this.decorateKey(node, keyToken);
                    this.decorateValue(node, name);
                    node.valueKind = 'list';
                    node.valueRange = { start: valueToken.range.start, end: name.range.end };
                    if (operator !== '=') {
                        node.operator = operator;
                    }
                    this.pushComments(node, comments);
                    return node;
                }
            }
            if (valueToken.type === TokenType.IDENTIFIER && COLOR_PREFIXES.has(valueToken.value)) {
                const braceIndex = this.significant(this.index);
                const brace = this.tokens[braceIndex];
                if (brace.type === TokenType.LEFT_BRACE) {
                    this.index = braceIndex;
                    const node = this.parseBlockBody(keyToken.value, keyToken.range.start, brace);
                    this.decorateKey(node, keyToken);
                    node.type = NodeType.LIST;
                    node.value = valueToken.value;
                    node.valueKind = 'color';
                    node.valueRange = valueToken.range;
                    if (operator !== '=') {
                        node.operator = operator;
                    }
                    this.pushComments(node, comments);
                    return node;
                }
            }
            const isComparison =
                op.type !== TokenType.EQUALS && op.type !== TokenType.NULL_SAFE_EQUALS;
            const node: ASTNode = {
                type: isComparison ? NodeType.COMPARISON : NodeType.ASSIGNMENT,
                key: keyToken.value,
                value: this.scalarValue(valueToken, true),
                range: { start: keyToken.range.start, end: valueToken.range.end },
            };
            if (isComparison || op.type === TokenType.NULL_SAFE_EQUALS) {
                node.operator = operator;
            }
            this.decorateKey(node, keyToken);
            this.decorateValue(node, valueToken);
            if (
                keyToken.type === TokenType.CONSTANT &&
                op.type === TokenType.EQUALS &&
                this.isTopLevel()
            ) {
                this.constants.set(keyToken.value, node);
            }
            this.pushComments(node, comments);
            return node;
        }

        if (op.type === TokenType.EQUALS && isOperator(valueToken.type)) {
            // `OPERATOR = <=`: an operator passed as a scripted-effect argument.
            this.index = valueIndex + 1;
            const node: ASTNode = {
                type: NodeType.ASSIGNMENT,
                key: keyToken.value,
                value: valueToken.value,
                range: { start: keyToken.range.start, end: valueToken.range.end },
            };
            this.decorateKey(node, keyToken);
            node.valueKind = 'identifier';
            node.valueRange = valueToken.range;
            this.pushComments(node, comments);
            return node;
        }

        // Operator with no value after it.
        this.error('expected_between_equals_and_arguments', valueToken, []);
        const node: ASTNode = {
            type: NodeType.ASSIGNMENT,
            key: keyToken.value,
            value: '',
            range: { start: keyToken.range.start, end: op.range.end },
        };
        if (operator !== '=') {
            node.operator = operator;
        }
        this.decorateKey(node, keyToken);
        return node;
    }

    // ── nodes ────────────────────────────────────────────────────────────

    private commentNode(token: Token): ASTNode {
        return { type: NodeType.COMMENT, value: token.value, range: token.range };
    }

    private valueNode(token: Token): ASTNode {
        const node: ASTNode = {
            type: NodeType.VALUE,
            value: this.scalarValue(token, false),
            range: token.range,
        };
        this.decorateValue(node, token);
        return node;
    }

    /**
     * Value of a scalar token. Statement values convert numbers and yes/no as before;
     * list items keep their text (as the extension's parser did).
     */
    private scalarValue(token: Token, convert: boolean): string | number | boolean {
        if (token.type === TokenType.EXPRESSION) {
            return `@[${token.value}]`;
        }
        if (!convert) {
            return token.value;
        }
        if (token.type === TokenType.NUMBER) {
            return parseFloat(token.value);
        }
        if (
            token.type === TokenType.IDENTIFIER &&
            (token.value === 'yes' || token.value === 'no')
        ) {
            return token.value === 'yes';
        }
        return token.value;
    }

    private decorateKey(node: ASTNode, token: Token): void {
        node.keyKind = tokenKind(token);
        node.keyRange = token.range;
        if (token.chain) {
            node.keyChain = token.chain;
        }
    }

    private decorateValue(node: ASTNode, token: Token): void {
        node.valueKind = tokenKind(token);
        node.valueRange = token.range;
        if (token.chain) {
            node.valueChain = token.chain;
        }
        if (token.type === TokenType.STRING && token.terminated === false) {
            this.error('PYCH-P001', token, [this.where(token)]);
        }
        if (token.type === TokenType.EXPRESSION) {
            if (token.terminated === false) {
                this.error('PYCH-P002', token, [token.value, "missing ']'"]);
            } else {
                try {
                    node.expression = parseExpression(token.value);
                } catch (e) {
                    const reason = e instanceof ExpressionError ? e.message : String(e);
                    this.error('PYCH-P002', token, [token.value, reason]);
                }
            }
        }
    }

    private pushComments(node: ASTNode, comments: ASTNode[]): void {
        if (comments.length > 0 && node.children) {
            node.children.unshift(...comments);
        }
    }

    // ── errors ───────────────────────────────────────────────────────────

    /**
     * A bare value among statements: the engine read it as a key and found the next token
     * where it expected '='. A bare item that is itself the "next" of an earlier one is
     * not reported again.
     */
    private reportBare(bare: BareItem, all: BareItem[]): void {
        if (all.some((other) => other !== bare && other.next === bare.token)) {
            return;
        }
        const next = bare.next;
        const text = next.type === TokenType.EOF ? '' : next.value;
        this.error('unexpected_token_X_found_at_X_expected', next, [text, this.where(next)]);
    }

    private where(token: Token): string {
        const line = token.range.start.line + 1;
        return this.file ? `${this.file}:${line}` : `line ${line}`;
    }

    private error(id: string, token: Token, args: Array<string | number>): void {
        const spec = this.spec ?? defaultSpec();
        this.errors.push({
            message: messageText(spec, id, ...args),
            range: { start: token.range.start, end: token.range.end },
            severity: 'error',
            code: id,
        });
    }

    // ── token navigation ─────────────────────────────────────────────────

    private current(): Token {
        return this.tokens[Math.min(this.index, this.tokens.length - 1)];
    }

    /** Index of the first token at or after `from` that is not a newline or comment. */
    private significant(from: number): number {
        let i = from;
        while (
            i < this.tokens.length - 1 &&
            (this.tokens[i].type === TokenType.NEWLINE || this.tokens[i].type === TokenType.COMMENT)
        ) {
            i++;
        }
        return Math.min(i, this.tokens.length - 1);
    }

    private skippedComments(from: number, to: number): ASTNode[] {
        const out: ASTNode[] = [];
        for (let i = from; i < to; i++) {
            if (this.tokens[i].type === TokenType.COMMENT) {
                out.push(this.commentNode(this.tokens[i]));
            }
        }
        return out;
    }

    private isTopLevel(): boolean {
        return this.depth === 0;
    }
}

/**
 * Caching wrapper around CK3Parser.
 *
 * Keeps a small content-based LRU cache so that repeated calls to
 * `parse(text)` with the same text content return the cached result
 * instead of re-tokenizing and re-parsing.
 */
export class CachingParser extends CK3Parser {
    private contentCache = new Map<string, { result: ParsedDocument; timestamp: number }>();
    private readonly maxCacheSize: number;
    private clock = 0;

    constructor(maxCacheSize = 5, options: ParserOptions = {}) {
        super(options);
        this.maxCacheSize = maxCacheSize;
    }

    public override parse(text: string): ParsedDocument {
        const cached = this.contentCache.get(text);
        if (cached) {
            return cached.result;
        }

        const result = super.parse(text);

        // Evict oldest entry if cache is full
        if (this.contentCache.size >= this.maxCacheSize) {
            let oldestKey: string | undefined;
            let oldestTime = Infinity;
            for (const [key, entry] of this.contentCache) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey !== undefined) {
                this.contentCache.delete(oldestKey);
            }
        }

        this.contentCache.set(text, { result, timestamp: ++this.clock });
        return result;
    }

    /** Remove all cached parse results. */
    public clearContentCache(): void {
        this.contentCache.clear();
    }
}
