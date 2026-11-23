/**
 * The fixes of the scope findings, from the links their data names (`links_from_scope`: the
 * links the game's own documentation says lead from the scope a keyword or link is in to the
 * scopes it takes, `check/scope-links.ts`).
 *
 * - `scope/wrong-scope-for-trigger` and `scope/wrong-scope-for-effect`: the trigger or effect
 *   wrapped in a link that leads to a scope it takes, `<link> = { <it> }`, inserted around it
 *   without touching what it holds.
 * - `scope/link-on-wrong-scope`: a link that leads to a scope the link starts from written
 *   before it, `<link>.<it>`.
 *
 * Safe when exactly one link leads there and it is a plain link, one step, no data after a
 * `:`: the keyword or link is written on purpose, and one way alone runs it from here. A
 * suggestion when a few do, each one an alternative (at most `MAX_FIX_ALTERNATIVES`). None when
 * more do: which of many ways is meant is a choice the finding's data already lays out
 * (`links_from_scope`), and a few of them picked by name would be a guess. A link that needs
 * data (`title:<key>`) is never written, as its key is a choice; none when no link leads there.
 */

import type { FixableFinding, FixFile } from './file.js';
import { dataList, dataText } from './file.js';
import {
    MAX_FIX_ALTERNATIVES,
    safeFix,
    suggestion,
    type FindingFix,
    type FixAlternative,
} from './fix.js';

/** The links a fix may write (no `:<key>`), and whether the one way there is a plain link. */
function ways(finding: FixableFinding): {
    readonly links: readonly string[];
    readonly one: boolean;
} {
    const listed = dataList(finding.data, 'links_from_scope');
    const total = Number(dataText(finding.data, 'links_from_scope_total') ?? listed.length);
    const links = listed.filter((l) => !l.includes(':'));
    const only = listed[0];
    return {
        links: total > listed.length || links.length > MAX_FIX_ALTERNATIVES ? [] : links,
        one: total === 1 && only !== undefined && !only.includes('.') && !only.includes(':'),
    };
}

function choose(alternatives: readonly FixAlternative[], one: boolean): FindingFix | null {
    const first = alternatives[0];
    if (one && alternatives.length === 1 && first !== undefined) {
        return safeFix('scope-links', first);
    }
    return suggestion('scope-links', alternatives);
}

export function wrongScopeFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const name = dataText(finding.data, 'name');
    const pair = file.pairAt(finding.start);
    if (name === null || pair === undefined || pair.value === null) {
        return null;
    }
    const { links, one } = ways(finding);
    return choose(
        links.map((link) => ({
            title: `Run '${name}' in ${link}: ${link} = { ... }`,
            edits: [file.insert(pair.start, `${link} = { `), file.insert(pair.end, ' }')],
        })),
        one,
    );
}

export function linkOnWrongScopeFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const link = dataText(finding.data, 'link');
    const scalar = file.scalarAt(finding.start);
    if (link === null || scalar === undefined) {
        return null;
    }
    let offset = scalar.start;
    if (scalar.segments !== undefined) {
        const read = file.readings();
        const step = read?.scopes.links.find(
            (s) => s.scalar === scalar && s.link === link && s.input.type !== null,
        );
        if (step === undefined) {
            return null;
        }
        for (const segment of scalar.segments.slice(0, step.index)) {
            offset += segment.length + 1;
        }
    }
    if (!file.slice(offset, scalar.end).startsWith(link)) {
        return null;
    }
    const { links, one } = ways(finding);
    return choose(
        links.map((way) => ({
            title: `Reach the scope ${link} starts from through ${way}: ${way}.${link}`,
            edits: [file.insert(offset, `${way}.`)],
        })),
        one,
    );
}
