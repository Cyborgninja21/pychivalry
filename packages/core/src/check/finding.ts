/**
 * Findings of the engine checks, in the structured shape of principle 3 of docs/MVP.md: a
 * code, a severity, where it is, the values it is about, the evidence that the game raises it,
 * and the data an agent or a fix needs. Text for a person is a rendering (`checkMessage`).
 *
 * Every code here is a row of docs/checks.md, with the severity and the evidence that row
 * gives; a test checks both against the page. A code is permanent: never renamed, never
 * reused (docs/checks.md, "How a code stays permanent").
 */

import {
    fillPlaceholders,
    type Evidence,
    type MessageCatalogue,
    type Severity,
    type Slot,
} from '../syntax/findings.js';
import type { Range } from '../syntax/position.js';
import { ADVICE_KINDS } from './advice-kinds.js';

/** The codes the engine checks of this build emit. */
export type CheckCode =
    | 'names/unknown-trigger'
    | 'names/unknown-effect'
    | 'names/unknown-link'
    | 'names/unknown-modifier'
    | 'names/unknown-on-action'
    | 'names/modifier-outside-use-area'
    | AdviceCode;

/** The codes of the advice checks of item 4.7: information or hints, with no game message. */
export type AdviceCode =
    | 'fields/usually-present'
    | 'fields/unusual-value'
    | 'references/unknown-name'
    | 'structure/namespace-outside-events'
    | 'structure/event-unknown-type'
    | 'structure/event-letter-without-sender'
    | 'structure/event-without-desc'
    | 'structure/event-without-option'
    | 'structure/event-after-without-option'
    | 'structure/event-several-immediate'
    | 'structure/event-several-after'
    | 'structure/event-empty'
    | 'structure/event-portrait-position-twice'
    | 'structure/event-triggered-animation-without-trigger'
    | 'structure/event-triggered-animation-without-animation'
    | 'structure/logic-operator-without-block'
    | 'structure/else-without-if'
    | 'structure/trigger-else-without-trigger-if'
    | 'structure/switch-without-trigger'
    | 'structure/switch-without-branches'
    | 'structure/round-to-not-positive'
    | 'structure/casus-belli-without-outcome'
    | 'structure/story-effect-group-without-timing'
    | 'structure/story-effect-group-several-timings'
    | 'structure/story-effect-group-without-effect'
    | 'structure/story-effect-group-chance-above-100'
    | 'structure/story-effect-group-chance-not-positive'
    | 'scope/saved-late-read-in-desc';

export interface CheckKind {
    readonly severity: Severity;
    /**
     * The catalogue entry holding the game's own message: the evidence (docs/checks.md); null
     * for a check whose evidence is the game's output with no message (`gameOutput`).
     */
    readonly catalogue: string | null;
    /** For a check with no catalogue message: where the game's output it rests on is. */
    readonly gameOutput?: string;
    /** True for pychivalry's own advice: no game evidence (docs/checks.md, evidence "Advice"). */
    readonly advice?: true;
    /** What the message's placeholders are filled with, in order. */
    readonly slots: readonly Slot[];
    /** What the finding means, in pychivalry's words. */
    readonly description: string;
    /** The message of a check with no catalogue message, `%s` for each slot. */
    readonly text?: string;
}

/** Every code of this build, with its row of docs/checks.md. */
export const CHECK_KINDS: Readonly<Record<CheckCode, CheckKind>> = {
    'names/unknown-trigger': {
        severity: 'error',
        catalogue: 'unknown_trigger_X',
        slots: ['value'],
        description: 'A key in a trigger block that is no trigger there.',
    },
    'names/unknown-effect': {
        severity: 'error',
        catalogue: 'unknown_effect_X',
        slots: ['value'],
        description: 'A key in an effect block that is no effect there.',
    },
    'names/unknown-link': {
        severity: 'error',
        catalogue: 'failed_to_parse_data_for_event_target_link_link_X_location_X',
        slots: ['value', 'location'],
        description: 'A segment of a scope chain that is no link.',
    },
    'names/unknown-modifier': {
        severity: 'error',
        catalogue: 'unknown_modifier_type_X_at_X',
        slots: ['value', 'location'],
        description:
            'A key in a modifier block that is no modifier and fills no modifier template.',
    },
    'names/unknown-on-action': {
        severity: 'error',
        catalogue: 'unknown_on_action_X',
        slots: ['value'],
        description: 'A value naming an on-action the game does not have.',
    },
    'names/modifier-outside-use-area': {
        severity: 'warning',
        catalogue: null,
        gameOutput:
            "buckets.modifiers.<name>.use_areas and modifier_template_tags: the game's own modifier documentation",
        slots: ['value', 'value', 'value'],
        description: 'A modifier in a block of a kind its use area does not include.',
        text: "The modifier '%s' is used in a block read as %s, but its use areas are %s.",
    },
    ...ADVICE_KINDS,
};

/** True for an advice code: pychivalry's own advice, information or a hint (item 4.7). */
export function isAdvice(code: CheckCode): boolean {
    return CHECK_KINDS[code].advice === true;
}

/** Data a finding carries beside its message: names, lists, versions. */
export type FindingData = Readonly<Record<string, string | readonly string[]>>;

/** One finding of an engine check. */
export interface CheckFinding {
    readonly code: CheckCode;
    readonly severity: Severity;
    /** Offsets into the parsed text, and the same span as lines and characters. */
    readonly start: number;
    readonly end: number;
    readonly range: Range;
    /** The values for the message's `value` slots, in order. */
    readonly args: readonly string[];
    readonly evidence: Evidence;
    readonly data: FindingData;
}

/**
 * The evidence of a code: its catalogue entry, with the text when the catalogue is given, or
 * the game's output it rests on.
 */
export function evidenceOf(code: CheckCode, catalogue: MessageCatalogue | undefined): Evidence {
    const kind = CHECK_KINDS[code];
    if (kind.advice === true) {
        return { kind: 'advice' };
    }
    if (kind.catalogue === null) {
        return { kind: 'game-output', source: kind.gameOutput ?? '' };
    }
    return { kind: 'catalogue', id: kind.catalogue, text: catalogue?.get(kind.catalogue) ?? null };
}

/**
 * The message of a finding, for a person: the game's own text with its placeholders filled. A
 * place is written `<file>:<line>` (1-based line), or `line <n>` when no file is given.
 */
export function checkMessage(
    finding: CheckFinding,
    context: { readonly file?: string } = {},
): string {
    const kind = CHECK_KINDS[finding.code];
    const location =
        context.file !== undefined
            ? `${context.file}:${String(finding.range.start.line + 1)}`
            : `line ${String(finding.range.start.line + 1)}`;
    const values: string[] = [];
    let arg = 0;
    for (const slot of kind.slots) {
        if (slot === 'location') {
            values.push(location);
        } else {
            values.push(finding.args[arg] ?? '');
            arg++;
        }
    }
    if (finding.evidence.kind === 'catalogue' && finding.evidence.text !== null) {
        return fillPlaceholders(finding.evidence.text, values);
    }
    if (kind.text !== undefined) {
        return fillPlaceholders(kind.text, values);
    }
    return `${kind.description} (${values.join(', ')})`;
}
