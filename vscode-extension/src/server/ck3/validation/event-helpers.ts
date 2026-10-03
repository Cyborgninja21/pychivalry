/**
 * Shared helpers of the event plug-ins (scope-timing, events, paradox-checks): which
 * top-level keys are events, and simple accessors on an event block.
 */

import { ASTNode, NodeType } from 'pychivalry-engine';

/** `namespace.number`: namespaces may hold capitals and digits (`VIETmisc.0169`). */
export const EVENT_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*\.\d+$/;

/** Is the mod-relative path a file of the top-level `events/` directory? */
export function isEventFile(file: string): boolean {
    return /^events\//i.test(file.replace(/\\/g, '/'));
}

/** The event definitions of a file: top-level `namespace.number = { … }` blocks. */
export function eventsOf(ast: ASTNode): ASTNode[] {
    return (ast.children ?? []).filter(
        (c) => c.key !== undefined && EVENT_KEY_RE.test(c.key) && c.type === NodeType.BLOCK
    );
}

/** Direct children of `node` with key `key`. */
export function childrenWithKey(node: ASTNode, key: string): ASTNode[] {
    return (node.children ?? []).filter((c) => c.key === key);
}

/** Is `hidden = yes` set on the event? */
export function isHiddenEvent(event: ASTNode): boolean {
    return (event.children ?? []).some(
        (c) => c.key === 'hidden' && (c.value === 'yes' || c.value === true)
    );
}

/** Depth-first walk (the node itself first). */
export function walk(node: ASTNode, visit: (n: ASTNode) => void): void {
    visit(node);
    for (const child of node.children ?? []) {
        walk(child, visit);
    }
}

/** The numeric value of a node (numbers and numeric strings), else undefined. */
export function numberValue(node: ASTNode | undefined): number | undefined {
    if (!node || node.value === undefined || node.value === null) {
        return undefined;
    }
    if (typeof node.value === 'number') {
        return node.value;
    }
    if (typeof node.value === 'string' && node.value.trim() !== '') {
        const n = Number(node.value);
        return isNaN(n) ? undefined : n;
    }
    return undefined;
}
