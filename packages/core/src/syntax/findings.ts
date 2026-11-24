/**
 * Findings of the syntax layer, in the structured shape of principle 3 of docs/MVP.md: an
 * identifier, a severity, where it is, the values it is about, and the evidence behind it.
 * Text for a person is a rendering of that data (`findingMessage`).
 *
 * Each kind of finding has a stable identifier (`FindingId`). It is not a public diagnostic
 * code: the code scheme is fixed with the check inventory (docs/PLAN.md item 4.1), which maps
 * each identifier to its permanent code. Where the spec's error catalogue holds the game's own
 * message for a finding, the finding names that catalogue entry as its evidence and carries
 * its text when the caller supplies the catalogue; the text is never copied into this file.
 * A finding with no catalogue message is pychivalry's own advice and, as principle 1 of
 * docs/MVP.md requires, is information, never an error.
 */

import type { LineIndex, Range } from './position.js';

export type Severity = 'error' | 'warning' | 'information' | 'hint';

/** The kinds of finding the syntax layer reports. */
export type FindingId =
    | 'syntax/missing-closing-brace'
    | 'syntax/unexpected-closing-brace'
    | 'syntax/block-without-key'
    | 'syntax/operator-without-key'
    | 'syntax/missing-value'
    | 'syntax/missing-operator'
    | 'syntax/missing-equals-before-block'
    | 'syntax/null-safe-operator-after-value'
    | 'syntax/unterminated-string'
    | 'syntax/malformed-arithmetic'
    | 'encoding/not-utf8';

/** A value a message is about, or the place the finding is at, which the renderer fills in. */
export type Slot = 'value' | 'location';

export interface FindingKind {
    /** The catalogue entry holding the game's own message, or null when there is none. */
    readonly catalogue: string | null;
    /** What the message's placeholders are filled with, in order. */
    readonly slots: readonly Slot[];
    /**
     * What the finding means, in pychivalry's words. For a finding without a catalogue entry
     * this is also the message's text, with `%s` for each slot.
     */
    readonly description: string;
}

/**
 * Every kind of syntax finding. The catalogue ids are those of the spec package's error
 * catalogue (`errors[].id`); a test checks that each one exists in the committed spec with the
 * number of placeholders given here.
 */
export const FINDING_KINDS: Readonly<Record<FindingId, FindingKind>> = {
    'syntax/missing-closing-brace': {
        catalogue: 'expected_after_arguments',
        slots: [],
        description: "A block is still open at the end of the file: its '}' is missing.",
    },
    'syntax/unexpected-closing-brace': {
        catalogue: 'unexpected_token_expected_key',
        slots: [],
        description: "A '}' at the top level of the file, where no block is open.",
    },
    'syntax/block-without-key': {
        catalogue: 'unexpected_token_expected_key',
        slots: [],
        description: 'A block at the top level of the file with no key in front of it.',
    },
    'syntax/operator-without-key': {
        catalogue: 'unexpected_token_expected_key',
        slots: [],
        description: 'An operator with no key in front of it.',
    },
    'syntax/missing-value': {
        catalogue: 'expected_between_equals_and_arguments',
        slots: [],
        description: 'An operator with no value after it.',
    },
    'syntax/missing-operator': {
        catalogue: 'unexpected_token_X_found_at_X_expected',
        slots: ['value', 'location'],
        description:
            "A key at the top level of the file with no operator after it; the finding is at the token found where '=' belongs.",
    },
    'syntax/missing-equals-before-block': {
        catalogue: 'expected_between_block_name_and_body',
        slots: [],
        description:
            "A block written as 'name { ... }' among statements, with the '=' missing; read as 'name = { ... }'.",
    },
    'syntax/null-safe-operator-after-value': {
        catalogue: 'unexpected_token_X_found_at_X_expected',
        slots: ['value', 'location'],
        description: "'?=' after something that is not a name or a scope chain.",
    },
    'syntax/unterminated-string': {
        catalogue: null,
        slots: ['location'],
        description: "Unterminated string starting at '%s'",
    },
    'syntax/malformed-arithmetic': {
        catalogue: null,
        slots: ['value', 'value'],
        description: "Malformed inline expression '@[%s]': %s",
    },
    'encoding/not-utf8': {
        catalogue: null,
        slots: ['value', 'value'],
        description: 'This file is not valid UTF-8 (%s invalid bytes); it was read as %s.',
    },
};

/** The evidence behind a finding. */
export type Evidence =
    | {
          readonly kind: 'catalogue';
          /** The catalogue entry, `errors[].id` in the spec package. */
          readonly id: string;
          /** Its message text, when the caller supplied the catalogue and it holds the entry. */
          readonly text: string | null;
      }
    | {
          /**
           * The game's own output, with no message of its own: what a documentation dump or a
           * part of the spec package read from it says (docs/checks.md, evidence "Game output").
           */
          readonly kind: 'game-output';
          /** Where in the spec package the game's output is. */
          readonly source: string;
      }
    | {
          /**
           * A field the spec package marks required (docs/checks.md, evidence "Required field"),
           * with the game's own message for it: the field's `required_evidence`, and the
           * catalogue entry that holds that text, when one does.
           */
          readonly kind: 'required-field';
          /** The folder whose records need the field, and the field's path in a record. */
          readonly directory: string;
          readonly field: string;
          /** The catalogue entry whose text is the field's message, or null when none is. */
          readonly id: string | null;
          /** The game's message for the missing field (`required_evidence`); empty when none. */
          readonly text: string;
      }
    | {
          /** No game message: pychivalry's own advice (principle 1 of docs/MVP.md). */
          readonly kind: 'advice';
      }
    | {
          /**
           * No game message: one of pychivalry's own best-practice rules, the family `style`
           * (the owner's principle of 2026-11-23: best practice and tidiness come before what a
           * mod's author wrote). Each rule says how often the base game follows it.
           */
          readonly kind: 'best-practice';
      };

/**
 * One stretch of a file's bytes that is not valid UTF-8, as the decoder read it
 * (docs/encoding.md): where its text is in the decoded text, and what its bytes read as in
 * Windows-1252.
 */
export interface InvalidStretch {
    /**
     * The span of the decoded text the stretch became: one U+FFFD read as UTF-8, its letters
     * read with the Windows-1252 fallback.
     */
    readonly start: number;
    readonly end: number;
    /** The stretch's bytes read as Windows-1252, one character per byte. */
    readonly windows1252: string;
}

/** One finding of the syntax layer. */
export interface Finding {
    readonly id: FindingId;
    readonly severity: Severity;
    /** Offsets into the parsed text (docs/encoding.md, "Positions"). */
    readonly start: number;
    readonly end: number;
    /** The same span as a line and character range. */
    readonly range: Range;
    /** The values the message is about, for the `value` slots, in order. */
    readonly args: readonly string[];
    readonly evidence: Evidence;
    /**
     * On the note `encoding/not-utf8` only: every stretch of the file that is not valid
     * UTF-8, in order, which the check `style/not-utf8` and its fix read (the bytes themselves
     * are no longer in the text).
     */
    readonly invalid?: readonly InvalidStretch[];
}

/** The game's message texts by catalogue id: the spec package's error catalogue. */
export type MessageCatalogue = ReadonlyMap<string, string>;

/**
 * The error catalogue of a format 5 spec package, from its `errors` list: each entry's `id`
 * and `text`. The other keys of an entry (format 4's `category`, `since` and `note`, format
 * 5's `script_facing`, `reason`, `subject` and `subject_reason`) and anything else in the
 * package are not read here; an entry without a string id and text is skipped.
 */
export function catalogueFromSpec(specPackage: unknown): MessageCatalogue {
    const catalogue = new Map<string, string>();
    const errors =
        typeof specPackage === 'object' && specPackage !== null
            ? (specPackage as Record<string, unknown>)['errors']
            : undefined;
    if (!Array.isArray(errors)) {
        return catalogue;
    }
    for (const entry of errors as unknown[]) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const { id, text } = entry as Record<string, unknown>;
        if (typeof id === 'string' && typeof text === 'string') {
            catalogue.set(id, text);
        }
    }
    return catalogue;
}

/** A finding not yet placed in lines: what the lexer, the parser and the decoder produce. */
export interface RawFinding {
    readonly id: FindingId;
    readonly start: number;
    readonly end: number;
    readonly args: readonly string[];
}

/** The severity of a kind: an error with a catalogue message, information without one. */
export function severityOf(id: FindingId): Severity {
    return FINDING_KINDS[id].catalogue === null ? 'information' : 'error';
}

/** Place a raw finding in lines and attach its evidence. */
export function toFinding(
    raw: RawFinding,
    lines: LineIndex,
    catalogue: MessageCatalogue | undefined,
): Finding {
    const kind = FINDING_KINDS[raw.id];
    const evidence: Evidence =
        kind.catalogue === null
            ? { kind: 'advice' }
            : {
                  kind: 'catalogue',
                  id: kind.catalogue,
                  text: catalogue?.get(kind.catalogue) ?? null,
              };
    return {
        id: raw.id,
        severity: severityOf(raw.id),
        start: raw.start,
        end: raw.end,
        range: lines.rangeOf(raw.start, raw.end),
        args: raw.args,
        evidence,
    };
}

/** Order findings by where they start, then by identifier, so every path gives one order. */
export function compareFindings(a: RawFinding, b: RawFinding): number {
    return a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The placeholders of a catalogue message: printf conversions (`%s`, `%d`, `%.*s`, `%I64d`,
 * ...) and `{}`. `%%` is a literal percent sign and is not a placeholder.
 */
const PLACEHOLDER =
    /%%|%[-+ #0]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|I64|I32|z|j|t|L)?[diouxXeEfFgGcsp]|\{\}/g;

/** How many placeholders a message text has. */
export function placeholderCount(text: string): number {
    let count = 0;
    for (const match of text.matchAll(PLACEHOLDER)) {
        if (match[0] !== '%%') {
            count++;
        }
    }
    return count;
}

/** Fill a message's placeholders with values, in order; a missing value leaves it empty. */
export function fillPlaceholders(text: string, values: readonly string[]): string {
    let next = 0;
    return text.replace(PLACEHOLDER, (match) => {
        if (match === '%%') {
            return '%';
        }
        const value = values[next] ?? '';
        next++;
        return value;
    });
}

/**
 * A message text with each placeholder written as a readable slot, `<name>`, the names in
 * order (`<value>` for a placeholder with no name); `%%` is `%`. How a message is shown where
 * no finding fills it: the command line's `explain`, the agent server's `explain_code`.
 */
export function readableMessage(text: string, names: readonly string[]): string {
    let next = 0;
    return text.replace(PLACEHOLDER, (match) => {
        if (match === '%%') {
            return '%';
        }
        const name = names[next] ?? 'value';
        next++;
        return `<${name}>`;
    });
}

export interface MessageContext {
    /** The file's path inside the mod or game folder, used where a message names a place. */
    readonly file?: string | undefined;
}

/**
 * The message of a finding, for a person: the game's own text from the catalogue when the
 * finding has one and it was supplied, otherwise pychivalry's description. A place is written
 * `<file>:<line>` (1-based line), or `line <n>` when no file is given.
 */
export function findingMessage(finding: Finding, context: MessageContext = {}): string {
    const kind = FINDING_KINDS[finding.id];
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
    if (finding.evidence.kind === 'catalogue') {
        return finding.evidence.text === null
            ? `${finding.evidence.id} (the catalogue was not supplied)`
            : fillPlaceholders(finding.evidence.text, values);
    }
    return fillPlaceholders(kind.description, values);
}
