/**
 * What the best-practice rules of the family `style` share (best-practice-kinds.ts). Each is a file of
 * its own, run on one file at a time; each says, beside its findings, how many units it judged
 * there (the records, blocks or files its rule applies to), so that the base game's own rate
 * for each rule can be counted (`pychivalry-tools advice proof`): a rule ships only where the
 * base game follows it more often than it breaks it.
 *
 * A rule reads what an advice check reads, and what the runner hands in from the decoder: the
 * stretches of the file that are not valid UTF-8 (`invalid`) and how they were read (`encoding`).
 */

import type { FallbackEncoding } from '../syntax/decode.js';
import type { InvalidStretch } from '../syntax/findings.js';
import type { AdviceInput, AdviceResult } from './advice.js';
import type { CheckCode } from './finding.js';

/** What a best-practice rule reads: what an advice check reads, and what the runner hands in. */
export interface BestPracticeInput extends AdviceInput {
    /**
     * The stretches of the file that are not valid UTF-8, as the decoder read them; empty for a
     * file that is valid UTF-8, or whose bytes are not known (text an editor holds that differs
     * from the file on disk).
     */
    readonly invalid: readonly InvalidStretch[];
    /** How the file was read where it is not valid UTF-8: `utf-8`, or the fallback named. */
    readonly encoding: 'utf-8' | FallbackEncoding;
}

/** A best-practice rule: its code, and how it reads a file. */
export interface BestPracticeCheck {
    readonly code: CheckCode;
    run(input: BestPracticeInput): AdviceResult;
}
