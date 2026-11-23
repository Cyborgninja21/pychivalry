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

/** The codes the engine checks of this build emit. */
export type CheckCode =
    | 'names/unknown-trigger'
    | 'names/unknown-effect'
    | 'names/unknown-link'
    | 'names/unknown-modifier'
    | 'names/unknown-on-action'
    | 'names/modifier-outside-use-area'
    | 'fields/unknown-field'
    | 'fields/bare-value-in-record'
    | 'fields/missing-required-field'
    | 'fields/wrong-kind-of-value'
    | 'references/unknown-key'
    | 'structure/event-undeclared-namespace'
    | 'structure/range-min-above-max'
    | 'structure/event-non-character-shown'
    | 'definitions/clash'
    | 'definitions/not-read'
    | 'scope/wrong-scope-for-trigger'
    | 'scope/wrong-scope-for-effect'
    | 'scope/link-on-wrong-scope'
    | 'scope/undefined-event-target'
    | 'localization/missing-key'
    | 'localization/unbalanced-brackets'
    | 'localization/unused-key';

export interface CheckKind {
    readonly severity: Severity;
    /**
     * The catalogue entry holding the game's own message: the evidence (docs/checks.md); null
     * for a check whose evidence is the game's output with no message (`gameOutput`), whose
     * message depends on the place (`evidenceFrom`), or that is advice (no `gameOutput`).
     */
    readonly catalogue: string | null;
    /** Further catalogue entries the row names, for cases with a message of their own. */
    readonly alsoCatalogue?: readonly string[];
    /** For a check with no catalogue message: where the game's output it rests on is. */
    readonly gameOutput?: string;
    /**
     * For a code whose message depends on the place (docs/decisions.md, item 4.1: one code per
     * kind of finding, its evidence varying with the place): where each finding's own message
     * comes from. `required-field`: the field's `required_evidence`, the game's message for it;
     * `rules-row`: the message the rules row names (part D1, its `duplicate-message` row).
     */
    readonly evidenceFrom?: 'required-field' | 'rules-row';
    /** What the message's placeholders are filled with, in order. */
    readonly slots: readonly Slot[];
    /** What the finding means, in pychivalry's words. */
    readonly description: string;
    /** The message of a check with no catalogue message, `%s` for each slot. */
    readonly text?: string;
    /**
     * The message of a finding of this code that is advice (evidence `advice`) where the row's
     * other findings have game evidence: `%s` for each of the finding's values, in order. Such
     * a finding is information or a hint, never the row's error or warning (principle 1).
     */
    readonly adviceText?: string;
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
    'fields/unknown-field': {
        severity: 'warning',
        catalogue: 'unknown_X_in_X',
        slots: ['value', 'value'],
        description: "A field in a record that its folder's field list does not have.",
    },
    'fields/bare-value-in-record': {
        severity: 'error',
        catalogue: 'unexpected_token_X_found_at_X_expected',
        slots: ['value', 'location'],
        description:
            "A bare value directly in a record body that holds statements, where the game expects 'key ='; the finding is at the token found where '=' belongs.",
    },
    'fields/missing-required-field': {
        severity: 'error',
        catalogue: null,
        evidenceFrom: 'required-field',
        slots: ['value'],
        description: 'A field the spec package marks required is missing.',
        text: 'The %s is missing a field the spec package marks required.',
    },
    'fields/wrong-kind-of-value': {
        severity: 'information',
        catalogue: null,
        slots: ['value', 'value', 'value'],
        description: 'A value of another kind than the field takes.',
        text: "The value '%s' is %s; the base game writes only %s in this field.",
    },
    'references/unknown-key': {
        severity: 'warning',
        catalogue: 'failed_to_read_key_reference_X_from_database_X',
        slots: ['value', 'value'],
        description:
            'A value that should be a key of a database names no key of it in the mod, the base game or a DLC.',
    },
    'structure/event-undeclared-namespace': {
        severity: 'warning',
        catalogue: 'namespace_X_used_in_event_X_file_X_is_not_defined_in_this_fi',
        slots: ['value', 'value', 'value'],
        description: 'An event whose namespace its file does not declare.',
    },
    'structure/range-min-above-max': {
        severity: 'error',
        catalogue: 'min_value_in_range_directive_is_larger_than_the_max_value_un',
        slots: [],
        description: 'A range whose minimum is above its maximum.',
    },
    'structure/event-non-character-shown': {
        severity: 'error',
        catalogue: 'error_in_event_X_non_character_events_must_be_hidden_or_be_n',
        slots: ['value'],
        description:
            'An event whose scope is not a character and that is neither hidden nor major.',
    },
    'definitions/clash': {
        severity: 'error',
        catalogue: null,
        evidenceFrom: 'rules-row',
        slots: ['value', 'value'],
        description: 'Definitions the rules table says the game calls an error.',
        text: "'%s' is defined more than once, and the rules table says the game calls it an error.",
    },
    'definitions/not-read': {
        severity: 'information',
        catalogue: null,
        slots: ['value', 'value'],
        description: 'A definition in a file the rules table says the game does not read.',
        text: "'%s' is defined in a file the game does not read: %s.",
    },
    'scope/wrong-scope-for-trigger': {
        severity: 'error',
        catalogue: 'wrong_scope_for_trigger_X_expected_X',
        slots: ['value', 'value'],
        description: 'A trigger in a scope its scope data does not list.',
    },
    'scope/wrong-scope-for-effect': {
        severity: 'error',
        catalogue: 'wrong_scope_for_effect_X_expected_X',
        slots: ['value', 'value'],
        description: 'An effect in a scope its scope data does not list.',
    },
    'scope/link-on-wrong-scope': {
        severity: 'error',
        catalogue: 'trying_to_use_X_link_on_an_invalid_scope_X',
        slots: ['value', 'value'],
        description: 'A link applied to a scope it cannot start from.',
    },
    'scope/undefined-event-target': {
        severity: 'information',
        catalogue: 'undefined_event_target_X',
        slots: ['value'],
        description:
            '`scope:name` with no effect saving `name` in the file, the mod or the base game.',
    },
    'localization/missing-key': {
        severity: 'warning',
        catalogue: 'unknown_loc_key_X',
        slots: ['value'],
        description:
            'A localization key, in a field that holds one or that a record has by its name, defined in no localization file.',
        adviceText:
            "Every record of %s in the base game has the localization key %s; '%s' is defined in no localization file.",
    },
    'localization/unbalanced-brackets': {
        severity: 'warning',
        catalogue: 'loc_key_X_unexpected_extra_at_position_X_file_X',
        alsoCatalogue: ['loc_key_X_unexpected_extra_at_position_X_file_X_2'],
        slots: ['value', 'value', 'value'],
        description: 'Localization text with an extra `[` or `]`.',
    },
    'localization/unused-key': {
        severity: 'hint',
        catalogue: null,
        slots: ['value'],
        description: 'A key the mod defines that nothing in the mod or the base game uses.',
        text: "The localization key '%s' is used nowhere in the mod or the base game.",
    },
};

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
    if (kind.catalogue === null) {
        return kind.gameOutput === undefined
            ? { kind: 'advice' }
            : { kind: 'game-output', source: kind.gameOutput };
    }
    return catalogueEvidence(kind.catalogue, catalogue);
}

/** A catalogue entry as evidence, with its text when the catalogue is given and holds it. */
export function catalogueEvidence(id: string, catalogue: MessageCatalogue | undefined): Evidence {
    return { kind: 'catalogue', id, text: catalogue?.get(id) ?? null };
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
    const evidence = finding.evidence;
    if (evidence.kind === 'advice' && kind.adviceText !== undefined) {
        return fillPlaceholders(kind.adviceText, finding.args);
    }
    if (evidence.kind === 'catalogue' && evidence.text !== null) {
        return fillPlaceholders(evidence.text, values);
    }
    if (evidence.kind === 'required-field' && evidence.text !== '') {
        return fillPlaceholders(evidence.text, values);
    }
    if (kind.text !== undefined) {
        return fillPlaceholders(kind.text, values);
    }
    return `${kind.description} (${values.join(', ')})`;
}
