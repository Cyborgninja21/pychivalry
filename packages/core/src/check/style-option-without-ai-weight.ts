/**
 * `style/option-without-ai-weight` (docs/checks.md, best practice): an option of a shown event
 * with several options that has neither of the keywords that weigh it for the AI; release
 * 2.3.0's CK3613. A hint, on pychivalry's own best-practice rules: the AI chooses among an
 * event's options by their weights, and an option written without one leaves the choice to a
 * default the game does not document (part D4's own `not_settled`).
 *
 * Everything it reads is part D4 of the spec package (format 9), confirmed roles only: the
 * event's option (`event_option`), the keywords that weigh an option for the AI (the rows whose
 * role `ai_weight` is confirmed and whose parent is the option: `ai_chance`, `ai_will_select`),
 * and whether an event is hidden (`hides_from_player`, with the value its measurement counts
 * hidden events by). The rule judges every option of every event of those folders that is not
 * hidden and has more than one option; an option is reported at its key when it writes none of
 * the keywords. The base game writes 4,305 of its 21,581 such options without one (19.95%).
 */

import type { AdviceResult } from './advice.js';
import { either } from './advice.js';
import { eventModelOf, eventRow, eventsOf, isHidden } from './advice-events.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';
import type { CheckFinding } from './finding.js';
import { bodyOf, childPairs, keywordRolesOf, roleConfirmed } from './keyword-roles.js';
import { finding } from './report.js';

export const CODE = 'style/option-without-ai-weight';

/** The role of part D4 the check reads beside the event's own. */
const AI_WEIGHT = 'ai_weight';

/** The keywords that weigh an option for the AI, with the option's keyword; undefined without them. */
export function aiWeightsOf(
    input: Pick<BestPracticeInput, 'spec'>,
): { readonly option: string; readonly weights: readonly string[] } | undefined {
    const option = eventRow(eventModelOf(input.spec), 'event_option');
    if (option === undefined) {
        return undefined;
    }
    const weights = keywordRolesOf(input.spec)
        .withRoles(AI_WEIGHT)
        .filter((r) => roleConfirmed(r, AI_WEIGHT) && r.parents.includes(option.keyword))
        .map((r) => r.keyword)
        .sort();
    return weights.length === 0 ? undefined : { option: option.keyword, weights };
}

function run(input: BestPracticeInput): AdviceResult {
    const model = eventModelOf(input.spec);
    const rule = aiWeightsOf(input);
    if (rule === undefined) {
        return { judged: 0, findings: [] };
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const event of eventsOf(input, model)) {
        if (isHidden(model, event.body) !== false) {
            continue;
        }
        const options = childPairs(event.body, rule.option);
        if (options.length < 2) {
            continue;
        }
        options.forEach((option, at) => {
            const body = bodyOf(option);
            if (body === undefined) {
                return;
            }
            judged++;
            if (rule.weights.some((w) => childPairs(body, w).length > 0)) {
                return;
            }
            findings.push(
                finding(
                    CODE,
                    option.key,
                    [
                        String(at + 1),
                        event.pair.key.text,
                        either(rule.weights).replace(' or ', ' nor '),
                    ],
                    { event: event.pair.key.text, option: String(at + 1), keywords: rule.weights },
                    input.context,
                ),
            );
        });
    }
    return { judged, findings };
}

export const check: BestPracticeCheck = { code: CODE, run };
