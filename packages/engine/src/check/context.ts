/**
 * The context tracker for editor features: what kind of block a position is in, judged
 * exactly as the registry check judges it (schema fields, trigger/effect blocks,
 * containers, iterators, modifier blocks).
 */

import { Workspace, pathToUri } from '../index/workspace';
import { DirectoryEntry, SchemaEntry } from '../spec/types';
import { ASTNode, Position } from '../syntax/ast';
import { BlockContext, blockContexts } from './registry';

export type { BlockContext } from './registry';

export interface PositionContext extends BlockContext {
    /** Ancestor blocks from the file root to the innermost block holding the position. */
    path: ASTNode[];
    /** False when the innermost block was not read by the registry (an unknown keyword's
     * body); the context is then the nearest read ancestor's. */
    exact: boolean;
    directory?: DirectoryEntry;
    schema?: SchemaEntry;
}

function before(a: Position, b: Position): boolean {
    return a.line < b.line || (a.line === b.line && a.character < b.character);
}

/** Is `pos` inside the body of `node` (after its key, before the end of its range)? */
function inside(node: ASTNode, pos: Position): boolean {
    const start = node.keyRange?.end ?? node.range.start;
    return !before(pos, start) && !before(node.range.end, pos);
}

/** Ancestors (outermost first) whose block body holds `pos`. */
function blocksAt(ast: ASTNode, pos: Position): ASTNode[] {
    const path: ASTNode[] = [ast];
    let current = ast;
    for (;;) {
        const next = (current.children ?? []).find((c) => c.children && inside(c, pos));
        if (!next) {
            return path;
        }
        path.push(next);
        current = next;
    }
}

/**
 * Context of `position` in `file` (an absolute path or a mod-relative path) whose parsed
 * tree is `ast`.
 */
export function contextAt(
    workspace: Workspace,
    file: string,
    ast: ASTNode,
    position: Position
): PositionContext {
    const rel = workspace.relativePath(file);
    const trace = blockContexts({
        spec: workspace.spec,
        workspace,
        file: rel,
        uri: pathToUri(file),
        ast,
    });
    const path = blocksAt(ast, position);
    const directory = workspace.spec.directoryOf(rel);
    const schema = directory ? workspace.spec.schemaOf(directory) : undefined;
    for (let i = path.length - 1; i >= 0; i--) {
        const children = path[i].children;
        const found = children ? trace.get(children) : undefined;
        if (found) {
            return { ...found, path, exact: i === path.length - 1, directory, schema };
        }
    }
    return { kind: 'none', path, exact: false, directory, schema };
}
