/**
 * The syntax tree (docs/PLAN.md item 2.4). It is syntax only: it records what was written and
 * where, and gives no CK3 name any meaning. Every node has `start` and `end` offsets into the
 * parsed text (docs/encoding.md, "Positions"). Trees are not changed after they are built;
 * an incremental re-parse shares the unchanged nodes of the old tree.
 *
 * A file and a block hold items in source order: pairs (`key = value`), bare values, blocks
 * without a key, and comments. Every comment is an item of the innermost block, or the file,
 * whose braces contain it; one written inside a pair (between its key and its value) follows
 * that pair in the list.
 */

import type { Arithmetic } from './arithmetic.js';
import type { WordType } from './lexer.js';

/** What a scalar was written as: a word classified by its shape, quoted text, or arithmetic. */
export type ScalarType = WordType | 'string' | 'arithmetic';

/** A single value: a word, quoted text or `@[ ... ]`. */
export interface Scalar {
    readonly kind: 'scalar';
    readonly type: ScalarType;
    readonly start: number;
    readonly end: number;
    /** The text as written, quotes and brackets included. */
    readonly text: string;
    /** The value: quoted text without its quotes and escapes; otherwise the text itself. */
    readonly value: string;
    /** False for quoted text without its closing quote, or `@[` without its `]`. */
    readonly terminated: boolean;
    /** A scope chain's segments (`scope:x.liege` is `scope:x`, `liege`); otherwise absent. */
    readonly segments?: readonly string[];
    /** `@[ ... ]` read as arithmetic, when it is well formed; otherwise absent. */
    readonly expression?: Arithmetic;
}

/** `{ ... }`. `start` is the `{`; `end` is past the `}`, or the end of the file if it is open. */
export interface Block {
    readonly kind: 'block';
    readonly start: number;
    readonly end: number;
    readonly items: readonly Item[];
    /** False when the file ends before the block's `}`. */
    readonly closed: boolean;
}

/** An operator, or a `$PARAM$` written where an operator goes (`count $OPERATOR$ 3`). */
export interface Operator {
    readonly kind: 'operator';
    readonly start: number;
    readonly end: number;
    /** One of the eight operators (`OperatorText`), or the `$PARAM$` written in its place. */
    readonly text: string;
    /** True for a `$PARAM$` standing in for an operator. */
    readonly parameter: boolean;
}

/**
 * A name written directly before a block or quoted text, in a value: `rgb { 1 2 3 }`,
 * `hex { 50779b }`, `list "normal_colors"`.
 */
export interface Tagged {
    readonly kind: 'tagged';
    readonly start: number;
    readonly end: number;
    readonly tag: Scalar;
    readonly body: Block | Scalar;
}

/** What a pair's value can be. An operator is a value in `OPERATOR = <=`. */
export type Value = Scalar | Block | Tagged | Operator;

/**
 * `key = value`, with any of the eight operators or a `$PARAM$` in the operator's place.
 * `prefix` is a name written before the key (`scripted_trigger name = { ... }`). After a parse
 * error `operator` or `value` can be missing: `name { ... }` has no operator, `key =` at the
 * end of a block has no value.
 */
export interface Pair {
    readonly kind: 'pair';
    readonly start: number;
    readonly end: number;
    readonly prefix: Scalar | null;
    readonly key: Scalar;
    readonly operator: Operator | null;
    readonly value: Value | null;
}

/** `# ...` to the end of the line; `text` includes the `#`. */
export interface Comment {
    readonly kind: 'comment';
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

/** What a file or a block holds. */
export type Item = Pair | Scalar | Block | Comment;

/** A whole file. */
export interface FileNode {
    readonly kind: 'file';
    readonly start: number;
    readonly end: number;
    readonly items: readonly Item[];
}

export type Node = FileNode | Item | Tagged | Operator;

/** The items of a block or file that are not comments. */
export function significantItems(container: FileNode | Block): Item[] {
    return container.items.filter((item) => item.kind !== 'comment');
}

/**
 * How a block reads: `empty`; a `list` when every item is a bare value (`{ a b c }`,
 * `{ 1 2 3 }`); otherwise `statements` (pairs, blocks, or values mixed with pairs).
 */
export function blockShape(block: Block): 'empty' | 'list' | 'statements' {
    const items = significantItems(block);
    if (items.length === 0) {
        return 'empty';
    }
    return items.every((item) => item.kind === 'scalar') ? 'list' : 'statements';
}

/** The top-level `@name = value` definitions of a file, by name with its `@`. */
export function fileConstants(file: FileNode): Map<string, Pair> {
    const constants = new Map<string, Pair>();
    for (const item of file.items) {
        if (
            item.kind === 'pair' &&
            item.key.type === 'constant' &&
            item.operator?.text === '=' &&
            !item.operator.parameter
        ) {
            constants.set(item.key.text, item);
        }
    }
    return constants;
}

/** The value of a pair as a block, if it is one (directly, or the body of a tagged value). */
export function blockOf(value: Value | null): Block | undefined {
    if (value === null) {
        return undefined;
    }
    if (value.kind === 'block') {
        return value;
    }
    if (value.kind === 'tagged' && value.body.kind === 'block') {
        return value.body;
    }
    return undefined;
}
