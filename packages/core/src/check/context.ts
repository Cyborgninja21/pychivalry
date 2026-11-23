/**
 * Context (docs/PLAN.md item 4.3): which blocks of a file hold triggers, which hold effects,
 * which hold modifiers and which hold script values, read from the spec package alone. It
 * raises no finding of its own: it reads a file once and says, for every key it judges, what
 * that key is in its place, and the checks of `names/*` report from that reading. The scope
 * walk of item 4.4 (`check/scope.ts`) follows the scope through the same reading.
 *
 * Where each answer comes from:
 *
 * - A record's body: the directory's schema (`schema.<dir>.record_body`, a trigger or an
 *   effect block), or its record fields (`fields`, each with its `kind`). An inline
 *   `word name = { }` reads as the records of the directory whose content type is `word`.
 * - A field's block: `holds: modifiers` makes it a modifier block, and so does a row of part
 *   D7 (`modifier_block_areas`) whose status is `confirmed`, for the record body, a field or
 *   sub-field, a family of them, or a block at depth 3 or deeper by its key; the keys D7
 *   measures in such a block as no modifier (`structural_keys`, `other_keys`) are its
 *   parameters; a block whose
 *   direct children include a key of the table `value_block_keys`, or a field of
 *   `value_fields`, is a script value; a field of kind `trigger_block` or `effect_block` is
 *   that; a key of `opens_context` opens its context where the schema does not record the
 *   field.
 * - Inside a trigger or effect block: the parameters of the block around (an iterator's, a
 *   container's, a `block_params` entry's); `structural`; the context's bucket (a container of
 *   `containers` reads its body by its rule); links, which switch scope and keep the context;
 *   the keyword templates; iterators (a prefix of `iterator_prefixes` and a list base); the
 *   names a mod or the game defines in the directories of `vanilla_indexed_dirs`; the fields
 *   the schema records at the place.
 * - A scope chain (`scope:x.liege`): walked from where the table `scope_heads` says, or from a
 *   global link that takes data (`scope:x`, `title:k_x`); every later segment must be a link,
 *   and the last may be a value: a trigger whose usage line compares it with a value (part
 *   A5, `takes` form `comparison`), a trigger keyword template, or a name defined in a
 *   directory of `vanilla_indexed_dirs` (a script value).
 *
 * Rules of reading, each where the package itself is silent (docs/decisions.md, "Awaiting
 * confirmation", item 4.2):
 *
 * - The records of a directory whose content type is one of part B1's value groups (the
 *   package's own word for a value that names such a record: `script_value`) are script
 *   values, read as `value_block_keys` blocks are.
 * - A file of a directory the package has no record schema for is not read for triggers or
 *   effects: nothing says what its blocks are.
 * - A placeholder field (`<date>`, `<number>`: a key named by its shape, a dated history entry)
 *   is read as record fields, never as a trigger or effect block whatever its measured kind.
 * - A chain or a link written as a key outside trigger and effect blocks is a scope switch,
 *   never a record field: its body is read like the block around it.
 * - A key that differs from a known name only in letter case (`ROOT`, `IF`, `NOt`) is read as
 *   that name, as `structural` itself is ("in any case").
 * - Which iterator prefix belongs in a trigger block and which in an effect block is not
 *   judged: part D8 says which (`any_` a trigger, the others effects), but no game message
 *   ties an iterator of the wrong kind to the unknown-trigger or unknown-effect message, so
 *   that sub-case waits on the owner (docs/decisions.md, "Asked, awaiting the owner").
 * - Part D4 (`keyword_roles`) replaces nothing read here: every context it states for a
 *   keyword it states as the table entry this reader already reads (`stated_elsewhere`), and
 *   a test holds the two to each other.
 * - The body of a key that is unknown is not read, as the game skips it.
 *
 * The tables are trusted by the rule in `spec/tables.ts`. The core holds no keyword: every
 * name is looked up in the package, or in the definitions the caller says exist.
 */

import type { FolderTable } from '../index/folders.js';
import type {
    BucketName,
    DirectorySchema,
    ModifierBlockAreaRow,
    RetiredEntry,
    SchemaField,
} from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf, type Child, type ContainerRule, type Tables } from '../spec/tables.js';
import { vocabularyOf, type Vocabulary } from '../spec/vocabulary.js';
import {
    blockOf,
    significantItems,
    type Block,
    type FileNode,
    type Pair,
    type Scalar,
} from '../syntax/tree.js';

/** The two contexts keys are judged in. */
export type Context = 'trigger' | 'effect';

/** How a block's body is read. */
export type BlockKind = Context | 'modifiers' | 'script-value' | 'none';

/** The definitions the caller can see: the mod's, and the base game's when it is loaded. */
export interface DefinedNames {
    /** True when `name` is a top-level key of a file of the directory `database` that is read. */
    isDefined(name: string, database: string): boolean;
}

/** What a key in a trigger or effect block is. */
export type KeyReading =
    | { readonly kind: 'keyword'; readonly bucket: BucketName }
    | { readonly kind: 'link' }
    | { readonly kind: 'template'; readonly template: string; readonly database: string }
    | { readonly kind: 'iterator'; readonly prefix: string; readonly base: string }
    | { readonly kind: 'defined'; readonly database: string }
    | { readonly kind: 'block-param' }
    | { readonly kind: 'structural' }
    | { readonly kind: 'field' }
    | { readonly kind: 'opaque' }
    | { readonly kind: 'chain' }
    | {
          readonly kind: 'unknown';
          /** The buckets the name is in, none of them the context's (an effect in a trigger block). */
          readonly buckets: readonly BucketName[];
          /** When the name is an iterator prefix and a base the package has no list for. */
          readonly iterator: { readonly prefix: string; readonly base: string } | null;
          /** When the package marks the name removed in this context's bucket. */
          readonly retired: readonly RetiredEntry[];
      };

/** A key judged in a trigger or effect block. */
export interface JudgedKey {
    readonly pair: Pair;
    readonly context: Context;
    readonly reading: KeyReading;
    /** The name it was read as, when it differs from the key only in letter case. */
    readonly folded: string | null;
}

/** What a key in a modifier block is. */
export type ModifierReading =
    | { readonly kind: 'modifier-type' }
    | { readonly kind: 'template'; readonly templates: readonly string[] }
    /** Only a template the package marks as no proof alone fills it: neither proved nor refuted. */
    | { readonly kind: 'marked-only'; readonly templates: readonly string[] }
    | { readonly kind: 'defined'; readonly database: string }
    | { readonly kind: 'block-param' }
    | { readonly kind: 'field' }
    | { readonly kind: 'opaque' }
    | { readonly kind: 'unknown'; readonly retired: readonly RetiredEntry[] };

export interface JudgedModifier {
    readonly pair: Pair;
    readonly reading: ModifierReading;
    /** The modifier block it is written in. */
    readonly block: Block;
}

/**
 * A modifier block read from a record: the keys from the record's body to the block (`[]`
 * for the body itself), and the part D7 row that describes it, if one does (any status).
 */
export interface ModifierBlockSite {
    readonly path: readonly string[];
    readonly row: ModifierBlockAreaRow | null;
}

/** What walking a chain's segments found. */
export type ChainVerdict =
    | { readonly kind: 'not-walked' }
    | { readonly kind: 'links' }
    /** It ends in a value: a comparison trigger, a keyword template, a script value. */
    | { readonly kind: 'value'; readonly segment: string }
    | { readonly kind: 'bad'; readonly segment: string; readonly at: number };

/** A scope chain written as a key or as a value, the kind of block it is in, and its walk. */
export interface ChainSite {
    readonly scalar: Scalar;
    readonly position: 'key' | 'value';
    readonly block: BlockKind;
    readonly verdict: ChainVerdict;
}

/** How one file reads. */
export interface FileReading {
    /** The directory of the spec's list the file is in, if any. */
    readonly directory: string | null;
    readonly blocks: ReadonlyMap<Block, BlockKind>;
    readonly keys: readonly JudgedKey[];
    readonly modifiers: readonly JudgedModifier[];
    /** The modifier blocks read from a record's fields, with their place and D7 row. */
    readonly modifierBlocks: ReadonlyMap<Block, ModifierBlockSite>;
    readonly chains: readonly ChainSite[];
    /**
     * The schema fields a block's keys are read against, where the reading gives the block
     * any: a record's body, a field's block, a trigger or effect block a field opens (an event
     * option's `trigger`). Completion offers them (`lookup/complete.ts`); no check reads it.
     */
    readonly fields: ReadonlyMap<Block, Readonly<Record<string, SchemaField>>>;
}

export interface ReadInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod or game folder, with `/`. */
    readonly file: string;
    readonly tree: FileNode;
    readonly names: DefinedNames;
}

/** Extra keys a body accepts beyond its context's keywords. */
interface Extras {
    readonly params?: ReadonlyMap<string, Child> | undefined;
}

type Fields = Readonly<Record<string, SchemaField>> | undefined;

/** What the package says about record bodies and callable definitions, per package. */
interface Model {
    readonly vocabulary: Vocabulary;
    readonly tables: Tables;
    /** Directories whose records are trigger or effect blocks (`record_body`). */
    readonly bodies: ReadonlyMap<string, Context>;
    /** The same, by the directories' content types: the prefix word of an inline definition. */
    readonly prefixBodies: ReadonlyMap<string, Context>;
    /** Directories of `vanilla_indexed_dirs` whose records are callable in one context. */
    readonly callable: ReadonlyMap<Context, readonly string[]>;
    /** Directories of `vanilla_indexed_dirs` whose records have no body context. */
    readonly callableAnywhere: readonly string[];
    /** Directories whose records are values: their content type is a value group of part B1. */
    readonly valueDirectories: ReadonlySet<string>;
    /** Per key, the sub-fields the schema records for a top-level field of that name. */
    readonly borrowed: Map<string, Fields>;
    /** Part D7's rows, by directory. */
    readonly modifierAreas: ReadonlyMap<string, readonly ModifierBlockAreaRow[]>;
}

/**
 * Whether a key is one D7 measures in its block as no modifier: a field of the block
 * (`measured.structural_keys`: `parameter`, `terrain`) or another key it counts there
 * (`measured.other_keys`: `trade_good`). Read only where it makes a key not a finding.
 */
function blockKeyOf(row: ModifierBlockAreaRow | null, key: string): boolean {
    const measured = row?.['measured'];
    if (typeof measured !== 'object' || measured === null) {
        return false;
    }
    return ['structural_keys', 'other_keys'].some((group) => {
        const keys = (measured as Record<string, unknown>)[group];
        return (
            typeof keys === 'object' &&
            keys !== null &&
            Object.prototype.hasOwnProperty.call(keys, key)
        );
    });
}

/** Whether a key matches a segment of a D7 path: the key itself, or `<number>`, `<date>`. */
function segmentMatches(segment: string, key: string): boolean {
    if (segment === key) {
        return true;
    }
    if (segment === '<number>') {
        return /^-?[0-9]+(\.[0-9]+)?$/.test(key);
    }
    if (segment === '<date>') {
        return /^-?[0-9]+\.[0-9]+\.[0-9]+$/.test(key);
    }
    return false;
}

/**
 * The D7 row of a block at `path` below a record of `directory` (D7's own reading, its
 * `about.consumer`): `(record)` for the body itself, a field or sub-field by its keys, a family
 * `*.<g>` for each of its members, and `**.<key>` for every block with that key at depth 3 or
 * deeper.
 */
export function modifierAreaRow(
    rows: readonly ModifierBlockAreaRow[],
    path: readonly string[],
): ModifierBlockAreaRow | null {
    for (const row of rows) {
        const at = row.id.indexOf('::');
        const id = at < 0 ? row.id : row.id.slice(at + 2);
        if (id === '(record)') {
            if (path.length === 0) {
                return row;
            }
            continue;
        }
        const segments = id.split('.');
        if (segments[0] === '**') {
            const key = segments.slice(1).join('.');
            if (path.length >= 3 && segmentMatches(key, path[path.length - 1] ?? '')) {
                return row;
            }
            continue;
        }
        if (segments[0] === '*') {
            const members = row.members ?? [];
            if (
                path.length === 2 &&
                members.includes(path[0] ?? '') &&
                segmentMatches(segments.slice(1).join('.'), path[1] ?? '')
            ) {
                return row;
            }
            continue;
        }
        if (
            segments.length === path.length &&
            segments.every((segment, i) => segmentMatches(segment, path[i] ?? ''))
        ) {
            return row;
        }
    }
    return null;
}

function contextOfBody(body: string | undefined): Context | undefined {
    return body === 'trigger_block' ? 'trigger' : body === 'effect_block' ? 'effect' : undefined;
}

const models = new WeakMap<Spec, Model>();

function modelOf(spec: Spec): Model {
    const known = models.get(spec);
    if (known !== undefined) {
        return known;
    }
    const tables = tablesOf(spec);
    const bodies = new Map<string, Context>();
    const prefixBodies = new Map<string, Context>();
    for (const [dir, schema] of Object.entries(spec.data.schema)) {
        const context = contextOfBody(schema.record_body);
        if (context !== undefined) {
            bodies.set(dir, context);
            prefixBodies.set(schema.content_type, context);
        }
    }
    const callable = new Map<Context, string[]>([
        ['trigger', []],
        ['effect', []],
    ]);
    const anywhere: string[] = [];
    for (const dir of tables.vanillaIndexedDirs) {
        const context = bodies.get(dir);
        if (context === undefined) {
            anywhere.push(dir);
        } else {
            callable.get(context)?.push(dir);
        }
    }
    const groups = new Set<string>();
    const collect = (fields: Readonly<Record<string, SchemaField>>): void => {
        for (const field of Object.values(fields)) {
            for (const group of (field.value_type ?? '').split('|')) {
                groups.add(group);
            }
            if (field.fields !== undefined) {
                collect(field.fields);
            }
        }
    };
    for (const schema of Object.values(spec.data.schema)) {
        collect(schema.fields);
    }
    const valueDirectories = new Set(
        spec.data.directories.filter((d) => groups.has(d.content_type)).map((d) => d.path),
    );
    const modifierAreas = new Map<string, ModifierBlockAreaRow[]>();
    for (const row of spec.part('modifier_block_areas')?.fields ?? []) {
        modifierAreas.set(row.directory, [...(modifierAreas.get(row.directory) ?? []), row]);
    }
    const model: Model = {
        vocabulary: vocabularyOf(spec),
        valueDirectories,
        tables,
        bodies,
        prefixBodies,
        callable,
        callableAnywhere: anywhere,
        borrowed: new Map(),
        modifierAreas,
    };
    models.set(spec, model);
    return model;
}

function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
    return record !== undefined && Object.prototype.hasOwnProperty.call(record, key)
        ? record[key]
        : undefined;
}

/**
 * The schema field for a key: the field of that name, or a placeholder field (`<number>`,
 * `<date>`) named for the parser's own kind of the key's word.
 */
export function fieldFor(fields: Fields, key: Scalar): SchemaField | undefined {
    return fieldOf(fields, key)?.field;
}

/** The schema field for a key, and whether it is a placeholder field. */
export function fieldOf(
    fields: Fields,
    key: Scalar,
): { readonly field: SchemaField; readonly placeholder: boolean } | undefined {
    const named = own(fields, key.text);
    if (named !== undefined) {
        return { field: named, placeholder: false };
    }
    const placeholder = own(fields, `<${key.type}>`);
    return placeholder === undefined ? undefined : { field: placeholder, placeholder: true };
}

/** Keys that are not names: numbers, dates, quoted text, constants, `@[ ]`, `$PARAM$`. */
function isOpaque(key: Scalar): boolean {
    return (key.type !== 'name' && key.type !== 'chain') || key.text.includes('$');
}

class Reader {
    readonly blocks = new Map<Block, BlockKind>();
    readonly keys: JudgedKey[] = [];
    readonly modifiers: JudgedModifier[] = [];
    readonly modifierBlocks = new Map<Block, ModifierBlockSite>();
    readonly chains: ChainSite[] = [];
    readonly fields = new Map<Block, Readonly<Record<string, SchemaField>>>();
    /** The D7 rows of the file's directory. */
    private areas: readonly ModifierBlockAreaRow[] = [];
    private readonly local = new Map<Context, Set<string>>([
        ['trigger', new Set()],
        ['effect', new Set()],
    ]);
    private readonly vocabulary: Vocabulary;
    private readonly tables: Tables;

    constructor(
        private readonly model: Model,
        private readonly input: ReadInput,
    ) {
        this.vocabulary = model.vocabulary;
        this.tables = model.tables;
    }

    run(): string | null {
        const { spec, folders, file, tree } = this.input;
        const directory = folders.classify(file)?.folder.path ?? null;
        const schema: DirectorySchema | undefined =
            directory === null ? undefined : own(spec.data.schema, directory);
        this.areas = directory === null ? [] : (this.model.modifierAreas.get(directory) ?? []);
        for (const item of tree.items) {
            if (item.kind === 'pair' && item.prefix !== null) {
                const context = this.model.prefixBodies.get(item.prefix.text);
                if (context !== undefined) {
                    this.local.get(context)?.add(item.key.text);
                }
            }
        }
        const recordContext = directory === null ? undefined : this.model.bodies.get(directory);
        for (const item of tree.items) {
            if (item.kind !== 'pair') {
                continue;
            }
            const block = blockOf(item.value);
            if (block === undefined) {
                continue;
            }
            if (item.prefix !== null) {
                const context = this.model.prefixBodies.get(item.prefix.text);
                if (context !== undefined) {
                    this.walkContext(block, context, undefined, {});
                } else {
                    this.walkNone(block, undefined, false, null);
                }
            } else if (recordContext !== undefined) {
                this.walkContext(block, recordContext, undefined, {});
            } else if (directory !== null && this.model.valueDirectories.has(directory)) {
                this.walkNone(block, undefined, true, null);
            } else if (schema !== undefined) {
                const body = this.confirmedArea([]);
                if (body !== null) {
                    this.readModifiers(block, schema.fields, { path: [], row: body });
                } else {
                    this.walkNone(block, schema.fields, this.isValueBlock(block), []);
                }
            }
        }
        return directory;
    }

    // ─── Outside trigger and effect blocks ─────────────────────────────────

    private isValueBlock(block: Block): boolean {
        return significantItems(block).some(
            (item) => item.kind === 'pair' && this.tables.valueBlockKeys.has(item.key.text),
        );
    }

    /** The sub-fields the schema records for a top-level field of this name, in any directory. */
    private borrowedFields(key: string): Fields {
        if (this.model.borrowed.has(key)) {
            return this.model.borrowed.get(key);
        }
        let merged: Record<string, SchemaField> | undefined;
        for (const schema of Object.values(this.input.spec.data.schema)) {
            const field = own(schema.fields, key);
            if (field?.fields !== undefined) {
                merged = { ...(merged ?? {}), ...field.fields };
            }
        }
        this.model.borrowed.set(key, merged);
        return merged;
    }

    private noteChain(scalar: Scalar, position: 'key' | 'value', block: BlockKind): void {
        this.chains.push({
            scalar,
            position,
            block,
            verdict: this.walkChain(scalar.segments ?? []),
        });
    }

    private noteValueChain(pair: Pair, block: BlockKind): void {
        if (pair.value?.kind === 'scalar' && pair.value.type === 'chain') {
            this.noteChain(pair.value, 'value', block);
        }
    }

    /** A segment is a link, or a link that takes data written with its `:`; in any case. */
    private isLinkSegment(segment: string): boolean {
        const at = segment.indexOf(':');
        if (at > 0) {
            const head = segment.slice(0, at);
            return this.vocabulary.takesData(head) || this.vocabulary.takesData(head.toLowerCase());
        }
        return (
            this.vocabulary.has('links', segment) ||
            this.vocabulary.has('links', segment.toLowerCase())
        );
    }

    /** A segment that may end a chain as a value: a comparison trigger, a template, a script value. */
    private isValueSegment(segment: string): boolean {
        const takes = this.input.spec.data.buckets.triggers[segment]?.takes;
        if (
            Object.prototype.hasOwnProperty.call(this.input.spec.data.buckets.triggers, segment) &&
            (takes?.forms.includes('comparison') ?? false)
        ) {
            return true;
        }
        const at = segment.indexOf(':');
        if (at > 0) {
            // `tax_collector_aptitude:clan_tax_slot`: a comparison trigger given its data.
            return this.isValueSegment(segment.slice(0, at));
        }
        if (
            this.vocabulary
                .keywordTemplateFills('triggers', segment)
                .some((fill) => this.input.names.isDefined(fill.key, fill.template.keys))
        ) {
            return true;
        }
        return this.definedIn(segment, this.model.callableAnywhere) !== undefined;
    }

    /** Walk a chain's segments against the package's links (see the head of this file). */
    private walkChain(segments: readonly string[]): ChainVerdict {
        const head = segments[0];
        if (head === undefined || segments.some((s) => s.includes('$'))) {
            return { kind: 'not-walked' };
        }
        const colon = head.indexOf(':');
        const walked =
            colon > 0
                ? this.vocabulary.isDataHead(head.slice(0, colon)) ||
                  this.vocabulary.isDataHead(head.slice(0, colon).toLowerCase())
                : this.tables.scopeHeads.has(head) ||
                  this.tables.scopeHeads.has(head.toLowerCase());
        if (!walked) {
            return { kind: 'not-walked' };
        }
        for (let i = 1; i < segments.length; i++) {
            const segment = segments[i] ?? '';
            if (this.isLinkSegment(segment)) {
                continue;
            }
            if (i === segments.length - 1 && this.isValueSegment(segment)) {
                return { kind: 'value', segment };
            }
            return { kind: 'bad', segment, at: i };
        }
        return { kind: 'links' };
    }

    /** A D7 row for a block at `path` below the record, when its status is `confirmed`. */
    private confirmedArea(path: readonly string[]): ModifierBlockAreaRow | null {
        const row = modifierAreaRow(this.areas, path);
        return row?.status === 'confirmed' ? row : null;
    }

    /**
     * A body outside trigger and effect blocks: record fields, or script-value arithmetic.
     * `path` is the keys from the record's body to this block, or null when the block is not
     * reached through record fields alone.
     */
    private walkNone(
        block: Block,
        fields: Fields,
        valueMode: boolean,
        path: readonly string[] | null,
    ): void {
        const kind: BlockKind = valueMode ? 'script-value' : 'none';
        this.blocks.set(block, kind);
        if (fields !== undefined) {
            this.fields.set(block, fields);
        }
        for (const item of block.items) {
            if (item.kind === 'block') {
                this.walkNone(item, undefined, valueMode, null);
                continue;
            }
            if (item.kind !== 'pair') {
                continue;
            }
            if (item.key.type === 'chain') {
                this.noteChain(item.key, 'key', kind);
            }
            this.noteValueChain(item, kind);
            const body = blockOf(item.value);
            if (body === undefined) {
                continue;
            }
            const key = item.key.text;
            const below = path === null ? null : [...path, key];
            if (item.key.type === 'chain' || this.vocabulary.has('links', key)) {
                // A scope switch, not a record field: its body reads like the block around it.
                this.walkNone(body, undefined, valueMode || this.isValueBlock(body), null);
                continue;
            }
            const opens = this.tables.opensContext.get(key);
            if (valueMode) {
                if (opens === 'trigger') {
                    this.walkContext(body, 'trigger', undefined, {});
                } else {
                    this.walkNone(body, undefined, true, null);
                }
                continue;
            }
            const found = fieldOf(fields, item.key);
            const field = found?.field;
            const area = below === null ? null : this.confirmedArea(below);
            if ((field?.holds === 'modifiers' && found?.placeholder !== true) || area !== null) {
                this.readModifiers(body, field?.fields, {
                    path: below ?? [],
                    row: below === null ? null : modifierAreaRow(this.areas, below),
                });
                continue;
            }
            if (found?.placeholder === true) {
                // A dated or numbered entry: the record's own fields, never a context.
                this.walkNone(body, field?.fields, this.isValueBlock(body), below);
                continue;
            }
            if (this.tables.valueFields.has(key) || this.isValueBlock(body)) {
                this.walkNone(body, undefined, true, null);
                continue;
            }
            const extras: Extras = { params: this.tables.blockParams.get(key) };
            const fieldContext = contextOfBody(field?.kind);
            if (fieldContext !== undefined) {
                this.walkContext(body, fieldContext, field?.fields, extras);
                continue;
            }
            if (opens === 'trigger' || opens === 'effect') {
                this.walkContext(body, opens, field?.fields ?? this.borrowedFields(key), extras);
                continue;
            }
            this.walkNone(body, field?.fields, false, below);
        }
    }

    // ─── Trigger and effect blocks ─────────────────────────────────────────

    private walkContext(block: Block, context: Context, allowed: Fields, extras: Extras): void {
        this.blocks.set(block, context);
        if (allowed !== undefined) {
            this.fields.set(block, allowed);
        }
        for (const item of block.items) {
            if (item.kind === 'block') {
                this.walkContext(item, context, allowed, {});
            } else if (item.kind === 'pair') {
                this.judge(item, context, allowed, extras);
            }
        }
    }

    /** Read a block below a key: `same` keeps the context, `none` reads it as no context. */
    private descend(pair: Pair, child: Child, context: Context): void {
        const body = blockOf(pair.value);
        if (body === undefined) {
            return;
        }
        if (child === 'none' || this.isValueBlock(body)) {
            this.walkNone(body, undefined, child !== 'none', null);
        } else {
            this.walkContext(body, child === 'same' ? context : child, undefined, {});
        }
    }

    private note(
        pair: Pair,
        context: Context,
        reading: KeyReading,
        folded: string | null = null,
    ): void {
        this.keys.push({ pair, context, reading, folded });
    }

    private isList(base: string): boolean {
        return (
            this.vocabulary.has('lists', base) ||
            this.model.callableAnywhere.some((dir) => this.input.names.isDefined(base, dir))
        );
    }

    private definedIn(name: string, dirs: readonly string[]): string | undefined {
        return dirs.find((dir) => this.input.names.isDefined(name, dir));
    }

    private judge(pair: Pair, context: Context, allowed: Fields, extras: Extras): void {
        const key = pair.key;
        const name = key.text;
        const bucket: BucketName = context === 'trigger' ? 'triggers' : 'effects';
        this.noteValueChain(pair, context);
        if (isOpaque(key)) {
            this.note(pair, context, { kind: 'opaque' });
            this.descend(pair, name.includes('$') ? 'none' : 'same', context);
            return;
        }
        if (key.type === 'chain') {
            this.noteChain(key, 'key', context);
            this.note(pair, context, { kind: 'chain' });
            this.descend(pair, 'same', context);
            return;
        }
        if (this.judgeName(pair, name, null, context, extras)) {
            return;
        }
        const scripted =
            (this.local.get(context)?.has(name) ?? false)
                ? 'inline'
                : this.definedIn(name, this.model.callable.get(context) ?? []);
        if (scripted !== undefined) {
            this.note(pair, context, { kind: 'defined', database: scripted });
            this.descend(pair, 'none', context);
            return;
        }
        const field = fieldFor(allowed, key);
        if (field !== undefined) {
            this.note(pair, context, { kind: 'field' });
            const opens = this.tables.opensContext.get(name);
            const fieldContext = contextOfBody(field.kind);
            this.descend(
                pair,
                fieldContext ?? (opens === 'trigger' || opens === 'effect' ? opens : 'none'),
                context,
            );
            return;
        }
        const anywhere = this.definedIn(name, this.model.callableAnywhere);
        if (anywhere !== undefined) {
            this.note(pair, context, { kind: 'defined', database: anywhere });
            this.descend(pair, 'none', context);
            return;
        }
        const folded = name.toLowerCase();
        if (folded !== name && this.judgeName(pair, folded, folded, context, extras)) {
            return;
        }
        this.note(pair, context, {
            kind: 'unknown',
            buckets: this.vocabulary.bucketsOf(name),
            iterator: this.vocabulary.iteratorOf(name) ?? null,
            retired: this.vocabulary.retired(bucket, name),
        });
    }

    /**
     * Judge a key by what the package and the tables say a name is: a parameter of the block
     * around, a structural name, a keyword of the context, a link, a keyword template, an
     * iterator. `folded` is the name read in lower case, or null for the key as written.
     * True when the key was judged.
     */
    private judgeName(
        pair: Pair,
        name: string,
        folded: string | null,
        context: Context,
        extras: Extras,
    ): boolean {
        const bucket: BucketName = context === 'trigger' ? 'triggers' : 'effects';
        const param = extras.params?.get(name);
        if (param !== undefined) {
            this.note(pair, context, { kind: 'block-param' }, folded);
            this.descend(pair, param, context);
            return true;
        }
        const structural = this.tables.structural.get(name);
        if (structural !== undefined) {
            this.note(pair, context, { kind: 'structural' }, folded);
            this.descend(pair, structural, context);
            return true;
        }
        if (this.vocabulary.has(bucket, name)) {
            this.note(pair, context, { kind: 'keyword', bucket }, folded);
            const container = this.tables.containers.get(name);
            if (container !== undefined) {
                this.descendContainer(pair, container, context);
            } else {
                this.descend(pair, this.vocabulary.has('links', name) ? 'same' : 'none', context);
            }
            return true;
        }
        if (this.vocabulary.has('links', name)) {
            this.note(pair, context, { kind: 'link' }, folded);
            this.descend(pair, 'same', context);
            return true;
        }
        for (const fill of this.vocabulary.keywordTemplateFills(bucket, name)) {
            if (this.input.names.isDefined(fill.key, fill.template.keys)) {
                this.note(
                    pair,
                    context,
                    {
                        kind: 'template',
                        template: fill.template.template,
                        database: fill.template.keys,
                    },
                    folded,
                );
                this.descend(pair, 'none', context);
                return true;
            }
        }
        const iterator = this.vocabulary.iteratorOf(name);
        if (iterator !== undefined && this.isList(iterator.base)) {
            this.note(pair, context, { kind: 'iterator', ...iterator }, folded);
            const body = blockOf(pair.value);
            if (body !== undefined) {
                this.walkContext(body, context, undefined, {
                    params: this.tables.iteratorParamsFor(iterator.base),
                });
            }
            return true;
        }
        return false;
    }

    private descendContainer(pair: Pair, rule: ContainerRule, context: Context): void {
        const body = blockOf(pair.value);
        if (body === undefined) {
            return;
        }
        if (rule.child === 'none' || this.isValueBlock(body)) {
            this.walkNone(body, undefined, false, null);
            return;
        }
        const inner: Context = rule.child === 'same' ? context : rule.child;
        if (!rule.cases) {
            this.walkContext(body, inner, undefined, { params: rule.params });
            return;
        }
        this.blocks.set(body, inner);
        for (const item of body.items) {
            if (item.kind !== 'pair') {
                continue;
            }
            const param = rule.params.get(item.key.text);
            if (param !== undefined) {
                this.note(item, inner, { kind: 'block-param' });
                this.descend(item, param, inner);
                continue;
            }
            const caseBody = blockOf(item.value);
            if (caseBody !== undefined) {
                this.walkContext(caseBody, inner, undefined, { params: rule.caseParams });
            }
        }
    }

    // ─── Modifier blocks ───────────────────────────────────────────────────

    private readModifiers(block: Block, fields: Fields, site: ModifierBlockSite): void {
        this.blocks.set(block, 'modifiers');
        this.modifierBlocks.set(block, site);
        if (fields !== undefined) {
            this.fields.set(block, fields);
        }
        for (const item of block.items) {
            if (item.kind !== 'pair') {
                continue;
            }
            this.modifiers.push({
                pair: item,
                reading: this.modifierReading(item.key, fields, site.row),
                block,
            });
        }
    }

    private modifierReading(
        key: Scalar,
        fields: Fields,
        row: ModifierBlockAreaRow | null,
    ): ModifierReading {
        const name = key.text;
        if (isOpaque(key) || key.type === 'chain') {
            return { kind: 'opaque' };
        }
        if (fieldFor(fields, key) !== undefined) {
            return { kind: 'field' };
        }
        if (this.tables.modifierBlockParams.has(name) || blockKeyOf(row, name)) {
            return { kind: 'block-param' };
        }
        if (this.vocabulary.has('modifiers', name)) {
            return { kind: 'modifier-type' };
        }
        const match = this.vocabulary.modifierTemplateMatch(name);
        if (match.kind === 'template') {
            return { kind: 'template', templates: match.templates };
        }
        const defined = this.definedIn(name, this.model.callableAnywhere);
        if (defined !== undefined) {
            return { kind: 'defined', database: defined };
        }
        if (match.kind === 'marked-only') {
            return { kind: 'marked-only', templates: match.templates };
        }
        return { kind: 'unknown', retired: this.vocabulary.retired('modifiers', name) };
    }
}

/** Read one file: the kind of every block, and what every key in a judged block is. */
export function readContext(input: ReadInput): FileReading {
    const reader = new Reader(modelOf(input.spec), input);
    const directory = reader.run();
    return {
        directory,
        blocks: reader.blocks,
        keys: reader.keys,
        modifiers: reader.modifiers,
        modifierBlocks: reader.modifierBlocks,
        chains: reader.chains,
        fields: reader.fields,
    };
}
