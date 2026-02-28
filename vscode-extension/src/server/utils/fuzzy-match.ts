/**
 * Fuzzy string matching utilities
 *
 * Provides Levenshtein distance and similarity helpers used by
 * localization validation, log analysis, and concept/icon lookup.
 */

/**
 * Compute the Levenshtein edit distance between two strings.
 * Uses the two-row optimisation (O(min(m,n)) space).
 */
export function levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Ensure `a` is the shorter string for space efficiency
    if (a.length > b.length) {
        [a, b] = [b, a];
    }

    const aLen = a.length;
    const bLen = b.length;
    let prev = new Array<number>(aLen + 1);
    let curr = new Array<number>(aLen + 1);

    for (let i = 0; i <= aLen; i++) {
        prev[i] = i;
    }

    for (let j = 1; j <= bLen; j++) {
        curr[0] = j;
        for (let i = 1; i <= aLen; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[i] = Math.min(
                curr[i - 1] + 1,      // insertion
                prev[i] + 1,          // deletion
                prev[i - 1] + cost,   // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }

    return prev[aLen];
}

/**
 * Compute a similarity ratio between two strings (0.0 – 1.0).
 * Returns 1.0 for identical strings, 0.0 for completely different strings.
 */
export function similarityRatio(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    return 1.0 - levenshteinDistance(a, b) / maxLen;
}

export interface FindSimilarOptions {
    /** Minimum similarity ratio to include (default: 0.6) */
    threshold?: number;
    /** Maximum number of results to return (default: 5) */
    max?: number;
    /** Case-insensitive comparison (default: true) */
    ignoreCase?: boolean;
}

/**
 * Find strings in `haystack` most similar to `needle`.
 * Returns matches sorted by descending similarity, filtered by threshold.
 */
export function findSimilar(
    needle: string,
    haystack: Iterable<string>,
    opts?: FindSimilarOptions,
): string[] {
    const threshold = opts?.threshold ?? 0.6;
    const max = opts?.max ?? 5;
    const ignoreCase = opts?.ignoreCase ?? true;

    const normalizedNeedle = ignoreCase ? needle.toLowerCase() : needle;

    const scored: Array<{ original: string; ratio: number }> = [];

    for (const candidate of haystack) {
        const normalizedCandidate = ignoreCase ? candidate.toLowerCase() : candidate;
        const ratio = similarityRatio(normalizedNeedle, normalizedCandidate);
        if (ratio >= threshold) {
            scored.push({ original: candidate, ratio });
        }
    }

    scored.sort((a, b) => b.ratio - a.ratio);
    return scored.slice(0, max).map(s => s.original);
}
