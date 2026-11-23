/**
 * Else branches (part D4's role `else_of_conditional`): valid only directly after one of the
 * keys their row `follows`. Shared by `structure/else-without-if`, for the branches whose
 * body keeps the context around (the table `containers`, `child: same`), and
 * `structure/trigger-else-without-trigger-if`, for those whose body is a trigger block.
 */

import type { AdviceInput, AdviceResult } from './advice.js';
import { either, NOTHING, walkPairs } from './advice.js';
import { keywordRolesOf } from './keyword-roles.js';
import type { AdviceCode, CheckFinding } from './finding.js';
import { finding } from './report.js';
import { tablesOf } from '../spec/tables.js';

/** Branches of the kind asked for that do not directly follow a key their row names. */
export function elseNotAfterConditional(
    input: AdviceInput,
    code: AdviceCode,
    triggerBody: boolean,
): AdviceResult {
    const containers = tablesOf(input.spec).containers;
    const branches = new Map<string, readonly string[]>();
    for (const row of keywordRolesOf(input.spec).withRoles('else_of_conditional')) {
        const body = containers.get(row.keyword)?.child;
        if (row.follows.length > 0 && body !== undefined && (body === 'trigger') === triggerBody) {
            branches.set(row.keyword, row.follows);
        }
    }
    if (branches.size === 0) {
        return NOTHING;
    }
    let judged = 0;
    const findings: CheckFinding[] = [];
    walkPairs(input.tree, (pair, _parent, siblings, at) => {
        const follows = branches.get(pair.key.text);
        if (follows === undefined) {
            return;
        }
        judged++;
        const before = siblings[at - 1];
        if (before?.kind !== 'pair' || !follows.includes(before.key.text)) {
            findings.push(
                finding(
                    code,
                    pair.key,
                    [pair.key.text, either(follows)],
                    { branch: pair.key.text, follows },
                    input.context,
                ),
            );
        }
    });
    return { judged, findings };
}
