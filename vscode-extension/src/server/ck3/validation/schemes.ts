/**
 * Scheme Validation
 *
 * Validates CK3 scheme definitions for structural correctness.
 * Schemes operate in character scope and target another character.
 *
 * DIAGNOSTIC CODES:
 *     SCHEME-001: Scheme missing required 'skill' field
 *     SCHEME-002: Scheme has no lifecycle effects (does nothing)
 *     SCHEME-003: Scheme uses agents but has no valid_agent conditions
 *     SCHEME-004: Invalid skill type
 *     SCHEME-005: Scheme missing on_ready (never completes)
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';

export interface SchemeConfig {
    enabled: boolean;
}

export const DEFAULT_SCHEME_CONFIG: SchemeConfig = {
    enabled: true,
};

const VALID_SKILL_TYPES = new Set([
    'diplomacy', 'martial', 'stewardship', 'intrigue', 'learning', 'prowess',
]);

/**
 * Validate scheme blocks in the given AST.
 */
export function validateSchemes(
    node: ASTNode,
    config: SchemeConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    // Only validate files in schemes directory
    if (filePath && !filePath.toLowerCase().includes('scheme')) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForSchemes(node, diagnostics);
    return diagnostics;
}

function walkForSchemes(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isSchemeBlock(child)) {
            validateSchemeBlock(child, diagnostics);
        }
    }
}

function isSchemeBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    // A scheme typically has: skill, on_ready, allow, valid, power_per_skill_point
    return keys.has('skill') || keys.has('on_ready') || keys.has('power_per_skill_point') ||
           (keys.has('allow') && keys.has('valid'));
}

function validateSchemeBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // SCHEME-001: missing skill field
    if (!childKeys.has('skill')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: node.range,
            message: `Scheme '${node.key}' is missing required 'skill' field`,
            code: 'SCHEME-001',
            source: 'ck3-schemes',
        });
    }

    // SCHEME-004: invalid skill type
    const skillChild = node.children.find(c => c.key === 'skill');
    if (skillChild && skillChild.value && !VALID_SKILL_TYPES.has(String(skillChild.value))) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: skillChild.range,
            message: `Invalid skill type '${skillChild.value}'. Valid: ${[...VALID_SKILL_TYPES].join(', ')}`,
            code: 'SCHEME-004',
            source: 'ck3-schemes',
        });
    }

    // SCHEME-002: no lifecycle effects — does nothing
    const hasEffects = childKeys.has('on_start') || childKeys.has('on_phase_completed') ||
                       childKeys.has('on_ready') || childKeys.has('on_monthly');
    if (!hasEffects) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `Scheme '${node.key}' has no lifecycle effects — does nothing when executed`,
            code: 'SCHEME-002',
            source: 'ck3-schemes',
        });
    }

    // SCHEME-005: missing on_ready (scheme never completes)
    if (!childKeys.has('on_ready') && childKeys.has('on_start')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `Scheme '${node.key}' has no 'on_ready' — scheme has no completion effect`,
            code: 'SCHEME-005',
            source: 'ck3-schemes',
        });
    }

    // SCHEME-003: uses agents but no valid_agent conditions
    const usesAgentsChild = node.children.find(c => c.key === 'uses_agents');
    const usesAgents = usesAgentsChild && (usesAgentsChild.value === 'yes' || usesAgentsChild.value === true);
    if (usesAgents && !childKeys.has('valid_agent')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `Scheme '${node.key}' uses agents but has no 'valid_agent' conditions`,
            code: 'SCHEME-003',
            source: 'ck3-schemes',
        });
    }
}
