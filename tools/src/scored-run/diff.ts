/**
 * A line diff of two versions of a file, for the graders: which lines of the first are kept
 * unchanged in the second, which are removed (a changed line is removed and added), and where
 * lines are added. It keeps the longest common subsequence of the two lists of lines; where
 * several are as long, it keeps a line as early as it can and removes before it adds, so the
 * same edit always gives the same answer.
 */

/** One version of a file against another. Lines are counted from 1. */
export interface LineDiff {
    /** For each line of the old version, the line of the new one it is kept as, or 0. */
    readonly keptAs: readonly number[];
    /** The lines of the old version not kept. */
    readonly removed: readonly number[];
    /**
     * Each line added to the new version, by the old line it follows (0: before the first);
     * `line` is its number in the new version.
     */
    readonly added: readonly { readonly after: number; readonly line: number }[];
    /**
     * The changes, each a run of lines removed and lines added between two kept lines, in
     * order: the old version's lines removed and the new version's lines added.
     */
    readonly hunks: readonly {
        readonly removed: readonly number[];
        readonly added: readonly number[];
    }[];
}

/** The diff from `before` to `after`, both lists of lines. */
export function lineDiff(before: readonly string[], after: readonly string[]): LineDiff {
    const n = before.length;
    const m = after.length;
    // lcs[i][j]: the longest common subsequence of before[i..] and after[j..].
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        const row = lcs[i] as number[];
        const next = lcs[i + 1] as number[];
        for (let j = m - 1; j >= 0; j--) {
            row[j] =
                before[i] === after[j]
                    ? (next[j + 1] as number) + 1
                    : Math.max(next[j] as number, row[j + 1] as number);
        }
    }
    const keptAs = new Array<number>(n).fill(0);
    const removed: number[] = [];
    const added: { after: number; line: number }[] = [];
    const hunks: { removed: number[]; added: number[] }[] = [];
    let hunk: { removed: number[]; added: number[] } | null = null;
    const open = (): { removed: number[]; added: number[] } => {
        if (hunk === null) {
            hunk = { removed: [], added: [] };
            hunks.push(hunk);
        }
        return hunk;
    };
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
        const here = i < n && j < m ? ((lcs[i] as number[])[j] as number) : 0;
        if (i < n && j < m && before[i] === after[j]) {
            keptAs[i] = j + 1;
            hunk = null;
            i++;
            j++;
        } else if (i < n && (j === m || ((lcs[i + 1] as number[])[j] as number) === here)) {
            removed.push(i + 1);
            open().removed.push(i + 1);
            i++;
        } else {
            added.push({ after: i, line: j + 1 });
            open().added.push(j + 1);
            j++;
        }
    }
    return { keptAs, removed, added, hunks };
}
