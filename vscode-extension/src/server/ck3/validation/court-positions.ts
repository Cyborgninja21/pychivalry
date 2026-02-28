/**
 * Court Position Validation
 *
 * Validates CK3 court_position definitions.
 *
 * DIAGNOSTIC CODES:
 *     COURT-001: Position missing can_be_appointed trigger
 *     COURT-002: Position has salary but no opinion modifier
 *     COURT-003: Unknown position type in task reference
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';

export interface CourtPositionConfig {
    enabled: boolean;
}

export const DEFAULT_COURT_POSITION_CONFIG: CourtPositionConfig = {
    enabled: true,
};

/**
 * Validate court position blocks in the given AST.
 */
export function validateCourtPositions(
    node: ASTNode,
    config: CourtPositionConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    if (filePath && !filePath.toLowerCase().includes('court_position')) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForCourtPositions(node, diagnostics);
    return diagnostics;
}

function walkForCourtPositions(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isCourtPositionBlock(child)) {
            validateCourtPositionBlock(child, diagnostics);
        }
    }
}

function isCourtPositionBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    return keys.has('can_be_appointed') || keys.has('salary') || keys.has('aptitude') ||
           (keys.has('is_shown') && keys.has('opinion'));
}

function validateCourtPositionBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // COURT-001: Missing can_be_appointed
    if (!childKeys.has('can_be_appointed')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `Court position '${node.key}' is missing 'can_be_appointed' trigger`,
            code: 'COURT-001',
            source: 'ck3-court-positions',
        });
    }

    // COURT-002: Has salary but no opinion
    if (childKeys.has('salary') && !childKeys.has('opinion')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `Court position '${node.key}' has salary but no opinion modifier`,
            code: 'COURT-002',
            source: 'ck3-court-positions',
        });
    }
}
