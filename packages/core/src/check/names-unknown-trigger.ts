/**
 * `names/unknown-trigger` (docs/checks.md, item 4.2): a key in a trigger block that is no
 * trigger there: a made-up or removed name, an effect, an iterator over no list. Evidence: the
 * catalogue's `unknown_trigger_X` ("Unknown trigger '%s'").
 *
 * The keys and what each is come from the file's reading (`check/context.ts`). A removed
 * keyword carries the version it was removed in and its replacement as data; an iterator over
 * no list carries the list it names; a name the package has in other buckets carries them.
 */

import type { CheckFinding } from './finding.js';
import type { FileReading, JudgedKey } from './context.js';
import { finding, retiredData, type CheckContext } from './report.js';

export const CODE = 'names/unknown-trigger';

/** The data of an unknown key: the buckets it is in, the list it iterates, its removal. */
export function unknownKeyData(judged: JudgedKey): Record<string, string | readonly string[]> {
    const reading = judged.reading;
    if (reading.kind !== 'unknown') {
        return {};
    }
    return {
        name: judged.pair.key.text,
        ...(reading.buckets.length > 0 ? { buckets: reading.buckets } : {}),
        ...(reading.iterator === null
            ? {}
            : { iterator_prefix: reading.iterator.prefix, list: reading.iterator.base }),
        ...retiredData(reading.retired),
    };
}

export function unknownTriggers(reading: FileReading, context: CheckContext): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const judged of reading.keys) {
        if (judged.context === 'trigger' && judged.reading.kind === 'unknown') {
            const key = judged.pair.key;
            out.push(finding(CODE, key, [key.text], unknownKeyData(judged), context));
        }
    }
    return out;
}
