/**
 * What the best-practice rules of the family `style` share (best-practice-kinds.ts). Each is a file of
 * its own, run on one file at a time; each says, beside its findings, how many units it judged
 * there (the records, blocks or files its rule applies to), so that the base game's own rate
 * for each rule can be counted (`pychivalry-tools advice proof`): a rule ships only where the
 * base game follows it more often than it breaks it.
 *
 * A rule reads what an advice check reads, and one thing more that the runner hands in: the
 * stretches of the file that are not valid UTF-8, from the decoder's note (`invalid`).
 */

import type { InvalidStretch } from '../syntax/findings.js';
import type { AdviceInput, AdviceResult } from './advice.js';
import type { CheckCode } from './finding.js';

/** What a best-practice rule reads: what an advice check reads, and what the runner hands in. */
export interface BestPracticeInput extends AdviceInput {
    /**
     * The stretches of the file that are not valid UTF-8, from the decoder's note; empty for a
     * file that is valid UTF-8, or whose bytes are not known (text an editor holds that differs
     * from the file on disk).
     */
    readonly invalid: readonly InvalidStretch[];
}

/** A best-practice rule: its code, and how it reads a file. */
export interface BestPracticeCheck {
    readonly code: CheckCode;
    run(input: BestPracticeInput): AdviceResult;
}
