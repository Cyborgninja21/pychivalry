/**
 * On-type formatting (#80): indentation as you type, in agreement with the document
 * formatter (lsp/formatting.ts).
 *
 * - **Enter** (`\n`): the new line is indented to the block depth at its start (the
 *   number of `{` not yet closed before it): one level deeper after an opening brace, the
 *   same level otherwise, one level less when the line starts with `}`. A line left behind
 *   that holds only white space is emptied, as the formatter writes empty lines.
 * - **`}`** typed as the first character of a line: the brace gets the indentation of the
 *   line that opened its block.
 * - **`=`**: the formatter pads operators by default (`key = value`), so a `=` (or the `=`
 *   that completes `==`, `!=`, `<=`, `>=`, `?=`) typed right after a key gets a space in
 *   front, and a space behind when text follows it on the line.
 *
 * Braces, strings and comments are read with the engine's lexer, so a brace or `=` inside a
 * string or a comment is never edited. When the depth cannot be determined (more `}` than
 * `{` before the position, no opening brace for a `}`) no edit is returned rather than a
 * wrong one. One indentation level is a tab, or `tabSize` spaces with `insertSpaces`
 * (`ck3LanguageServer.formatting.*`, the formatter's settings).
 */

import { Position, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Lexer, Token, TokenType } from 'pychivalry-engine';

export interface OnTypeSettings {
    insertSpaces: boolean;
    tabSize: number;
}

const ASSIGNMENT_OPERATORS: ReadonlySet<TokenType> = new Set([
    TokenType.EQUALS,
    TokenType.DOUBLE_EQUALS,
    TokenType.NOT_EQUALS,
    TokenType.NULL_SAFE_EQUALS,
    TokenType.GREATER_EQUAL,
    TokenType.LESS_EQUAL,
]);

/** The trigger characters, as registered (first, then more). */
export const ON_TYPE_TRIGGERS = { first: '\n', more: ['}', '='] };

function before(a: Position, b: Position): boolean {
    return a.line < b.line || (a.line === b.line && a.character < b.character);
}

function samePosition(a: Position, b: Position): boolean {
    return a.line === b.line && a.character === b.character;
}

function leadingWhitespace(line: string): string {
    const match = /^[ \t]*/.exec(line);
    return match ? match[0] : '';
}

export class OnTypeFormattingProvider {
    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        settings: OnTypeSettings
    ): TextEdit[] {
        switch (ch) {
            case '\n':
                return this.onEnter(document, position, settings);
            case '}':
                return this.onCloseBrace(document, position);
            case '=':
                return this.onEquals(document, position);
            default:
                return [];
        }
    }

    /** One indentation level. */
    public static unit(settings: OnTypeSettings): string {
        return settings.insertSpaces ? ' '.repeat(Math.max(1, settings.tabSize)) : '\t';
    }

    /** The text of a line without its line break. */
    private lineText(document: TextDocument, line: number): string {
        const text = document.getText({
            start: { line, character: 0 },
            end: { line, character: Number.MAX_SAFE_INTEGER },
        });
        return text.replace(/\r?\n$/, '').replace(/\r$/, '');
    }

    /**
     * Tokens of the text up to the end of `line` (strings and comments end at a line break,
     * so a prefix that ends at a line end is lexed exactly as in the whole file).
     */
    private tokensThrough(document: TextDocument, line: number): Token[] {
        const end = document.offsetAt({ line: line + 1, character: 0 });
        return new Lexer().tokenize(document.getText().slice(0, end)).tokens;
    }

    /** Unclosed `{` before `position`; undefined when a `}` has no `{`. */
    private depthBefore(tokens: Token[], position: Position): number | undefined {
        let depth = 0;
        for (const token of tokens) {
            if (!before(token.range.start, position)) {
                break;
            }
            if (token.type === TokenType.LEFT_BRACE) {
                depth++;
            } else if (token.type === TokenType.RIGHT_BRACE) {
                depth--;
                if (depth < 0) {
                    return undefined;
                }
            }
        }
        return depth;
    }

    private onEnter(
        document: TextDocument,
        position: Position,
        settings: OnTypeSettings
    ): TextEdit[] {
        const line = position.line;
        if (line === 0) {
            return [];
        }
        const edits: TextEdit[] = [];
        const previous = this.lineText(document, line - 1);
        if (previous.length > 0 && previous.trim() === '') {
            edits.push({
                range: {
                    start: { line: line - 1, character: 0 },
                    end: { line: line - 1, character: previous.length },
                },
                newText: '',
            });
        }
        const tokens = this.tokensThrough(document, line - 1);
        const last = [...tokens]
            .reverse()
            .find((t) => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF);
        if (last && last.type === TokenType.STRING && last.terminated === false) {
            // Enter inside a string: the new line's white space is the string's text.
            return [];
        }
        let depth = this.depthBefore(tokens, { line, character: 0 });
        if (depth === undefined) {
            return [];
        }
        const current = this.lineText(document, line);
        const indent = leadingWhitespace(current);
        if (current.slice(indent.length).startsWith('}')) {
            depth--;
            if (depth < 0) {
                return [];
            }
        }
        const wanted = OnTypeFormattingProvider.unit(settings).repeat(depth);
        if (wanted !== indent) {
            edits.push({
                range: {
                    start: { line, character: 0 },
                    end: { line, character: indent.length },
                },
                newText: wanted,
            });
        }
        return edits;
    }

    private onCloseBrace(document: TextDocument, position: Position): TextEdit[] {
        if (position.character === 0) {
            return [];
        }
        const brace: Position = { line: position.line, character: position.character - 1 };
        const current = this.lineText(document, position.line);
        const indent = leadingWhitespace(current);
        if (indent.length !== brace.character) {
            // Not the first character of the line (`{ a b }` stays as written).
            return [];
        }
        const tokens = this.tokensThrough(document, position.line);
        // The `}` must be a brace token (not inside a string or a comment); find its `{`.
        const open: Token[] = [];
        for (const token of tokens) {
            if (token.type === TokenType.LEFT_BRACE) {
                open.push(token);
                continue;
            }
            if (token.type !== TokenType.RIGHT_BRACE) {
                continue;
            }
            const opener = open.pop();
            if (samePosition(token.range.start, brace)) {
                if (!opener) {
                    return [];
                }
                const wanted = leadingWhitespace(this.lineText(document, opener.range.start.line));
                return wanted === indent
                    ? []
                    : [
                          {
                              range: {
                                  start: { line: brace.line, character: 0 },
                                  end: brace,
                              },
                              newText: wanted,
                          },
                      ];
            }
            if (!opener) {
                return [];
            }
        }
        return [];
    }

    private onEquals(document: TextDocument, position: Position): TextEdit[] {
        const tokens = this.tokensThrough(document, position.line);
        const operator = tokens.find(
            (t) => ASSIGNMENT_OPERATORS.has(t.type) && samePosition(t.range.end, position)
        );
        if (!operator) {
            // Inside a string, a comment or an expression, or not an operator.
            return [];
        }
        const line = this.lineText(document, position.line);
        const start = operator.range.start.character;
        const edits: TextEdit[] = [];
        const keyBefore = line.slice(0, start).trim() !== '';
        if (keyBefore && !/[ \t]/.test(line[start - 1])) {
            edits.push({
                range: { start: operator.range.start, end: operator.range.start },
                newText: ' ',
            });
        }
        const after = line[position.character];
        if (keyBefore && after !== undefined && !/[ \t]/.test(after)) {
            edits.push({ range: { start: position, end: position }, newText: ' ' });
        }
        return edits;
    }
}
