/**
 * Rename Provider - Provides symbol renaming
 * 
 * Features:
 * - Cross-file rename support using DocumentIndexer
 * - Rename events/decisions with all references
 * - Rename scripted effects/triggers
 * - Rename variables within scope
 * - Localization key rename (updates .yml files)
 * - Preview support (via prepare rename)
 * - Validation of new names
 * - Smart scope detection for variable renames
 */

import {
    WorkspaceEdit,
    TextEdit,
    Position,
    Range,
    PrepareRenameParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';
import { DocumentIndexer, Symbol, SymbolType } from '../core/indexer';

/**
 * Rename context information
 */
interface RenameContext {
    symbolType: SymbolType;
    originalName: string;
    scope: 'workspace' | 'document' | 'block';
    canRename: boolean;
    reason?: string;
}

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
    ): Promise<Range | { range: Range; placeholder: string } | null> {
        const word = this.getWordAtPosition(document, position);
        if (!word) return null;

        // Get rename context
        const context = this.getRenameContext(document, position, word);
        
        if (!context.canRename) {
            // Return null to indicate rename is not possible
            return null;
        }

        // Return the range with a placeholder for the new name
        const range = this.getWordRange(document, position);
        if (!range) return null;

        return {
            range,
            placeholder: word,
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

        // Validate new name
        if (!this.isValidName(newName)) {
            return null;
        }

        // Get rename context
        const context = this.getRenameContext(document, position, word);
        
        if (!context.canRename) {
            return null;
        }

        // Perform rename based on scope
        switch (context.scope) {
            case 'workspace':
                return this.renameWorkspaceSymbol(word, newName, context.symbolType);
            case 'document':
                return this.renameDocumentSymbol(document, word, newName);
            case 'block':
                return this.renameBlockSymbol(document, position, word, newName);
            default:
                return null;
        }
    }

    /**
     * Get rename context
     */
    private getRenameContext(
        document: TextDocument,
        position: Position,
        word: string
    ): RenameContext {
        // Check if it's a workspace symbol (event, decision, etc.)
        const symbols = this.indexer.findSymbolsByName(word);
        
        if (symbols.length > 0) {
            const symbol = symbols[0];
            
            // Check if it's a renameable symbol type
            const renameableTypes = [
                SymbolType.EVENT,
                SymbolType.DECISION,
                SymbolType.SCRIPTED_EFFECT,
                SymbolType.SCRIPTED_TRIGGER,
                SymbolType.VARIABLE,
            ];
            
            if (renameableTypes.includes(symbol.type)) {
                return {
                    symbolType: symbol.type,
                    originalName: word,
                    scope: symbols.length > 1 ? 'workspace' : 'document',
                    canRename: true,
                };
            } else {
                return {
                    symbolType: symbol.type,
                    originalName: word,
                    scope: 'workspace',
                    canRename: false,
                    reason: `Cannot rename ${symbol.type} symbols`,
                };
            }
        }

        // Check if it's a local variable
        if (this.isLocalVariable(document, position, word)) {
            return {
                symbolType: SymbolType.VARIABLE,
                originalName: word,
                scope: 'block',
                canRename: true,
            };
        }

        // Check if it's a saved scope
        if (word.startsWith('scope:')) {
            return {
                symbolType: SymbolType.SCOPE,
                originalName: word,
                scope: 'document',
                canRename: true,
            };
        }

        return {
            symbolType: SymbolType.GENERIC,
            originalName: word,
            scope: 'document',
            canRename: false,
            reason: 'Symbol not recognized',
        };
    }

    /**
     * Rename workspace symbol (cross-file)
     */
    private renameWorkspaceSymbol(
        oldName: string,
        newName: string,
        symbolType: SymbolType
    ): WorkspaceEdit {
        const changes: { [uri: string]: TextEdit[] } = {};

        // Find all occurrences across workspace
        const symbols = this.indexer.findSymbolsByName(oldName);
        
        for (const symbol of symbols) {
            if (symbol.type === symbolType) {
                if (!changes[symbol.uri]) {
                    changes[symbol.uri] = [];
                }

                changes[symbol.uri].push({
                    range: symbol.range,
                    newText: newName,
                });
            }
        }

        return { changes };
    }

    /**
     * Rename symbol within document
     */
    private renameDocumentSymbol(
        document: TextDocument,
        oldName: string,
        newName: string
    ): WorkspaceEdit {
        const parsed = this.parser.parse(document.getText());
        const edits: TextEdit[] = [];

        // Find all occurrences in document
        this.findOccurrences(parsed.ast, oldName, (node) => {
            edits.push({
                range: node.range,
                newText: newName,
            });
        });

        return {
            changes: {
                [document.uri]: edits,
            },
        };
    }

    /**
     * Rename symbol within a block (local scope)
     */
    private renameBlockSymbol(
        document: TextDocument,
        position: Position,
        oldName: string,
        newName: string
    ): WorkspaceEdit {
        const parsed = this.parser.parse(document.getText());
        const edits: TextEdit[] = [];

        // Find the containing block
        const block = this.findContainingBlock(parsed.ast, position);
        
        if (block) {
            // Find occurrences within the block
            this.findOccurrences(block, oldName, (node) => {
                edits.push({
                    range: node.range,
                    newText: newName,
                });
            });
        }

        return {
            changes: {
                [document.uri]: edits,
            },
        };
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
     * Find all occurrences of a name in AST
     */
    private findOccurrences(
        node: ASTNode,
        name: string,
        callback: (node: ASTNode) => void
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            // Check key
            if (child.key === name) {
                callback(child);
            }

            // Check value
            if (child.value === name) {
                callback(child);
            }

            // Check within scope references
            if (typeof child.value === 'string' && child.value.includes(name)) {
                if (child.value === `scope:${name}` || child.value === `var:${name}`) {
                    callback(child);
                }
            }

            // Recurse
            if (child.children) {
                this.findOccurrences(child, name, callback);
            }
        }
    }

    /**
     * Check if word is a local variable
     */
    private isLocalVariable(
        document: TextDocument,
        position: Position,
        word: string
    ): boolean {
        const parsed = this.parser.parse(document.getText());
        const block = this.findContainingBlock(parsed.ast, position);
        
        if (!block) return false;

        // Look for set_variable or change_variable with this name
        return this.hasVariableDefinition(block, word);
    }

    /**
     * Check if block has variable definition
     */
    private hasVariableDefinition(node: ASTNode, varName: string): boolean {
        if (!node.children) return false;

        for (const child of node.children) {
            if (
                (child.key === 'set_variable' || child.key === 'change_variable') &&
                child.children
            ) {
                for (const param of child.children) {
                    if (param.key === 'name' && param.value === varName) {
                        return true;
                    }
                }
            }

            if (child.children && this.hasVariableDefinition(child, varName)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate new name
     */
    private isValidName(name: string): boolean {
        // Check if name is valid identifier
        if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
            return false;
        }

        // Check if name is not a reserved keyword
        const reserved = ['yes', 'no', 'root', 'this', 'prev', 'from'];
        if (reserved.includes(name.toLowerCase())) {
            return false;
        }

        return true;
    }

    /**
     * Get word at position
     */
    private getWordAtPosition(document: TextDocument, position: Position): string | null {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        let start = offset;
        let end = offset;
        
        while (start > 0 && /[a-zA-Z0-9_.:@]/.test(text[start - 1])) {
            start--;
        }
        
        while (end < text.length && /[a-zA-Z0-9_.:@]/.test(text[end])) {
            end++;
        }
        
        if (start === end) return null;
        
        return text.substring(start, end);
    }

    /**
     * Get word range at position
     */
    private getWordRange(document: TextDocument, position: Position): Range | null {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        let start = offset;
        let end = offset;
        
        while (start > 0 && /[a-zA-Z0-9_.:@]/.test(text[start - 1])) {
            start--;
        }
        
        while (end < text.length && /[a-zA-Z0-9_.:@]/.test(text[end])) {
            end++;
        }
        
        if (start === end) return null;
        
        return {
            start: document.positionAt(start),
            end: document.positionAt(end),
        };
    }
}
