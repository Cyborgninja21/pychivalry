/**
 * Paths inside a mod or the game (docs/PLAN.md items 3.6a and 3.10). A file is known by its
 * path relative to its layer's folder, written with `/` on every system. A file is classified
 * by that path, matching whole folder names: `events_old/` is not `events/`, and a mod kept in
 * a folder named `viet-events` does not make its files events, because the folder above the
 * mod is never part of the path. Lookups never assume one letter case: every table here is
 * keyed by the folded path, and says whether the case matched exactly. A file's address on
 * disk is built with the platform's own path functions, never by joining strings.
 */

import path from 'node:path';

/**
 * A path folded for comparisons that ignore letter case. Lower case, as Unicode defines it;
 * whether the game compares paths this way is open (docs/overrides.md, rule 9), so this is
 * only how pychivalry finds files.
 */
export function foldCase(text: string): string {
    return text.toLowerCase();
}

/** The `/`-separated segments of a relative path; empty segments are dropped. */
export function segmentsOf(relative: string): string[] {
    return relative.split('/').filter((segment) => segment !== '');
}

/**
 * Whether `relative` lies inside `folder`, matching whole folder names: `common/traits`
 * holds `common/traits/x.txt` and `common/traits/sub/y.txt`, never `common/traits_old/x.txt`.
 * With `ignoreCase` the comparison folds letter case.
 */
export function isWithin(relative: string, folder: string, ignoreCase = false): boolean {
    const file = ignoreCase ? foldCase(relative) : relative;
    const dir = ignoreCase ? foldCase(folder) : folder;
    return file.startsWith(`${dir}/`);
}

/** The path of `full` relative to `base`, with `/`, built with the platform's functions. */
export function relativePath(base: string, full: string): string {
    return path.relative(base, full).split(path.sep).join('/');
}

/** The address on disk of `relative` inside `base`, built with the platform's functions. */
export function diskPath(base: string, relative: string): string {
    return path.join(base, ...segmentsOf(relative));
}

/** The folder part of a relative path (`''` for a file at the top). */
export function parentOf(relative: string): string {
    const at = relative.lastIndexOf('/');
    return at < 0 ? '' : relative.slice(0, at);
}

/** The file name of a relative path. */
export function fileNameOf(relative: string): string {
    return relative.slice(relative.lastIndexOf('/') + 1);
}

/** The extension of a relative path, lower case, with its dot (`''` when there is none). */
export function extensionOf(relative: string): string {
    const name = fileNameOf(relative);
    const at = name.lastIndexOf('.');
    return at <= 0 ? '' : foldCase(name.slice(at));
}

/**
 * Values keyed by a path, found without regard to letter case. Each entry keeps the path as
 * it was written, so a caller can tell an exact match from one that differs only in case.
 */
export class PathTable<T> {
    private readonly entries = new Map<string, { path: string; value: T }[]>();

    /** Add a value under a path; several values may share one folded path. */
    add(relative: string, value: T): void {
        const key = foldCase(relative);
        const list = this.entries.get(key);
        if (list === undefined) {
            this.entries.set(key, [{ path: relative, value }]);
        } else {
            list.push({ path: relative, value });
        }
    }

    /** Remove the value under a path, by identity; true when it was there. */
    remove(relative: string, value: T): boolean {
        const key = foldCase(relative);
        const list = this.entries.get(key);
        const at = list?.findIndex((entry) => entry.value === value) ?? -1;
        if (list === undefined || at < 0) {
            return false;
        }
        list.splice(at, 1);
        if (list.length === 0) {
            this.entries.delete(key);
        }
        return true;
    }

    /** Every value whose path equals `relative` without regard to case, with its own path. */
    find(relative: string): readonly { readonly path: string; readonly value: T }[] {
        return this.entries.get(foldCase(relative)) ?? [];
    }

    /** Every group of values that share a folded path. */
    groups(): IterableIterator<readonly { readonly path: string; readonly value: T }[]> {
        return this.entries.values();
    }
}
