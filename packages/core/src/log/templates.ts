/**
 * The error catalogue's messages as templates a log line can be matched against (docs/PLAN.md
 * item 11.3; docs/game-log.md). Every template comes from the spec package's catalogue
 * (`errors[]`): its text, read as the game's own format string, whose placeholders are printf
 * conversions (`%s`, `%d`, `%.*s`, `%I64d`, ...) and the `{}` of the game's newer formatting,
 * and whose other characters are written as they are. Nothing here names a message: the
 * matcher knows only what the package gives it.
 *
 * - **What a placeholder may be.** What a printf conversion prints is fixed by the C standard:
 *   `%d` and `%i` a signed whole number, `%u` an unsigned one, `%x` hexadecimal digits, `%f`,
 *   `%e` and `%g` a decimal number, `%c` one character, `%p` an address. `%s`, `%.*s` and `{}`
 *   (which formats a value of any type) may be any text.
 * - **What a value stands for.** A whole-number value right after the word `line` in the
 *   message's own text is a line number; after `column` or `col` a column; a whole number right
 *   after `<value>:` is the line of the file the value before the colon names. Every other value
 *   is text, which may name a file or a definition (`tie.ts`).
 * - **Which templates match.** A template the package marks as no message at all (subject
 *   `not_a_message`: a C++ type, a path, an identifier) is not matched; nor is one whose fixed
 *   text holds fewer than two words of three letters or more (`ERROR: %s`, ` errors`), which
 *   would match lines that are not that message. Both are listed (`coverage.ts`), never dropped.
 * - **Edges.** A template's leading and trailing whitespace (a trailing `\n` among it) is not
 *   matched: where a line starts and ends is the log reader's. A newline inside the text makes
 *   the message span that many more lines.
 */

import type { CatalogueEntry } from '../spec/package.js';

/** What a placeholder prints, by the C standard's rules for its conversion. */
export type Conversion = 'text' | 'integer' | 'unsigned' | 'hex' | 'number' | 'char' | 'pointer';

/** What a value of a message stands for, read from the message's own text around it. */
export type ValueRole = 'line' | 'column' | 'text' | 'number';

/** A piece of a template: fixed text, or a placeholder. */
export type TemplatePart =
    | { readonly kind: 'fixed'; readonly text: string }
    | {
          readonly kind: 'value';
          /** The placeholder as the catalogue writes it: `%s`, `%d`, `{}`, `%.*s`. */
          readonly written: string;
          readonly conversion: Conversion;
          /** True when a width pads it with spaces (`%5d`): the spaces belong to the value. */
          readonly padded: boolean;
          readonly role: ValueRole;
          /**
           * For a `line` read from `<value>:<number>`, the index of the value before the colon,
           * whose file the line is in; otherwise null.
           */
          readonly lineOf: number | null;
      };

/** Why a template is not matched against log lines. */
export type NotMatched = 'not-a-message' | 'too-little-fixed-text';

/** One catalogue message, read as a template. */
export interface LogTemplate {
    readonly id: string;
    /** The catalogue's text, as the package gives it. */
    readonly text: string;
    readonly subject: string;
    readonly scriptFacing: CatalogueEntry['script_facing'];
    readonly category: string;
    /** The package's reason for its mark (part A4), which says whether it gives a place. */
    readonly reason: string;
    /** Its pieces, the text's edges trimmed. */
    readonly parts: readonly TemplatePart[];
    /** How many values it has. */
    readonly values: number;
    /** Its fixed characters that are not whitespace: how much of a line a match accounts for. */
    readonly fixed: number;
    /** How many lines a message of it spans: one more than the newlines inside its text. */
    readonly lines: number;
    /** The words of three letters or more of its fixed text that no placeholder touches. */
    readonly words: readonly string[];
    /** True when two of its values are side by side: where one ends, no line says. */
    readonly adjacentValues: boolean;
    /** Null when it is matched; otherwise why not. */
    readonly notMatched: NotMatched | null;
}

/**
 * A placeholder: a printf conversion (flags, width, precision, length, conversion) or `{}`.
 * `%%` is a percent sign, read as fixed text. The same reading as the syntax layer's
 * `placeholderCount` (`syntax/findings.ts`).
 */
const PLACEHOLDER =
    /%%|%([-+ #0]*)(\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|I64|I32|z|j|t|L)?([diouxXeEfFgGcsp])|\{\}/g;

function conversionOf(letter: string): Conversion {
    switch (letter) {
        case 'd':
        case 'i':
            return 'integer';
        case 'u':
            return 'unsigned';
        case 'o':
            return 'unsigned';
        case 'x':
        case 'X':
            return 'hex';
        case 'e':
        case 'E':
        case 'f':
        case 'F':
        case 'g':
        case 'G':
            return 'number';
        case 'c':
            return 'char';
        case 'p':
            return 'pointer';
        default:
            return 'text';
    }
}

/** The pieces of a text: fixed text and placeholders, in order, `%%` read as `%`. */
function splitText(text: string): {
    fixed: string[];
    values: { written: string; conversion: Conversion; flags: string; width: boolean }[];
} {
    const fixed: string[] = [];
    const values: { written: string; conversion: Conversion; flags: string; width: boolean }[] = [];
    let current = '';
    let last = 0;
    for (const match of text.matchAll(PLACEHOLDER)) {
        const at = match.index;
        current += text.slice(last, at);
        last = at + match[0].length;
        if (match[0] === '%%') {
            current += '%';
            continue;
        }
        fixed.push(current);
        current = '';
        values.push({
            written: match[0],
            conversion: match[0] === '{}' ? 'text' : conversionOf(match[3] ?? 's'),
            flags: match[1] ?? '',
            width: match[2] !== undefined,
        });
    }
    current += text.slice(last);
    fixed.push(current);
    return { fixed, values };
}

/** The last word of a text, its trailing spaces, colons, quotes and `=` set aside, lower-cased. */
function lastWord(text: string): string {
    const m = /([A-Za-z]+)[\s:='"`]*$/.exec(text);
    return m?.[1]?.toLowerCase() ?? '';
}

/**
 * The words of three letters or more of a template's fixed text that no placeholder touches:
 * a word at the edge of a piece next to a placeholder may be written against the value in a
 * line, so it is not one a line's own words can be compared with.
 */
function wordsOf(fixed: readonly string[]): string[] {
    const out: string[] = [];
    fixed.forEach((piece, i) => {
        for (const m of piece.matchAll(/[A-Za-z]{3,}/g)) {
            const start = m.index;
            const end = start + m[0].length;
            const touchesBefore = start === 0 && i > 0;
            const touchesAfter = end === piece.length && i < fixed.length - 1;
            if (!touchesBefore && !touchesAfter) {
                out.push(m[0]);
            }
        }
    });
    return out;
}

/** A catalogue entry read as a template. */
export function templateOf(entry: CatalogueEntry): LogTemplate {
    const trimmed = entry.text.trim();
    const { fixed, values } = splitText(trimmed);
    const parts: TemplatePart[] = [];
    let index = 0;
    for (const [i, piece] of fixed.entries()) {
        if (piece !== '') {
            parts.push({ kind: 'fixed', text: piece });
        }
        const value = values[i];
        if (value === undefined) {
            continue;
        }
        const whole = value.conversion === 'integer' || value.conversion === 'unsigned';
        let role: ValueRole = value.conversion === 'text' ? 'text' : 'number';
        let lineOf: number | null = null;
        const word = lastWord(piece);
        // `{}` formats a value of any type: after `line` it is the line number all the same.
        if (whole || value.written === '{}') {
            if (word === 'line') {
                role = 'line';
            } else if (word === 'column' || word === 'col') {
                role = 'column';
            } else if (whole && piece === ':' && i > 0 && values[i - 1]?.conversion === 'text') {
                role = 'line';
                lineOf = index - 1;
            }
        }
        parts.push({
            kind: 'value',
            written: value.written,
            conversion: value.conversion,
            padded: value.width && !value.flags.includes('0') && !value.flags.includes('-'),
            role,
            lineOf,
        });
        index++;
    }
    const fixedText = fixed.join('');
    const words = wordsOf(fixed);
    const allWords = fixedText.match(/[A-Za-z]{3,}/g) ?? [];
    let notMatched: NotMatched | null = null;
    if (entry.subject === 'not_a_message') {
        notMatched = 'not-a-message';
    } else if (allWords.length < 2) {
        notMatched = 'too-little-fixed-text';
    }
    return {
        id: entry.id,
        text: entry.text,
        subject: entry.subject,
        scriptFacing: entry.script_facing,
        category: entry.category,
        reason: entry.reason,
        parts,
        values: values.length,
        fixed: fixedText.replace(/\s/g, '').length,
        lines: (trimmed.match(/\n/g) ?? []).length + 1,
        words,
        adjacentValues: parts.some((p, i) => p.kind === 'value' && parts[i + 1]?.kind === 'value'),
        notMatched,
    };
}

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** What a placeholder of a conversion may match, as a pattern with one group. */
function valuePattern(conversion: Conversion, greedy: boolean, padded: boolean): string {
    const pad = padded ? ' *' : '';
    switch (conversion) {
        case 'integer':
            return `(${pad}[-+]?\\d+)`;
        case 'unsigned':
            return `(${pad}\\d+)`;
        case 'hex':
            return `(${pad}(?:0[xX])?[0-9A-Fa-f]+)`;
        case 'number':
            return `(${pad}[-+]?(?:(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?|[A-Za-z][A-Za-z()]*))`;
        case 'char':
            return '([\\s\\S])';
        case 'pointer':
            return '((?:0[xX])?[0-9A-Fa-f]+)';
        case 'text':
            return greedy ? '([\\s\\S]*)' : '([\\s\\S]*?)';
    }
}

/** The pattern of a template's message, its values as groups, lazy or greedy. */
export function messagePattern(template: LogTemplate, greedy: boolean): string {
    return template.parts
        .map((p) =>
            p.kind === 'fixed' ? escape(p.text) : valuePattern(p.conversion, greedy, p.padded),
        )
        .join('');
}
