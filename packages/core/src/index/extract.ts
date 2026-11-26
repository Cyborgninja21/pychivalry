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
 *
 * Saves, beside the uses: a pair anywhere in a script file whose key is one the spec package
 * says saves a scope or a value under a name (`FolderTable.saveRules`, the table `save_keys`)
 * records a save of the name where the key's rule says it is written (format 9, `name_in`):
 * the key's own value (`save_scope_as = name`), or the parameter of its block that holds it
 * (`save_scope_value_as = { name = x value = 5 }`); the name must be a plain name. The head of a
 * chain written with the link that reads a saved scope (`scope:name`; `FolderTable.scopeLinks`)
 * records a read of it (docs/checks.md, `scope/undefined-event-target`). The name is a use as
 * well in both, as every word is.
 */

import type { SaveRule } from '../spec/tables.js';
import { chainSegments, classifyWord } from '../syntax/lexer.js';
import type { Block, FileNode, Item, Pair, Scalar, Value } from '../syntax/tree.js';
import {
    keyMatcher,
    type NestedRule,
    type SpecFolder,
    type TextScopeForms,
    type VariableRule,
} from './folders.js';
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
    /**
     * Format 9: how two keys of the store compare (`key_identity.compare`): `integer`, a key is
     * the decimal number its text gives (`007` and `7` are one key); otherwise as written.
     */
    readonly compare?: string;
}

/** The key identity a store's `compare` gives (format 9): `integer`, the number its text gives. */
const INTEGER_KEYS = 'integer';

/**
 * A statement's key as its store compares it (format 9, `key_identity.compare`): for `integer`,
 * the decimal number its text gives, written without leading zeros (`007` is `7`, `-0` is `0`),
 * when the text is an optional `-` and digits, as the reader parses it; otherwise as written.
 */
export function storeKey(text: string, compare: string | undefined): string {
    if (compare !== INTEGER_KEYS || !/^-?[0-9]+$/.test(text)) {
        return text;
    }
    const negative = text.startsWith('-');
    const digits = (negative ? text.slice(1) : text).replace(/^0+(?=[0-9])/, '');
    return negative && digits !== '0' ? `-${digits}` : digits;
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
    /**
     * The keys that save a scope or a value under a name, in lower case, each with its rule
     * (`FolderTable.saveRules`): a pair with one of them, anywhere in the file, records a save of
     * the name its rule's `name_in` says where to find.
     */
    readonly saveRules?: ReadonlyMap<string, SaveRule>;
    /**
     * The links that read a saved scope (`scope`), in lower case (`FolderTable.scopeLinks`): the
     * head of a chain written with one of them, anywhere in the file, records a read of its name.
     */
    readonly scopeLinks?: ReadonlySet<string>;
    /**
     * Format 9, the table `variables`: per keyword (lower case), the variable it names
     * (`FolderTable.variables`): a pair with one of them, anywhere in the file, records the name
     * its rule's `name_in` says where to find, and a chain segment written with one of its links
     * (`var:x`) a statement of `x`.
     */
    readonly variables?: ReadonlyMap<string, VariableRule>;
    /** Format 8: per container key, what its children are (a containers row's `entries`). */
    readonly entries?: ReadonlyMap<string, ContainerReading> | null;
    /** Format 8: the stores of a folder that holds statements (`details.statements`). */
    readonly stores?: readonly StatementStore[] | null;
}

/** What one file defines and uses, packed. */
export interface Extracted {
    readonly defs: number[];
    readonly uses: number[];
    /** The names it saves a scope as, each with where the name starts (`USE_STRIDE`). */
    readonly saves?: number[];
    /** The names it reads as a saved scope (`scope:name`), each with where the name starts. */
    readonly reads?: number[];
    /**
     * The words it writes with a `$PARAM$` beside literal text (`been_to_$SCENE$`), each with
     * where it starts: each stands for every name it can become, a saved scope's among them.
     */
    readonly templates?: number[];
    /**
     * Format 9: the variables it sets (a keyword of the table `variables` that gives a variable
     * its name), each as `<namespace>\u0001<holds>\u0001<name>` (`variableKey`), with where the
     * name starts; a name holding a `$PARAM$` stands for every name it can become.
     */
    readonly varSets?: number[];
    /**
     * Format 9: the plain name of every variable statement it writes, set or read (a keyword of
     * the table `variables`, or a link of it in a chain: `var:x`), each with where it starts.
     */
    readonly varNames?: number[];
    /**
     * Format 9, a localization file: the names its entries' text reads as a saved scope or value
     * (part D9's forms, `FolderTable.textScopeForms`), each with where it starts in the file.
     */
    readonly textReads?: number[];
}

/** The key a variable set is recorded under: its namespace, its kind and its name. */
export function variableKey(namespace: string, holds: string, name: string): string {
    return `${namespace}\u0001${holds}\u0001${name}`;
}

/** A variable key's three parts (`variableKey`), or undefined for another string. */
export function variableKeyParts(
    key: string,
): { readonly namespace: string; readonly holds: string; readonly name: string } | undefined {
    const [namespace, holds, name, more] = key.split('\u0001');
    return namespace === undefined ||
        holds === undefined ||
        name === undefined ||
        more !== undefined
        ? undefined
        : { namespace, holds, name };
}

/** A variable statement a pair writes: its rule, and the scalar that names the variable. */
export interface VariableStatement {
    readonly key: string;
    readonly rule: VariableRule;
    readonly name: Scalar;
}

/**
 * The variables a pair names (format 9, the table `variables`): when its key is one of the
 * table's keywords, in any letter case, the names written where the rule's `name_in` says: the
 * pair's own value (`value`), or a parameter of its block (`name`, `variable`; `has_variable = {
 * name = a name = b }` names both). A link's forms (`link_data`, `link_argument`) are read from
 * chains (`variableLinkReads`). A name is a word: a plain name, or one holding a `$PARAM$`.
 */
export function variableStatementsOf(
    pair: Pair,
    variables: ReadonlyMap<string, VariableRule>,
): VariableStatement[] {
    const rule = variables.get(pair.key.text.toLowerCase());
    if (rule === undefined || rule.kind === VARIABLE_LINK) {
        return [];
    }
    const out: VariableStatement[] = [];
    const word = (value: Value | null | undefined): Scalar | undefined =>
        value?.kind === 'scalar' && (value.type === 'name' || value.type === 'parameter')
            ? value
            : undefined;
    for (const form of rule.nameIn) {
        if (form === NAME_IN_VALUE) {
            const name = word(pair.value);
            if (name !== undefined) {
                out.push({ key: pair.key.text, rule, name });
            }
            continue;
        }
        if (pair.value?.kind !== 'block') {
            continue;
        }
        const wanted = form.toLowerCase();
        for (const item of pair.value.items) {
            if (item.kind === 'pair' && item.key.text.toLowerCase() === wanted) {
                const name = word(item.value);
                if (name !== undefined) {
                    out.push({ key: pair.key.text, rule, name });
                }
            }
        }
    }
    return out;
}

/** A read of a variable by a link in a chain (`var:x`, `variable_map(x|k)`). */
export interface VariableLinkRead {
    readonly link: string;
    readonly rule: VariableRule;
    readonly name: string;
    /** Where the name starts in the file. */
    readonly start: number;
}

/**
 * The variables a scalar's chain reads by a link of the table `variables` (format 9): a segment
 * `<link>:<name>` (`name_in` `link_data`) or `<link>(<name>|<key>)` (`link_argument`), the link
 * in any letter case. A name holding a `$PARAM$` is no one name and is not read.
 */
export function variableLinkReads(
    scalar: Scalar,
    variables: ReadonlyMap<string, VariableRule>,
): VariableLinkRead[] {
    if (scalar.type !== 'chain' || variables.size === 0) {
        return [];
    }
    const out: VariableLinkRead[] = [];
    let at = scalar.start;
    for (const segment of scalar.segments ?? chainSegments(scalar.text) ?? []) {
        const data = /^([A-Za-z_][A-Za-z0-9_]*):([^$:|]+)$/.exec(segment);
        const argument = /^([A-Za-z_][A-Za-z0-9_]*)\(([^$|()]+)[|)]/.exec(segment);
        for (const [match, form] of [
            [data, NAME_IN_LINK_DATA],
            [argument, NAME_IN_LINK_ARGUMENT],
        ] as const) {
            const link = match?.[1];
            const name = match?.[2];
            const rule = link === undefined ? undefined : variables.get(link.toLowerCase());
            if (
                link !== undefined &&
                name !== undefined &&
                rule?.kind === VARIABLE_LINK &&
                rule.nameIn.includes(form)
            ) {
                out.push({ link, rule, name, start: at + link.length + 1 });
            }
        }
        at += segment.length + 1;
    }
    return out;
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

/**
 * Every use in a value, a block or a list of items, without recursion; each pair to `onPair`,
 * each scalar to `onScalar`.
 */
function collectUses(
    roots: readonly (Item | Value)[],
    push: (word: string, start: number) => void,
    onPair?: (pair: Pair) => void,
    onScalar?: (scalar: Scalar) => void,
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
                onScalar?.(node);
                break;
            case 'pair':
                onPair?.(node);
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
): StatementStore | null {
    if (stores === null || stores === undefined) {
        return null;
    }
    const named = stores.find((s) => s.form === form && s.keys?.has(key) === true);
    return named ?? stores.find((s) => s.form === form && s.keys === null) ?? null;
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

const PARAMETER_IN_WORD = /\$[^$\s]+\$/g;

/** Whether a word holds a `$PARAM$` and literal text beside it: `been_to_$SCENE$`. */
export function isNameTemplate(word: string): boolean {
    return word.includes('$') && word.replace(PARAMETER_IN_WORD, '') !== '';
}

/** The names a template word can become, as a pattern: each `$PARAM$` stands for any text. */
export function nameTemplatePattern(word: string): RegExp {
    const parts = word.split(PARAMETER_IN_WORD).map((p) => p.replace(/[.*+?^()|[\]\\{}]/g, '\\$&'));
    return new RegExp(`^${parts.join('.+')}$`);
}

/** The `name_in` form of a save rule for the key's own value (`key = name`), format 9. */
const NAME_IN_VALUE = 'value';

/** The table `variables`' forms of a link's name (`name_in`) and its word for a link (`kind`). */
const NAME_IN_LINK_DATA = 'link_data';
const NAME_IN_LINK_ARGUMENT = 'link_argument';
const VARIABLE_LINK = 'link';

/** A scalar that is one plain name: no chain, no `$PARAM$`. */
function plainName(value: Value | null | undefined): Scalar | undefined {
    return value?.kind === 'scalar' && value.type === 'name' && !value.text.includes('$')
        ? value
        : undefined;
}

/**
 * The name a pair saves a scope or a value under, with the rule of its key: when the pair's key
 * is one of the keys that save (`FolderTable.saveRules`, lower case), the name where the rule's
 * `name_in` says it is written (format 9): `value`, the pair's own value (`save_scope_as =
 * name`); another word, the parameter of that key in the pair's block (`save_scope_value_as = {
 * name = x value = 5 }`: `name_in` is `name`), in any letter case, as the key itself is read. The
 * first form the pair has wins. Only a plain name is a save: a name holding a `$PARAM$` stands
 * for many and saves none of them.
 */
export function savedNameOf(
    pair: Pair,
    saveRules: ReadonlyMap<string, SaveRule>,
): { readonly name: Scalar; readonly rule: SaveRule } | undefined {
    const rule = saveRules.get(pair.key.text.toLowerCase());
    if (rule === undefined) {
        return undefined;
    }
    for (const form of rule.nameIn) {
        if (form === NAME_IN_VALUE) {
            const name = plainName(pair.value);
            if (name !== undefined) {
                return { name, rule };
            }
            continue;
        }
        if (pair.value?.kind !== 'block') {
            continue;
        }
        const wanted = form.toLowerCase();
        for (const item of pair.value.items) {
            if (item.kind === 'pair' && item.key.text.toLowerCase() === wanted) {
                const name = plainName(item.value);
                if (name !== undefined) {
                    return { name, rule };
                }
            }
        }
    }
    return undefined;
}

/** The name a pair saves under (`savedNameOf`), without its rule. */
export function scopeSaveOf(
    pair: Pair,
    saveRules: ReadonlyMap<string, SaveRule>,
): Scalar | undefined {
    return savedNameOf(pair, saveRules)?.name;
}

/**
 * The saved scope a chain reads at its head (`scope:name`, alone or before more links): the
 * head, the name, and where the name starts in the chain's text; or undefined. The link is one
 * of those that read a saved scope (`FolderTable.scopeLinks`, lower case). A name holding a
 * `$PARAM$` or a `|` is no one name and is not read.
 */
export function scopeReadOf(
    scalar: Scalar,
    scopeLinks: ReadonlySet<string>,
): { readonly head: string; readonly name: string; readonly offset: number } | undefined {
    if (scalar.type !== 'chain') {
        return undefined;
    }
    const head = scalar.segments?.[0] ?? '';
    const colon = head.indexOf(':');
    const name = head.slice(colon + 1);
    if (colon <= 0 || name === '' || /[$|]/.test(name)) {
        return undefined;
    }
    return scopeLinks.has(head.slice(0, colon).toLowerCase())
        ? { head, name, offset: colon + 1 }
        : undefined;
}

/** What a script file defines and uses. */
export function extractScript(file: FileNode, context: ScriptContext): Extracted {
    const { strings } = context;
    const defs: number[] = [];
    const uses: number[] = [];
    const saves: number[] = [];
    const saveRules = context.saveRules;
    const variables = context.variables;
    const varSets: number[] = [];
    const varNames: number[] = [];
    // `save_scope_as = name`, `save_scope_value_as = { name = x }`: a save of the name. A name
    // holding a `$PARAM$` stands for many. `set_variable = { name = x }`: a variable set, and
    // every statement of the table `variables` a statement of its name.
    const onSave =
        saveRules === undefined || saveRules.size === 0
            ? undefined
            : (pair: Pair): void => {
                  const value = scopeSaveOf(pair, saveRules);
                  if (value !== undefined) {
                      saves.push(strings.intern(value.text), value.start);
                  }
              };
    const onVariable =
        variables === undefined || variables.size === 0
            ? undefined
            : (pair: Pair): void => {
                  for (const statement of variableStatementsOf(pair, variables)) {
                      const name = statement.name;
                      if (statement.rule.defines) {
                          varSets.push(
                              strings.intern(
                                  variableKey(
                                      statement.rule.namespace,
                                      statement.rule.holds,
                                      name.text,
                                  ),
                              ),
                              name.start,
                          );
                      }
                      if (!name.text.includes('$')) {
                          varNames.push(strings.intern(name.text), name.start);
                      }
                  }
              };
    const onPair =
        onSave === undefined && onVariable === undefined
            ? undefined
            : (pair: Pair): void => {
                  onSave?.(pair);
                  onVariable?.(pair);
              };
    const reads: number[] = [];
    const templates: number[] = [];
    const scopeLinks = context.scopeLinks;
    // `scope:name`, as a key or a value, alone or at the head of a chain: a read of `name`. A
    // name built with a `$PARAM$` (`save_scope_as = been_to_$SCENE$`): a template. `var:name`
    // anywhere in a chain: a variable statement of `name`.
    const onScalar =
        (scopeLinks === undefined || scopeLinks.size === 0) &&
        (variables === undefined || variables.size === 0)
            ? undefined
            : (scalar: Scalar): void => {
                  if (variables !== undefined) {
                      for (const read of variableLinkReads(scalar, variables)) {
                          varNames.push(strings.intern(read.name), read.start);
                      }
                  }
                  if (scopeLinks === undefined || scopeLinks.size === 0) {
                      return;
                  }
                  if (scalar.type === 'name' && isNameTemplate(scalar.text)) {
                      templates.push(strings.intern(scalar.text), scalar.start);
                      return;
                  }
                  const read = scopeReadOf(scalar, scopeLinks);
                  if (read !== undefined) {
                      reads.push(strings.intern(read.name), scalar.start + read.offset);
                  }
              };
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
        name: string = pair.key.text,
    ): void => {
        defs.push(
            strings.intern(name),
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
        collectUses(file.items, push, onPair, onScalar);
        return { defs, uses, saves, reads, templates, varSets, varNames };
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
                const store = storeOf(context.stores, 'block', item.key.text);
                define(
                    item,
                    database,
                    'record',
                    store?.store ?? null,
                    priority === null ? NONE : priorityOf(value, priority.field, priority.fallback),
                    null,
                    0,
                    storeKey(item.key.text, store?.compare),
                );
                defineNested(item, 0, identityIn(new Map()));
            } else {
                const store = storeOf(context.stores, 'value', item.key.text);
                define(
                    item,
                    database,
                    'value',
                    store?.store ?? null,
                    NONE,
                    value?.kind === 'scalar' && (value.type === 'name' || value.type === 'number')
                        ? value.text
                        : null,
                    0,
                    storeKey(item.key.text, store?.compare),
                );
            }
        }
        if (item.value !== null) {
            rest.push(item.value);
        }
    }
    collectUses(rest, push, onPair, onScalar);
    return { defs, uses, saves, reads, templates, varSets, varNames };
}

/** What a localization file defines and uses; with D9's forms, what its texts read as saved scopes. */
export function extractLocalization(
    file: LocalizationFile,
    strings: StringTable,
    forms?: TextScopeForms,
): Extracted {
    const defs: number[] = [];
    const uses: number[] = [];
    const textReads: number[] = [];
    const reading = forms !== undefined && (forms.heads || forms.functions.size > 0);
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
        if (reading) {
            textScopeReads(file.text.slice(entry.textStart, entry.textEnd), forms, (name, at) =>
                textReads.push(strings.intern(name), entry.textStart + at),
            );
        }
    }
    for (const use of file.uses) {
        uses.push(strings.intern(use.name), use.start);
    }
    return reading ? { defs, uses, textReads } : { defs, uses };
}

/** A part of a bracket expression and where it starts in the text. */
interface Part {
    readonly text: string;
    readonly at: number;
}

const QUOTE = 39; // '
const BACKSLASH = 92;

/**
 * The parts of `text` split at each `separator` outside single quotes and parentheses, each
 * with where it starts (`at` is where `text` starts).
 */
function splitOutside(text: string, at: number, separator: string): Part[] {
    const out: Part[] = [];
    let depth = 0;
    let quoted = false;
    let from = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (quoted) {
            if (code === QUOTE && text.charCodeAt(i - 1) !== BACKSLASH) {
                quoted = false;
            }
            continue;
        }
        const ch = text.charAt(i);
        if (code === QUOTE) {
            quoted = true;
        } else if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth = Math.max(0, depth - 1);
        } else if (ch === separator && depth === 0) {
            out.push({ text: text.slice(from, i), at: at + from });
            from = i + 1;
        }
    }
    out.push({ text: text.slice(from), at: at + from });
    return out;
}

/** The data-binding statements of a text, `[...]`, each without its brackets. */
function statementsOf(text: string): Part[] {
    const out: Part[] = [];
    let open = -1;
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (open < 0) {
            if (text.charAt(i) === '[') {
                open = i;
            }
            continue;
        }
        if (quoted) {
            if (code === QUOTE && text.charCodeAt(i - 1) !== BACKSLASH) {
                quoted = false;
            }
        } else if (code === QUOTE) {
            quoted = true;
        } else if (text.charAt(i) === '[') {
            // An extra `[`: what the game reads from here is not known.
            return out;
        } else if (text.charAt(i) === ']') {
            out.push({ text: text.slice(open + 1, i), at: open + 1 });
            open = -1;
        }
    }
    return out;
}

const WORD = /^[A-Za-z_][A-Za-z0-9_]*$/;

const CALL = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
const QUOTED_WORD = /^'([A-Za-z_][A-Za-z0-9_]*)'$/;

/**
 * The names a localization text reads as a saved scope or value, by part D9's forms (its
 * `consumer` text): each `[...]` split at its last `|` outside quotes and parentheses (the
 * formatting suffix), then at `.` outside them. The first word of the chain is a saved name
 * (`heads`, the form `saved_scope_head`), unless the whole expression is one word with a game
 * concept's suffix (`conceptSuffix`, `E`; part D9's `game_concept`); a function of `functions` anywhere in
 * the chain reads the name its argument at that position holds, when it is one quoted word
 * (`TopScope.sC('name')`). Which first words are globals of the data types, not names, is the
 * reader's to know (part C3).
 */
export function textScopeReads(
    text: string,
    forms: TextScopeForms,
    push: (name: string, at: number) => void,
): void {
    for (const statement of statementsOf(text)) {
        const bars = splitOutside(statement.text, statement.at, '|');
        const suffix = bars.length > 1 ? (bars[bars.length - 1]?.text ?? '') : null;
        const bodyEnd = bars.length > 1 ? (bars[bars.length - 1]?.at ?? 0) - 1 : null;
        const body =
            bodyEnd === null
                ? statement
                : {
                      text: statement.text.slice(0, bodyEnd - statement.at),
                      at: statement.at,
                  };
        const chain = splitOutside(body.text, body.at, '.');
        const head = chain[0];
        if (forms.heads && head !== undefined) {
            const word = head.text.trim();
            const concept =
                chain.length === 1 &&
                suffix !== null &&
                forms.conceptSuffix !== null &&
                suffix.includes(forms.conceptSuffix);
            if (WORD.test(word) && !concept) {
                push(word, head.at + head.text.indexOf(word));
            }
        }
        for (const segment of chain) {
            const trimmed = segment.text.trimStart();
            const call = CALL.exec(trimmed);
            const position = call?.[1] === undefined ? undefined : forms.functions.get(call[1]);
            if (call === null || position === undefined) {
                continue;
            }
            const open = segment.at + (segment.text.length - trimmed.length) + call[0].length;
            const close = trimmed.lastIndexOf(')');
            if (close < call[0].length) {
                continue;
            }
            const inner = trimmed.slice(call[0].length, close);
            const arg = splitOutside(inner, open, ',')[position];
            const quoted = arg === undefined ? null : QUOTED_WORD.exec(arg.text.trim());
            if (arg !== undefined && quoted?.[1] !== undefined) {
                push(quoted[1], arg.at + arg.text.indexOf(quoted[1]));
            }
        }
    }
}
