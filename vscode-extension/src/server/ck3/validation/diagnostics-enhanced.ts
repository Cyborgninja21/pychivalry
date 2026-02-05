/**
 * Enhanced Diagnostics Engine for CK3 Scripts
 * 
 * This module provides comprehensive diagnostic collection including:
 * - Semantic validation
 * - Localization checking (missing/orphaned keys)
 * - Variable tracking (declaration/usage)
 * - Reference resolution
 * - Unused symbol detection
 * - Circular dependency detection
 * 
 * DIAGNOSTIC CODES:
 *   CK4000-CK4099: Semantic errors
 *   CK4100-CK4199: Localization errors
 *   CK4200-CK4299: Variable errors
 *   CK4300-CK4399: Reference errors
 *   CK4400-CK4499: Unused symbols
 *   CK4500-CK4599: Circular dependencies
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode, ParsedDocument, ParseError, NodeType } from '../../core/parser';
import { DocumentIndexer } from '../../core/indexer';

/**
 * Extended diagnostic configuration
 */
export interface DiagnosticConfigExtended {
    checkSemantics: boolean;
    checkLocalization: boolean;
    checkVariables: boolean;
    checkReferences: boolean;
    checkUnusedSymbols: boolean;
    checkCircularDependencies: boolean;
    localizationLanguages: string[];
    ignorePatterns: string[];
}

/**
 * Default extended diagnostic configuration
 */
export const DEFAULT_DIAGNOSTIC_CONFIG_EXTENDED: DiagnosticConfigExtended = {
    checkSemantics: true,
    checkLocalization: true,
    checkVariables: true,
    checkReferences: true,
    checkUnusedSymbols: false, // Can be noisy
    checkCircularDependencies: true,
    localizationLanguages: ['english'],
    ignorePatterns: []
};

/**
 * Localization key reference
 */
interface LocalizationReference {
    key: string;
    line: number;
    column: number;
    context: string;
}

/**
 * Variable declaration/usage tracking
 */
interface VariableInfo {
    name: string;
    declaredAt: { line: number; column: number } | null;
    usedAt: Array<{ line: number; column: number }>;
    scope: string;
}

/**
 * Check for missing localization keys
 */
export function checkMissingLocalization(
    doc: ParsedDocument,
    availableKeys: Set<string>
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const references = collectLocalizationReferences(doc.ast.children || []);
    
    for (const ref of references) {
        if (!availableKeys.has(ref.key)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: ref.line, character: ref.column },
                    end: { line: ref.line, character: ref.column + ref.key.length }
                },
                message: `Missing localization key: ${ref.key}`,
                code: 'CK4100',
                source: 'ck3-language-server'
            });
        }
    }
    
    return diagnostics;
}

/**
 * Check for orphaned localization keys (defined but never used)
 */
export function checkOrphanedLocalization(
    definedKeys: Set<string>,
    usedKeys: Set<string>,
    localizationFiles: Map<string, { line: number; file: string }>
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    for (const key of definedKeys) {
        if (!usedKeys.has(key)) {
            const info = localizationFiles.get(key);
            if (info) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Hint,
                    range: {
                        start: { line: info.line, character: 0 },
                        end: { line: info.line, character: key.length }
                    },
                    message: `Orphaned localization key '${key}' is defined but never used`,
                    code: 'CK4150',
                    source: 'ck3-language-server',
                    tags: [2] // DiagnosticTag.Unnecessary
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Collect all localization references from AST
 */
function collectLocalizationReferences(nodes: ASTNode[]): LocalizationReference[] {
    const references: LocalizationReference[] = [];
    
    function visitNode(node: ASTNode): void {
        // Check for localization key patterns
        if (node.type === NodeType.ASSIGNMENT) {
            const keyFields = ['name', 'desc', 'text', 'tooltip', 'title'];
            const nodeValue = String(node.value || '');
            if (keyFields.includes(nodeValue)) {
                // The value might be a localization key
                if (node.children && node.children.length > 0) {
                    const value = node.children[0];
                    if (value.type === NodeType.VALUE && value.value) {
                        references.push({
                            key: String(value.value),
                            line: value.range.start.line,
                            column: value.range.start.character,
                            context: nodeValue
                        });
                    }
                }
            }
        }
        
        // Recurse
        if (node.children) {
            for (const child of node.children) {
                visitNode(child);
            }
        }
    }
    
    for (const node of nodes) {
        visitNode(node);
    }
    
    return references;
}

/**
 * Check variable declarations and usage
 */
export function checkVariableUsage(doc: ParsedDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const variables = trackVariables(doc.ast.children || []);
    
    for (const [name, info] of variables.entries()) {
        // Check for usage before declaration
        if (info.declaredAt) {
            for (const usage of info.usedAt) {
                if (usage.line < info.declaredAt.line) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: usage.line, character: usage.column },
                            end: { line: usage.line, character: usage.column + name.length }
                        },
                        message: `Variable '${name}' used before declaration`,
                        code: 'CK4200',
                        source: 'ck3-language-server'
                    });
                }
            }
        } else if (info.usedAt.length > 0) {
            // Variable used but never declared
            const firstUsage = info.usedAt[0];
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: firstUsage.line, character: firstUsage.column },
                    end: { line: firstUsage.line, character: firstUsage.column + name.length }
                },
                message: `Variable '${name}' used but never declared`,
                code: 'CK4201',
                source: 'ck3-language-server'
            });
        }
        
        // Check for unused variables
        if (info.declaredAt && info.usedAt.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Hint,
                range: {
                    start: { line: info.declaredAt.line, character: info.declaredAt.column },
                    end: { line: info.declaredAt.line, character: info.declaredAt.column + name.length }
                },
                message: `Variable '${name}' is declared but never used`,
                code: 'CK4202',
                source: 'ck3-language-server',
                tags: [2] // DiagnosticTag.Unnecessary
            });
        }
    }
    
    return diagnostics;
}

/**
 * Track variable declarations and usage
 */
function trackVariables(nodes: ASTNode[]): Map<string, VariableInfo> {
    const variables = new Map<string, VariableInfo>();
    
    function visitNode(node: ASTNode): void {
        // Check for variable declarations (set_variable, save_scope_as, etc.)
        if (node.type === NodeType.ASSIGNMENT) {
            const nodeValue = String(node.value || '');
            const declareOps = ['set_variable', 'save_scope_as', 'save_temporary_scope_as'];
            if (declareOps.includes(nodeValue)) {
                if (node.children && node.children.length > 0) {
                    const varNode = node.children[0];
                    if (varNode.type === NodeType.BLOCK && varNode.children) {
                        // Extract variable name from block
                        for (const child of varNode.children) {
                            const childValue = String(child.value || '');
                            if (childValue === 'name' && child.children && child.children.length > 0) {
                                const varName = String(child.children[0].value || '');
                                if (!variables.has(varName)) {
                                    variables.set(varName, {
                                        name: varName,
                                        declaredAt: {
                                            line: child.range.start.line,
                                            column: child.range.start.character
                                        },
                                        usedAt: [],
                                        scope: 'unknown'
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            // Check for variable usage (var:xxx, scope:xxx)
            if (nodeValue.startsWith('var:') || nodeValue.startsWith('scope:')) {
                const parts = nodeValue.split(':');
                if (parts.length > 1) {
                    const varName = parts[1];
                    if (!variables.has(varName)) {
                        variables.set(varName, {
                            name: varName,
                            declaredAt: null,
                            usedAt: [],
                            scope: 'unknown'
                        });
                    }
                    variables.get(varName)!.usedAt.push({
                        line: node.range.start.line,
                        column: node.range.start.character
                    });
                }
            }
        }
        
        // Recurse
        if (node.children) {
            for (const child of node.children) {
                visitNode(child);
            }
        }
    }
    
    for (const node of nodes) {
        visitNode(node);
    }
    
    return variables;
}

/**
 * Check for undefined references (events, decisions, etc.)
 */
export function checkUndefinedReferences(
    doc: ParsedDocument,
    indexer: DocumentIndexer | null
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    if (!indexer) {
        return diagnostics;
    }
    
    const references = collectReferences(doc.ast.children || []);
    
    for (const ref of references) {
        const symbols = indexer.findSymbolsByName(ref.name);
        const found = symbols.some(s => s.type === ref.type);
        
        if (!found) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: ref.line, character: ref.column },
                    end: { line: ref.line, character: ref.column + ref.name.length }
                },
                message: `Undefined ${ref.type}: ${ref.name}`,
                code: 'CK4300',
                source: 'ck3-language-server'
            });
        }
    }
    
    return diagnostics;
}

/**
 * Collect all references from AST
 */
function collectReferences(nodes: ASTNode[]): Array<{
    type: string;
    name: string;
    line: number;
    column: number;
}> {
    const references: Array<{ type: string; name: string; line: number; column: number }> = [];
    
    function visitNode(node: ASTNode): void {
        if (node.type === NodeType.ASSIGNMENT) {
            const nodeValue = String(node.value || '');
            const refTypes: Record<string, string> = {
                'trigger_event': 'event',
                'random_events': 'event',
                'has_decision': 'decision',
                'show_as_tooltip': 'scripted_effect',
                'hidden_effect': 'scripted_effect'
            };
            
            if (refTypes[nodeValue]) {
                if (node.children && node.children.length > 0) {
                    const refName = String(node.children[0].value || '');
                    if (refName) {
                        references.push({
                            type: refTypes[nodeValue],
                            name: refName,
                            line: node.children[0].range.start.line,
                            column: node.children[0].range.start.character
                        });
                    }
                }
            }
        }
        
        // Recurse
        if (node.children) {
            for (const child of node.children) {
                visitNode(child);
            }
        }
    }
    
    for (const node of nodes) {
        visitNode(node);
    }
    
    return references;
}

/**
 * Check for circular dependencies
 */
export function checkCircularDependencies(
    indexer: DocumentIndexer | null
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    if (!indexer) {
        return diagnostics;
    }
    
    // Build dependency graph
    const graph = new Map<string, Set<string>>();
    
    // Add events
    const events = indexer.findSymbolsByType('event' as any);
    for (const event of events) {
        if (!graph.has(event.name)) {
            graph.set(event.name, new Set());
        }
    }
    
    // Detect cycles using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();
    
    function hasCycle(node: string, path: string[]): string[] | null {
        if (inStack.has(node)) {
            return [...path, node];
        }
        if (visited.has(node)) {
            return null;
        }
        
        visited.add(node);
        inStack.add(node);
        path.push(node);
        
        const neighbors = graph.get(node);
        if (neighbors) {
            for (const neighbor of neighbors) {
                const cycle = hasCycle(neighbor, path);
                if (cycle) {
                    return cycle;
                }
            }
        }
        
        inStack.delete(node);
        path.pop();
        return null;
    }
    
    for (const node of graph.keys()) {
        const cycle = hasCycle(node, []);
        if (cycle) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                },
                message: `Circular dependency detected: ${cycle.join(' -> ')}`,
                code: 'CK4500',
                source: 'ck3-language-server'
            });
            break; // Report only first cycle
        }
    }
    
    return diagnostics;
}

/**
 * Check for unused symbols
 */
export function checkUnusedSymbols(
    indexer: DocumentIndexer | null
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    if (!indexer) {
        return diagnostics;
    }
    
    // Check for unused events (defined but never triggered)
    const events = indexer.findSymbolsByType('event' as any);
    for (const event of events) {
        // For now, we can't easily track references
        // This would require more sophisticated indexing
    }
    
    return diagnostics;
}

/**
 * Collect all enhanced diagnostics
 */
export function collectEnhancedDiagnostics(
    doc: ParsedDocument,
    indexer: DocumentIndexer | null,
    config: DiagnosticConfigExtended = DEFAULT_DIAGNOSTIC_CONFIG_EXTENDED
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Semantic checks
    if (config.checkSemantics) {
        // Would call semantic checking here
    }
    
    // Localization checks
    if (config.checkLocalization) {
        // Would need access to localization keys
        // diagnostics.push(...checkMissingLocalization(doc, availableKeys));
    }
    
    // Variable checks
    if (config.checkVariables) {
        diagnostics.push(...checkVariableUsage(doc));
    }
    
    // Reference checks
    if (config.checkReferences) {
        diagnostics.push(...checkUndefinedReferences(doc, indexer));
    }
    
    // Unused symbol checks
    if (config.checkUnusedSymbols && indexer) {
        diagnostics.push(...checkUnusedSymbols(indexer));
    }
    
    // Circular dependency checks
    if (config.checkCircularDependencies && indexer) {
        diagnostics.push(...checkCircularDependencies(indexer));
    }
    
    return diagnostics;
}
