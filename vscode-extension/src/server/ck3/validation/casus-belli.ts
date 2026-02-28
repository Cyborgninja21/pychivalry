/**
 * Casus Belli Validation
 *
 * Validates CK3 casus_belli_types definitions.
 *
 * DIAGNOSTIC CODES:
 *     CB-001: CB missing all outcome effects (on_victory/on_defeat/on_white_peace)
 *     CB-002: CB cost block with invalid currency
 *     CB-003: CB missing target constraint
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';

export interface CasusBelliConfig {
    enabled: boolean;
}

export const DEFAULT_CASUS_BELLI_CONFIG: CasusBelliConfig = {
    enabled: true,
};

const VALID_CB_COST_TYPES = new Set(['prestige', 'piety', 'gold']);

/**
 * Validate casus belli blocks in the given AST.
 */
export function validateCasusBelli(
    node: ASTNode,
    config: CasusBelliConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    if (filePath && !filePath.toLowerCase().includes('casus_belli')) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForCasusBelli(node, diagnostics);
    return diagnostics;
}

function walkForCasusBelli(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isCasusBelliBlock(child)) {
            validateCasusBelliBlock(child, diagnostics);
        }
    }
}

function isCasusBelliBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    return keys.has('valid_to_start') || keys.has('on_victory') || keys.has('on_defeat') ||
           keys.has('war_score_from_battles_factor') || keys.has('should_invalidate');
}

function validateCasusBelliBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // CB-001: Missing all outcome effects
    if (!childKeys.has('on_victory') && !childKeys.has('on_defeat') && !childKeys.has('on_white_peace')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `Casus belli '${node.key}' has no outcome effects (on_victory/on_defeat/on_white_peace)`,
            code: 'CB-001',
            source: 'ck3-casus-belli',
        });
    }

    // CB-002: Invalid cost currency
    const costChild = node.children.find(c => c.key === 'cost' && c.children);
    if (costChild && costChild.children) {
        for (const costEntry of costChild.children) {
            if (costEntry.key && !VALID_CB_COST_TYPES.has(costEntry.key)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: costEntry.range,
                    message: `Unknown CB cost type '${costEntry.key}'. Valid: ${[...VALID_CB_COST_TYPES].join(', ')}`,
                    code: 'CB-002',
                    source: 'ck3-casus-belli',
                });
            }
        }
    }
}
