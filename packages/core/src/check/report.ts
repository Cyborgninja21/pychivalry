/**
 * Building a finding from a node of the tree: its range from the file's lines, its evidence
 * from the code's catalogue entry. Shared by the checks.
 */

import type { Evidence, MessageCatalogue } from '../syntax/findings.js';
import type { LineIndex } from '../syntax/position.js';
import {
    CHECK_KINDS,
    evidenceOf,
    type CheckCode,
    type CheckFinding,
    type FindingData,
} from './finding.js';

/** What every check is given beside the file's reading. */
export interface CheckContext {
    readonly lines: LineIndex;
    /** The spec's error catalogue, so findings carry the game's own message text. */
    readonly catalogue?: MessageCatalogue | undefined;
}

/**
 * A finding of `code` over the span `start`..`end`. Its evidence is the code's own, unless the
 * check gives the evidence of the place (a code whose message depends on it: `evidenceFrom`).
 */
export function finding(
    code: CheckCode,
    span: { readonly start: number; readonly end: number },
    args: readonly string[],
    data: FindingData,
    context: CheckContext,
    evidence: Evidence = evidenceOf(code, context.catalogue),
): CheckFinding {
    return {
        code,
        severity: CHECK_KINDS[code].severity,
        start: span.start,
        end: span.end,
        range: context.lines.rangeOf(span.start, span.end),
        args,
        evidence,
        data,
    };
}

/** The data a removed keyword adds to a finding: the version it went in and what replaces it. */
export function retiredData(
    retired: readonly {
        readonly removed_in: string;
        readonly replacement: readonly string[] | null;
        readonly note: string;
    }[],
): FindingData {
    const first = retired[0];
    if (first === undefined) {
        return {};
    }
    return {
        removed_in: first.removed_in,
        replacement: first.replacement ?? [],
        ...(first.note === '' ? {} : { removal_note: first.note }),
    };
}
