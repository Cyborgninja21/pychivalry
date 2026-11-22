/**
 * `names/unknown-link` (docs/checks.md, item 4.2): a segment of a scope chain (`root.foo`,
 * `scope:x.bar`) that is no link. Evidence: the catalogue's
 * `failed_to_parse_data_for_event_target_link_link_X_location_X` ("Failed to parse data for
 * event target link. Link: %s, location: %s").
 *
 * How a chain is walked is the file's reading (`check/context.ts`): from where the package's
 * table `scope_heads` says a chain may be walked (the game registers those names as links, and
 * the table's role stands), or from a global link that takes data (`scope:x`); each later
 * segment a link, the last one possibly a value. A chain holding a `$PARAM$` is not walked.
 */

import type { ChainSite, FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'names/unknown-link';

export function unknownLinks(reading: FileReading, context: CheckContext): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const site of reading.chains) {
        if (site.verdict.kind === 'bad') {
            out.push(report(site, site.verdict.segment, context));
        }
    }
    return out;
}

function report(site: ChainSite, segment: string, context: CheckContext): CheckFinding {
    const text = site.scalar.text;
    return finding(
        CODE,
        site.scalar,
        [text],
        { chain: text, segment, position: site.position },
        context,
    );
}
