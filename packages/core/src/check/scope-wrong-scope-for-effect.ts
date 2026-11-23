/**
 * `scope/wrong-scope-for-effect` (docs/checks.md, item 4.4): an effect in a scope its scope
 * data does not list. Evidence: the catalogue's `wrong_scope_for_effect_X_expected_X` ("Wrong
 * scope for effect: %s, expected %s"), and the scopes each effect supports from the game's own
 * documentation output (`scope_validity.effects`).
 *
 * As `scope/wrong-scope-for-trigger`, for effects: judged only where the scope walk
 * (`check/scope.ts`) knows the scope and the effect's scope data declares a requirement. An
 * `every_`, `random_` or `ordered_` iterator is an effect by its prefix (part D8).
 */

import type { CheckFinding } from './finding.js';
import type { CheckContext } from './report.js';
import type { KeywordUse } from './scope.js';
import { wrongScopes } from './scope-wrong-scope-for-trigger.js';

export const CODE = 'scope/wrong-scope-for-effect';

export function wrongScopeEffects(
    uses: readonly KeywordUse[],
    context: CheckContext,
): CheckFinding[] {
    return wrongScopes(CODE, 'effect', uses, context);
}
