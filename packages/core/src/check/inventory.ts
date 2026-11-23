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
    severityOf,
    type Evidence,
    type FindingId,
    type MessageCatalogue,
    type Severity,
} from '../syntax/findings.js';
import { CHECK_KINDS, evidenceOf, type CheckCode } from './finding.js';

/** A code of this build: a parse finding's or an engine check's. */
export type Code = FindingId | CheckCode;

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
     * when the catalogue is given; the game's output it rests on; or none, for advice.
     */
    readonly evidence: Evidence;
    /** The message text, `%s` (or the game's own placeholders) for each value; null when the catalogue entry's text was not given. */
    readonly message: string | null;
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
            finds: kind.description,
            evidence,
            message: evidence.kind === 'catalogue' ? evidence.text : kind.description,
        });
    }
    for (const code of Object.keys(CHECK_KINDS) as CheckCode[]) {
        const kind = CHECK_KINDS[code];
        const evidence = evidenceOf(code, catalogue);
        rows.push({
            code,
            family: familyOf(code),
            severity: kind.severity,
            finds: kind.description,
            evidence,
            message: evidence.kind === 'catalogue' ? evidence.text : (kind.text ?? null),
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
