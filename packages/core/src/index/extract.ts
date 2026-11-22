/**
 * What a file defines and what it uses (docs/PLAN.md items 3.3, 3.4 and 3.9), from its syntax
 * tree or its localization entries. Nothing here knows a CK3 name: a definition is a top-level
 * key of a file in one of the spec's folders, recorded with how it is written, and a use is a
 * word written anywhere else in a script file, or a `$name$` in a localization entry.
 *
 * Definitions, by how they are written (`Form`):
 *
 * - `key = { ... }` is a `record` of the folder's database, `key = value` a `value`;
 * - `word key = { ... }` is `prefixed`, in the database `inline:<word>`;
 * - `@name = value` is a `constant`, in the database `constants`;
 * - a key that a `containers` row of the rules table names is a `container`, and each pair
 *   inside it an `entry` of the folder's database, known by the container and its own key;
 * - a localization entry is a `key` of the database `localization:<language>`.
 *
 * A top-level pair is a definition when its key is a name, a number or a constant and its
 * operator is `=` (or missing, after a parse error). Every other scalar is read for uses.
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

/** `extra` when there is nothing: no priority field, no version number. */
export const NONE = -2147483648;

/** The database of `prefixed` definitions: `inline:<word>`. */
export function inlineDatabase(prefix: string): string {
    return `inline:${prefix}`;
}

/** The database of `constant` definitions. */
export const CONSTANTS_DATABASE = 'constants';

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
    const push = (word: string, start: number): void => {
        uses.push(strings.intern(word), start);
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
        collectUses(file.items, push);
        return { defs, uses };
    }
    const rest: (Item | Value)[] = [];
    for (const item of file.items) {
        if (item.kind !== 'pair' || !isDefiningPair(item)) {
            rest.push(item);
            continue;
        }
        if (item.prefix !== null) {
            define(item, inlineDatabase(item.prefix.text), 'prefixed', null, NONE);
        } else if (item.key.type === 'constant') {
            define(item, CONSTANTS_DATABASE, 'constant', null, NONE);
        } else {
            const database = context.database;
            const value = item.value;
            const containers = context.containers;
            const isContainer =
                value?.kind === 'block' &&
                containers !== null &&
                (containers === 'all' || containers.has(item.key.text));
            if (isContainer) {
                define(item, database, 'container', null, NONE);
                for (const inner of value.items) {
                    if (inner.kind === 'pair' && isDefiningPair(inner) && inner.prefix === null) {
                        define(inner, database, 'entry', item.key.text, NONE);
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
            } else {
                define(item, database, 'value', null, NONE);
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
        );
    }
    for (const use of file.uses) {
        uses.push(strings.intern(use.name), use.start);
    }
    return { defs, uses };
}
