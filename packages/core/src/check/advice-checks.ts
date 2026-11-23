/**
 * The advice checks of item 4.7, in one list (docs/checks.md, "4.7: advice that holds on
 * 1.21" and "4.7: advice carried over provisionally"): each a file of its own, each run on one
 * file at a time. `runAdvice` also says how many units each judged, for the re-proof on the
 * base game (docs/decisions.md, row 46).
 */

import type { AdviceCheck, AdviceInput } from './advice.js';
import type { CheckCode, CheckFinding } from './finding.js';
import { check as structureElseWithoutIf } from './structure-else-without-if.js';
import { check as structureEventAfterWithoutOption } from './structure-event-after-without-option.js';
import { check as structureEventEmpty } from './structure-event-empty.js';
import { check as structureEventLetterWithoutSender } from './structure-event-letter-without-sender.js';
import { check as structureEventPortraitPositionTwice } from './structure-event-portrait-position-twice.js';
import { check as structureEventSeveralAfter } from './structure-event-several-after.js';
import { check as structureEventSeveralImmediate } from './structure-event-several-immediate.js';
import { check as structureEventTriggeredAnimationWithoutAnimation } from './structure-event-triggered-animation-without-animation.js';
import { check as structureEventTriggeredAnimationWithoutTrigger } from './structure-event-triggered-animation-without-trigger.js';
import { check as structureEventUnknownType } from './structure-event-unknown-type.js';
import { check as structureEventWithoutDesc } from './structure-event-without-desc.js';
import { check as structureEventWithoutOption } from './structure-event-without-option.js';
import { check as structureLogicOperatorWithoutBlock } from './structure-logic-operator-without-block.js';
import { check as structureNamespaceOutsideEvents } from './structure-namespace-outside-events.js';
import { check as structureRoundToNotPositive } from './structure-round-to-not-positive.js';
import { check as structureSwitchWithoutBranches } from './structure-switch-without-branches.js';
import { check as structureSwitchWithoutTrigger } from './structure-switch-without-trigger.js';
import { check as structureTriggerElseWithoutTriggerIf } from './structure-trigger-else-without-trigger-if.js';

/** Every advice check this build ships. */
export const ADVICE_CHECKS: readonly AdviceCheck[] = [
    structureElseWithoutIf,
    structureEventAfterWithoutOption,
    structureEventEmpty,
    structureEventLetterWithoutSender,
    structureEventPortraitPositionTwice,
    structureEventSeveralAfter,
    structureEventSeveralImmediate,
    structureEventTriggeredAnimationWithoutAnimation,
    structureEventTriggeredAnimationWithoutTrigger,
    structureEventUnknownType,
    structureEventWithoutDesc,
    structureEventWithoutOption,
    structureLogicOperatorWithoutBlock,
    structureNamespaceOutsideEvents,
    structureRoundToNotPositive,
    structureSwitchWithoutBranches,
    structureSwitchWithoutTrigger,
    structureTriggerElseWithoutTriggerIf,
];

/** What each advice check judged and found on one file, by code. */
export function runAdvice(
    input: AdviceInput,
): Map<CheckCode, { readonly judged: number; readonly findings: CheckFinding[] }> {
    const out = new Map<CheckCode, { judged: number; findings: CheckFinding[] }>();
    for (const check of ADVICE_CHECKS) {
        out.set(check.code, check.run(input));
    }
    return out;
}

/** Every finding of the advice checks on one file. */
export function adviceFindings(input: AdviceInput): CheckFinding[] {
    return ADVICE_CHECKS.flatMap((check) => check.run(input).findings);
}
