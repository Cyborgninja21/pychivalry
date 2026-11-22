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
    | 'names/unknown-modifier';

export interface CheckKind {
    readonly severity: Severity;
    /** The catalogue entry holding the game's own message: the evidence (docs/checks.md). */
    readonly catalogue: string;
    /** What the message's placeholders are filled with, in order. */
    readonly slots: readonly Slot[];
    /** What the finding means, in pychivalry's words. */
    readonly description: string;
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

/** The evidence of a code: its catalogue entry, with the text when the catalogue is given. */
export function evidenceOf(code: CheckCode, catalogue: MessageCatalogue | undefined): Evidence {
    const id = CHECK_KINDS[code].catalogue;
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
    if (finding.evidence.kind === 'catalogue' && finding.evidence.text !== null) {
        return fillPlaceholders(finding.evidence.text, values);
    }
    return `${kind.description} (${values.join(', ')})`;
}
