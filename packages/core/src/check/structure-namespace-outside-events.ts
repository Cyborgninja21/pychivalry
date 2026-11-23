/**
 * `structure/namespace-outside-events` (docs/checks.md, item 4.7): a file outside `events/`
 * that declares a `namespace`. Advice: no script file of the base game's `common/` or
 * `history/` does.
 *
 * The keyword is part D4's row with the role `id_prefix`; the folders it may be declared in
 * are the row's own. Every script file of another folder the spec lists is judged.
 */

import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { directoryOf, NOTHING } from './advice.js';
import { holdsIn, keywordRolesOf } from './keyword-roles.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import { significantItems } from '../syntax/tree.js';

export const CODE = 'structure/namespace-outside-events';

function run(input: AdviceInput): AdviceResult {
    const rows = keywordRolesOf(input.spec).withRoles('id_prefix');
    const row = rows.length === 1 ? rows[0] : undefined;
    const dir = directoryOf(input);
    if (row === undefined || row.directories === 'anywhere' || dir === null || holdsIn(row, dir)) {
        return NOTHING;
    }
    const findings: CheckFinding[] = [];
    for (const item of significantItems(input.tree)) {
        if (item.kind === 'pair' && item.key.text === row.keyword) {
            const name = item.value?.kind === 'scalar' ? item.value.text : '';
            findings.push(
                finding(
                    CODE,
                    item.key,
                    [name, row.directories.join(', ')],
                    { namespace: name, directory: dir },
                    input.context,
                ),
            );
        }
    }
    return { judged: 1, findings };
}

export const check: AdviceCheck = { code: CODE, run };
