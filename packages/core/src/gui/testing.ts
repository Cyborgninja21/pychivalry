/**
 * Helpers for the GUI parser's tests: a one-line summary of a GUI tree. Used by tests only; not
 * exported by the package.
 */

import type { GuiItem } from './tree.js';

/**
 * A GUI tree on one line, close to how it was written: scalars as written, properties as
 * `key op value`, named blocks as `keyword name { ... }`, type definitions as
 * `type name = base { ... }`, blocks as `{ ... }` (an open block has no `}`), comments in
 * parentheses; a missing part is written `<none>`.
 */
export function guiSummary(items: readonly GuiItem[]): string {
    return items.map(itemSummary).join(' ');
}

function itemSummary(item: GuiItem): string {
    switch (item.kind) {
        case 'scalar':
            return item.text;
        case 'comment':
            return `(${item.text})`;
        case 'gui-block': {
            const inner = guiSummary(item.items);
            const open = inner === '' ? '{' : `{ ${inner}`;
            return item.closed ? `${open} }` : open;
        }
        case 'gui-property':
            return [
                item.key.text,
                item.operator?.text ?? '<none>',
                item.value === null ? '<none>' : itemSummary(item.value),
            ].join(' ');
        case 'gui-named':
            return [
                item.keyword.text,
                ...(item.operator === null ? [] : [item.operator.text]),
                item.name?.text ?? '<none>',
                itemSummary(item.body),
            ].join(' ');
        case 'gui-type':
            return [
                item.keyword.text,
                item.name.text,
                item.operator?.text ?? '<none>',
                item.base?.text ?? '<none>',
                item.body === null ? '<none>' : itemSummary(item.body),
            ].join(' ');
    }
}
