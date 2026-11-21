/**
 * Inline arithmetic, `@[ ... ]` (docs/PLAN.md items 2.3 and 2.6): numbers, names (script
 * constants, written with or without `@`), `+ - * /`, parentheses and unary minus, with the
 * usual precedence. Every form the base game uses is one of these.
 */

export type Arithmetic =
    | { readonly type: 'number'; readonly value: number }
    | { readonly type: 'name'; readonly name: string }
    | { readonly type: 'unary'; readonly op: '-'; readonly operand: Arithmetic }
    | {
          readonly type: 'binary';
          readonly op: '+' | '-' | '*' | '/';
          readonly left: Arithmetic;
          readonly right: Arithmetic;
      };

/** The result of reading the text between `@[` and `]`. */
export type ArithmeticResult =
    | { readonly ok: true; readonly expression: Arithmetic }
    | { readonly ok: false; readonly reason: string };

type Piece =
    | { readonly kind: 'number'; readonly value: number }
    | { readonly kind: 'name'; readonly name: string }
    | { readonly kind: 'op'; readonly op: '+' | '-' | '*' | '/' | '(' | ')' };

const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)/;
const NAME = /^@?[A-Za-z_$][A-Za-z0-9_$:.|]*/;

function pieces(text: string): Piece[] | string {
    const out: Piece[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text.charAt(i);
        if (ch === ' ' || ch === '\t') {
            i++;
            continue;
        }
        if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
            out.push({ kind: 'op', op: ch });
            i++;
            continue;
        }
        const rest = text.slice(i);
        const number = NUMBER.exec(rest);
        if (number) {
            out.push({ kind: 'number', value: Number(number[0]) });
            i += number[0].length;
            continue;
        }
        const name = NAME.exec(rest);
        if (name) {
            out.push({ kind: 'name', name: name[0] });
            i += name[0].length;
            continue;
        }
        return `unexpected character '${ch}'`;
    }
    return out;
}

class Reader {
    private at = 0;

    constructor(private readonly input: readonly Piece[]) {}

    read(): Arithmetic {
        if (this.input.length === 0) {
            throw new Error('empty expression');
        }
        const expression = this.sum();
        if (this.at < this.input.length) {
            throw new Error('unexpected token after the expression');
        }
        return expression;
    }

    private op(): string | undefined {
        const piece = this.input[this.at];
        return piece?.kind === 'op' ? piece.op : undefined;
    }

    private sum(): Arithmetic {
        let left = this.product();
        for (;;) {
            const op = this.op();
            if (op !== '+' && op !== '-') {
                return left;
            }
            this.at++;
            left = { type: 'binary', op, left, right: this.product() };
        }
    }

    private product(): Arithmetic {
        let left = this.unary();
        for (;;) {
            const op = this.op();
            if (op !== '*' && op !== '/') {
                return left;
            }
            this.at++;
            left = { type: 'binary', op, left, right: this.unary() };
        }
    }

    private unary(): Arithmetic {
        if (this.op() === '-') {
            this.at++;
            return { type: 'unary', op: '-', operand: this.unary() };
        }
        return this.primary();
    }

    private primary(): Arithmetic {
        const piece = this.input[this.at];
        if (piece === undefined) {
            throw new Error('unexpected end of the expression');
        }
        this.at++;
        if (piece.kind === 'number') {
            return { type: 'number', value: piece.value };
        }
        if (piece.kind === 'name') {
            return { type: 'name', name: piece.name };
        }
        if (piece.op === '(') {
            const inner = this.sum();
            if (this.op() !== ')') {
                throw new Error("missing ')'");
            }
            this.at++;
            return inner;
        }
        throw new Error(`unexpected '${piece.op}'`);
    }
}

/** Read the text between `@[` and `]`. */
export function readArithmetic(text: string): ArithmeticResult {
    const input = pieces(text);
    if (typeof input === 'string') {
        return { ok: false, reason: input };
    }
    try {
        return { ok: true, expression: new Reader(input).read() };
    } catch (err) {
        return { ok: false, reason: (err as Error).message };
    }
}
