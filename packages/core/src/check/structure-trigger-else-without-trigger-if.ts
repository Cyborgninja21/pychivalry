/**
 * `structure/trigger-else-without-trigger-if` (docs/checks.md, item 4.7): `trigger_else` or
 * `trigger_else_if` not directly after a `trigger_if` or `trigger_else_if`. Advice: none of
 * the base game's.
 *
 * The keywords are part D4's rows with the role `else_of_conditional` whose body is a trigger
 * block (the table `containers`), each with the keys its row `follows`.
 */

import type { AdviceCheck } from './advice.js';
import { elseNotAfterConditional } from './advice-else.js';

export const CODE = 'structure/trigger-else-without-trigger-if';

export const check: AdviceCheck = {
    code: CODE,
    run: (input) => elseNotAfterConditional(input, CODE, true),
};
