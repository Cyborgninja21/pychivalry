/**
 * The rows of the check inventory (docs/checks.md) for every code this build emits, as data:
 * the code, its family, its severity, what it finds and its evidence. The command line's
 * `explain` and the agent server's code explanations render these rows; nothing reads
 * docs/checks.md at run time. The rows come from the two tables the findings are built from,
 * `FINDING_KINDS` (the parser's) and `CHECK_KINDS` (the engine checks'), so a code added to
 * either is here with no change to this file; a test holds each row to its line of
 * docs/checks.md (codes.test.ts).
 */

import {
    FINDING_KINDS,
    readableMessage,
    severityOf,
    type Evidence,
    type FindingId,
    type MessageCatalogue,
    type Severity,
} from '../syntax/findings.js';
import { CHECK_KINDS, evidenceOf, type CheckCode } from './finding.js';

/** A code of this build: a parse finding's or an engine check's. */
export type Code = FindingId | CheckCode;

/**
 * The evidence of a row: a finding's own kinds, or, for a check whose message depends on the
 * place (`evidenceFrom`), where each finding takes its game message from: the field's own
 * message, which the spec package gives with each field it marks required (`required-field`),
 * or the catalogue message the rules table's row for the clash names (`rules-row`).
 */
export type InventoryEvidence =
    Evidence | { readonly kind: 'per-place'; readonly from: 'required-field' | 'rules-row' };

/** One row of the check inventory. */
export interface InventoryRow {
    readonly code: Code;
    /** The part of the code before its `/` (docs/checks.md, "The code scheme"). */
    readonly family: string;
    readonly severity: Severity;
    /** What the finding means, in pychivalry's words. */
    readonly finds: string;
    /**
     * The evidence that the game raises it: its catalogue entry, with the game's own text
     * when the catalogue is given; the game's output it rests on; the place's own message
     * (`per-place`); or none, for advice.
     */
    readonly evidence: InventoryEvidence;
    /**
     * The message text, each value a readable slot (`<trigger>`, `SLOT_NAMES`) where the text
     * has `%s` or the game's own `{}`; null when the catalogue entry's text was not given. A
     * catalogue evidence's text is shown the same way.
     */
    readonly message: string | null;
    /** True for a check that is off by default and reports only when asked: none since 2026-11-23. */
    readonly offByDefault: boolean;
    /**
     * True for a check that is on by default and can be turned off: `localization/unused-key`,
     * with the runner's `unusedKeys: false` (on by default since 2026-11-23).
     */
    readonly canTurnOff: boolean;
}

/**
 * What each placeholder of a row's message stands for, in order: the message is shown with
 * each written as a readable slot (`Unknown trigger '<trigger>'`), never as `%s` or `{}`.
 * `file:line` is the place a finding is at. A test holds every code that has a message with
 * placeholders to a name for each of them.
 */
export const SLOT_NAMES: Readonly<Partial<Record<Code, readonly string[]>>> = {
    'definitions/clash': ['name'],
    'definitions/not-read': ['name', 'reason'],
    'fields/bare-value-in-record': ['token', 'file:line'],
    'fields/missing-required-field': ['record'],
    'fields/unknown-field': ['field', 'record'],
    'fields/unusual-value': ['value', 'field', 'base-game values'],
    'fields/usually-present': ['record', 'field', 'number'],
    'fields/wrong-kind-of-value': ['value', 'kind of value', 'kinds the base game writes'],
    'localization/missing-key': ['key'],
    'localization/unbalanced-brackets': ['key', 'column', 'file'],
    'localization/unused-key': ['key'],
    'names/modifier-outside-use-area': ['modifier name', 'kind of block', 'use areas'],
    'names/unknown-effect': ['effect'],
    'names/unknown-link': ['link', 'file:line'],
    'names/unknown-modifier': ['modifier name', 'file:line'],
    'names/unknown-on-action': ['on-action'],
    'names/unknown-trigger': ['trigger'],
    'references/unknown-key': ['key', 'database'],
    'references/unknown-name': ['name', 'folder'],
    'scope/link-on-wrong-scope': ['link', 'scope'],
    'scope/saved-late-read-in-desc': ['saved scope', 'field', 'blocks'],
    'scope/title-text-reads-scope-saved-late': ['localization key', 'saved scope', 'blocks'],
    'scope/undefined-event-target': ['saved scope'],
    'scope/wrong-scope-for-effect': ['scope', 'scopes it takes'],
    'scope/wrong-scope-for-trigger': ['scope', 'scopes it takes'],
    'structure/casus-belli-without-outcome': ['casus belli', 'fields'],
    'structure/else-without-if': ['key', 'keys'],
    'structure/event-after-without-option': ['event id', 'field', 'fields'],
    'structure/event-empty': ['event id'],
    'structure/event-letter-without-sender': ['event id', 'field'],
    'structure/event-non-character-shown': ['event id'],
    'structure/event-portrait-position-twice': ['event id', 'portrait position'],
    'structure/event-several-after': ['event id', 'field'],
    'structure/event-several-immediate': ['event id', 'field'],
    'structure/event-triggered-animation-without-animation': ['block', 'fields'],
    'structure/event-triggered-animation-without-trigger': ['block', 'field'],
    'structure/event-undeclared-namespace': ['namespace', 'event id', 'file'],
    'structure/event-unknown-type': ['type', 'documented types'],
    'structure/event-without-desc': ['event id', 'field'],
    'structure/event-without-option': ['event id', 'field'],
    'structure/logic-operator-without-block': ['operator'],
    'structure/namespace-outside-events': ['namespace', 'folder'],
    'structure/round-to-not-positive': ['field', 'value'],
    'structure/story-effect-group-chance-above-100': ['field', 'value', 'maximum'],
    'structure/story-effect-group-chance-not-positive': ['field', 'value'],
    'structure/story-effect-group-several-timings': ['block', 'fields'],
    'structure/story-effect-group-without-effect': ['block', 'fields'],
    'structure/story-effect-group-without-timing': ['block', 'fields'],
    'structure/switch-without-branches': ['block'],
    'structure/switch-without-trigger': ['block', 'field'],
    'structure/trigger-else-without-trigger-if': ['key', 'keys'],
    'structure/triggered-desc-other-field': ['file:line'],
    'variables/read-without-set': ['variable name', 'keyword', 'kind', 'namespace'],
    'syntax/malformed-arithmetic': ['expression', 'reason'],
    'syntax/missing-operator': ['token', 'file:line'],
    'syntax/null-safe-operator-after-value': ['token', 'file:line'],
    'syntax/unterminated-string': ['file:line'],
    'style/not-formatted': ['places'],
    'style/indentation': ['indentation'],
    'style/spacing': ['tokens'],
    'style/blank-lines': ['blank lines', 'blank lines kept'],
    'style/block-layout': ['layout'],
    'style/line-endings': ['line breaks'],
    'style/deep-nesting': ['block', 'depth', 'deepest allowed', 'places'],
    'style/empty-block': ['block', 'what it means, when it means something'],
    'style/not-utf8': ['number', 'reading'],
    'style/unusual-field-order': ['field', 'field before it', 'folder'],
    'style/localization-key-characters': ['key', 'what it holds'],
    'style/redundant-condition': ['condition', 'block'],
    'style/redundant-false-condition': ['condition', 'block'],
    'style/option-without-ai-weight': ['option number', 'event id', 'keywords'],
};

/** A row's message as it is shown: each placeholder a readable slot (`SLOT_NAMES`). */
function shown(code: Code, text: string | null): string | null {
    return text === null ? null : readableMessage(text, SLOT_NAMES[code] ?? []);
}

/** A row's evidence as it is shown: a catalogue message's text with readable slots. */
function shownEvidence<E extends InventoryEvidence>(code: Code, evidence: E): E {
    return evidence.kind === 'catalogue' && evidence.text !== null
        ? { ...evidence, text: shown(code, evidence.text) }
        : evidence;
}

/** The family of a code: the part before its `/`. */
export function familyOf(code: string): string {
    const at = code.indexOf('/');
    return at < 0 ? code : code.slice(0, at);
}

/** Every row this build emits, sorted by code. */
export function inventoryRows(catalogue?: MessageCatalogue): InventoryRow[] {
    const rows: InventoryRow[] = [];
    for (const id of Object.keys(FINDING_KINDS) as FindingId[]) {
        const kind = FINDING_KINDS[id];
        const evidence: Evidence =
            kind.catalogue === null
                ? { kind: 'advice' }
                : {
                      kind: 'catalogue',
                      id: kind.catalogue,
                      text: catalogue?.get(kind.catalogue) ?? null,
                  };
        rows.push({
            code: id,
            family: familyOf(id),
            severity: severityOf(id),
            // With no catalogue entry the description is also the message text.
            finds: kind.catalogue === null ? (shown(id, kind.description) ?? '') : kind.description,
            evidence: shownEvidence(id, evidence),
            message: shown(id, evidence.kind === 'catalogue' ? evidence.text : kind.description),
            offByDefault: false,
            canTurnOff: false,
        });
    }
    for (const code of Object.keys(CHECK_KINDS) as CheckCode[]) {
        const kind = CHECK_KINDS[code];
        const evidence: InventoryEvidence =
            kind.evidenceFrom === undefined
                ? evidenceOf(code, catalogue)
                : { kind: 'per-place', from: kind.evidenceFrom };
        rows.push({
            code,
            family: familyOf(code),
            severity: kind.severity,
            finds: kind.description,
            evidence: shownEvidence(code, evidence),
            message: shown(
                code,
                evidence.kind === 'catalogue' ? evidence.text : (kind.text ?? null),
            ),
            offByDefault: kind.offByDefault === true,
            canTurnOff: kind.canTurnOff === true,
        });
    }
    return rows.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/**
 * Whether a code matches a pattern: the code itself, `<family>/*` for every code of a family,
 * or `*` for every code.
 */
export function codeMatches(pattern: string, code: string): boolean {
    if (pattern === '*') {
        return true;
    }
    if (pattern.endsWith('/*')) {
        return familyOf(code) === pattern.slice(0, -2);
    }
    return pattern === code;
}

/** The codes of this build a pattern matches, sorted. */
export function codesMatching(pattern: string): Code[] {
    return inventoryRows()
        .map((row) => row.code)
        .filter((code) => codeMatches(pattern, code));
}
