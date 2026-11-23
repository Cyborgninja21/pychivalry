/**
 * The formatter (docs/formatting.md; docs/PLAN.md items 8.2 to 8.5): one formatting, from one
 * table of layout rules, for the editor, the command line and the agent server. It keeps every
 * token and every comment; it changes only the whitespace between tokens, and leaves a file it
 * cannot read for certain as it is, saying why.
 */

import { extensionOf } from '../index/paths.js';
import { layoutLocalization } from './localization.js';
import type { FormatEdit, FormatKind, FormatResult } from './result.js';
import { layoutScript, selectEdits, type FormatOptions } from './script.js';

export {
    applyFormatEdits,
    leftMessage,
    lineEndingOf,
    type FormatEdit,
    type FormatKind,
    type FormatLeft,
    type FormatResult,
} from './result.js';
export { DEFAULT_RULES, FORMAT_RULES, type BlockRule, type LayoutRules } from './rules.js';
export { formatScript, type FormatOptions } from './script.js';
export { formatLocalization } from './localization.js';
export { onTypeEdits, ON_TYPE_TRIGGERS } from './on-type.js';
export { columnsAfter, LINE_WIDTH, lineColumns, TAB_COLUMNS } from './width.js';
export { compareFormatted, treeDifference, type FormatComparison } from './compare.js';
export {
    localizationStyle,
    scriptStyle,
    STYLE_TITLES,
    styleOf,
    type StyleCode,
    type StylePlace,
} from './style.js';

/** What a file is formatted as, by its extension: `.txt` script, `.yml` localization. */
export function formatKindOf(file: string): FormatKind | undefined {
    const extension = extensionOf(file);
    return extension === '.txt' ? 'script' : extension === '.yml' ? 'localization' : undefined;
}

/** Format a file's text as `kind`. `source` may start with the byte-order mark. */
export function formatText(
    source: string,
    kind: FormatKind,
    options: FormatOptions = {},
): FormatResult {
    return kind === 'script'
        ? layoutScript(source, options).result
        : layoutLocalization(source, options.rules).result;
}

/**
 * The edits of Format Selection: formatting the whole file, keeping the edits on lines `from`
 * to `to` (counted from 0, both included, in the text without the byte-order mark; the edits'
 * offsets are into that text too). A script edit across a line break is kept whole only when
 * the lines on both sides are selected, otherwise only its part on the selected line; a
 * localization edit belongs to its line. A file left as it is gives none.
 */
export function formatRangeEdits(
    source: string,
    kind: FormatKind,
    from: number,
    to: number,
    options: FormatOptions = {},
): { readonly result: FormatResult; readonly edits: readonly FormatEdit[] } {
    if (kind === 'script') {
        const layout = layoutScript(source, options);
        return {
            result: layout.result,
            edits:
                layout.result.left === null
                    ? selectEdits(layout.body, layout.placed, from, to)
                    : [],
        };
    }
    const layout = layoutLocalization(source, options.rules);
    return {
        result: layout.result,
        edits: layout.placed
            .filter((e) => e.line >= from && e.line <= to)
            .map((e) => ({ start: e.start, end: e.end, text: e.text })),
    };
}
