/**
 * The shapes of a format 7 spec package (docs/references/spec-package.md; the package's own
 * schema is `spec/schema.format7.json`): the keys of format 5 and the eight parts formats 6
 * and 7 add (D1 to D8). Only what the core reads is typed; every other key of the package
 * keeps its place in `SpecData` as `unknown` and is read through the package itself. Nothing
 * here names a CK3 keyword: the keys are the package format's own.
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
    /** The game version whose executable first has the field. */
    readonly since?: string;
    /** The counts the measured `value_type` was read from (part B1). */
    readonly value_type_evidence?: unknown;
    /** The wiki seed's type, a hint beside `value_type` (part B1). */
    readonly wiki_type?: string;
    /** The measurement behind `loc_key` (part B3). */
    readonly loc_key_evidence?: unknown;
    /** How `scope` was measured. */
    readonly scope_evidence?: string;
    /** The scopes Paradox's `.info` file says the block receives (part C1). */
    readonly info_scope?: readonly { readonly scope: string; readonly type: string }[];
    readonly note?: string;
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

// ─── The eight parts of formats 6 and 7 (D1 to D8) ──────────────────────────

/**
 * A part of format 6 or 7: `built`, its `data` the part tool's output whole, or `not_built`
 * with the reason. Every row of every part carries a `status` and its `evidence`.
 */
export type Part<T> =
    | { readonly status: 'built'; readonly data: T }
    | { readonly status: 'not_built'; readonly reason: string };

/** The keys of the eight parts, in the order of their `parts` entries (D1 to D8). */
export const PART_KEYS = [
    'override_rules',
    'declarations',
    'definitions',
    'keyword_roles',
    'implicit_loc_keys',
    'field_references',
    'modifier_block_areas',
    'iterator_kinds',
] as const;
export type PartKey = (typeof PART_KEYS)[number];

/**
 * One evidence item of a row of D1 to D8: its rank (1 the executable, 2 the game's own output
 * and the catalogue, 3 Paradox's `.info` files, 4 measured base-game use), its source and what
 * it shows; the other keys vary with the source.
 */
export interface PartEvidence {
    readonly rank: number;
    readonly source: string;
    readonly says?: string;
    readonly supports?: string;
    readonly where?: string;
    readonly [key: string]: unknown;
}

/** What every row of D1 to D8 carries: its status and its evidence. */
export interface PartRow {
    readonly status: string;
    readonly evidence: readonly PartEvidence[];
    readonly [key: string]: unknown;
}

/** D1, `override_rules.data`: the override rules as a table (docs/overrides.md). */
export interface OverrideRulesData {
    /** The table's own format, 1. */
    readonly format: number;
    readonly game_build: string;
    readonly version: string;
    /** The rows: pychivalry's nine kinds and the extension kinds, each with its `status`. */
    readonly rules: readonly PartRow[];
    /** One entry per folder of `directories`: which rows govern it. */
    readonly coverage: readonly Readonly<Record<string, unknown>>[];
    /** What the table adds to pychivalry's vocabulary, each with its reason. */
    readonly extensions: readonly {
        readonly id: string;
        readonly name: string;
        readonly reason: string;
        readonly what: string;
    }[];
    readonly measured_cases: unknown;
    readonly stand_in: unknown;
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** How a row of D2 or D3 matches a key: the word itself, a whole-key pattern, or a prefix. */
export type KeyMatch = 'exact' | 'pattern' | 'prefix';

/** A row of D2: a top-level form of a folder's files that is not, or is, a record. */
export interface DeclarationRow extends PartRow {
    readonly key: string;
    readonly match: KeyMatch;
    /** `block`, `value`, `prefixed`, `constant`, `bare-value`, `block-no-equals`, ... */
    readonly form: string;
    /** `namespace`, `constant`, `container`, `inline-definition`, `setting`, `statement`, `record`, `unknown`. */
    readonly declares: string;
    /** `file`, `folder`, `global` or `unknown`. */
    readonly scope: string;
    /** `confirmed`, `measured-only` or `unknown`. */
    readonly status: string;
}

/** D2, `declarations.data`. */
export interface DeclarationsData {
    /** Per folder of `directories`, its rows (`[]` when it has none). */
    readonly directories: Readonly<Record<string, readonly DeclarationRow[]>>;
    /** The rows that hold in every folder. */
    readonly all_directories: readonly DeclarationRow[];
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** How a nested definition is recognised (D3, `recognised_by`). */
export interface RecognisedBy {
    /** `parent-field`, `container-child`, `any-block-child`, `key-pattern` or `record-key`. */
    readonly type: string;
    /** Keys from the top level, `/`-separated; each `*` or a whole-key pattern. */
    readonly path: string;
    readonly forms: readonly string[];
    /** `key-pattern`: the pattern a title-like key matches. */
    readonly pattern?: string;
    /** Children that are fields, not definitions. */
    readonly except?: readonly string[];
    /** `record-key`: the field whose presence makes the record's key a name of this kind. */
    readonly field?: string;
    readonly word?: string;
}

/** A row of D3 `nested`: keys inside a record that are themselves definitions. */
export interface NestedRow extends PartRow {
    readonly kind: string;
    /** The folder whose keys the names are. */
    readonly database: string;
    readonly depth: number | 'any';
    readonly recognised_by: RecognisedBy;
}

/** A row of D3 `file_named`: whether a folder's records are named by their file. */
export interface FileNamedRow extends PartRow {
    /** `file-stem`, `none` or `unknown`. */
    readonly name_from: string;
    readonly names_database: readonly string[];
}

/** D3, `definitions.data`. */
export interface DefinitionsData {
    readonly nested: Readonly<Record<string, readonly NestedRow[]>>;
    readonly not_definitions: Readonly<Record<string, readonly PartRow[]>>;
    /** Per folder; an empty object when nothing was found. */
    readonly file_named: Readonly<Record<string, FileNamedRow | Readonly<Record<string, never>>>>;
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** A row of D4: what a structural keyword does where it is written. */
export interface KeywordRoleRow extends PartRow {
    readonly keyword: string;
    readonly where: {
        readonly directories: 'anywhere' | readonly string[];
        readonly inside: string;
        readonly parents?: readonly string[];
    };
    readonly roles: readonly string[];
    readonly role_status: Readonly<Record<string, string>>;
    /** Roles an existing package entry already gives, with the entry. */
    readonly stated_elsewhere?: readonly {
        readonly role: string;
        readonly opens?: string;
        readonly see: string;
    }[];
}

/** D4, `keyword_roles.data`. */
export interface KeywordRolesData {
    readonly keywords: readonly KeywordRoleRow[];
    readonly not_settled: readonly string[];
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** A row of D5: a localization key a record has by its name. */
export interface ImplicitLocKeyRow extends PartRow {
    readonly pattern: string;
    readonly prefix: string;
    readonly suffix: string;
    /** `record-key`, `file-stem` or `nested:<kind>`. */
    readonly name_from: string;
    /** `required`, `optional`, `always-present-in-base-game` (a measurement) or `unknown`. */
    readonly requirement: string;
    readonly requirement_from: string;
}

/** D5, `implicit_loc_keys.data`. */
export interface ImplicitLocKeysData {
    readonly directories: Readonly<Record<string, readonly ImplicitLocKeyRow[]>>;
    readonly not_settled: unknown;
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** A row of D6: the databases a field's, a parameter's or a value's names are keys of. */
export interface FieldReferenceRow extends PartRow {
    readonly id: string;
    /** `field`, `parameter`, `value`, `info` or `other`. */
    readonly kind: string;
    readonly directory?: string;
    readonly bucket?: string;
    /** A field path (`fallback`, `random_on_action.<number>`) or `<keyword>.<parameter>`. */
    readonly path: string;
    readonly refers_to: readonly string[];
    /** `key`, `list of keys`, `key or list of keys`, or null. */
    readonly value_form: string | null;
}

/** D6, `field_references.data`. */
export interface FieldReferencesData {
    readonly fields: readonly FieldReferenceRow[];
    /** Per database, the ids of the rows whose `refers_to` holds it. */
    readonly by_database: Readonly<Record<string, readonly string[]>>;
    readonly not_settled: unknown;
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** A row of D7: the use areas a block that holds modifiers is read with. */
export interface ModifierBlockAreaRow extends PartRow {
    /** `<folder>::<field>`, `<folder>::(record)`, `<folder>::*.<g>` or `<folder>::**.<key>`. */
    readonly id: string;
    readonly directory: string;
    readonly path: string;
    readonly use_areas: readonly string[];
    readonly holds_from: readonly string[];
    /** A family row: the keys its `*` stands for. */
    readonly members?: readonly string[];
}

/** D7, `modifier_block_areas.data`. */
export interface ModifierBlockAreasData {
    readonly fields: readonly ModifierBlockAreaRow[];
    readonly engine_check: readonly PartEvidence[];
    readonly not_settled: readonly string[];
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** D8: the kind of block an iterator prefix belongs in. */
export interface IteratorPrefixRow extends PartRow {
    readonly prefix: string;
    /** `trigger` or `effect`. */
    readonly kind: string;
    readonly body: string;
}

/** D8, `iterator_kinds.data`. */
export interface IteratorKindsData {
    readonly prefixes: readonly IteratorPrefixRow[];
    /** Per list of the lists bucket: its documented forms and where the base game writes them. */
    readonly lists: Readonly<
        Record<string, { readonly forms: Readonly<Record<string, string>>; readonly [k: string]: unknown }>
    >;
    readonly departures: readonly PartRow[];
    readonly limit_rule: PartRow;
    readonly context_rules: readonly PartRow[];
    readonly not_settled: readonly string[];
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/** The data of each part, by its key. */
export interface PartData {
    readonly override_rules: OverrideRulesData;
    readonly declarations: DeclarationsData;
    readonly definitions: DefinitionsData;
    readonly keyword_roles: KeywordRolesData;
    readonly implicit_loc_keys: ImplicitLocKeysData;
    readonly field_references: FieldReferencesData;
    readonly modifier_block_areas: ModifierBlockAreasData;
    readonly iterator_kinds: IteratorKindsData;
}

/** A modifier template tag (part A1, `modifier_template_tags.data`): the game's own form. */
export interface ModifierTemplateTag {
    /** The template the form fills, `%s` standing for the placeholder. */
    readonly form: string;
    readonly use_areas: readonly string[] | null;
    readonly [key: string]: unknown;
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
    readonly modifier_template_tags: {
        readonly status: string;
        readonly data: Readonly<Record<string, ModifierTemplateTag>>;
    };
    readonly override_rules: Part<OverrideRulesData>;
    readonly declarations: Part<DeclarationsData>;
    readonly definitions: Part<DefinitionsData>;
    readonly keyword_roles: Part<KeywordRolesData>;
    readonly implicit_loc_keys: Part<ImplicitLocKeysData>;
    readonly field_references: Part<FieldReferencesData>;
    readonly modifier_block_areas: Part<ModifierBlockAreasData>;
    readonly iterator_kinds: Part<IteratorKindsData>;
    readonly [key: string]: unknown;
}
