/**
 * Lookup (docs/PLAN.md item 4.8): for any name, everything the spec package says it is (every
 * reading, none picked for the caller), and, when a workspace index is given, where it is
 * defined and used, with what is in force by the override rules.
 *
 * Each reading states its bucket or kind, its description and where that comes from, the
 * scopes it supports (keeping "no requirement declared" apart from "the game documents
 * none"), what it takes, the version that first has it, its removal and replacement, and
 * whether the game's own output documents it. Where the package has nothing a part says so;
 * lookup never guesses and never fills a gap from another source.
 *
 * What it reads of the package: the six buckets with `multi_bucket`, `retired` and
 * `noise_dropped`; `scope_validity` and `scope_types`; the keyword and modifier templates with
 * their marks and the modifier template tags; the record schemas; parts D2 (declarations), D4
 * (keyword roles), D5 (localization keys a record has by its name), D6 (what a value names),
 * D7 (the use areas of a modifier block) and D8 (iterator kinds); the hand-kept tables of part
 * C4 as the trust rule reads them; and, when asked, the data-types companion (C3).
 *
 * A modifier's localization is read through the index from the installed game's files: the
 * keys part D5 gives the records that define the name in the folders of `vanilla_indexed_dirs`
 * whose names any block may call (a modifier's format definition among them), each key's
 * definitions in the index, and their text from the file source the caller gives. Those are
 * the only keys the package ties to a modifier, each with its D5 row's status; a key the
 * package does not name is not tried, however the game's own files write their keys.
 *
 * Positions are the index's: lines and characters count from 0.
 */

import { modifierAreaRow } from '../check/context.js';
import type { Definition, WorkspaceIndex } from '../index/workspace.js';
import { dataTypesOf } from '../spec/data-types.js';
import {
    BUCKET_NAMES,
    type BucketName,
    type DeclarationRow,
    type FieldReferenceRow,
    type ImplicitLocKeyRow,
    type IteratorPrefixRow,
    type KeywordRoleRow,
    type KeywordTemplate,
    type ModifierBlockAreaRow,
    type PartRow,
    type RetiredEntry,
    type SchemaField,
    type ScopeRecord,
    type TableEntry,
} from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf, type Tables } from '../spec/tables.js';
import { templatePattern, vocabularyOf, type Vocabulary } from '../spec/vocabulary.js';
import { inForceOf, LocalizationReader, type FileSource } from './localization.js';
import { suggest, type Candidate, type SuggestOptions } from './suggest.js';
import type {
    BucketReading,
    DataTypesAnswer,
    DefinitionGroupAnswer,
    DefinitionsAnswer,
    DescriptionAnswer,
    DescriptionSource,
    DescriptionText,
    FieldReading,
    InForceAnswer,
    IteratorFormAnswer,
    LocalizationAnswer,
    LocalizationKeyAnswer,
    LookupResult,
    Reading,
    ReadingBase,
    ReferenceAnswer,
    ScopesAnswer,
    SinceAnswer,
    SuggestionsAnswer,
    TakesAnswer,
    TemplateMarkAnswer,
    UsesAnswer,
} from './types.js';

export interface LookupOptions {
    readonly spec: Spec;
    /** The workspace index (step 3), for definitions, uses and names a workspace defines. */
    readonly index?: WorkspaceIndex | null;
    /**
     * Reads the indexed files, for localization text. A caller with no game folder gives none,
     * and a modifier's localization is then absent.
     */
    readonly files?: FileSource | null;
    /** Only this language's localization (as its files' header names it, `l_english`); every language when absent. */
    readonly language?: string | null;
    /** How many uses to list; the count is always whole. 20 by default. */
    readonly usesLimit?: number;
    /** Open the data-types companion and list its entries for the name. */
    readonly dataTypes?: boolean;
    /** The bounds of "did you mean", or false for none. */
    readonly suggestions?: SuggestOptions | false;
}

export const DEFAULT_USES_LIMIT = 20;

// ─── What each part says where the package has nothing ─────────────────────

const WHY = {
    noDoc: 'the package has no description for this name in this bucket',
    noOnActionDoc:
        'the package has no description for an on-action: none can be derived from the game',
    noModifierDoc:
        "the package has no description for a modifier; its localization is read from the game's files",
    noDescription: 'the package has no description for this reading',
    notDocumented: "the game's own documentation output has no entry for this name in this bucket",
    noUseAreas: "the game's modifier log gives this modifier no use area",
    noTemplateTag: "the name fills no template tag of the game's modifier log",
    noFieldScope: 'the package records no scope for this field',
    noScopes: 'the package records no scopes for this kind of name',
    noUsageLine: 'the game gives no usage line for this keyword',
    takesBucketOnly:
        'the package reads usage lines for the names of the triggers and effects buckets only',
    takesNotApplicable: 'only triggers and effects take a value or a block the package describes',
    sinceBucket: 'the package records no version for the names of its buckets',
    sinceReading: 'the package records no version for this reading',
    noWorkspace: 'no workspace index was given',
    noGameFolder: 'no game folder is set: no workspace index or no file source was given',
    noLocalizationKey:
        'the package ties no localization key to this name: no part D5 row for a folder of vanilla_indexed_dirs that defines it',
    valueType: 'the package measures no value type for this field',
    values: 'the package records the values of a field only where the base game writes at most 20',
    locKey: 'the package does not mark this field as holding a localization key',
} as const;

const NO_TAKES: TakesAnswer = { status: 'not-applicable', why: WHY.takesNotApplicable };
const NO_SCOPES: ScopesAnswer = { status: 'not-applicable', why: WHY.noScopes };
const NO_SINCE: SinceAnswer = { status: 'unknown', why: WHY.sinceReading };
const NO_DESCRIPTION: DescriptionAnswer = { status: 'none', why: WHY.noDescription };

/** A reading's base with nothing known: the parts a kind of reading does not have. */
const EMPTY_BASE: ReadingBase = {
    description: NO_DESCRIPTION,
    scopes: NO_SCOPES,
    takes: NO_TAKES,
    since: NO_SINCE,
    retired: [],
    derivedOnly: null,
};

function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const list = map.get(key);
    if (list === undefined) {
        map.set(key, [value]);
    } else {
        list.push(value);
    }
}

// ─── The package, read once for lookups ────────────────────────────────────

interface FieldPlace {
    readonly directory: string;
    readonly path: readonly string[];
    readonly field: SchemaField;
    readonly unconfirmed: boolean;
    readonly recordRoot: string | null;
}

interface TablePlace {
    readonly table: string;
    readonly entry: TableEntry;
    readonly candidate: boolean;
}

interface DeclarationPlace {
    readonly directory: string | null;
    readonly row: DeclarationRow;
    readonly pattern: RegExp | null;
}

interface Model {
    readonly vocabulary: Vocabulary;
    readonly tables: Tables;
    readonly fields: ReadonlyMap<string, readonly FieldPlace[]>;
    readonly fieldRefs: ReadonlyMap<string, readonly FieldReferenceRow[]>;
    readonly valueRefs: ReadonlyMap<string, readonly FieldReferenceRow[]>;
    readonly keywordParams: ReadonlyMap<string, readonly FieldReferenceRow[]>;
    readonly paramsByName: ReadonlyMap<string, readonly FieldReferenceRow[]>;
    readonly modifierAreas: ReadonlyMap<string, readonly ModifierBlockAreaRow[]>;
    readonly roles: ReadonlyMap<string, readonly KeywordRoleRow[]>;
    readonly declarationsExact: ReadonlyMap<string, readonly DeclarationPlace[]>;
    readonly declarationsMatched: readonly DeclarationPlace[];
    readonly tableEntries: ReadonlyMap<string, readonly TablePlace[]>;
    readonly trust: ReadonlyMap<string, { readonly use: string; readonly why: string }>;
    readonly prefixRows: ReadonlyMap<string, IteratorPrefixRow>;
    readonly departures: ReadonlyMap<string, readonly PartRow[]>;
    readonly retired: ReadonlyMap<string, readonly RetiredEntry[]>;
    readonly dropped: ReadonlyMap<string, readonly { bucket: string; reason: string }[]>;
    readonly locKeys: ReadonlyMap<string, readonly ImplicitLocKeyRow[]>;
    /** Folders of `vanilla_indexed_dirs` and the bucket their records are called as, or null. */
    readonly callable: readonly {
        readonly directory: string;
        readonly calledAs: BucketName | null;
    }[];
    /** Every name of the package a suggestion may be, sorted, each once. */
    readonly candidates: readonly string[];
}

function bucketOfBody(body: string | undefined): BucketName | null {
    return body === 'trigger_block' ? 'triggers' : body === 'effect_block' ? 'effects' : null;
}

/** A D2 key pattern that matches every key describes a folder's records, not a name. */
const MATCHES_EVERY_KEY = '.*';

function buildModel(spec: Spec): Model {
    const data = spec.data;
    const vocabulary = vocabularyOf(spec);
    const tables = tablesOf(spec);

    const fields = new Map<string, FieldPlace[]>();
    const walk = (
        directory: string,
        recordRoot: string | null,
        record: Readonly<Record<string, SchemaField>>,
        above: readonly string[],
    ): void => {
        for (const [name, field] of Object.entries(record)) {
            const path = [...above, name];
            push(fields, name, { directory, path, field, unconfirmed: false, recordRoot });
            if (field.fields !== undefined) {
                walk(directory, recordRoot, field.fields, path);
            }
        }
    };
    for (const [directory, schema] of Object.entries(data.schema)) {
        const root = schema.root_scope ?? null;
        walk(directory, root, schema.fields, []);
        for (const [name, field] of Object.entries(schema.unconfirmed ?? {})) {
            if (isObject(field)) {
                push(fields, name, {
                    directory,
                    path: [name],
                    field: field as unknown as SchemaField,
                    unconfirmed: true,
                    recordRoot: root,
                });
            }
        }
    }

    const fieldRefs = new Map<string, FieldReferenceRow[]>();
    const valueRefs = new Map<string, FieldReferenceRow[]>();
    const keywordParams = new Map<string, FieldReferenceRow[]>();
    const paramsByName = new Map<string, FieldReferenceRow[]>();
    for (const row of spec.part('field_references')?.fields ?? []) {
        if (row.kind === 'field' && typeof row.directory === 'string') {
            push(fieldRefs, `${row.directory}\u0000${row.path}`, row);
        } else if (row.kind === 'value' && typeof row.bucket === 'string') {
            push(valueRefs, `${row.bucket}\u0000${row.path}`, row);
        } else if (row.kind === 'parameter' && typeof row.bucket === 'string') {
            const dot = row.path.indexOf('.');
            if (dot > 0) {
                push(keywordParams, `${row.bucket}\u0000${row.path.slice(0, dot)}`, row);
                push(paramsByName, row.path.slice(row.path.lastIndexOf('.') + 1), row);
            }
        }
    }

    const modifierAreas = new Map<string, ModifierBlockAreaRow[]>();
    for (const row of spec.part('modifier_block_areas')?.fields ?? []) {
        push(modifierAreas, row.directory, row);
    }

    const roles = new Map<string, KeywordRoleRow[]>();
    for (const row of spec.part('keyword_roles')?.keywords ?? []) {
        push(roles, row.keyword, row);
    }

    const declarationsExact = new Map<string, DeclarationPlace[]>();
    const declarationsMatched: DeclarationPlace[] = [];
    const declarations = spec.part('declarations');
    const addDeclaration = (directory: string | null, row: DeclarationRow): void => {
        if (row.match === 'exact') {
            push(declarationsExact, row.key, { directory, row, pattern: null });
        } else if (row.match === 'prefix') {
            declarationsMatched.push({ directory, row, pattern: null });
        } else if (row.key !== MATCHES_EVERY_KEY) {
            try {
                declarationsMatched.push({
                    directory,
                    row,
                    pattern: new RegExp(`^(?:${row.key})$`),
                });
            } catch {
                // A pattern this engine cannot compile matches nothing here.
            }
        }
    };
    for (const [directory, rows] of Object.entries(declarations?.directories ?? {})) {
        for (const row of rows) {
            addDeclaration(directory, row);
        }
    }
    for (const row of declarations?.all_directories ?? []) {
        addDeclaration(null, row);
    }

    const trust = new Map<string, { use: string; why: string }>();
    for (const decision of tables.decisions) {
        trust.set(`${decision.table}\u0000${decision.entry}`, {
            use: decision.use,
            why: decision.why,
        });
    }
    const tableEntries = new Map<string, TablePlace[]>();
    for (const [table, content] of Object.entries(data.tables.data)) {
        for (const [name, entry] of Object.entries(content.entries)) {
            push(tableEntries, name, { table, entry, candidate: false });
        }
        if (isObject(content.candidates)) {
            for (const [name, candidate] of Object.entries(content.candidates)) {
                if (
                    isObject(candidate) &&
                    own(content.entries, name) === undefined &&
                    trust.has(`${table}\u0000${name}`)
                ) {
                    push(tableEntries, name, {
                        table,
                        entry: { ...candidate, evidence_status: 'none' },
                        candidate: true,
                    });
                }
            }
        }
    }

    const iteratorKinds = spec.part('iterator_kinds');
    const prefixRows = new Map<string, IteratorPrefixRow>();
    for (const row of iteratorKinds?.prefixes ?? []) {
        prefixRows.set(row.prefix, row);
    }
    const departures = new Map<string, PartRow[]>();
    for (const row of iteratorKinds?.departures ?? []) {
        const named = (row as { readonly name?: unknown }).name;
        if (typeof named === 'string') {
            push(departures, named, row);
        }
    }

    const retired = new Map<string, RetiredEntry[]>();
    for (const entry of data.retired) {
        push(retired, entry.name, entry);
    }
    const dropped = new Map<string, { bucket: string; reason: string }[]>();
    const noise = data['noise_dropped'];
    if (Array.isArray(noise)) {
        for (const item of noise as { name?: unknown; bucket?: unknown; reason?: unknown }[]) {
            if (
                typeof item.name === 'string' &&
                typeof item.bucket === 'string' &&
                typeof item.reason === 'string'
            ) {
                push(dropped, item.name, { bucket: item.bucket, reason: item.reason });
            }
        }
    }

    const locKeys = new Map<string, ImplicitLocKeyRow[]>();
    for (const [directory, rows] of Object.entries(
        spec.part('implicit_loc_keys')?.directories ?? {},
    )) {
        locKeys.set(directory, [...rows]);
    }

    const callable = [...tables.vanillaIndexedDirs].sort().map((directory) => ({
        directory,
        calledAs: bucketOfBody(own(data.schema, directory)?.record_body),
    }));

    const names = new Set<string>();
    for (const bucket of BUCKET_NAMES) {
        for (const name of Object.keys(data.buckets[bucket])) {
            names.add(name);
        }
    }
    for (const list of Object.values(data.scope_validity.lists)) {
        for (const iterator of list.iterators ?? []) {
            names.add(iterator);
        }
    }
    for (const map of [fields, roles, declarationsExact, tableEntries, paramsByName, retired]) {
        for (const name of map.keys()) {
            names.add(name);
        }
    }
    for (const name of Object.keys(data.scope_types)) {
        names.add(name);
    }

    return {
        vocabulary,
        tables,
        fields,
        fieldRefs,
        valueRefs,
        keywordParams,
        paramsByName,
        modifierAreas,
        roles,
        declarationsExact,
        declarationsMatched,
        tableEntries,
        trust,
        prefixRows,
        departures,
        retired,
        dropped,
        locKeys,
        callable,
        candidates: [...names].sort(),
    };
}

const models = new WeakMap<Spec, Model>();

function modelOf(spec: Spec): Model {
    let model = models.get(spec);
    if (model === undefined) {
        model = buildModel(spec);
        models.set(spec, model);
    }
    return model;
}

// ─── Parts of a reading ────────────────────────────────────────────────────

function referenceOf(row: FieldReferenceRow): ReferenceAnswer {
    return {
        id: row.id,
        path: row.path,
        refersTo: row.refers_to,
        valueForm: row.value_form,
        status: row.status,
        evidence: row.evidence,
    };
}

/** A text and the one source it comes from, before texts that agree are joined. */
interface SourcedText {
    readonly text: string;
    readonly source: DescriptionSource;
}

/** The non-empty texts, in order, each once with every source that gives it. */
function descriptions(texts: readonly (SourcedText | null)[], why: string): DescriptionAnswer {
    const out: { text: string; sources: DescriptionSource[] }[] = [];
    for (const item of texts) {
        if (item === null || item.text === '') {
            continue;
        }
        const same = out.find((o) => o.text === item.text);
        if (same === undefined) {
            out.push({ text: item.text, sources: [item.source] });
        } else if (!same.sources.includes(item.source)) {
            same.sources.push(item.source);
        }
    }
    const known: DescriptionText[] = out;
    return known.length > 0 ? { status: 'known', texts: known } : { status: 'none', why };
}

function scopesOf(record: ScopeRecord | undefined): ScopesAnswer {
    if (record === undefined) {
        return { status: 'not-documented', why: WHY.notDocumented };
    }
    const declared = record.supported_scopes.filter((s) => s !== 'none');
    if (declared.length === 0 && record.supported_scopes.length > 0) {
        return {
            status: 'no-requirement',
            targets: record.supported_targets,
            source: 'script_docs',
        };
    }
    return {
        status: 'supported',
        scopes: record.supported_scopes,
        targets: record.supported_targets,
        source: 'script_docs',
    };
}

function takesOf(bucket: BucketName, entry: { readonly takes?: unknown }): TakesAnswer {
    if (bucket !== 'triggers' && bucket !== 'effects') {
        return NO_TAKES;
    }
    const takes = entry.takes;
    if (takes === null || takes === undefined || !isObject(takes)) {
        return { status: 'no-usage-line', why: WHY.noUsageLine };
    }
    return {
        status: 'known',
        forms: (takes['forms'] ?? []) as readonly string[],
        readings: (takes['readings'] ?? []) as LookupTakesReadings,
        disagreement: takes['disagreement'] ?? null,
    };
}

type LookupTakesReadings = Extract<TakesAnswer, { status: 'known' }>['readings'];

/** The scope-validity group of a bucket, where it has one. */
function scopeGroup(bucket: BucketName): 'triggers' | 'effects' | 'lists' | 'on_actions' | null {
    return bucket === 'triggers' ||
        bucket === 'effects' ||
        bucket === 'lists' ||
        bucket === 'on_actions'
        ? bucket
        : null;
}

// ─── The lookup ────────────────────────────────────────────────────────────

class Looker {
    private readonly spec: Spec;
    private readonly model: Model;
    private readonly index: WorkspaceIndex | null;
    private readonly reader: LocalizationReader | null;
    private readonly language: string | null;

    constructor(options: LookupOptions) {
        this.spec = options.spec;
        this.model = modelOf(options.spec);
        this.index = options.index ?? null;
        this.reader =
            options.files === undefined || options.files === null
                ? null
                : new LocalizationReader(options.files);
        this.language = options.language ?? null;
    }

    private isDefined(name: string, database: string): boolean {
        return this.index?.definitions(name, { database }).some((d) => d.read !== 'no') ?? false;
    }

    readings(name: string): Reading[] {
        const out: Reading[] = [];
        const vocabulary = this.model.vocabulary;
        const retired = this.model.retired.get(name) ?? [];
        const buckets = BUCKET_NAMES.filter((b) => vocabulary.has(b, name));
        for (const bucket of buckets) {
            out.push(
                this.bucketReading(
                    name,
                    bucket,
                    buckets.filter((b) => b !== bucket),
                    retired.filter((r) => r.bucket === bucket),
                ),
            );
        }
        const onAction = own(this.spec.data.scope_validity.on_actions, name);
        if (onAction !== undefined && !vocabulary.has('on_actions', name)) {
            out.push({
                ...EMPTY_BASE,
                kind: 'documented-on-action',
                description: descriptions(
                    [{ text: onAction.description, source: 'script_docs' }],
                    WHY.noOnActionDoc,
                ),
                scopes: scopesOf(onAction),
                takes: NO_TAKES,
                since: { status: 'unknown', why: WHY.sinceBucket },
                derivedOnly: false,
                fromCode: onAction.from_code === true,
            });
        }
        out.push(...this.keywordTemplateReadings(name));
        out.push(...this.iteratorReadings(name));
        out.push(...this.modifierTemplateReadings(name));
        for (const entry of retired) {
            if (!buckets.includes(entry.bucket)) {
                out.push({
                    ...EMPTY_BASE,
                    kind: 'retired',
                    bucket: entry.bucket,
                    entry,
                    retired: [entry],
                });
            }
        }
        for (const item of this.model.dropped.get(name) ?? []) {
            out.push({ ...EMPTY_BASE, kind: 'dropped', bucket: item.bucket, reason: item.reason });
        }
        for (const place of this.model.fields.get(name) ?? []) {
            out.push(this.fieldReading(place));
        }
        for (const row of this.model.paramsByName.get(name) ?? []) {
            out.push({
                ...EMPTY_BASE,
                kind: 'keyword-parameter',
                bucket: row.bucket ?? '',
                keyword: row.path.slice(0, row.path.indexOf('.')),
                reference: referenceOf(row),
            });
        }
        for (const row of this.model.roles.get(name) ?? []) {
            out.push({
                ...EMPTY_BASE,
                kind: 'keyword-role',
                where: row.where,
                roles: row.roles,
                roleStatus: row.role_status,
                status: row.status,
                evidence: row.evidence,
                statedElsewhere: row.stated_elsewhere ?? [],
                note: typeof row['note'] === 'string' ? row['note'] : null,
            });
        }
        const declarations = [
            ...(this.model.declarationsExact.get(name) ?? []),
            ...this.model.declarationsMatched.filter((d) =>
                d.pattern === null
                    ? name.startsWith(d.row.key) && name.length > d.row.key.length
                    : d.pattern.test(name),
            ),
        ];
        for (const { directory, row } of declarations) {
            out.push({
                ...EMPTY_BASE,
                kind: 'declaration',
                directory,
                key: row.key,
                match: row.match,
                form: row.form,
                declares: row.declares,
                scope: row.scope,
                status: row.status,
                evidence: row.evidence,
            });
        }
        for (const place of this.model.tableEntries.get(name) ?? []) {
            const { evidence_status: status, evidence, ...attributes } = place.entry;
            const about = this.spec.data.tables.data[place.table]?.about;
            out.push({
                ...EMPTY_BASE,
                kind: 'table-entry',
                table: place.table,
                meaning: typeof about?.['meaning'] === 'string' ? about['meaning'] : null,
                candidate: place.candidate,
                evidenceStatus: status,
                evidence: evidence ?? 'none',
                trust: this.model.trust.get(`${place.table}\u0000${name}`) ?? null,
                attributes,
            });
        }
        const scopeType = own(this.spec.data.scope_types, name);
        if (isObject(scopeType)) {
            const count = (key: string): number => {
                const value = scopeType[key];
                return Array.isArray(value) ? value.length : typeof value === 'number' ? value : 0;
            };
            out.push({
                ...EMPTY_BASE,
                kind: 'scope-type',
                namedAs: Array.isArray(scopeType['named_as'])
                    ? (scopeType['named_as'] as string[])
                    : [],
                binaryIndex:
                    typeof scopeType['binary_index'] === 'number'
                        ? scopeType['binary_index']
                        : null,
                counts: {
                    links: count('links'),
                    lists: count('lists'),
                    onActions: count('on_actions'),
                    triggers: count('triggers'),
                    effects: count('effects'),
                    inputOfLinks: count('input_of_links'),
                },
            });
        }
        if (this.index !== null) {
            for (const { directory, calledAs } of this.model.callable) {
                if (this.isDefined(name, directory)) {
                    out.push({ ...EMPTY_BASE, kind: 'defined', database: directory, calledAs });
                }
            }
        }
        return out;
    }

    private bucketReading(
        name: string,
        bucket: BucketName,
        alsoIn: readonly BucketName[],
        retired: readonly RetiredEntry[],
    ): BucketReading {
        const data = this.spec.data;
        const entry = data.buckets[bucket][name] ?? { doc: '' };
        const group = scopeGroup(bucket);
        const record = group === null ? undefined : own(data.scope_validity[group], name);
        let scopes: ScopesAnswer;
        let derivedOnly: boolean;
        let texts: (SourcedText | null)[] = [{ text: entry.doc, source: 'doc' }];
        let why: string = WHY.noDoc;
        if (bucket === 'links') {
            const forms = this.model.vocabulary.linkForms(name);
            derivedOnly = forms.length === 0;
            scopes =
                forms.length === 0
                    ? { status: 'not-documented', why: WHY.notDocumented }
                    : {
                          status: 'link-forms',
                          forms: forms.map((f) => ({
                              scopes: f.supported_scopes,
                              targets: f.supported_targets,
                              description: f.description,
                              globalLink: f.global_link,
                              requiresData: f.requires_data,
                              wildCard: f.wild_card,
                          })),
                      };
            texts = [
                ...texts,
                ...forms.map((f) => ({ text: f.description, source: 'script_docs' as const })),
            ];
        } else if (bucket === 'modifiers') {
            const areas = entry.use_areas ?? null;
            derivedOnly = areas === null;
            scopes =
                areas === null
                    ? { status: 'not-documented', why: WHY.noUseAreas }
                    : { status: 'use-areas', areas, source: 'modifier_log' };
            why = WHY.noModifierDoc;
        } else {
            derivedOnly = record === undefined;
            scopes = scopesOf(record);
            texts.push(
                record === undefined ? null : { text: record.description, source: 'script_docs' },
            );
            if (bucket === 'on_actions') {
                why = WHY.noOnActionDoc;
            }
        }
        const kinds = this.spec.part('iterator_kinds')?.lists;
        const listForms =
            bucket === 'lists' && kinds !== undefined ? own(kinds, name)?.forms : undefined;
        const documented = new Set(record?.iterators ?? []);
        const iterators: IteratorFormAnswer[] | null =
            bucket === 'lists'
                ? data.iterator_prefixes.map((prefix) => ({
                      prefix,
                      name: `${prefix}${name}`,
                      kind: listForms === undefined ? null : (own(listForms, prefix) ?? null),
                      documented: documented.has(`${prefix}${name}`),
                  }))
                : null;
        const keywordKey = `${bucket}\u0000${name}`;
        return {
            kind: 'bucket',
            bucket,
            alsoIn,
            description: descriptions(texts, why),
            scopes,
            takes: takesOf(bucket, entry),
            since: { status: 'unknown', why: WHY.sinceBucket },
            retired,
            derivedOnly,
            valueNames: (this.model.valueRefs.get(keywordKey) ?? []).map(referenceOf),
            parameters: (this.model.keywordParams.get(keywordKey) ?? []).map(referenceOf),
            iterators,
            fromCode:
                bucket === 'on_actions'
                    ? record === undefined
                        ? null
                        : record.from_code === true
                    : null,
            modifier:
                bucket === 'modifiers'
                    ? {
                          provenance: entry.provenance ?? null,
                          localization: this.modifierLocalization(name),
                      }
                    : null,
        };
    }

    private keywordTemplateReadings(name: string): Reading[] {
        const out: Reading[] = [];
        for (const bucket of BUCKET_NAMES) {
            for (const fill of this.model.vocabulary.keywordTemplateFills(bucket, name)) {
                const template: KeywordTemplate = fill.template;
                const group = scopeGroup(bucket);
                const record =
                    group === null ? undefined : own(this.spec.data.scope_validity[group], name);
                out.push({
                    kind: 'keyword-template',
                    bucket,
                    template: template.template,
                    database: template.keys,
                    key: fill.key,
                    keyDefined:
                        this.index === null ? null : this.isDefined(fill.key, template.keys),
                    description: descriptions(
                        [
                            { text: template.doc, source: 'doc' },
                            record === undefined
                                ? null
                                : { text: record.description, source: 'script_docs' },
                        ],
                        WHY.noDoc,
                    ),
                    scopes: scopesOf(record),
                    takes: { status: 'unknown', why: WHY.takesBucketOnly },
                    since: { status: 'unknown', why: WHY.sinceBucket },
                    retired: [],
                    derivedOnly: record === undefined ? null : false,
                });
            }
        }
        return out;
    }

    private iteratorReadings(name: string): Reading[] {
        const departures = this.model.departures.get(name) ?? [];
        const iterator = this.model.vocabulary.iteratorOf(name);
        if (iterator === undefined) {
            return departures.map((row) => ({ ...EMPTY_BASE, kind: 'iterator-departure', row }));
        }
        const { prefix, base } = iterator;
        const data = this.spec.data;
        let list:
            | { readonly from: 'lists' }
            | { readonly from: 'defined'; readonly database: string }
            | null = null;
        if (this.model.vocabulary.has('lists', base)) {
            list = { from: 'lists' };
        } else if (this.index !== null) {
            const found = this.model.callable.find(
                (c) => c.calledAs === null && this.isDefined(base, c.directory),
            );
            list = found === undefined ? null : { from: 'defined', database: found.directory };
        }
        if (list === null) {
            return departures.map((row) => ({ ...EMPTY_BASE, kind: 'iterator-departure', row }));
        }
        const documented =
            own(data.scope_validity.triggers, name) ?? own(data.scope_validity.effects, name);
        const listRecord = list.from === 'lists' ? own(data.scope_validity.lists, base) : undefined;
        const prefixRow = this.model.prefixRows.get(prefix);
        const listKinds = this.spec.part('iterator_kinds')?.lists;
        const forms =
            list.from === 'lists' && listKinds !== undefined
                ? own(listKinds, base)?.forms
                : undefined;
        return [
            {
                kind: 'iterator',
                prefix,
                base,
                list,
                prefixKind:
                    prefixRow === undefined
                        ? null
                        : {
                              kind: prefixRow.kind,
                              body: prefixRow.body,
                              status: prefixRow.status,
                              evidence: prefixRow.evidence,
                          },
                formKind: forms === undefined ? null : (own(forms, prefix) ?? null),
                departures,
                description: descriptions(
                    [
                        list.from === 'lists'
                            ? { text: data.buckets.lists[base]?.doc ?? '', source: 'doc' }
                            : null,
                        documented === undefined
                            ? null
                            : { text: documented.description, source: 'script_docs' },
                    ],
                    WHY.noDoc,
                ),
                scopes: scopesOf(documented ?? listRecord),
                takes: { status: 'unknown', why: WHY.takesBucketOnly },
                since: { status: 'unknown', why: WHY.sinceBucket },
                retired: [],
                derivedOnly: list.from === 'lists' ? documented === undefined : null,
            },
        ];
    }

    private modifierTemplateReadings(name: string): Reading[] {
        const match = this.model.vocabulary.modifierTemplateMatch(name);
        if (match.kind === 'none') {
            return [];
        }
        const marks: TemplateMarkAnswer[] = [];
        for (const template of match.templates) {
            const mark = own(this.spec.data.modifier_template_marks, template);
            if (mark !== undefined) {
                marks.push({
                    template,
                    mark: mark.mark,
                    fixedText: mark.fixed_text,
                    gameTags: mark.game_tags,
                    formsFilled: mark.sole_cover_of.filter((form) =>
                        templatePattern(form).test(name),
                    ),
                });
            }
        }
        const tags = Object.entries(this.spec.data.modifier_template_tags.data)
            .filter(([, tag]) => templatePattern(tag.form).test(name))
            .map(([tag, value]) => ({ tag, form: value.form, useAreas: value.use_areas }));
        return [
            {
                ...EMPTY_BASE,
                kind: 'modifier-template',
                proof: match.kind,
                templates: match.templates,
                marks,
                scopes:
                    tags.length === 0
                        ? { status: 'not-documented', why: WHY.noTemplateTag }
                        : { status: 'by-template-tag', tags },
                derivedOnly: null,
                localization: this.modifierLocalization(name),
            },
        ];
    }

    private fieldReading(place: FieldPlace): FieldReading {
        const field = place.field;
        const pathText = place.path.join('.');
        const area = modifierAreaRow(
            this.model.modifierAreas.get(place.directory) ?? [],
            place.path,
        );
        const source = field.description_source;
        return {
            kind: 'field',
            directory: place.directory,
            path: place.path,
            unconfirmed: place.unconfirmed,
            fieldKind: field.kind,
            provenance: field.provenance,
            required: { required: field.required, evidence: field.required_evidence ?? null },
            usage: { files: field.usage ?? null, records: field.record_usage ?? null },
            valueType:
                field.value_type === undefined
                    ? { status: 'unknown', why: WHY.valueType }
                    : {
                          status: 'measured',
                          type: field.value_type,
                          evidence: field.value_type_evidence ?? null,
                          wikiType: field.wiki_type ?? null,
                          infoType: field.info_type ?? null,
                      },
            values:
                field.values === undefined
                    ? { status: 'not-recorded', why: WHY.values }
                    : { status: 'observed', values: field.values },
            localizationKey:
                field.loc_key === true
                    ? { status: 'yes', evidence: field.loc_key_evidence ?? null }
                    : { status: 'not-marked', why: WHY.locKey },
            holds: field.holds ?? null,
            refersTo: (this.model.fieldRefs.get(`${place.directory}\u0000${pathText}`) ?? []).map(
                referenceOf,
            ),
            useAreas:
                area === null
                    ? null
                    : {
                          id: area.id,
                          useAreas: area.use_areas,
                          status: area.status,
                          evidence: area.evidence,
                      },
            note: field.note ?? null,
            description: descriptions(
                [
                    field.description === undefined
                        ? null
                        : { text: field.description, source: source === 'info' ? 'info' : 'wiki' },
                ],
                WHY.noDescription,
            ),
            scopes: this.fieldScopes(place),
            takes: NO_TAKES,
            since: field.since === undefined ? NO_SINCE : { status: 'known', since: field.since },
            retired: [],
            derivedOnly: null,
        };
    }

    private fieldScopes(place: FieldPlace): ScopesAnswer {
        const field = place.field;
        const measured =
            field.scope === undefined
                ? null
                : { scopes: field.scope, evidence: field.scope_evidence ?? '' };
        const info = field.info_scope ?? null;
        if (measured === null && info === null) {
            return { status: 'not-documented', why: WHY.noFieldScope };
        }
        return { status: 'field', measured, info, recordRoot: place.recordRoot };
    }

    /**
     * A modifier's localization: the keys part D5 gives a record of the name in the folders of
     * `vanilla_indexed_dirs` whose names any block may call, read through the index.
     */
    modifierLocalization(name: string): LocalizationAnswer {
        if (this.index === null || this.reader === null) {
            return { status: 'no-game-folder', why: WHY.noGameFolder };
        }
        const keys: LocalizationKeyAnswer[] = [];
        for (const { directory, calledAs } of this.model.callable) {
            if (calledAs !== null) {
                continue;
            }
            const records = this.index.definitions(name, { database: directory });
            if (records.length === 0) {
                continue;
            }
            for (const row of this.model.locKeys.get(directory) ?? []) {
                if (row.name_from !== 'record-key') {
                    continue;
                }
                const key = `${row.prefix}${name}${row.suffix}`;
                keys.push({
                    key,
                    records: records.map((d) => ({
                        database: d.database,
                        layer: d.layer,
                        file: d.file,
                        range: d.range,
                    })),
                    row: {
                        directory,
                        pattern: row.pattern,
                        nameFrom: row.name_from,
                        requirement: row.requirement,
                        requirementFrom: row.requirement_from,
                        status: row.status,
                        evidence: row.evidence,
                    },
                    texts: this.reader.texts(this.index, key, this.language),
                });
            }
        }
        return { status: 'read', keys, why: keys.length === 0 ? WHY.noLocalizationKey : null };
    }

    definitions(name: string): DefinitionsAnswer {
        if (this.index === null) {
            return { status: 'no-workspace', why: WHY.noWorkspace };
        }
        const groups = new Map<string, Definition[]>();
        for (const definition of this.index.definitions(name)) {
            push(
                groups,
                `${definition.database}\u0000${definition.container ?? '\u0001'}`,
                definition,
            );
        }
        const out: DefinitionGroupAnswer[] = [];
        for (const definitions of groups.values()) {
            const first = definitions[0];
            if (first === undefined) {
                continue;
            }
            const resolution = this.index.resolve(first.database, name, first.container);
            let inForce: InForceAnswer;
            switch (resolution.status) {
                case 'single':
                case 'not-read':
                    inForce = { status: resolution.status };
                    break;
                case 'winner':
                    inForce = {
                        status: 'winner',
                        rule: resolution.rule,
                        combine: resolution.combine,
                    };
                    break;
                case 'all':
                case 'statements':
                case 'clash':
                    inForce = { status: resolution.status, rule: resolution.rule };
                    break;
                case 'unknown':
                    inForce = { status: 'winner-not-known', reasons: resolution.reasons };
                    break;
                case 'not-defined':
                    continue;
            }
            out.push({
                database: first.database,
                container: first.container,
                inForce,
                definitions: resolution.definitions.map((d) => ({
                    layer: d.layer,
                    file: d.file,
                    range: d.range,
                    form: d.form,
                    prefix: d.prefix,
                    read: d.read,
                    inForce: inForceOf(d, resolution),
                })),
            });
        }
        return { status: 'read', groups: out };
    }

    uses(name: string, limit: number): UsesAnswer {
        if (this.index === null) {
            return { status: 'no-workspace', why: WHY.noWorkspace };
        }
        const all = this.index.references(name);
        const byLayer: Record<string, number> = {};
        for (const use of all) {
            byLayer[use.layer] = (byLayer[use.layer] ?? 0) + 1;
        }
        return {
            status: 'read',
            count: all.length,
            byLayer,
            limit,
            first: all.slice(0, limit).map((u) => ({
                layer: u.layer,
                file: u.file,
                range: u.range,
                read: u.read,
            })),
        };
    }

    *candidates(): Generator<Candidate> {
        for (const name of this.model.candidates) {
            yield { name, from: 'package' };
        }
        if (this.index !== null) {
            for (const name of this.index.definedNamesAll()) {
                yield { name, from: 'workspace' };
            }
        }
    }
}

/**
 * Everything the spec package says a name is, and where a workspace defines and uses it. The
 * answer lists every reading; `unknown` is true when the package has none.
 */
export function lookup(name: string, options: LookupOptions): LookupResult {
    const looker = new Looker(options);
    const readings = looker.readings(name);
    const definitions = looker.definitions(name);
    const uses = looker.uses(name, options.usesLimit ?? DEFAULT_USES_LIMIT);
    const dataTypes: DataTypesAnswer =
        options.dataTypes === true
            ? { status: 'read', entries: dataTypesOf(options.spec).named(name) }
            : { status: 'not-asked' };
    let suggestions: SuggestionsAnswer;
    const defined = definitions.status === 'read' && definitions.groups.length > 0;
    if (options.suggestions === false) {
        suggestions = { status: 'off' };
    } else if (readings.length > 0 || defined) {
        suggestions = { status: 'not-needed' };
    } else {
        const found = suggest(name, looker.candidates(), options.suggestions ?? {});
        suggestions = { status: 'computed', ...found };
    }
    return {
        name,
        spec: { version: options.spec.version, sha256: options.spec.sha256 },
        unknown: readings.every((r) => r.kind === 'defined'),
        readings,
        definitions,
        uses,
        dataTypes,
        suggestions,
    };
}
