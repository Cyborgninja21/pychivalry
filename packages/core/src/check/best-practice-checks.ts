/**
 * The best-practice rules of the family `style` in one list (best-practice-kinds.ts): each a file of its
 * own, each run on one file at a time. `runBestPractice` also says how many units each judged, so the
 * base game's own rate for each rule can be counted (`pychivalry-tools advice proof`).
 */

import type { CheckCode, CheckFinding } from './finding.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';
import { check as styleDeepNesting } from './style-deep-nesting.js';
import { check as styleEmptyBlock } from './style-empty-block.js';
import { check as styleNotUtf8 } from './style-not-utf8.js';
import { check as styleOptionWithoutAiWeight } from './style-option-without-ai-weight.js';
import { check as styleRedundantCondition } from './style-redundant-condition.js';
import { check as styleUnusualFieldOrder } from './style-unusual-field-order.js';

/** Every best-practice rule this build ships. */
export const BEST_PRACTICE_CHECKS: readonly BestPracticeCheck[] = [
    styleDeepNesting,
    styleEmptyBlock,
    styleNotUtf8,
    styleOptionWithoutAiWeight,
    styleRedundantCondition,
    styleUnusualFieldOrder,
];

/** What each best-practice rule judged and found on one file, by code. */
export function runBestPractice(
    input: BestPracticeInput,
): Map<CheckCode, { readonly judged: number; readonly findings: CheckFinding[] }> {
    const out = new Map<CheckCode, { judged: number; findings: CheckFinding[] }>();
    for (const check of BEST_PRACTICE_CHECKS) {
        out.set(check.code, check.run(input));
    }
    return out;
}

/** Every finding of the best-practice rules on one file. */
export function bestPracticeFindings(input: BestPracticeInput): CheckFinding[] {
    return BEST_PRACTICE_CHECKS.flatMap((check) => check.run(input).findings);
}
