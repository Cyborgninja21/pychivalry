/**
 * What the two best-practice rules on a condition with a fixed result share (docs/checks.md):
 * `style/redundant-condition`, a condition that always holds, and
 * `style/redundant-false-condition`, a condition that always fails, each written directly in a
 * block where it changes nothing. Each is a hint, on pychivalry's own best-practice rules.
 *
 * Everything they read is part D4 of the spec package (format 9), confirmed roles only:
 *
 * - the condition: a row whose role `constant_condition` is confirmed, written with the value
 *   that gives it its fixed result (`holds_with` for one that always holds, `fails_with` for one
 *   that always fails), read as that trigger in a trigger block;
 * - the block: a row whose role `combines_conditions` is confirmed and whose answer for a child
 *   of that result (`child_always_true`, `child_always_false`) is `neutral`: "the child can be
 *   removed without changing the result, as long as another child remains". It is read in a
 *   trigger block as that structural keyword (`AND`, `OR`) or, where a rule says so
 *   (`containers`), as that trigger of the triggers bucket whose body the reader reads as a
 *   trigger block (`all_false`, `any_false`, entries of the table `containers`). A block whose
 *   answer is another one, or none (`NOT`, of which the part says nothing), is not judged.
 *
 * What an empty block evaluates to is open in the package, so neither rule ever makes one: a
 * condition is reported only while the block keeps another item, and of a block holding nothing
 * but such conditions every one but the first. A plain trigger block (a `trigger`, a `limit`)
 * is not judged: the part has no `combines_conditions` row for it (its own `not_settled`).
 */

import type { Block } from '../syntax/tree.js';
import { blockOf, significantItems, type Item, type Pair } from '../syntax/tree.js';
import type { AdviceResult } from './advice.js';
import type { BestPracticeInput } from './best-practice.js';
import { readContext, type FileReading, type JudgedKey } from './context.js';
import type { CheckCode, CheckFinding } from './finding.js';
import { keywordRolesOf, roleConfirmed, type RoleRow } from './keyword-roles.js';
import { finding } from './report.js';

/** The roles and the answer of part D4 the rules read. */
const COMBINES = 'combines_conditions';
const CONSTANT = 'constant_condition';
const NEUTRAL = 'neutral';

/** Which fixed result a rule judges: a condition that always holds, or one that always fails. */
export type FixedResult = 'holds' | 'fails';

/** A rule on a condition with a fixed result. */
export interface RedundantConstantRule {
    readonly code: CheckCode;
    readonly result: FixedResult;
    /**
     * Whether a block read as a trigger of the triggers bucket (a container of the tables, whose
     * body the reader reads as a trigger block: `all_false`, `any_false`) is judged beside one
     * read as a structural keyword. `style/redundant-condition` was built reading structural
     * keywords only and stays so (decision 158: its meaning is not changed);
     * `style/redundant-false-condition` reads every block part D4 names.
     */
    readonly containers: boolean;
}

/** The value a constant condition's row gives for that result (`always = yes`, `always = no`). */
function valueOf(row: RoleRow, result: FixedResult): string | null {
    return result === 'holds' ? row.holdsWith : row.failsWith;
}

/** What a block's row says a child of that result does to it. */
function answerOf(row: RoleRow, result: FixedResult): string | null {
    return result === 'holds' ? row.childAlwaysTrue : row.childAlwaysFalse;
}

/** The name a judged key is read as: its own, or the one it differs from only in letter case. */
function nameOf(key: JudgedKey): string {
    return key.folded ?? key.pair.key.text;
}

/** The constant conditions part D4 confirms that have a value for the result. */
function constants(input: BestPracticeInput, result: FixedResult): RoleRow[] {
    return keywordRolesOf(input.spec)
        .withRoles(CONSTANT)
        .filter((r) => roleConfirmed(r, CONSTANT) && valueOf(r, result) !== null);
}

/** The blocks in which a child of the result changes nothing, by keyword. */
function neutralBlocks(input: BestPracticeInput, result: FixedResult): Map<string, RoleRow> {
    return new Map(
        keywordRolesOf(input.spec)
            .withRoles(COMBINES)
            .filter((r) => roleConfirmed(r, COMBINES) && answerOf(r, result) === NEUTRAL)
            .map((r) => [r.keyword, r]),
    );
}

/**
 * Every block of a keyword whose answer for the result is `neutral`, in a trigger block, judged;
 * each condition of that fixed result written directly in it reported under the rule's code, but
 * one that would leave the block empty.
 */
export function redundantConstant(
    input: BestPracticeInput,
    rule: RedundantConstantRule,
): AdviceResult {
    const { code, result } = rule;
    const fixed = constants(input, result);
    const blocks = neutralBlocks(input, result);
    if (fixed.length === 0 || blocks.size === 0) {
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
    /** True when the item is a condition of the result, read as one in a trigger block. */
    const isFixed = (item: Item): item is Pair => {
        if (item.kind !== 'pair' || item.value?.kind !== 'scalar') {
            return false;
        }
        const key = keys.get(item);
        const value = item.value.text;
        return (
            key !== undefined &&
            key.context === 'trigger' &&
            key.reading.kind === 'keyword' &&
            fixed.some((r) => r.keyword === nameOf(key) && valueOf(r, result) === value)
        );
    };
    let judged = 0;
    const findings: CheckFinding[] = [];
    for (const key of reading.keys) {
        const read = key.reading;
        const block =
            read.kind === 'structural' ||
            (rule.containers && read.kind === 'keyword' && read.bucket === 'triggers');
        if (key.context !== 'trigger' || !block) {
            continue;
        }
        // Read by the name the reader gives it: the reader reads `and` and `And` as the game's
        // own trigger `and`, of which the part says nothing, so no row matches it.
        const row = blocks.get(nameOf(key));
        const body: Block | undefined = blockOf(key.pair.value);
        if (row === undefined || body === undefined) {
            continue;
        }
        judged++;
        const items = significantItems(body);
        const redundant = items.filter(isFixed);
        // Never leave the block empty: keep one when it holds nothing else.
        const reported = redundant.length === items.length ? redundant.slice(1) : redundant;
        for (const pair of reported) {
            findings.push(
                finding(
                    code,
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
