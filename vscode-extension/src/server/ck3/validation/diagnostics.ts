/**
 * Diagnostics Engine - Multi-phase validation pipeline
 * 
 * This module orchestrates the complete validation process for CK3 scripts,
 * collecting diagnostics from multiple sources:
 * - Parse errors (syntax)
 * - Scope validation (context checking)
 * - Schema validation (structure)
 * - Convention checking (best practices)
 * - Localization checking (missing keys)
 * 
 * DIAGNOSTIC CODES:
 *     PARSE-XXX: Parser-level errors
 *     SCOPE-XXX: Scope validation errors
 *     SCHEMA-XXX: Schema validation errors
 *     CONV-XXX: Convention violations
 *     LOC-XXX: Localization issues
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ParseError as ParserError, ASTNode } from '../../core/parser';
import {
    validateScopeChain,
    isValidEffect,
    isValidTrigger,
    getScopeLinks,
    isListIterator,
    parseListIterator,
    isValidListBase,
} from './scopes';
import { validateDocumentScopeTiming, DEFAULT_SCOPE_TIMING_CONFIG } from './scope-timing';

/**
 * Diagnostic configuration
 */
export interface DiagnosticConfig {
    enableScopeValidation: boolean;
    enableSchemaValidation: boolean;
    enableConventionChecks: boolean;
    enableLocalizationChecks: boolean;
    maxDiagnostics: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DiagnosticConfig = {
    enableScopeValidation: true,
    enableSchemaValidation: true,
    enableConventionChecks: true,
    enableLocalizationChecks: true,
    maxDiagnostics: 1000,
};

/**
 * Diagnostics Engine
 */
export class DiagnosticsEngine {
    private config: DiagnosticConfig;
    
    constructor(config: Partial<DiagnosticConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    /**
     * Collect all diagnostics for a document
     */
    public async collectDiagnostics(
        document: TextDocument,
        ast: ASTNode[],
        parseErrors: ParserError[]
    ): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        
        // Phase 1: Parse errors
        diagnostics.push(...this.parseErrorsToDiagnostics(parseErrors));
        
        // Phase 2: Syntax validation
        if (this.config.enableScopeValidation) {
            diagnostics.push(...await this.checkSyntax(ast, document));
        }
        
        // Phase 3: Scope validation
        if (this.config.enableScopeValidation) {
            diagnostics.push(...await this.checkScopes(ast, document));
        }
        
        // Phase 4: Schema validation
        if (this.config.enableSchemaValidation) {
            diagnostics.push(...await this.checkSchema(ast, document));
        }
        
        // Phase 5: Convention checks
        if (this.config.enableConventionChecks) {
            diagnostics.push(...await this.checkConventions(ast, document));
        }
        
        // Phase 6: Localization checks
        if (this.config.enableLocalizationChecks) {
            diagnostics.push(...await this.checkLocalization(ast, document));
        }
        
        // Limit total diagnostics to prevent overwhelming the user
        if (diagnostics.length > this.config.maxDiagnostics) {
            diagnostics.length = this.config.maxDiagnostics;
        }
        
        return diagnostics;
    }
    
    /**
     * Convert parse errors to LSP diagnostics
     */
    private parseErrorsToDiagnostics(parseErrors: ParserError[]): Diagnostic[] {
        return parseErrors.map((error, index) => ({
            severity: DiagnosticSeverity.Error,
            range: error.range,
            message: error.message,
            code: `PARSE-${String(index + 1).padStart(3, '0')}`,
            source: 'ck3-parser',
        }));
    }
    
    /**
     * Check syntax (basic structural validation)
     */
    private async checkSyntax(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        
        // Walk the AST and check for basic syntax issues
        const walk = (nodes: ASTNode[]) => {
            for (const node of nodes) {
                // Check for empty keys
                if (node.key === '' && node.type !== 'ROOT') {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: node.range,
                        message: 'Empty key in assignment',
                        code: 'SYNTAX-001',
                        source: 'ck3-syntax',
                    });
                }
                
                // Recursively check children
                if (node.children) {
                    walk(node.children);
                }
            }
        };
        
        walk(ast);
        return diagnostics;
    }
    
    /**
     * Check scopes (validate scope chains and scope-sensitive operations)
     */
    private async checkScopes(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        
        // Phase 1: Scope timing validation (Golden Rule checking)
        // This catches the most common CK3 modding error
        for (const node of ast) {
            const timingDiags = validateDocumentScopeTiming(node, DEFAULT_SCOPE_TIMING_CONFIG);
            diagnostics.push(...timingDiags);
        }
        
        // Phase 2: Walk the AST and validate scope usage
        const walk = (nodes: ASTNode[], currentScope: string = 'character') => {
            for (const node of nodes) {
                // Check scope chains (e.g., root.liege.primary_title)
                if (node.key && node.key.includes('.')) {
                    const [isValid, resultType, error] = validateScopeChain(node.key, currentScope);
                    
                    if (!isValid && error) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: node.range,
                            message: error,
                            code: 'SCOPE-003',
                            source: 'ck3-scope',
                        });
                    }
                }
                
                // Check effects (in effect blocks)
                if (this.isInEffectContext(node)) {
                    if (node.key && !isValidEffect(node.key, currentScope)) {
                        // Check if it's a known effect but wrong scope
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: node.range,
                            message: `Effect '${node.key}' may not be valid in ${currentScope} scope`,
                            code: 'SCOPE-005',
                            source: 'ck3-scope',
                        });
                    }
                }
                
                // Check triggers (in trigger blocks)
                if (this.isInTriggerContext(node)) {
                    if (node.key && !isValidTrigger(node.key, currentScope)) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Warning,
                            range: node.range,
                            message: `Trigger '${node.key}' may not be valid in ${currentScope} scope`,
                            code: 'SCOPE-004',
                            source: 'ck3-scope',
                        });
                    }
                }
                
                // Check list iterators
                if (node.key && isListIterator(node.key)) {
                    const parsed = parseListIterator(node.key);
                    if (parsed) {
                        const [prefix, baseName] = parsed;
                        if (!isValidListBase(baseName, currentScope)) {
                            diagnostics.push({
                                severity: DiagnosticSeverity.Error,
                                range: node.range,
                                message: `Invalid list iterator '${baseName}' for ${currentScope} scope`,
                                code: 'SCOPE-006',
                                source: 'ck3-scope',
                            });
                        }
                    }
                }
                
                // Recursively check children
                if (node.children) {
                    // Determine scope for children (scope transitions)
                    let childScope = currentScope;
                    
                    // If this is a scope link, update the scope for children
                    if (node.key) {
                        const scopeLinks = getScopeLinks(currentScope);
                        if (scopeLinks.includes(node.key)) {
                            // Scope transition - children are in new scope
                            // (Would need full scope tracking to determine exact type)
                            childScope = currentScope; // Simplified for now
                        }
                    }
                    
                    walk(node.children, childScope);
                }
            }
        };
        
        walk(ast);
        return diagnostics;
    }
    
    /**
     * Check schema (validate against schema definitions)
     */
    private async checkSchema(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        
        // Schema validation would go here
        // For now, this is a placeholder
        
        return diagnostics;
    }
    
    /**
     * Check conventions (best practices and common patterns)
     */
    private async checkConventions(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        
        // Convention checking would go here
        // For now, this is a placeholder
        
        return diagnostics;
    }
    
    /**
     * Check localization (missing keys, orphaned keys)
     */
    private async checkLocalization(ast: ASTNode[], document: TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        
        // Localization checking would go here
        // For now, this is a placeholder
        
        return diagnostics;
    }
    
    /**
     * Check if a node is in an effect context
     */
    private isInEffectContext(node: ASTNode): boolean {
        // Simplified heuristic - check if parent is named 'effect' or similar
        // A full implementation would track context through the AST walk
        return false; // Placeholder
    }
    
    /**
     * Check if a node is in a trigger context
     */
    private isInTriggerContext(node: ASTNode): boolean {
        // Simplified heuristic - check if parent is named 'trigger' or similar
        // A full implementation would track context through the AST walk
        return false; // Placeholder
    }
}

/**
 * Create a diagnostic
 */
export function createDiagnostic(
    range: Range,
    message: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    code?: string,
    source: string = 'ck3'
): Diagnostic {
    return {
        severity,
        range,
        message,
        code,
        source,
    };
}
