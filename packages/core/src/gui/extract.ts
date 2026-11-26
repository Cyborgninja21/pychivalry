/**
 * What a GUI file defines and what it uses, for the workspace index (docs/PLAN.md item 10.4;
 * docs/gui-syntax.md, "The index"). Nothing here knows a GUI name: a definition is written by a
 * keyword of GUI syntax, and a use is a word written anywhere else.
 *
 * Definitions, each in a database of its own, since the game keeps types and templates in two
 * registries (`Type '%s' already registered`, `Template '%s' already registered`, part D1):
 *
 * - `type name = base { ... }` in a `types Name { ... }` block at the top level of the file is a
 *   type, in the database `gui`, the database the spec package's rows about GUI type names
 *   name (`key-identity-gui-types`, `msg-gui-type-already-registered`); the `types` block's name
 *   is where it is written (`parent`);
 * - `local_type name = base { ... }` there is a type of the database `gui:local_types`;
 * - `template Name { ... }` at the top level is a template, in the database `gui:templates`;
 *   `local_template Name { ... }` one of `gui:local_templates`.
 *
 * Each is `prefixed`, its keyword the word before its key. A name written in double quotes
 * (`template "Name"`) is the text inside them, and its key is that text's span.
 *
 * Uses, from every scalar outside a definition's own key: each word in it, a run of letters,
 * digits, `_`, `.` and `-` that does not start with `.` or `-` (the words `unreadWords` read in a
 * GUI file before the index read it, so that `localization/unused-key` sees a key a GUI file
 * shows, written as a word, in quoted text or in a data binding: `[Localize('KEY')]`); an
 * `@name` constant as written. A number (`480`, `100%`, `5.5f`) and `@[ ... ]` are no use, nor a
 * named block's keyword. A file in no folder the spec lists is read for its uses only.
 */

import type { Extracted } from '../index/extract.js';
import { formCode, NONE } from '../index/extract.js';
import type { StringTable } from '../index/strings.js';
import type { Scalar } from '../syntax/tree.js';
import type { GuiFile, GuiItem } from './tree.js';

/** The database of GUI types: the one the spec package's rows about GUI type names name. */
export const GUI_TYPES_DATABASE = 'gui';
/** The database of `local_type` definitions. */
export const GUI_LOCAL_TYPES_DATABASE = 'gui:local_types';
/** The database of GUI templates. */
export const GUI_TEMPLATES_DATABASE = 'gui:templates';
/** The database of `local_template` definitions. */
export const GUI_LOCAL_TEMPLATES_DATABASE = 'gui:local_templates';

/** The four databases of GUI definitions. */
export const GUI_DATABASES: readonly string[] = [
    GUI_TYPES_DATABASE,
    GUI_LOCAL_TYPES_DATABASE,
    GUI_TEMPLATES_DATABASE,
    GUI_LOCAL_TEMPLATES_DATABASE,
];

/** The database each definition keyword writes into (lower case). */
const DATABASE_OF: Readonly<Record<string, string>> = {
    type: GUI_TYPES_DATABASE,
    local_type: GUI_LOCAL_TYPES_DATABASE,
    template: GUI_TEMPLATES_DATABASE,
    local_template: GUI_LOCAL_TEMPLATES_DATABASE,
};

/** The named-block keyword whose block holds type definitions (lower case). */
const TYPES_BLOCK = 'types';

export interface GuiExtractContext {
    readonly strings: StringTable;
    /** False for a file in no folder the spec lists: it defines nothing the index knows. */
    readonly defines: boolean;
}

const WORD = /[A-Za-z0-9_][A-Za-z0-9_.-]*/g;
const NUMBER = /^[0-9][0-9.]*f?$/;

/** Push each word of a scalar written in a GUI file, with where it starts. */
export function guiWords(scalar: Scalar, push: (word: string, start: number) => void): void {
    if (scalar.type === 'arithmetic') {
        return;
    }
    if (scalar.type === 'constant') {
        push(scalar.text, scalar.start);
        return;
    }
    const inner = scalar.type === 'string' ? 1 : 0;
    const text =
        scalar.type === 'string'
            ? scalar.text.slice(1, scalar.terminated ? -1 : undefined)
            : scalar.text;
    for (const match of text.matchAll(WORD)) {
        if (!NUMBER.test(match[0])) {
            push(match[0], scalar.start + inner + match.index);
        }
    }
}

/** The name a definition's key writes, and its span: inside the quotes of quoted text. */
function keyOf(scalar: Scalar): { name: string; start: number; end: number } {
    if (scalar.type === 'string') {
        return {
            name: scalar.value,
            start: scalar.start + 1,
            end: scalar.terminated ? scalar.end - 1 : scalar.end,
        };
    }
    return { name: scalar.text, start: scalar.start, end: scalar.end };
}

/** What a GUI file defines and uses (`DEF` and `USE_STRIDE` in index/extract.ts). */
export function extractGui(file: GuiFile, context: GuiExtractContext): Extracted {
    const { strings } = context;
    const defs: number[] = [];
    const uses: number[] = [];
    const push = (word: string, start: number): void => {
        uses.push(strings.intern(word), start);
    };
    const define = (
        key: Scalar,
        keyword: Scalar,
        database: string,
        end: number,
        parent: string | null,
    ): void => {
        const { name, start, end: keyEnd } = keyOf(key);
        // The integers of `DEF`, in its order: no container, no extra, no flags.
        defs.push(
            strings.intern(name),
            strings.intern(database),
            formCode('prefixed'),
            -1,
            strings.intern(keyword.text),
            start,
            keyEnd,
            end,
            NONE,
            parent === null ? -1 : strings.intern(parent),
            0,
        );
    };
    /**
     * Read a list of items for its uses; at the top level (`top`), templates are definitions,
     * and a `types` block's type definitions (`types`: the block's name) are.
     */
    const read = (items: readonly GuiItem[], top: boolean, types: string | null): void => {
        for (const item of items) {
            switch (item.kind) {
                case 'comment':
                    break;
                case 'scalar':
                    guiWords(item, push);
                    break;
                case 'gui-block':
                    read(item.items, false, null);
                    break;
                case 'gui-property':
                    guiWords(item.key, push);
                    if (item.value?.kind === 'scalar') {
                        guiWords(item.value, push);
                    } else if (item.value !== null) {
                        read(item.value.items, false, null);
                    }
                    break;
                case 'gui-named': {
                    const keyword = item.keyword.text.toLowerCase();
                    const database = DATABASE_OF[keyword];
                    if (
                        context.defines &&
                        top &&
                        database !== undefined &&
                        item.name !== null &&
                        item.name.type !== 'arithmetic'
                    ) {
                        define(item.name, item.keyword, database, item.end, null);
                    } else if (item.name !== null) {
                        guiWords(item.name, push);
                    }
                    const holdsTypes = top && keyword === TYPES_BLOCK;
                    read(
                        item.body.items,
                        false,
                        holdsTypes ? (item.name === null ? '' : keyOf(item.name).name) : null,
                    );
                    break;
                }
                case 'gui-type': {
                    const database = DATABASE_OF[item.keyword.text.toLowerCase()];
                    if (context.defines && types !== null && database !== undefined) {
                        define(item.name, item.keyword, database, item.end, types);
                    } else {
                        guiWords(item.name, push);
                    }
                    if (item.base !== null) {
                        guiWords(item.base, push);
                    }
                    if (item.body !== null) {
                        read(item.body.items, false, null);
                    }
                    break;
                }
            }
        }
    };
    read(file.items, true, null);
    return { defs, uses };
}
