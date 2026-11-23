/**
 * A removed keyword replaced by the replacement the spec package documents for it (its
 * `retired` list, release 2.3.0's `PYCH-R001` fix): the findings of `names/unknown-trigger`,
 * `-effect`, `-modifier` and `-link` carry the version a removed keyword went in and its
 * replacements as data. Safe when the package names one replacement, which the bucket has; a
 * suggestion when it names several; none when it names none ("no replacement is claimed"),
 * since the package says on purpose that nothing stands in for the name.
 *
 * An iterator over a removed list (`every_special_building_province`) has the list's
 * replacement put in place of the list.
 */

import type { BucketName } from '../spec/package.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import { dataList, dataText, type FixableFinding, type FixFile } from './file.js';
import { safeFix, suggestion, type FindingFix, type FixAlternative } from './fix.js';

/** The alternatives that put each name of `replacements` the bucket has in place of `[start, end)`. */
function replacing(
    file: FixFile,
    start: number,
    end: number,
    replacements: readonly string[],
    bucket: BucketName,
    write: (replacement: string) => string,
): FixAlternative[] {
    const vocabulary = vocabularyOf(file.spec);
    return replacements
        .filter((r) => vocabulary.has(bucket, r))
        .map((r) => ({
            title: `Replace '${file.slice(start, end)}' with '${write(r)}'`,
            edits: [file.replace(start, end, write(r))],
        }));
}

/**
 * The fix of a removed name in a bucket, from the finding's `replacement` data; null when the
 * name was not removed, or the package claims no replacement.
 */
export function retiredFix(
    finding: FixableFinding,
    file: FixFile,
    bucket: BucketName,
): FindingFix | null {
    if (dataText(finding.data, 'removed_in') === null) {
        return null;
    }
    const alternatives = replacing(
        file,
        finding.start,
        finding.end,
        dataList(finding.data, 'replacement'),
        bucket,
        (r) => r,
    );
    return pick(alternatives);
}

/**
 * The fix of an iterator over a removed list (the finding's `iterator_prefix` and `list`): the
 * list's documented replacement after the prefix. Null when the list was not removed or has
 * no replacement.
 */
export function retiredListFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const prefix = dataText(finding.data, 'iterator_prefix');
    const list = dataText(finding.data, 'list');
    if (prefix === null || list === null) {
        return null;
    }
    const removed = vocabularyOf(file.spec).retired('lists', list);
    const replacements = removed.flatMap((r) => r.replacement ?? []);
    if (removed.length === 0 || replacements.length === 0) {
        return null;
    }
    return pick(
        replacing(file, finding.start, finding.end, replacements, 'lists', (r) => `${prefix}${r}`),
    );
}

function pick(alternatives: readonly FixAlternative[]): FindingFix | null {
    const only = alternatives[0];
    if (alternatives.length === 1 && only !== undefined) {
        return safeFix('retired', only);
    }
    return suggestion('retired', alternatives);
}
