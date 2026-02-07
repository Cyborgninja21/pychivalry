/**
 * Document Highlight Provider - Highlights all occurrences of a symbol
 * 
 * Features:
 * - Highlight all occurrences of symbol under cursor
 * - Differentiate read/write highlights
 * - Scope-aware highlighting (only within relevant scope)
 * - Variable usage highlighting
 * - Smart symbol detection (handles scope:, var:, etc.)
 */

import { DocumentHighlight, DocumentHighlightKind, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Highlight context
 */
interface HighlightContext {
    word: string;
    isVariable: boolean;
    isScope: boolean;
    searchScope: 'document' | 'block';
}

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

        // Determine context
        const context = this.getHighlightContext(document, position, word);

        if (context.searchScope === 'block') {
            // Find containing block and search only within it
            const block = this.findContainingBlock(parsed.ast, position);
            if (block) {
                this.findOccurrences(block, context, highlights);
            }
        } else {
            // Search entire document
            this.findOccurrences(parsed.ast, context, highlights);
        }

        return highlights;
    }

    /**
     * Get highlight context
     */
    private getHighlightContext(
        document: TextDocument,
        position: Position,
        word: string
    ): HighlightContext {
        // Check if it's a variable reference
        if (word.startsWith('var:')) {
            return {
                word: word.substring(4),
                isVariable: true,
                isScope: false,
                searchScope: 'block',
            };
        }

        // Check if it's a scope reference
        if (word.startsWith('scope:')) {
            return {
                word: word.substring(6),
                isVariable: false,
                isScope: true,
                searchScope: 'document',
            };
        }

        // Check if cursor is on a variable assignment
        const parsed = this.parser.parse(document.getText());
        const node = this.findNodeAtPosition(parsed.ast, position);
        
        if (node && this.isVariableContext(node)) {
            return {
                word,
                isVariable: true,
                isScope: false,
                searchScope: 'block',
            };
        }

        // Default: document-wide search
        return {
            word,
            isVariable: false,
            isScope: false,
            searchScope: 'document',
        };
    }

    /**
     * Check if node is in a variable context
     */
    private isVariableContext(node: ASTNode): boolean {
        // Check if node is part of set_variable, change_variable, etc.
        if (!node.key) return false;

        const varKeys = [
            'set_variable',
            'change_variable',
            'remove_variable',
            'var',
            'variable',
        ];

        return varKeys.includes(node.key);
    }

    /**
     * Find all occurrences of a word in the AST
     */
    private findOccurrences(
        node: ASTNode,
        context: HighlightContext,
        highlights: DocumentHighlight[]
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Check key matches
            if (child.key === context.word) {
                const kind = this.getHighlightKind(child, context);
                highlights.push({
                    range: child.range,
                    kind,
                });
            }

            // Check value matches
            if (child.value === context.word) {
                const kind = this.getHighlightKind(child, context);
                highlights.push({
                    range: child.range,
                    kind,
                });
            }

            // Check scope/variable references
            if (typeof child.value === 'string') {
                if (context.isVariable && child.value === `var:${context.word}`) {
                    highlights.push({
                        range: child.range,
                        kind: DocumentHighlightKind.Read,
                    });
                } else if (context.isScope && child.value === `scope:${context.word}`) {
                    highlights.push({
                        range: child.range,
                        kind: DocumentHighlightKind.Read,
                    });
                } else if (child.value.includes(context.word)) {
                    // Partial match (e.g., in scope chains)
                    const parts = child.value.split('.');
                    if (parts.some(p => p === context.word)) {
                        highlights.push({
                            range: child.range,
                            kind: DocumentHighlightKind.Read,
                        });
                    }
                }
            }

            // Recurse
            if (child.children) {
                this.findOccurrences(child, context, highlights);
            }
        }
    }

    /**
     * Get highlight kind (read/write)
     */
    private getHighlightKind(node: ASTNode, context: HighlightContext): DocumentHighlightKind {
        // Determine if this is a read or write occurrence
        if (context.isVariable) {
            // Variable write operations
            if (node.key === 'set_variable' || node.key === 'change_variable') {
                return DocumentHighlightKind.Write;
            }
            
            // Check if within a variable setter
            if (this.isWithinVariableSetter(node)) {
                return DocumentHighlightKind.Write;
            }
            
            return DocumentHighlightKind.Read;
        }

        // For non-variables, check if it's being assigned to
        if (node.type === NodeType.ASSIGNMENT && node.key === context.word) {
            return DocumentHighlightKind.Write;
        }

        return DocumentHighlightKind.Text;
    }

    /**
     * Check if node is within a variable setter
     */
    private isWithinVariableSetter(node: ASTNode): boolean {
        // This is a simplified check - in a real implementation,
        // we would walk up the AST to find parent context
        return node.key === 'name' || node.key === 'value';
    }

    /**
     * Find containing block for a position
     */
    private findContainingBlock(node: ASTNode, position: Position): ASTNode | null {
        if (!node.children) return null;

        for (const child of node.children) {
            // Check if position is within this node
            if (
                (child.range.start.line < position.line ||
                    (child.range.start.line === position.line &&
                        child.range.start.character <= position.character)) &&
                (child.range.end.line > position.line ||
                    (child.range.end.line === position.line &&
                        child.range.end.character >= position.character))
            ) {
                // If it's a block, return it
                if (child.type === NodeType.BLOCK) {
                    // Check children first (find innermost block)
                    const innerBlock = this.findContainingBlock(child, position);
                    return innerBlock || child;
                }

                // Otherwise, recurse
                return this.findContainingBlock(child, position);
            }
        }

        return null;
    }

    /**
     * Find node at position
     */
    private findNodeAtPosition(node: ASTNode, position: Position): ASTNode | null {
        if (!node.children) return null;

        for (const child of node.children) {
            // Check if position is within this node's range
            if (
                (child.range.start.line < position.line ||
                    (child.range.start.line === position.line &&
                        child.range.start.character <= position.character)) &&
                (child.range.end.line > position.line ||
                    (child.range.end.line === position.line &&
                        child.range.end.character >= position.character))
            ) {
                // Check children first (find most specific node)
                if (child.children) {
                    const innerNode = this.findNodeAtPosition(child, position);
                    if (innerNode) return innerNode;
                }
                
                return child;
            }
        }

        return null;
    }

    /**
     * Get word at position
     */
    private getWordAtPosition(document: TextDocument, position: Position): string | null {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        let start = offset;
        let end = offset;
        
        // Include scope:, var:, flag: prefixes
        while (start > 0 && /[a-zA-Z0-9_.:@]/.test(text[start - 1])) {
            start--;
        }
        
        while (end < text.length && /[a-zA-Z0-9_.:@]/.test(text[end])) {
            end++;
        }
        
        if (start === end) return null;
        
        return text.substring(start, end);
    }
}
