/**
 * `names/modifier-outside-use-area` (docs/checks.md, item 4.2): a modifier in a block of a kind
 * its use area does not include. A warning; its evidence is the game's own output: the use
 * areas the game's modifier documentation gives each modifier (`buckets.modifiers.<name>.
 * use_areas`, and each template tag's, `modifier_template_tags`). No catalogue message.
 *
 * Which use area a block is read with is part D7 of the spec package (`modifier_block_areas`),
 * one row per block that holds modifiers. The check follows D7's own reading (its
 * `about.consumer`): it takes the row of the block the modifier is written in and warns when
 * none of the modifier's use areas is one of the row's. Only a row whose status is `confirmed`
 * is read: a measured-only or unknown row raises nothing (docs/checks.md gives this row no
 * advice).
 *
 * A modifier is judged only when its use areas are known: a name of the modifiers bucket with
 * use areas, or a name that fills a modifier template the package proves (not only the marked
 * `%s_add`), whose use areas are those of the template tags it fills, read as D7 reads them:
 * the tags of the longest form the name fills, joined when several of that length disagree,
 * and none known when one of them gives no use areas. Anything else (a parameter of the block,
 * a name defined in a mod, a template the package marks as no proof alone, a name that fills
 * no tag) is not judged.
 */

import type { Spec } from '../spec/reader.js';
import { templatePattern, vocabularyOf } from '../spec/vocabulary.js';
import type { FileReading, JudgedModifier } from './context.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'names/modifier-outside-use-area';

interface Tag {
    readonly pattern: RegExp;
    /** The length of the form's fixed text: a longer form is a more specific one. */
    readonly length: number;
    readonly areas: readonly string[] | null;
}

const tagPatterns = new WeakMap<Spec, readonly Tag[]>();

/** The template tags of part A1, each as the pattern its form makes, with its use areas. */
function tagsOf(spec: Spec): readonly Tag[] {
    let tags = tagPatterns.get(spec);
    if (tags === undefined) {
        tags = Object.values(spec.data.modifier_template_tags.data).map((tag) => ({
            pattern: templatePattern(tag.form),
            length: tag.form.replaceAll('%s', '').length,
            areas: tag.use_areas,
        }));
        tagPatterns.set(spec, tags);
    }
    return tags;
}

/**
 * The use areas of a judged modifier, or null when they are not known. A key the record
 * schema lists in the block (a `field` reading: the schema's sub-fields are the keys the base
 * game writes there) is judged by its name as any other: a modifier of the bucket, or a name
 * that fills a proved template.
 */
export function useAreasOf(spec: Spec, judged: JudgedModifier): readonly string[] | null {
    const name = judged.pair.key.text;
    const kind = judged.reading.kind;
    if (kind !== 'modifier-type' && kind !== 'template' && kind !== 'field') {
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(spec.data.buckets.modifiers, name)) {
        const areas = spec.data.buckets.modifiers[name]?.use_areas ?? null;
        return areas === null || areas.length === 0 ? null : areas;
    }
    if (vocabularyOf(spec).modifierTemplateMatch(name).kind === 'template') {
        const filled = tagsOf(spec).filter((tag) => tag.pattern.test(name));
        const longest = Math.max(0, ...filled.map((tag) => tag.length));
        const matching = filled.filter((tag) => tag.length === longest);
        if (matching.length === 0 || matching.some((tag) => tag.areas === null)) {
            return null;
        }
        const areas = [...new Set(matching.flatMap((tag) => tag.areas ?? []))].sort();
        return areas.length === 0 ? null : areas;
    }
    return null;
}

export function modifiersOutsideUseArea(
    reading: FileReading,
    context: CheckContext,
    spec: Spec,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    for (const judged of reading.modifiers) {
        const row = reading.modifierBlocks.get(judged.block)?.row ?? null;
        if (row?.status !== 'confirmed' || row.use_areas.length === 0) {
            continue;
        }
        const areas = useAreasOf(spec, judged);
        if (areas === null || areas.some((area) => row.use_areas.includes(area))) {
            continue;
        }
        const key = judged.pair.key;
        out.push(
            finding(
                CODE,
                key,
                [key.text, row.use_areas.join(', '), areas.join(', ')],
                {
                    name: key.text,
                    use_areas: areas,
                    block_use_areas: row.use_areas,
                    block: row.id,
                },
                context,
            ),
        );
    }
    return out;
}
