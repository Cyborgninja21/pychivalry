/**
 * The rows of docs/checks.md that item 4.7's advice checks emit: each information or a hint,
 * with the evidence "Advice" and pychivalry's own message, `%s` for each value.
 */

import type { AdviceCode, CheckKind } from './finding.js';

function advice(
    severity: 'information' | 'hint',
    slots: number,
    description: string,
    text: string,
): CheckKind {
    return {
        severity,
        catalogue: null,
        advice: true,
        slots: Array.from({ length: slots }, () => 'value' as const),
        description,
        text,
    };
}

/** Every advice code, with its row of docs/checks.md. */
export const ADVICE_KINDS: Readonly<Record<AdviceCode, CheckKind>> = {
    'fields/usually-present': advice(
        'information',
        3,
        'A record without a field that every base-game record of its kind sets.',
        "'%s' has no '%s', which every one of the base game's %s records of its kind sets.",
    ),
    'fields/unusual-value': advice(
        'hint',
        3,
        'A value no base-game record writes in a field whose values form a small set.',
        "The base game never writes '%s' in '%s'; it writes %s.",
    ),
    'references/unknown-name': advice(
        'information',
        2,
        'A value naming a definition the index does not hold, where no game message is known.',
        "'%s' names nothing defined in %s by the mod or the base game.",
    ),
    'structure/namespace-outside-events': advice(
        'information',
        2,
        'A file outside the event folder that declares a namespace.',
        "The namespace '%s' is declared outside %s, where no event uses it.",
    ),
    'structure/event-unknown-type': advice(
        'information',
        2,
        'An event type the game does not document.',
        "'%s' is not an event type the game documents: %s.",
    ),
    'structure/event-letter-without-sender': advice(
        'information',
        2,
        'A letter event without a sender.',
        "The letter event '%s' has no '%s'.",
    ),
    'structure/event-without-desc': advice(
        'information',
        2,
        'An event that is not hidden and has no description.',
        "The event '%s' is not hidden and has no '%s'.",
    ),
    'structure/event-without-option': advice(
        'information',
        2,
        'An event that is not hidden and has no option.',
        "The event '%s' is not hidden and has no '%s'.",
    ),
    'structure/event-after-without-option': advice(
        'information',
        3,
        'An event that is not hidden, has an after block and no option.',
        "The event '%s' has '%s' but no %s, without which it does nothing.",
    ),
    'structure/event-several-immediate': advice(
        'information',
        2,
        'An event with more than one immediate block.',
        "The event '%s' has more than one '%s'.",
    ),
    'structure/event-several-after': advice(
        'information',
        2,
        'An event with more than one after block.',
        "The event '%s' has more than one '%s'.",
    ),
    'structure/event-empty': advice(
        'information',
        1,
        'An event with nothing in it.',
        "The event '%s' is empty.",
    ),
    'structure/event-portrait-position-twice': advice(
        'information',
        2,
        'One portrait position given twice in an event.',
        "The event '%s' gives '%s' more than once.",
    ),
    'structure/event-triggered-animation-without-trigger': advice(
        'information',
        2,
        "A portrait's triggered animation without a trigger.",
        "This '%s' has no '%s'.",
    ),
    'structure/event-triggered-animation-without-animation': advice(
        'information',
        2,
        'A triggered animation with no animation.',
        "This '%s' has none of %s.",
    ),
    'structure/logic-operator-without-block': advice(
        'information',
        1,
        'A logical operator with a single value instead of a block.',
        "'%s' is given a single value instead of a block of triggers.",
    ),
    'structure/else-without-if': advice(
        'information',
        2,
        'An else branch not directly after the conditional it belongs to.',
        "'%s' is not directly after %s.",
    ),
    'structure/trigger-else-without-trigger-if': advice(
        'information',
        2,
        'A trigger else branch not directly after the conditional it belongs to.',
        "'%s' is not directly after %s.",
    ),
    'structure/switch-without-trigger': advice(
        'information',
        2,
        'A switch block without the trigger its cases are values of.',
        "This '%s' has no '%s'.",
    ),
    'structure/switch-without-branches': advice(
        'information',
        1,
        'A switch block with no branch.',
        "This '%s' has no branch.",
    ),
    'structure/round-to-not-positive': advice(
        'information',
        2,
        'A rounding step of zero or a negative number.',
        "'%s' is %s; it rounds to a multiple of a number above zero.",
    ),
    'structure/casus-belli-without-outcome': advice(
        'information',
        2,
        'A casus belli with none of its outcome effects.',
        "The casus belli '%s' has none of %s.",
    ),
    'structure/story-effect-group-without-timing': advice(
        'information',
        2,
        "A story cycle's effect group with no interval.",
        "This '%s' has none of %s.",
    ),
    'structure/story-effect-group-several-timings': advice(
        'information',
        2,
        "A story cycle's effect group with more than one interval.",
        "This '%s' has more than one of %s.",
    ),
    'structure/story-effect-group-without-effect': advice(
        'information',
        2,
        "A story cycle's effect group with no effect to run.",
        "This '%s' has none of %s.",
    ),
    'structure/story-effect-group-chance-above-100': advice(
        'information',
        3,
        "A story cycle's effect group whose chance is above 100.",
        "'%s' is %s, above %s.",
    ),
    'structure/story-effect-group-chance-not-positive': advice(
        'information',
        2,
        "A story cycle's effect group whose chance is zero or less.",
        "'%s' is %s; the effect group would never run.",
    ),
    'scope/saved-late-read-in-desc': advice(
        'information',
        3,
        "A scope read in an event's description that the event saves only after its window is shown.",
        "'%s' is read in '%s', but the event saves it only in %s, after the window is shown.",
    ),
};
