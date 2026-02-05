/**
 * Scope Validation Completion Module
 * Completes remaining scope validation features
 */

import { ASTNode } from '../../core/parser';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';

/**
 * Scope history tracking
 */
export interface ScopeHistory {
    scopes: string[];
    transitions: string[];
}

/**
 * Scope transition info
 */
export interface ScopeTransition {
    from: string;
    to: string;
    via: string;
    valid: boolean;
    alternatives?: string[];
}

/**
 * Advanced scope config
 */
export interface AdvancedScopeConfig {
    trackHistory: boolean;
    suggestAlternatives: boolean;
    maxChainDepth: number;
}

/**
 * Scope history tracker
 */
export class ScopeHistoryTracker {
    private histories: Map<string, ScopeHistory> = new Map();
    
    startTracking(id: string, initialScope: string): void {
        this.histories.set(id, { scopes: [initialScope], transitions: [] });
    }
    
    addTransition(id: string, toScope: string, via: string): void {
        const history = this.histories.get(id);
        if (history) {
            history.scopes.push(toScope);
            history.transitions.push(via);
        }
    }
    
    getCurrentScope(id: string): string | undefined {
        const history = this.histories.get(id);
        return history ? history.scopes[history.scopes.length - 1] : undefined;
    }
    
    getAllChains(): string[] {
        return Array.from(this.histories.keys());
    }
}

/**
 * Scope transition validator
 */
export class ScopeTransitionValidator {
    validateTransition(from: string, to: string, via: string): ScopeTransition {
        const valid = this.isValidTransition(from, to, via);
        const alternatives = valid ? [] : this.findAlternatives(from, to);
        return { from, to, via, valid, alternatives };
    }
    
    private isValidTransition(from: string, to: string, via: string): boolean {
        const transitions: Record<string, Record<string, string[]>> = {
            'character': {
                'province': ['location', 'capital_province'],
                'title': ['primary_title', 'highest_held_title_tier'],
                'faith': ['faith'],
                'culture': ['culture']
            },
            'province': {
                'character': ['holder', 'county.holder'],
                'title': ['county']
            },
            'title': {
                'character': ['holder'],
                'province': ['title_province']
            }
        };
        
        return transitions[from]?.[to]?.includes(via) ?? false;
    }
    
    private findAlternatives(from: string, to: string): string[] {
        const alts: string[] = [];
        if (from === 'character' && to === 'province') {
            alts.push('location', 'capital_province');
        } else if (from === 'character' && to === 'title') {
            alts.push('primary_title');
        }
        return alts;
    }
}

/**
 * Saved scope validator
 */
export class SavedScopeValidator {
    private savedScopes: Map<string, string> = new Map();
    
    saveScopeAs(name: string, type: string): void {
        this.savedScopes.set(name, type);
    }
    
    hasSavedScope(name: string): boolean {
        return this.savedScopes.has(name);
    }
    
    getSavedScopeType(name: string): string | undefined {
        return this.savedScopes.get(name);
    }
    
    validateUsage(name: string, range: { start: { line: number; character: number }; end: { line: number; character: number } }): Diagnostic[] {
        if (!this.hasSavedScope(name)) {
            return [{
                severity: DiagnosticSeverity.Error,
                range,
                message: `Saved scope '${name}' does not exist in this context`,
                code: 'CK3585',
                source: 'ck3-validator'
            }];
        }
        return [];
    }
    
    getAllSavedScopes(): string[] {
        return Array.from(this.savedScopes.keys());
    }
    
    clearAll(): void {
        this.savedScopes.clear();
    }
}

/**
 * Scope depth tracker
 */
export class ScopeDepthTracker {
    private currentDepth: number = 0;
    
    constructor(private maxDepth: number = 10) {}
    
    enter(): boolean {
        this.currentDepth++;
        return this.currentDepth <= this.maxDepth;
    }
    
    exit(): void {
        if (this.currentDepth > 0) {
            this.currentDepth--;
        }
    }
    
    isExceeded(): boolean {
        return this.currentDepth > this.maxDepth;
    }
    
    reset(): void {
        this.currentDepth = 0;
    }
}

/**
 * Complete scope validator
 */
export class CompleteScopeValidator {
    private historyTracker: ScopeHistoryTracker;
    private transitionValidator: ScopeTransitionValidator;
    private savedScopeValidator: SavedScopeValidator;
    private depthTracker: ScopeDepthTracker;
    private config: AdvancedScopeConfig;
    
    constructor(config: Partial<AdvancedScopeConfig> = {}) {
        this.historyTracker = new ScopeHistoryTracker();
        this.transitionValidator = new ScopeTransitionValidator();
        this.savedScopeValidator = new SavedScopeValidator();
        this.depthTracker = new ScopeDepthTracker();
        
        this.config = {
            trackHistory: true,
            suggestAlternatives: true,
            maxChainDepth: 10,
            ...config
        };
    }
    
    validateDocument(ast: ASTNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        this.depthTracker.reset();
        this.validateNode(ast, 'character', diagnostics);
        return diagnostics;
    }
    
    private validateNode(node: ASTNode, currentScope: string, diagnostics: Diagnostic[]): void {
        if (!node) return;
        
        if (!this.depthTracker.enter()) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: node.range,
                message: `Scope chain exceeds maximum depth of ${this.config.maxChainDepth}`,
                code: 'CK3590',
                source: 'ck3-validator'
            });
            this.depthTracker.exit();
            return;
        }
        
        if (node.children) {
            for (const child of node.children) {
                this.validateNode(child, currentScope, diagnostics);
            }
        }
        
        this.depthTracker.exit();
    }
    
    getStatistics(): { trackedChains: number; savedScopes: number } {
        return {
            trackedChains: this.historyTracker.getAllChains().length,
            savedScopes: this.savedScopeValidator.getAllSavedScopes().length
        };
    }
    
    reset(): void {
        this.historyTracker = new ScopeHistoryTracker();
        this.savedScopeValidator.clearAll();
        this.depthTracker.reset();
    }
}

export function validateAdvancedScopes(ast: ASTNode, config?: Partial<AdvancedScopeConfig>): Diagnostic[] {
    const validator = new CompleteScopeValidator(config);
    return validator.validateDocument(ast);
}
