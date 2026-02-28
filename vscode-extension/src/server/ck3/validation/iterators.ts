/**
 * Iterator Requirement Validation
 *
 * Validates that list iterators (any_*, every_*, random_*, ordered_*)
 * have the correct child content for their iterator type.
 *
 * DIAGNOSTIC CODES:
 *     ITER-001: any_* block contains effects (should be triggers only)
 *     ITER-002: every_* block contains only triggers (should have effects)
 *     ITER-003: ordered_* block missing order_by
 *     ITER-004: ordered_* block missing position/max (warning)
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';
import { getDataLoader } from '../../data/loader';

export interface IteratorConfig {
    enabled: boolean;
}

export const DEFAULT_ITERATOR_CONFIG: IteratorConfig = {
    enabled: true,
};

/** Known effect-context keys (blocks that contain effects) */
const EFFECT_KEYS = new Set([
    'effect', 'immediate', 'after', 'on_completion',
    'on_success', 'on_failure', 'on_start', 'on_invalidated',
    'on_monthly',
]);

/** Known trigger-context keys (blocks that contain triggers) */
const TRIGGER_KEYS = new Set([
    'trigger', 'limit', 'is_shown', 'is_valid',
    'is_valid_showing_failures_only', 'potential', 'allow',
    'ai_potential', 'can_be_shown', 'can_start',
]);

/**
 * Validate iterator blocks in the given AST.
 */
export function validateIterators(
    node: ASTNode,
    config: IteratorConfig
): Diagnostic[] {
    if (!config.enabled) return [];

    const diagnostics: Diagnostic[] = [];
    const effectNames = getKnownEffectNames();
    walkForIterators(node, effectNames, diagnostics);
    return diagnostics;
}

function getKnownEffectNames(): Set<string> {
    const dataLoader = getDataLoader();
    const effects = dataLoader.getEffects();
    return new Set(effects.keys());
}

function walkForIterators(
    node: ASTNode,
    effectNames: Set<string>,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children) {
            if (child.key.startsWith('any_')) {
                validateAnyIterator(child, effectNames, diagnostics);
            } else if (child.key.startsWith('every_')) {
                validateEveryIterator(child, effectNames, diagnostics);
            } else if (child.key.startsWith('ordered_')) {
                validateOrderedIterator(child, diagnostics);
            }
        }

        // Recurse
        walkForIterators(child, effectNames, diagnostics);
    }
}

/**
 * any_* blocks should contain triggers only (they evaluate a condition).
 * Common exceptions: 'limit' blocks inside are fine.
 */
function validateAnyIterator(
    node: ASTNode,
    effectNames: Set<string>,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (!child.key) continue;

        // Skip known structural keys
        if (child.key === 'count' || child.key === 'percent' || TRIGGER_KEYS.has(child.key)) {
            continue;
        }

        // If child is a known effect, flag it
        if (effectNames.has(child.key) || EFFECT_KEYS.has(child.key)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: child.range,
                message: `'${node.key}' is a trigger iterator - '${child.key}' looks like an effect. Use 'every_' prefix for effects.`,
                code: 'ITER-001',
                source: 'ck3-iterators',
            });
        }
    }
}

/**
 * every_* blocks should contain effects. If all non-structural children
 * are triggers with no effects, warn about potential misuse.
 */
function validateEveryIterator(
    node: ASTNode,
    effectNames: Set<string>,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    let hasEffect = false;
    let hasTriggerOnly = false;

    for (const child of node.children) {
        if (!child.key) continue;

        // Skip structural keys
        if (child.key === 'limit' || TRIGGER_KEYS.has(child.key)) {
            continue;
        }

        if (effectNames.has(child.key) || EFFECT_KEYS.has(child.key) ||
            child.key.startsWith('every_') || child.key.startsWith('random_') ||
            child.key.startsWith('ordered_')) {
            hasEffect = true;
        } else {
            hasTriggerOnly = true;
        }
    }

    if (!hasEffect && hasTriggerOnly) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `'${node.key}' is an effect iterator but contains no obvious effects. Did you mean 'any_' prefix for trigger evaluation?`,
            code: 'ITER-002',
            source: 'ck3-iterators',
        });
    }
}

/**
 * ordered_* blocks must have an order_by field, and should have position/max.
 */
function validateOrderedIterator(
    node: ASTNode,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    let hasOrderBy = false;
    let hasPosition = false;
    let hasMax = false;

    for (const child of node.children) {
        if (child.key === 'order_by') hasOrderBy = true;
        if (child.key === 'position') hasPosition = true;
        if (child.key === 'max') hasMax = true;
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
