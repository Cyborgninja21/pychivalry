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
 *   container and its own key;
 * - a key part D3 says is a nested definition (a landed title inside another, at any depth;
 *   an activity type's option) is a `record` of the database the folder table gives it; one
 *   found by its place is known by its parent too (`container`: the keys down to it);
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
 * says saves a scope (`save_scope_as = name`; `FolderTable.saveKeys`) and whose value is a
 * plain name records a save of that name; the head of a chain written with the link that reads
 * a saved scope (`scope:name`; `FolderTable.scopeLinks`) records a read of it (docs/checks.md,
 * `scope/undefined-event-target`). The name is a use as well in both, as every word is.
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
} as const;
export const DEF_STRIDE = 9;

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
     * The keys that save a scope (`save_scope_as`), in lower case (`FolderTable.saveKeys`): a
     * pair `key = name` with one of them, anywhere in the file, records a save of `name`.
     */
    readonly saveKeys?: ReadonlySet<string>;
    /**
     * The links that read a saved scope (`scope`), in lower case (`FolderTable.scopeLinks`): the
     * head of a chain written with one of them, anywhere in the file, records a read of its name.
     */
    readonly scopeLinks?: ReadonlySet<string>;
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
 * A nested definition: its pair, its rule, and its parent for a name found by its place
 * (`parent-field`, `any-block-child`): the keys from the top-level key down to the block that
 * holds it, joined by `/`. A name recognised by its key (`key-pattern`, a landed title) or the
 * record's own key (`record-key`) has none: it stands alone.
 */
type Nested = readonly [Pair, NestedRule, string | null];

/**
 * The nested definitions part D3 finds below one top-level pair; a `container-child` rule's
 * entries are left to the container reading. A name found by its place belongs to its parent:
 * D3 measures such names written under several parents, each a separate object.
 */
function nestedDefinitions(top: Pair, rules: readonly NestedRule[]): Nested[] {
    const out: Nested[] = [];
    for (const rule of rules) {
        if (rule.type === 'container-child') {
            continue;
        }
        if (rule.type === 'record-key') {
            for (const { pair } of blocksAt(top, rule.path)) {
                const field = rule.field;
                if (
                    field !== null &&
                    pair.value?.kind === 'block' &&
                    pair.value.items.some((i) => i.kind === 'pair' && i.key.text === field)
                ) {
                    out.push([pair, rule, null]);
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
            const stack = blocksAt(top, rule.path)
                .map((b) => b.pair)
                .filter((p) => pattern.test(p.key.text));
            for (;;) {
                const pair = stack.pop();
                if (pair === undefined) {
                    break;
                }
                if (pair.value?.kind !== 'block') {
                    continue;
                }
                for (const child of definingChildren(pair.value)) {
                    if (pattern.test(child.key.text) && rule.forms.includes(nestedForm(child))) {
                        out.push([child, rule, null]);
                        stack.push(child);
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
                    out.push([child, rule, keys.join('/')]);
                }
            }
        }
    }
    return out;
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

/** What a script file defines and uses. */
export function extractScript(file: FileNode, context: ScriptContext): Extracted {
    const { strings } = context;
    const defs: number[] = [];
    const uses: number[] = [];
    const saves: number[] = [];
    const saveKeys = context.saveKeys;
    // `save_scope_as = name`: a save of `name`. A name holding a `$PARAM$` stands for many.
    const onPair =
        saveKeys === undefined || saveKeys.size === 0
            ? undefined
            : (pair: Pair): void => {
                  const value = pair.value;
                  if (
                      value?.kind === 'scalar' &&
                      value.type === 'name' &&
                      !value.text.includes('$') &&
                      saveKeys.has(pair.key.text.toLowerCase())
                  ) {
                      saves.push(strings.intern(value.text), value.start);
                  }
              };
    const reads: number[] = [];
    const templates: number[] = [];
    const scopeLinks = context.scopeLinks;
    // `scope:name`, as a key or a value, alone or at the head of a chain: a read of `name`. A
    // name built with a `$PARAM$` (`save_scope_as = been_to_$SCENE$`): a template.
    const onScalar =
        scopeLinks === undefined || scopeLinks.size === 0
            ? undefined
            : (scalar: Scalar): void => {
                  if (scalar.type === 'name' && isNameTemplate(scalar.text)) {
                      templates.push(strings.intern(scalar.text), scalar.start);
                      return;
                  }
                  if (scalar.type !== 'chain') {
                      return;
                  }
                  const head = scalar.segments?.[0] ?? '';
                  const colon = head.indexOf(':');
                  const name = head.slice(colon + 1);
                  if (
                      colon > 0 &&
                      name !== '' &&
                      !/[$|]/.test(name) &&
                      scopeLinks.has(head.slice(0, colon).toLowerCase())
                  ) {
                      reads.push(strings.intern(name), scalar.start + colon + 1);
                  }
              };
    /** Where each nested definition's own key starts: not a use. */
    const ownKeys = new Set<number>();
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
        );
    };
    if (context.database === null) {
        // No listed folder holds the file: the spec does not say what it defines.
        collectUses(file.items, push, onPair, onScalar);
        return { defs, uses, saves, reads, templates };
    }
    const folder = context.folder;
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
        );
    }
    const rest: (Item | Value)[] = [];
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
                for (const inner of value.items) {
                    if (inner.kind === 'pair' && isDefiningPair(inner) && inner.prefix === null) {
                        define(inner, database, 'entry', item.key.text, value.start);
                        if (inner.value !== null) {
                            rest.push(inner.value);
                        }
                    } else {
                        rest.push(inner);
                    }
                }
                continue;
            }
            if (value?.kind === 'block') {
                const priority = context.priority;
                define(
                    item,
                    database,
                    'record',
                    null,
                    priority === null ? NONE : priorityOf(value, priority.field, priority.fallback),
                );
                for (const [pair, rule, parent] of nestedDefinitions(item, folder?.nested ?? [])) {
                    define(pair, rule.database, 'record', parent, NONE);
                    ownKeys.add(pair.key.start);
                }
            } else {
                define(item, database, 'value', null, NONE);
            }
        }
        if (item.value !== null) {
            rest.push(item.value);
        }
    }
    collectUses(rest, push, onPair, onScalar);
    return { defs, uses, saves, reads, templates };
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
        );
    }
    for (const use of file.uses) {
        uses.push(strings.intern(use.name), use.start);
    }
    return { defs, uses };
}
