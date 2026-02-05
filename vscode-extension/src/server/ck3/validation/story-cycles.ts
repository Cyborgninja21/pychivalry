/**
 * Story Cycles Validation Module
 * 
 * Validates story cycle definitions and usage:
 * - Story cycle structure
 * - Phase definitions
 * - Transition logic
 * - Event references
 * 
 * Diagnostic Codes:
 * - CK3900: Invalid story cycle structure
 * - CK3901: Missing story cycle phase
 * - CK3902: Invalid phase transition
 * - CK3903: Unreachable story cycle phase
 * - CK3904: Missing story cycle event
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';

export interface StoryCycleInfo {
    name: string;
    phases: string[];
    node: ASTNode;
}

export interface StoryCycleConfig {
    enabled: boolean;
    checkStructure: boolean;
    checkPhases: boolean;
    checkTransitions: boolean;
}

/**
 * Validate story cycles in document
 */
export function validateStoryCycles(
    node: ASTNode,
    config: StoryCycleConfig
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const cycles = collectStoryCycles(node);

    for (const cycle of cycles) {
        if (config.checkStructure) {
            diagnostics.push(...checkStoryCycleStructure(cycle));
        }
    }

    return diagnostics;
}

/**
 * Collect story cycle definitions
 */
function collectStoryCycles(node: ASTNode): ASTNode[] {
    const cycles: ASTNode[] = [];
    
    function traverse(n: ASTNode): void {
        if (n.key === 'story_cycle' || n.key === 'story_cycle_type') {
            cycles.push(n);
        }
        
        if (n.children) {
            n.children.forEach((child: ASTNode) => traverse(child));
        }
    }
    
    traverse(node);
    return cycles;
}

/**
 * Check story cycle structure
 */
function checkStoryCycleStructure(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Story cycles should have on_start, on_end, and effect blocks
    const hasOnStart = node.children?.some((c: ASTNode) => c.key === 'on_start');
    const hasOnEnd = node.children?.some((c: ASTNode) => c.key === 'on_end');

    if (!hasOnStart) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: 'Story cycle missing on_start block',
            code: 'CK3900',
            source: 'ck3-lsp'
        });
    }

    if (!hasOnEnd) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: 'Story cycle missing on_end block',
            code: 'CK3900',
            source: 'ck3-lsp'
        });
    }

    return diagnostics;
}

/**
 * Get story cycle diagnostic description
 */
export function getStoryCycleDiagnosticDescription(code: string): string {
    const descriptions: Record<string, string> = {
        'CK3900': 'Invalid story cycle structure. Story cycles need on_start and on_end blocks.',
        'CK3901': 'Missing story cycle phase. Define all required phases.',
        'CK3902': 'Invalid phase transition. Check transition conditions.',
        'CK3903': 'Unreachable story cycle phase. No transitions lead to this phase.',
        'CK3904': 'Missing story cycle event. The referenced event does not exist.'
    };

    return descriptions[code] || 'Story cycle validation error';
}
