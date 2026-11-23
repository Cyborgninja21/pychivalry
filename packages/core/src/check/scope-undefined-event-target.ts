/**
 * `scope/undefined-event-target` (docs/checks.md, item 4.6): `scope:name` with no effect saving
 * `name` in the file, the mod or the base game. Evidence: the catalogue's
 * `undefined_event_target_X` ("Undefined event target '%s'"). Information, by the MVP's
 * decision: names the engine itself provides (`scope:duel_value`) are saved by no script.
 *
 * Where a scope is saved and where one is read, both from the spec package, both recorded by
 * the index for every file it reads, so one look-up per name answers for the file, the mod, the
 * files an event chain reaches and the whole base game alike, and no call chain is followed:
 *
 * - A save is a pair whose key is an entry of the hand-kept table `save_keys` (part C4), with a
 *   plain name as its value (`WorkspaceIndex.savedScopes`).
 * - A read is the head of a chain written with the link that reads a saved scope, which the
 *   package names in its evidence for the save keys (`FolderTable.scopeLinks`;
 *   `WorkspaceIndex.scopeReads`).
 *
 * The table leaves out the effects that save a value under a name `scope:name` reads (its own
 * note: they "save a value, not a scope"), and a scripted effect saves the name its caller
 * passes in a parameter. So a name is reported only when no file writes it at all except as
 * `scope:name` (`WorkspaceNames.isScopeSaved`): then no script can save it. A name holding a
 * `$PARAM$` stands for many and is not judged. Without the base game in the index the check is
 * silent: the names the base game saves are not known.
 */

import type { FolderTable } from '../index/folders.js';
import type { FileNode, Item, Scalar, Value } from '../syntax/tree.js';
import type { CheckFinding } from './finding.js';
import { withBaseGame, type WorkspaceNames } from './names.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'scope/undefined-event-target';

/** Every scalar of a file, keys and values, in the order written. */
function scalarsOf(file: FileNode): Scalar[] {
    const out: Scalar[] = [];
    const stack: (Item | Value)[] = [...file.items].reverse();
    for (;;) {
        const node = stack.pop();
        if (node === undefined) {
            return out;
        }
        if (node.kind === 'scalar') {
            out.push(node);
        } else if (node.kind === 'pair') {
            if (node.value !== null) {
                stack.push(node.value);
            }
            stack.push(node.key);
        } else if (node.kind === 'block') {
            for (let i = node.items.length - 1; i >= 0; i--) {
                const item = node.items[i];
                if (item !== undefined) {
                    stack.push(item);
                }
            }
        } else if (node.kind === 'tagged') {
            stack.push(node.body);
        }
    }
}

/** The head of a chain that reads a saved scope (`scope:name`), with its name; or undefined. */
export function savedScopeRead(
    scalar: Scalar,
    links: ReadonlySet<string>,
): { readonly head: string; readonly name: string } | undefined {
    if (scalar.type !== 'chain') {
        return undefined;
    }
    const head = scalar.segments?.[0] ?? '';
    const colon = head.indexOf(':');
    const name = head.slice(colon + 1);
    if (colon <= 0 || name === '' || /[$|]/.test(name)) {
        return undefined;
    }
    return links.has(head.slice(0, colon).toLowerCase()) ? { head, name } : undefined;
}

export function undefinedEventTargets(
    folders: FolderTable,
    tree: FileNode,
    names: Partial<WorkspaceNames>,
    context: CheckContext,
): CheckFinding[] {
    const lookups = withBaseGame(names);
    if (lookups === undefined || folders.scopeLinks.size === 0) {
        return [];
    }
    const out: CheckFinding[] = [];
    const saved = new Map<string, boolean>();
    for (const scalar of scalarsOf(tree)) {
        const read = savedScopeRead(scalar, folders.scopeLinks);
        if (read === undefined) {
            continue;
        }
        let known = saved.get(read.name);
        if (known === undefined) {
            known = lookups.isScopeSaved(read.name);
            saved.set(read.name, known);
        }
        if (!known) {
            out.push(
                finding(
                    CODE,
                    { start: scalar.start, end: scalar.start + read.head.length },
                    [read.head],
                    { name: read.name },
                    context,
                ),
            );
        }
    }
    return out;
}
