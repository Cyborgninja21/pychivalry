/**
 * `style/empty-block` (the family `style`, pychivalry's own best-practice rules): a block inside
 * a record that holds nothing, or nothing but comments. Release 2.3.0's style hint CK3314,
 * brought back on the owner's word of 2026-11-23. It tests no keyword: only that the block holds
 * no pair, value or block. A record's own body is not judged (style-blocks.ts).
 *
 * The base game follows it: 1.21.0.3 writes about one block in a hundred empty (the rate is
 * counted by `pychivalry-tools advice proof`). Its fix, a suggestion, takes the empty pair away:
 * whether the empty block means something (an empty list that clears one, a placeholder) is
 * the author's to say.
 */

import { significantItems } from '../syntax/tree.js';
import type { AdviceResult } from './advice.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import { blockName, innerBlocks } from './style-blocks.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';

export const CODE = 'style/empty-block';

function run(input: BestPracticeInput): AdviceResult {
    let judged = 0;
    const findings: CheckFinding[] = [];
    innerBlocks(input.tree, (inner) => {
        judged++;
        if (significantItems(inner.block).length > 0) {
            return;
        }
        const span = inner.pair ?? inner.block;
        findings.push(
            finding(
                CODE,
                span,
                [blockName(inner)],
                {
                    block: blockName(inner),
                    comments: inner.block.items.length > 0 ? 'yes' : 'no',
                },
                input.context,
            ),
        );
    });
    return { judged, findings };
}

export const check: BestPracticeCheck = { code: CODE, run };
