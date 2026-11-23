/**
 * "Did you mean": names close to one the package has nothing for, with the work behind them
 * bounded (docs/MVP.md, "Lessons from 2.3.0": one file once took 6.9 seconds). The search
 * counts its work, one unit for each candidate it looks at and one for each cell of the edit
 * distance table it fills, and stops at a budget; its answer says whether it saw every
 * candidate. The distance is Levenshtein's, letter case ignored, computed in a band no wider
 * than the largest distance asked for and abandoned as soon as no cell of a row is within it.
 * The work done never passes the budget, whatever the name's length or the candidates' number.
 */

import type { Suggestion } from './types.js';

export interface SuggestOptions {
    /** How many suggestions at most; 5 by default. */
    readonly limit?: number;
    /** The largest distance suggested; by default 1 for names of up to 7 characters, else 2, 3 from 12. */
    readonly maxDistance?: number;
    /** The work allowed: candidates looked at plus table cells filled; 2,000,000 by default. */
    readonly budget?: number;
}

/** A name to compare with, and where it comes from. */
export interface Candidate {
    readonly name: string;
    readonly from: Suggestion['from'];
}

export interface SuggestResult {
    readonly suggestions: readonly Suggestion[];
    readonly complete: boolean;
    readonly work: number;
    readonly budget: number;
}

export const DEFAULT_SUGGESTION_LIMIT = 5;
export const DEFAULT_SUGGESTION_BUDGET = 2_000_000;

/** The largest distance worth suggesting for a name of this length. */
export function defaultMaxDistance(length: number): number {
    if (length < 8) {
        return 1;
    }
    return length < 12 ? 2 : 3;
}

/**
 * The edit distance of two strings when it is at most `max`, else `max + 1`; `cells` is called
 * with the number of table cells filled. The table is filled only within `max` of its diagonal.
 */
export function boundedDistance(
    a: string,
    b: string,
    max: number,
    cells: (n: number) => void,
): number {
    if (Math.abs(a.length - b.length) > max) {
        return max + 1;
    }
    const over = max + 1;
    let previous = new Array<number>(b.length + 1);
    let current = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) {
        previous[j] = j <= max ? j : over;
    }
    for (let i = 1; i <= a.length; i++) {
        const from = Math.max(1, i - max);
        const to = Math.min(b.length, i + max);
        current.fill(over);
        current[0] = i <= max ? i : over;
        let best = current[0];
        for (let j = from; j <= to; j++) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
            const value = Math.min(
                (previous[j - 1] ?? over) + cost,
                (previous[j] ?? over) + 1,
                (current[j - 1] ?? over) + 1,
                over,
            );
            current[j] = value;
            if (value < best) {
                best = value;
            }
        }
        cells(to - from + 1);
        if (best > max) {
            return over;
        }
        [previous, current] = [current, previous];
    }
    return Math.min(previous[b.length] ?? over, over);
}

/**
 * The candidates closest to `name`, nearest first (then by name), within the work budget.
 * A candidate equal to the name is not a suggestion; one that differs only in letter case is
 * at distance 0.
 */
export function suggest(
    name: string,
    candidates: Iterable<Candidate>,
    options: SuggestOptions = {},
): SuggestResult {
    const limit = options.limit ?? DEFAULT_SUGGESTION_LIMIT;
    const budget = options.budget ?? DEFAULT_SUGGESTION_BUDGET;
    const max = options.maxDistance ?? defaultMaxDistance(name.length);
    const target = name.toLowerCase();
    let work = 0;
    const count = (n: number): void => {
        work += n;
    };
    // The most cells one comparison can fill: the band's width times the name's length. A
    // comparison starts only when it fits in what is left, so the work never passes the budget.
    const widest = (2 * max + 1) * Math.max(1, target.length);
    const found: Suggestion[] = [];
    const seen = new Set<string>();
    let complete = true;
    for (const candidate of candidates) {
        if (work + 1 + widest > budget) {
            complete = false;
            break;
        }
        work += 1;
        if (candidate.name === name || seen.has(candidate.name)) {
            continue;
        }
        const distance = boundedDistance(target, candidate.name.toLowerCase(), max, count);
        if (distance <= max) {
            seen.add(candidate.name);
            found.push({ name: candidate.name, distance, from: candidate.from });
        }
    }
    found.sort(
        (a, b) => a.distance - b.distance || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
    return { suggestions: found.slice(0, limit), complete, work, budget };
}
