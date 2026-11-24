/**
 * How wide a line is (docs/formatting.md, rule 4, "The width of a line"). A line longer than
 * `LINE_WIDTH` columns that holds a block written on one line has that block split.
 *
 * - **A column is a character, not a byte:** every Unicode code point counts as one column,
 *   a character outside the Basic Multilingual Plane (two UTF-16 code units) as one.
 * - **A tab moves to the next multiple of four,** as an editor with a tab size of four shows
 *   it. The formatter writes tabs only at the start of a line, so there a tab is four columns.
 * - **Wide and combining characters count as one column each,** like any other character: a
 *   width table differs between fonts and Unicode versions, and the rule must give the same
 *   answer in every program. Outside quoted text and comments CK3 script is ASCII.
 */

/** The widest a line may be before a block written on one line is split. */
export const LINE_WIDTH = 120;

/** The columns a tab moves to: the next multiple of this. */
export const TAB_COLUMNS = 4;

/** True when `text` holds a tab or a UTF-16 surrogate, so its width is not its length. */
const SLOW = /[\t\uD800-\uDFFF]/;

/** The column after `text` written from column `from`; `text` holds no line break. */
export function columnsAfter(text: string, from = 0): number {
    if (!SLOW.test(text)) {
        return from + text.length;
    }
    let column = from;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 9) {
            column += TAB_COLUMNS - (column % TAB_COLUMNS);
            continue;
        }
        column++;
        // A high surrogate followed by a low one is one code point.
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = text.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                i++;
            }
        }
    }
    return column;
}

/** How many columns a line is wide (`text` without its line break). */
export function lineColumns(text: string): number {
    return columnsAfter(text, 0);
}
