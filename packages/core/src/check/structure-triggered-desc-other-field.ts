/**
 * `structure/triggered-desc-other-field` (docs/checks.md, item 4.5): a `triggered_desc` block
 * holding anything but `desc` and `trigger`. A warning on the catalogue's
 * `the_body_of_triggered_desc_can_only_take_desc_and_or_trigger` ("The body of triggered_desc can
 * only take desc and/or trigger. %s"), kept beside the 1.21 executable's dynamic-description
 * reader; in the committed catalogue since the spec package's format 9.
 *
 * Written by hand against that message, with its keywords from part D4 (`keyword_roles`, read
 * through `keyword-roles.ts`), confirmed roles only: the block is a row whose role `closed_body`
 * is confirmed ("its body takes only the keys in `allows_only`") and whose evidence quotes this
 * check's own message; the keys its body takes are the row's `allows_only`. Every such block is
 * judged where the row holds (`anywhere` on 1.21.0.3), below a parent key when the row names
 * any. Each direct child pair whose key the row does not allow is reported at its key.
 *
 * Not judged: a key that differs from an allowed key only in letter case (whether the reader
 * folds case is not shown), and a bare value or block without a key in the body, which is
 * another message's (the parser's). The base game writes 22,398 such blocks and none holds
 * another key.
 */

import type { Spec } from '../spec/reader.js';
import { catalogueFromSpec } from '../syntax/findings.js';
import { blockOf, significantItems, type Block, type FileNode, type Item } from '../syntax/tree.js';
import { CHECK_KINDS, type CheckFinding } from './finding.js';
import { holdsIn, keywordRolesOf, roleConfirmed, type RoleRow } from './keyword-roles.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'structure/triggered-desc-other-field';

/** The role of part D4 the check reads: a block whose body takes only some keys. */
const CLOSED_BODY = 'closed_body';

/** A block whose body takes only some keys, as part D4 says. */
export interface ClosedBody {
    readonly keyword: string;
    /** The parent keys it holds below; empty when it holds below any. */
    readonly parents: readonly string[];
    /** The keys its body takes (`allows_only`). */
    readonly allows: readonly string[];
    readonly row: RoleRow;
}

const cache = new WeakMap<Spec, readonly ClosedBody[]>();

/**
 * The blocks the check judges: the rows of part D4 whose role `closed_body` is confirmed, that
 * list the keys their body takes, and whose evidence quotes the check's catalogue message.
 */
export function closedBodiesOf(spec: Spec): readonly ClosedBody[] {
    let out = cache.get(spec);
    if (out !== undefined) {
        return out;
    }
    const id = CHECK_KINDS[CODE].catalogue;
    const text = id === null ? undefined : catalogueFromSpec(spec.data).get(id);
    out = keywordRolesOf(spec)
        .withRoles(CLOSED_BODY)
        .filter((r) => roleConfirmed(r, CLOSED_BODY))
        .flatMap((row): ClosedBody[] => {
            const allows = row.row['allows_only'];
            const quoted = row.row.evidence.some((e) => text !== undefined && e['string'] === text);
            if (!Array.isArray(allows) || allows.length === 0 || !quoted) {
                return [];
            }
            return [
                {
                    keyword: row.keyword,
                    parents: row.parents,
                    allows: allows.filter((k): k is string => typeof k === 'string'),
                    row,
                },
            ];
        });
    cache.set(spec, out);
    return out;
}

/** What the check reads. */
export interface TriggeredDescInput {
    readonly spec: Spec;
    /** The spec folder the file is in, or null. */
    readonly directory: string | null;
    readonly tree: FileNode;
}

/** The pair's block, when its key is one of the judged blocks' and its parent fits the row. */
function judgedBlock(
    item: Item,
    parentKey: string | null,
    rules: readonly ClosedBody[],
): { readonly body: Block; readonly rule: ClosedBody } | undefined {
    if (item.kind !== 'pair') {
        return undefined;
    }
    const body = blockOf(item.value);
    if (body === undefined) {
        return undefined;
    }
    const rule = rules.find(
        (r) =>
            r.keyword === item.key.text &&
            (r.parents.length === 0 || (parentKey !== null && r.parents.includes(parentKey))),
    );
    return rule === undefined ? undefined : { body, rule };
}

export function triggeredDescOtherFields(
    context: CheckContext,
    input: TriggeredDescInput,
): CheckFinding[] {
    const rules = closedBodiesOf(input.spec).filter((r) => holdsIn(r.row, input.directory));
    if (rules.length === 0) {
        return [];
    }
    const out: CheckFinding[] = [];
    const walk = (container: FileNode | Block, parentKey: string | null): void => {
        for (const item of significantItems(container)) {
            const judged = judgedBlock(item, parentKey, rules);
            if (judged !== undefined) {
                const allowed = new Set(judged.rule.allows);
                const folded = new Set(judged.rule.allows.map((k) => k.toLowerCase()));
                for (const child of significantItems(judged.body)) {
                    if (
                        child.kind !== 'pair' ||
                        allowed.has(child.key.text) ||
                        folded.has(child.key.text.toLowerCase())
                    ) {
                        continue;
                    }
                    out.push(
                        finding(
                            CODE,
                            child.key,
                            [],
                            {
                                key: child.key.text,
                                block: judged.rule.keyword,
                                allowed: judged.rule.allows,
                            },
                            context,
                        ),
                    );
                }
            }
            const body =
                item.kind === 'block'
                    ? item
                    : item.kind === 'pair'
                      ? blockOf(item.value)
                      : undefined;
            if (body !== undefined) {
                walk(body, item.kind === 'pair' ? item.key.text : null);
            }
        }
    };
    walk(input.tree, null);
    return out;
}
