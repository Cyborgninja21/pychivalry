/**
 * The GUI syntax tree (docs/PLAN.md item 10.2; docs/gui-syntax.md). Like the script tree it is
 * syntax only: what was written and where, with no GUI name given a meaning. Every node has
 * `start` and `end` offsets into the parsed text (docs/encoding.md, "Positions"); its scalars,
 * operators and comments are the script tree's own (`syntax/tree.ts`), read by the same lexer.
 *
 * A GUI file and a GUI block hold, in source order:
 *
 * - properties, `key = value` and `key = { ... }` (`GuiProperty`);
 * - named blocks, a keyword of GUI syntax, a name and a block, with no `=` before the block:
 *   `types Name { ... }`, `template Name { ... }`, `local_template Name { ... }`,
 *   `layer name { ... }`, `block "name" { ... }`, `blockoverride "name" { ... }`; the base game
 *   also writes `block = "name" { ... }` and `blockoverride = "name" { ... }` (`GuiNamed`);
 * - type definitions, `type name = base { ... }`, and `local_type name = base { ... }`, which
 *   the install's own tool windows write (`GuiType`);
 * - bare values, the items of a list such as `size = { 480 770 }` (a `Scalar`);
 * - blocks with no key, which no base-game GUI file writes (a `GuiBlock`);
 * - comments.
 *
 * After a parse error a node can lack a part: a property without its `=` or its value, a
 * named block without its name, a type definition without its base or its block.
 */

import type { Comment, Operator, Scalar } from '../syntax/tree.js';

/** `{ ... }`. `start` is the `{`; `end` is past the `}`, or the end of the file if it is open. */
export interface GuiBlock {
    readonly kind: 'gui-block';
    readonly start: number;
    readonly end: number;
    readonly items: readonly GuiItem[];
    /** False when the file ends before the block's `}`. */
    readonly closed: boolean;
}

/**
 * `key = value` or `key = { ... }`. `operator` is null where the `=` is missing
 * (`size { 5 0 }`, `align right|top`); `value` is null where nothing follows the `=`.
 */
export interface GuiProperty {
    readonly kind: 'gui-property';
    readonly start: number;
    readonly end: number;
    readonly key: Scalar;
    readonly operator: Operator | null;
    readonly value: Scalar | GuiBlock | null;
}

/**
 * A keyword of GUI syntax, a name and a block: `types Name { ... }`, `block "name" { ... }`.
 * `operator` is the `=` the base game writes in `blockoverride = "name" { ... }`, or null;
 * `name` is null where the block follows the keyword directly.
 */
export interface GuiNamed {
    readonly kind: 'gui-named';
    readonly start: number;
    readonly end: number;
    /** The keyword as written; `GUI_NAMED_KEYWORDS` lists them, compared in lower case. */
    readonly keyword: Scalar;
    readonly operator: Operator | null;
    readonly name: Scalar | null;
    readonly body: GuiBlock;
}

/**
 * `type name = base { ... }` or `local_type name = base { ... }`: a type definition. `base` is
 * the type it is made from; `body` is null where no block follows the base. A part missing
 * after a parse error is null.
 */
export interface GuiType {
    readonly kind: 'gui-type';
    readonly start: number;
    readonly end: number;
    /** `type` or `local_type`, as written. */
    readonly keyword: Scalar;
    readonly name: Scalar;
    /** The `=` before the base; null where the name is followed by its block directly. */
    readonly operator: Operator | null;
    readonly base: Scalar | null;
    readonly body: GuiBlock | null;
}

/** What a GUI file or block holds. */
export type GuiItem = GuiProperty | GuiNamed | GuiType | Scalar | GuiBlock | Comment;

/** A whole GUI file. */
export interface GuiFile {
    readonly kind: 'gui-file';
    readonly start: number;
    readonly end: number;
    readonly items: readonly GuiItem[];
}

/**
 * The keywords of GUI syntax that open a named block (docs/gui-syntax.md, "Named blocks"),
 * compared without regard to letter case: the base game writes `Types` three times, and the
 * types those blocks define are used by windows the game shows. These are words of the GUI
 * file grammar, not of the GUI vocabulary (docs/MVP.md: checks against a GUI vocabulary come
 * after the MVP), and the owner accepted them as grammar, held here with `GUI_TYPE_KEYWORDS`
 * (docs/decisions.md, decision 191). The spec package is asked to give both lists as data;
 * when it does, the parser reads them from the package instead.
 */
export const GUI_NAMED_KEYWORDS: readonly string[] = [
    'types',
    'template',
    'local_template',
    'layer',
    'block',
    'blockoverride',
];

/**
 * The keywords of a type definition, compared without regard to letter case: `type`, and
 * `local_type`, which the base game's `game/` folder never writes and the install's `jomini/`
 * and `clausewitz/` tool windows write six times (docs/gui-syntax.md).
 */
export const GUI_TYPE_KEYWORDS: readonly string[] = ['type', 'local_type'];

/** True when `word` is a keyword of a type definition (letter case ignored). */
export function isTypeKeyword(word: string): boolean {
    return GUI_TYPE_KEYWORDS.includes(word.toLowerCase());
}

/** True when `word` is a keyword that opens a named block (letter case ignored). */
export function isNamedKeyword(word: string): boolean {
    return GUI_NAMED_KEYWORDS.includes(word.toLowerCase());
}

/** The block of an item, if it holds one: a property's block value, a named block, a type's body. */
export function guiBlockOf(item: GuiItem): GuiBlock | undefined {
    switch (item.kind) {
        case 'gui-block':
            return item;
        case 'gui-property':
            return item.value?.kind === 'gui-block' ? item.value : undefined;
        case 'gui-named':
            return item.body;
        case 'gui-type':
            return item.body ?? undefined;
        default:
            return undefined;
    }
}

/**
 * The text a scalar names: quoted text without its quotes, otherwise the word as written. The
 * base game writes a template's name and a `using` value quoted too (`template "Name"`,
 * `using = "Name"`).
 */
export function guiNameOf(scalar: Scalar): string {
    return scalar.type === 'string' ? scalar.value : scalar.text;
}
