/**
 * `names/unknown-effect` (docs/checks.md, item 4.2): a key in an effect block that is no effect
 * there, a trigger among them. Evidence: the catalogue's `unknown_effect_X` ("Unknown effect
 * '%s'"). The same reading and data as `names/unknown-trigger`.
 */

import type { CheckFinding } from './finding.js';
import type { FileReading } from './context.js';
import { unknownKeyData } from './names-unknown-trigger.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'names/unknown-effect';

export function unknownEffects(reading: FileReading, context: CheckContext): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const judged of reading.keys) {
        if (judged.context === 'effect' && judged.reading.kind === 'unknown') {
            const key = judged.pair.key;
            out.push(finding(CODE, key, [key.text], unknownKeyData(judged), context));
        }
    }
    return out;
}
