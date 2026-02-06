/**
 * Document Symbol Provider - Provides document outline
 */

import { DocumentSymbol, SymbolKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Document Symbol Provider
 */
export class DocumentSymbolProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide document symbols
     */
    public async provideDocumentSymbols(document: TextDocument): Promise<DocumentSymbol[]> {
        const parsed = this.parser.parse(document.getText());
        const ast = parsed.ast;
        
        if (!ast.children) return [];
        
        return this.extractSymbols(ast.children);
    }

    /**
     * Extract symbols from AST nodes
     */
    private extractSymbols(nodes: ASTNode[]): DocumentSymbol[] {
        const symbols: DocumentSymbol[] = [];
        
        for (const node of nodes) {
            if (node.type === NodeType.BLOCK || node.type === NodeType.ASSIGNMENT) {
                if (!node.key) continue;
                
                const symbol: DocumentSymbol = {
                    name: node.key,
                    kind: this.getSymbolKind(node),
                    range: node.range,
                    selectionRange: node.range,
                };
                
                // Add children if it's a block
                if (node.children && node.children.length > 0) {
                    symbol.children = this.extractSymbols(node.children);
                }
                
                symbols.push(symbol);
            }
        }
        
        return symbols;
    }

    /**
     * Determine symbol kind from node
     */
    private getSymbolKind(node: ASTNode): SymbolKind {
        if (!node.key) return SymbolKind.Object;
        
        // Event - matches patterns like namespace.id or namespace.123
        if (/^\w+\.\w+$/.test(node.key)) {
            return SymbolKind.Event;
        }
        
        // Function-like
        if (node.type === NodeType.BLOCK) {
            return SymbolKind.Function;
        }
        
        // Property
        return SymbolKind.Property;
    }
}
