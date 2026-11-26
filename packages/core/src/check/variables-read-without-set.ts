/**
 * `variables/read-without-set` (docs/checks.md, a row of its own since the spec package's format
 * 9): a variable read or tested in a namespace and as a kind (a value, a list, a map) that no
 * keyword of that namespace and kind sets under its name in the mod or the base game. Advice, at
 * information: the table says which keywords set and read variables; that a read of a variable
 * nothing sets finds nothing is pychivalry's reading of it, not a message of the game's.
 *
 * Everything it reads is the table `variables` of part C4 (format 9, 75 confirmed entries,
 * `FolderTable.variables`), by its own `consumer` text: "a name is defined by the entries with
 * `does: set` (`holds: value`) or `does: add_item` (`holds: list` or `map`) of the same
 * `namespace` and `holds`, and read or tested by the others; names of different namespaces, and
 * of a value, a list and a map, are told apart by these two attributes". A read is:
 *
 * - a key the context reader reads as one of the table's effects or triggers that gives no
 *   variable its name, the name where its `name_in` says (`has_variable = x`, `has_variable = {
 *   name = x }`, `change_variable = { name = x }`, `remove_variable = x`);
 * - an iterator over one of the table's lists, the name in its block's `variable`
 *   (`every_in_list = { variable = x }`);
 * - a segment of a chain written with one of the table's links, anywhere in the file
 *   (`var:x`, `global_var:x`, `variable_map(x|k)`), as the index reads `scope:x`.
 *
 * A name holding a `$PARAM$` is no one name and is not judged. The variable may be set
 * (`WorkspaceNames.isVariableSet`) by a keyword that names it in the same namespace and kind, in
 * a file the game reads or may read; by one that sets a name built with a `$PARAM$` that can
 * become it; or by one that sets a name that is only a `$PARAM$` (`name = $VAR$`) when some file
 * writes the name other than in a variable statement, a value passed to that parameter being
 * possibly it. Without the base game in the index the check judges nothing: a mod reads the base
 * game's variables. Names the game's own code sets as variables (the dynasty perks' traits, which
 * the table's notes give only in words) are not in the package as data, so a read of one is
 * reported (docs/checks.md, its known exceptions).
 */

import { variableLinkReads, variableStatementsOf } from '../index/extract.js';
import type { VariableRule } from '../index/folders.js';
import { blockOf, significantItems, type Pair, type Scalar } from '../syntax/tree.js';
import type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
import { NOTHING, walkPairs } from './advice.js';
import { readContext, type FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { withBaseGame } from './names.js';
import { finding } from './report.js';

export const CODE = 'variables/read-without-set';

/** A read of a variable in a file: where its name is, the keyword, and its rule. */
interface Read {
    readonly span: { readonly start: number; readonly end: number };
    readonly name: string;
    readonly keyword: string;
    readonly rule: VariableRule;
}

/** Every read of a variable the file writes (see the head of this file). */
export function variableReads(
    input: AdviceInput,
    reading: FileReading,
    variables: ReadonlyMap<string, VariableRule>,
): Read[] {
    const out: Read[] = [];
    const judged = new Set<Pair>();
    for (const key of reading.keys) {
        if (key.reading.kind === 'keyword') {
            judged.add(key.pair);
        } else if (key.reading.kind === 'iterator') {
            // An iterator over one of the table's lists: the name is in the parameter of its
            // block that the entry's `name_in` names (`variable`).
            const rule = variables.get(key.reading.base.toLowerCase());
            const body = blockOf(key.pair.value);
            if (rule === undefined || rule.defines || body === undefined) {
                continue;
            }
            for (const item of significantItems(body)) {
                if (
                    item.kind === 'pair' &&
                    rule.nameIn.includes(item.key.text) &&
                    item.value?.kind === 'scalar' &&
                    item.value.type === 'name'
                ) {
                    out.push({
                        span: item.value,
                        name: item.value.text,
                        keyword: key.pair.key.text,
                        rule,
                    });
                }
            }
        }
    }
    const scalarReads = (s: Scalar): void => {
        for (const read of variableLinkReads(s, variables)) {
            out.push({
                span: { start: read.start, end: read.start + read.name.length },
                name: read.name,
                keyword: read.link,
                rule: read.rule,
            });
        }
    };
    walkPairs(input.tree, (pair) => {
        scalarReads(pair.key);
        if (pair.value?.kind === 'scalar') {
            scalarReads(pair.value);
        }
        if (!judged.has(pair)) {
            return;
        }
        for (const statement of variableStatementsOf(pair, variables)) {
            if (
                !statement.rule.defines &&
                statement.name.type === 'name' &&
                !statement.name.text.includes('$')
            ) {
                out.push({
                    span: statement.name,
                    name: statement.name.text,
                    keyword: statement.key,
                    rule: statement.rule,
                });
            }
        }
    });
    for (const item of significantItems(input.tree)) {
        if (item.kind === 'scalar') {
            scalarReads(item);
        }
    }
    return out.sort((a, b) => a.span.start - b.span.start);
}

function run(input: AdviceInput): AdviceResult {
    const names = withBaseGame(input.names);
    const variables = input.folders.variables;
    if (names === undefined || variables.size === 0) {
        return NOTHING;
    }
    const reading =
        input.reading ??
        readContext({
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.tree,
            names: input.names,
        });
    const setters = (rule: VariableRule): string[] =>
        [...variables]
            .filter(
                ([, r]) => r.defines && r.namespace === rule.namespace && r.holds === rule.holds,
            )
            .map(([k]) => k)
            .sort();
    const reads = variableReads(input, reading, variables);
    const findings: CheckFinding[] = [];
    for (const read of reads) {
        if (names.isVariableSet(read.rule.namespace, read.rule.holds, read.name)) {
            continue;
        }
        findings.push(
            finding(
                CODE,
                read.span,
                [read.name, read.keyword, read.rule.holds, read.rule.namespace],
                {
                    variable: read.name,
                    keyword: read.keyword,
                    namespace: read.rule.namespace,
                    holds: read.rule.holds,
                    set_by: setters(read.rule),
                },
                input.context,
            ),
        );
    }
    return { judged: reads.length, findings };
}

export const check: AdviceCheck = { code: CODE, run };
