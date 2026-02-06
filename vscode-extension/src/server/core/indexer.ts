/**
 * Document Indexer - Maintains a cross-file index of symbols for quick lookups
 * 
 * This indexer tracks:
 * - Events (namespace.id)
 * - Decisions
 * - On-actions
 * - Scripted effects/triggers
 * - Variables
 * - Traits
 * - And other CK3 symbols
 */

import { ASTNode, NodeType } from './parser';

export interface Symbol {
    name: string;
    type: SymbolType;
    uri: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    detail?: string;
    documentation?: string;
}

export enum SymbolType {
    EVENT = 'event',
    DECISION = 'decision',
    CHARACTER_INTERACTION = 'character_interaction',
    ON_ACTION = 'on_action',
    SCRIPTED_EFFECT = 'scripted_effect',
    SCRIPTED_TRIGGER = 'scripted_trigger',
    SCRIPT_VALUE = 'script_value',
    TRAIT = 'trait',
    CULTURE = 'culture',
    RELIGION = 'religion',
    TITLE = 'title',
    MODIFIER = 'modifier',
    VARIABLE = 'variable',
    SCOPE = 'scope',
    NAMESPACE = 'namespace',
    STORY_CYCLE = 'story_cycle',
    ACTIVITY = 'activity',
    SCHEME = 'scheme',
    GENERIC = 'generic',
}

/**
 * Document Indexer maintains a workspace-wide symbol index
 */
export class DocumentIndexer {
    private symbols: Map<string, Symbol[]> = new Map(); // uri -> symbols
    private nameIndex: Map<string, Symbol[]> = new Map(); // name -> symbols
    private typeIndex: Map<SymbolType, Symbol[]> = new Map(); // type -> symbols

    /**
     * Index a document's symbols
     */
    public async indexDocument(uri: string, ast: ASTNode): Promise<void> {
        // Clear existing symbols for this document
        this.removeDocument(uri);
        
        // Extract symbols from AST
        const symbols = this.extractSymbols(uri, ast);
        
        // Store symbols
        this.symbols.set(uri, symbols);
        
        // Update name index
        for (const symbol of symbols) {
            if (!this.nameIndex.has(symbol.name)) {
                this.nameIndex.set(symbol.name, []);
            }
            this.nameIndex.get(symbol.name)!.push(symbol);
            
            // Update type index
            if (!this.typeIndex.has(symbol.type)) {
                this.typeIndex.set(symbol.type, []);
            }
            this.typeIndex.get(symbol.type)!.push(symbol);
        }
    }

    /**
     * Remove a document from the index
     */
    public removeDocument(uri: string): void {
        const symbols = this.symbols.get(uri);
        if (!symbols) return;
        
        // Remove from name index
        for (const symbol of symbols) {
            const nameSymbols = this.nameIndex.get(symbol.name);
            if (nameSymbols) {
                const index = nameSymbols.findIndex(s => s.uri === uri);
                if (index !== -1) {
                    nameSymbols.splice(index, 1);
                }
                if (nameSymbols.length === 0) {
                    this.nameIndex.delete(symbol.name);
                }
            }
            
            // Remove from type index
            const typeSymbols = this.typeIndex.get(symbol.type);
            if (typeSymbols) {
                const index = typeSymbols.findIndex(s => s.uri === uri);
                if (index !== -1) {
                    typeSymbols.splice(index, 1);
                }
                if (typeSymbols.length === 0) {
                    this.typeIndex.delete(symbol.type);
                }
            }
        }
        
        this.symbols.delete(uri);
    }

    /**
     * Find symbols by name
     */
    public findSymbolsByName(name: string): Symbol[] {
        return this.nameIndex.get(name) || [];
    }

    /**
     * Find symbols by type
     */
    public findSymbolsByType(type: SymbolType): Symbol[] {
        return this.typeIndex.get(type) || [];
    }

    /**
     * Get all symbols in a document
     */
    public getDocumentSymbols(uri: string): Symbol[] {
        return this.symbols.get(uri) || [];
    }

    /**
     * Search symbols by pattern
     */
    public searchSymbols(pattern: string): Symbol[] {
        const results: Symbol[] = [];
        const lowerPattern = pattern.toLowerCase();
        
        for (const symbols of this.nameIndex.values()) {
            for (const symbol of symbols) {
                if (symbol.name.toLowerCase().includes(lowerPattern)) {
                    results.push(symbol);
                }
            }
        }
        
        return results;
    }

    /**
     * Extract symbols from AST
     */
    private extractSymbols(uri: string, ast: ASTNode): Symbol[] {
        const symbols: Symbol[] = [];
        
        if (!ast.children) return symbols;
        
        // Detect document type by URI pattern
        const isEventFile = /events?\//.test(uri);
        const isDecisionFile = /decisions?\//.test(uri);
        const isInteractionFile = /character_interactions?\//.test(uri);
        const isOnActionFile = /on_actions?\//.test(uri);
        const isScriptedFile = /scripted_(effects|triggers)\//.test(uri);
        const isStoryCycleFile = /story_cycles?\//.test(uri);
        const isActivityFile = /activities\//.test(uri);
        const isSchemeFile = /schemes\//.test(uri);
        
        // Extract symbols based on file type
        for (const node of ast.children) {
            if (node.type === NodeType.BLOCK || node.type === NodeType.ASSIGNMENT) {
                const name = node.key;
                if (!name) continue;
                
                let type: SymbolType = SymbolType.GENERIC;
                let detail: string | undefined;
                
                // Determine symbol type based on context
                if (isEventFile) {
                    type = SymbolType.EVENT;
                    detail = this.extractEventDetail(node);
                } else if (isDecisionFile) {
                    type = SymbolType.DECISION;
                    detail = this.extractDecisionDetail(node);
                } else if (isInteractionFile) {
                    type = SymbolType.CHARACTER_INTERACTION;
                } else if (isOnActionFile) {
                    type = SymbolType.ON_ACTION;
                } else if (isStoryCycleFile) {
                    type = SymbolType.STORY_CYCLE;
                } else if (isActivityFile) {
                    type = SymbolType.ACTIVITY;
                } else if (isSchemeFile) {
                    type = SymbolType.SCHEME;
                } else if (isScriptedFile) {
                    if (/scripted_effects/.test(uri)) {
                        type = SymbolType.SCRIPTED_EFFECT;
                    } else {
                        type = SymbolType.SCRIPTED_TRIGGER;
                    }
                }
                
                // Check for namespace (events have namespace.id format)
                if (type === SymbolType.EVENT && name.includes('.')) {
                    const [namespace] = name.split('.');
                    // Also index the namespace
                    symbols.push({
                        name: namespace,
                        type: SymbolType.NAMESPACE,
                        uri,
                        range: node.range,
                    });
                }
                
                symbols.push({
                    name,
                    type,
                    uri,
                    range: node.range,
                    detail,
                });
                
                // Recursively extract nested symbols
                if (node.children) {
                    symbols.push(...this.extractNestedSymbols(uri, node.children));
                }
            }
        }
        
        return symbols;
    }

    /**
     * Extract nested symbols (like saved scopes, variables)
     */
    private extractNestedSymbols(uri: string, nodes: ASTNode[]): Symbol[] {
        const symbols: Symbol[] = [];
        
        for (const node of nodes) {
            // Look for save_scope_as or save_temporary_scope_as
            if ((node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') && node.value) {
                symbols.push({
                    name: String(node.value),
                    type: SymbolType.SCOPE,
                    uri,
                    range: node.range,
                });
            }
            
            // Look for set_variable
            if (node.key === 'set_variable' && node.children) {
                const nameNode = node.children.find(c => c.key === 'name');
                if (nameNode && nameNode.value) {
                    symbols.push({
                        name: String(nameNode.value),
                        type: SymbolType.VARIABLE,
                        uri,
                        range: node.range,
                    });
                }
            }
            
            // Recurse into blocks
            if (node.children) {
                symbols.push(...this.extractNestedSymbols(uri, node.children));
            }
        }
        
        return symbols;
    }

    /**
     * Extract detail string for events (title if available)
     */
    private extractEventDetail(node: ASTNode): string | undefined {
        if (!node.children) return undefined;
        
        const titleNode = node.children.find(c => c.key === 'title');
        if (titleNode && titleNode.value) {
            return String(titleNode.value);
        }
        
        const descNode = node.children.find(c => c.key === 'desc');
        if (descNode && descNode.value) {
            return String(descNode.value);
        }
        
        return undefined;
    }

    /**
     * Extract detail string for decisions
     */
    private extractDecisionDetail(node: ASTNode): string | undefined {
        if (!node.children) return undefined;
        
        const titleNode = node.children.find(c => c.key === 'title');
        if (titleNode && titleNode.value) {
            return String(titleNode.value);
        }
        
        return undefined;
    }

    /**
     * Get statistics about the index
     */
    public getStatistics(): {
        totalDocuments: number;
        totalSymbols: number;
        symbolsByType: Record<string, number>;
    } {
        const symbolsByType: Record<string, number> = {};
        
        for (const [type, symbols] of this.typeIndex.entries()) {
            symbolsByType[type] = symbols.length;
        }
        
        let totalSymbols = 0;
        for (const symbols of this.symbols.values()) {
            totalSymbols += symbols.length;
        }
        
        return {
            totalDocuments: this.symbols.size,
            totalSymbols,
            symbolsByType,
        };
    }
}
