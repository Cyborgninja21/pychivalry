/**
 * The rows of the `style/` family (docs/checks.md, "Formatting"; docs/formatting.md, "Style
 * findings"): where a file is not in pychivalry's format. They rest on pychivalry's own
 * formatting rules, not on the game (evidence `formatting-rules`): by the owner's decision of
 * 2026-11-23 the one kind of warning that does (docs/MVP.md, principle 1). Every finding of the
 * family has a safe fix, made by the formatter (`format/style.ts`); a file with a parse error has
 * none.
 */

import type { StyleCode } from '../format/style.js';
import type { CheckKind } from './finding.js';

export type { StyleCode };

/** Where the formatting rules are written: the evidence of every `style/` finding. */
export const FORMATTING_RULES_SOURCE = 'docs/formatting.md';

export const STYLE_KINDS: Readonly<Record<StyleCode, CheckKind>> = {
    'style/not-formatted': {
        severity: 'warning',
        catalogue: null,
        formattingRules: true,
        slots: ['value'],
        description:
            "A file that is not in pychivalry's format: one finding a file, whose fix formats the whole file.",
        text: "This file is not in pychivalry's format: %s.",
    },
    'style/indentation': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: ['value'],
        description:
            'A line indented otherwise than the format says: one tab for each enclosing block in a script file, one space before an entry or a comment in a localization file.',
        text: 'This line takes %s.',
    },
    'style/spacing': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: ['value'],
        description:
            "Two tokens on a line not one space apart (around an operator, inside the braces of a block on one line, between values; an empty block's braces with nothing between them), or an entry's key and its text not one space apart.",
        text: "One space between the tokens: '%s'.",
    },
    'style/comment-spacing': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: [],
        description: 'A comment at the end of a line not one space after the code before it.',
        text: 'One space goes before a comment at the end of a line.',
    },
    'style/trailing-whitespace': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: [],
        description: 'Spaces or tabs at the end of a line, or on a blank line.',
        text: 'Spaces or tabs at the end of a line.',
    },
    'style/blank-lines': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: ['value', 'value'],
        description:
            "Blank lines beyond one between two items, or any after '{', before '}' or at either end of the file.",
        text: '%s here; the format keeps %s.',
    },
    'style/block-layout': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: ['value'],
        description:
            'A block laid out otherwise than the format says: on one line when it holds one simple pair, plain values or nothing and fits in 120 columns, otherwise over several lines, one item a line; a pair on one line. One finding a block.',
        text: 'Layout: %s.',
    },
    'style/line-endings': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: ['value'],
        description:
            'Line breaks other than Windows line breaks (\\r\\n), or none at the end of the file. One finding a file.',
        text: 'Line breaks: %s.',
    },
    'style/byte-order-mark': {
        severity: 'hint',
        catalogue: null,
        formattingRules: true,
        slots: [],
        description:
            'A file that does not start with the UTF-8 byte-order mark. One finding a file.',
        text: 'The file does not start with the UTF-8 byte-order mark.',
    },
};
