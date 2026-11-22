/**
 * `names/unknown-modifier` (docs/checks.md, item 4.2): a key in a modifier block that is no
 * modifier and fills no modifier template. Evidence: the catalogue's
 * `unknown_modifier_type_X_at_X` ("Unknown modifier type '{}' at {}").
 *
 * A modifier block is a field the schema marks `holds: modifiers`. A name is a modifier when
 * the modifiers bucket has it or it fills a template of `modifier_templates`; a name that only
 * a marked template fills (`%s_add`, no proof alone) is neither proved nor refuted, and is not
 * reported. Keys the schema records in the block, the parameters of `modifier_block_params`
 * and names defined in the directories of `vanilla_indexed_dirs` are not modifier types.
 */

import type { CheckFinding } from './finding.js';
import type { FileReading } from './context.js';
import { finding, retiredData, type CheckContext } from './report.js';

export const CODE = 'names/unknown-modifier';

export function unknownModifiers(reading: FileReading, context: CheckContext): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const judged of reading.modifiers) {
        if (judged.reading.kind === 'unknown') {
            const key = judged.pair.key;
            out.push(
                finding(
                    CODE,
                    key,
                    [key.text],
                    { name: key.text, ...retiredData(judged.reading.retired) },
                    context,
                ),
            );
        }
    }
    return out;
}
