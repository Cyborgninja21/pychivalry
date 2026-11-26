/**
 * The best-practice rows of the family `style`: pychivalry's own best-practice rules (the owner's principle
 * of 2026-11-23: best practice and tidiness come before what a mod's author wrote; an untidy
 * mod is flagged and, where the change is mechanical, fixed). No row has game evidence: each
 * says how often the base game follows it, and none ships that the base game breaks more often
 * than it follows. Each has pychivalry's own message, `%s` for each value, at the severity the
 * owner set for it.
 */

import type { CheckKind } from './finding.js';

/** The codes of the best-practice rules of this file. */
export type BestPracticeCode =
    | 'style/empty-block'
    | 'style/deep-nesting'
    | 'style/not-utf8'
    | 'style/unusual-field-order'
    | 'style/localization-key-characters'
    | 'style/redundant-condition'
    | 'style/redundant-false-condition'
    | 'style/option-without-ai-weight';

function style(
    severity: 'warning' | 'information' | 'hint',
    slots: number,
    description: string,
    text: string,
): CheckKind {
    return {
        severity,
        catalogue: null,
        bestPractice: true,
        slots: Array.from({ length: slots }, () => 'value' as const),
        description,
        text,
    };
}

/** Every best-practice code of this file, with its row of docs/checks.md. */
export const BEST_PRACTICE_KINDS: Readonly<Record<BestPracticeCode, CheckKind>> = {
    'style/empty-block': style(
        'hint',
        2,
        "A block inside a record with nothing in it, or nothing but comments: release 2.3.0's CK3314. An empty iterator that is a condition asks for at least one item, and the message says so; of an empty logical operator, scope switch or trigger block (a `limit`) the message says the spec package leaves its meaning open; of an empty entry of a random list or case of a case list (a `switch` case, its `fallback` among them) the message says what taking it away would change; of an empty option of an event, that taking it away takes a choice away from the player or the AI.",
        "The block '%s' is empty%s.",
    ),
    'style/deep-nesting': style(
        'hint',
        4,
        "A record with a block nested more than six blocks deep, its body the first: one finding a record, at the first such block; release 2.3.0's CK3317.",
        "The block '%s' is %s blocks deep, past the style rule's limit of %s; places in this record past it: %s.",
    ),
    'style/not-utf8': style(
        'warning',
        2,
        'A file that is not valid UTF-8, and how it was read; its fix converts it to UTF-8 with a byte-order mark, reading the bytes that are not as Windows-1252.',
        'This file is not UTF-8: %s of its bytes are not; it was read as %s. Convert it to UTF-8 with a byte-order mark.',
    ),
    'style/unusual-field-order': style(
        'hint',
        3,
        "A record whose fields are written in another order than its folder's usual one, in a folder whose records' fields the game reads by name.",
        "'%s' is written after '%s', against the usual order of the fields of %s.",
    ),
    'style/localization-key-characters': style(
        'hint',
        2,
        "A localization key that starts with a digit or holds a character other than a letter, a digit, '_' or '.': release 2.3.0's LOC-001.",
        "The localization key '%s' %s; a key starts with a letter or '_' and holds only letters, digits, '_' and '.'.",
    ),
    'style/redundant-condition': style(
        'hint',
        2,
        "A condition that always holds, written in a block where it changes nothing while another condition remains: release 2.3.0's CK3872.",
        "'%s' changes nothing in '%s', which holds another condition: take it away.",
    ),
    'style/redundant-false-condition': style(
        'hint',
        2,
        'A condition that always fails, written in a block where it changes nothing while another condition remains.',
        "'%s' changes nothing in '%s', which holds another condition: take it away.",
    ),
    'style/option-without-ai-weight': style(
        'hint',
        3,
        "An option of a shown event with several options that gives the AI no weight to choose it by: release 2.3.0's CK3613.",
        "Option %s of '%s' has neither %s, by which the AI weighs an event's options; the game documents no weight for an option without one.",
    ),
};
