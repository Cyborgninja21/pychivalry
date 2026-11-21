/**
 * Lexer for CK3 script.
 *
 * A bare word runs until whitespace, an operator character, a brace, a quote or '#',
 * exactly as the Paradox reader splits tokens; it is then classified (number, date,
 * constant, scope chain, identifier). `@[ ... ]` is read as one token up to its matching
 * ']'. A UTF-8 byte-order mark at the start is skipped without moving the column, so
 * positions match what an editor shows.
 */

import { ChainKind, Position, Range, ScopeChain } from './ast';

export enum TokenType {
    IDENTIFIER = 'IDENTIFIER',
    SCOPE_CHAIN = 'SCOPE_CHAIN',
    NUMBER = 'NUMBER',
    DATE = 'DATE',
    STRING = 'STRING',
    CONSTANT = 'CONSTANT',
    EXPRESSION = 'EXPRESSION',
    EQUALS = 'EQUALS',
    DOUBLE_EQUALS = 'DOUBLE_EQUALS',
    NOT_EQUALS = 'NOT_EQUALS',
    NULL_SAFE_EQUALS = 'NULL_SAFE_EQUALS',
    GREATER = 'GREATER',
    LESS = 'LESS',
    GREATER_EQUAL = 'GREATER_EQUAL',
    LESS_EQUAL = 'LESS_EQUAL',
    LEFT_BRACE = 'LEFT_BRACE',
    RIGHT_BRACE = 'RIGHT_BRACE',
    COMMENT = 'COMMENT',
    NEWLINE = 'NEWLINE',
    EOF = 'EOF',
}

export interface Token {
    type: TokenType;
    /** Token text; for strings the unescaped content, for `@[...]` the text between brackets. */
    value: string;
    range: Range;
    /** Scope chain parts, for SCOPE_CHAIN tokens. */
    chain?: ScopeChain;
    /** STRING: false when the closing quote is missing. EXPRESSION: false when ']' is missing. */
    terminated?: boolean;
}

export interface LexResult {
    tokens: Token[];
    bom: boolean;
}

const OPERATOR_TYPES: ReadonlySet<TokenType> = new Set([
    TokenType.EQUALS,
    TokenType.DOUBLE_EQUALS,
    TokenType.NOT_EQUALS,
    TokenType.NULL_SAFE_EQUALS,
    TokenType.GREATER,
    TokenType.LESS,
    TokenType.GREATER_EQUAL,
    TokenType.LESS_EQUAL,
]);

export function isOperator(type: TokenType): boolean {
    return OPERATOR_TYPES.has(type);
}

/** Token types that can stand as a key or a scalar value. */
const SCALAR_TYPES: ReadonlySet<TokenType> = new Set([
    TokenType.IDENTIFIER,
    TokenType.SCOPE_CHAIN,
    TokenType.NUMBER,
    TokenType.DATE,
    TokenType.STRING,
    TokenType.CONSTANT,
    TokenType.EXPRESSION,
]);

export function isScalar(type: TokenType): boolean {
    return SCALAR_TYPES.has(type);
}

/** Chain heads with a ':' whose kind the engine treats specially. */
const CHAIN_HEAD_KINDS: Readonly<Record<string, ChainKind>> = {
    scope: 'scope',
    var: 'var',
    local_var: 'local_var',
    global_var: 'global_var',
    flag: 'flag',
    value: 'value',
    event_target: 'event_target',
};

const NUMBER_RE = /^-?(\d+(\.\d+)?|\.\d+)$/;
const DATE_RE = /^-?\d+\.\d+\.\d+$/;
const SEGMENT_RE = /^[A-Za-z_$@][^.]*$/;

/** Characters that end a bare word. */
function isDelimiter(ch: string): boolean {
    return (
        ch === ' ' ||
        ch === '\t' ||
        ch === '\r' ||
        ch === '\n' ||
        ch === '\f' ||
        ch === '\v' ||
        ch === '{' ||
        ch === '}' ||
        ch === '=' ||
        ch === '<' ||
        ch === '>' ||
        ch === '#' ||
        ch === '"'
    );
}

/**
 * Split a bare word into a scope chain when it is one: it contains ':' or '.', is not a
 * number or a date, and every '.'-separated segment starts with a letter, '_', '$' or '@'.
 * Event ids such as `my_mod.0001` have a numeric segment and stay identifiers.
 */
export function classifyChain(text: string): ScopeChain | undefined {
    if (!text.includes('.') && !text.includes(':')) {
        return undefined;
    }
    if (NUMBER_RE.test(text) || DATE_RE.test(text)) {
        return undefined;
    }
    // Split on '.' outside of '|...|' parameter sections (value:sv|A|1.5|).
    const segments: string[] = [];
    let current = '';
    let inPipes = false;
    for (const ch of text) {
        if (ch === '|') {
            inPipes = !inPipes;
        }
        if (ch === '.' && !inPipes) {
            segments.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    segments.push(current);
    if (segments.some((s) => s.length === 0 || !SEGMENT_RE.test(s))) {
        return undefined;
    }
    const head = segments[0];
    const colon = head.indexOf(':');
    if (colon < 0) {
        if (segments.length < 2) {
            return undefined;
        }
        return { kind: 'plain', head, segments };
    }
    const prefix = head.slice(0, colon);
    const name = head.slice(colon + 1);
    const kind: ChainKind = CHAIN_HEAD_KINDS[prefix] ?? 'link';
    return { kind, head, prefix, name, segments };
}

export class Lexer {
    private text = '';
    private position = 0;
    private line = 0;
    private column = 0;
    private tokens: Token[] = [];

    public tokenize(input: string): LexResult {
        this.text = input;
        this.position = 0;
        this.line = 0;
        this.column = 0;
        this.tokens = [];

        let bom = false;
        if (this.text.charCodeAt(0) === 0xfeff) {
            bom = true;
            this.position = 1; // skipped without advancing the column
        }

        while (this.position < this.text.length) {
            const ch = this.text[this.position];

            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v') {
                this.advanceChar();
                continue;
            }
            if (ch === '\n') {
                this.pushFixed(TokenType.NEWLINE, '\n');
                this.advanceChar();
                this.line++;
                this.column = 0;
                continue;
            }
            if (ch === '#') {
                this.readComment();
                continue;
            }
            if (ch === '"') {
                this.readString();
                continue;
            }
            if (ch === '?' && this.peek() === '=') {
                this.pushOperator(TokenType.NULL_SAFE_EQUALS, '?=');
                continue;
            }
            if (ch === '!' && this.peek() === '=') {
                this.pushOperator(TokenType.NOT_EQUALS, '!=');
                continue;
            }
            if (ch === '=') {
                if (this.peek() === '=') {
                    this.pushOperator(TokenType.DOUBLE_EQUALS, '==');
                } else {
                    this.pushOperator(TokenType.EQUALS, '=');
                }
                continue;
            }
            if (ch === '>') {
                if (this.peek() === '=') {
                    this.pushOperator(TokenType.GREATER_EQUAL, '>=');
                } else {
                    this.pushOperator(TokenType.GREATER, '>');
                }
                continue;
            }
            if (ch === '<') {
                if (this.peek() === '=') {
                    this.pushOperator(TokenType.LESS_EQUAL, '<=');
                } else {
                    this.pushOperator(TokenType.LESS, '<');
                }
                continue;
            }
            if (ch === '{') {
                this.pushOperator(TokenType.LEFT_BRACE, '{');
                continue;
            }
            if (ch === '}') {
                this.pushOperator(TokenType.RIGHT_BRACE, '}');
                continue;
            }
            if (ch === '@' && this.peek() === '[') {
                this.readExpression();
                continue;
            }
            this.readWord();
        }

        this.tokens.push({
            type: TokenType.EOF,
            value: '',
            range: { start: this.pos(), end: this.pos() },
        });
        return { tokens: this.tokens, bom };
    }

    private pos(): Position {
        return { line: this.line, character: this.column };
    }

    private advanceChar(): void {
        if (this.position < this.text.length) {
            this.position++;
            this.column++;
        }
    }

    private peek(): string {
        return this.position + 1 < this.text.length ? this.text[this.position + 1] : '\0';
    }

    private pushFixed(type: TokenType, value: string): void {
        const start = this.pos();
        this.tokens.push({
            type,
            value,
            range: { start, end: { line: start.line, character: start.character + value.length } },
        });
    }

    private pushOperator(type: TokenType, value: string): void {
        this.pushFixed(type, value);
        for (let i = 0; i < value.length; i++) {
            this.advanceChar();
        }
    }

    private readComment(): void {
        const start = this.pos();
        let value = '';
        while (this.position < this.text.length && this.text[this.position] !== '\n') {
            value += this.text[this.position];
            this.advanceChar();
        }
        // A trailing '\r' belongs to the line ending, not the comment text.
        if (value.endsWith('\r')) {
            value = value.slice(0, -1);
        }
        this.tokens.push({ type: TokenType.COMMENT, value, range: { start, end: this.pos() } });
    }

    private readString(): void {
        const start = this.pos();
        this.advanceChar(); // opening quote
        let value = '';
        let terminated = false;
        while (this.position < this.text.length) {
            const ch = this.text[this.position];
            if (ch === '"') {
                terminated = true;
                this.advanceChar();
                break;
            }
            if (ch === '\\') {
                const next = this.peek();
                if (next === '"' || next === '\\') {
                    this.advanceChar();
                    value += next;
                    this.advanceChar();
                    continue;
                }
            }
            value += ch;
            this.advanceChar();
            if (ch === '\n') {
                this.line++;
                this.column = 0;
            }
        }
        this.tokens.push({
            type: TokenType.STRING,
            value,
            range: { start, end: this.pos() },
            terminated,
        });
    }

    private readExpression(): void {
        const start = this.pos();
        this.advanceChar(); // @
        this.advanceChar(); // [
        let depth = 1;
        let value = '';
        while (this.position < this.text.length) {
            const ch = this.text[this.position];
            if (ch === '[') {
                depth++;
            } else if (ch === ']') {
                depth--;
                if (depth === 0) {
                    this.advanceChar();
                    break;
                }
            } else if (ch === '\n') {
                // An inline expression never spans lines; stop so the rest of the file lexes.
                break;
            }
            value += ch;
            this.advanceChar();
        }
        this.tokens.push({
            type: TokenType.EXPRESSION,
            value,
            range: { start, end: this.pos() },
            terminated: depth === 0,
        });
    }

    private readWord(): void {
        const start = this.pos();
        let value = '';
        while (this.position < this.text.length) {
            const ch = this.text[this.position];
            if (isDelimiter(ch)) {
                break;
            }
            if ((ch === '?' || ch === '!') && this.peek() === '=') {
                break;
            }
            value += ch;
            this.advanceChar();
        }
        if (value.length === 0) {
            // A lone character that cannot start any token ('?' or '!' not before '=').
            value = this.text[this.position];
            this.advanceChar();
        }
        const range = { start, end: this.pos() };
        if (DATE_RE.test(value)) {
            this.tokens.push({ type: TokenType.DATE, value, range });
        } else if (NUMBER_RE.test(value)) {
            this.tokens.push({ type: TokenType.NUMBER, value, range });
        } else if (value.startsWith('@')) {
            this.tokens.push({ type: TokenType.CONSTANT, value, range });
        } else {
            const chain = classifyChain(value);
            if (chain) {
                this.tokens.push({ type: TokenType.SCOPE_CHAIN, value, range, chain });
            } else {
                this.tokens.push({ type: TokenType.IDENTIFIER, value, range });
            }
        }
    }
}
