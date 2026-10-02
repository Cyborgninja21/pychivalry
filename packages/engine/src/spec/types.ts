/**
 * Types of the CK3 spec package (pdx-parser-re `spec/package/ck3-spec-<version>.json`).
 *
 * They mirror `spec/schema.json` (package_format 3). Only the shapes the engine reads are
 * typed in detail; everything else is kept as plain data.
 */

export const BUCKETS = [
    'triggers',
    'effects',
    'links',
    'lists',
    'on_actions',
    'modifiers',
] as const;
export type Bucket = (typeof BUCKETS)[number];

export const FIELD_KINDS = [
    'trigger_block',
    'effect_block',
    'value',
    'block',
    'list',
    'reference',
    'enum',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const SINCE_VALUES = ['<=1.19.0.6', '1.20.0.2'] as const;
export type Since = (typeof SINCE_VALUES)[number];

export interface BucketEntry {
    doc: string;
    provenance?: 'table';
    /** Set on entries an overlay adds (Spec.withOverlay): who provides the name. */
    source?: string;
}

/**
 * Vocabulary layered over the engine's package, e.g. a mod's scripted effects and
 * triggers (the extension's Carnalitas registry). Names are added to the given buckets;
 * names the package already registers keep the package's entry.
 */
export interface SpecOverlay {
    /** Who provides these names (a mod's display name); recorded on each added entry. */
    source: string;
    buckets: Partial<Record<Bucket, Record<string, { doc?: string }>>>;
}

export interface Manifest {
    game: 'ck3';
    version: string;
    exe: { version: string; exe: string; bytes: number; sha256: string; [key: string]: unknown };
    tooling: { [key: string]: unknown };
    generated: string;
    sources: string[];
    source_sha256?: Record<string, string>;
    doc_join?: string;
}

export interface DirectoryEntry {
    path: string;
    content_type: string;
    level: number | null;
    since: Since;
    source: 'scriptable_systems' | 'exe_loader_path' | 'snapshot';
    present_in_vanilla: boolean;
    default_scope?: string;
}

export interface FieldSpec {
    kind: FieldKind;
    holds?: 'modifiers';
    provenance: 'engine' | 'vanilla';
    usage: number;
    required: boolean;
    required_evidence?: string;
    since: Since;
    description?: string;
    wiki_kind?: string;
    hook?: boolean;
    note?: string;
    fields?: Record<string, FieldSpec>;
}

export interface UnconfirmedField {
    provenance: 'wiki';
    usage: 0;
    kind?: FieldKind;
    description?: string;
}

export interface SchemaEntry {
    content_type: string;
    root_scope?: string;
    record_body?: 'trigger_block' | 'effect_block' | 'modifier_block';
    vanilla: { files: number; records: number };
    wiki_seed?: string[];
    fields: Record<string, FieldSpec>;
    unconfirmed?: Record<string, UnconfirmedField>;
}

export interface ErrorEntry {
    id: string;
    category: string;
    text: string;
    since: Since;
    note: string;
}

export interface RetiredEntry {
    name: string;
    bucket: Bucket;
    removed_in: string;
    /** The package schema allows an array or null; a bare string is accepted defensively. */
    replacement: string[] | string | null;
    note: string;
}

export interface NoiseEntry {
    name: string;
    bucket: Bucket;
    reason: string;
}

/** Buckets a keyword template may register names in (schema.json `keywordTemplate`). */
export const KEYWORD_TEMPLATE_BUCKETS = ['triggers', 'effects', 'links', 'lists'] as const;
export type KeywordTemplateBucket = (typeof KEYWORD_TEMPLATE_BUCKETS)[number];

/**
 * A trigger/effect family the engine registers once per key of a database at load time
 * (`has_relation_%s` per scripted relation). (template, keys) is the identity: the same
 * template string can be filled from two databases (`%s_perks`).
 */
export interface KeywordTemplate {
    /** Name with one `%s` slot. */
    template: string;
    bucket: KeywordTemplateBucket;
    /** Database folder whose top-level keys fill `%s` (a path in `directories`). */
    keys: string;
    /** The registrar's built-in documentation. */
    doc: string;
}

/** A name that fills a keyword template, and the database key in its slot. */
export interface KeywordTemplateMatch {
    template: KeywordTemplate;
    key: string;
}

/**
 * Scope validity of one trigger, effect, list or on_action, from the game's own `script_docs`
 * output (package format 3). Scope types are written as the game prints them; `['none']`
 * means the keyword declares no scope requirement (never a reason to report), `[]` that the
 * log gives none.
 */
export interface ScopeRecord {
    /** Scope types the keyword may be used in (lists: the any_ iterator's; on_actions: the expected scope). */
    supported_scopes: string[];
    /** Scope types of the keyword's target (lists: the element type). */
    supported_targets: string[];
    /** The description the game's log prints. */
    description: string;
    /** Triggers: the comparison traits the log prints (`<, <=, =, !=, >, >=`, `yes/no`). */
    traits?: string;
}

/** One form of an event target (link): the global one taking data or the scoped one. */
export interface LinkForm extends ScopeRecord {
    /** Input Scopes in the log (empty for global links). */
    supported_scopes: string[];
    /** Output Scopes in the log. */
    supported_targets: string[];
    requires_data: boolean;
    global_link: boolean;
    wild_card: boolean;
}

export interface LinkScopeRecord {
    forms: LinkForm[];
}

export interface ListScopeRecord extends ScopeRecord {
    /** The iterator names the game documents for the list (any_x, every_x, …). */
    iterators: string[];
    /** True when every iterator form has the same supported scopes and targets. */
    forms_agree: boolean;
}

export interface OnActionScopeRecord extends ScopeRecord {
    /** True for the on_actions the engine fires; false for vanilla's script on_actions. */
    from_code: boolean;
}

export interface ScopeValidity {
    triggers: Record<string, ScopeRecord>;
    effects: Record<string, ScopeRecord>;
    links: Record<string, LinkScopeRecord>;
    lists: Record<string, ListScopeRecord>;
    on_actions: Record<string, OnActionScopeRecord>;
}

/** One scope type of the game (package `scope_types`). */
export interface ScopeTypeEntry {
    /** Links whose output is this type. */
    links: string[];
    /** Lists whose elements are this type. */
    lists: string[];
    /** on_actions whose expected scope is this type. */
    on_actions: string[];
    /** How many triggers / effects support it. */
    triggers: number;
    effects: number;
    input_of_links: number;
    named_as: string[];
    /** Index in the executable's scope-type table, when it has one. */
    binary_index: number | null;
}

export interface SpecPackage {
    package_format: 3;
    manifest: Manifest;
    buckets: Record<Bucket, Record<string, BucketEntry>>;
    modifier_templates: string[];
    keyword_templates: KeywordTemplate[];
    iterator_prefixes: string[];
    multi_bucket: Record<string, Bucket[]>;
    directories: DirectoryEntry[];
    schema: Record<string, SchemaEntry>;
    errors: ErrorEntry[];
    retired: RetiredEntry[];
    noise_dropped: NoiseEntry[];
    scope_validity: ScopeValidity;
    scope_types: Record<string, ScopeTypeEntry>;
}

export interface IteratorMatch {
    prefix: string;
    base: string;
}

export type ModifierMatch = 'static' | 'template';
