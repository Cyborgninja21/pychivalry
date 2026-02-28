/**
 * Character Interaction Validation
 *
 * Validates CK3 character_interaction definitions for structural correctness.
 *
 * DIAGNOSTIC CODES:
 *     INTERACT-001: (handled by HOOK-001 in interaction-hooks.ts)
 *     INTERACT-002: unreachable on_decline when auto_accept = yes
 *     INTERACT-003: invalid interaction category
 *     INTERACT-004: missing is_shown
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';

export interface InteractionValidationConfig {
    enabled: boolean;
}

export const DEFAULT_INTERACTION_VALIDATION_CONFIG: InteractionValidationConfig = {
    enabled: true,
};

const VALID_CATEGORIES = new Set([
    'interaction_category_diplomacy',
    'interaction_category_hostile',
    'interaction_category_personal',
    'interaction_category_religion',
    'interaction_category_vassal',
    'interaction_category_prison',
]);

/**
 * Validate character interaction blocks.
 */
export function validateInteractions(
    node: ASTNode,
    config: InteractionValidationConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    // Only validate files in character_interactions directory
    if (filePath && !filePath.toLowerCase().includes('character_interaction')) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForInteractions(node, diagnostics);
    return diagnostics;
}

function walkForInteractions(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isInteractionBlock(child)) {
            validateInteractionBlock(child, diagnostics);
        }
    }
}

function isInteractionBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    // Interactions typically have: is_shown, on_accept, category
    return keys.has('on_accept') || keys.has('is_shown') || keys.has('category');
}

function validateInteractionBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // INTERACT-002: auto_accept = yes makes on_decline unreachable
    const autoAccept = node.children.find(c => c.key === 'auto_accept' && c.value === true);
    if (autoAccept && childKeys.has('on_decline')) {
        const onDecline = node.children.find(c => c.key === 'on_decline');
        if (onDecline) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: onDecline.range,
                message: `'on_decline' is unreachable because 'auto_accept = yes'`,
                code: 'INTERACT-002',
                source: 'ck3-interactions',
            });
        }
    }

    // INTERACT-003: invalid category
    const categoryChild = node.children.find(c => c.key === 'category');
    if (categoryChild && typeof categoryChild.value === 'string') {
        if (!VALID_CATEGORIES.has(categoryChild.value)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: categoryChild.range,
                message: `Unknown interaction category '${categoryChild.value}'`,
                code: 'INTERACT-003',
                source: 'ck3-interactions',
            });
        }
    }

    // INTERACT-004: missing is_shown
    if (!childKeys.has('is_shown')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `Interaction '${node.key}' is missing 'is_shown' - it will always be visible`,
            code: 'INTERACT-004',
            source: 'ck3-interactions',
        });
    }
}
