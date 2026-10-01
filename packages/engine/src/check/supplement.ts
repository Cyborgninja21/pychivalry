/**
 * Keywords the CK3 1.20 engine accepts that the 1.20.0.2 spec package does not carry.
 *
 * Every entry is attested by the vanilla 1.20.0.2 scripts (the count is the number of
 * uses found when this list was calibrated) and is a gap in the package, to be fixed at
 * the source in pdx-parser-re; nothing here is invented. Two kinds:
 *
 *   KEYWORD_TEMPLATES  trigger/effect families the engine registers once per database
 *                      entry at load time (like the package's modifier_templates):
 *                      `has_relation_<scripted relation>`, `add_<lifestyle>_lifestyle_xp` …
 *   SPEC_GAPS          single names vanilla uses as a trigger, effect or scope link that
 *                      are in none of the package's buckets (the registrar walk missed them;
 *                      several are in the delta's other_keywords list)
 */

import { Bucket } from '../spec/types';

export interface KeywordTemplate {
    template: string;
    bucket: Extract<Bucket, 'triggers' | 'effects'>;
    source: string;
    vanillaUses: number;
}

export const KEYWORD_TEMPLATES: readonly KeywordTemplate[] = [
    {
        template: 'has_relation_%s',
        bucket: 'triggers',
        source: 'common/scripted_relations',
        vanillaUses: 4511,
    },
    {
        template: 'has_secret_relation_%s',
        bucket: 'triggers',
        source: 'common/scripted_relations',
        vanillaUses: 34,
    },
    {
        template: 'num_of_relation_%s',
        bucket: 'triggers',
        source: 'common/scripted_relations',
        vanillaUses: 351,
    },
    {
        template: 'set_relation_%s',
        bucket: 'effects',
        source: 'common/scripted_relations',
        vanillaUses: 1236,
    },
    {
        template: 'remove_relation_%s',
        bucket: 'effects',
        source: 'common/scripted_relations',
        vanillaUses: 330,
    },
    {
        template: 'add_%s_lifestyle_xp',
        bucket: 'effects',
        source: 'common/lifestyles',
        vanillaUses: 292,
    },
    {
        template: 'add_%s_lifestyle_perk_points',
        bucket: 'effects',
        source: 'common/lifestyles',
        vanillaUses: 56,
    },
    {
        template: '%s_lifestyle_perk_points',
        bucket: 'triggers',
        source: 'common/lifestyles',
        vanillaUses: 5,
    },
    {
        template: 'perks_in_%s_lifestyle',
        bucket: 'triggers',
        source: 'common/lifestyles',
        vanillaUses: 6,
    },
    {
        template: '%s_lifestyle_unlockable_perks',
        bucket: 'triggers',
        source: 'common/lifestyles',
        vanillaUses: 1,
    },
    {
        template: '%s_track_perks',
        bucket: 'triggers',
        source: 'common/dynasty_perks (legacy tracks)',
        vanillaUses: 9,
    },
];

export interface SpecGap {
    bucket: Bucket;
    vanillaUses: number;
}

export const SPEC_GAPS: ReadonlyMap<string, SpecGap> = new Map<string, SpecGap>([
    // triggers
    ['always', { bucket: 'triggers', vanillaUses: 2812 }],
    ['age', { bucket: 'triggers', vanillaUses: 1901 }],
    ['has_activity_intent', { bucket: 'triggers', vanillaUses: 1367 }],
    // scope links
    ['secret_owner', { bucket: 'links', vanillaUses: 133 }],
    ['confederation', { bucket: 'links', vanillaUses: 97 }],
    ['real_father', { bucket: 'links', vanillaUses: 55 }],
    ['obedience_target', { bucket: 'links', vanillaUses: 29 }],
    ['house_confederation', { bucket: 'links', vanillaUses: 16 }],
    ['county_controller', { bucket: 'links', vanillaUses: 8 }],
    ['barony_controller', { bucket: 'links', vanillaUses: 8 }],
    ['leading_house', { bucket: 'links', vanillaUses: 8 }],
    ['state_rite', { bucket: 'links', vanillaUses: 1 }],
    // iterator bases (database iterators: every_trait, random_tenet …)
    ['tenet', { bucket: 'lists', vanillaUses: 10 }],
    ['trait', { bucket: 'lists', vanillaUses: 7 }],
    ['doctrine', { bucket: 'lists', vanillaUses: 1 }],
    ['culture_innovation', { bucket: 'lists', vanillaUses: 2 }],
    ['culture_tradition', { bucket: 'lists', vanillaUses: 1 }],
    ['geographical_region', { bucket: 'lists', vanillaUses: 1 }],
    ['decision', { bucket: 'lists', vanillaUses: 1 }],
    ['great_project_type', { bucket: 'lists', vanillaUses: 2 }],
    ['activity_type', { bucket: 'lists', vanillaUses: 1 }],
]);

function compile(bucket: Bucket): RegExp | undefined {
    const parts = KEYWORD_TEMPLATES.filter((t) => t.bucket === bucket).map((t) =>
        t.template
            .split('%s')
            .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('[A-Za-z0-9_$]+')
    );
    return parts.length > 0 ? new RegExp(`^(?:${parts.join('|')})$`) : undefined;
}

const TEMPLATE_RE: ReadonlyMap<Bucket, RegExp | undefined> = new Map([
    ['triggers', compile('triggers')],
    ['effects', compile('effects')],
]);

/** Is `name` accepted in `bucket` by this supplement? */
export function supplementHas(name: string, bucket: Bucket): boolean {
    const gap = SPEC_GAPS.get(name);
    if (gap && gap.bucket === bucket) {
        return true;
    }
    const re = TEMPLATE_RE.get(bucket);
    return re !== undefined && re.test(name);
}
