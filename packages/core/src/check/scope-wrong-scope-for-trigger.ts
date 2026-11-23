/**
 * `scope/wrong-scope-for-trigger` (docs/checks.md, item 4.4): a trigger in a scope its scope
 * data does not list. Evidence: the catalogue's `wrong_scope_for_trigger_X_expected_X` ("Wrong
 * scope for trigger: %s, expected %s"), and the scopes each trigger supports from the game's own
 * documentation output (`scope_validity.triggers`).
 *
 * The scope a key runs in is the scope walk's (`check/scope.ts`); a trigger is judged only where
 * that scope is known and its scope data declares a requirement. An iterator is a trigger or an
 * effect by its prefix (part D8): an `any_` iterator is judged here.
 */

import type { Context } from './context.js';
import type { CheckCode, CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';
import type { KeywordUse } from './scope.js';

export const CODE = 'scope/wrong-scope-for-trigger';

/** The findings of one of the two keyword scope checks: the uses of `kind` that do not fit. */
export function wrongScopes(
    code: CheckCode,
    kind: Context,
    uses: readonly KeywordUse[],
    context: CheckContext,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const use of uses) {
        const verdict = use.verdict;
        if (use.kind !== kind || !verdict.judged || verdict.fits) {
            continue;
        }
        out.push(
            finding(
                code,
                use.key.pair.key,
                [verdict.current, verdict.expected.join(', ')],
                { name: use.name, scope: verdict.current, expected: verdict.expected },
                context,
            ),
        );
    }
    return out;
}

export function wrongScopeTriggers(
    uses: readonly KeywordUse[],
    context: CheckContext,
): CheckFinding[] {
    return wrongScopes(CODE, 'trigger', uses, context);
}
