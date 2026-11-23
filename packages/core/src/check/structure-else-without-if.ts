/**
 * `structure/else-without-if` (docs/checks.md, item 4.7): `else` or `else_if` not directly
 * after an `if` or `else_if`. Advice: none of the base game's.
 *
 * The keywords are part D4's rows with the role `else_of_conditional` whose body keeps the
 * context around (the table `containers`), each with the keys its row `follows`.
 */

import type { AdviceCheck } from './advice.js';
import { elseNotAfterConditional } from './advice-else.js';

export const CODE = 'structure/else-without-if';

export const check: AdviceCheck = {
    code: CODE,
    run: (input) => elseNotAfterConditional(input, CODE, false),
};
