/**
 * The order files are read in, when the rules table has a `file-order` row (docs/overrides.md,
 * rule 4, open until the spec work reads it out of the executable). Without such a row the
 * index never orders two files, and a rule that needs the order names no winner.
 */

import type { FileOrderRule, LayerName } from './rules.js';
import { foldCase, segmentsOf } from './paths.js';

/** The rule's name for a file's layer: `dlc:<pack>` is `dlc`. */
export function layerKind(layer: string): LayerName | undefined {
    if (layer.startsWith('dlc:')) {
        return 'dlc';
    }
    return layer === 'clausewitz' || layer === 'jomini' || layer === 'game' || layer === 'mod'
        ? layer
        : undefined;
}

/** Whether a row's layer name covers a file's layer. */
export function layerMatches(rule: LayerName, layer: string): boolean {
    return layerKind(layer) === rule;
}

/** Compare two strings by their Unicode code points: the order of their UTF-8 bytes. */
export function compareCodePoints(a: string, b: string): number {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const x = a.codePointAt(i) ?? 0;
        const y = b.codePointAt(i) ?? 0;
        if (x !== y) {
            return x - y;
        }
        if (x > 0xffff) {
            i++;
        }
    }
    return a.length - b.length;
}

function compareText(a: string, b: string, rule: FileOrderRule): number {
    return rule.compare === 'bytes'
        ? compareCodePoints(a, b)
        : compareCodePoints(foldCase(a), foldCase(b));
}

/**
 * Compare two relative paths as the rule orders them. Format 9's `compare_unit` says what the
 * row's `compare` is applied to: `component`, one path component at a time (a file name, or a
 * folder name), never the whole path; without it, a `by-path` row compares the whole path.
 */
export function comparePathsByRule(a: string, b: string, rule: FileOrderRule): number {
    if (rule.subfolders === 'by-path' && rule.compare_unit !== 'component') {
        return compareText(a, b, rule);
    }
    const x = segmentsOf(a);
    const y = segmentsOf(b);
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
        const p = x[i] ?? '';
        const q = y[i] ?? '';
        const pFile = i === x.length - 1;
        const qFile = i === y.length - 1;
        if (pFile !== qFile && rule.subfolders !== 'by-path') {
            // One is a file of this folder, the other lies in a subfolder.
            const fileFirst = rule.subfolders === 'files-first';
            return pFile === fileFirst ? -1 : 1;
        }
        const c = compareText(p, q, rule);
        if (c !== 0) {
            return c;
        }
    }
    return x.length - y.length;
}

/**
 * Compare two files, each a layer and a relative path, as the rule reads them: a negative
 * number when `a` is read first. Undefined when the rule does not order them: a layer it does
 * not list, or the same path in two layers with no order between them.
 */
export function compareFiles(
    a: { readonly layer: string; readonly path: string },
    b: { readonly layer: string; readonly path: string },
    rule: FileOrderRule,
): number | undefined {
    const rank = (layer: string): number => {
        const kind = layerKind(layer);
        return kind === undefined ? -1 : rule.layer_order.indexOf(kind);
    };
    const ra = rank(a.layer);
    const rb = rank(b.layer);
    if (ra < 0 || rb < 0) {
        return undefined;
    }
    if (rule.layers === 'in-order' && ra !== rb) {
        return ra - rb;
    }
    const c = comparePathsByRule(a.path, b.path, rule);
    if (c !== 0) {
        return c;
    }
    if (ra !== rb) {
        return ra - rb;
    }
    // Two packs, or one layer twice: the rule gives no order between them.
    return a.layer === b.layer ? 0 : undefined;
}

/**
 * Definitions sorted in the order a `file-order` row reads their files, and by place within a
 * file (`start`); undefined when the row leaves two of them unordered: a layer it does not
 * list, or one path in two layers it does not order (`compareFiles`).
 *
 * `compareFiles` orders files by layer rank and path, one after the other (which first, the
 * row's `layers` says). It leaves a pair unordered only when one of the two is in a layer the
 * row does not list, or when both have the same rank and the same path in two layers. So a pool
 * with a layer the row does not list is unordered, which comparing each definition with itself
 * finds; otherwise the files of one rank and path sort next to each other, and the pool is
 * unordered exactly when two neighbours of the sorted pool are. That is n log n comparisons
 * where comparing every pair is n squared, and a check resolves a name once per definition: a
 * name defined in 300 files took the check 7.5 seconds that way. `compareWith` is
 * `compareFiles`; a test gives one that counts the comparisons.
 */
export function sortByOrder<
    T extends { readonly layer: string; readonly file: string; readonly start: number },
>(
    pool: readonly T[],
    order: FileOrderRule,
    compareWith: typeof compareFiles = compareFiles,
): T[] | undefined {
    const compare = (a: T, b: T): number | undefined =>
        compareWith({ layer: a.layer, path: a.file }, { layer: b.layer, path: b.file }, order);
    if (pool.length > 1 && pool.some((d) => compare(d, d) === undefined)) {
        return undefined;
    }
    const sorted = [...pool].sort((a, b) => (compare(a, b) ?? 0) || a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
        if (compare(sorted[i - 1] as T, sorted[i] as T) === undefined) {
            return undefined;
        }
    }
    return sorted;
}
