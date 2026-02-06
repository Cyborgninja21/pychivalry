/**
 * Rename Provider - Provides symbol renaming
 */

import {
    WorkspaceEdit,
    TextEdit,
    Position,
    Range,
    PrepareRenameParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';
import { DocumentIndexer } from '../core/indexer';

/**
 * Rename Provider
 */
export class RenameProvider {
    constructor(
        private parser: CK3Parser,
        private indexer: DocumentIndexer
    ) {}

    /**
     * Prepare rename - validate that the position can be renamed
     */
    public async prepareRename(
        document: TextDocument,
        position: Position
    ): Promise<Range | null> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return null;

        // Check if this word is a symbol that can be renamed
        const symbols = this.indexer.findSymbolsByName(word);
        if (symbols.length === 0) return null;

        // Return the range of the word
        const offset = document.offsetAt(position);
        const text = document.getText();
        
        let start = offset;
        let end = offset;
        
        while (start > 0 && /[a-zA-Z0-9_.]/.test(text[start - 1])) {
            start--;
        }
        
        while (end < text.length && /[a-zA-Z0-9_.]/.test(text[end])) {
            end++;
        }

        return {
            start: document.positionAt(start),
            end: document.positionAt(end),
        };
    }

    /**
     * Perform rename
     */
    public async provideRename(
        document: TextDocument,
        position: Position,
        newName: string
    ): Promise<WorkspaceEdit | null> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return null;

        // Find all occurrences of this symbol
        const symbols = this.indexer.findSymbolsByName(word);
        if (symbols.length === 0) return null;

        // Create workspace edit with all changes
        const changes: { [uri: string]: TextEdit[] } = {};

        for (const symbol of symbols) {
            if (!changes[symbol.uri]) {
                changes[symbol.uri] = [];
            }

            changes[symbol.uri].push({
                range: symbol.range,
                newText: newName,
            });
        }

        return { changes };
    }

    /**
     * Get word at position
     */
    private getWordAtPosition(document: TextDocument, position: Position): string | null {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        let start = offset;
        let end = offset;
        
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
