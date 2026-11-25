/**
 * The shapes of a format 9 spec package (docs/references/spec-package.md; the package's own
 * schema is `spec/schema.format9.json`): the keys of format 5, the eight parts formats 6 and 7
 * add (D1 to D8), the keys format 8 adds inside D1, D2 and D3, and what format 9 adds: the parts
 * D9, O1 and O2, keys on `directories`, `schema` and `scope_types`, and keys inside C4, D1, D4,
 * D5 and D6. Only what the core reads is typed; every other key of the package keeps its place
 * in `SpecData` as `unknown` and is read through the package itself. Nothing here names a CK3
 * keyword: the keys are the package format's own.
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

/**
 * Format 9: a file of a directory that is not script (`directories[].files.not_script[]`): one
 * file by its name in the directory (`file`), or every file that matches a pattern (`pattern`,
 * `*.info`), with what it is and how sure the package is.
 */
export interface NotScriptEntry {
    readonly file?: string;
    readonly pattern?: string;
    readonly count?: number;
    readonly status: string;
    readonly what: string;
    readonly evidence?: readonly PartEvidence[];
}

/**
 * Format 9: which files of a directory are script (`directories[].files`): the extensions the
 * game's reader takes as script (`script.extensions`; null when not settled), whether it reads
 * the sub-folders (`script.recursive`; null when not settled), and the files present that are
 * not script (`not_script`). Read as script the files of `script.extensions` less those of
 * `not_script`.
 */
export interface DirectoryFiles {
    readonly status: string;
    readonly holds_script: boolean | null;
    readonly script: {
        readonly extensions: readonly string[] | null;
        readonly recursive: boolean | null;
        readonly named_in_executable?: readonly string[];
    };
    readonly not_script: readonly NotScriptEntry[];
    readonly evidence?: readonly PartEvidence[];
    readonly note?: string;
}

/**
 * Format 9: what the root of a record is (`root_scope_rule` of a directory and of its schema):
 * `fixed`, the scope type `default_scope` and `root_scope` name; `caller`, the scope of the place
 * that names the record; `record-field`, a field of the record names it (`root_scope_from`);
 * `per-record`, each record has its own; `no-script`, the records hold no script. Absent: not
 * examined.
 */
export type RootScopeRule = 'fixed' | 'caller' | 'record-field' | 'per-record' | 'no-script';

/** Format 9: the evidence of a root rule (`root_scope_evidence`), with how sure it is. */
export interface RootScopeEvidence {
    /** `confirmed`, `measured-only` or `wiki-only` (a root only the wiki-era seed gives). */
    readonly status: string;
    readonly [key: string]: unknown;
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
    /** Format 9: which of its files are script. */
    readonly files?: DirectoryFiles;
    /** Format 9: what the root of its records is; absent when not examined. */
    readonly root_scope_rule?: RootScopeRule;
    readonly root_scope_from?: { readonly field: string; readonly names: string } | null;
    readonly root_scope_evidence?: RootScopeEvidence;
}

/**
 * Format 9: a block whose keys are names of another database (`open_keys` of a schema directory,
 * field or sub-field): an ethnicity's keys are genes.
 */
export interface OpenKeysRow {
    readonly what: string;
    readonly database: string;
    readonly kind: string;
    readonly status: string;
    readonly recognised_by?: RecognisedBy;
    readonly entries?: Readonly<Record<string, unknown>>;
    readonly evidence: readonly PartEvidence[];
    readonly [key: string]: unknown;
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
    /**
     * The scopes Paradox's `.info` file says the block receives (part C1): `scope` is `root`,
     * `this`, `scope:<name>`, or null for a note about no named scope (the format's schema).
     */
    readonly info_scope?: readonly { readonly scope: string | null; readonly type: string }[];
    readonly note?: string;
    /** Format 9: the keys of this field's block are names of another database. */
    readonly open_keys?: readonly OpenKeysRow[];
    /**
     * Format 9: this "field" is a name of the database given (a gene an ethnicity's block names),
     * which the base game writes, not a field of its own: another name of that database is as valid.
     */
    readonly key_of?: string;
}

/** The record schema of one directory (`schema.<dir>`). */
export interface DirectorySchema {
    readonly content_type: string;
    readonly root_scope?: string;
    /** Format 9: what the root of a record is; judge a record's own level only when `fixed`. */
    readonly root_scope_rule?: RootScopeRule;
    readonly root_scope_from?: { readonly field: string; readonly names: string } | null;
    readonly root_scope_evidence?: RootScopeEvidence;
    /** Format 9: the record's own keys are names of another database. */
    readonly open_keys?: readonly OpenKeysRow[];
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

// ─── The parts of formats 6 to 9 (D1 to D9, O1, O2) ──────────────────────────

/**
 * A part of formats 6 to 9: `built`, its `data` the part tool's output whole, or `not_built`
 * with the reason. Every row of every part carries a `status` and its `evidence`.
 */
export type Part<T> =
    | { readonly status: 'built'; readonly data: T }
    | { readonly status: 'not_built'; readonly reason: string };

/**
 * The keys of the parts, in the order of their `parts` entries: D1 to D8 (formats 6 and 7), then
 * D9, O1 and O2 (format 9).
 */
export const PART_KEYS = [
    'override_rules',
    'declarations',
    'definitions',
    'keyword_roles',
    'implicit_loc_keys',
    'field_references',
    'modifier_block_areas',
    'iterator_kinds',
    'localization_forms',
    'saved_from_code',
    'not_scope_types',
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
    /**
     * Format 8: the line makes its key another name of the record its value names (`of`), as
     * the D1 row `rule` says (a coat of arms written `key = other_key`).
     */
    readonly alias?: { readonly of: string; readonly rule: string };
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

/**
 * Format 8, D3: where a nested name identifies its definition. `global`: on its own among the
 * definitions of its kind; `parent`: only together with the parent `scope_parent` names;
 * `unknown`: not settled.
 */
export type NameScope = 'global' | 'parent' | 'unknown';

/**
 * Format 8, D3: the second part of a `global` name's key that is no parent block (a gene's
 * portrait group): the line that sets it, written before the definitions it applies to.
 */
export interface NameScopeQualifier {
    readonly statement: string;
    readonly default: string;
    readonly says: string;
}

/** A row of D3 `nested`: keys inside a record that are themselves definitions. */
export interface NestedRow extends PartRow {
    readonly kind: string;
    /** The folder whose keys the names are. */
    readonly database: string;
    readonly depth: number | 'any';
    readonly recognised_by: RecognisedBy;
    /** Format 8: the scope of the name. */
    readonly name_scope: NameScope;
    /**
     * Format 8, with `name_scope: parent`: `record` (the top-level record), `container` (the
     * top-level container key) or a leading part of `recognised_by.path` (the block whose key
     * qualifies the name).
     */
    readonly scope_parent?: string;
    /** Format 8: `confirmed`, `measured-only` or `unknown`; never above the row's `status`. */
    readonly name_scope_status: string;
    readonly name_scope_evidence: readonly PartEvidence[];
    readonly name_scope_basis?: string;
    readonly name_scope_qualifier?: NameScopeQualifier;
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
    /**
     * Format 9, a row with the role `combines_conditions`: how the block combines the conditions
     * it holds (`all`, `any`, `negation`, `none`, `not_all`, `count`, `weighted_count`; the
     * part's `vocabulary.combination`).
     */
    readonly combination?: string;
    /**
     * Format 9: what a child that always holds, or always fails, does to the block: `neutral`
     * (removing it changes nothing while another child remains), `makes_it_hold` or
     * `makes_it_fail` (`vocabulary.child_effect`). Absent where logic gives no answer.
     */
    readonly child_always_true?: string;
    readonly child_always_false?: string;
    /** Format 9, a row with the role `constant_condition`: the value that makes it hold, or fail. */
    readonly holds_with?: string;
    readonly fails_with?: string;
    /** Keywords the row's keyword is written with (`ai_will_select` with `ai_chance`). */
    readonly pairs_with?: readonly string[];
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

/**
 * Format 9, D5 `buckets.<bucket>[]`: the localization key of a name that is no record of a folder
 * (a modifier). `name_from` says which names (`bucket:modifiers`, the bucket's own names;
 * `bucket:modifier_templates`, a name that fills a modifier template); the key is `prefix` + the
 * name, as `transform` says (`upper`: in upper case) + `suffix`, unless `literal_keys` gives the
 * name's key whole.
 */
export interface ImplicitLocKeyBucketRow extends PartRow {
    readonly name_from: string;
    readonly pattern: string;
    readonly prefix: string;
    readonly suffix: string;
    readonly transform?: string;
    readonly literal_keys?: Readonly<Record<string, string>>;
    readonly key_source?: string;
    readonly requirement: string;
    readonly requirement_from: string;
}

/** D5, `implicit_loc_keys.data`. */
export interface ImplicitLocKeysData {
    readonly directories: Readonly<Record<string, readonly ImplicitLocKeyRow[]>>;
    /** Format 9: rows for names that are no record of a folder, by bucket. */
    readonly buckets?: Readonly<Record<string, readonly ImplicitLocKeyBucketRow[]>>;
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
    /**
     * Format 9: every distinct value the base game writes there that is a key of none of the
     * row's databases, with why (`sentinel`, `scope_link` or `undefined`).
     */
    readonly miss_values?: readonly {
        readonly value: string;
        readonly uses: number;
        readonly why: string;
    }[];
    /** Format 9: words accepted there that are no key (`none`, `auto`, `0`), each with its evidence. */
    readonly sentinels?: readonly {
        readonly value: string;
        readonly says: string;
        readonly uses?: number;
        readonly evidence: readonly PartEvidence[];
    }[];
    /** Format 9, a `not-a-key` row: what the value is instead (`closed_list` and its values). */
    readonly value_is?: {
        readonly kind: string;
        readonly values?: readonly string[];
        readonly says: string;
    } | null;
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

/**
 * Format 9, D9: one bracket form of localization text that names something by a name. `shape`
 * `bare_key` (a whole expression of one word, with `suffix`), `head` (the first word of a chain)
 * or `function` (`owner.function`, the name at argument `name_arg`); `reads` the kind of name
 * (the part's `vocabulary.reads`).
 */
export interface LocalizationFormRow extends PartRow {
    readonly id: string;
    readonly shape: string;
    readonly reads: string;
    readonly suffix?: string | null;
    readonly owner?: string | null;
    readonly function?: string | null;
    readonly name_arg?: number | null;
}

/** Format 9, D9: a formatting suffix of localization text, after `|`. */
export interface LocalizationSuffixRow extends PartRow {
    readonly id: string;
    readonly character: string;
}

/** Format 9, D9 `localization_forms.data`. */
export interface LocalizationFormsData {
    readonly forms: readonly LocalizationFormRow[];
    readonly suffixes: readonly LocalizationSuffixRow[];
    readonly not_settled: readonly string[];
    readonly counts: Readonly<Record<string, unknown>>;
    readonly vocabulary: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

/**
 * Format 9, O1 `saved_from_code.data`: the names the game's own code saves as scopes for script,
 * with no script statement (`scope:actor`); a `scope:<name>` whose name is listed is defined.
 */
export interface SavedFromCodeData {
    readonly names: readonly string[];
    /** The names that are also keywords, with their buckets. */
    readonly also_keywords: Readonly<Record<string, readonly string[]>>;
    readonly counts: Readonly<Record<string, number>>;
    readonly evidence: readonly PartEvidence[];
    readonly meaning: string;
    readonly consumer: string;
    readonly [key: string]: unknown;
}

/**
 * Format 9, O2 `not_scope_types.data`: the scope values the package names that are no scope
 * type (`none`), each with what it means, and the rule that every scope value is a key of
 * `scope_types` or of `values`.
 */
export interface NotScopeTypesData {
    readonly values: Readonly<
        Record<
            string,
            {
                readonly means: string;
                readonly consumer: string;
                readonly evidence: readonly PartEvidence[];
                readonly [key: string]: unknown;
            }
        >
    >;
    readonly rule: string;
    readonly meaning: string;
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
    readonly localization_forms: LocalizationFormsData;
    readonly saved_from_code: SavedFromCodeData;
    readonly not_scope_types: NotScopeTypesData;
}

/**
 * One record of `scope_types`: what the game's documentation says of a scope type. Format 9 adds
 * where the game's own list of scope types names it (`listed_in`) and whether a trigger, effect,
 * link, list or on-action names it (`named_by_keywords`: false only for a type only that list
 * names).
 */
export interface ScopeTypeRecord {
    readonly links: readonly string[];
    readonly lists: readonly string[];
    readonly on_actions: readonly string[];
    readonly triggers: number;
    readonly effects: number;
    readonly named_as: readonly string[];
    readonly listed_in?: { readonly file: string; readonly line: number } | null;
    readonly named_by_keywords?: boolean;
    readonly [key: string]: unknown;
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
    readonly scope_types: Readonly<Record<string, ScopeTypeRecord>>;
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
    readonly localization_forms: Part<LocalizationFormsData>;
    readonly saved_from_code: Part<SavedFromCodeData>;
    readonly not_scope_types: Part<NotScopeTypesData>;
    readonly [key: string]: unknown;
}
