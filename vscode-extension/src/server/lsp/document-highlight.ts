/**
 * Document Highlight Provider - Highlights all occurrences of a symbol
 */

import { DocumentHighlight, DocumentHighlightKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode } from '../core/parser';

/**
 * Document Highlight Provider
 */
export class DocumentHighlightProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide document highlights
     */
    public async provideDocumentHighlights(
        document: TextDocument,
        position: Position
    ): Promise<DocumentHighlight[]> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return [];

        const highlights: DocumentHighlight[] = [];
        const text = document.getText();
        const parsed = this.parser.parse(text);

        // Find all occurrences in the document
        this.findOccurrences(parsed.ast, word, highlights);

        return highlights;
    }

    /**
     * Find all occurrences of a word in the AST
     */
    private findOccurrences(node: ASTNode, word: string, highlights: DocumentHighlight[]): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (child.key === word) {
                highlights.push({
                    range: child.range,
                    kind: DocumentHighlightKind.Text,
                });
            }

            if (child.value === word) {
                highlights.push({
                    range: child.range,
                    kind: DocumentHighlightKind.Text,
                });
            }

            if (child.children) {
                this.findOccurrences(child, word, highlights);
            }
        }
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
