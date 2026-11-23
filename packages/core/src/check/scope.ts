/**
 * Scope (docs/PLAN.md item 4.4): the scope type each block of a file runs in, from the spec
 * package alone. It raises no finding of its own: it follows the scope through a file the
 * context reader (`check/context.ts`) has read, by what that reader read each key as, and the
 * checks of `scope/*` report from it. Where the package does not say what a scope is, the
 * scope is unknown, with the reason, and nothing that depends on it is judged.
 *
 * A frame is two scopes: the current one (`this`) and the record's root (`root`). Where each
 * comes from (docs/decisions.md, "Awaiting confirmation", item 4.4):
 *
 * - **A record's root.** The scope named by the key a confirmed part D4 row gives the role
 *   `sets_root_scope` (an event's `scope = <type>`, where the record writes it); for a record of
 *   the on-action database (the database part D6 says adds the on-actions bucket), the one
 *   scope the game's own documentation expects that on-action in (`scope_validity.on_actions`);
 *   otherwise the directory schema's `root_scope`. A value that is no scope type of the
 *   package's `scope_types` (`title`, `none`) leaves the root unknown. None: a directory the
 *   table `root_scope_contradicted` lists; a directory of `vanilla_indexed_dirs`, whose
 *   definitions other script calls by name and which run in the caller's scope (scripted
 *   triggers, effects and modifiers, script values); an inline `scripted_trigger name = { }`.
 * - **A record's fields.** The record's frame, but: a field the schema gives a `scope` (the
 *   game evaluates it in another scope than the root, measured on the base game) runs in that
 *   scope, with its root not known; a field of the table `fields_outside_root` is unknown.
 *   Paradox's `.info` scope notes (`info_scope`) are a hint beside the root, never in its place:
 *   where a note gives the field's root or current scope as another scope type than the
 *   record's root, the field's scope is unknown. A dated or numbered entry (`<date>`) holds the
 *   record's own fields. A block below a field that no rule here follows is unknown, its root
 *   too: a field's own fields may run with a root of their own (a decision's `widget` runs its
 *   `title_valid` with the title as root).
 * - **Inside a trigger or effect block**, by what the context reader read the key as:
 *   - a link written as a block key (`liege = { }`) or a scope chain (`root.primary_title = { }`,
 *     `title:k_x.holder = { }`): the output scope of each link, from the game's own
 *     documentation (`scope_validity.links`), by the form that takes data where the segment
 *     gives it (`title:k_x`). A link whose output is no single scope type (`scope:x`, `var:x`)
 *     gives an unknown scope: the package states no type for a saved scope or a variable. The
 *     output does not depend on the input, so a link applied to an unknown scope still gives it;
 *     a link applied to a scope it cannot start from gives an unknown scope, so that one mistake
 *     is one finding.
 *   - a head of the table `scope_heads` (any letter case): the root (`root = { }`, `root.liege`)
 *     or the current scope. Which head is which is read from the package (`headsOf`). The third
 *     head, the previous scope, is not followed: it is unknown.
 *   - an iterator (`every_vassal = { }`): the element scope of its list (`scope_validity.lists`).
 *   - a key of the table `same_scope_structural` (any letter case), a container of the table
 *     `containers` (whose consumer keeps the scope through them), and a case block of a
 *     container with `cases`: the same frame.
 *   - a keyword's own block (its parameters), a scripted trigger or effect called with
 *     arguments, a keyword template's block: unknown, the root too, for the game runs a
 *     callback written there with scopes of its own. A parameter block of an iterator, a
 *     container or a `block_params` entry, a field of the block (an event option's `trigger`),
 *     a key that is no name: unknown, the root kept.
 * - **Outside trigger and effect blocks** (a record's fields, a script value, a keyword's
 *   parameters): a case label of a container with `cases` keeps the frame, and so does an
 *   operation of a script value (a key of `value_block_keys`, `value = { }` among them, though
 *   `value` is also a link); a link or a chain switches scope as in other script, and in a
 *   script value an iterator over a list does too (the script values `.info`, read in part D8);
 *   containers and the keys of `same_scope_structural` keep the frame.
 *
 * A key that is a link with a value that is no block (`liege = root`) is a comparison, not a
 * scope switch. A tagged value (`hsv { 0.5 0.5 0.5 }`) is a value, not a block of script.
 *
 * The core holds no keyword: every name is looked up in the package.
 */

import type { DirectorySchema, KeywordRoleRow, LinkForm, SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf, type ContainerRule, type Tables } from '../spec/tables.js';
import { vocabularyOf, type Vocabulary } from '../spec/vocabulary.js';
import type { Block, Pair, Scalar } from '../syntax/tree.js';
import {
    fieldOf,
    type BlockKind,
    type ChainSite,
    type Context,
    type FileReading,
    type JudgedKey,
    type ReadInput,
} from './context.js';
import { onActionPlaces } from './names-unknown-on-action.js';

/** Why a scope is not known. */
export type UnknownWhy =
    /** `scripted_trigger name = { }` written in another directory: whatever calls it. */
    | 'inline-definition'
    /** A file in no directory of the package. */
    | 'no-directory'
    /** The directory is in the table `root_scope_contradicted`. */
    | 'root-contradicted'
    /** The directory schema gives no root scope. */
    | 'no-root-scope'
    /** A definition other script calls by name (`vanilla_indexed_dirs`): its caller's scope. */
    | 'called'
    /** The root the package or the record names is no scope type of `scope_types`. */
    | 'not-a-scope-type'
    /** An on-action the game's documentation expects in no one scope. */
    | 'on-action-scope'
    /** A record field of the table `fields_outside_root`. */
    | 'field-outside-root'
    /** The root inside a field the schema gives another scope. */
    | 'field-scope'
    /** A field the schema gives several scopes. */
    | 'field-several-scopes'
    /** A field whose `.info` scope note names another scope type than the record's root. */
    | 'info-scope-disagrees'
    /** A block below a record field that no rule follows. */
    | 'sub-field'
    /** A keyword's own block, a call's arguments: run with scopes of their own. */
    | 'parameters'
    /** A parameter block of an iterator, a container or a `block_params` entry. */
    | 'parameter-block'
    /** A block under a key that is no name: a number, a date, a `$PARAM$`. */
    | 'opaque-key'
    /** The previous scope (the third head of `scope_heads`), which is not followed. */
    | 'previous-scope'
    /** A link whose output is no single scope type: a saved scope, a variable. */
    | 'link-output'
    /** An iterator over a list whose element is no single scope type. */
    | 'list-element'
    /** After a link applied to a scope it cannot start from. */
    | 'after-wrong-link'
    /** A chain that ends in a value, holds a `$PARAM$`, or has a segment that is no link. */
    | 'chain'
    /** A key of a trigger or effect block the context reader read as nothing. */
    | 'unread';

/** A scope: a scope type of the package's `scope_types`, or unknown with the reason. */
export type Scope =
    | { readonly type: string }
    | { readonly type: null; readonly why: UnknownWhy; readonly detail?: string };

/** The scopes a block runs in: the current one and the record's root. */
export interface ScopeFrame {
    readonly this: Scope;
    readonly root: Scope;
}

/** One link applied to a scope: a link key, or one segment of a chain. */
export interface LinkStep {
    /** The key or value it is written in. */
    readonly scalar: Scalar;
    readonly position: 'key' | 'value';
    /** The link, without its data (`title` of `title:k_x`). */
    readonly link: string;
    /** The segment as written, and its place in the chain (0 for a link key). */
    readonly segment: string;
    readonly index: number;
    /** The scope it is applied to. */
    readonly input: Scope;
    /** The scopes it may start from, when every form of it states them; null when one does not. */
    readonly expected: readonly string[] | null;
    /** The pair it is written in, and the kind of the block that pair stands in. */
    readonly pair: Pair;
    readonly block: BlockKind;
}

/** How the scope runs through one file. */
export interface ScopeReading {
    /** The frame of every block the walk reached. */
    readonly frames: ReadonlyMap<Block, ScopeFrame>;
    /** The frame every pair of those blocks is read in: the frame of its block. */
    readonly pairs: ReadonlyMap<Pair, ScopeFrame>;
    /** Every link applied, as a key or a segment of a chain. */
    readonly links: readonly LinkStep[];
}

type Fields = Readonly<Record<string, SchemaField>> | undefined;

/** Where a block stands, beyond its frame. */
interface Place {
    /** The block is a record's body, or a dated entry of it: its keys are the record's fields. */
    readonly recordBody: boolean;
    readonly fields: Fields;
    /** The container whose body the block is, when its keys but its parameters are case labels. */
    readonly cases: ContainerRule | null;
}

const NOWHERE: Place = { recordBody: false, fields: undefined, cases: null };

/** The place of a container's body. */
function containerBody(rule: ContainerRule): Place {
    return { ...NOWHERE, cases: rule.cases ? rule : null };
}

function unknown(why: UnknownWhy, detail?: string): Scope {
    return detail === undefined ? { type: null, why } : { type: null, why, detail };
}

function unknownFrame(why: UnknownWhy): ScopeFrame {
    return { this: unknown(why), root: unknown(why) };
}

/** What the package says about scopes, per package. */
interface Model {
    readonly vocabulary: Vocabulary;
    readonly tables: Tables;
    /** The scope types of `scope_types`. */
    readonly types: ReadonlySet<string>;
    /** The head of `scope_heads` that is the record's root, and the one that is the current scope. */
    readonly rootHead: string | null;
    readonly thisHead: string | null;
    /** `same_scope_structural`, in lower case: the table is read in any letter case. */
    readonly sameScope: ReadonlySet<string>;
    /** Per directory, the keys a confirmed D4 row says set the record's root scope. */
    readonly rootSetters: ReadonlyMap<string, readonly string[]>;
    /** The keys a confirmed D4 row says set the root in every directory. */
    readonly rootSettersAnywhere: readonly string[];
    /** The on-action database (part D6), whose records' roots the game's documentation gives. */
    readonly onActions: string | null;
    /** Part D8: per iterator prefix, the kind of block it belongs in, where the row is confirmed. */
    readonly prefixKinds: ReadonlyMap<string, Context>;
}

/** The D4 role of a key that sets its record's root scope: the part's own word. */
const SETS_ROOT_SCOPE = 'sets_root_scope';

/** The word of `scope_validity` for a keyword that declares no requirement (spec README). */
const NO_REQUIREMENT = 'none';

/** The words a schema field's `info_scope` notes name their scopes by (part C1). */
function infoScopeWords(schema: Readonly<Record<string, DirectorySchema>>): Set<string> {
    const words = new Set<string>();
    const collect = (fields: Fields): void => {
        for (const field of Object.values(fields ?? {})) {
            // A note about no named scope has a null `scope`: it names no head.
            for (const note of field.info_scope ?? []) {
                words.add(note.scope);
            }
            collect(field.fields);
        }
    };
    for (const dir of Object.values(schema)) {
        collect(dir.fields);
    }
    return words;
}

/**
 * Which head of the table `scope_heads` is the record's root and which is the current scope.
 * The table names three, "the top scope, the current one and the previous one" (its `about`).
 * The package format names the scope a field's `info_scope` note is about by the words of two
 * of them, the root and the current scope (`schema.format7.json`: "root, this, scope:<name>,
 * or null"). Of the two heads the notes name, the one the game documents as a global link is
 * the root (it does not depend on the scope it is written in) and the one it documents as no
 * global link is the current scope. Unless that gives exactly one of each, neither is known.
 */
export function headsOf(spec: Spec): {
    readonly root: string | null;
    readonly this: string | null;
} {
    const tables = tablesOf(spec);
    const vocabulary = vocabularyOf(spec);
    const words = infoScopeWords(spec.data.schema);
    const named = [...tables.scopeHeads].filter((head) => words.has(head));
    const global = (head: string): boolean | null => {
        const forms = vocabulary.linkForms(head);
        if (forms.length === 0) {
            return null;
        }
        if (forms.every((f) => f.global_link)) {
            return true;
        }
        return forms.every((f) => !f.global_link) ? false : null;
    };
    const roots = named.filter((head) => global(head) === true);
    const currents = named.filter((head) => global(head) === false);
    if (named.length !== 2 || roots.length !== 1 || currents.length !== 1) {
        return { root: null, this: null };
    }
    return { root: roots[0] ?? null, this: currents[0] ?? null };
}

/** A confirmed D4 row whose role `sets_root_scope` is confirmed. */
function setsRoot(row: KeywordRoleRow): boolean {
    return (
        row.status === 'confirmed' &&
        row.roles.includes(SETS_ROOT_SCOPE) &&
        row.role_status[SETS_ROOT_SCOPE] === 'confirmed'
    );
}

const models = new WeakMap<Spec, Model>();

function modelOf(spec: Spec): Model {
    const known = models.get(spec);
    if (known !== undefined) {
        return known;
    }
    const tables = tablesOf(spec);
    const heads = headsOf(spec);
    const rootSetters = new Map<string, string[]>();
    const anywhere: string[] = [];
    for (const row of spec.part('keyword_roles')?.keywords ?? []) {
        if (!setsRoot(row)) {
            continue;
        }
        if (row.where.directories === 'anywhere') {
            anywhere.push(row.keyword);
            continue;
        }
        for (const dir of row.where.directories) {
            rootSetters.set(dir, [...(rootSetters.get(dir) ?? []), row.keyword]);
        }
    }
    const prefixKinds = new Map<string, Context>();
    for (const row of spec.part('iterator_kinds')?.prefixes ?? []) {
        if (row.status === 'confirmed' && (row.kind === 'trigger' || row.kind === 'effect')) {
            prefixKinds.set(row.prefix, row.kind);
        }
    }
    const model: Model = {
        vocabulary: vocabularyOf(spec),
        tables,
        types: new Set(Object.keys(spec.data.scope_types)),
        rootHead: heads.root,
        thisHead: heads.this,
        sameScope: new Set([...tables.sameScopeStructural].map((k) => k.toLowerCase())),
        rootSetters,
        rootSettersAnywhere: anywhere,
        onActions: onActionPlaces(spec).database,
        prefixKinds,
    };
    models.set(spec, model);
    return model;
}

/** The one scope type of a list, or null when it is not exactly one scope type. */
function single(types: Iterable<string>, known: ReadonlySet<string>): string | null {
    const set = new Set(types);
    if (set.size !== 1) {
        return null;
    }
    const [type] = set;
    return type !== undefined && known.has(type) ? type : null;
}

function own<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
    return record !== undefined && Object.prototype.hasOwnProperty.call(record, key)
        ? record[key]
        : undefined;
}

class Walker {
    readonly frames = new Map<Block, ScopeFrame>();
    readonly pairs = new Map<Pair, ScopeFrame>();
    readonly links: LinkStep[] = [];
    private readonly keys = new Map<Pair, JudgedKey>();
    private readonly chains = new Map<Scalar, ChainSite>();
    private readonly vocabulary: Vocabulary;
    private readonly tables: Tables;
    private readonly directory: string | null;

    constructor(
        private readonly model: Model,
        private readonly input: ReadInput,
        private readonly reading: FileReading,
    ) {
        this.vocabulary = model.vocabulary;
        this.tables = model.tables;
        this.directory = reading.directory;
        for (const judged of reading.keys) {
            this.keys.set(judged.pair, judged);
        }
        for (const site of reading.chains) {
            this.chains.set(site.scalar, site);
        }
    }

    run(): void {
        const schema: DirectorySchema | undefined =
            this.directory === null ? undefined : own(this.input.spec.data.schema, this.directory);
        for (const item of this.input.tree.items) {
            if (item.kind !== 'pair' || item.value?.kind !== 'block') {
                continue;
            }
            this.walk(item.value, this.recordFrame(item, item.value), {
                recordBody: item.prefix === null,
                fields: schema?.fields,
                cases: null,
            });
        }
    }

    // ─── Roots ─────────────────────────────────────────────────────────────

    private scopeOf(type: string | null | undefined, why: UnknownWhy): Scope {
        if (type === null || type === undefined) {
            return unknown(why);
        }
        return this.model.types.has(type) ? { type } : unknown(why, type);
    }

    private recordFrame(record: Pair, body: Block): ScopeFrame {
        if (record.prefix !== null) {
            return unknownFrame('inline-definition');
        }
        const dir = this.directory;
        if (dir === null) {
            return unknownFrame('no-directory');
        }
        if (this.tables.rootScopeContradicted.has(dir)) {
            return unknownFrame('root-contradicted');
        }
        const root = this.rootOf(record, body, dir);
        return { this: root, root };
    }

    private rootOf(record: Pair, body: Block, dir: string): Scope {
        const setters = [
            ...(this.model.rootSetters.get(dir) ?? []),
            ...this.model.rootSettersAnywhere,
        ];
        for (const item of body.items) {
            if (item.kind === 'pair' && setters.includes(item.key.text)) {
                const value = item.value?.kind === 'scalar' ? item.value.text : null;
                return this.scopeOf(value, 'not-a-scope-type');
            }
        }
        if (dir === this.model.onActions) {
            const documented = this.vocabulary.scopeValidity('on_actions', record.key.text);
            return documented === undefined
                ? unknown('on-action-scope')
                : this.scopeOf(
                      single(documented.supported_scopes, this.model.types),
                      'on-action-scope',
                  );
        }
        if (this.tables.vanillaIndexedDirs.has(dir)) {
            return unknown('called');
        }
        const schema = own(this.input.spec.data.schema, dir);
        if (schema?.root_scope === undefined) {
            return unknown('no-root-scope');
        }
        return this.scopeOf(schema.root_scope, 'not-a-scope-type');
    }

    // ─── The walk ──────────────────────────────────────────────────────────

    private walk(block: Block, frame: ScopeFrame, place: Place): void {
        const kind = this.reading.blocks.get(block);
        if (kind === undefined) {
            return;
        }
        this.frames.set(block, frame);
        const inContext = kind === 'trigger' || kind === 'effect';
        for (const item of block.items) {
            if (item.kind === 'block') {
                this.walk(item, inContext ? frame : unknownFrame('sub-field'), NOWHERE);
                continue;
            }
            if (item.kind !== 'pair') {
                continue;
            }
            this.pairs.set(item, frame);
            if (inContext) {
                this.valueChain(item, frame, kind);
            }
            if (item.value?.kind !== 'block') {
                continue;
            }
            const [child, childPlace] = inContext
                ? this.inContext(item, frame, place, kind)
                : this.outside(item, frame, place, kind);
            this.walk(item.value, child, childPlace);
        }
    }

    /** The frame of the block of a key in a trigger or effect block. */
    private inContext(
        pair: Pair,
        frame: ScopeFrame,
        place: Place,
        kind: BlockKind,
    ): [ScopeFrame, Place] {
        const judged = this.keys.get(pair);
        if (judged === undefined) {
            // A container's case label (`random_list`'s `10 = { }`): its block keeps the scope.
            return [place.cases !== null ? frame : unknownFrame('unread'), NOWHERE];
        }
        const name = judged.folded ?? pair.key.text;
        const reading = judged.reading;
        switch (reading.kind) {
            case 'link':
                return [this.switchTo(pair, name, frame, kind), NOWHERE];
            case 'structural': {
                const head = this.headScope(name, frame, frame.this);
                if (head !== undefined) {
                    return [{ this: head, root: frame.root }, NOWHERE];
                }
                return [
                    this.model.sameScope.has(name.toLowerCase())
                        ? frame
                        : unknownFrame('parameters'),
                    NOWHERE,
                ];
            }
            case 'keyword': {
                if (this.model.sameScope.has(name.toLowerCase())) {
                    // `nor = { }`: the lower-case spelling is registered as a trigger.
                    return [frame, NOWHERE];
                }
                const container = this.tables.containers.get(name);
                if (container !== undefined && container.child !== 'none') {
                    return [frame, containerBody(container)];
                }
                if (this.vocabulary.has('links', name)) {
                    return [this.switchTo(pair, name, frame, kind), NOWHERE];
                }
                return [unknownFrame('parameters'), NOWHERE];
            }
            case 'iterator':
                return [{ this: this.element(reading.base), root: frame.root }, NOWHERE];
            case 'chain':
                return [
                    { this: this.chain(pair.key, 'key', pair, frame, kind), root: frame.root },
                    NOWHERE,
                ];
            case 'defined':
            case 'template':
            case 'unknown':
                return [unknownFrame('parameters'), NOWHERE];
            case 'block-param':
                return [{ this: unknown('parameter-block'), root: frame.root }, NOWHERE];
            case 'field':
                return [{ this: unknown('sub-field'), root: frame.root }, NOWHERE];
            case 'opaque':
                return [{ this: unknown('opaque-key'), root: frame.root }, NOWHERE];
        }
    }

    /** The frame of the block of a key outside trigger and effect blocks. */
    private outside(
        pair: Pair,
        frame: ScopeFrame,
        place: Place,
        kind: BlockKind,
    ): [ScopeFrame, Place] {
        const key = pair.key;
        const name = key.text;
        if (place.cases !== null && !place.cases.params.has(name)) {
            // A case label of a container (`switch`'s `doctrine:x = { }` in a script value): a
            // value the case is compared with, whose block keeps the scope.
            return [frame, NOWHERE];
        }
        if (this.tables.valueBlockKeys.has(name)) {
            // An operation of a script value (`value = { }`, `add = { }`), inline in a script
            // value or in a keyword's parameters: worked out in the scope it is written in.
            return [frame, NOWHERE];
        }
        if (key.type === 'chain') {
            return [{ this: this.chain(key, 'key', pair, frame, kind), root: frame.root }, NOWHERE];
        }
        if (this.vocabulary.has('links', name)) {
            return [this.switchTo(pair, name, frame, kind), NOWHERE];
        }
        const container = this.tables.containers.get(name);
        if (container !== undefined && container.child !== 'none') {
            return [frame, containerBody(container)];
        }
        if (this.model.sameScope.has(name.toLowerCase())) {
            return [frame, NOWHERE];
        }
        if (kind === 'script-value') {
            const iterator = this.vocabulary.iteratorOf(name);
            if (iterator !== undefined && this.vocabulary.has('lists', iterator.base)) {
                return [{ this: this.element(iterator.base), root: frame.root }, NOWHERE];
            }
        }
        if (place.recordBody) {
            const found = fieldOf(place.fields, key);
            if (found?.placeholder === true) {
                // A dated or numbered entry: the record's own fields, in the record's frame.
                return [frame, { recordBody: true, fields: found.field.fields, cases: null }];
            }
            return [this.fieldFrame(name, found?.field, frame), NOWHERE];
        }
        return [unknownFrame('sub-field'), NOWHERE];
    }

    /** A record field's frame: the record's, or the scope the package gives the field. */
    private fieldFrame(
        name: string,
        field: SchemaField | undefined,
        frame: ScopeFrame,
    ): ScopeFrame {
        const dir = this.directory;
        if (dir !== null && (this.tables.fieldsOutsideRoot.get(dir)?.has(name) ?? false)) {
            return unknownFrame('field-outside-root');
        }
        if (field?.scope !== undefined) {
            const type = single(field.scope, this.model.types);
            return type === null
                ? { this: unknown('field-several-scopes'), root: unknown('field-scope') }
                : { this: { type }, root: unknown('field-scope') };
        }
        if (this.infoDisagrees(field, frame)) {
            return { this: unknown('info-scope-disagrees'), root: frame.root };
        }
        return frame;
    }

    /**
     * Whether a field's `.info` scope notes give its root or its current scope as a scope type
     * other than the record's root: a hint, which can only stop a judgement. A note that names no
     * scope type of the package (`Character` is `character`; `title` is none) says nothing.
     */
    private infoDisagrees(field: SchemaField | undefined, frame: ScopeFrame): boolean {
        const root = frame.root.type;
        if (field?.info_scope === undefined || root === null) {
            return false;
        }
        return field.info_scope.some((note) => {
            if (note.scope !== this.model.rootHead && note.scope !== this.model.thisHead) {
                return false;
            }
            const type = note.type.toLowerCase();
            return this.model.types.has(type) && type !== root;
        });
    }

    // ─── Links, chains and iterators ───────────────────────────────────────

    /** The scope a head of `scope_heads` names (any letter case); undefined for no head. */
    private headScope(name: string, frame: ScopeFrame, current: Scope): Scope | undefined {
        const head = name.toLowerCase();
        if (!this.tables.scopeHeads.has(head)) {
            return undefined;
        }
        if (head === this.model.rootHead) {
            return frame.root;
        }
        if (head === this.model.thisHead) {
            return current;
        }
        return unknown('previous-scope');
    }

    /** The frame of the block of a link written as a key. */
    private switchTo(pair: Pair, name: string, frame: ScopeFrame, kind: BlockKind): ScopeFrame {
        const head = this.headScope(name, frame, frame.this);
        if (head !== undefined) {
            return { this: head, root: frame.root };
        }
        const out = this.step(
            {
                scalar: pair.key,
                position: 'key',
                pair,
                block: kind,
                segment: pair.key.text,
                index: 0,
            },
            name,
            false,
            frame.this,
        );
        return { this: out, root: frame.root };
    }

    /** The element scope of an iterator's list. */
    private element(base: string): Scope {
        const list = this.vocabulary.scopeValidity('lists', base);
        const type = list === undefined ? null : single(list.supported_targets, this.model.types);
        return type === null ? unknown('list-element', base) : { type };
    }

    /** The link forms of a name (any letter case) that take data, or that do not. */
    private forms(link: string, withData: boolean): LinkForm[] {
        const forms = this.vocabulary.linkForms(link);
        const all = forms.length > 0 ? forms : this.vocabulary.linkForms(link.toLowerCase());
        return all.filter((f) => f.requires_data === withData);
    }

    /** Apply one link to a scope: its output, the step recorded with what it may start from. */
    private step(
        where: Omit<LinkStep, 'link' | 'input' | 'expected'>,
        link: string,
        withData: boolean,
        input: Scope,
    ): Scope {
        const forms = this.forms(link, withData);
        if (forms.length === 0) {
            return unknown('chain', where.segment);
        }
        const scoped = forms.filter((f) => !f.global_link && f.supported_scopes.length > 0);
        const expected =
            scoped.length === forms.length
                ? [...new Set(scoped.flatMap((f) => f.supported_scopes))]
                : null;
        this.links.push({ ...where, link, input, expected });
        if (expected !== null && input.type !== null && !expected.includes(input.type)) {
            return unknown('after-wrong-link', link);
        }
        const type = single(
            forms.flatMap((f) => f.supported_targets),
            this.model.types,
        );
        return type === null ? unknown('link-output', link) : { type };
    }

    /** Follow a scope chain from a frame, recording every link it applies. */
    private chain(
        scalar: Scalar,
        position: 'key' | 'value',
        pair: Pair,
        frame: ScopeFrame,
        block: BlockKind,
    ): Scope {
        const segments = scalar.segments ?? [scalar.text];
        if (segments.some((s) => s.includes('$'))) {
            return unknown('chain', scalar.text);
        }
        let current: Scope = frame.this;
        for (let index = 0; index < segments.length; index++) {
            const segment = segments[index] ?? '';
            const at = segment.indexOf(':');
            const head = at < 0 ? this.headScope(segment, frame, current) : undefined;
            if (head !== undefined) {
                current = head;
                continue;
            }
            const link = at > 0 ? segment.slice(0, at) : segment;
            if (this.forms(link, at > 0).length === 0) {
                // A value ends the chain (`scope:x.gold`), or the segment is no link at all.
                return unknown('chain', segment);
            }
            current = this.step(
                { scalar, position, pair, block, segment, index },
                link,
                at > 0,
                current,
            );
        }
        return current;
    }

    /** A chain written as a value in a trigger or effect block, where the reader walked it. */
    private valueChain(pair: Pair, frame: ScopeFrame, kind: BlockKind): void {
        const value = pair.value;
        if (value?.kind !== 'scalar' || value.type !== 'chain') {
            return;
        }
        const verdict = this.chains.get(value)?.verdict.kind;
        if (verdict === 'links' || verdict === 'value') {
            this.chain(value, 'value', pair, frame, kind);
        }
    }
}

/** How the scope runs through a file the context reader has read. */
export function readScopes(input: ReadInput, reading: FileReading): ScopeReading {
    const walker = new Walker(modelOf(input.spec), input, reading);
    walker.run();
    return { frames: walker.frames, pairs: walker.pairs, links: walker.links };
}

// ─── Keyword uses ──────────────────────────────────────────────────────────

/** Why a keyword use is not judged. */
export type UnjudgedWhy =
    | UnknownWhy
    /** The game's documentation gives no scope data for the keyword. */
    | 'no-scope-data'
    /** Its scope data declares no requirement (`none`). */
    | 'no-requirement'
    /** A keyword that is also a link, written as a block key: judged as a link. */
    | 'scope-switch'
    /** An iterator whose prefix part D8 gives no confirmed kind. */
    | 'iterator-kind'
    /** A key in a block the scope walk did not reach. */
    | 'not-reached';

/** A trigger, effect or iterator in a trigger or effect block, and its scope verdict. */
export interface KeywordUse {
    readonly key: JudgedKey;
    /** Whose scope data it is judged by: the block's context, or an iterator prefix's kind (D8). */
    readonly kind: Context;
    /** The name it is read as. */
    readonly name: string;
    readonly verdict:
        | {
              readonly judged: true;
              readonly current: string;
              readonly expected: readonly string[];
              readonly fits: boolean;
          }
        | { readonly judged: false; readonly why: UnjudgedWhy; readonly detail?: string };
}

/** Every trigger, effect and iterator use of a file, with its scope verdict. */
export function keywordUses(spec: Spec, reading: FileReading, scopes: ScopeReading): KeywordUse[] {
    const model = modelOf(spec);
    const out: KeywordUse[] = [];
    for (const key of reading.keys) {
        const read = key.reading;
        if (read.kind !== 'keyword' && read.kind !== 'iterator') {
            continue;
        }
        const name = key.folded ?? key.pair.key.text;
        const kind = read.kind === 'iterator' ? model.prefixKinds.get(read.prefix) : key.context;
        const unjudged = (why: UnjudgedWhy, detail?: string): void => {
            out.push({
                key,
                kind: kind ?? key.context,
                name,
                verdict:
                    detail === undefined ? { judged: false, why } : { judged: false, why, detail },
            });
        };
        if (kind === undefined) {
            unjudged('iterator-kind');
            continue;
        }
        if (
            read.kind === 'keyword' &&
            key.pair.value?.kind === 'block' &&
            model.vocabulary.has('links', name) &&
            !model.tables.containers.has(name)
        ) {
            unjudged('scope-switch');
            continue;
        }
        const frame = scopes.pairs.get(key.pair);
        if (frame === undefined) {
            unjudged('not-reached');
            continue;
        }
        if (frame.this.type === null) {
            unjudged(frame.this.why, frame.this.detail);
            continue;
        }
        const group = kind === 'trigger' ? 'triggers' : 'effects';
        const data =
            model.vocabulary.scopeValidity(group, name) ??
            model.vocabulary.scopeValidity(group, name.toLowerCase());
        if (data === undefined) {
            unjudged('no-scope-data');
            continue;
        }
        const expected = data.supported_scopes;
        if (expected.length === 0 || expected.includes(NO_REQUIREMENT)) {
            unjudged('no-requirement');
            continue;
        }
        out.push({
            key,
            kind,
            name,
            verdict: {
                judged: true,
                current: frame.this.type,
                expected,
                fits: expected.includes(frame.this.type),
            },
        });
    }
    return out;
}
