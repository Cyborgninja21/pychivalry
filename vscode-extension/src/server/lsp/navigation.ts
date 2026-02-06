/**
 * Navigation Provider - Provides go-to-definition and find-references
 */

import { Location, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { DocumentIndexer, Symbol } from '../core/indexer';

/**
 * Definition and References Provider
 */
export class DefinitionProvider {
    constructor(
        private parser: CK3Parser,
        private indexer: DocumentIndexer
    ) {}

    /**
     * Provide definition location
     */
    public async provideDefinition(document: TextDocument, position: Position): Promise<Location | null> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return null;
        
        // Find symbol definition
        const symbols = this.indexer.findSymbolsByName(word);
        if (symbols.length === 0) return null;
        
        // Return first definition (or we could return all)
        const symbol = symbols[0];
        return Location.create(symbol.uri, symbol.range);
    }

    /**
     * Provide all references
     */
    public async provideReferences(
        document: TextDocument,
        position: Position,
        context: { includeDeclaration: boolean }
    ): Promise<Location[]> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return [];
        
        // Find all references
        const symbols = this.indexer.findSymbolsByName(word);
        
        return symbols.map(symbol => Location.create(symbol.uri, symbol.range));
    }

    /**
     * Get word at position
     */
    private getWordAtPosition(document: TextDocument, position: Position): string | null {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        let start = offset;
        let end = offset;
        
        // Find word boundaries (including dots for namespaced events)
        while (start > 0 && /[a-zA-Z0-9_.]/.test(text[start - 1])) {
            start--;
        }
        
        while (end < text.length && /[a-zA-Z0-9_.]/.test(text[end])) {
            end++;
        }
        
        if (start === end) return null;
        
        return text.substring(start, end);
    }
}
