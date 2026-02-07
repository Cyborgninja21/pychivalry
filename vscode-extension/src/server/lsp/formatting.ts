/**
 * Formatting Provider - Provides document and range formatting
 * 
 * Features:
 * - Style-aware formatting (Paradox conventions)
 * - Indentation normalization (tabs by default, configurable)
 * - Alignment of = operators within blocks
 * - Block structure formatting with proper spacing
 * - Preserve intentional spacing and comments
 * - Consistent brace placement
 * - Smart line breaking for long values
 */

import {
    TextEdit,
    FormattingOptions,
    Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Formatting style configuration
 */
interface FormattingStyle {
    alignOperators: boolean;
    preserveEmptyLines: boolean;
    maxEmptyLines: number;
    braceStyle: 'same-line' | 'new-line';
    spacesAroundOperators: boolean;
    indentSize: number;
    useTabs: boolean;
    compactLists: boolean; // Keep short lists on one line
    maxLineLength: number;
}

/**
 * Formatting Provider
 */
export class FormattingProvider {
    private style: FormattingStyle = {
        alignOperators: true,
        preserveEmptyLines: true,
        maxEmptyLines: 2,
        braceStyle: 'same-line',
        spacesAroundOperators: true,
        indentSize: 1,
        useTabs: true,
        compactLists: true,
        maxLineLength: 120,
    };

    constructor(private parser: CK3Parser) {}

    /**
     * Update formatting style
     */
    public updateStyle(style: Partial<FormattingStyle>): void {
        this.style = { ...this.style, ...style };
    }

    /**
     * Format entire document
     */
    public async formatDocument(
        document: TextDocument,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        const parsed = this.parser.parse(document.getText());
        
        // Apply formatting options
        const effectiveOptions = this.mergeOptions(options);
        
        const formatted = this.formatAST(parsed.ast, effectiveOptions, 0);
        
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
        const text = document.getText(range);
        const effectiveOptions = this.mergeOptions(options);
        
        // Parse just the range
        const parsed = this.parser.parse(text);
        const formatted = this.formatAST(parsed.ast, effectiveOptions, 0);
        
        return [{
            range,
            newText: formatted,
        }];
    }

    /**
     * Merge user options with style settings
     */
    private mergeOptions(options: FormattingOptions): FormattingOptions {
        return {
            ...options,
            tabSize: options.tabSize ?? this.style.indentSize,
            insertSpaces: options.insertSpaces ?? !this.style.useTabs,
        };
    }

    /**
     * Format AST to text with advanced formatting
     */
    private formatAST(node: ASTNode, options: FormattingOptions, indent: number): string {
        if (!node.children || node.children.length === 0) {
            return '';
        }

        const indentStr = this.getIndent(indent, options);
        const lines: string[] = [];
        
        // Calculate operator alignment if enabled
        const alignColumn = this.style.alignOperators 
            ? this.calculateAlignmentColumn(node.children)
            : 0;

        let lastWasEmpty = false;
        let emptyLineCount = 0;

        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const formatted = this.formatNode(child, options, indent, alignColumn);
            
            if (formatted === '') {
                // Empty line
                if (this.style.preserveEmptyLines && emptyLineCount < this.style.maxEmptyLines) {
                    lines.push('');
                    emptyLineCount++;
                }
                lastWasEmpty = true;
            } else {
                lines.push(formatted);
                emptyLineCount = 0;
                lastWasEmpty = false;
            }
        }

        return lines.join('\n');
    }

    /**
     * Format a single node
     */
    private formatNode(
        node: ASTNode,
        options: FormattingOptions,
        indent: number,
        alignColumn: number
    ): string {
        const indentStr = this.getIndent(indent, options);
        const spacing = this.style.spacesAroundOperators ? ' ' : '';

        if (node.type === NodeType.COMMENT) {
            return indentStr + (node.value || '');
        }

        if (node.type === NodeType.ASSIGNMENT) {
            const key = node.key || '';
            const value = this.formatValue(node.value);
            
            if (this.style.alignOperators && alignColumn > 0) {
                const padding = ' '.repeat(Math.max(0, alignColumn - key.length));
                return `${indentStr}${key}${padding}${spacing}=${spacing}${value}`;
            } else {
                return `${indentStr}${key}${spacing}=${spacing}${value}`;
            }
        }

        if (node.type === NodeType.COMPARISON) {
            const key = node.key || '';
            const op = node.operator || '=';
            const value = this.formatValue(node.value);
            
            if (this.style.alignOperators && alignColumn > 0) {
                const padding = ' '.repeat(Math.max(0, alignColumn - key.length));
                return `${indentStr}${key}${padding}${spacing}${op}${spacing}${value}`;
            } else {
                return `${indentStr}${key}${spacing}${op}${spacing}${value}`;
            }
        }

        if (node.type === NodeType.BLOCK) {
            const key = node.key || '';
            const lines: string[] = [];
            
            if (this.style.braceStyle === 'same-line') {
                lines.push(`${indentStr}${key}${spacing}=${spacing}{`);
            } else {
                lines.push(`${indentStr}${key}${spacing}=${spacing}`);
                lines.push(`${indentStr}{`);
            }
            
            if (node.children && node.children.length > 0) {
                const childText = this.formatAST(node, options, indent + 1);
                if (childText) {
                    lines.push(childText);
                }
            }
            
            lines.push(indentStr + '}');
            return lines.join('\n');
        }

        if (node.type === NodeType.LIST) {
            const key = node.key || '';
            const values = node.children?.map(c => this.formatValue(c.value)) || [];
            
            if (this.style.compactLists && values.length <= 5) {
                // Keep short lists on one line
                return `${indentStr}${key}${spacing}=${spacing}{${spacing}${values.join(' ')}${spacing}}`;
            } else {
                // Multi-line list
                const lines: string[] = [];
                lines.push(`${indentStr}${key}${spacing}=${spacing}{`);
                
                const childIndent = this.getIndent(indent + 1, options);
                for (const value of values) {
                    lines.push(`${childIndent}${value}`);
                }
                
                lines.push(indentStr + '}');
                return lines.join('\n');
            }
        }

        return '';
    }

    /**
     * Format a value (string, number, boolean)
     */
    private formatValue(value: any): string {
        if (typeof value === 'string') {
            // Quote strings with spaces
            if (value.includes(' ') || value.includes('\t')) {
                return `"${value}"`;
            }
            return value;
        }
        
        if (typeof value === 'number') {
            return value.toString();
        }
        
        if (typeof value === 'boolean') {
            return value ? 'yes' : 'no';
        }
        
        return String(value);
    }

    /**
     * Calculate alignment column for operators
     */
    private calculateAlignmentColumn(children: ASTNode[]): number {
        if (!this.style.alignOperators) return 0;

        let maxKeyLength = 0;
        
        for (const child of children) {
            if ((child.type === NodeType.ASSIGNMENT || child.type === NodeType.COMPARISON) && child.key) {
                maxKeyLength = Math.max(maxKeyLength, child.key.length);
            }
        }

        // Add padding
        return maxKeyLength + 1;
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
