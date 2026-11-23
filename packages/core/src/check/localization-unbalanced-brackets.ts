/**
 * `localization/unbalanced-brackets` (docs/checks.md, item 4.6): localization text with an
 * extra `[` or `]`. Evidence: the catalogue's two messages of the game's localization reader,
 * `loc_key_X_unexpected_extra_at_position_X_file_X` ("Loc key `{}`: Unexpected extra `[` at
 * position {} - file `{}`") and its `_2` ("... extra `]` ..."), kept beside
 * `pdx_data_localize.cpp` in the executable.
 *
 * In an entry's text, `[` opens a data-binding statement and `]` closes it. Inside one, text in
 * single quotes is a literal (`[Glossary('Venetoi\\'s', ...)]`): a bracket there is text, and a
 * quote after a backslash does not end it. A `[` inside a statement that is still open is an
 * extra `[`; a `]` with no statement open is an extra `]`. Each entry is reported at its first
 * such bracket only: after it, what the game reads as a statement is not known.
 *
 * The row also names the 1.21 executable's "Unterminated '['", "Unterminated '('", "Unterminated
 * `'`" and "Unterminated '$'" messages. The committed catalogue does not carry them, so a
 * statement, a parenthesis, a quote or a `$` left open is not reported until it does
 * (docs/checks.md, evidence "Executable").
 *
 * The base game: no entry of any of its eleven languages has an extra bracket.
 */

import type { LocalizationFile } from '../index/localization.js';
import { catalogueEvidence, type CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'localization/unbalanced-brackets';

/** The message of an extra `]`: the row's second catalogue entry. */
export const EXTRA_CLOSE = 'loc_key_X_unexpected_extra_at_position_X_file_X_2';

const OPEN = 91; // [
const CLOSE = 93; // ]
const QUOTE = 39; // '
const BACKSLASH = 92;

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

export function unbalancedBrackets(
    file: string,
    loc: LocalizationFile,
    context: CheckContext,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const entry of loc.entries) {
        const extra = extraBracket(loc.text.slice(entry.textStart, entry.textEnd));
        if (extra === undefined) {
            continue;
        }
        const at = entry.textStart + extra.at;
        const made = finding(
            CODE,
            { start: at, end: at + 1 },
            [entry.key, String(extra.at), file],
            { key: entry.key, bracket: extra.close ? ']' : '[' },
            context,
        );
        out.push(
            extra.close
                ? { ...made, evidence: catalogueEvidence(EXTRA_CLOSE, context.catalogue) }
                : made,
        );
    }
    return out;
}
