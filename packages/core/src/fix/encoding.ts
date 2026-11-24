/**
 * The fix of `style/not-utf8`: the file written as UTF-8 with the byte-order mark, each stretch
 * of its bytes that is not valid UTF-8 read as Windows-1252 (docs/encoding.md: the game's own
 * message for title history asks for "ansi", Windows' name for that code page on a Western
 * system). The edits are against the text as the checks read it: each line's stretches replaced
 * by their Windows-1252 letters (an unchanged replacement where the fallback already read them
 * so), and the mark written at the start where the file has none. Applied, the text is written
 * back as UTF-8, which is the conversion.
 *
 * **Safe** only when the outcome cannot be in doubt: every invalid byte reads as a printable
 * Windows-1252 character (none of the five bytes the code page leaves undefined, which read as
 * control characters, nor its soft hyphen), and the converted text parses to the same tree as
 * the text the checks read, node for node, apart from the decoded letters. Otherwise the same
 * edits are a suggestion: the bytes may have been written in another code page.
 */

import { parseLocalization } from '../index/localization.js';
import { parse } from '../syntax/parser.js';
import type { InvalidStretch } from '../syntax/findings.js';
import type { FileNode, Item, Value } from '../syntax/tree.js';
import { applyEdits } from './apply.js';
import type { FixFile } from './file.js';
import { safeFix, suggestion, type FindingFix, type FixEdit } from './fix.js';

/** A character that is no printable one: a control or a format character. */
const NOT_PRINTABLE = /[\p{Cc}\p{Cf}]/u;

/** True when every letter of the stretches is printable. */
export function printable(invalid: readonly InvalidStretch[]): boolean {
    return invalid.every((s) => !NOT_PRINTABLE.test(s.windows1252));
}

/** The edits that convert the file: one per line that holds stretches, and the mark. */
export function conversionEdits(file: FixFile, invalid: readonly InvalidStretch[]): FixEdit[] {
    const edits: FixEdit[] = [];
    if (!hasMark(file)) {
        edits.push(file.insert(0, '﻿'));
    }
    let group: InvalidStretch[] = [];
    const flush = (): void => {
        const first = group[0];
        const last = group[group.length - 1];
        if (first === undefined || last === undefined) {
            return;
        }
        let text = '';
        let at = first.start;
        for (const stretch of group) {
            text += file.slice(at, stretch.start) + stretch.windows1252;
            at = stretch.end;
        }
        edits.push(file.replace(first.start, last.end, text));
        group = [];
    };
    for (const stretch of invalid) {
        const previous = group[group.length - 1];
        if (
            previous !== undefined &&
            file.lines.positionAt(previous.end).line !== file.lines.positionAt(stretch.start).line
        ) {
            flush();
        }
        group.push(stretch);
    }
    flush();
    return edits;
}

function hasMark(file: FixFile): boolean {
    const source = file.input.source;
    return 'script' in source ? source.script.bom : source.localization.bom;
}

/** One node of a tree, as its shape and its span. */
type Shape = readonly [kind: string, type: string, start: number, end: number];

function shapesOf(tree: FileNode, map: (offset: number) => number): Shape[] {
    const out: Shape[] = [];
    const value = (v: Value | null): void => {
        if (v === null) {
            return;
        }
        if (v.kind === 'tagged') {
            out.push(['tagged', '', map(v.start), map(v.end)]);
            value(v.tag);
            value(v.body);
            return;
        }
        if (v.kind === 'block') {
            out.push(['block', '', map(v.start), map(v.end)]);
            v.items.forEach(item);
            return;
        }
        out.push([v.kind, v.kind === 'scalar' ? v.type : v.text, map(v.start), map(v.end)]);
    };
    const item = (i: Item): void => {
        if (i.kind === 'pair') {
            out.push(['pair', '', map(i.start), map(i.end)]);
            value(i.prefix);
            value(i.key);
            value(i.operator);
            value(i.value);
        } else if (i.kind === 'comment') {
            out.push(['comment', '', map(i.start), map(i.end)]);
        } else {
            value(i);
        }
    };
    tree.items.forEach(item);
    return out;
}

/**
 * True when `after`, the text with each stretch replaced by its letters, parses to the same tree
 * as `before`: the same nodes, of the same kinds, each over the span its text moved to, and
 * the same parse findings.
 */
export function sameTree(
    before: string,
    after: string,
    invalid: readonly InvalidStretch[],
): boolean {
    // Where an offset of `before` is in `after`: each stretch before it moved it by its growth.
    const map = (offset: number): number => {
        let shift = 0;
        for (const s of invalid) {
            if (s.end <= offset) {
                shift += s.windows1252.length - (s.end - s.start);
            }
        }
        return offset + shift;
    };
    const a = parse(before);
    const b = parse(after.charCodeAt(0) === 0xfeff ? after.slice(1) : after);
    const shapesA = shapesOf(a.file, map);
    const shapesB = shapesOf(b.file, (o) => o);
    if (shapesA.length !== shapesB.length) {
        return false;
    }
    if (!shapesA.every((s, i) => s.join('\u0000') === shapesB[i]?.join('\u0000'))) {
        return false;
    }
    const ids = (findings: readonly { id: string; start: number }[], m: (o: number) => number) =>
        findings.map((f) => `${f.id}@${String(m(f.start))}`).join(',');
    return ids(a.findings, map) === ids(b.findings, (o) => o);
}

/** True when a localization file's converted text holds the same headers and keys, in order. */
export function sameEntries(before: string, after: string): boolean {
    const keys = (text: string): string => {
        const read = parseLocalization(text);
        return [
            ...read.headers.map((h) => `h:${h.language}`),
            ...read.entries.map((e) => `e:${e.key}`),
            `u:${String(read.unread.length)}`,
        ].join('\u0000');
    };
    return keys(before) === keys(after);
}

/** The fix of a file that is not valid UTF-8. */
export function notUtf8Fix(file: FixFile): FindingFix | null {
    const invalid = file.input.invalid ?? [];
    if (invalid.length === 0) {
        return null;
    }
    const edits = conversionEdits(file, invalid);
    const alternative = {
        title: 'Convert the file to UTF-8 with a byte-order mark, its other bytes read as Windows-1252',
        edits,
    };
    const converted = applyEdits(file.text, edits);
    const same =
        'script' in file.input.source
            ? sameTree(file.text, converted, invalid)
            : sameEntries(file.text, converted);
    return printable(invalid) && same
        ? safeFix('windows-1252', alternative)
        : suggestion('windows-1252', [alternative]);
}
