/**
 * `style/redundant-false-condition` (docs/checks.md, best practice): a condition that always
 * fails, written in a block where it changes nothing: `always = no` among other conditions of a
 * block that holds when any of them holds, or when none does. A hint, on pychivalry's own
 * best-practice rules (the owner's word of 2026-11-25, decision 158). The twin of
 * `style/redundant-condition`, whose meaning it leaves as it is: that code is a condition that
 * always holds; this one a condition that always fails. Both run through one reader
 * (`redundant-constant.ts`).
 *
 * Everything it reads is part D4 of the spec package (format 9), confirmed roles only:
 *
 * - the condition: a row whose role `constant_condition` is confirmed, written with the value
 *   that makes it fail (`fails_with`: `always = no`), read as that trigger in a trigger block;
 * - the block: a row whose role `combines_conditions` is confirmed and whose `child_always_false`
 *   is `neutral` (a child that always fails changes nothing "while another child remains": `OR`,
 *   `NOR`, `all_false`), read in a trigger block as that structural keyword (`OR`, `NOR`) or as
 *   that trigger, whose body the reader reads as a trigger block (`all_false`, a container of
 *   the tables). A block that has another answer (`AND` and `NAND`, which the condition makes
 *   fail or hold) or none (`NOT`) is not judged. (`style/redundant-condition` reads its own
 *   blocks the same way, `any_false` among them: decision 163.)
 *
 * What an empty block evaluates to is open in the package, so the check never makes one: a
 * condition is reported only while the block keeps another item, and of a block holding nothing
 * but such conditions every one but the first. A plain trigger block (a `trigger`, a `limit`) is
 * not judged: the part has no `combines_conditions` row for it, so `trigger = { always = no }`,
 * the deliberate way to switch content off (release 2.3.0's CK3873, not restored), is no
 * finding.
 *
 * The rule judges every block of those keywords in a trigger block, in every folder; the base
 * game breaks it in 1 of its 39,426 (39,410 `OR` and `NOR` blocks, 16 `all_false`).
 */

import type { BestPracticeCheck } from './best-practice.js';
import { redundantConstant } from './redundant-constant.js';

export const CODE = 'style/redundant-false-condition';

export const check: BestPracticeCheck = {
    code: CODE,
    run: (input) => redundantConstant(input, { code: CODE, result: 'fails' }),
};
