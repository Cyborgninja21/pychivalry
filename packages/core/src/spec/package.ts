/**
 * The shapes of a format 5 spec package (docs/references/spec-package.md; the package's own
 * schema is `spec/schema.format5.json`). Only what the core reads is typed; every other key
 * of the package keeps its place in `SpecData` as `unknown` and is read through the package
 * itself. Nothing here names a CK3 keyword: the keys are the package format's own.
 */

/** The six keyword buckets, by their names in the package (`buckets.<name>`). */
export const BUCKET_NAMES = [
    'triggers',
    'effects',
    'links',
    'lists',
    'on_actions',
    'modifiers',
] as const;
export type BucketName = (typeof BUCKET_NAMES)[number];

/** One reading of a trigger's or effect's usage line (part A5, `takes.readings[]`). */
export interface TakesReading {
    readonly form: string;
    readonly parts: readonly string[];
    readonly sources: readonly string[];
    readonly text: string;
}

/** What a trigger or effect takes (part A5); `null` in the package when nothing says. */
export interface Takes {
    readonly forms: readonly string[];
    readonly readings: readonly TakesReading[];
    readonly disagreement: unknown;
}

/** An entry of a bucket. */
export interface KeywordEntry {
    /** The executable's own documentation, verbatim; empty when it has none. */
    readonly doc: string;
    /** Triggers and effects only: what it takes, or null when no usage line says (never a guess). */
    readonly takes?: Takes | null;
    /** Modifiers only: where the game's modifier log says it may be used, or null. */
    readonly use_areas?: readonly string[] | null;
    readonly provenance?: string;
}

/** A trigger or effect registered once per key of a database (`keyword_templates[]`). */
export interface KeywordTemplate {
    readonly template: string;
    readonly bucket: BucketName;
    /** The folder whose top-level keys fill `%s`. */
    readonly keys: string;
    readonly doc: string;
}

/** A mark on a modifier template that is no proof alone (`modifier_template_marks`). */
export interface ModifierTemplateMark {
    readonly mark: string;
    readonly fixed_text: string;
    readonly game_tags: readonly string[];
    /** The game's own forms that rest on the marked template alone. */
    readonly sole_cover_of: readonly string[];
}

/** One directory of the game (`directories[]`). */
export interface Directory {
    readonly path: string;
    readonly content_type: string;
    readonly level: number | null;
    readonly since: string;
    readonly source: string;
    readonly present_in_vanilla: boolean;
    readonly default_scope?: string;
}

/** One field of a record schema, or a sub-field (`schema.<dir>.fields.<name>`). */
export interface SchemaField {
    readonly kind: string;
    readonly provenance: string;
    readonly required: boolean;
    readonly required_evidence?: string;
    readonly usage?: number;
    readonly record_usage?: number;
    readonly value_type?: string;
    readonly values?: readonly { readonly value: string; readonly count: number }[];
    readonly loc_key?: boolean;
    /** `modifiers` when the field's block holds modifiers. */
    readonly holds?: string;
    readonly scope?: readonly string[];
    readonly info_type?: readonly string[];
    readonly fields?: Readonly<Record<string, SchemaField>>;
    readonly description?: string;
    readonly description_source?: string;
}

/** The record schema of one directory (`schema.<dir>`). */
export interface DirectorySchema {
    readonly content_type: string;
    readonly root_scope?: string;
    /** How a record's body is read, where the package says: a trigger or an effect block. */
    readonly record_body?: string;
    readonly vanilla?: { readonly files: number; readonly records: number };
    readonly fields: Readonly<Record<string, SchemaField>>;
    readonly unconfirmed?: Readonly<Record<string, unknown>>;
}

/** One message of the error catalogue (`errors[]`; part A4 adds `script_facing` and `subject`). */
export interface CatalogueEntry {
    readonly id: string;
    readonly text: string;
    readonly category: string;
    readonly since: string;
    readonly note: string;
    readonly script_facing: 'yes' | 'no' | 'unknown';
    readonly reason: string;
    readonly subject: string;
    readonly subject_reason: string;
}

/** A keyword the package marks removed (`retired[]`). */
export interface RetiredEntry {
    readonly name: string;
    readonly bucket: BucketName;
    readonly removed_in: string;
    readonly replacement: readonly string[] | null;
    readonly note: string;
}

/** The scopes a trigger, effect, list or on-action supports (`scope_validity`). */
export interface ScopeRecord {
    readonly supported_scopes: readonly string[];
    readonly supported_targets: readonly string[];
    readonly description: string;
    readonly traits?: string;
    readonly iterators?: readonly string[];
    readonly from_code?: boolean;
}

/** One form of a link (`scope_validity.links.<name>.forms[]`). */
export interface LinkForm {
    readonly supported_scopes: readonly string[];
    readonly supported_targets: readonly string[];
    readonly description: string;
    readonly global_link: boolean;
    readonly requires_data: boolean;
    readonly wild_card: boolean;
}

export interface ScopeValidity {
    readonly triggers: Readonly<Record<string, ScopeRecord>>;
    readonly effects: Readonly<Record<string, ScopeRecord>>;
    readonly lists: Readonly<Record<string, ScopeRecord>>;
    readonly on_actions: Readonly<Record<string, ScopeRecord>>;
    readonly links: Readonly<Record<string, { readonly forms: readonly LinkForm[] }>>;
}

/** A companion the package lists (`manifest.companions.<file>`). */
export interface CompanionRecord {
    readonly part: string;
    readonly key: string;
    readonly sha256: string;
    readonly bytes: number;
}

/** One evidence item of a table entry; its other keys vary with its `kind`. */
export interface TableEvidence {
    readonly kind: string;
    readonly shows?: string;
    readonly buckets?: readonly string[];
    readonly bases_found?: readonly string[];
    readonly [key: string]: unknown;
}

/** Where the game's own output contradicts a table entry (`contradicted[]`). */
export interface TableContradiction {
    readonly claim: string;
    readonly evidence: readonly TableEvidence[];
    readonly finding: string;
}

/** One entry of a hand-kept table (part C4); its attributes vary with the table. */
export interface TableEntry {
    readonly evidence_status: 'confirmed' | 'contradicted' | 'none';
    readonly evidence?: readonly TableEvidence[] | 'none';
    readonly contradicted?: readonly TableContradiction[];
    readonly [attribute: string]: unknown;
}

/** One hand-kept table (`tables.data.<name>`). Candidates are listed apart and never entries. */
export interface Table {
    readonly about: Readonly<Record<string, unknown>>;
    readonly entries: Readonly<Record<string, TableEntry>>;
    readonly candidates?: unknown;
}

/** The package file, parsed. Keys the core does not read stay `unknown`. */
export interface SpecData {
    readonly package_format: number;
    readonly manifest: {
        readonly game: string;
        readonly version: string;
        readonly companions: Readonly<Record<string, CompanionRecord>>;
        readonly [key: string]: unknown;
    };
    readonly parts: readonly { readonly id: string; readonly status: string }[];
    readonly buckets: Readonly<Record<BucketName, Readonly<Record<string, KeywordEntry>>>>;
    readonly multi_bucket: Readonly<Record<string, readonly BucketName[]>>;
    readonly iterator_prefixes: readonly string[];
    readonly keyword_templates: readonly KeywordTemplate[];
    readonly modifier_templates: readonly string[];
    readonly modifier_template_marks: Readonly<Record<string, ModifierTemplateMark>>;
    readonly directories: readonly Directory[];
    readonly schema: Readonly<Record<string, DirectorySchema>>;
    readonly errors: readonly CatalogueEntry[];
    readonly retired: readonly RetiredEntry[];
    readonly scope_validity: ScopeValidity;
    readonly scope_types: Readonly<Record<string, unknown>>;
    readonly tables: {
        readonly status: string;
        readonly data: Readonly<Record<string, Table>>;
    };
    readonly [key: string]: unknown;
}
