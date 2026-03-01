/**
 * CK3 Script Parser - Converts CK3 script text into an Abstract Syntax Tree (AST)
 * 
 * This parser handles the Paradox Development Studio script format used in CK3,
 * which is a key-value based structure with support for:
 * - Simple assignments: key = value
 * - Block structures: key = { ... }
 * - Lists: key = { value1 value2 value3 }
 * - Comparisons: key > value, key < value, key >= value, key <= value
 * - Nested structures
 * - Comments (# single-line)
 */

export enum NodeType {
    ROOT = 'ROOT',
    ASSIGNMENT = 'ASSIGNMENT',
    BLOCK = 'BLOCK',
    LIST = 'LIST',
    VALUE = 'VALUE',
    COMPARISON = 'COMPARISON',
    COMMENT = 'COMMENT',
}

export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface ASTNode {
    type: NodeType;
    range: Range;
    raw?: string;
    children?: ASTNode[];
    key?: string;
    value?: string | number | boolean;
    operator?: string;
}

export interface ParsedDocument {
    ast: ASTNode;
    errors: ParseError[];
}

export interface ParseError {
    message: string;
    range: Range;
    severity: 'error' | 'warning';
}

/**
 * Token types for lexical analysis
 */
enum TokenType {
    IDENTIFIER = 'IDENTIFIER',
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
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    COMMENT = 'COMMENT',
    NEWLINE = 'NEWLINE',
    EOF = 'EOF',
}

interface Token {
    type: TokenType;
    value: string;
    range: Range;
}

/**
 * CK3 Script Parser
 */
export class CK3Parser {
    private text: string = '';
    private position: number = 0;
    private line: number = 0;
    private column: number = 0;
    private tokens: Token[] = [];
    private tokenIndex: number = 0;
    private errors: ParseError[] = [];

    /**
     * Parse CK3 script text into an AST
     */
    public parse(text: string): ParsedDocument {
        this.text = text;
        this.position = 0;
        this.line = 0;
        this.column = 0;
        this.errors = [];

        // Tokenize
        this.tokens = this.tokenize();
        this.tokenIndex = 0;

        // Parse
        const ast = this.parseRoot();

        return {
            ast,
            errors: this.errors,
        };
    }

    /**
     * Tokenize the input text
     */
    private tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.position < this.text.length) {
            const char = this.text[this.position];

            // Skip whitespace (except newlines)
            if (char === ' ' || char === '\t' || char === '\r') {
                this.advanceChar();
                continue;
            }

            // Newline
            if (char === '\n') {
                tokens.push(this.createToken(TokenType.NEWLINE, '\n'));
                this.advanceChar();
                this.line++;
                this.column = 0;
                continue;
            }

            // Comment
            if (char === '#') {
                tokens.push(this.readComment());
                continue;
            }

            // String (quoted)
            if (char === '"') {
                tokens.push(this.readString());
                continue;
            }

            // Operators
            if (char === '?' && this.peek() === '=') {
                tokens.push(this.createToken(TokenType.NULL_SAFE_EQUALS, '?='));
                this.advanceChar();
                this.advanceChar();
                continue;
            }

            if (char === '!' && this.peek() === '=') {
                tokens.push(this.createToken(TokenType.NOT_EQUALS, '!='));
                this.advanceChar();
                this.advanceChar();
                continue;
            }

            if (char === '=') {
                if (this.peek() === '=') {
                    tokens.push(this.createToken(TokenType.DOUBLE_EQUALS, '=='));
                    this.advanceChar();
                    this.advanceChar();
                } else {
                    tokens.push(this.createToken(TokenType.EQUALS, '='));
                    this.advanceChar();
                }
                continue;
            }

            if (char === '>') {
                if (this.peek() === '=') {
                    tokens.push(this.createToken(TokenType.GREATER_EQUAL, '>='));
                    this.advanceChar();
                    this.advanceChar();
                } else {
                    tokens.push(this.createToken(TokenType.GREATER, '>'));
                    this.advanceChar();
                }
                continue;
            }

            if (char === '<') {
                if (this.peek() === '=') {
                    tokens.push(this.createToken(TokenType.LESS_EQUAL, '<='));
                    this.advanceChar();
                    this.advanceChar();
                } else {
                    tokens.push(this.createToken(TokenType.LESS, '<'));
                    this.advanceChar();
                }
                continue;
            }

            // Braces
            if (char === '{') {
                tokens.push(this.createToken(TokenType.LEFT_BRACE, '{'));
                this.advanceChar();
                continue;
            }

            if (char === '}') {
                tokens.push(this.createToken(TokenType.RIGHT_BRACE, '}'));
                this.advanceChar();
                continue;
            }

            // Number
            if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek()) && (this.column === 0 || /\s/.test(this.text[this.position - 1])))) {
                tokens.push(this.readNumber());
                continue;
            }

            // Variable interpolation @[expr]
            if (char === '@' && this.peek() === '[') {
                tokens.push(this.readVariableInterpolation());
                continue;
            }

            // Identifier
            if (this.isIdentifierStart(char)) {
                tokens.push(this.readIdentifier());
                continue;
            }

            // Unknown character - skip it
            this.advanceChar();
        }

        tokens.push(this.createToken(TokenType.EOF, ''));
        return tokens;
    }

    /**
     * Parse root node
     */
    private parseRoot(): ASTNode {
        const children: ASTNode[] = [];
        const startPos = this.getCurrentPosition();

        while (!this.isAtEnd()) {
            // Skip newlines and comments at root level
            if (this.match(TokenType.NEWLINE)) {
                continue;
            }

            if (this.check(TokenType.COMMENT)) {
                children.push(this.parseComment());
                continue;
            }

            // Stray closing brace at root level — no block is open
            if (this.check(TokenType.RIGHT_BRACE)) {
                const bracePos = this.getCurrentPosition();
                this.advance();
                this.addError('Extra closing brace (no matching "{")', bracePos);
                continue;
            }

            // Parse assignment or block
            const node = this.parseStatement();
            if (node) {
                children.push(node);
            }
        }

        return {
            type: NodeType.ROOT,
            range: {
                start: startPos,
                end: this.getCurrentPosition(),
            },
            children,
        };
    }

    /**
     * Parse a statement (assignment, comparison, or block)
     */
    private parseStatement(depth: number = 0): ASTNode | null {
        // Must start with an identifier or number (for random_list weights)
        if (!this.check(TokenType.IDENTIFIER) && !this.check(TokenType.NUMBER)) {
            this.skipToNextStatement();
            return null;
        }

        const key = this.advance().value;
        const startPos = this.tokens[this.tokenIndex - 1].range.start;

        // Check operator
        if (this.match(TokenType.EQUALS)) {
            return this.parseAssignment(key, startPos, depth);
        } else if (this.match(TokenType.NULL_SAFE_EQUALS)) {
            const node = this.parseAssignment(key, startPos, depth);
            if (node) {
                node.operator = '?=';
            }
            return node;
        } else if (this.check(TokenType.GREATER) || this.check(TokenType.LESS) ||
            this.check(TokenType.GREATER_EQUAL) || this.check(TokenType.LESS_EQUAL) ||
            this.check(TokenType.DOUBLE_EQUALS) || this.check(TokenType.NOT_EQUALS)) {
            return this.parseComparison(key, startPos);
        } else {
            this.addError('Expected operator (=, ==, !=, >, <, >=, <=, ?=) after key', startPos);
            this.skipToNextStatement();
            return null;
        }
    }

    /**
     * Parse assignment (key = value or key = { ... })
     */
    private parseAssignment(key: string, startPos: Position, depth: number = 0): ASTNode {
        // Check if it's a block or simple value
        if (this.check(TokenType.LEFT_BRACE)) {
            return this.parseBlock(key, startPos, depth);
        } else {
            return this.parseSimpleAssignment(key, startPos);
        }
    }

    /**
     * Parse simple assignment (key = value)
     */
    private parseSimpleAssignment(key: string, startPos: Position): ASTNode {
        const valueToken = this.advance();

        let value: string | number | boolean = valueToken.value;

        // Convert to appropriate type
        if (valueToken.type === TokenType.NUMBER) {
            value = parseFloat(valueToken.value);
        } else if (valueToken.value === 'yes' || valueToken.value === 'no') {
            value = valueToken.value === 'yes';
        }

        return {
            type: NodeType.ASSIGNMENT,
            key,
            value,
            range: {
                start: startPos,
                end: valueToken.range.end,
            },
        };
    }

    /**
     * Parse block (key = { ... })
     */
    private parseBlock(key: string, startPos: Position, depth: number = 0): ASTNode {
        const openBraceToken = this.tokens[this.tokenIndex];
        this.advance(); // consume {

        const children: ASTNode[] = [];

        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            // Skip newlines
            if (this.match(TokenType.NEWLINE)) {
                continue;
            }

            // Handle comments
            if (this.check(TokenType.COMMENT)) {
                children.push(this.parseComment());
                continue;
            }

            // Check if it's a list (no key, just values)
            if (!this.checkNext(TokenType.EQUALS) &&
                !this.checkNext(TokenType.DOUBLE_EQUALS) &&
                !this.checkNext(TokenType.NOT_EQUALS) &&
                !this.checkNext(TokenType.NULL_SAFE_EQUALS) &&
                !this.checkNext(TokenType.GREATER) &&
                !this.checkNext(TokenType.LESS) &&
                !this.checkNext(TokenType.GREATER_EQUAL) &&
                !this.checkNext(TokenType.LESS_EQUAL)) {
                // Parse as list items
                const value = this.advance().value;
                children.push({
                    type: NodeType.VALUE,
                    value,
                    range: {
                        start: this.tokens[this.tokenIndex - 1].range.start,
                        end: this.tokens[this.tokenIndex - 1].range.end,
                    },
                });
                continue;
            }

            // Parse statement
            const stmt = this.parseStatement(depth + 1);
            if (stmt) {
                children.push(stmt);
            }
        }

        const endPos = this.getCurrentPosition();

        if (this.match(TokenType.RIGHT_BRACE)) {
            // Success
        } else {
            // Report unclosed brace at the opening brace position
            this.addError(
                `Unclosed brace (missing "}")`,
                openBraceToken.range.start
            );
        }

        // Determine if it's a list (all children are values) or a block
        const isListNodes = children.length > 0 && children.every(c => c.type === NodeType.VALUE);

        return {
            type: isListNodes ? NodeType.LIST : NodeType.BLOCK,
            key,
            children,
            range: {
                start: startPos,
                end: endPos,
            },
        };
    }

    /**
     * Parse comparison (key > value, key < value, etc.)
     */
    private parseComparison(key: string, startPos: Position): ASTNode {
        const opToken = this.advance();
        const operator = opToken.value;

        const valueToken = this.advance();
        let value: string | number = valueToken.value;

        if (valueToken.type === TokenType.NUMBER) {
            value = parseFloat(valueToken.value);
        }

        return {
            type: NodeType.COMPARISON,
            key,
            operator,
            value,
            range: {
                start: startPos,
                end: valueToken.range.end,
            },
        };
    }

    /**
     * Parse comment
     */
    private parseComment(): ASTNode {
        const token = this.advance();
        return {
            type: NodeType.COMMENT,
            value: token.value,
            range: token.range,
        };
    }

    // Token reading helpers

    private readComment(): Token {
        const start = { line: this.line, character: this.column };
        let value = '';

        while (this.position < this.text.length && this.text[this.position] !== '\n') {
            value += this.text[this.position];
            this.advanceChar();
        }

        return {
            type: TokenType.COMMENT,
            value,
            range: {
                start,
                end: { line: this.line, character: this.column },
            },
        };
    }

    private readString(): Token {
        const start = { line: this.line, character: this.column };
        this.advanceChar(); // skip opening "

        let value = '';

        while (this.position < this.text.length && this.text[this.position] !== '"') {
            if (this.text[this.position] === '\\') {
                const nextChar = this.peek();
                if (nextChar === '"') {
                    this.advanceChar(); // skip backslash
                    value += '"';
                    this.advanceChar();
                } else if (nextChar === '\\') {
                    this.advanceChar(); // skip first backslash
                    value += '\\';
                    this.advanceChar();
                } else {
                    value += this.text[this.position];
                    this.advanceChar();
                }
            } else {
                value += this.text[this.position];
                this.advanceChar();
            }
        }

        if (this.position < this.text.length) {
            this.advanceChar(); // skip closing "
        }

        return {
            type: TokenType.STRING,
            value,
            range: {
                start,
                end: { line: this.line, character: this.column },
            },
        };
    }

    private readNumber(): Token {
        const start = { line: this.line, character: this.column };
        let value = '';

        if (this.text[this.position] === '-') {
            value += '-';
            this.advanceChar();
        }

        while (this.position < this.text.length && (this.isDigit(this.text[this.position]) || this.text[this.position] === '.')) {
            value += this.text[this.position];
            this.advanceChar();
        }

        return {
            type: TokenType.NUMBER,
            value,
            range: {
                start,
                end: { line: this.line, character: this.column },
            },
        };
    }

    private readIdentifier(): Token {
        const start = { line: this.line, character: this.column };
        let value = '';

        while (this.position < this.text.length && this.isIdentifierChar(this.text[this.position])) {
            value += this.text[this.position];
            this.advanceChar();
        }

        return {
            type: TokenType.IDENTIFIER,
            value,
            range: {
                start,
                end: { line: this.line, character: this.column },
            },
        };
    }

    private readVariableInterpolation(): Token {
        const start = { line: this.line, character: this.column };
        let value = '@[';

        this.advanceChar(); // consume @
        this.advanceChar(); // consume [

        let depth = 1;
        while (this.position < this.text.length && depth > 0) {
            const ch = this.text[this.position];
            if (ch === '[') depth++;
            else if (ch === ']') depth--;

            if (depth > 0) {
                value += ch;
            }
            this.advanceChar();
        }

        value += ']';

        return {
            type: TokenType.IDENTIFIER,
            value,
            range: {
                start,
                end: { line: this.line, character: this.column },
            },
        };
    }

    // Character classification

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }

    private isIdentifierStart(char: string): boolean {
        return (char >= 'a' && char <= 'z') ||
            (char >= 'A' && char <= 'Z') ||
            char === '_' || char === '@' || char === '$';
    }

    private isIdentifierChar(char: string): boolean {
        return this.isIdentifierStart(char) || this.isDigit(char) || char === '.' || char === ':';
    }

    // Token navigation

    private advance(): Token {
        if (!this.isAtEnd()) {
            return this.tokens[this.tokenIndex++];
        }
        return this.tokens[this.tokens.length - 1];
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.tokens[this.tokenIndex].type === type;
    }

    private checkNext(type: TokenType): boolean {
        if (this.tokenIndex + 1 >= this.tokens.length) return false;
        return this.tokens[this.tokenIndex + 1].type === type;
    }

    private match(type: TokenType): boolean {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    private isAtEnd(): boolean {
        return this.tokenIndex >= this.tokens.length || this.tokens[this.tokenIndex].type === TokenType.EOF;
    }

    private getCurrentPosition(): Position {
        if (this.tokenIndex < this.tokens.length) {
            return this.tokens[this.tokenIndex].range.start;
        }
        return { line: this.line, character: this.column };
    }

    private skipToNextStatement(): void {
        while (!this.isAtEnd() && !this.match(TokenType.NEWLINE)) {
            this.advance();
        }
    }

    // Character position helpers (for lexer)

    /**
     * Advance the character position during tokenization.
     * This is separate from advance() which navigates tokens during parsing.
     */
    private advanceChar(): void {
        if (this.position < this.text.length) {
            this.position++;
            this.column++;
        }
    }

    private peek(): string {
        if (this.position + 1 < this.text.length) {
            return this.text[this.position + 1];
        }
        return '\0';
    }

    private createToken(type: TokenType, value: string): Token {
        const start = { line: this.line, character: this.column };
        return {
            type,
            value,
            range: {
                start,
                end: { line: this.line, character: this.column + value.length },
            },
        };
    }

    private addError(message: string, position: Position): void {
        this.errors.push({
            message,
            range: {
                start: position,
                end: position,
            },
            severity: 'error',
        });
    }
}

/**
 * Caching wrapper around CK3Parser.
 *
 * Keeps a small content-based LRU cache so that repeated calls to
 * `parse(text)` with the same text content (e.g. provider re-parsing
 * a document the server already parsed) return the cached result
 * instead of re-tokenizing and re-parsing.
 */
export class CachingParser extends CK3Parser {
    private contentCache = new Map<string, { result: ParsedDocument; timestamp: number }>();
    private readonly maxCacheSize: number;

    constructor(maxCacheSize = 5) {
        super();
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
            if (oldestKey) this.contentCache.delete(oldestKey);
        }

        this.contentCache.set(text, { result, timestamp: Date.now() });
        return result;
    }

    /** Remove all cached parse results. */
    public clearContentCache(): void {
        this.contentCache.clear();
    }
}
