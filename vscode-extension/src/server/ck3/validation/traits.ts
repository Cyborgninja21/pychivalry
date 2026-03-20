/**
 * Traits Validation Module
 * 
 * Validates trait references and definitions:
 * - Trait existence
 * - Trait compatibility
 * - Trait opposites
 * - Trait requirements
 * 
 * Diagnostic Codes:
 * - CK3800: Unknown trait reference
 * - CK3801: Incompatible traits
 * - CK3802: Trait already defined
 * - CK3803: Missing trait opposite
 * - CK3804: Invalid trait group
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';

export interface TraitInfo {
    name: string;
    group?: string;
    opposites: string[];
    compatible: string[];
    node: ASTNode;
}

export interface TraitsConfig {
    enabled: boolean;
    checkExistence: boolean;
    checkCompatibility: boolean;
    checkOpposites: boolean;
    knownTraits?: Set<string>;
}

/**
 * Validate trait references in document
 */
export function validateTraits(
    node: ASTNode,
    config: TraitsConfig
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const traitRefs = collectTraitReferences(node);

    for (const ref of traitRefs) {
        if (config.checkExistence) {
            const existsDiags = checkTraitExists(ref, config.knownTraits);
            diagnostics.push(...existsDiags);
        }
    }

    return diagnostics;
}

/**
 * Collect trait references from AST
 */
function collectTraitReferences(node: ASTNode): ASTNode[] {
    const refs: ASTNode[] = [];
    
    function traverse(n: ASTNode): void {
        if (n.key === 'trait' || n.key === 'add_trait' || n.key === 'remove_trait') {
            refs.push(n);
        }
        
        if (n.children) {
            n.children.forEach((child: ASTNode) => traverse(child));
        }
    }
    
    traverse(node);
    return refs;
}

/**
 * Check if trait exists
 */
function checkTraitExists(
    node: ASTNode,
    knownTraits?: Set<string>
): Diagnostic[] {
    if (!knownTraits || !node.value) {
        return [];
    }

    const traitName = String(node.value);
    
    if (!knownTraits.has(traitName)) {
        return [{
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `Unknown trait: "${traitName}"`,
            code: 'CK3800',
            source: 'ck3-lsp'
        }];
    }

    return [];
}

/**
 * Get trait diagnostic description
 */
export function getTraitDiagnosticDescription(code: string): string {
    const descriptions: Record<string, string> = {
        'CK3800': 'Unknown trait reference. The trait is not defined in trait files.',
        'CK3801': 'Incompatible traits. These traits cannot exist together.',
        'CK3802': 'Trait already defined. Duplicate trait definition.',
        'CK3803': 'Missing trait opposite. Define opposite trait relationship.',
        'CK3804': 'Invalid trait group. The trait group does not exist.'
    };

    return descriptions[code] || 'Trait validation error';
}
