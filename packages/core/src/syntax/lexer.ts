/**
 * The lexer (docs/PLAN.md item 2.3). It splits text into tokens the way the game's reader
 * does: a bare word runs until whitespace, a brace, a quote, `#`, `=`, `<` or `>`, or a `!` or
 * `?` that is followed by `=`; it is then classified by its shape alone. The lexer knows no
 * CK3 names. Newlines are whitespace, as they are to the game.
 *
 * Tokens:
 *
 * - the operators `=`, `==`, `!=`, `?=`, `>`, `<`, `>=`, `<=`;
 * - `{` and `}`;
 * - quoted text, which may span lines; `\"` and `\\` are its only escapes, and any other
 *   backslash is kept as written. Without a closing quote it runs to the end of the file;
 * - comments, from `#` to the end of the line;
 * - inline arithmetic, `@[ ... ]`, as one token, up to its matching `]` or the end of the
 *   line;
 * - words, classified as a number, a date (`year.month.day`), an `@name` constant, a
 *   `$PARAM$` parameter, a scope chain, or a plain name.
 */

/** The eight operators. */
export const OPERATORS = ['=', '==', '!=', '?=', '>', '<', '>=', '<='] as const;
export type OperatorText = (typeof OPERATORS)[number];

/** How a word is classified, by its shape. */
export type WordType = 'name' | 'number' | 'date' | 'constant' | 'parameter' | 'chain';

export type Token =
    | {
          readonly kind: 'word';
          readonly type: WordType;
          readonly start: number;
          readonly end: number;
      }
    | {
          readonly kind: 'string';
          readonly start: number;
          readonly end: number;
          readonly terminated: boolean;
      }
    | {
          readonly kind: 'arithmetic';
          readonly start: number;
          readonly end: number;
          readonly terminated: boolean;
      }
    | { readonly kind: 'comment'; readonly start: number; readonly end: number }
    | {
          readonly kind: 'operator';
          readonly text: OperatorText;
          readonly start: number;
          readonly end: number;
      }
    | { readonly kind: 'open'; readonly start: number; readonly end: number }
    | { readonly kind: 'close'; readonly start: number; readonly end: number }
    | { readonly kind: 'eof'; readonly start: number; readonly end: number };

const NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const DATE = /^-?\d+\.\d+\.\d+$/;
const PARAMETER = /^\$[A-Za-z0-9_]+\$$/;
/** A chain segment starts with a letter, `_`, `$` or `@`; `namespace.0001` is no chain. */
const SEGMENT = /^[A-Za-z_$@]/;

/** Classify a bare word by its shape. */
export function classifyWord(text: string): WordType {
    if (DATE.test(text)) {
        return 'date';
    }
    if (NUMBER.test(text)) {
        return 'number';
    }
    if (PARAMETER.test(text)) {
        return 'parameter';
    }
    if (text.length > 1 && text.startsWith('@')) {
        return 'constant';
    }
    if ((text.includes('.') || text.includes(':')) && chainSegments(text) !== undefined) {
        return 'chain';
    }
    return 'name';
}

/**
 * The segments of a scope chain: the word split at each `.` that is not inside `|...|`
 * (`value:sv|A|1.5|` is one segment). A `|...|` group runs from a `|` to the `|` that ends
 * the word or stands before a `.`, so its own `|` separators do not close it. Undefined when
 * the word is not a chain: a segment is empty or starts with something other than a letter,
 * `_`, `$` or `@`, or the word is a single segment without a `:`.
 */
export function chainSegments(text: string): string[] | undefined {
    const segments: string[] = [];
    let from = 0;
    let inPipes = false;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 124) {
            if (!inPipes) {
                inPipes = true;
            } else if (i + 1 === text.length || text.charCodeAt(i + 1) === 46) {
                inPipes = false;
            }
        } else if (code === 46 && !inPipes) {
            segments.push(text.slice(from, i));
            from = i + 1;
        }
    }
    segments.push(text.slice(from));
    if (segments.some((segment) => !SEGMENT.test(segment))) {
        return undefined;
    }
    if (segments.length === 1 && !text.includes(':')) {
        return undefined;
    }
    return segments;
}

/** Characters that end a bare word: whitespace, `{`, `}`, `=`, `<`, `>`, `#` and `"`. */
function endsWord(code: number): boolean {
    return (
        code === 32 || // space
        code === 9 || // tab
        code === 10 || // \n
        code === 13 || // \r
        code === 12 || // \f
        code === 11 || // \v
        code === 123 || // {
        code === 125 || // }
        code === 61 || // =
        code === 60 || // <
        code === 62 || // >
        code === 35 || // #
        code === 34 // "
    );
}

function isSpace(code: number): boolean {
    return code === 32 || code === 9 || code === 10 || code === 13 || code === 12 || code === 11;
}

/**
 * Split `text` into tokens, from offset `from` up to `to` (the whole text by default). The
 * last token is always `eof`, at `to`.
 */
export function tokenize(text: string, from = 0, to = text.length): Token[] {
    const tokens: Token[] = [];
    let i = from;
    while (i < to) {
        const code = text.charCodeAt(i);
        if (isSpace(code)) {
            i++;
            continue;
        }
        const start = i;
        const next = i + 1 < to ? text.charCodeAt(i + 1) : -1;
        switch (code) {
            case 35: {
                // # comment, to the end of the line; the line break is not part of it.
                while (i < to) {
                    const c = text.charCodeAt(i);
                    if (c === 10 || c === 13) {
                        break;
                    }
                    i++;
                }
                tokens.push({ kind: 'comment', start, end: i });
                continue;
            }
            case 34: {
                // "quoted text"
                i++;
                let terminated = false;
                while (i < to) {
                    const c = text.charCodeAt(i);
                    if (c === 92 && i + 1 < to) {
                        const escaped = text.charCodeAt(i + 1);
                        if (escaped === 34 || escaped === 92) {
                            i += 2;
                            continue;
                        }
                    }
                    i++;
                    if (c === 34) {
                        terminated = true;
                        break;
                    }
                }
                tokens.push({ kind: 'string', start, end: i, terminated });
                continue;
            }
            case 123:
                tokens.push({ kind: 'open', start, end: i + 1 });
                i++;
                continue;
            case 125:
                tokens.push({ kind: 'close', start, end: i + 1 });
                i++;
                continue;
            case 61:
                if (next === 61) {
                    tokens.push({ kind: 'operator', text: '==', start, end: i + 2 });
                    i += 2;
                } else {
                    tokens.push({ kind: 'operator', text: '=', start, end: i + 1 });
                    i++;
                }
                continue;
            case 60:
            case 62: {
                const less = code === 60;
                if (next === 61) {
                    tokens.push({ kind: 'operator', text: less ? '<=' : '>=', start, end: i + 2 });
                    i += 2;
                } else {
                    tokens.push({ kind: 'operator', text: less ? '<' : '>', start, end: i + 1 });
                    i++;
                }
                continue;
            }
            case 33:
            case 63:
                if (next === 61) {
                    tokens.push({
                        kind: 'operator',
                        text: code === 33 ? '!=' : '?=',
                        start,
                        end: i + 2,
                    });
                    i += 2;
                    continue;
                }
                break;
            case 64:
                if (next === 91) {
                    // @[ inline arithmetic ], to its matching ']' or the end of the line.
                    i += 2;
                    let depth = 1;
                    while (i < to) {
                        const c = text.charCodeAt(i);
                        if (c === 10 || c === 13) {
                            break;
                        }
                        i++;
                        if (c === 91) {
                            depth++;
                        } else if (c === 93) {
                            depth--;
                            if (depth === 0) {
                                break;
                            }
                        }
                    }
                    tokens.push({ kind: 'arithmetic', start, end: i, terminated: depth === 0 });
                    continue;
                }
                break;
            default:
                break;
        }
        // A bare word.
        i++;
        while (i < to) {
            const c = text.charCodeAt(i);
            if (endsWord(c)) {
                break;
            }
            if ((c === 33 || c === 63) && i + 1 < to && text.charCodeAt(i + 1) === 61) {
                break;
            }
            i++;
        }
        tokens.push({ kind: 'word', type: classifyWord(text.slice(start, i)), start, end: i });
    }
    tokens.push({ kind: 'eof', start: to, end: to });
    return tokens;
}

/**
 * The text of a quoted string token without its quotes, with `\"` and `\\` unescaped. An
 * unterminated string has only its opening quote.
 */
export function unquote(source: string, terminated: boolean): string {
    const inner = source.slice(1, terminated ? -1 : undefined);
    return inner.replace(/\\(["\\])/g, '$1');
}
