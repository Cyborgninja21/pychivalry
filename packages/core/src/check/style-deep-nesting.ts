/**
 * `style/deep-nesting` (the family `style`, pychivalry's own best-practice rules): a block
 * nested more than six blocks deep inside its record, the record's own body being the first.
 * Release 2.3.0's style hint CK3317, with its limit of six, brought back on the owner's word of
 * 2026-11-23. It tests no keyword, only depth.
 *
 * One finding a record, at the first block that crosses the limit, with the number of places
 * in the record where a block crosses it (the outermost block past it each time, never the
 * blocks inside that one); a generated file can cross it tens of thousands of times. The base
 * game follows it: 1.21.0.3 crosses the limit in about one record in twenty-five (counted by
 * `pychivalry-tools advice proof`). No fix: how to restructure deep script (a scripted effect, a
 * flatter condition) is the author's choice.
 */

import type { AdviceResult } from './advice.js';
import type { CheckFinding } from './finding.js';
import { finding } from './report.js';
import type { Pair } from '../syntax/tree.js';
import { blockName, innerBlocks, recordPairs, type InnerBlock } from './style-blocks.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';

export const CODE = 'style/deep-nesting';

/** The deepest a block may be nested in its record, the record's body being depth 1 (2.3.0's limit). */
export const MAX_DEPTH = 6;

function run(input: BestPracticeInput): AdviceResult {
    const records = recordPairs(input.tree);
    const first = new Map<Pair, InnerBlock>();
    const places = new Map<Pair, number>();
    innerBlocks(input.tree, (inner) => {
        // Only a block that crosses the limit: one whose parent is within it.
        if (inner.depth !== MAX_DEPTH + 1) {
            return;
        }
        places.set(inner.record, (places.get(inner.record) ?? 0) + 1);
        if (!first.has(inner.record)) {
            first.set(inner.record, inner);
        }
    });
    const findings: CheckFinding[] = [];
    for (const [record, inner] of first) {
        const name = blockName(inner);
        const count = String(places.get(record) ?? 1);
        const span = inner.pair?.key ?? { start: inner.block.start, end: inner.block.start + 1 };
        findings.push(
            finding(
                CODE,
                span,
                [name, String(inner.depth), String(MAX_DEPTH), count],
                {
                    record: record.key.text,
                    block: name,
                    depth: String(inner.depth),
                    max_depth: String(MAX_DEPTH),
                    places: count,
                },
                input.context,
            ),
        );
    }
    return { judged: records.length, findings };
}

export const check: BestPracticeCheck = { code: CODE, run };
