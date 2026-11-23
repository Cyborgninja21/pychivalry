/**
 * The fixes of `names/unknown-trigger` and `names/unknown-effect`: a key of a trigger or effect
 * block that is no trigger or effect there.
 *
 * 1. A removed keyword: its documented replacement (`fix/retired.ts`), and an iterator over a
 *    removed list: the list's replacement.
 * 2. A misspelt name: the names valid in the block that are near it (`fix/near-name.ts`): the
 *    context's keywords, the links, the structural names, the iterators with the prefixes part
 *    D8 gives the context, and the scripted triggers or effects the index defines. A name that
 *    would not fit the scope the key is in, where the scope walk knows it, is left out.
 *
 * No fix for a keyword of another bucket written here (an effect in a trigger block: where it
 * belongs is a choice), for a removed keyword with no replacement, or for a name with nothing
 * near it (a scripted effect called by another name: which one is a choice).
 */

import type { Context } from '../check/context.js';
import { keywordCandidates, type Candidates } from './candidates.js';
import { dataList, dataText, type FixableFinding, type FixFile } from './file.js';
import type { FindingFix } from './fix.js';
import { nearNameFix } from './near-name.js';
import { retiredFix, retiredListFix } from './retired.js';
import { fitsScope } from './scope-fit.js';

/** The scope type the key at the finding stands in, when the scope walk knows it. */
export function scopeAtKey(file: FixFile, keyStart: number): string | null {
    const read = file.readings();
    const pair = file.pairAt(keyStart);
    if (read === null || pair === undefined) {
        return null;
    }
    return read.scopes.pairs.get(pair)?.this.type ?? null;
}

/** The candidates of a key of a context's block, without those that do not fit its scope. */
export function fittingCandidates(
    file: FixFile,
    context: Context,
    keyStart: number,
): Candidates | null {
    const all = keywordCandidates(file.spec, file.input.names, file.input.index, context);
    if (all === null) {
        return null;
    }
    const scope = scopeAtKey(file, keyStart);
    if (scope === null) {
        return all;
    }
    return {
        valid: all.valid.filter((name) => fitsScope(file.spec, name, context, scope)),
        pool: all.pool,
    };
}

function unknownKeywordFix(
    finding: FixableFinding,
    file: FixFile,
    context: Context,
): FindingFix | null {
    const bucket = context === 'trigger' ? 'triggers' : 'effects';
    if (dataText(finding.data, 'removed_in') !== null) {
        return retiredFix(finding, file, bucket);
    }
    const list = retiredListFix(finding, file);
    if (list !== null) {
        return list;
    }
    const name = dataText(finding.data, 'name');
    if (name === null || dataList(finding.data, 'buckets').length > 0) {
        return null;
    }
    return nearNameFix(
        name,
        fittingCandidates(file, context, finding.start),
        (candidate) => ({
            title: `Replace '${name}' with '${candidate}'`,
            edits: [file.replace(finding.start, finding.end, candidate)],
        }),
        true,
    );
}

export function unknownTriggerFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    return unknownKeywordFix(finding, file, 'trigger');
}

export function unknownEffectFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    return unknownKeywordFix(finding, file, 'effect');
}
