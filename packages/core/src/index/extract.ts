/**
 * What a file defines and what it uses (docs/PLAN.md items 3.3, 3.4 and 3.9), from its syntax
 * tree or its localization entries. Nothing here knows a CK3 name: a definition is a top-level
 * key of a file in one of the spec's folders, recorded with how it is written, or a key the
 * spec package's part D3 says is a definition; a use is a word written anywhere else in a
 * script file, or a `$name$` in a localization entry.
 *
 * Definitions, by how they are written (`Form`):
 *
 * - `key = { ... }` is a `record` of the folder's database, `key = value` a `value`;
 * - `word key = { ... }` is `prefixed`, in the database `inline:<word>`;
 * - `@name = value` is a `constant`, in the database `constants`, or `constants:<file>` when
 *   part D2 says a constant holds for its file;
 * - a key that a `containers` row of the rules table names, or a D3 `container-child` row, is
 *   a `container`, and each pair inside it an `entry` of the folder's database, known by the
 *   container and its own key; where the row says what its children are (`entries`, format
 *   8), a child the row lists as a container is a `container` again and its children the
 *   entries (`special_genes`), an entry is known by its key space (`genes`) and the qualifier
 *   lines in force (`portrait_group`), and `parent` says which container it is written in;
 * - a key part D3 says is a nested definition (a landed title inside another, at any depth;
 *   an activity type's option) is a `record` of the database the folder table gives it, known
 *   by its name alone or with its parent, as the row's scope says (`container`: the keys down
 *   to the parent block, an entry among them by its own identity); `parent` is the block it is
 *   written in, and a scope that is not settled is flagged (`FLAG_SCOPE_NOT_SETTLED`);
 * - a statement of a folder whose rows say it holds statements in separate stores (province
 *   terrain) is known by its store (`container`);
 * - a file of a folder part D3 says names its records by their file is one `file` definition,
 *   named by the file's stem;
 * - a localization entry is a `key` of the database `localization:<language>`.
 *
 * A top-level pair is a definition when its key is a name, a number or a constant and its
 * operator is `=` (or missing, after a parse error), and part D2 does not say it declares no
 * name (`namespace = x`, a setting). Every other scalar is read for uses.
 *
 * Uses, from each scalar outside a definition's own key: a name or a constant as written; a
 * whole number; each segment of a scope chain, or the part of a segment after its first `:`
 * (`trait:brave` uses `brave`), and each name between its `|` bars (`define:NGroup|NAME` uses
 * `NGroup` and `NAME`); quoted text that holds one such word, read as that word. A word holding
 * a `$PARAM$` stands for many names and is not a use; nor are dates, decimals, `@[ ... ]`,
 * operators, a tagged value's tag or a prefix word.
 */

import { chainSegments, classifyWord } from '../syntax/lexer.js';
import type { Block, FileNode, Item, Pair, Scalar, Value } from '../syntax/tree.js';
import { keyMatcher, type NestedRule, type SpecFolder } from './folders.js';
import type { LocalizationFile } from './localization.js';
import { FORMS, type Form } from './rules.js';
import type { StringTable } from './strings.js';

/** The integers stored per definition, in this order. */
export const DEF = {
    name: 0,
    database: 1,
    form: 2,
    container: 3,
    prefix: 4,
    keyStart: 5,
    keyEnd: 6,
    end: 7,
    extra: 8,
    detail: 9,
    flags: 10,
} as const;
export const DEF_STRIDE = 11;

/**
 * `detail` is a string, or -1: for an entry of a key space or a nested definition, where it is
 * written (its `parent`); for a top-level `key = value`, the value when it is one word (the
 * target of an alias line).
 */
/** `flags`: the scope of the nested name is not settled (part D3): it decides nothing. */
export const FLAG_SCOPE_NOT_SETTLED = 1;

/** The integers stored per use: the name and where it starts. */
export const USE_STRIDE = 2;

/**
 * `extra` when there is nothing: no priority field, no version number, no container block.
 * For a `record` it is the priority a rule reads, for a `key` its version, for an `entry` the
 * offset its container's block starts at.
 */
export const NONE = -2147483648;

/** The database of `prefixed` definitions: `inline:<word>`. */
export function inlineDatabase(prefix: string): string {
    return `inline:${prefix}`;
}

/** The database of `constant` definitions. */
export const CONSTANTS_DATABASE = 'constants';

/** The database of the constants of one file, when part D2 says a constant holds for its file. */
export function fileConstantsDatabase(path: string): string {
    return `${CONSTANTS_DATABASE}:${path}`;
}

/** The database of a localization key: `localization:<language>`, or `localization`. */
export function localizationDatabase(language: string | null): string {
    return language === null ? 'localization' : `localization:${language}`;
}

export function formCode(form: Form): number {
    return FORMS.indexOf(form);
}

export function formOf(code: number): Form {
    const form = FORMS[code];
    if (form === undefined) {
        throw new RangeError(`no form ${String(code)}`);
    }
    return form;
}

/**
 * What a container key's children are, from a deciding `containers` row with `entries`
 * (format 8) and the folder's key-resolution row: the key space the definitions are known in,
 * the child keys that are no definition, and those among them that set a part of the key.
 */
export interface ContainerReading {
    readonly holds: 'definitions' | 'containers';
    /** For `holds: containers`, the child keys that are containers; each read as this row's are. */
    readonly containers: ReadonlySet<string>;
    readonly keySpace: string | null;
    readonly notEntries: ReadonlySet<string>;
    /** Child lines that set a part of an entry's key for the entries after them (`portrait_group`). */
    readonly qualifiers: ReadonlySet<string>;
    /** How the containers listed in `containers` read their own children. */
    readonly inner: ContainerReading | null;
}

/** A store of a folder that holds statements (province terrain), by the statement's form and key. */
export interface StatementStore {
    readonly store: string;
    /** `value` (`key = value`) or `block` (`key = { }`). */
    readonly form: 'value' | 'block';
    /** The keys it is written with, or null for a placeholder (`<province id>`): any other key. */
    readonly keys: ReadonlySet<string> | null;
}

/** How to read one script file: its folder's database and what the rules say of it. */
export interface ScriptContext {
    readonly strings: StringTable;
    /** The folder's database (its path), or null when no listed folder holds the file. */
    readonly database: string | null;
    /** The container keys of the database: a set, `all` for every top-level key, or none. */
    readonly containers: ReadonlySet<string> | 'all' | null;
    /** The field a priority rule reads from a record, with its default; or null. */
    readonly priority: { readonly field: string; readonly fallback: number } | null;
    /** What parts D2 and D3 say of the folder; absent, nothing beyond its top-level keys. */
    readonly folder?: SpecFolder | null;
    /** The database of the file's `@name` constants: `constants`, or `constants:<file>`. */
    readonly constants?: string;
    /** The file's stem, the name of its record when the folder names records by their file. */
    readonly fileStem?: string | null;
    /** Format 8: per container key, what its children are (a containers row's `entries`). */
    readonly entries?: ReadonlyMap<string, ContainerReading> | null;
    /** Format 8: the stores of a folder that holds statements (`details.statements`). */
    readonly stores?: readonly StatementStore[] | null;
}

/** What one file defines and uses, packed. */
export interface Extracted {
    readonly defs: number[];
    readonly uses: number[];
}

const WHOLE_NUMBER = /^[0-9]+$/;

/** The words a scalar uses, each with where it starts. */
export function scalarWords(scalar: Scalar, push: (word: string, start: number) => void): void {
    switch (scalar.type) {
        case 'name':
        case 'constant':
            if (!scalar.text.includes('$')) {
                push(scalar.text, scalar.start);
            }
            return;
        case 'number':
            if (WHOLE_NUMBER.test(scalar.text)) {
                push(scalar.text, scalar.start);
            }
            return;
        case 'chain':
            chainWords(scalar.segments ?? chainSegments(scalar.text) ?? [], scalar.start, push);
            return;
        case 'string': {
            const inner = scalar.value;
            if (
                !scalar.terminated ||
                inner === '' ||
                /\s/.test(inner) ||
                scalar.text !== `"${inner}"`
            ) {
                return;
            }
            const start = scalar.start + 1;
            const type = classifyWord(inner);
            if (type === 'name' || type === 'constant') {
                if (!inner.includes('$')) {
                    push(inner, start);
                }
            } else if (type === 'number') {
                if (WHOLE_NUMBER.test(inner)) {
                    push(inner, start);
                }
            } else if (type === 'chain') {
                chainWords(chainSegments(inner) ?? [], start, push);
            }
            return;
        }
        default:
            return;
    }
}

function chainWords(
    segments: readonly string[],
    start: number,
    push: (word: string, start: number) => void,
): void {
    let at = start;
    for (const segment of segments) {
        if (!segment.includes('$')) {
            const colon = segment.indexOf(':');
            const rest = colon < 0 ? segment : segment.slice(colon + 1);
            let offset = colon < 0 ? at : at + colon + 1;
            // `define:NGroup|NAME`, `value:name|PARAM|1|`: each part between bars is a word.
            for (const part of rest.split('|')) {
                if (part !== '') {
                    const type = classifyWord(part);
                    if (type === 'name' || type === 'constant' || WHOLE_NUMBER.test(part)) {
                        push(part, offset);
                    }
                }
                offset += part.length + 1;
            }
        }
        at += segment.length + 1;
    }
}

/** Every use in a value, a block or a list of items, without recursion. */
function collectUses(
    roots: readonly (Item | Value)[],
    push: (word: string, start: number) => void,
): void {
    const stack: (Item | Value)[] = [...roots].reverse();
    for (;;) {
        const node = stack.pop();
        if (node === undefined) {
            return;
        }
        switch (node.kind) {
            case 'scalar':
                scalarWords(node, push);
                break;
            case 'pair':
                if (node.value !== null) {
                    stack.push(node.value);
                }
                stack.push(node.key);
                break;
            case 'block':
                for (let i = node.items.length - 1; i >= 0; i--) {
                    const item = node.items[i];
                    if (item !== undefined) {
                        stack.push(item);
                    }
                }
                break;
            case 'tagged':
                stack.push(node.body);
                break;
            default:
                break;
        }
    }
}

function isDefiningPair(pair: Pair): boolean {
    const type = pair.key.type;
    if (type !== 'name' && type !== 'number' && type !== 'constant') {
        return false;
    }
    if (pair.key.text.includes('$')) {
        return false;
    }
    return pair.operator === null || (pair.operator.text === '=' && !pair.operator.parameter);
}

/** Whether part D2 says a top-level pair of the folder declares no name. */
function declaresNoName(pair: Pair, folder: SpecFolder | null | undefined): boolean {
    if (folder === null || folder === undefined || folder.notDefinitions.length === 0) {
        return false;
    }
    const form = pair.value?.kind === 'block' ? 'block' : 'value';
    return folder.notDefinitions.some(
        (row) => row.form === form && keyMatcher(row.key, row.match)(pair.key.text),
    );
}

/** The form a nested pair is written in, as D3 names forms: `block` or `value`. */
function nestedForm(pair: Pair): 'block' | 'value' {
    return pair.value?.kind === 'block' ? 'block' : 'value';
}

/** The pairs of a block that may be definitions: a name or number key, `=`, no prefix. */
function definingChildren(block: Block): Pair[] {
    return block.items.filter(
        (item): item is Pair =>
            item.kind === 'pair' && isDefiningPair(item) && item.prefix === null,
    );
}

/** A block a D3 path reaches, with the keys from the top-level pair down to it. */
interface PathBlock {
    readonly pair: Pair;
    readonly keys: readonly string[];
}

/** The blocks at a D3 path below a top-level pair: the pair itself for a one-segment path. */
function blocksAt(top: Pair, path: readonly RegExp[]): PathBlock[] {
    const first = path[0];
    if (first === undefined || !first.test(top.key.text) || top.value?.kind !== 'block') {
        return [];
    }
    let level: PathBlock[] = [{ pair: top, keys: [top.key.text] }];
    for (const segment of path.slice(1)) {
        const next: PathBlock[] = [];
        for (const { pair, keys } of level) {
            if (pair.value?.kind !== 'block') {
                continue;
            }
            for (const child of definingChildren(pair.value)) {
                if (child.value?.kind === 'block' && segment.test(child.key.text)) {
                    next.push({ pair: child, keys: [...keys, child.key.text] });
                }
            }
        }
        level = next;
    }
    return level;
}

/**
 * A nested definition: its pair, its rule, and the keys from the top-level key down to the
 * block it is written in (for `record-key`, the record's own key).
 */
type Nested = readonly [Pair, NestedRule, readonly string[]];

/**
 * The nested definitions part D3 finds below one top-level pair; a `container-child` rule's
 * entries are left to the container reading. Below a container whose entries sit `entryDepth`
 * keys down, only the rules that find names deeper than the entries apply (a gene's templates):
 * the entries themselves are the container reading's.
 */
function nestedDefinitions(top: Pair, rules: readonly NestedRule[], entryDepth = 0): Nested[] {
    const out: Nested[] = [];
    for (const rule of rules) {
        if (rule.type === 'container-child') {
            continue;
        }
        if (entryDepth > 0) {
            const byPlace = rule.type === 'parent-field' || rule.type === 'any-block-child';
            if (!byPlace || rule.path.length <= entryDepth) {
                continue;
            }
        }
        if (rule.type === 'record-key') {
            for (const { pair, keys } of blocksAt(top, rule.path)) {
                const field = rule.field;
                if (
                    field !== null &&
                    pair.value?.kind === 'block' &&
                    pair.value.items.some((i) => i.kind === 'pair' && i.key.text === field)
                ) {
                    out.push([pair, rule, keys]);
                }
            }
            continue;
        }
        if (rule.type === 'key-pattern') {
            const pattern = rule.pattern;
            if (pattern === null) {
                continue;
            }
            // A block child whose key matches, at any depth below a block whose key matches.
            const stack = blocksAt(top, rule.path).filter((b) => pattern.test(b.pair.key.text));
            for (;;) {
                const at = stack.pop();
                if (at === undefined) {
                    break;
                }
                if (at.pair.value?.kind !== 'block') {
                    continue;
                }
                for (const child of definingChildren(at.pair.value)) {
                    if (pattern.test(child.key.text) && rule.forms.includes(nestedForm(child))) {
                        out.push([child, rule, at.keys]);
                        stack.push({ pair: child, keys: [...at.keys, child.key.text] });
                    }
                }
            }
            continue;
        }
        // `parent-field`, `any-block-child`: the children of the blocks at the path.
        for (const { pair: parent, keys } of blocksAt(top, rule.path)) {
            if (parent.value?.kind !== 'block') {
                continue;
            }
            for (const child of definingChildren(parent.value)) {
                if (!rule.except.has(child.key.text) && rule.forms.includes(nestedForm(child))) {
                    out.push([child, rule, keys]);
                }
            }
        }
    }
    return out;
}

/**
 * Where a nested definition is known (part D3's scope, format 8): `container` the parent that
 * is part of its identity, or null; `parent` the block it is written in; `flags` whether its
 * scope is not settled. `identity` gives the identity of a block that is itself a definition
 * known otherwise than by its keys (an entry of a key space: `genes/<gene>`).
 */
function placeOf(
    rule: NestedRule,
    keys: readonly string[],
    identity: (keys: readonly string[]) => string,
): { container: string | null; parent: string; flags: number } {
    const parent = keys.join('/');
    switch (rule.scope.kind) {
        case 'global':
            return { container: null, parent, flags: 0 };
        case 'parent':
            return { container: identity(keys.slice(0, rule.scope.depth)), parent, flags: 0 };
        case 'not-settled':
            return { container: null, parent, flags: FLAG_SCOPE_NOT_SETTLED };
    }
}

/** The store a statement of a folder that holds statements is written to, or null. */
function storeOf(
    stores: readonly StatementStore[] | null | undefined,
    form: 'value' | 'block',
    key: string,
): string | null {
    if (stores === null || stores === undefined) {
        return null;
    }
    const named = stores.find((s) => s.form === form && s.keys?.has(key) === true);
    return (named ?? stores.find((s) => s.form === form && s.keys === null))?.store ?? null;
}

/** Whether a D3 `container-child` rule makes a top-level key a container. */
function isNestedContainer(pair: Pair, folder: SpecFolder | null | undefined): boolean {
    return (
        folder?.nested.some(
            (rule) =>
                rule.type === 'container-child' &&
                rule.path.length === 1 &&
                rule.database === folder.path &&
                rule.path[0]?.test(pair.key.text) === true,
        ) ?? false
    );
}

function priorityOf(block: Block, field: string, fallback: number): number {
    for (const item of block.items) {
        if (item.kind === 'pair' && item.key.text === field && item.value?.kind === 'scalar') {
            const value = Number(item.value.value);
            if (Number.isFinite(value)) {
                return Math.trunc(value);
            }
        }
    }
    return fallback;
}

/** What a script file defines and uses. */
export function extractScript(file: FileNode, context: ScriptContext): Extracted {
    const { strings } = context;
    const defs: number[] = [];
    const uses: number[] = [];
    /** Where each nested definition's own key starts: not a use. */
    const ownKeys = new Set<number>();
    const folder = context.folder;
    const rest: (Item | Value)[] = [];
    const push = (word: string, start: number): void => {
        if (!ownKeys.has(start)) {
            uses.push(strings.intern(word), start);
        }
    };
    const define = (
        pair: Pair,
        database: string,
        form: Form,
        container: string | null,
        extra: number,
        detail: string | null = null,
        flags = 0,
    ): void => {
        defs.push(
            strings.intern(pair.key.text),
            strings.intern(database),
            formCode(form),
            container === null ? -1 : strings.intern(container),
            pair.prefix === null ? -1 : strings.intern(pair.prefix.text),
            pair.key.start,
            pair.key.end,
            pair.end,
            extra,
            detail === null ? -1 : strings.intern(detail),
            flags,
        );
    };
    const defineNested = (
        top: Pair,
        entryDepth: number,
        identity: (keys: readonly string[]) => string,
    ): void => {
        for (const [pair, rule, keys] of nestedDefinitions(top, folder?.nested ?? [], entryDepth)) {
            const place = placeOf(rule, keys, identity);
            define(pair, rule.database, 'record', place.container, NONE, place.parent, place.flags);
            ownKeys.add(pair.key.start);
        }
    };
    /**
     * The children of a container block: its entries, or (`holds: containers`) the containers
     * it holds and theirs. Returns the identity of each entry by the keys down to it.
     */
    const readContainer = (
        block: Block,
        path: readonly string[],
        reading: ContainerReading | null,
        identities: Map<string, string>,
    ): void => {
        const database = context.database ?? '';
        let qualifier: string | null = null;
        for (const inner of block.items) {
            if (inner.kind !== 'pair' || !isDefiningPair(inner) || inner.prefix !== null) {
                rest.push(inner);
                continue;
            }
            const key = inner.key.text;
            if (reading?.holds === 'containers') {
                if (reading.containers.has(key) && inner.value?.kind === 'block') {
                    define(inner, database, 'container', path.join('/'), NONE);
                    readContainer(inner.value, [...path, key], reading.inner, identities);
                } else if (inner.value !== null) {
                    // The reader accepts no other child: no definition.
                    rest.push(inner.value);
                }
                continue;
            }
            if (reading?.notEntries.has(key) === true) {
                if (reading.qualifiers.has(key) && inner.value?.kind === 'scalar') {
                    qualifier = `${key}=${inner.value.text}`;
                }
                if (inner.value !== null) {
                    rest.push(inner.value);
                }
                continue;
            }
            const keySpace = reading?.keySpace ?? null;
            const container =
                keySpace === null
                    ? path.join('/')
                    : qualifier === null
                      ? keySpace
                      : `${keySpace}|${qualifier}`;
            define(
                inner,
                database,
                'entry',
                container,
                block.start,
                keySpace === null ? null : path.join('/'),
            );
            identities.set([...path, key].join('/'), `${container}/${key}`);
            if (inner.value !== null) {
                rest.push(inner.value);
            }
        }
    };
    if (context.database === null) {
        // No listed folder holds the file: the spec does not say what it defines.
        collectUses(file.items, push);
        return { defs, uses };
    }
    if (folder?.fileNamed === true && context.fileStem !== null && context.fileStem !== undefined) {
        // The file is the record: named by its stem, it spans the whole file.
        defs.push(
            strings.intern(context.fileStem),
            strings.intern(context.database),
            formCode('file'),
            -1,
            -1,
            0,
            0,
            file.end,
            NONE,
            -1,
            0,
        );
    }
    /** The identity of a block by the keys down to it: an entry's own, else its keys. */
    const identityIn =
        (identities: ReadonlyMap<string, string>) =>
        (keys: readonly string[]): string => {
            for (let n = keys.length; n > 0; n--) {
                const known = identities.get(keys.slice(0, n).join('/'));
                if (known !== undefined) {
                    return [known, ...keys.slice(n)].join('/');
                }
            }
            return keys.join('/');
        };
    for (const item of file.items) {
        if (item.kind !== 'pair' || !isDefiningPair(item) || declaresNoName(item, folder)) {
            rest.push(item);
            continue;
        }
        if (item.prefix !== null) {
            define(item, inlineDatabase(item.prefix.text), 'prefixed', null, NONE);
        } else if (item.key.type === 'constant') {
            define(item, context.constants ?? CONSTANTS_DATABASE, 'constant', null, NONE);
        } else {
            const database = context.database;
            const value = item.value;
            const containers = context.containers;
            const isContainer =
                value?.kind === 'block' &&
                ((containers !== null && (containers === 'all' || containers.has(item.key.text))) ||
                    isNestedContainer(item, folder));
            if (isContainer) {
                define(item, database, 'container', null, NONE);
                const reading = context.entries?.get(item.key.text) ?? null;
                const identities = new Map<string, string>();
                readContainer(value, [item.key.text], reading, identities);
                if (reading !== null) {
                    defineNested(
                        item,
                        reading.holds === 'containers' ? 2 : 1,
                        identityIn(identities),
                    );
                }
                continue;
            }
            if (value?.kind === 'block') {
                const priority = context.priority;
                define(
                    item,
                    database,
                    'record',
                    storeOf(context.stores, 'block', item.key.text),
                    priority === null ? NONE : priorityOf(value, priority.field, priority.fallback),
                );
                defineNested(item, 0, identityIn(new Map()));
            } else {
                define(
                    item,
                    database,
                    'value',
                    storeOf(context.stores, 'value', item.key.text),
                    NONE,
                    value?.kind === 'scalar' && (value.type === 'name' || value.type === 'number')
                        ? value.text
                        : null,
                );
            }
        }
        if (item.value !== null) {
            rest.push(item.value);
        }
    }
    collectUses(rest, push);
    return { defs, uses };
}

/** What a localization file defines and uses. */
export function extractLocalization(file: LocalizationFile, strings: StringTable): Extracted {
    const defs: number[] = [];
    const uses: number[] = [];
    for (const entry of file.entries) {
        defs.push(
            strings.intern(entry.key),
            strings.intern(localizationDatabase(entry.language)),
            formCode('key'),
            -1,
            -1,
            entry.start,
            entry.end,
            entry.lineEnd,
            entry.version ?? NONE,
            -1,
            0,
        );
    }
    for (const use of file.uses) {
        uses.push(strings.intern(use.name), use.start);
    }
    return { defs, uses };
}
