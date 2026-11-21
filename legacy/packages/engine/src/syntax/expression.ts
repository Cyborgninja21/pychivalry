/**
 * Parser for inline arithmetic `@[ ... ]`: identifiers (script constants, written with or
 * without '@'), numbers, `+ - * /`, parentheses and unary minus, with the usual precedence.
 */

import { Expr } from './ast';

export class ExpressionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExpressionError';
    }
}

type ExprToken =
    | { kind: 'number'; value: number }
    | { kind: 'identifier'; name: string }
    | { kind: 'op'; op: '+' | '-' | '*' | '/' | '(' | ')' };

function tokenize(text: string): ExprToken[] {
    const out: ExprToken[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
            out.push({ kind: 'op', op: ch });
            i++;
            continue;
        }
        const num = /^(\d+(\.\d+)?|\.\d+)/.exec(text.slice(i));
        if (num) {
            out.push({ kind: 'number', value: parseFloat(num[0]) });
            i += num[0].length;
            continue;
        }
        const ident = /^@?[A-Za-z_$][A-Za-z0-9_$:.]*/.exec(text.slice(i));
        if (ident) {
            out.push({ kind: 'identifier', name: ident[0] });
            i += ident[0].length;
            continue;
        }
        throw new ExpressionError(`unexpected character '${ch}'`);
    }
    return out;
}

class ExprParser {
    private i = 0;

    constructor(private readonly tokens: ExprToken[]) {}

    public parse(): Expr {
        if (this.tokens.length === 0) {
            throw new ExpressionError('empty expression');
        }
        const expr = this.additive();
        if (this.i < this.tokens.length) {
            throw new ExpressionError('unexpected token after expression');
        }
        return expr;
    }

    private peekOp(): string | undefined {
        const t = this.tokens[this.i];
        return t && t.kind === 'op' ? t.op : undefined;
    }

    private additive(): Expr {
        let left = this.multiplicative();
        for (;;) {
            const op = this.peekOp();
            if (op !== '+' && op !== '-') {
                return left;
            }
            this.i++;
            left = { type: 'binary', op, left, right: this.multiplicative() };
        }
    }

    private multiplicative(): Expr {
        let left = this.unary();
        for (;;) {
            const op = this.peekOp();
            if (op !== '*' && op !== '/') {
                return left;
            }
            this.i++;
            left = { type: 'binary', op, left, right: this.unary() };
        }
    }

    private unary(): Expr {
        if (this.peekOp() === '-') {
            this.i++;
            return { type: 'unary', op: '-', operand: this.unary() };
        }
        return this.primary();
    }

    private primary(): Expr {
        const t = this.tokens[this.i];
        if (!t) {
            throw new ExpressionError('unexpected end of expression');
        }
        this.i++;
        if (t.kind === 'number') {
            return { type: 'number', value: t.value };
        }
        if (t.kind === 'identifier') {
            return { type: 'identifier', name: t.name };
        }
        if (t.op === '(') {
            const inner = this.additive();
            if (this.peekOp() !== ')') {
                throw new ExpressionError("missing ')'");
            }
            this.i++;
            return inner;
        }
        throw new ExpressionError(`unexpected '${t.op}'`);
    }
}

/** Parse the text between `@[` and `]`. Throws ExpressionError when malformed. */
export function parseExpression(text: string): Expr {
    return new ExprParser(tokenize(text)).parse();
}

/** Identifiers an expression refers to (for constant resolution). */
export function expressionIdentifiers(expr: Expr): string[] {
    switch (expr.type) {
        case 'number':
            return [];
        case 'identifier':
            return [expr.name];
        case 'unary':
            return expressionIdentifiers(expr.operand);
        case 'binary':
            return [...expressionIdentifiers(expr.left), ...expressionIdentifiers(expr.right)];
    }
}
