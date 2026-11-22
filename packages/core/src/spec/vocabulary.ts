/**
 * Name lookups over a spec package: the six buckets, the keyword and modifier templates, the
 * names in more than one bucket, the removed keywords, the links and the iterator prefixes.
 * A lookup is by name and bucket together, never by name alone (spec/README.md of the spec
 * work: "lookups are by name AND bucket"); a name in several buckets is resolved by the
 * context that asks, never by picking one.
 */

import type { Spec } from './reader.js';
import type {
    BucketName,
    CatalogueEntry,
    KeywordTemplate,
    LinkForm,
    RetiredEntry,
    ScopeRecord,
} from './package.js';

/** `%s` in a template stands for a key: lower-case letters, digits and `_` (spec/README.md). */
const FILLER = '([a-z0-9_]+)';

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A template as a regular expression whose one group is what fills `%s`. */
export function templatePattern(template: string): RegExp {
    return new RegExp(`^${template.split('%s').map(escape).join(FILLER)}$`);
}

/** A keyword template a name fills, and the key that fills it. */
export interface TemplateFill {
    readonly template: KeywordTemplate;
    /** The text standing for `%s`, which must be a key of `template.keys`. */
    readonly key: string;
}

/** How a name stands against the modifier templates. */
export type ModifierTemplateMatch =
    /** It fills a template that is proof, or a game form that rests on a marked one. */
    | { readonly kind: 'template'; readonly templates: readonly string[] }
    /** It fills only templates the package marks as no proof alone (`%s_add`). */
    | { readonly kind: 'marked-only'; readonly templates: readonly string[] }
    | { readonly kind: 'none' };

/** Name lookups over one package. */
export class Vocabulary {
    readonly spec: Spec;
    private readonly keywordTemplates: readonly { template: KeywordTemplate; pattern: RegExp }[];
    private readonly modifierTemplates: readonly { template: string; pattern: RegExp }[];
    private readonly markedForms: ReadonlyMap<string, readonly RegExp[]>;
    private readonly retiredByName = new Map<string, RetiredEntry[]>();
    private readonly catalogue = new Map<string, CatalogueEntry>();

    constructor(spec: Spec) {
        this.spec = spec;
        this.keywordTemplates = spec.data.keyword_templates.map((template) => ({
            template,
            pattern: templatePattern(template.template),
        }));
        this.modifierTemplates = spec.data.modifier_templates.map((template) => ({
            template,
            pattern: templatePattern(template),
        }));
        const marked = new Map<string, RegExp[]>();
        for (const [template, mark] of Object.entries(spec.data.modifier_template_marks)) {
            marked.set(template, mark.sole_cover_of.map(templatePattern));
        }
        this.markedForms = marked;
        for (const entry of spec.data.retired) {
            const list = this.retiredByName.get(entry.name) ?? [];
            list.push(entry);
            this.retiredByName.set(entry.name, list);
        }
        for (const entry of spec.data.errors) {
            this.catalogue.set(entry.id, entry);
        }
    }

    /** True when the bucket lists the name. */
    has(bucket: BucketName, name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.spec.data.buckets[bucket], name);
    }

    /** Every bucket that lists the name, in the package's order of buckets. */
    bucketsOf(name: string): BucketName[] {
        const multi = this.spec.data.multi_bucket;
        if (Object.prototype.hasOwnProperty.call(multi, name)) {
            return [...(multi[name] ?? [])];
        }
        return (Object.keys(this.spec.data.buckets) as BucketName[]).filter((b) => this.has(b, name));
    }

    /** The keyword templates of a bucket that a name fills (`add_diplomacy_xp`: `add_%s_xp`). */
    keywordTemplateFills(bucket: BucketName, name: string): TemplateFill[] {
        const out: TemplateFill[] = [];
        for (const { template, pattern } of this.keywordTemplates) {
            if (template.bucket !== bucket) {
                continue;
            }
            const key = pattern.exec(name)?.[1];
            if (key !== undefined) {
                out.push({ template, key });
            }
        }
        return out;
    }

    /**
     * How a name stands against `modifier_templates`. A template the package marks
     * (`modifier_template_marks`, 1.21.0.3: `%s_add`, a bare value suffix) is no proof alone:
     * a name it alone accepts is `marked-only`, unless it fills one of the game's own forms
     * the mark says rest on it (`sole_cover_of`).
     */
    modifierTemplateMatch(name: string): ModifierTemplateMatch {
        const proof: string[] = [];
        const marked: string[] = [];
        for (const { template, pattern } of this.modifierTemplates) {
            if (!pattern.test(name)) {
                continue;
            }
            const forms = this.markedForms.get(template);
            if (forms === undefined || forms.some((form) => form.test(name))) {
                proof.push(template);
            } else {
                marked.push(template);
            }
        }
        if (proof.length > 0) {
            return { kind: 'template', templates: proof };
        }
        return marked.length > 0 ? { kind: 'marked-only', templates: marked } : { kind: 'none' };
    }

    /** The removed keywords of that name in a bucket (`retired`). */
    retired(bucket: BucketName, name: string): RetiredEntry[] {
        return (this.retiredByName.get(name) ?? []).filter((r) => r.bucket === bucket);
    }

    /** The iterator prefix a name starts with (`iterator_prefixes`), and the base after it. */
    iteratorOf(name: string): { readonly prefix: string; readonly base: string } | undefined {
        for (const prefix of this.spec.data.iterator_prefixes) {
            if (name.startsWith(prefix) && name.length > prefix.length) {
                return { prefix, base: name.slice(prefix.length) };
            }
        }
        return undefined;
    }

    /** The forms of a link, as the game's own output documents them, or none. */
    linkForms(name: string): readonly LinkForm[] {
        const links = this.spec.data.scope_validity.links;
        return Object.prototype.hasOwnProperty.call(links, name) ? (links[name]?.forms ?? []) : [];
    }

    /**
     * True when the name is a link that takes data after a `:` and may start a chain:
     * `scope:x`, `title:k_france`, `var:x` (a form that is global and requires data).
     */
    isDataHead(name: string): boolean {
        return this.linkForms(name).some((form) => form.requires_data && form.global_link);
    }

    /** True when the name is a link that takes data after a `:` (any form requires data). */
    takesData(name: string): boolean {
        return this.linkForms(name).some((form) => form.requires_data);
    }

    /** The scopes a trigger, effect or list supports, as the game's own output documents. */
    scopeValidity(
        group: 'triggers' | 'effects' | 'lists' | 'on_actions',
        name: string,
    ): ScopeRecord | undefined {
        const records = this.spec.data.scope_validity[group];
        return Object.prototype.hasOwnProperty.call(records, name) ? records[name] : undefined;
    }

    /** A message of the error catalogue by its id. */
    message(id: string): CatalogueEntry | undefined {
        return this.catalogue.get(id);
    }
}

const cache = new WeakMap<Spec, Vocabulary>();

/** The name lookups of a package, built once per package. */
export function vocabularyOf(spec: Spec): Vocabulary {
    let vocabulary = cache.get(spec);
    if (vocabulary === undefined) {
        vocabulary = new Vocabulary(spec);
        cache.set(spec, vocabulary);
    }
    return vocabulary;
}
