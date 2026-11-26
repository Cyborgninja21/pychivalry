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
 *
 * Since the owner's decision of 2026-11-26 an empty block that means something is still
 * reported, but its removal is never offered (`empty-iterator.ts`, read from the spec package):
 * an iterator that is a condition asks for at least one item, which the message says, with the
 * test written out by the iterator's own parameter (`data.written_out`), the suggestion the fix
 * makes instead; an iterator the package does not say how to read where it is written gets no
 * fix at all (`data.means`, `not-known`). A trigger or an effect of the package's buckets written
 * with an empty block is never offered for removal either, which would take it away (`data.means`,
 * the kind of its block; the owner kept it, row 171). Since the owner's decision of the same day
 * (row 172) an empty logical operator, scope switch or trigger block (a `limit`), whose meaning
 * when empty the package leaves open (`empty-open.ts`), is never offered for removal either, and
 * its message says the package leaves that open (`data.means`, the kind). Every other empty block
 * is reported as before.
 */

import { significantItems } from '../syntax/tree.js';
import type { AdviceResult } from './advice.js';
import { readContext, type FileReading, type JudgedKey } from './context.js';
import { emptyIterator } from './empty-iterator.js';
import { openEmptyBlock, OPEN_EMPTY_WORDS, type OpenEmptyBlock } from './empty-open.js';
import type { CheckFinding, FindingData } from './finding.js';
import type { Pair } from '../syntax/tree.js';
import { finding } from './report.js';
import { blockName, innerBlocks, type InnerBlock } from './style-blocks.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';

export const CODE = 'style/empty-block';

/** What the message says after "is empty", for a block that means something when empty. */
function meaning(written: string | null): string {
    const asks = ': as a condition it asks for at least one';
    return written === null ? asks : `${asks}; write '${written}' in it to say so`;
}

/** What the message says after "is empty", for a block whose empty meaning is left open. */
function leftOpen(kind: OpenEmptyBlock): string {
    return `: the spec package leaves open what an empty ${OPEN_EMPTY_WORDS[kind]} means`;
}

function run(input: BestPracticeInput): AdviceResult {
    let judged = 0;
    const findings: CheckFinding[] = [];
    let read: { reading: FileReading; keys: Map<Pair, JudgedKey> } | undefined;
    const readingOf = (): { reading: FileReading; keys: Map<Pair, JudgedKey> } => {
        if (read === undefined) {
            const reading: FileReading =
                input.reading ??
                readContext({
                    spec: input.spec,
                    folders: input.folders,
                    file: input.file,
                    tree: input.tree,
                    names: input.names,
                });
            read = { reading, keys: new Map(reading.keys.map((k) => [k.pair, k])) };
        }
        return read;
    };
    const keyOf = (pair: Pair): JudgedKey | undefined => readingOf().keys.get(pair);
    const openOf = (
        pair: Pair,
        inner: InnerBlock,
        key: JudgedKey | undefined,
    ): OpenEmptyBlock | null => {
        const { reading } = readingOf();
        return openEmptyBlock(input.spec, pair, {
            directory: reading.directory,
            key,
            block: reading.blocks.get(inner.block),
            parent: reading.blocks.get(inner.parent),
        });
    };
    innerBlocks(input.tree, (inner) => {
        judged++;
        if (significantItems(inner.block).length > 0) {
            return;
        }
        const span = inner.pair ?? inner.block;
        const key = inner.pair === null ? undefined : keyOf(inner.pair);
        const iterator =
            inner.pair === null ? null : emptyIterator(input.spec, input.names, inner.pair, key);
        let data: FindingData = {
            block: blockName(inner),
            comments: inner.block.items.length > 0 ? 'yes' : 'no',
        };
        let said = '';
        const open =
            inner.pair === null || iterator !== null ? null : openOf(inner.pair, inner, key);
        if (iterator !== null) {
            data = { ...data, means: iterator.means };
            if (iterator.means === 'at-least-one') {
                said = meaning(iterator.writtenOut);
                if (iterator.writtenOut !== null) {
                    data = { ...data, written_out: iterator.writtenOut };
                }
            }
        } else if (open !== null) {
            // Its meaning when empty is left open by the package: it is never taken away.
            data = { ...data, means: open };
            said = leftOpen(open);
        } else if (key?.reading.kind === 'keyword') {
            // A trigger or an effect of the package's buckets, written with an empty block:
            // taking the block away takes the trigger or the effect away, so it is never offered.
            data = { ...data, means: key.context };
        }
        findings.push(finding(CODE, span, [blockName(inner), said], data, input.context));
    });
    return { judged, findings };
}

export const check: BestPracticeCheck = { code: CODE, run };
