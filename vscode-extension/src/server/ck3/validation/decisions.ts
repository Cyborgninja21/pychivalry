/**
 * Decision Validation
 *
 * Validates CK3 decision definitions for structural correctness.
 * Decisions operate in character scope by default.
 *
 * DIAGNOSTIC CODES:
 *     DECISION-001: missing ai_check_interval
 *     DECISION-002: effects found in trigger context (is_shown/is_valid)
 *     DECISION-003: invalid cost currency type
 *     DECISION-004: major decision missing confirmation
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';
import { getDataLoader } from '../../data/loader';

export interface DecisionConfig {
    enabled: boolean;
}

export const DEFAULT_DECISION_CONFIG: DecisionConfig = {
    enabled: true,
};

const VALID_COST_TYPES = new Set(['gold', 'prestige', 'piety', 'minor_gold', 'minor_prestige', 'minor_piety']);

const TRIGGER_CONTEXT_FIELDS = new Set(['is_shown', 'is_valid', 'is_valid_showing_failures_only']);

/**
 * Validate decision blocks in the given AST.
 * Looks for top-level blocks that look like decisions (have is_shown/effect children).
 */
export function validateDecisions(
    node: ASTNode,
    config: DecisionConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    // Only validate files in decisions directory
    if (filePath && !filePath.toLowerCase().includes('decision')) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForDecisions(node, diagnostics);
    return diagnostics;
}

function walkForDecisions(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isDecisionBlock(child)) {
            validateDecisionBlock(child, diagnostics);
        }
    }
}

function isDecisionBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    // A decision typically has at least one of: is_shown, is_valid, effect
    return keys.has('is_shown') || keys.has('is_valid') || keys.has('effect');
}

function validateDecisionBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));
    const effectNames = getKnownEffectNames();
    const isMajor = node.children.some(c => c.key === 'major' && c.value === true);

    // DECISION-001: missing ai_check_interval
    if (!childKeys.has('ai_check_interval')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `Decision '${node.key}' is missing 'ai_check_interval' - AI may never evaluate this decision`,
            code: 'DECISION-001',
            source: 'ck3-decisions',
        });
    }

    // DECISION-002: effects in trigger context (is_shown/is_valid)
    for (const child of node.children) {
        if (child.key && TRIGGER_CONTEXT_FIELDS.has(child.key) && child.children) {
            for (const triggerChild of child.children) {
                if (triggerChild.key && effectNames.has(triggerChild.key)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: triggerChild.range,
                        message: `'${triggerChild.key}' is an effect used in trigger context '${child.key}'`,
                        code: 'DECISION-002',
                        source: 'ck3-decisions',
                    });
                }
            }
        }
    }

    // DECISION-003: invalid cost currency type
    const costChild = node.children.find(c => c.key === 'cost' && c.children);
    if (costChild && costChild.children) {
        for (const costEntry of costChild.children) {
            if (costEntry.key && !VALID_COST_TYPES.has(costEntry.key)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: costEntry.range,
                    message: `Unknown cost type '${costEntry.key}'. Valid types: ${[...VALID_COST_TYPES].join(', ')}`,
                    code: 'DECISION-003',
                    source: 'ck3-decisions',
                });
            }
        }
    }

    // DECISION-004: major decision missing confirmation
    if (isMajor && !childKeys.has('confirm_text')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `Major decision '${node.key}' is missing 'confirm_text' for confirmation dialog`,
            code: 'DECISION-004',
            source: 'ck3-decisions',
        });
    }
}

function getKnownEffectNames(): Set<string> {
    const dataLoader = getDataLoader();
    const effects = dataLoader.getEffects();
    return new Set(effects.keys());
}
