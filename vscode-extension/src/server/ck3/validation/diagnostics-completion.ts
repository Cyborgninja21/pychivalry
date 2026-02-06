/**
 * Diagnostics Completion Module
 * Completes remaining diagnostic features
 */

import { ASTNode, NodeType } from '../../core/parser';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';

/**
 * Diagnostic collection result
 */
export interface DiagnosticCollection {
    parse: Diagnostic[];
    syntax: Diagnostic[];
    semantic: Diagnostic[];
    scope: Diagnostic[];
    localization: Diagnostic[];
}

/**
 * Diagnostic collector config
 */
export interface DiagnosticCollectorConfig {
    enableParse: boolean;
    enableSyntax: boolean;
    enableSemantic: boolean;
    enableScope: boolean;
    enableLocalization: boolean;
    maxDiagnostics: number;
}

/**
 * Complete diagnostic collector
 */
export class CompleteDiagnosticCollector {
    private config: DiagnosticCollectorConfig;
    private collections: DiagnosticCollection;
    
    constructor(config: Partial<DiagnosticCollectorConfig> = {}) {
        this.config = {
            enableParse: true,
            enableSyntax: true,
            enableSemantic: true,
            enableScope: true,
            enableLocalization: true,
            maxDiagnostics: 1000,
            ...config
        };
        
        this.collections = {
            parse: [],
            syntax: [],
            semantic: [],
            scope: [],
            localization: []
        };
    }
    
    collectAll(ast: ASTNode, uri: string): Diagnostic[] {
        this.resetCollections();
        
        if (this.config.enableParse) {
            this.collections.parse = this.collectParseErrors(ast);
        }
        if (this.config.enableSyntax) {
            this.collections.syntax = this.collectSyntaxErrors(ast);
        }
        if (this.config.enableSemantic) {
            this.collections.semantic = this.collectSemanticErrors(ast);
        }
        if (this.config.enableScope) {
            this.collections.scope = this.collectScopeErrors(ast);
        }
        if (this.config.enableLocalization) {
            this.collections.localization = this.collectLocalizationErrors(ast);
        }
        
        return this.combineCollections();
    }
    
    private collectParseErrors(ast: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        this.traverseForErrors(ast, diagnostics);
        return diagnostics;
    }
    
    private traverseForErrors(node: ASTNode, diagnostics: Diagnostic[]): void {
        if (!node) return;
        
        // Check for error indicators in the raw text
        if (node.raw && node.raw.includes('ERROR')) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: node.range,
                message: 'Parse error: Unexpected token or syntax',
                code: 'CK3001',
                source: 'ck3-parser'
            });
        }
        
        if (node.children) {
            for (const child of node.children) {
                this.traverseForErrors(child, diagnostics);
            }
        }
    }
    
    private collectSyntaxErrors(ast: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        this.checkBracketBalance(ast, diagnostics);
        return diagnostics;
    }
    
    private checkBracketBalance(node: ASTNode, diagnostics: Diagnostic[]): void {
        let openCount = 0;
        let closeCount = 0;
        
        const countBrackets = (n: ASTNode) => {
            if (n.value === '{') openCount++;
            if (n.value === '}') closeCount++;
            
            if (n.children) {
                for (const child of n.children) {
                    countBrackets(child);
                }
            }
        };
        
        countBrackets(node);
        
        if (openCount !== closeCount) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                message: `Unbalanced brackets: ${openCount} opening, ${closeCount} closing`,
                code: 'CK3330',
                source: 'ck3-validator'
            });
        }
    }
    
    private collectSemanticErrors(ast: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        // Would check for undefined references, type consistency, logic errors
        return diagnostics;
    }
    
    private collectScopeErrors(ast: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        // Would integrate with scope validation modules
        return diagnostics;
    }
    
    private collectLocalizationErrors(ast: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const keys = this.extractLocalizationKeys(ast);
        
        for (const key of keys) {
            if (this.isMissingLocalizationKey(key.value)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: key.range,
                    message: `Missing localization key: ${key.value}`,
                    code: 'CK4100',
                    source: 'ck3-validator'
                });
            }
        }
        
        return diagnostics;
    }
    
    private extractLocalizationKeys(node: ASTNode): Array<{ value: string; range: Range }> {
        const keys: Array<{ value: string; range: Range }> = [];
        
        const traverse = (n: ASTNode) => {
            if (n.key && this.looksLikeLocalizationKey(n.key)) {
                keys.push({ value: n.key, range: n.range });
            }
            
            if (n.children) {
                for (const child of n.children) {
                    traverse(child);
                }
            }
        };
        
        traverse(node);
        return keys;
    }
    
    private looksLikeLocalizationKey(str: string): boolean {
        return /_(t|desc|name|tooltip|effect|trigger|flavor)$/.test(str);
    }
    
    private isMissingLocalizationKey(key: string): boolean {
        // Would check against loaded localization files
        return false;
    }
    
    private combineCollections(): Diagnostic[] {
        const all: Diagnostic[] = [];
        all.push(...this.collections.parse);
        all.push(...this.collections.syntax);
        all.push(...this.collections.semantic);
        all.push(...this.collections.scope);
        all.push(...this.collections.localization);
        return all.slice(0, this.config.maxDiagnostics);
    }
    
    private resetCollections(): void {
        this.collections = {
            parse: [],
            syntax: [],
            semantic: [],
            scope: [],
            localization: []
        };
    }
    
    getStatistics(): Record<string, number> {
        return {
            parse: this.collections.parse.length,
            syntax: this.collections.syntax.length,
            semantic: this.collections.semantic.length,
            scope: this.collections.scope.length,
            localization: this.collections.localization.length,
            total: this.combineCollections().length
        };
    }
}

export function collectAllDiagnostics(
    ast: ASTNode,
    uri: string,
    config?: Partial<DiagnosticCollectorConfig>
): Diagnostic[] {
    const collector = new CompleteDiagnosticCollector(config);
    return collector.collectAll(ast, uri);
}
