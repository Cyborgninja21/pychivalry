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
 *   `NAND`, `any_false`), read as that structural keyword in a trigger block, its body a trigger
 *   block. A block that has no such answer (`OR`, which the condition makes hold; `NOT`, of which
 *   the part says nothing) is not judged.
 *
 * What an empty block evaluates to is open in the package, so the check never makes one: a
 * condition is reported only while the block keeps another item, and of a block holding nothing
 * but such conditions every one but the first. A plain trigger block (a `trigger`, a `limit`) is
 * not judged: the part has no `combines_conditions` row for it (its own `not_settled`), so the
 * base game's `trigger = { always = yes }` is no finding.
 *
 * The rule judges every block of those keywords in a trigger block, in every folder; the base
 * game breaks it in 1 of its 9,350.
 */

import type { Block } from '../syntax/tree.js';
import { blockOf, significantItems, type Item, type Pair } from '../syntax/tree.js';
import type { AdviceResult } from './advice.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';
import { readContext, type FileReading, type JudgedKey } from './context.js';
import type { CheckFinding } from './finding.js';
import { keywordRolesOf, roleConfirmed, type RoleRow } from './keyword-roles.js';
import { finding } from './report.js';

export const CODE = 'style/redundant-condition';

/** The roles and the answer of part D4 the check reads. */
const COMBINES = 'combines_conditions';
const CONSTANT = 'constant_condition';
const NEUTRAL = 'neutral';

/** The name a judged key is read as: its own, or the one it differs from only in letter case. */
function nameOf(key: JudgedKey): string {
    return key.folded ?? key.pair.key.text;
}

/** The constant conditions part D4 confirms, with the value that makes each hold. */
function constants(input: BestPracticeInput): RoleRow[] {
    return keywordRolesOf(input.spec)
        .withRoles(CONSTANT)
        .filter((r) => roleConfirmed(r, CONSTANT) && r.holdsWith !== null);
}

/** The blocks in which a child that always holds changes nothing, by keyword. */
function neutralBlocks(input: BestPracticeInput): Map<string, RoleRow> {
    return new Map(
        keywordRolesOf(input.spec)
            .withRoles(COMBINES)
            .filter((r) => roleConfirmed(r, COMBINES) && r.childAlwaysTrue === NEUTRAL)
            .map((r) => [r.keyword, r]),
    );
}

function run(input: BestPracticeInput): AdviceResult {
    const holding = constants(input);
    const blocks = neutralBlocks(input);
    if (holding.length === 0 || blocks.size === 0) {
        return { judged: 0, findings: [] };
    }
    const reading: FileReading =
        input.reading ??
        readContext({
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.tree,
            names: input.names,
        });
    const keys = new Map<Pair, JudgedKey>(reading.keys.map((k) => [k.pair, k]));
    /** True when the item is a condition that always holds, read as one in a trigger block. */
    const isHolding = (item: Item): item is Pair => {
        if (item.kind !== 'pair' || item.value?.kind !== 'scalar') {
            return false;
        }
        const key = keys.get(item);
        const value = item.value.text;
        return (
            key !== undefined &&
            key.context === 'trigger' &&
            key.reading.kind === 'keyword' &&
            holding.some((r) => r.keyword === nameOf(key) && r.holdsWith === value)
        );
    };
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const key of reading.keys) {
        if (key.context !== 'trigger' || key.reading.kind !== 'structural') {
            continue;
        }
        // Read as the structural keyword: the reader reads `and` and `And` as the game's own
        // trigger `and`, of which the part says nothing.
        const row = blocks.get(nameOf(key));
        const body: Block | undefined = blockOf(key.pair.value);
        if (row === undefined || body === undefined) {
            continue;
        }
        judged++;
        const items = significantItems(body);
        const redundant = items.filter(isHolding);
        // Never leave the block empty: keep one when it holds nothing else.
        const reported = redundant.length === items.length ? redundant.slice(1) : redundant;
        for (const pair of reported) {
            findings.push(
                finding(
                    CODE,
                    pair,
                    [
                        `${pair.key.text} = ${pair.value?.kind === 'scalar' ? pair.value.text : ''}`,
                        row.keyword,
                    ],
                    { condition: pair.key.text, block: row.keyword },
                    input.context,
                ),
            );
        }
    }
    return { judged, findings };
}

export const check: BestPracticeCheck = { code: CODE, run };
