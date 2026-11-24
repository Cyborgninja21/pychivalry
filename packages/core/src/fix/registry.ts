/**
 * Which codes have a mechanical fix, and what it is (docs/PLAN.md item 8.7): every code of
 * this build has a row, so a code added without one does not compile. A row says whether the
 * code's fix is safe (applied without review), safe in some cases and a suggestion in others,
 * a suggestion only, or none, and why in a sentence; the user guide's check reference shows it.
 */

import type { Code } from '../check/inventory.js';
import type { Fixer } from './file.js';
import { emptyBlockFix } from './empty-block.js';
import { notUtf8Fix } from './encoding.js';
import { unusualFieldOrderFix } from './field-order.js';
import { localizationStubFix } from './localization-stub.js';
import { bareValueFix, eventShownFix, missingRequiredFieldFix, rangeSwapFix } from './records.js';
import { linkOnWrongScopeFix, wrongScopeFix } from './scope-links.js';
import { missingClosingBraceFix, unexpectedClosingBraceFix } from './syntax-braces.js';
import { missingEqualsFix, missingOperatorFix, nullSafeAfterValueFix } from './syntax-operators.js';
import { unknownEffectFix, unknownTriggerFix } from './unknown-keyword.js';
import {
    unknownFieldFix,
    unknownKeyFix,
    unknownLinkFix,
    unknownModifierFix,
    unknownOnActionFix,
    unknownReferenceNameFix,
} from './unknown-name.js';
import {
    unbalancedBracketFix,
    undeclaredNamespaceFix,
    unknownEventTypeFix,
    unusualValueFix,
    wrongKindFix,
} from './values.js';

/**
 * What a code's fix is: `safe` (always safe where it is offered), `safe-or-suggestion` (safe
 * when only one outcome can be right, otherwise alternatives), `suggestion` (alternatives
 * only), or `none`.
 */
export type FixOffer = 'safe' | 'safe-or-suggestion' | 'suggestion' | 'none';

export interface FixRow {
    readonly offer: FixOffer;
    /** What the fix does, or why there is none, in a sentence. */
    readonly what: string;
    readonly fixer?: Fixer;
}

const NONE_ADVICE = 'None: the right change is a choice of content the data does not make.';

/** Every code's fix. */
export const FIX_ROWS: Readonly<Record<Code, FixRow>> = {
    'syntax/missing-closing-brace': {
        offer: 'suggestion',
        what: "A '}' where the indentation says the block ends, or at the end of the file.",
        fixer: missingClosingBraceFix,
    },
    'syntax/unexpected-closing-brace': {
        offer: 'safe',
        what: "The '}' that closes no block taken away: the file reads as before.",
        fixer: unexpectedClosingBraceFix,
    },
    'syntax/block-without-key': {
        offer: 'none',
        what: "None: the block's name is a choice.",
    },
    'syntax/operator-without-key': {
        offer: 'none',
        what: 'None: the key is a choice.',
    },
    'syntax/missing-value': {
        offer: 'none',
        what: 'None: the value is a choice.',
    },
    'syntax/missing-operator': {
        offer: 'safe',
        what: "The '=' written between the key and the value on its line.",
        fixer: missingOperatorFix,
    },
    'syntax/missing-equals-before-block': {
        offer: 'safe',
        what: "The '=' written between the name and its block, as the parser reads it.",
        fixer: missingEqualsFix,
    },
    'syntax/null-safe-operator-after-value': {
        offer: 'safe-or-suggestion',
        what: "A quoted name or scope chain written without its quotes (safe); otherwise '?=' written as '='.",
        fixer: nullSafeAfterValueFix,
    },
    'syntax/unterminated-string': {
        offer: 'none',
        what: 'None: where the text ends is a choice, and closing it at the end of its line can make a key of text cut off mid-edit.',
    },
    'syntax/malformed-arithmetic': {
        offer: 'none',
        what: 'None: what the expression should compute is a choice.',
    },
    'encoding/not-utf8': {
        offer: 'none',
        what: 'None: which encoding the file was written in is not known.',
    },
    'names/unknown-trigger': {
        offer: 'safe-or-suggestion',
        what: 'The documented replacement of a removed trigger, or the triggers near the name that fit the scope; safe when there is only one.',
        fixer: unknownTriggerFix,
    },
    'names/unknown-effect': {
        offer: 'safe-or-suggestion',
        what: 'The documented replacement of a removed effect, or the effects near the name that fit the scope; safe when there is only one.',
        fixer: unknownEffectFix,
    },
    'names/unknown-link': {
        offer: 'safe-or-suggestion',
        what: 'The links near the segment that start from its scope; safe when there is only one.',
        fixer: unknownLinkFix,
    },
    'names/unknown-modifier': {
        offer: 'safe-or-suggestion',
        what: 'The documented replacement of a removed modifier, or the modifiers near the name whose use areas fit the block; safe when there is only one.',
        fixer: unknownModifierFix,
    },
    'names/unknown-on-action': {
        offer: 'safe-or-suggestion',
        what: 'The on-actions near the name, of the game and the mod; safe when there is only one.',
        fixer: unknownOnActionFix,
    },
    'names/modifier-outside-use-area': {
        offer: 'none',
        what: 'None: whether the modifier moves to another block or another modifier is meant is a choice.',
    },
    'fields/unknown-field': {
        offer: 'safe-or-suggestion',
        what: "The fields of the record's folder near the name, not already written; safe when there is only one.",
        fixer: unknownFieldFix,
    },
    'fields/bare-value-in-record': {
        offer: 'safe-or-suggestion',
        what: "A field of the record measured boolean written as '= yes' (safe when the base game writes only yes).",
        fixer: bareValueFix,
    },
    'fields/missing-required-field': {
        offer: 'suggestion',
        what: 'The field written with a placeholder of its kind to set, where its value is a number or a boolean.',
        fixer: missingRequiredFieldFix,
    },
    'fields/wrong-kind-of-value': {
        offer: 'suggestion',
        what: 'The values the base game writes in the field, where they are a small set.',
        fixer: wrongKindFix,
    },
    'fields/usually-present': {
        offer: 'none',
        what: "None: the field's value is a choice.",
    },
    'fields/unusual-value': {
        offer: 'suggestion',
        what: 'The values the base game writes in the field that are near the one written.',
        fixer: unusualValueFix,
    },
    'references/unknown-key': {
        offer: 'safe-or-suggestion',
        what: 'The keys of the database near the one written; safe when there is only one.',
        fixer: unknownKeyFix,
    },
    'references/unknown-name': {
        offer: 'suggestion',
        what: 'The names of the folder near the one written (advice: never safe).',
        fixer: unknownReferenceNameFix,
    },
    'structure/event-undeclared-namespace': {
        offer: 'suggestion',
        what: 'The id written with a declared namespace near it, where that id is free; or the namespace declared at the top of the file.',
        fixer: undeclaredNamespaceFix,
    },
    'structure/range-min-above-max': {
        offer: 'safe',
        what: 'The two bounds written low first.',
        fixer: rangeSwapFix,
    },
    'structure/event-non-character-shown': {
        offer: 'suggestion',
        what: "Each keyword the game's message names written as '= yes' (hidden, major).",
        fixer: eventShownFix,
    },
    'definitions/clash': {
        offer: 'none',
        what: 'None: which definition gets another name is a choice.',
    },
    'definitions/not-read': {
        offer: 'none',
        what: 'None: the file is replaced or hidden on purpose, or moved: a choice.',
    },
    'scope/wrong-scope-for-trigger': {
        offer: 'safe-or-suggestion',
        what: 'The trigger wrapped in a link that leads to a scope it takes, where at most five do; safe when only one plain link does.',
        fixer: wrongScopeFix,
    },
    'scope/wrong-scope-for-effect': {
        offer: 'safe-or-suggestion',
        what: 'The effect wrapped in a link that leads to a scope it takes, where at most five do; safe when only one plain link does.',
        fixer: wrongScopeFix,
    },
    'scope/link-on-wrong-scope': {
        offer: 'safe-or-suggestion',
        what: 'A link that leads to a scope the link starts from written before it, where at most five do; safe when only one plain link does.',
        fixer: linkOnWrongScopeFix,
    },
    'scope/undefined-event-target': {
        offer: 'none',
        what: 'None: the name may be saved where the index cannot see, and which save is meant is a choice.',
    },
    'scope/saved-late-read-in-desc': {
        offer: 'none',
        what: 'None: moving the save is a change of what the event does.',
    },
    'localization/missing-key': {
        offer: 'suggestion',
        what: "A stub entry for the key in the mod's localization file of each language it has (one is made when it has none).",
        fixer: localizationStubFix,
    },
    'localization/unbalanced-brackets': {
        offer: 'suggestion',
        what: 'The statement left open closed after its command, or the extra bracket taken away; offered only where the entry is then balanced.',
        fixer: unbalancedBracketFix,
    },
    'localization/unused-key': {
        offer: 'none',
        what: 'None: removing a key deletes text that may be wanted.',
    },
    'structure/event-unknown-type': {
        offer: 'suggestion',
        what: 'The documented event types near the one written.',
        fixer: unknownEventTypeFix,
    },
    'structure/namespace-outside-events': { offer: 'none', what: NONE_ADVICE },
    'structure/event-letter-without-sender': { offer: 'none', what: NONE_ADVICE },
    'structure/event-without-desc': { offer: 'none', what: NONE_ADVICE },
    'structure/event-without-option': { offer: 'none', what: NONE_ADVICE },
    'structure/event-after-without-option': { offer: 'none', what: NONE_ADVICE },
    'structure/event-several-immediate': {
        offer: 'none',
        what: 'None: merging the blocks changes the order effects run in.',
    },
    'structure/event-several-after': {
        offer: 'none',
        what: 'None: merging the blocks changes the order effects run in.',
    },
    'structure/event-empty': {
        offer: 'none',
        what: 'None: removing the event deletes a definition that may be named elsewhere.',
    },
    'structure/event-portrait-position-twice': { offer: 'none', what: NONE_ADVICE },
    'structure/event-triggered-animation-without-trigger': { offer: 'none', what: NONE_ADVICE },
    'structure/event-triggered-animation-without-animation': { offer: 'none', what: NONE_ADVICE },
    'structure/logic-operator-without-block': { offer: 'none', what: NONE_ADVICE },
    'structure/else-without-if': { offer: 'none', what: NONE_ADVICE },
    'structure/trigger-else-without-trigger-if': { offer: 'none', what: NONE_ADVICE },
    'structure/switch-without-trigger': { offer: 'none', what: NONE_ADVICE },
    'structure/switch-without-branches': { offer: 'none', what: NONE_ADVICE },
    'structure/round-to-not-positive': { offer: 'none', what: NONE_ADVICE },
    'structure/casus-belli-without-outcome': { offer: 'none', what: NONE_ADVICE },
    'structure/story-effect-group-without-timing': { offer: 'none', what: NONE_ADVICE },
    'structure/story-effect-group-several-timings': { offer: 'none', what: NONE_ADVICE },
    'structure/story-effect-group-without-effect': { offer: 'none', what: NONE_ADVICE },
    'structure/story-effect-group-chance-above-100': { offer: 'none', what: NONE_ADVICE },
    'structure/story-effect-group-chance-not-positive': { offer: 'none', what: NONE_ADVICE },
    'style/empty-block': {
        offer: 'suggestion',
        what: "The empty pair taken away, where the block around it keeps something; whether an empty block means something is the author's to say.",
        fixer: emptyBlockFix,
    },
    'style/deep-nesting': {
        offer: 'none',
        what: 'None: how to restructure deep script is a choice.',
    },
    'style/not-utf8': {
        offer: 'safe-or-suggestion',
        what: 'The file written as UTF-8 with a byte-order mark, its other bytes read as Windows-1252; safe when each such byte reads as a printable character and the file then reads to the same tree.',
        fixer: (_finding, file) => notUtf8Fix(file),
    },
    'style/unusual-field-order': {
        offer: 'safe',
        what: "The record's fields written in the usual order, comments with their field; none where a comment's field is not clear.",
        fixer: unusualFieldOrderFix,
    },
};
