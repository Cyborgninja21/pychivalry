/**
 * The fixes of the parse findings about a missing or wrong operator, each from the parser's
 * own reading of the line (docs/PLAN.md item 8.7):
 *
 * - `syntax/missing-equals-before-block`: `name { ... }` among statements, which the parser
 *   reads as `name = { ... }`: the `=` written in. Safe: it writes what was read.
 * - `syntax/missing-operator`: a key at the top level with a value after it on the same line
 *   and no operator between (`@name 10`): the `=` written in. Safe: at the top level of a file
 *   every statement is `key = value`. No fix when the next token is on another line, where the
 *   key may as well be a line on its own.
 * - `syntax/null-safe-operator-after-value`: `?=` after quoted text. When the text in the
 *   quotes is a name or a scope chain, the quotes taken away: `?=` is written for a scope that
 *   may not exist, so the quoted scope is what was meant (safe). Otherwise, after a number, a
 *   date, a constant or other text, `?=` written as `=` (a suggestion: what the comparison
 *   meant is not known).
 */

import { classifyWord, tokenize } from '../syntax/lexer.js';
import type { Item, Pair } from '../syntax/tree.js';
import type { FixableFinding, FixFile } from './file.js';
import { safeFix, suggestion, type FindingFix } from './fix.js';

/** The text an insertion of `= ` needs before `at`: a space before it when none is there. */
function equalsBefore(file: FixFile, at: number): string {
    const before = file.text.charAt(at - 1);
    return before === ' ' || before === '\t' ? '= ' : ' = ';
}

export function missingEqualsFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    if (file.text.charAt(finding.start) !== '{') {
        return null;
    }
    const alternative = {
        title: "Write the '=' between the name and its block",
        edits: [file.insert(finding.start, equalsBefore(file, finding.start))],
    };
    return file.parsesFixed(alternative, 'syntax/missing-equals-before-block')
        ? safeFix('parser', alternative)
        : null;
}

export function missingOperatorFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    if (finding.start === finding.end || file.tree === null) {
        return null;
    }
    // The bare key before the token found: the last item of the file that ends before it.
    let key: Item | undefined;
    for (const item of file.tree.items) {
        if (item.end <= finding.start && item.kind !== 'comment') {
            key = item;
        }
    }
    if (key?.kind !== 'scalar') {
        return null;
    }
    // `key value` and nothing else on the line: anything after the value would be read as
    // another key.
    const between = file.slice(key.end, finding.start);
    const line = file.lines.positionAt(finding.start).line;
    const lineEnd = file.lines.lineStarts[line + 1] ?? file.text.length;
    const after = file.slice(finding.end, lineEnd);
    if (!/^[ \t]+$/.test(between) || !/^[ \t]*(#.*)?[\r\n]*$/.test(after)) {
        return null;
    }
    const alternative = {
        title: `Write the '=' between '${key.text}' and its value`,
        edits: [file.insert(finding.start, '= ')],
    };
    return file.parsesFixed(alternative, 'syntax/missing-operator')
        ? safeFix('parser', alternative)
        : null;
}

/** The pair whose operator starts at `offset`, anywhere in the tree. */
function pairWithOperatorAt(items: readonly Item[], offset: number): Pair | undefined {
    for (const item of items) {
        if (item.kind !== 'pair') {
            continue;
        }
        if (item.operator?.start === offset) {
            return item;
        }
        if (item.start <= offset && offset < item.end && item.value?.kind === 'block') {
            const found = pairWithOperatorAt(item.value.items, offset);
            if (found !== undefined) {
                return found;
            }
        }
    }
    for (const item of items) {
        if (item.kind === 'block' && item.start <= offset && offset < item.end) {
            return pairWithOperatorAt(item.items, offset);
        }
    }
    return undefined;
}

/** True when `text` reads as one plain name or scope chain. */
function isNameOrChain(text: string): boolean {
    const tokens = tokenize(text);
    const word = tokens[0];
    if (tokens.length !== 2 || word?.kind !== 'word' || word.end !== text.length) {
        return false;
    }
    const type = classifyWord(text);
    return type === 'name' || type === 'chain';
}

export function nullSafeAfterValueFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const pair =
        file.tree === null ? undefined : pairWithOperatorAt(file.tree.items, finding.start);
    if (pair === undefined) {
        return null;
    }
    const key = pair.key;
    const id = 'syntax/null-safe-operator-after-value';
    if (key.type === 'string' && key.terminated && isNameOrChain(key.value)) {
        const unquoted = {
            title: `Write ${key.text} without its quotes`,
            edits: [file.replace(key.start, key.end, key.value)],
        };
        return file.parsesFixed(unquoted, id) ? safeFix('parser', unquoted) : null;
    }
    const equals = {
        title: "Write '?=' as '='",
        edits: [file.replace(finding.start, finding.end, '=')],
    };
    return suggestion('parser', file.parsesFixed(equals, id) ? [equals] : []);
}
