/** The statistics a speed record states for a series of runs (records/README.md). */

export interface Stats {
    n: number;
    median: number;
    min: number;
    max: number;
    /** max minus min. */
    spread: number;
    values: number[];
}

/** Median, min, max and spread of some values; the median of an even count is the mean of the middle two. */
export function summarize(values: readonly number[]): Stats {
    if (values.length === 0) {
        throw new Error('no values to summarize');
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const at = (i: number): number => sorted[i] ?? Number.NaN;
    const median = sorted.length % 2 === 1 ? at(mid) : (at(mid - 1) + at(mid)) / 2;
    const min = at(0);
    const max = at(sorted.length - 1);
    return { n: values.length, median, min, max, spread: max - min, values: [...values] };
}
