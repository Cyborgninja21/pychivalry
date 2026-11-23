/**
 * Applying fix data to text: what the command line's `check --fix` does to the files on disk,
 * what the tests do to prove a fix, and what an editor does with the same edits. A fix's edits
 * are places in a file's text without its byte-order mark (docs/encoding.md); the mark is kept
 * as it was.
 */

import { LineIndex } from '../syntax/position.js';
import { overlapsAny, type FixAlternative, type FixEdit } from './fix.js';

/**
 * A text with edits applied: each edit's range read against the text as it was, the edits
 * applied from the last to the first. Two edits of the text must not overlap; insertions at
 * one place keep the order they are given in.
 */
export function applyEdits(text: string, edits: readonly FixEdit[]): string {
    const lines = new LineIndex(text);
    const placed = edits.map((edit, order) => ({
        start: lines.offsetAt(edit.range.start),
        end: lines.offsetAt(edit.range.end),
        text: edit.new_text,
        order,
    }));
    placed.sort((a, b) => b.start - a.start || b.end - a.end || b.order - a.order);
    let out = text;
    let limit = Number.POSITIVE_INFINITY;
    for (const edit of placed) {
        if (edit.end > limit) {
            throw new Error('applyEdits: two edits of the text overlap');
        }
        out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
        limit = edit.start;
    }
    return out;
}

/** The text of a file, as `applyFixes` reads and writes it: its byte-order mark apart. */
export interface FileText {
    readonly text: string;
    readonly bom: boolean;
}

/** A file's text with its byte-order mark, if any, apart. */
export function splitBom(source: string): FileText {
    return source.charCodeAt(0) === 0xfeff
        ? { text: source.slice(1), bom: true }
        : { text: source, bom: false };
}

/** A file's text as it is written: the byte-order mark back in front when it had one. */
export function joinBom(file: FileText): string {
    return file.bom ? `\ufeff${file.text}` : file.text;
}

/**
 * Alternatives applied to a set of files: each alternative whose edits overlap none of those
 * taken before it is taken, the others are left (`skipped`). `read` gives a file's text as it
 * is now, or null when there is no such file; a file an edit creates is given its text whole.
 * Returns the new text of every file changed or created, and the alternatives taken.
 */
export function applyFixes(
    alternatives: readonly FixAlternative[],
    read: (file: string) => string | null,
): {
    readonly files: ReadonlyMap<string, string>;
    readonly taken: readonly FixAlternative[];
    readonly skipped: readonly FixAlternative[];
} {
    const takenEdits: FixEdit[] = [];
    const taken: FixAlternative[] = [];
    const skipped: FixAlternative[] = [];
    const created = new Set<string>();
    for (const alternative of alternatives) {
        const createsTaken = alternative.edits.some(
            (e) => e.create === true && (created.has(e.file) || read(e.file) !== null),
        );
        if (createsTaken || overlapsAny(alternative, takenEdits)) {
            skipped.push(alternative);
            continue;
        }
        for (const edit of alternative.edits) {
            if (edit.create === true) {
                created.add(edit.file);
            }
        }
        takenEdits.push(...alternative.edits);
        taken.push(alternative);
    }
    const byFile = new Map<string, FixEdit[]>();
    for (const edit of takenEdits) {
        byFile.set(edit.file, [...(byFile.get(edit.file) ?? []), edit]);
    }
    const files = new Map<string, string>();
    for (const [file, edits] of byFile) {
        const creating = edits.filter((e) => e.create === true);
        if (creating.length > 0) {
            const whole = creating.map((e) => e.new_text).join('');
            const rest = edits.filter((e) => e.create !== true);
            const split = splitBom(whole);
            files.set(file, joinBom({ ...split, text: applyEdits(split.text, rest) }));
            continue;
        }
        const source = read(file);
        if (source === null) {
            throw new Error(`applyFixes: ${file} does not exist and no edit creates it`);
        }
        const split = splitBom(source);
        files.set(file, joinBom({ ...split, text: applyEdits(split.text, edits) }));
    }
    return { files, taken, skipped };
}
