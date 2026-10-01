/**
 * Ordered-iterator requirement validation (engine plug-in)
 *
 * DIAGNOSTIC CODES:
 *     ITER-003: ordered_* block missing order_by
 *     ITER-004: ordered_* block missing position/max (information)
 *
 * Retired in Phase 4: ITER-001 (effect inside an any_ iterator) and ITER-002 (every_
 * block without effects). The engine's registry check judges every key of an iterator
 * body in its trigger or effect context and reports misplaced keys with the game's own
 * message (unknown_effect_X / unknown_trigger_X); ITER-002 was a heuristic over the same
 * question. lists.ts (the scraped list tables) is deleted with them; iterator bases come
 * from the spec package's lists bucket.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from 'pychivalry-engine';

export interface IteratorConfig {
    enabled: boolean;
}

export const DEFAULT_ITERATOR_CONFIG: IteratorConfig = {
    enabled: true,
};

/**
 * Validate ordered_ iterator blocks in the given AST.
 */
export function validateIterators(node: ASTNode, config: IteratorConfig): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }
    const diagnostics: Diagnostic[] = [];
    walkForIterators(node, diagnostics);
    return diagnostics;
}

function walkForIterators(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) {
        return;
    }
    for (const child of node.children) {
        if (child.key && child.children && child.key.startsWith('ordered_')) {
            validateOrderedIterator(child, diagnostics);
        }
        walkForIterators(child, diagnostics);
    }
}

/**
 * ordered_* blocks must have an order_by field, and should have position/max.
 */
function validateOrderedIterator(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    let hasOrderBy = false;
    let hasPosition = false;
    let hasMax = false;

    for (const child of node.children) {
        if (child.key === 'order_by') {
            hasOrderBy = true;
        }
        if (child.key === 'position') {
            hasPosition = true;
        }
        if (child.key === 'max') {
            hasMax = true;
        }
    }

    if (!hasOrderBy) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `'${node.key}' is missing required 'order_by' field`,
            code: 'ITER-003',
            source: 'ck3-iterators',
        });
    }

    if (!hasPosition && !hasMax) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `'${node.key}' has no 'position' or 'max' field - consider adding one to limit iteration`,
            code: 'ITER-004',
            source: 'ck3-iterators',
        });
    }
}
