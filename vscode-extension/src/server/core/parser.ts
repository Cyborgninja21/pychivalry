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
                this.advance();
                continue;
            }
            
            // Newline
            if (char === '\n') {
                tokens.push(this.createToken(TokenType.NEWLINE, '\n'));
                this.advance();
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
            if (char === '=') {
                tokens.push(this.createToken(TokenType.EQUALS, '='));
                this.advance();
                continue;
            }
            
            if (char === '>') {
                if (this.peek() === '=') {
                    tokens.push(this.createToken(TokenType.GREATER_EQUAL, '>='));
                    this.advance();
                    this.advance();
                } else {
                    tokens.push(this.createToken(TokenType.GREATER, '>'));
                    this.advance();
                }
                continue;
            }
            
            if (char === '<') {
                if (this.peek() === '=') {
                    tokens.push(this.createToken(TokenType.LESS_EQUAL, '<='));
                    this.advance();
                    this.advance();
                } else {
                    tokens.push(this.createToken(TokenType.LESS, '<'));
                    this.advance();
                }
                continue;
            }
            
            // Braces
            if (char === '{') {
                tokens.push(this.createToken(TokenType.LEFT_BRACE, '{'));
                this.advance();
                continue;
            }
            
            if (char === '}') {
                tokens.push(this.createToken(TokenType.RIGHT_BRACE, '}'));
                this.advance();
                continue;
            }
            
            // Number
            if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek()))) {
                tokens.push(this.readNumber());
                continue;
            }
            
            // Identifier
            if (this.isIdentifierStart(char)) {
                tokens.push(this.readIdentifier());
                continue;
            }
            
            // Unknown character - skip it
            this.advance();
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
    private parseStatement(): ASTNode | null {
        // Must start with an identifier
        if (!this.check(TokenType.IDENTIFIER)) {
            this.skipToNextStatement();
            return null;
        }
        
        const key = this.advance().value;
        const startPos = this.tokens[this.tokenIndex - 1].range.start;
        
        // Check operator
        if (this.match(TokenType.EQUALS)) {
            return this.parseAssignment(key, startPos);
        } else if (this.check(TokenType.GREATER) || this.check(TokenType.LESS) ||
                   this.check(TokenType.GREATER_EQUAL) || this.check(TokenType.LESS_EQUAL)) {
            return this.parseComparison(key, startPos);
        } else {
            this.addError('Expected operator (=, >, <, >=, <=) after key', startPos);
            this.skipToNextStatement();
            return null;
        }
    }

    /**
     * Parse assignment (key = value or key = { ... })
     */
    private parseAssignment(key: string, startPos: Position): ASTNode {
        // Check if it's a block or simple value
        if (this.check(TokenType.LEFT_BRACE)) {
            return this.parseBlock(key, startPos);
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
    private parseBlock(key: string, startPos: Position): ASTNode {
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
            const stmt = this.parseStatement();
            if (stmt) {
                children.push(stmt);
            }
        }
        
        const endPos = this.getCurrentPosition();
        
        if (this.match(TokenType.RIGHT_BRACE)) {
            // Success
        } else {
            this.addError('Expected }', endPos);
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
        const start = this.getCurrentPosition();
        let value = '';
        
        while (this.position < this.text.length && this.text[this.position] !== '\n') {
            value += this.text[this.position];
            this.advance();
        }
        
        return {
            type: TokenType.COMMENT,
            value,
            range: {
                start,
                end: this.getCurrentPosition(),
            },
        };
    }

    private readString(): Token {
        const start = this.getCurrentPosition();
        this.advance(); // skip opening "
        
        let value = '';
        
        while (this.position < this.text.length && this.text[this.position] !== '"') {
            if (this.text[this.position] === '\\' && this.peek() === '"') {
                this.advance(); // skip \
                value += '"';
                this.advance();
            } else {
                value += this.text[this.position];
                this.advance();
            }
        }
        
        if (this.position < this.text.length) {
            this.advance(); // skip closing "
        }
        
        return {
            type: TokenType.STRING,
            value,
            range: {
                start,
                end: this.getCurrentPosition(),
            },
        };
    }

    private readNumber(): Token {
        const start = this.getCurrentPosition();
        let value = '';
        
        if (this.text[this.position] === '-') {
            value += '-';
            this.advance();
        }
        
        while (this.position < this.text.length && (this.isDigit(this.text[this.position]) || this.text[this.position] === '.')) {
            value += this.text[this.position];
            this.advance();
        }
        
        return {
            type: TokenType.NUMBER,
            value,
            range: {
                start,
                end: this.getCurrentPosition(),
            },
        };
    }

    private readIdentifier(): Token {
        const start = this.getCurrentPosition();
        let value = '';
        
        while (this.position < this.text.length && this.isIdentifierChar(this.text[this.position])) {
            value += this.text[this.position];
            this.advance();
        }
        
        return {
            type: TokenType.IDENTIFIER,
            value,
            range: {
                start,
                end: this.getCurrentPosition(),
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
