/**
 * Fix data (docs/PLAN.md item 8.6; docs/MVP.md, principle 3): where a finding has a mechanical
 * fix, the fix is part of the finding, as data. Every surface reports the same data: the
 * command line's JSON, the agent server's `check` and the language server's quick fixes are
 * renderings of it, and none decides a fix of its own.
 *
 * - **A fix** is one or more alternatives, each a title and the edits that make it: a span of a
 *   file replaced with new text. An edit may be in another file than the finding's (a
 *   localization stub), and may create that file (`create`).
 * - **Safe or a suggestion.** A safe fix has one alternative: the only outcome that can be
 *   right, so it may be applied without review (`check --fix`, the editor's "fix all"). Every
 *   other fix is a suggestion: one or more alternatives a person or an agent chooses from, in
 *   the order the data supports them. A fix never guesses: where the right fix is a choice the
 *   tool cannot make, it offers the alternatives the spec package and the index support, or
 *   none.
 * - **What it rests on** (`basis`): the spec package's list of removed keywords, the bounded
 *   "did you mean" over the names valid at the place, the links the game documents between
 *   scopes, the parser's own reading of the text, and so on (`FixBasis`).
 * - **Checked by construction.** A fix offered as safe is applied, with the file's other safe
 *   fixes, and the file checked again: a safe fix whose finding stays, or that brings a new
 *   error or warning into its file, is offered as a suggestion instead (`fix/verify.ts`).
 * - **Bounded.** At most `MAX_FIX_ALTERNATIVES` alternatives, the count of all of them given
 *   when the list is cut; an edit inserts or replaces only the text it must, never a whole
 *   block, so a fix stays small whatever the size of what it fixes.
 *
 * Places are those of the finding: lines and characters counted from 0, the character in
 * UTF-16 code units, in the file's text without its byte-order mark (docs/encoding.md).
 */

import type { Range } from '../syntax/position.js';

/** The most alternatives a fix lists. */
export const MAX_FIX_ALTERNATIVES = 5;

/**
 * What a fix rests on.
 *
 * - `retired`: the spec package's list of removed keywords, and the replacement it documents.
 * - `nearest-name`: the bounded "did you mean" of lookup (`lookup/suggest.ts`) over the names
 *   that are valid at the place, from the spec package and the index.
 * - `scope-links`: the links the game's own documentation says lead from the scope a keyword
 *   or link is in to the scopes it takes (the finding's `links_from_scope`).
 * - `parser`: the parser's own reading of the text: what it read a broken line as.
 * - `required-field`: a field the spec package marks required, with its measured value type.
 * - `localization-files`: where the game reads localization: the mod's `localization/`
 *   folder, a file named for its language, with the byte-order mark and the header line.
 * - `game-message`: the game's own message names what makes the script right.
 * - `observed-values`: the values the base game writes in the field.
 * - `range`: a range's two bounds, written in the order the game reads them.
 * - `declared-names`: the names the file declares (an event's namespace).
 * - `windows-1252`: the bytes of a file that are not valid UTF-8, read as Windows-1252, the
 *   code page the game's own message for title history asks for ("ansi").
 * - `field-order`: the usual order of a folder's record fields, from the presentation data, in
 *   a folder whose record fields the game reads by name.
 */
export type FixBasis =
    | 'retired'
    | 'nearest-name'
    | 'scope-links'
    | 'parser'
    | 'required-field'
    | 'localization-files'
    | 'game-message'
    | 'observed-values'
    | 'range'
    | 'declared-names'
    | 'windows-1252'
    | 'field-order';

/** One edit: a span of a file replaced with new text. */
export interface FixEdit {
    /** The file's path inside the mod, with `/`. */
    readonly file: string;
    /** The span replaced; empty for an insertion. */
    readonly range: Range;
    readonly new_text: string;
    /**
     * True when the file does not exist yet: the edit creates it, its range the start of the
     * file, its text the whole file (a byte-order mark, U+FEFF, first where the game needs one).
     */
    readonly create?: true;
}

/** One way to fix a finding. */
export interface FixAlternative {
    /** What it does, in a few words, for a person. */
    readonly title: string;
    /** The edits, in the order they are applied; never two that overlap in one file. */
    readonly edits: readonly FixEdit[];
}

/** The fix of a finding: safe, with one alternative, or a suggestion among alternatives. */
export interface FindingFix {
    /** `safe`: the only outcome that can be right. `suggestion`: a choice to make. */
    readonly safety: 'safe' | 'suggestion';
    readonly basis: FixBasis;
    /** At most `MAX_FIX_ALTERNATIVES`; exactly one when the fix is safe. */
    readonly alternatives: readonly FixAlternative[];
    /** How many alternatives there are in all, given only when the list was cut. */
    readonly alternatives_total?: number;
}

/** A safe fix: one alternative. */
export function safeFix(basis: FixBasis, alternative: FixAlternative): FindingFix {
    return { safety: 'safe', basis, alternatives: [alternative] };
}

/** A suggestion: the alternatives, at most `MAX_FIX_ALTERNATIVES`; null when there are none. */
export function suggestion(
    basis: FixBasis,
    alternatives: readonly FixAlternative[],
): FindingFix | null {
    if (alternatives.length === 0) {
        return null;
    }
    const shown = alternatives.slice(0, MAX_FIX_ALTERNATIVES);
    return {
        safety: 'suggestion',
        basis,
        alternatives: shown,
        ...(alternatives.length > shown.length ? { alternatives_total: alternatives.length } : {}),
    };
}

/** The same fix offered as a suggestion: what a safe fix becomes when it does not verify. */
export function asSuggestion(fix: FindingFix): FindingFix {
    return fix.safety === 'suggestion' ? fix : { ...fix, safety: 'suggestion' };
}

/** True when two ranges overlap, or one insertion is inside the other's span. */
export function rangesOverlap(a: Range, b: Range): boolean {
    const before = (x: Range['start'], y: Range['start']): boolean =>
        x.line < y.line || (x.line === y.line && x.character < y.character);
    const empty = (r: Range): boolean =>
        r.start.line === r.end.line && r.start.character === r.end.character;
    if (empty(a) && empty(b)) {
        return false;
    }
    // Two spans overlap unless one ends at or before the other starts.
    return before(a.start, b.end) && before(b.start, a.end);
}

/** True when an alternative's edits overlap any of `taken` in the same file. */
export function overlapsAny(alternative: FixAlternative, taken: readonly FixEdit[]): boolean {
    return alternative.edits.some((edit) =>
        taken.some((t) => t.file === edit.file && rangesOverlap(t.range, edit.range)),
    );
}
