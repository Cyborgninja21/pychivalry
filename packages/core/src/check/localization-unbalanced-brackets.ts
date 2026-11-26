/**
 * `localization/unbalanced-brackets` (docs/checks.md, item 4.6): localization text with an
 * extra `[` or `]`, or an opener left open. Evidence: the catalogue's messages of the game's
 * localization reader, kept beside `pdx_data_localize.cpp` in the executable:
 * `loc_key_X_unexpected_extra_at_position_X_file_X` ("Loc key `{}`: Unexpected extra `[` at
 * position {} - file `{}`") and its `_2` ("... extra `]` ..."); and, since the spec package's
 * format 9, its four "Unterminated" messages ("Loc key `{}`: Unterminated '[' at position {} in
 * [...] data statement - file `{}`", and the same of a `(` in a `[(...)]` parenthesis statement,
 * a `'` in `['...']` single quotes, a `$` in a `$...$` localization replacement).
 *
 * In an entry's text, `[` opens a data-binding statement and `]` closes it. Inside one, text in
 * single quotes is a literal (`[Glossary('Venetoi\\'s', ...)]`): a bracket there is text, and a
 * quote after a backslash does not end it; a `(` opens a parenthesis that a `)` closes. Outside
 * statements, `$name$` is a localization replacement, `$$` an escaped dollar sign. A `[` inside a
 * statement that is still open is an extra `[`; a `]` with no statement open is an extra `]`. Each
 * entry is reported at its first such bracket only: after it, what the game reads as a statement
 * is not known.
 *
 * An entry with no extra bracket is reported when its text ends with an opener left open, at the
 * opener, the innermost first: a quote of a statement, else a parenthesis of a statement, else the
 * statement itself, else a `$` outside statements that no `$` closes. Not decided, so not
 * reported: an entry in which a `]` closes a statement while a parenthesis in it is open (whether
 * the reader then reads the `]` as text is not shown), and a `$` inside a statement. The position
 * the message gives is the opener's place in the text, as for an extra bracket; whether the
 * game's own position for these messages is the opener's is for the captured logs of step 11 to
 * show.
 *
 * The base game: no entry of any of its eleven languages has an extra bracket or an opener left
 * open (3,100,662 entries).
 */

import type { LocalizationFile } from '../index/localization.js';
import { catalogueEvidence, type CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'localization/unbalanced-brackets';

/** The message of an extra `]`: the row's second catalogue entry. */
export const EXTRA_CLOSE = 'loc_key_X_unexpected_extra_at_position_X_file_X_2';

/** The message of each opener left open: the row's catalogue entries since format 9. */
export const UNTERMINATED: Readonly<Record<Opener, string>> = {
    '[': 'loc_key_X_unterminated_at_position_X_in_data_statement_file',
    '(': 'loc_key_X_unterminated_at_position_X_in_data_parenthesis_sta',
    "'": 'loc_key_X_unterminated_at_position_X_in_data_single_quotes_f',
    $: 'loc_key_X_unterminated_at_position_X_in_localization_replace',
};

/** What can be left open in a localization text. */
export type Opener = '[' | '(' | "'" | '$';

const OPEN = 91; // [
const CLOSE = 93; // ]
const QUOTE = 39; // '
const BACKSLASH = 92;
const PAREN_OPEN = 40; // (
const PAREN_CLOSE = 41; // )
const DOLLAR = 36; // $

/** The first extra bracket of a text: its index and whether it is a `]`, or undefined. */
export function extraBracket(
    text: string,
): { readonly at: number; readonly close: boolean } | undefined {
    let open = false;
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (quoted) {
            if (code === QUOTE && text.charCodeAt(i - 1) !== BACKSLASH) {
                quoted = false;
            }
        } else if (open && code === QUOTE) {
            quoted = true;
        } else if (code === OPEN) {
            if (open) {
                return { at: i, close: false };
            }
            open = true;
        } else if (code === CLOSE) {
            if (!open) {
                return { at: i, close: true };
            }
            open = false;
        }
    }
    return undefined;
}

/**
 * The opener a text leaves open at its end, of a text with no extra bracket (`extraBracket`):
 * its index and what it is, or undefined (see the head of this file for what is not decided).
 */
export function openBracket(
    text: string,
): { readonly at: number; readonly opener: Opener } | undefined {
    let open = -1;
    let quoted = -1;
    const parens: number[] = [];
    let dollar = -1;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (quoted >= 0) {
            if (code === QUOTE && text.charCodeAt(i - 1) !== BACKSLASH) {
                quoted = -1;
            }
        } else if (open >= 0) {
            if (code === QUOTE) {
                quoted = i;
            } else if (code === PAREN_OPEN) {
                parens.push(i);
            } else if (code === PAREN_CLOSE) {
                parens.pop();
            } else if (code === OPEN) {
                // An extra `[`: the other finding.
                return undefined;
            } else if (code === CLOSE) {
                if (parens.length > 0) {
                    // A `]` inside an open parenthesis: how the reader reads it is not shown.
                    return undefined;
                }
                open = -1;
            }
        } else if (code === OPEN) {
            open = i;
        } else if (code === CLOSE) {
            return undefined;
        } else if (code === DOLLAR) {
            dollar = dollar < 0 ? i : -1;
        }
    }
    if (quoted >= 0) {
        return { at: quoted, opener: "'" };
    }
    const paren = parens[parens.length - 1];
    if (open >= 0 && paren !== undefined) {
        return { at: paren, opener: '(' };
    }
    if (open >= 0) {
        return { at: open, opener: '[' };
    }
    return dollar >= 0 ? { at: dollar, opener: '$' } : undefined;
}

export function unbalancedBrackets(
    file: string,
    loc: LocalizationFile,
    context: CheckContext,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const entry of loc.entries) {
        const text = loc.text.slice(entry.textStart, entry.textEnd);
        const extra = extraBracket(text);
        if (extra !== undefined) {
            const at = entry.textStart + extra.at;
            const made = finding(
                CODE,
                { start: at, end: at + 1 },
                [entry.key, String(extra.at), file],
                { key: entry.key, bracket: extra.close ? ']' : '[', problem: 'extra' },
                context,
            );
            out.push(
                extra.close
                    ? { ...made, evidence: catalogueEvidence(EXTRA_CLOSE, context.catalogue) }
                    : made,
            );
            continue;
        }
        const left = openBracket(text);
        if (left === undefined) {
            continue;
        }
        const at = entry.textStart + left.at;
        out.push(
            finding(
                CODE,
                { start: at, end: at + 1 },
                [entry.key, String(left.at), file],
                { key: entry.key, bracket: left.opener, problem: 'unterminated' },
                context,
                catalogueEvidence(UNTERMINATED[left.opener], context.catalogue),
            ),
        );
    }
    return out;
}
