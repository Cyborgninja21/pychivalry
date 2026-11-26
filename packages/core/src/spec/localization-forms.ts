/**
 * Part D9 of the spec package (format 9, `localization_forms`): the bracket forms of localization
 * text that name something by a name, and the formatting suffixes after `|`. Read here for the
 * checks that need them (docs/checks.md: the check that a title's text reads a scope saved too
 * late, and those that read a game concept's key); no check reads it yet. Every form carries its
 * `status`: `confirmed` (the game concept form `[key|E]`, `Concept`, `ConceptByKey`, the head of a
 * chain), `measured-only` (`TopScope.sC` and five more) or `unknown` (26 forms: the dump of data
 * types says that a function exists, not what its argument names).
 */

import type { LocalizationFormRow, LocalizationFormsData, LocalizationSuffixRow } from './package.js';
import type { Spec } from './reader.js';

/** What D9 says, by form and by the kind of name a form reads. */
export interface LocalizationForms {
    /** Every form, in the package's order. */
    readonly forms: readonly LocalizationFormRow[];
    /** Per kind of name (`reads`: `game_concept`, `saved_scope`, ...), its forms. */
    readonly byReads: ReadonlyMap<string, readonly LocalizationFormRow[]>;
    /** Every formatting suffix, each with its status. */
    readonly suffixes: readonly LocalizationSuffixRow[];
    /** What a name of each kind is (`vocabulary.reads`): the keys of a folder, or what saves it. */
    readonly reads: Readonly<Record<string, unknown>>;
    /** What the part leaves open, in its own words. */
    readonly notSettled: readonly string[];
}

const cache = new WeakMap<Spec, LocalizationForms | null>();

/** Part D9 of a package, read once; null when the package does not build it. */
export function localizationFormsOf(spec: Spec): LocalizationForms | null {
    if (cache.has(spec)) {
        return cache.get(spec) ?? null;
    }
    const data: LocalizationFormsData | null = spec.part('localization_forms');
    if (data === null) {
        cache.set(spec, null);
        return null;
    }
    const byReads = new Map<string, LocalizationFormRow[]>();
    for (const form of data.forms) {
        byReads.set(form.reads, [...(byReads.get(form.reads) ?? []), form]);
    }
    const reads = data.vocabulary['reads'];
    const out: LocalizationForms = {
        forms: data.forms,
        byReads,
        suffixes: data.suffixes,
        reads:
            typeof reads === 'object' && reads !== null ? (reads as Record<string, unknown>) : {},
        notSettled: data.not_settled,
    };
    cache.set(spec, out);
    return out;
}

/** The forms that read a name of one kind and whose status is one of those given. */
export function formsReading(
    forms: LocalizationForms,
    reads: string,
    statuses: readonly string[] = ['confirmed'],
): LocalizationFormRow[] {
    return (forms.byReads.get(reads) ?? []).filter((f) => statuses.includes(f.status));
}
