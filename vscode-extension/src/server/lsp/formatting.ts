/**
 * Formatting Provider - Provides document and range formatting
 */

import {
    TextEdit,
    FormattingOptions,
    Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Formatting Provider
 */
export class FormattingProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Format entire document
     */
    public async formatDocument(
        document: TextDocument,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        const parsed = this.parser.parse(document.getText());
        const formatted = this.formatAST(parsed.ast, options, 0);
        
        // Return a single edit that replaces the entire document
        return [{
            range: {
                start: { line: 0, character: 0 },
                end: document.positionAt(document.getText().length),
            },
            newText: formatted,
        }];
    }

    /**
     * Format a range of the document
     */
    public async formatRange(
        document: TextDocument,
        range: Range,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        // For simplicity, format the entire document
        // A more sophisticated implementation would format only the range
        return this.formatDocument(document, options);
    }

    /**
     * Format AST to text
     */
    private formatAST(node: ASTNode, options: FormattingOptions, indent: number): string {
        if (!node.children) {
            return '';
        }

        const indentStr = this.getIndent(indent, options);
        const lines: string[] = [];

        for (const child of node.children) {
            if (child.type === NodeType.COMMENT) {
                lines.push(indentStr + (child.value || ''));
            } else if (child.type === NodeType.ASSIGNMENT) {
                lines.push(indentStr + `${child.key} = ${child.value}`);
            } else if (child.type === NodeType.COMPARISON) {
                lines.push(indentStr + `${child.key} ${child.operator} ${child.value}`);
            } else if (child.type === NodeType.BLOCK) {
                lines.push(indentStr + `${child.key} = {`);
                if (child.children) {
                    const childText = this.formatAST(child, options, indent + 1);
                    if (childText) {
                        lines.push(childText);
                    }
                }
                lines.push(indentStr + '}');
            } else if (child.type === NodeType.LIST) {
                const values = child.children?.map(c => c.value).join(' ') || '';
                lines.push(indentStr + `${child.key} = { ${values} }`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Get indentation string
     */
    private getIndent(level: number, options: FormattingOptions): string {
        const unit = options.insertSpaces 
            ? ' '.repeat(options.tabSize)
            : '\t';
        return unit.repeat(level);
    }
}
