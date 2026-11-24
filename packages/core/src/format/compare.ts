/**
 * What the formatter guarantees, as a comparison of a text before and after formatting
 * (docs/formatting.md, "What the formatter guarantees"), for the round-trip suite on the base
 * game and the tests:
 *
 * - **Script: the same tree.** Both texts are parsed and their trees compared without offsets:
 *   the same items in the same order and nesting, of the same kinds; each scalar with the same
 *   type, text, value, closing and scope-chain segments; each pair with the same name before
 *   its key, key, operator (its text, and whether it is a `$PARAM$`) and value; each tagged
 *   value with the same tag and body; each block closed or not alike; each comment with the same
 *   text but for the spaces and tabs at its end. Then the same tokens, in order, of the same
 *   kinds and texts (comments compared as above), and the same parse findings, by kind and the
 *   values they name (their places move).
 * - **Localization: the same reading.** Both texts are read by the index's localization reader
 *   and compared: the same headers in order, the same entries in order (key, version, language,
 *   text between the quotes, closed or not), the same lines it does not read, and the same
 *   comments, each but for the whitespace around it.
 * - **Comments counted** before and after: none lost, none added; and each in its place: the same
 *   tokens before and after it (the tokens are the same), and on a line of its own exactly when
 *   it was, so a comment at the end of a line of code stays at the end of the line of the token
 *   it follows.
 */

import { parseLocalization } from '../index/localization.js';
import { tokenize, type Token } from '../syntax/lexer.js';
import { parse } from '../syntax/parser.js';
import type { Block, Item, Scalar, Value } from '../syntax/tree.js';
import type { FormatKind } from './result.js';
import { trimComment } from './script.js';

export interface FormatComparison {
    /** The trees (script) or the readings (localization) are the same. */
    readonly sameTree: boolean;
    /** The tokens are the same (script); for localization, the lines read the same. */
    readonly sameTokens: boolean;
    readonly commentsBefore: number;
    readonly commentsAfter: number;
    /** Comments that moved: to or from a line of their own, or among other tokens. */
    readonly commentsMoved: number;
    /** The first difference, described, or null when there is none. */
    readonly difference: string | null;
}

function sameList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
    if (a === undefined || b === undefined) {
        return a === b;
    }
    return a.length === b.length && a.every((x, i) => x === b[i]);
}

function scalarDifference(a: Scalar, b: Scalar): string | null {
    if (a.type !== b.type) {
        return `a ${a.type} became a ${b.type}`;
    }
    if (a.text !== b.text || a.value !== b.value) {
        return `${JSON.stringify(a.text)} became ${JSON.stringify(b.text)}`;
    }
    if (a.terminated !== b.terminated) {
        return `${JSON.stringify(a.text)} changed whether it is closed`;
    }
    if (!sameList(a.segments, b.segments)) {
        return `${JSON.stringify(a.text)} has other chain segments`;
    }
    return null;
}

/** Compare two values; blocks are pushed to `stack` to be compared in turn. */
function valueDifference(
    a: Value,
    b: Value,
    stack: [readonly Item[], readonly Item[], string][],
    where: string,
): string | null {
    if (a.kind !== b.kind) {
        return `${where}: a ${a.kind} became a ${b.kind}`;
    }
    switch (a.kind) {
        case 'scalar':
            return scalarDifference(a, b as Scalar);
        case 'operator': {
            const o = b as typeof a;
            return a.text === o.text && a.parameter === o.parameter
                ? null
                : `${where}: the operator ${a.text} became ${o.text}`;
        }
        case 'block': {
            const blockB = b as Block;
            if (a.closed !== blockB.closed) {
                return `${where}: a block changed whether it is closed`;
            }
            stack.push([a.items, blockB.items, `${where} { }`]);
            return null;
        }
        case 'tagged': {
            const t = b as typeof a;
            const tag = scalarDifference(a.tag, t.tag);
            if (tag !== null) {
                return `${where}: ${tag}`;
            }
            return valueDifference(a.body, t.body, stack, `${where} ${a.tag.text}`);
        }
    }
}

function itemDifference(
    a: Item,
    b: Item,
    stack: [readonly Item[], readonly Item[], string][],
    where: string,
): string | null {
    if (a.kind !== b.kind) {
        return `${where}: a ${a.kind} became a ${b.kind}`;
    }
    if (a.kind === 'comment') {
        const c = b as typeof a;
        return trimComment(a.text) === trimComment(c.text)
            ? null
            : `${where}: the comment ${JSON.stringify(a.text)} became ${JSON.stringify(c.text)}`;
    }
    if (a.kind !== 'pair') {
        return valueDifference(a, b as Scalar | Block, stack, where);
    }
    const p = b as typeof a;
    const at = `${where} ${a.key.text}`;
    if ((a.prefix === null) !== (p.prefix === null)) {
        return `${at}: the name before the key changed`;
    }
    if (a.prefix !== null && p.prefix !== null) {
        const prefix = scalarDifference(a.prefix, p.prefix);
        if (prefix !== null) {
            return `${at}: ${prefix}`;
        }
    }
    const key = scalarDifference(a.key, p.key);
    if (key !== null) {
        return `${at}: ${key}`;
    }
    if (
        (a.operator === null) !== (p.operator === null) ||
        (a.operator !== null &&
            p.operator !== null &&
            (a.operator.text !== p.operator.text || a.operator.parameter !== p.operator.parameter))
    ) {
        return `${at}: the operator changed`;
    }
    if (a.value === null || p.value === null) {
        return a.value === p.value ? null : `${at}: the value changed`;
    }
    return valueDifference(a.value, p.value, stack, at);
}

/** The first difference between two trees' items, compared without offsets, or null. */
export function treeDifference(a: readonly Item[], b: readonly Item[]): string | null {
    const stack: [readonly Item[], readonly Item[], string][] = [[a, b, 'the file']];
    for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
        const [left, right, where] = next;
        if (left.length !== right.length) {
            return `${where}: ${String(left.length)} items became ${String(right.length)}`;
        }
        for (let i = 0; i < left.length; i++) {
            const difference = itemDifference(
                left[i] as Item,
                right[i] as Item,
                stack,
                `${where}, item ${String(i + 1)}`,
            );
            if (difference !== null) {
                return difference;
            }
        }
    }
    return null;
}

/** A token as compared: its kind and text, a comment's without its trailing blanks. */
function tokenKey(text: string, token: Token): string {
    const source = text.slice(token.start, token.end);
    switch (token.kind) {
        case 'comment':
            return `comment ${trimComment(source)}`;
        case 'word':
            return `word ${token.type} ${source}`;
        case 'string':
        case 'arithmetic':
            return `${token.kind} ${String(token.terminated)} ${source}`;
        default:
            return `${token.kind} ${source}`;
    }
}

function compareScript(before: string, after: string): FormatComparison {
    const a = parse(before);
    const b = parse(after);
    const ta = tokenize(a.text);
    const tb = tokenize(b.text);
    const comments = (tokens: readonly Token[]): number =>
        tokens.filter((t) => t.kind === 'comment').length;
    let difference = treeDifference(a.file.items, b.file.items);
    const sameTree = difference === null;
    let sameTokens = ta.length === tb.length;
    if (sameTokens) {
        for (let i = 0; i < ta.length; i++) {
            const ka = tokenKey(a.text, ta[i] as Token);
            const kb = tokenKey(b.text, tb[i] as Token);
            if (ka !== kb) {
                sameTokens = false;
                difference ??= `token ${String(i + 1)}: ${JSON.stringify(ka)} became ${JSON.stringify(kb)}`;
                break;
            }
        }
    } else {
        difference ??= `${String(ta.length)} tokens became ${String(tb.length)}`;
    }
    // A comment's place: the same tokens around it, and alone on its line or not, as before.
    let commentsMoved = 0;
    if (sameTokens) {
        const alone = (text: string, tokens: readonly Token[], i: number): boolean => {
            const before = tokens[i - 1];
            return before === undefined || /[\r\n]/.test(text.slice(before.end, tokens[i]?.start));
        };
        for (let i = 0; i < ta.length; i++) {
            if (ta[i]?.kind === 'comment' && alone(a.text, ta, i) !== alone(b.text, tb, i)) {
                commentsMoved++;
            }
        }
    } else {
        commentsMoved = Math.abs(comments(ta) - comments(tb)) + 1;
    }
    if (commentsMoved > 0) {
        difference ??= `${String(commentsMoved)} comments moved`;
    }
    const findings = (r: typeof a): string[] =>
        r.findings.map((f) => `${f.id} ${f.args.join(' ')}`);
    if (!sameList(findings(a), findings(b))) {
        difference ??= 'the parse findings changed';
    }
    return {
        sameTree: sameTree && sameList(findings(a), findings(b)),
        sameTokens,
        commentsBefore: comments(ta),
        commentsAfter: comments(tb),
        commentsMoved,
        difference,
    };
}

function compareLocalization(before: string, after: string): FormatComparison {
    const read = (source: string): { lines: string[]; comments: string[] } => {
        const file = parseLocalization(source);
        const lines: string[] = [];
        for (const h of file.headers) {
            lines.push(`header ${h.language}`);
        }
        for (const e of file.entries) {
            lines.push(
                `entry ${e.key} ${String(e.version)} ${String(e.language)} ${String(e.terminated)} ${file.text.slice(e.textStart, e.textEnd)}`,
            );
        }
        for (const at of file.unread) {
            const end = file.text.slice(at).search(/[\r\n]|$/);
            lines.push(`unread ${file.text.slice(at, at + end)}`);
        }
        const comments = file.text
            .split(/\r\n|\r|\n/)
            .map((l) => l.trim())
            .filter((l) => l.startsWith('#'));
        return { lines, comments };
    };
    const a = read(before);
    const b = read(after);
    let difference: string | null = null;
    const sameTree = sameList(a.lines, b.lines);
    if (!sameTree) {
        const i = a.lines.findIndex((l, k) => l !== b.lines[k]);
        difference = `${JSON.stringify(a.lines[i] ?? null)} became ${JSON.stringify(b.lines[i] ?? null)}`;
    }
    const sameComments = sameList(a.comments, b.comments);
    if (!sameComments) {
        difference ??= 'the comments changed';
    }
    return {
        sameTree,
        sameTokens: sameComments,
        commentsBefore: a.comments.length,
        commentsAfter: b.comments.length,
        commentsMoved: sameComments ? 0 : 1,
        difference,
    };
}

/** Compare a text before and after formatting, by what the formatter guarantees. */
export function compareFormatted(
    before: string,
    after: string,
    kind: FormatKind,
): FormatComparison {
    return kind === 'script' ? compareScript(before, after) : compareLocalization(before, after);
}
