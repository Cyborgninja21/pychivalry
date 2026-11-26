/**
 * `style/redundant-condition` (docs/checks.md, best practice): a condition that always holds,
 * written in a block where it changes nothing; release 2.3.0's CK3872, `always = yes` in a block
 * whose conditions must all hold. A hint, on pychivalry's own best-practice rules (the owner's
 * word of 2026-11-23, decision 112).
 *
 * Everything it reads is part D4 of the spec package (format 9), confirmed roles only:
 *
 * - the condition: a row whose role `constant_condition` is confirmed, written with the value
 *   that makes it hold (`holds_with`: `always = yes`), read as that trigger in a trigger block;
 * - the block: a row whose role `combines_conditions` is confirmed and whose `child_always_true`
 *   is `neutral` (a child that always holds changes nothing "while another child remains": `AND`,
 *   `NAND`, `any_false`), read in a trigger block as that structural keyword (`AND`, `NAND`) or as
 *   that trigger, whose body the reader reads as a trigger block (`any_false`, a container of the
 *   tables). A block that has no such answer (`OR`, which the condition makes hold; `NOT`, of
 *   which the part says nothing) is not judged.
 *
 * What an empty block evaluates to is open in the package, so the check never makes one: a
 * condition is reported only while the block keeps another item, and of a block holding nothing
 * but such conditions every one but the first. A plain trigger block (a `trigger`, a `limit`) is
 * not judged: the part has no `combines_conditions` row for it (its own `not_settled`), so the
 * base game's `trigger = { always = yes }` is no finding.
 *
 * The rule judges every block of those keywords in a trigger block, in every folder; the base
 * game breaks it in 1 of its 9,350 (all `AND` and `NAND`: it writes no `any_false`). Its twin for
 * a condition that always fails is `style/redundant-false-condition`; both run through one reader
 * (`redundant-constant.ts`), which judges every block part D4 names, whatever the context reader
 * reads it as (decision 163).
 */

import type { BestPracticeCheck } from './best-practice.js';
import { redundantConstant } from './redundant-constant.js';

export const CODE = 'style/redundant-condition';

export const check: BestPracticeCheck = {
    code: CODE,
    run: (input) => redundantConstant(input, { code: CODE, result: 'holds' }),
};
