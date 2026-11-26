/**
 * The shape of a lookup's answer (docs/PLAN.md item 4.8): structured data that the command
 * line, the agent server and the editor's hover each render. Every part says where it comes
 * from, and where the spec package has nothing the part says so (a `status` with a `why`);
 * nothing is guessed and no gap is filled from another source.
 *
 * Places in files are the index's: `layer`, `file` (the path inside the layer, with `/`) and
 * `range`, whose lines and characters count from 0 as the parser's do.
 */

import type { Definition, UnknownReason } from '../index/workspace.js';
import type { DataTypeEntry } from '../spec/data-types.js';
import type {
    BucketName,
    PartEvidence,
    PartRow,
    RetiredEntry,
    TableEntry,
    TableEvidence,
    TakesReading,
} from '../spec/package.js';
import type { Range } from '../syntax/position.js';

// ─── The parts every reading has ────────────────────────────────────────────

/**
 * Where a description comes from: `doc`, the executable's own text for the name's registration
 * (`buckets.<bucket>.<name>.doc`); `script_docs`, the game's own documentation output
 * (`scope_validity`); `info`, Paradox's `.info` files; `wiki`, the wiki-era seed files.
 */
export type DescriptionSource = 'doc' | 'script_docs' | 'info' | 'wiki';

/** A description, with every source that gives this same text. */
export interface DescriptionText {
    readonly text: string;
    readonly sources: readonly DescriptionSource[];
}

export type DescriptionAnswer =
    | { readonly status: 'known'; readonly texts: readonly DescriptionText[] }
    | { readonly status: 'none'; readonly why: string };

/** One form of a link, as the game's own output documents it. */
export interface LinkFormAnswer {
    readonly scopes: readonly string[];
    readonly targets: readonly string[];
    readonly description: string;
    readonly globalLink: boolean;
    readonly requiresData: boolean;
    readonly wildCard: boolean;
}

/** A modifier template tag of part A1 a name fills: the game's own form, with its use areas. */
export interface TemplateTagAnswer {
    readonly tag: string;
    readonly form: string;
    /** Null when the game's modifier log gives the form none. */
    readonly useAreas: readonly string[] | null;
}

/**
 * The scopes a name supports, kept apart by what the package says:
 *
 * - `supported`: the scopes the game's own output lists (and the scopes its target must be);
 * - `no-requirement`: the game's output declares no requirement (`none`);
 * - `not-documented`: the game documents none for this name;
 * - `use-areas`: a modifier, where the game's modifier log says it may be used;
 * - `by-template-tag`: a name that fills modifier template tags, each with its own use areas;
 * - `link-forms`: a link, per form;
 * - `field`: a schema field, from the measured uses and from Paradox's `.info` files;
 * - `not-applicable`: the question does not arise for this kind of reading.
 */
export type ScopesAnswer =
    | {
          readonly status: 'supported';
          readonly scopes: readonly string[];
          readonly targets: readonly string[];
          readonly source: 'script_docs';
      }
    | {
          readonly status: 'no-requirement';
          readonly targets: readonly string[];
          readonly source: 'script_docs';
      }
    | { readonly status: 'not-documented'; readonly why: string }
    | {
          readonly status: 'use-areas';
          readonly areas: readonly string[];
          readonly source: 'modifier_log';
      }
    | { readonly status: 'by-template-tag'; readonly tags: readonly TemplateTagAnswer[] }
    | { readonly status: 'link-forms'; readonly forms: readonly LinkFormAnswer[] }
    | {
          readonly status: 'field';
          /** The scopes measured at the field in the base game, with how they were measured. */
          readonly measured: {
              readonly scopes: readonly string[];
              readonly evidence: string;
          } | null;
          /** The scopes Paradox's `.info` file says the block receives. */
          readonly info: readonly { readonly scope: string | null; readonly type: string }[] | null;
          /** The record's root scope, where the schema states one. */
          readonly recordRoot: string | null;
      }
    | { readonly status: 'not-applicable'; readonly why: string };

/**
 * What a trigger or effect takes (part A5): its forms and readings, with any disagreement;
 * `no-usage-line` where the game gives none (the package's `null`).
 */
export type TakesAnswer =
    | {
          readonly status: 'known';
          readonly forms: readonly string[];
          readonly readings: readonly TakesReading[];
          readonly disagreement: unknown;
      }
    | { readonly status: 'no-usage-line'; readonly why: string }
    | { readonly status: 'unknown'; readonly why: string }
    | { readonly status: 'not-applicable'; readonly why: string };

/** The game version that first has the name, where the package records one. */
export type SinceAnswer =
    | { readonly status: 'known'; readonly since: string }
    | { readonly status: 'unknown'; readonly why: string };

/** The parts every reading has, each with a status where the package may have nothing. */
export interface ReadingBase {
    readonly description: DescriptionAnswer;
    readonly scopes: ScopesAnswer;
    readonly takes: TakesAnswer;
    readonly since: SinceAnswer;
    /** The package's removals of the name in this reading's bucket (`retired`); empty for none. */
    readonly retired: readonly RetiredEntry[];
    /**
     * True when the derivation has the name and the game's own output does not document it
     * (kept, never dropped: docs/MVP.md "Derived names"); false when the game documents it;
     * null where the question does not arise.
     */
    readonly derivedOnly: boolean | null;
}

// ─── What a value or a parameter names (part D6) ───────────────────────────

/** A row of part D6: the databases a field's, a value's or a parameter's names are keys of. */
export interface ReferenceAnswer {
    readonly id: string;
    readonly path: string;
    readonly refersTo: readonly string[];
    readonly valueForm: string | null;
    readonly status: string;
    readonly evidence: readonly PartEvidence[];
}

// ─── Localization ──────────────────────────────────────────────────────────

/** One definition of a localization key, with its text. */
export interface LocalizationTextAnswer {
    /** The language its file's header names (`l_english`). */
    readonly language: string;
    /** The text between the quotes, or null when the file could not be read. */
    readonly text: string | null;
    readonly layer: string;
    readonly file: string;
    readonly range: Range;
    /** Whether this copy is the one in force, by the override rules; `not-known` when no row decides. */
    readonly inForce: 'yes' | 'no' | 'not-known';
}

/**
 * A localization key the package ties to a name: a row of part D5 (a key a record has by its
 * name) for a folder in which the index holds a definition of the name.
 */
export interface LocalizationKeyAnswer {
    readonly key: string;
    /**
     * The definitions whose records the key belongs to (the name defined in the row's folder);
     * empty for a key of a bucket row, which belongs to no record.
     */
    readonly records: readonly {
        readonly database: string;
        readonly layer: string;
        readonly file: string;
        readonly range: Range;
    }[];
    /**
     * The D5 row the key comes from, with its status and evidence: a row of a folder
     * (`directory`), or, since format 9, a row of the modifiers bucket (`directory` null,
     * `nameFrom` `bucket:modifiers` or `bucket:modifier_templates`).
     */
    readonly row: {
        readonly directory: string | null;
        readonly pattern: string;
        readonly nameFrom: string;
        readonly requirement: string;
        readonly requirementFrom: string;
        readonly status: string;
        readonly evidence: readonly PartEvidence[];
    };
    /** Every definition of the key in the index, in every language (or the one asked for). */
    readonly texts: readonly LocalizationTextAnswer[];
}

/**
 * A modifier's localization, read through the index from the files a caller can read. Absent
 * (`no-game-folder`) when no workspace index or no file source is given.
 */
export type LocalizationAnswer =
    | { readonly status: 'no-game-folder'; readonly why: string }
    | {
          readonly status: 'read';
          readonly keys: readonly LocalizationKeyAnswer[];
          readonly why: string | null;
      };

// ─── The readings ──────────────────────────────────────────────────────────

/** The form of a list's iterator with one prefix (part D8). */
export interface IteratorFormAnswer {
    readonly prefix: string;
    readonly name: string;
    /** The kind of block D8 documents the form in (`trigger`, `effect`), or null. */
    readonly kind: string | null;
    /** True when the game's own output lists this iterator for the list. */
    readonly documented: boolean;
}

/** A name of one of the six buckets. */
export interface BucketReading extends ReadingBase {
    readonly kind: 'bucket';
    readonly bucket: BucketName;
    /** The other buckets the package has the name in. */
    readonly alsoIn: readonly BucketName[];
    /** Triggers and effects: the databases part D6 says the keyword's value names. */
    readonly valueNames: readonly ReferenceAnswer[];
    /** Triggers and effects: the parameters part D6 says name a database. */
    readonly parameters: readonly ReferenceAnswer[];
    /** Lists: the iterator form of each prefix (part D8); null for the other buckets. */
    readonly iterators: readonly IteratorFormAnswer[] | null;
    /** On-actions: whether the game fires it from its code; null for the other buckets. */
    readonly fromCode: boolean | null;
    /** Modifiers: how the package has it, and its localization; null for the other buckets. */
    readonly modifier: {
        readonly provenance: string | null;
        readonly localization: LocalizationAnswer;
    } | null;
}

/** An on-action the game's own output documents and the on-actions bucket does not list. */
export interface DocumentedOnActionReading extends ReadingBase {
    readonly kind: 'documented-on-action';
    readonly fromCode: boolean;
}

/** A trigger or effect the engine registers once per key of a database (`keyword_templates`). */
export interface KeywordTemplateReading extends ReadingBase {
    readonly kind: 'keyword-template';
    readonly bucket: BucketName;
    readonly template: string;
    /** The database whose keys fill `%s`. */
    readonly database: string;
    /** The text standing for `%s`. */
    readonly key: string;
    /** Whether the index holds the key in that database; null without a workspace. */
    readonly keyDefined: boolean | null;
}

/** An iterator: a prefix and a list. */
export interface IteratorReading extends ReadingBase {
    readonly kind: 'iterator';
    readonly prefix: string;
    readonly base: string;
    /** The lists bucket has the base, or the index holds it in a folder of `vanilla_indexed_dirs`. */
    readonly list:
        { readonly from: 'lists' } | { readonly from: 'defined'; readonly database: string };
    /** What part D8 says the prefix's iterators are, with the row's status and evidence. */
    readonly prefixKind: {
        readonly kind: string;
        readonly body: string;
        readonly status: string;
        readonly evidence: readonly PartEvidence[];
    } | null;
    /** The kind of block D8 documents this list's form with the prefix in; null when it does not. */
    readonly formKind: string | null;
    /** Part D8's departures that name this iterator. */
    readonly departures: readonly PartRow[];
}

/** A name part D8 records as a departure from the iterator forms, where no iterator reading is. */
export interface IteratorDepartureReading extends ReadingBase {
    readonly kind: 'iterator-departure';
    readonly row: PartRow;
}

/** A modifier mark (`modifier_template_marks`) on a template the name fills. */
export interface TemplateMarkAnswer {
    readonly template: string;
    /** `bare_suffix`: the template accepts every name with its suffix and is no proof alone. */
    readonly mark: string;
    readonly fixedText: string;
    readonly gameTags: readonly string[];
    /** The game's own forms resting on the marked template that the name fills. */
    readonly formsFilled: readonly string[];
}

/** A name that fills a modifier template (`modifier_templates`). */
export interface ModifierTemplateReading extends ReadingBase {
    readonly kind: 'modifier-template';
    /**
     * `template`: a template that is proof, or a game form resting on a marked one; `marked-only`:
     * only templates the package marks as no proof alone, so the name is neither proved nor refuted.
     */
    readonly proof: 'template' | 'marked-only';
    readonly templates: readonly string[];
    readonly marks: readonly TemplateMarkAnswer[];
    /** Its localization, as for a modifier of the bucket. */
    readonly localization: LocalizationAnswer;
}

/** A field or sub-field of a record schema. */
export interface FieldReading extends ReadingBase {
    readonly kind: 'field';
    /** The folder whose records have it. */
    readonly directory: string;
    /** The keys from the record down to it, the name last. */
    readonly path: readonly string[];
    /** True for a field the wiki-era seeds give that the base game never sets (`unconfirmed`). */
    readonly unconfirmed: boolean;
    /** The package's kind of the field (`value`, `block`, `trigger_block`, ...). */
    readonly fieldKind: string;
    readonly provenance: string;
    readonly required: { readonly required: boolean; readonly evidence: string | null };
    /** How many base-game files and records set it. */
    readonly usage: { readonly files: number | null; readonly records: number | null };
    /** The measured value type, with the counts it was read from, and the other sources' types. */
    readonly valueType:
        | {
              readonly status: 'measured';
              readonly type: string;
              readonly evidence: unknown;
              readonly wikiType: string | null;
              readonly infoType: readonly string[] | null;
          }
        | { readonly status: 'unknown'; readonly why: string };
    /** The values the base game writes, where it writes at most 20. */
    readonly values:
        | {
              readonly status: 'observed';
              readonly values: readonly { readonly value: string; readonly count: number }[];
          }
        | { readonly status: 'not-recorded'; readonly why: string };
    /** Whether the field holds a localization key (part B3), with the measurement. */
    readonly localizationKey:
        | { readonly status: 'yes'; readonly evidence: unknown }
        | { readonly status: 'not-marked'; readonly why: string };
    /** `modifiers` when its block holds modifiers; null otherwise. */
    readonly holds: string | null;
    /** What part D6 says its values name. */
    readonly refersTo: readonly ReferenceAnswer[];
    /** The use areas part D7 says its modifier block accepts; null when D7 has no row for it. */
    readonly useAreas: {
        readonly id: string;
        readonly useAreas: readonly string[];
        readonly status: string;
        readonly evidence: readonly PartEvidence[];
    } | null;
    /** The package's note on the field, where it writes one. */
    readonly note: string | null;
}

/** A parameter of a trigger or effect that part D6 says names a database. */
export interface KeywordParameterReading extends ReadingBase {
    readonly kind: 'keyword-parameter';
    readonly bucket: string;
    readonly keyword: string;
    readonly reference: ReferenceAnswer;
}

/** A structural keyword (part D4): what it does where it is written. */
export interface KeywordRoleReading extends ReadingBase {
    readonly kind: 'keyword-role';
    readonly where: unknown;
    readonly roles: readonly string[];
    readonly roleStatus: Readonly<Record<string, string>>;
    readonly status: string;
    readonly evidence: readonly PartEvidence[];
    readonly statedElsewhere: readonly unknown[];
    readonly note: string | null;
}

/** A declaration that is not a record (part D2). */
export interface DeclarationReading extends ReadingBase {
    readonly kind: 'declaration';
    /** The folder whose files declare it; null for a row that holds in every folder. */
    readonly directory: string | null;
    readonly key: string;
    readonly match: string;
    readonly form: string;
    readonly declares: string;
    readonly scope: string;
    readonly status: string;
    readonly evidence: readonly PartEvidence[];
}

/** An entry of a hand-kept table (part C4), as the trust rule reads it. */
export interface TableEntryReading extends ReadingBase {
    readonly kind: 'table-entry';
    readonly table: string;
    /** What the table is for (`about.meaning`), or null. */
    readonly meaning: string | null;
    /** True for a candidate the game's documentation names, read only to accept its key. */
    readonly candidate: boolean;
    readonly evidenceStatus: TableEntry['evidence_status'];
    readonly evidence: readonly TableEvidence[] | 'none';
    /** What the trust rule does with the entry (`read`, `widened`, `accept-only`, `not-read`). */
    readonly trust: { readonly use: string; readonly why: string } | null;
    /** The entry's own attributes, as the package writes them, without its evidence. */
    readonly attributes: Readonly<Record<string, unknown>>;
}

/** A name the index holds in a folder of `vanilla_indexed_dirs`: script can call it by name. */
export interface DefinedReading extends ReadingBase {
    readonly kind: 'defined';
    readonly database: string;
    /** The bucket it is called as (its folder's `record_body`), or null where any block may name it. */
    readonly calledAs: BucketName | null;
}

/** A scope type (`scope_types`): how the game's output names it, with counts. */
export interface ScopeTypeReading extends ReadingBase {
    readonly kind: 'scope-type';
    readonly namedAs: readonly string[];
    readonly binaryIndex: number | null;
    readonly counts: {
        readonly links: number;
        readonly lists: number;
        readonly onActions: number;
        readonly triggers: number;
        readonly effects: number;
        readonly inputOfLinks: number;
    };
}

/** A keyword the package marks removed, in a bucket that no longer lists it. */
export interface RetiredReading extends ReadingBase {
    readonly kind: 'retired';
    readonly bucket: BucketName;
    readonly entry: RetiredEntry;
}

/** A name the derivation found and the package's adoption dropped (`noise_dropped`). */
export interface DroppedReading extends ReadingBase {
    readonly kind: 'dropped';
    readonly bucket: string;
    readonly reason: string;
}

export type Reading =
    | BucketReading
    | DocumentedOnActionReading
    | KeywordTemplateReading
    | IteratorReading
    | IteratorDepartureReading
    | ModifierTemplateReading
    | FieldReading
    | KeywordParameterReading
    | KeywordRoleReading
    | DeclarationReading
    | TableEntryReading
    | DefinedReading
    | ScopeTypeReading
    | RetiredReading
    | DroppedReading;

export type ReadingKind = Reading['kind'];

// ─── Definitions and uses (the step 3 index) ───────────────────────────────

/** One definition, where it is and whether it is the one in force. */
export interface DefinitionAnswer {
    readonly layer: string;
    readonly file: string;
    readonly range: Range;
    readonly form: Definition['form'];
    readonly prefix: string | null;
    /** Whether the game reads its file, as far as the rules table says. */
    readonly read: Definition['read'];
    /** Whether it is the one in force; `not-known` where no row decides. */
    readonly inForce: 'yes' | 'no' | 'not-known';
}

/** What the override rules say is in force for one name of one database. */
export type InForceAnswer =
    | { readonly status: 'single' }
    | {
          readonly status: 'winner';
          readonly rule: string;
          readonly combine: 'whole' | 'fields' | 'partial';
          /**
           * The object the name shares with other names, where an alias row decides
           * (`coat-of-arms-alias`; the index's `Resolution.shared`): the name an alias line in
           * force points it to (null when its own block binds it), the block whose content is in
           * force for the object, and every name on it.
           */
          readonly shared?: SharedAnswer;
      }
    | { readonly status: 'all'; readonly rule: string }
    | { readonly status: 'statements'; readonly rule: string }
    | { readonly status: 'clash'; readonly rule: string }
    /** Defined, nothing in force: each definition is an alias line whose target was not read yet. */
    | { readonly status: 'not-in-force'; readonly rule: string }
    | { readonly status: 'not-read' }
    | { readonly status: 'winner-not-known'; readonly reasons: readonly UnknownReason[] };

/** An object several names share (an alias row's replay). */
export interface SharedAnswer {
    readonly target: string | null;
    /** The block whose content is in force for the object. */
    readonly filledBy: { readonly layer: string; readonly file: string; readonly range: Range };
    readonly names: readonly string[];
}

/** The definitions of the name in one database (and container). */
export interface DefinitionGroupAnswer {
    readonly database: string;
    readonly container: string | null;
    readonly inForce: InForceAnswer;
    readonly definitions: readonly DefinitionAnswer[];
}

export type DefinitionsAnswer =
    | { readonly status: 'no-workspace'; readonly why: string }
    | { readonly status: 'read'; readonly groups: readonly DefinitionGroupAnswer[] };

export interface UseAnswer {
    readonly layer: string;
    readonly file: string;
    readonly range: Range;
    readonly read: Definition['read'];
}

/** The uses of the name: how many, how many per layer, and the first `limit` of them. */
export type UsesAnswer =
    | { readonly status: 'no-workspace'; readonly why: string }
    | {
          readonly status: 'read';
          readonly count: number;
          readonly byLayer: Readonly<Record<string, number>>;
          readonly limit: number;
          readonly first: readonly UseAnswer[];
      };

// ─── Data types and suggestions ────────────────────────────────────────────

export type DataTypesAnswer =
    | { readonly status: 'not-asked' }
    | { readonly status: 'read'; readonly entries: readonly DataTypeEntry[] };

/** A name close to one the package has nothing for. */
export interface Suggestion {
    readonly name: string;
    /** The edit distance, letter case ignored. */
    readonly distance: number;
    /** `package`: a name of the spec package; `workspace`: a name the index defines. */
    readonly from: 'package' | 'workspace';
}

export type SuggestionsAnswer =
    | { readonly status: 'not-needed' }
    | { readonly status: 'off' }
    | {
          readonly status: 'computed';
          readonly suggestions: readonly Suggestion[];
          /** False when the work bound stopped the search before every candidate was seen. */
          readonly complete: boolean;
          /** The work done and the bound it ran under (candidates seen plus table cells). */
          readonly work: number;
          readonly budget: number;
      };

// ─── The whole answer ──────────────────────────────────────────────────────

export interface LookupResult {
    readonly name: string;
    /** The package the answer comes from. */
    readonly spec: { readonly version: string; readonly sha256: string };
    /** True when the package has no reading of the name: lookup says "unknown". */
    readonly unknown: boolean;
    /** Every reading of the name, none picked for the caller, in a fixed order. */
    readonly readings: readonly Reading[];
    readonly definitions: DefinitionsAnswer;
    readonly uses: UsesAnswer;
    readonly dataTypes: DataTypesAnswer;
    readonly suggestions: SuggestionsAnswer;
}
