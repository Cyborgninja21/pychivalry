/**
 * The near-name fixes of the unknown names that are not keys of a trigger or effect block
 * (`fix/unknown-keyword.ts` has those): each offers the names valid at the place that are
 * near the one written (`fix/near-name.ts`), and the documented replacement of a removed name
 * first (`fix/retired.ts`).
 *
 * - `names/unknown-modifier`: the modifiers of the package; one whose use areas leave out the
 *   block's (part D7, a confirmed row) is left out, as it would be a new warning.
 * - `names/unknown-link`: the links of the package (a link that takes data after `:` only in
 *   the forms that need it), and the scope heads for a chain's first segment; one that cannot
 *   start from the scope the segment is applied to, where the walk knows it, is left out.
 * - `names/unknown-on-action`: the on-actions of the package and those the index defines.
 * - `fields/unknown-field`: the fields the folder's schema, its wiki-era seeds and Paradox's
 *   `.info` files name, but those already written in the record.
 * - `references/unknown-key` and `references/unknown-name`: the keys the index holds of the
 *   finding's database (not localization keys).
 *
 * The advice code `references/unknown-name` is never fixed safely.
 */

import { onActionPlaces } from '../check/names-unknown-on-action.js';
import { infoFieldNames } from '../check/fields-unknown-field.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import type { Pair } from '../syntax/tree.js';
import {
    databaseCandidates,
    definedIn,
    listCandidates,
    namesOfBucket,
    type Candidates,
} from './candidates.js';
import { dataList, dataText, type FixableFinding, type FixFile } from './file.js';
import type { FindingFix, FixAlternative } from './fix.js';
import { nearNameFix } from './near-name.js';
import { retiredFix } from './retired.js';
import { linkStartsFrom } from './scope-fit.js';

/**
 * The alternative that writes `name` in place of the value at `[start, end)`, inside its
 * quotes when it is quoted.
 */
export function replaceValue(
    file: FixFile,
    start: number,
    end: number,
    name: string,
): FixAlternative {
    const written = file.slice(start, end);
    const quoted = written.length >= 2 && written.startsWith('"') && written.endsWith('"');
    const from = quoted ? start + 1 : start;
    const to = quoted ? end - 1 : end;
    return {
        title: `Replace '${file.slice(from, to)}' with '${name}'`,
        edits: [file.replace(from, to, name)],
    };
}

export function unknownModifierFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    if (dataText(finding.data, 'removed_in') !== null) {
        return retiredFix(finding, file, 'modifiers');
    }
    const name = dataText(finding.data, 'name');
    if (name === null) {
        return null;
    }
    const all = namesOfBucket(file.spec, 'modifiers');
    const read = file.readings();
    const judged = read?.reading.modifiers.find((m) => m.pair.key.start === finding.start);
    const row =
        judged === undefined ? null : (read?.reading.modifierBlocks.get(judged.block)?.row ?? null);
    const areas = row?.status === 'confirmed' ? row.use_areas : [];
    const fits = (modifier: string): boolean => {
        const own = file.spec.data.buckets.modifiers[modifier]?.use_areas ?? [];
        return areas.length === 0 || own.length === 0 || own.some((a) => areas.includes(a));
    };
    return nearNameFix(
        name,
        { valid: all.filter(fits), pool: all },
        (candidate) => replaceValue(file, finding.start, finding.end, candidate),
        true,
    );
}

/** The links that may stand in a chain's segment: those that need no data, and the scope heads. */
function linkCandidates(spec: Spec, first: boolean): Candidates {
    const vocabulary = vocabularyOf(spec);
    const links = namesOfBucket(spec, 'links').filter((link) =>
        vocabulary.linkForms(link).some((form) => !form.requires_data),
    );
    const valid = first ? [...links, ...tablesOf(spec).scopeHeads] : links;
    return { valid, pool: namesOfBucket(spec, 'links') };
}

/** The one scope type a link gives, or null. */
function outputOf(spec: Spec, link: string): string | null {
    const targets = new Set(
        vocabularyOf(spec)
            .linkForms(link)
            .flatMap((f) => f.supported_targets),
    );
    return targets.size === 1 ? ([...targets][0] ?? null) : null;
}

export function unknownLinkFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const segment = dataText(finding.data, 'segment');
    const scalar = file.scalarAt(finding.start);
    if (segment === null || scalar === undefined) {
        return null;
    }
    const segments = scalar.segments ?? [scalar.text];
    const at = segments.indexOf(segment);
    if (at < 0) {
        return null;
    }
    let offset = scalar.start;
    for (const s of segments.slice(0, at)) {
        offset += s.length + 1;
    }
    if (file.slice(offset, offset + segment.length) !== segment) {
        return null;
    }
    // The scope the segment is applied to: the output of the link before it, where it is one
    // scope type; for a key's first segment, the scope of the block it is in.
    let scope: string | null = null;
    const read = file.readings();
    if (read !== null) {
        if (at > 0) {
            const before = read.scopes.links.find(
                (step) => step.scalar === scalar && step.index === at - 1,
            );
            scope = before === undefined ? null : outputOf(file.spec, before.link);
        } else {
            const pair: Pair | undefined = file.pairAt(scalar.start);
            scope = pair === undefined ? null : (read.scopes.pairs.get(pair)?.this.type ?? null);
        }
    }
    const all = linkCandidates(file.spec, at === 0);
    const candidates =
        scope === null
            ? all
            : {
                  valid: all.valid.filter((link) => linkStartsFrom(file.spec, link, scope)),
                  pool: all.pool,
              };
    return nearNameFix(
        segment,
        candidates,
        (candidate) => ({
            title: `Replace '${segment}' with '${candidate}'`,
            edits: [file.replace(offset, offset + segment.length, candidate)],
        }),
        true,
    );
}

export function unknownOnActionFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const name = dataText(finding.data, 'name');
    const database = onActionPlaces(file.spec).database;
    if (name === null || database === null) {
        return null;
    }
    const defined = definedIn(file.input.names, file.input.index, database);
    if (defined === null) {
        return null;
    }
    const all = [...new Set([...namesOfBucket(file.spec, 'on_actions'), ...defined])].sort();
    return nearNameFix(
        name,
        listCandidates(all),
        (candidate) => replaceValue(file, finding.start, finding.end, candidate),
        true,
    );
}

export function unknownFieldFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const name = dataText(finding.data, 'name');
    const folder = dataText(finding.data, 'folder');
    const path = dataList(finding.data, 'path');
    if (name === null || folder === null || path.length !== 1) {
        return null;
    }
    const schema = file.spec.data.schema[folder];
    if (schema === undefined) {
        return null;
    }
    const isName = (field: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(field);
    const fields = new Set(
        [
            ...Object.keys(schema.fields),
            ...Object.keys(schema.unconfirmed ?? {}),
            ...infoFieldNames(file.spec, folder),
        ].filter(isName),
    );
    // A field the record already writes is not offered: it would be written twice.
    const record = file.tree?.items.find(
        (item): item is Pair =>
            item.kind === 'pair' && item.start <= finding.start && finding.start < item.end,
    );
    const body = record?.value?.kind === 'block' ? record.value : undefined;
    const written = new Set(
        (body?.items ?? []).flatMap((item) => (item.kind === 'pair' ? [item.key.text] : [])),
    );
    const all = [...fields].sort();
    return nearNameFix(
        name,
        { valid: all.filter((f) => !written.has(f)), pool: all },
        (candidate) => replaceValue(file, finding.start, finding.end, candidate),
        true,
    );
}

function referenceFix(
    finding: FixableFinding,
    file: FixFile,
    safeAllowed: boolean,
): FindingFix | null {
    const name = dataText(finding.data, 'name');
    const database = dataText(finding.data, 'database');
    if (name === null || database === null) {
        return null;
    }
    return nearNameFix(
        name,
        databaseCandidates(file.input.names, file.input.index, database),
        (candidate) => replaceValue(file, finding.start, finding.end, candidate),
        safeAllowed,
    );
}

export function unknownKeyFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    return referenceFix(finding, file, true);
}

export function unknownReferenceNameFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    return referenceFix(finding, file, false);
}
