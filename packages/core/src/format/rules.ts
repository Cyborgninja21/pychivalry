/**
 * The layout decisions of the formatter, as one table (docs/formatting.md). The engine
 * (`script.ts`, `localization.ts`) keeps every token and comment and decides only the
 * whitespace between tokens; what it decides is read from a `LayoutRules`: whether a block is
 * written on one line or over several, where the values of a list go, how many blank lines are
 * kept, the width of a line, the line break and the byte-order mark. Indentation is always one
 * tab per enclosing block, and one space separates two tokens on a line.
 *
 * The engine can join lines as well as split them: a block may be put on one line although it
 * was written over several, as long as nothing in it runs to the end of its line (a comment,
 * quoted text over several lines, `@[` without its `]`). Two things are never moved apart: a
 * pair's key, operator and the head of its value stay on one line unless a comment stands
 * between them, and a name written before a key stays on the key's line, since the parser reads
 * it as that key's prefix only there.
 */

/** How blocks of one shape are laid out. */
export interface BlockRule {
    /**
     * `as-written`: on one line when the author wrote it on one line, over several otherwise;
     * `one-line`: on one line whenever it can be (nothing in it runs to the end of its line, no
     * block in it must be over several), holds no more than `maxItems` and, with `simple`, only
     * simple items; `several`: always over several lines. In every case a block on one line whose
     * line is wider than `width` is put over several lines.
     */
    readonly layout: 'as-written' | 'one-line' | 'several';
    /** With `one-line`: the most items a block on one line may hold. */
    readonly maxItems?: number;
    /**
     * With `one-line`: only when every item is simple, a single token (a plain value) or a pair
     * with no name before its key whose value is a single token (`is_adult = yes`).
     */
    readonly simple?: boolean;
}

export interface LayoutRules {
    /** Blocks that hold pairs, or pairs and values mixed (`blockShape` `statements`). */
    readonly statements: BlockRule;
    /** Blocks that hold only values (`blockShape` `list`). */
    readonly lists: BlockRule;
    /** Blocks that hold nothing but, perhaps, comments: `{}` on one line. */
    readonly empty: BlockRule;
    /**
     * The values of a block over several lines: on the lines they were written on, after what
     * precedes them (`as-written`; a block written on one line and split has one a line), or
     * one value a line (`one-per-line`).
     */
    readonly values: 'as-written' | 'one-per-line';
    /** The widest a line may be, in columns (`width.ts`), before a block on it is split. */
    readonly width: number;
    /** The most blank lines kept between two items; none after `{`, before `}`, at either end. */
    readonly blankLines: number;
    /** The line break: the kind the file uses most (`\r\n` on a tie), or always one kind. */
    readonly lineEnding: 'majority' | '\n' | '\r\n';
    /** The byte-order mark: kept as the file has it, always written, or never. */
    readonly bom: 'keep' | 'write' | 'omit';
}

/**
 * The rules of docs/formatting.md (the owner's decisions of 2026-11-23): best practice over the
 * author's layout. A block holding one simple pair, a list of plain values and an empty block
 * go on one line when the line fits in 120 columns; every other block is broken, one item a
 * line. Windows line breaks and the byte-order mark in every file, the game's own form. At
 * most one blank line between two items.
 */
export const FORMAT_RULES: LayoutRules = {
    statements: { layout: 'one-line', maxItems: 1, simple: true },
    lists: { layout: 'one-line' },
    empty: { layout: 'one-line' },
    values: 'one-per-line',
    width: 120,
    blankLines: 1,
    lineEnding: '\r\n',
    bom: 'write',
};

/** The table every surface formats with: the editor, the command line and the agent server. */
export const DEFAULT_RULES: LayoutRules = FORMAT_RULES;
