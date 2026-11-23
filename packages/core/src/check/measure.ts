/**
 * What the scope checks of item 4.4 judged, counted while they run: the figure docs/MVP.md's
 * definition of done 2 asks the record to state ("the scope check has zero findings on every
 * keyword use it can judge ... the record states the figure"). The game-file suites pass a
 * `ScopeMeasure` through the one runner (`checkWorkspace`), so the counts are of the same run
 * whose findings they report; no surface needs them otherwise.
 *
 * A keyword use is a trigger, an effect or an iterator in a trigger or effect block
 * (`keywordUses`). Its scope is known when the scope walk knows the scope it runs in; it is
 * judged when, besides, the game's documentation gives the keyword scope data that declares a
 * requirement. A link step is judged where `scope/link-on-wrong-scope` judges it
 * (`judgedSteps`).
 */

import type { KeywordUse, LinkStep } from './scope.js';

/** The counts, added to file by file. */
export interface ScopeMeasure {
    /** Every trigger, effect and iterator use in a trigger or effect block. */
    keywordUses: number;
    /** Uses whose scope the walk knows: the judged ones, and those with no requirement or no scope data. */
    knownScope: number;
    /** Uses judged against the keyword's scope data. */
    judged: number;
    /** Judged uses in a scope the data does not list: the findings of the two keyword rows. */
    findings: number;
    /** The uses not judged, by why (`UnjudgedWhy`). */
    readonly unjudged: Map<string, number>;
    /** Link steps judged by `scope/link-on-wrong-scope`. */
    linkStepsJudged: number;
    /** Judged link steps applied to a scope they cannot start from: that row's findings. */
    linkFindings: number;
}

/** An empty measure. */
export function newScopeMeasure(): ScopeMeasure {
    return {
        keywordUses: 0,
        knownScope: 0,
        judged: 0,
        findings: 0,
        unjudged: new Map(),
        linkStepsJudged: 0,
        linkFindings: 0,
    };
}

/** Why an unjudged use still had a known scope: the keyword, not the scope, decides. */
const KNOWN_SCOPE: ReadonlySet<string> = new Set(['no-requirement', 'no-scope-data']);

/** Add one file's keyword uses and judged link steps to a measure. */
export function addToScopeMeasure(
    measure: ScopeMeasure,
    uses: readonly KeywordUse[],
    steps: readonly LinkStep[],
): void {
    for (const use of uses) {
        measure.keywordUses++;
        if (use.verdict.judged) {
            measure.knownScope++;
            measure.judged++;
            if (!use.verdict.fits) {
                measure.findings++;
            }
            continue;
        }
        if (KNOWN_SCOPE.has(use.verdict.why)) {
            measure.knownScope++;
        }
        measure.unjudged.set(use.verdict.why, (measure.unjudged.get(use.verdict.why) ?? 0) + 1);
    }
    for (const step of steps) {
        measure.linkStepsJudged++;
        if (
            step.input.type !== null &&
            step.expected !== null &&
            !step.expected.includes(step.input.type)
        ) {
            measure.linkFindings++;
        }
    }
}
