/**
 * Document Symbol Provider - Hierarchical outline and workspace symbol search
 * Provides rich document structure with categorization and fuzzy search
 */

import { DocumentSymbol, SymbolKind, WorkspaceSymbol, SymbolInformation } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { DocumentIndexer, SymbolType, Symbol } from '../core/indexer';
import { CK3Language } from '../ck3/language';

interface SymbolCategory {
    title: string;
    kind: SymbolKind;
    filter: (node: ASTNode) => boolean;
}

/**
 * Enhanced Document Symbol Provider with hierarchical structure
 */
export class DocumentSymbolProvider {
    private static readonly SYMBOL_CATEGORIES: SymbolCategory[] = [
        {
            title: 'Events',
            kind: SymbolKind.Event,
            filter: (n) => !!n.key && /^\w+\.\d+$|^\w+\.\w+$/.test(n.key)
        },
        {
            title: 'Decisions',
            kind: SymbolKind.Class,
            filter: (n) => !!n.key && /^[a-z_]+_decision$/.test(n.key)
        },
        {
            title: 'Effects',
            kind: SymbolKind.Function,
            filter: (n) => !!n.key && CK3Language.isEffect(n.key)
        },
        {
            title: 'Triggers',
            kind: SymbolKind.Method,
            filter: (n) => !!n.key && CK3Language.isTrigger(n.key)
        },
    ];

    constructor(
        private ck3Parser: CK3Parser,
        private symbolIndexer: DocumentIndexer
    ) {}

    /**
     * Build hierarchical document outline with proper nesting
     */
    public async buildDocumentOutline(doc: TextDocument): Promise<DocumentSymbol[]> {
        const parseResult = this.ck3Parser.parse(doc.getText());
        
        if (!parseResult.ast.children || parseResult.ast.children.length === 0) {
            return [];
        }

        const outlineSymbols = this.constructSymbolHierarchy(
            parseResult.ast.children,
            doc.uri
        );

        return this.sortSymbolsByCategory(outlineSymbols);
    }

    /**
     * Search workspace symbols with fuzzy matching
     */
    public async searchWorkspaceSymbols(query: string): Promise<WorkspaceSymbol[]> {
        if (!query || query.length === 0) {
            return [];
        }

        const fuzzyMatcher = this.createFuzzyMatcher(query.toLowerCase());
        const allSymbolsInWorkspace = this.getAllIndexedSymbols();
        
        const matchedSymbols = allSymbolsInWorkspace
            .map(sym => ({
                symbol: sym,
                score: fuzzyMatcher(sym.name.toLowerCase())
            }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 100) // Limit results
            .map(result => this.convertToWorkspaceSymbol(result.symbol));

        return matchedSymbols;
    }

    /**
     * Get all symbols from document, categorized and sorted
     */
    public async getCategorizedSymbols(doc: TextDocument): Promise<DocumentSymbol[]> {
        const parseResult = this.ck3Parser.parse(doc.getText());
        
        if (!parseResult.ast.children) return [];

        const categoryGroups = new Map<string, DocumentSymbol[]>();

        for (const category of DocumentSymbolProvider.SYMBOL_CATEGORIES) {
            const matchingNodes = parseResult.ast.children.filter(category.filter);
            
            if (matchingNodes.length > 0) {
                const categorySymbols = matchingNodes.map(node => 
                    this.buildDocumentSymbol(node, doc.uri)
                );
                categoryGroups.set(category.title, categorySymbols);
            }
        }

        // Create category container symbols
        const categorizedResult: DocumentSymbol[] = [];
        
        for (const [categoryTitle, symbols] of categoryGroups) {
            const containerSymbol = this.createCategoryContainer(categoryTitle, symbols);
            categorizedResult.push(containerSymbol);
        }

        return categorizedResult;
    }

    /**
     * Construct hierarchical symbol tree from AST nodes
     */
    private constructSymbolHierarchy(
        astNodes: ASTNode[],
        documentUri: string
    ): DocumentSymbol[] {
        const hierarchyResult: DocumentSymbol[] = [];

        for (const astNode of astNodes) {
            // Skip non-symbolic nodes
            if (astNode.type === NodeType.COMMENT || !astNode.key) {
                continue;
            }

            const symbolNode = this.buildDocumentSymbol(astNode, documentUri);
            
            // Recursively build children
            if (astNode.children && astNode.children.length > 0) {
                const childSymbols = this.constructSymbolHierarchy(astNode.children, documentUri);
                
                if (childSymbols.length > 0) {
                    symbolNode.children = childSymbols;
                }
            }

            hierarchyResult.push(symbolNode);
        }

        return hierarchyResult;
    }

    /**
     * Build DocumentSymbol from AST node with rich metadata
     */
    private buildDocumentSymbol(astNode: ASTNode, documentUri: string): DocumentSymbol {
        const symbolKind = this.classifySymbolKind(astNode);
        const symbolDetail = this.extractSymbolDetail(astNode);
        
        const docSymbol: DocumentSymbol = {
            name: astNode.key || '(anonymous)',
            kind: symbolKind,
            range: astNode.range,
            selectionRange: this.calculateSelectionRange(astNode),
        };

        if (symbolDetail) {
            docSymbol.detail = symbolDetail;
        }

        return docSymbol;
    }

    /**
     * Classify symbol kind based on AST node characteristics
     */
    private classifySymbolKind(astNode: ASTNode): SymbolKind {
        if (!astNode.key) return SymbolKind.Object;

        const keyName = astNode.key;

        // Event pattern: namespace.id
        if (/^\w+\.\d+$/.test(keyName) || /^\w+\.\w+$/.test(keyName)) {
            return SymbolKind.Event;
        }

        // Decision pattern
        if (/_decision$/.test(keyName)) {
            return SymbolKind.Class;
        }

        // Interaction pattern
        if (/_interaction$/.test(keyName)) {
            return SymbolKind.Interface;
        }

        // Story cycle pattern
        if (/_story_cycle$/.test(keyName)) {
            return SymbolKind.Namespace;
        }

        // Effect/Trigger
        if (CK3Language.isEffect(keyName)) {
            return SymbolKind.Function;
        }
        
        if (CK3Language.isTrigger(keyName)) {
            return SymbolKind.Method;
        }

        // On-action pattern
        if (/^on_/.test(keyName)) {
            return SymbolKind.Event;
        }

        // Variable/scope
        if (keyName === 'save_scope_as' || keyName === 'save_temporary_scope_as') {
            return SymbolKind.Variable;
        }

        if (keyName === 'set_variable' || keyName === 'change_variable') {
            return SymbolKind.Variable;
        }

        // Block vs simple assignment
        if (astNode.type === NodeType.BLOCK) {
            return SymbolKind.Struct;
        }

        return SymbolKind.Property;
    }

    /**
     * Extract detail string for symbol (title, description, etc.)
     */
    private extractSymbolDetail(astNode: ASTNode): string | undefined {
        if (!astNode.children) return undefined;

        // Look for title field
        const titleNode = astNode.children.find(child => child.key === 'title');
        if (titleNode && titleNode.value) {
            return `Title: ${titleNode.value}`;
        }

        // Look for desc field
        const descNode = astNode.children.find(child => child.key === 'desc');
        if (descNode && descNode.value) {
            return `Desc: ${descNode.value}`;
        }

        // For variables, show the value
        if (astNode.key === 'set_variable' || astNode.key === 'change_variable') {
            const nameNode = astNode.children.find(child => child.key === 'name');
            const valueNode = astNode.children.find(child => child.key === 'value');
            
            if (nameNode && valueNode) {
                return `${nameNode.value} = ${valueNode.value}`;
            }
        }

        return undefined;
    }

    /**
     * Calculate selection range (the identifier part only)
     */
    private calculateSelectionRange(astNode: ASTNode): any {
        // For now, use the same as range
        // In a more advanced implementation, we'd track just the key position
        return astNode.range;
    }

    /**
     * Sort symbols by category and then by name
     */
    private sortSymbolsByCategory(symbols: DocumentSymbol[]): DocumentSymbol[] {
        const kindOrder: Record<SymbolKind, number> = {
            [SymbolKind.Event]: 1,
            [SymbolKind.Class]: 2,
            [SymbolKind.Interface]: 3,
            [SymbolKind.Namespace]: 4,
            [SymbolKind.Function]: 5,
            [SymbolKind.Method]: 6,
            [SymbolKind.Struct]: 7,
            [SymbolKind.Variable]: 8,
            [SymbolKind.Property]: 9,
            [SymbolKind.File]: 10,
            [SymbolKind.Module]: 11,
            [SymbolKind.Package]: 12,
            [SymbolKind.Field]: 13,
            [SymbolKind.Constructor]: 14,
            [SymbolKind.Enum]: 15,
            [SymbolKind.EnumMember]: 16,
            [SymbolKind.Constant]: 17,
            [SymbolKind.String]: 18,
            [SymbolKind.Number]: 19,
            [SymbolKind.Boolean]: 20,
            [SymbolKind.Array]: 21,
            [SymbolKind.Object]: 22,
            [SymbolKind.Key]: 23,
            [SymbolKind.Null]: 24,
            [SymbolKind.TypeParameter]: 25,
            [SymbolKind.Operator]: 26,
        };

        return symbols.sort((a, b) => {
            const kindDiff = (kindOrder[a.kind] || 999) - (kindOrder[b.kind] || 999);
            if (kindDiff !== 0) return kindDiff;
            
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Create fuzzy matcher function
     */
    private createFuzzyMatcher(pattern: string): (text: string) => number {
        return (text: string): number => {
            let patternIdx = 0;
            let textIdx = 0;
            let matchScore = 0;
            let consecutiveMatches = 0;

            while (patternIdx < pattern.length && textIdx < text.length) {
                if (pattern[patternIdx] === text[textIdx]) {
                    matchScore += 1 + consecutiveMatches;
                    consecutiveMatches++;
                    patternIdx++;
                } else {
                    consecutiveMatches = 0;
                }
                textIdx++;
            }

            // Did we match all pattern characters?
            if (patternIdx < pattern.length) {
                return 0;
            }

            return matchScore;
        };
    }

    /**
     * Get all symbols from indexer
     */
    private getAllIndexedSymbols(): Symbol[] {
        const allSymbols: Symbol[] = [];
        
        // Get symbols by each type
        const symbolTypes = [
            SymbolType.EVENT,
            SymbolType.DECISION,
            SymbolType.CHARACTER_INTERACTION,
            SymbolType.ON_ACTION,
            SymbolType.SCRIPTED_EFFECT,
            SymbolType.SCRIPTED_TRIGGER,
            SymbolType.STORY_CYCLE,
            SymbolType.TRAIT,
            SymbolType.ACTIVITY,
            SymbolType.SCHEME,
        ];

        for (const symbolType of symbolTypes) {
            const typeSymbols = this.symbolIndexer.findSymbolsByType(symbolType);
            allSymbols.push(...typeSymbols);
        }

        return allSymbols;
    }

    /**
     * Convert internal Symbol to WorkspaceSymbol
     */
    private convertToWorkspaceSymbol(sym: Symbol): WorkspaceSymbol {
        const wsSymbol: WorkspaceSymbol = {
            name: sym.name,
            kind: this.symbolTypeToKind(sym.type),
            location: {
                uri: sym.uri
            }
        };

        if (sym.detail) {
            wsSymbol.containerName = sym.detail;
        }

        return wsSymbol;
    }

    /**
     * Map SymbolType to SymbolKind
     */
    private symbolTypeToKind(symType: SymbolType): SymbolKind {
        const typeMapping: Record<SymbolType, SymbolKind> = {
            [SymbolType.EVENT]: SymbolKind.Event,
            [SymbolType.DECISION]: SymbolKind.Class,
            [SymbolType.CHARACTER_INTERACTION]: SymbolKind.Interface,
            [SymbolType.ON_ACTION]: SymbolKind.Event,
            [SymbolType.SCRIPTED_EFFECT]: SymbolKind.Function,
            [SymbolType.SCRIPTED_TRIGGER]: SymbolKind.Method,
            [SymbolType.SCRIPT_VALUE]: SymbolKind.Constant,
            [SymbolType.TRAIT]: SymbolKind.EnumMember,
            [SymbolType.CULTURE]: SymbolKind.EnumMember,
            [SymbolType.RELIGION]: SymbolKind.EnumMember,
            [SymbolType.TITLE]: SymbolKind.String,
            [SymbolType.MODIFIER]: SymbolKind.Field,
            [SymbolType.VARIABLE]: SymbolKind.Variable,
            [SymbolType.SCOPE]: SymbolKind.Variable,
            [SymbolType.NAMESPACE]: SymbolKind.Namespace,
            [SymbolType.STORY_CYCLE]: SymbolKind.Namespace,
            [SymbolType.ACTIVITY]: SymbolKind.Class,
            [SymbolType.SCHEME]: SymbolKind.Class,
            [SymbolType.GENERIC]: SymbolKind.Object,
        };

        return typeMapping[symType] || SymbolKind.Object;
    }

    /**
     * Create a category container symbol
     */
    private createCategoryContainer(title: string, children: DocumentSymbol[]): DocumentSymbol {
        // Calculate range from children
        const firstChild = children[0];
        const lastChild = children[children.length - 1];

        return {
            name: `${title} (${children.length})`,
            kind: SymbolKind.Module,
            range: {
                start: firstChild.range.start,
                end: lastChild.range.end
            },
            selectionRange: {
                start: firstChild.range.start,
                end: firstChild.range.start
            },
            children
        };
    }
}
