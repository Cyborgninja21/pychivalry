/**
 * A safe fix is checked by construction (docs/PLAN.md item 8.6): the file's safe fixes are
 * applied to its text together and the file is checked again. Each must take its finding away
 * and bring no new error or warning into the file; counted by code, the file's errors and
 * warnings after must be at most those before less the ones the fixes are for. When the
 * fixes together pass, all stay safe. When they do not, each is tried alone (at most
 * `MAX_ALONE` of them), and one that fails alone, or is not tried, is offered as a suggestion.
 * Two safe fixes whose edits overlap cannot both be applied: the later is a suggestion.
 *
 * What is checked is the file the finding is in; a safe fix edits no other file.
 *
 * The formatter's fixes (basis `formatting`, the `style/` findings) are safe by construction and
 * not checked again here: they change only the whitespace between tokens and keep the tree, which
 * the round trip proves on every base-game file (docs/formatting.md). They overlap one another
 * (the whole file's and each place's), so they are not counted among the edits taken either.
 */

import type { Code } from '../check/inventory.js';
import type { Severity } from '../syntax/findings.js';
import { applyEdits } from './apply.js';
import { asSuggestion, overlapsAny, type FindingFix, type FixEdit } from './fix.js';

/** The most safe fixes of one file tried one at a time when they fail together. */
export const MAX_ALONE = 40;

/** A finding as the check again reports it: its code and severity are what is counted. */
export interface Counted {
    readonly code: Code;
    readonly severity: Severity;
}

/** A file checked again with other text: its findings. */
export type Recheck = (text: string) => readonly Counted[];

function serious(f: Counted): boolean {
    return f.severity === 'error' || f.severity === 'warning';
}

/** The errors and warnings by code. */
function countByCode(findings: readonly Counted[]): Map<Code, number> {
    const out = new Map<Code, number>();
    for (const f of findings) {
        if (serious(f)) {
            out.set(f.code, (out.get(f.code) ?? 0) + 1);
        }
    }
    return out;
}

/** True when `after` holds no more errors and warnings of any code than `before` less `fixed`. */
function noWorse(
    before: ReadonlyMap<Code, number>,
    fixed: ReadonlyMap<Code, number>,
    after: ReadonlyMap<Code, number>,
): boolean {
    for (const [code, count] of after) {
        if (count > (before.get(code) ?? 0) - (fixed.get(code) ?? 0)) {
            return false;
        }
    }
    for (const [code, count] of fixed) {
        if ((after.get(code) ?? 0) > (before.get(code) ?? 0) - count) {
            return false;
        }
    }
    return true;
}

/**
 * The fixes of one file's findings with every safe one checked: `findings[i]`'s fix is
 * `fixes[i]`. `text` is the file's text as checked, `file` its path in the mod.
 */
export function verifySafeFixes(
    file: string,
    text: string,
    findings: readonly Counted[],
    fixes: readonly (FindingFix | null)[],
    recheck: Recheck,
): (FindingFix | null)[] {
    const out = [...fixes];
    const safe: number[] = [];
    const taken: FixEdit[] = [];
    for (let i = 0; i < out.length; i++) {
        const fix = out[i];
        const alternative = fix?.safety === 'safe' ? fix.alternatives[0] : undefined;
        if (fix === null || fix === undefined || alternative === undefined) {
            continue;
        }
        if (fix.basis === 'formatting') {
            continue;
        }
        if (
            alternative.edits.some((e) => e.file !== file || e.create === true) ||
            overlapsAny(alternative, taken)
        ) {
            out[i] = asSuggestion(fix);
            continue;
        }
        taken.push(...alternative.edits);
        safe.push(i);
    }
    if (safe.length === 0) {
        return out;
    }
    const before = countByCode(findings);
    const edits = (indices: readonly number[]): FixEdit[] =>
        indices.flatMap((i) => out[i]?.alternatives[0]?.edits ?? []);
    const fixedBy = (indices: readonly number[]): Map<Code, number> =>
        countByCode(indices.map((i) => findings[i]).filter((f): f is Counted => f !== undefined));
    const passes = (indices: readonly number[]): boolean =>
        noWorse(before, fixedBy(indices), countByCode(recheck(applyEdits(text, edits(indices)))));
    if (passes(safe)) {
        return out;
    }
    safe.forEach((i, n) => {
        const fix = out[i];
        if (fix !== null && fix !== undefined && (n >= MAX_ALONE || !passes([i]))) {
            out[i] = asSuggestion(fix);
        }
    });
    return out;
}
