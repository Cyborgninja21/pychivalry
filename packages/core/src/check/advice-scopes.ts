/**
 * Saved scopes, as the advice checks read them: which pairs save a scope under a name, and
 * which chains read one back (`scope:name`). Both are the index's own reading, the one
 * `scope/undefined-event-target` (item 4.6) reads through the index (`scopeSaveOf`,
 * `scopeReadOf` in `index/extract.ts`), with the keys and links the folder table takes from the
 * spec package:
 *
 * - the keys that save a scope are the entries of the table `save_keys` (`FolderTable.saveKeys`);
 * - the link that reads one is not a field of the package; it is read from the evidence of that
 *   table: the global link that takes data among the words an `.info` line cited for a save key
 *   names (`save_temporary_scope_as = name # Saves the current scope as scope:name`, words
 *   `save_temporary_scope_as`, `scope`) (`FolderTable.scopeLinks`). When the package gives no
 *   such link, no saved scope is read and the checks that need one judge nothing.
 */

import { scopeReadOf, scopeSaveOf } from '../index/extract.js';
import type { FolderTable } from '../index/folders.js';
import type { Block, Pair, Scalar } from '../syntax/tree.js';
import { walkPairs } from './advice.js';

/** The links that read a saved scope, in lower case; empty when the package gives none. */
export function savedScopeLinks(folders: FolderTable): ReadonlySet<string> {
    return folders.scopeLinks;
}

/** The names saved in the blocks, at any depth. */
export function savedIn(folders: FolderTable, blocks: readonly Block[]): Set<string> {
    const names = new Set<string>();
    for (const block of blocks) {
        walkPairs(block, (pair) => {
            const saved = scopeSaveOf(pair, folders.saveKeys);
            if (saved !== undefined) {
                names.add(saved.text);
            }
        });
    }
    return names;
}

/** A read of a saved scope: the scalar, and the name it reads. */
export interface ScopeRead {
    readonly scalar: Scalar;
    readonly name: string;
}

/** Every read of a saved scope in a pair's key and value, at any depth. */
export function scopeReadsIn(pair: Pair, links: ReadonlySet<string>): ScopeRead[] {
    const out: ScopeRead[] = [];
    const look = (s: Scalar): void => {
        const read = scopeReadOf(s, links);
        if (read !== undefined) {
            out.push({ scalar: s, name: read.name });
        }
    };
    const visit = (p: Pair): void => {
        look(p.key);
        if (p.value?.kind === 'scalar') {
            look(p.value);
        }
    };
    visit(pair);
    const body = pair.value?.kind === 'block' ? pair.value : undefined;
    if (body !== undefined) {
        walkPairs(body, visit);
        for (const item of body.items) {
            if (item.kind === 'scalar') {
                look(item);
            }
        }
    }
    return out;
}
