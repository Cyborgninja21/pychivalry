/**
 * The definitions a check can see, from the workspace index: a name is defined in a directory
 * when the index holds a definition of it there in a file the game reads (or may read; a file
 * whose read status is unknown still defines the name, since nothing says it does not).
 */

import type { WorkspaceIndex } from '../index/workspace.js';
import type { DefinedNames } from './context.js';

/** The index's definitions as the checks ask for them. */
export function definedNamesOf(index: WorkspaceIndex): DefinedNames {
    const known = new Map<string, boolean>();
    return {
        isDefined(name: string, database: string): boolean {
            const key = `${database}\u0000${name}`;
            let answer = known.get(key);
            if (answer === undefined) {
                answer = index.definitions(name, { database }).some((d) => d.read !== 'no');
                known.set(key, answer);
            }
            return answer;
        },
    };
}
