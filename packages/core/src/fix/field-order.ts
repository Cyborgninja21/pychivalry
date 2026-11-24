/**
 * The fix of `style/unusual-field-order`: the record's fields written in the usual order of its
 * folder (the finding's `order`), each copy of a field written more than once kept in the
 * order of its copies, the fields the order does not name kept in their places. The check has
 * already shown the record is one whose fields the game reads by name (`fieldsReadByName`).
 *
 * - **Comments travel with their field:** a comment at the end of a field's last line is that
 *   field's; a run of comments on lines of their own directly above a field, with no blank
 *   line between, is that field's. A comment whose field is not clear (one followed by a blank
 *   line, one after the last field) means no fix is offered. A comment on the line of the
 *   record's `{` stays there.
 * - **Small:** of the fields, those that keep their relative order and are largest stay where
 *   they are (a longest increasing run, weighted by size); only the others are moved, each as
 *   its whole lines (its comments and line break with it), so a large block is moved only when
 *   it must be.
 * - **Layouts:** a record whose fields each have lines of their own, or one written on a single
 *   line; a record that mixes the two is left without a fix.
 *
 * It is safe: the order has no meaning to the game in such a record, and the outcome is the one
 * order the data gives; the core checks it by checking the file again (`verify.ts`).
 */

import type { Block, Comment, Item, Pair } from '../syntax/tree.js';
import { blockOf } from '../syntax/tree.js';
import { dataList, dataText, type FixableFinding, type FixFile } from './file.js';
import { safeFix, type FindingFix, type FixEdit } from './fix.js';

/** A field of the record with the span it moves as: its lines, comments and line break. */
interface Unit {
    readonly pair: Pair;
    /** Where its text starts and ends: its leading comments to its trailing one. */
    readonly start: number;
    readonly end: number;
    /** Its whole lines: from its first line's start to the start of the line after its last. */
    readonly lineStart: number;
    readonly lineEnd: number;
}

/** The record whose body holds `offset`: a top-level pair with a block. */
function recordAt(file: FixFile, offset: number): Block | undefined {
    for (const item of file.tree?.items ?? []) {
        if (item.kind === 'pair' && item.start <= offset && offset < item.end) {
            return blockOf(item.value);
        }
    }
    return undefined;
}

/** The line an offset is on. */
function lineOf(file: FixFile, offset: number): number {
    return file.lines.positionAt(offset).line;
}

/** The line of the last character of a span. */
function lastLineOf(file: FixFile, span: { readonly start: number; readonly end: number }): number {
    return lineOf(file, Math.max(span.start, span.end - 1));
}

/** True when the text between two offsets holds a blank line. */
function blankBetween(file: FixFile, from: number, to: number): boolean {
    return /\n[ \t]*\r?\n/.test(file.slice(from, to));
}

/**
 * Each field's span with the comments it owns, or null when a comment's owner is not clear.
 * The body's items are pairs and comments only (the check judged it so).
 */
function unitSpans(
    file: FixFile,
    body: Block,
): { pair: Pair; start: number; end: number }[] | null {
    const openLine = lineOf(file, body.start);
    const out: { pair: Pair; start: number; end: number }[] = [];
    let leading: Comment[] = [];
    let previous: { pair: Pair; start: number; end: number } | undefined;
    for (const item of body.items) {
        if (item.kind === 'comment') {
            if (lineOf(file, item.start) === openLine && previous === undefined) {
                continue;
            }
            if (
                previous !== undefined &&
                leading.length === 0 &&
                lineOf(file, item.start) === lastLineOf(file, previous)
            ) {
                previous.end = item.end;
                continue;
            }
            const before = leading[leading.length - 1]?.end ?? previous?.end ?? body.start + 1;
            if (leading.length > 0 && blankBetween(file, before, item.start)) {
                return null;
            }
            leading.push(item);
            continue;
        }
        if (item.kind !== 'pair') {
            return null;
        }
        const first = leading[0];
        if (first !== undefined) {
            const last = leading[leading.length - 1] ?? first;
            if (blankBetween(file, last.end, item.start)) {
                return null;
            }
        }
        previous = { pair: item, start: first?.start ?? item.start, end: item.end };
        out.push(previous);
        leading = [];
    }
    // A comment after the last field has no clear owner.
    return leading.length > 0 ? null : out;
}

/** The units of a body whose fields each have lines of their own, or null when they do not. */
function lineUnits(file: FixFile, body: Block): Unit[] | null {
    const spans = unitSpans(file, body);
    if (spans === null) {
        return null;
    }
    const openLine = lineOf(file, body.start);
    const closeLine = lastLineOf(file, body);
    const units: Unit[] = [];
    let lastLine = openLine;
    for (const span of spans) {
        const first = lineOf(file, span.start);
        const last = lastLineOf(file, span);
        const lineStart = file.lines.lineStarts[first] ?? 0;
        const lineEnd = file.lines.lineStarts[last + 1];
        if (
            first <= lastLine ||
            last >= closeLine ||
            lineEnd === undefined ||
            file.slice(lineStart, span.start).trim() !== '' ||
            file.slice(span.end, lineEnd).trim() !== ''
        ) {
            return null;
        }
        units.push({ ...span, lineStart, lineEnd });
        lastLine = last;
    }
    return units;
}

/**
 * The order the fields are written in after the fix, as indices into `pairs`: the fields the
 * order names fill their places sorted by it, each field's copies in their order; the others
 * stay.
 */
export function targetOrder(pairs: readonly Pair[], order: readonly string[]): number[] {
    const rank = (i: number): number => order.indexOf(pairs[i]?.key.text ?? '');
    const named = pairs.map((_, i) => i).filter((i) => rank(i) >= 0);
    const sorted = [...named].sort((a, b) => rank(a) - rank(b) || a - b);
    let next = 0;
    return pairs.map((_, i) => (rank(i) >= 0 ? (sorted[next++] ?? i) : i));
}

/**
 * Which fields stay: the largest set, by size, whose relative order the fix keeps (a longest
 * increasing run of their places after the fix, weighted by their size).
 */
export function staying(target: readonly number[], sizes: readonly number[]): Set<number> {
    // place[i]: where field i is written after the fix.
    const place: number[] = [];
    target.forEach((field, at) => {
        place[field] = at;
    });
    const n = target.length;
    const best: number[] = [];
    const from: number[] = [];
    for (let i = 0; i < n; i++) {
        best[i] = sizes[i] ?? 0;
        from[i] = -1;
        for (let j = 0; j < i; j++) {
            if (
                (place[j] ?? 0) < (place[i] ?? 0) &&
                (best[j] ?? 0) + (sizes[i] ?? 0) > (best[i] ?? 0)
            ) {
                best[i] = (best[j] ?? 0) + (sizes[i] ?? 0);
                from[i] = j;
            }
        }
    }
    let end = 0;
    for (let i = 1; i < n; i++) {
        if ((best[i] ?? 0) > (best[end] ?? 0)) {
            end = i;
        }
    }
    const kept = new Set<number>();
    for (let i = n > 0 ? end : -1; i >= 0; i = from[i] ?? -1) {
        kept.add(i);
    }
    return kept;
}

/** The edits that move the fields of a body laid out a field to a line. */
function lineEdits(file: FixFile, units: readonly Unit[], target: readonly number[]): FixEdit[] {
    const kept = staying(
        target,
        units.map((u) => u.lineEnd - u.lineStart),
    );
    const edits: FixEdit[] = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit !== undefined && !kept.has(i)) {
            edits.push(file.replace(unit.lineStart, unit.lineEnd, ''));
        }
    }
    target.forEach((field, at) => {
        const unit = units[field];
        if (unit === undefined || kept.has(field)) {
            return;
        }
        // Before the next field that stays, or after the last one before it.
        const after = target.slice(at + 1).find((f) => kept.has(f));
        const before = [...target.slice(0, at)].reverse().find((f) => kept.has(f));
        const place =
            after !== undefined
                ? units[after]?.lineStart
                : before !== undefined
                  ? units[before]?.lineEnd
                  : undefined;
        if (place !== undefined) {
            edits.push(file.insert(place, file.slice(unit.lineStart, unit.lineEnd)));
        }
    });
    return edits;
}

/** The edit that rewrites a body written on one line, its separators kept. */
function oneLineEdit(
    file: FixFile,
    pairs: readonly Pair[],
    target: readonly number[],
): FixEdit | null {
    const first = pairs[0];
    const last = pairs[pairs.length - 1];
    if (first === undefined || last === undefined) {
        return null;
    }
    let text = '';
    target.forEach((field, at) => {
        const pair = pairs[field];
        const next = pairs[at + 1];
        const here = pairs[at];
        if (pair === undefined || here === undefined) {
            return;
        }
        text += file.slice(pair.start, pair.end);
        if (next !== undefined) {
            text += file.slice(here.end, next.start);
        }
    });
    return file.replace(first.start, last.end, text);
}

/** The fix of a record whose fields are written in an unusual order. */
export function unusualFieldOrderFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const body = recordAt(file, finding.start);
    const order = dataList(finding.data, 'order');
    if (body === undefined || order.length < 2) {
        return null;
    }
    const items: readonly Item[] = body.items;
    const pairs = items.filter((i): i is Pair => i.kind === 'pair');
    if (pairs.length !== items.filter((i) => i.kind !== 'comment').length) {
        return null;
    }
    const target = targetOrder(pairs, order);
    if (target.every((field, at) => field === at)) {
        return null;
    }
    const openLine = lineOf(file, body.start);
    const oneLine = lastLineOf(file, body) === openLine && items.every((i) => i.kind !== 'comment');
    let edits: FixEdit[];
    if (oneLine) {
        const edit = oneLineEdit(file, pairs, target);
        if (edit === null) {
            return null;
        }
        edits = [edit];
    } else {
        const units = lineUnits(file, body);
        if (units === null || units.length !== pairs.length) {
            return null;
        }
        edits = lineEdits(file, units, target);
    }
    const record = dataText(finding.data, 'record') ?? '';
    return safeFix('field-order', {
        title: `Write the fields of '${record}' in the usual order: ${order.join(', ')}`,
        edits,
    });
}
