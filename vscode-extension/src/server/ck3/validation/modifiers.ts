/**
 * Modifier Validation
 *
 * Validates CK3 modifier and opinion_modifier definitions.
 *
 * DIAGNOSTIC CODES:
 *     MOD-001: Unknown modifier key
 *     MOD-002: Modifier value is non-numeric when numeric expected
 *     MOD-003: Opinion modifier missing 'opinion' field
 *     MOD-004: Opinion modifier value out of typical range (-200 to 200)
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';

export interface ModifierConfig {
    enabled: boolean;
    knownModifierKeys?: Set<string>;
}

export const DEFAULT_MODIFIER_CONFIG: ModifierConfig = {
    enabled: true,
};

/** Non-modifier keys that appear inside modifier blocks but aren't modifier values */
const MODIFIER_META_KEYS = new Set([
    'icon', 'name', 'desc', 'stacking', 'duration', 'hidden',
    'trigger', 'is_shown', 'modifier', 'factor', 'add', 'multiply',
    'compare_modifier', 'if', 'else', 'else_if', 'limit',
]);

/**
 * Validate modifier blocks in the given AST.
 */
export function validateModifiers(
    node: ASTNode,
    config: ModifierConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    const lower = filePath?.toLowerCase() ?? '';
    const isModifierFile = lower.includes('modifier') || lower.includes('opinion_modifier');
    if (filePath && !isModifierFile) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const isOpinionModifier = lower.includes('opinion_modifier');
    walkForModifiers(node, config, isOpinionModifier, diagnostics);
    return diagnostics;
}

function walkForModifiers(
    node: ASTNode,
    config: ModifierConfig,
    isOpinionModifier: boolean,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children) {
            if (isOpinionModifier) {
                validateOpinionModifierBlock(child, diagnostics);
            } else if (isModifierBlock(child)) {
                validateModifierBlock(child, config, diagnostics);
            }
        }
    }
}

function isModifierBlock(node: ASTNode): boolean {
    if (!node.children || node.children.length === 0) return false;
    // A modifier block has numeric value assignments
    return node.children.some(c =>
        c.key && c.value !== undefined && !MODIFIER_META_KEYS.has(c.key)
    );
}

function validateModifierBlock(node: ASTNode, config: ModifierConfig, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (!child.key || MODIFIER_META_KEYS.has(child.key)) continue;
        if (child.children) continue; // Skip block children (nested blocks)
        if (child.value === undefined) continue;

        // MOD-001: Unknown modifier key
        if (config.knownModifierKeys && !config.knownModifierKeys.has(child.key)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: child.range,
                message: `Unknown modifier key '${child.key}'`,
                code: 'MOD-001',
                source: 'ck3-modifiers',
            });
        }

        // MOD-002: Non-numeric modifier value
        const val = child.value;
        if (typeof val === 'string' && val !== 'yes' && val !== 'no' && isNaN(Number(val))) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: child.range,
                message: `Modifier value for '${child.key}' is non-numeric: '${val}'`,
                code: 'MOD-002',
                source: 'ck3-modifiers',
            });
        }
    }
}

function validateOpinionModifierBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // MOD-003: Opinion modifier missing 'opinion' field
    if (!childKeys.has('opinion')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `Opinion modifier '${node.key}' is missing 'opinion' field`,
            code: 'MOD-003',
            source: 'ck3-modifiers',
        });
    }

    // MOD-004: Opinion value out of typical range
    const opinionChild = node.children.find(c => c.key === 'opinion');
    if (opinionChild && opinionChild.value !== undefined) {
        const val = Number(opinionChild.value);
        if (!isNaN(val) && (val < -200 || val > 200)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: opinionChild.range,
                message: `Opinion modifier value ${val} is outside typical range (-200 to 200)`,
                code: 'MOD-004',
                source: 'ck3-modifiers',
            });
        }
    }
}
