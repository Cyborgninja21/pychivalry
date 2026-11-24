/**
 * Fix data (docs/PLAN.md items 8.6 and 8.7): the fix of each finding of a file, as data that
 * travels with the finding (`WorkspaceFinding.fix`). One fixer per code (`FIX_ROWS`), each in
 * its own file; every safe fix checked by applying it (`verify.ts`).
 */

import type { Severity } from '../syntax/findings.js';
import { FixFile, type FixableFinding, type FixFileInput } from './file.js';
import type { FindingFix } from './fix.js';
import { FIX_ROWS } from './registry.js';
import { verifySafeFixes, type Recheck } from './verify.js';

export { applyEdits, applyFixes, joinBom, splitBom, type FileText } from './apply.js';
export {
    asSuggestion,
    FORMATTING_FIX_CHARS,
    formattingFixTooLong,
    MAX_FIX_ALTERNATIVES,
    overlapsAny,
    rangesOverlap,
    type FindingFix,
    type FixAlternative,
    type FixBasis,
    type FixEdit,
} from './fix.js';
export { FixFile, type FixableFinding, type FixFileInput, type Fixer } from './file.js';
export { FIX_ROWS, type FixOffer, type FixRow } from './registry.js';
export { MAX_ALONE, verifySafeFixes, type Counted, type Recheck } from './verify.js';

/**
 * The fix of each of a file's findings, in their order: null where a finding has none. With
 * `recheck` (the file checked again from other text), every safe fix is checked by applying
 * it; without it, safe fixes are offered as suggestions, unchecked.
 */
export function fixFileFindings(
    findings: readonly (FixableFinding & { readonly severity: Severity })[],
    input: FixFileInput,
    recheck: Recheck | undefined,
): (FindingFix | null)[] {
    if (findings.every((f) => FIX_ROWS[f.code].fixer === undefined)) {
        return findings.map(() => null);
    }
    const file = new FixFile(input);
    const fixes = findings.map((f) => FIX_ROWS[f.code].fixer?.(f, file) ?? null);
    if (recheck === undefined) {
        return fixes.map((fix) =>
            fix?.safety === 'safe' ? { ...fix, safety: 'suggestion' as const } : fix,
        );
    }
    return verifySafeFixes(input.file, file.text, findings, fixes, recheck);
}
