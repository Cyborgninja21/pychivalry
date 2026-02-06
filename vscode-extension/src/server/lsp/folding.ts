/**
 * Folding Range Provider - Provides code folding ranges
 */

import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Folding Range Provider
 */
export class FoldingRangeProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide folding ranges
     */
    public async provideFoldingRanges(document: TextDocument): Promise<FoldingRange[]> {
        const parsed = this.parser.parse(document.getText());
        const ranges: FoldingRange[] = [];
        
        this.collectFoldingRanges(parsed.ast, ranges);
        
        return ranges;
    }

    /**
     * Collect folding ranges from AST
     */
    private collectFoldingRanges(node: ASTNode, ranges: FoldingRange[]): void {
        if (!node.children) return;

        for (const child of node.children) {
            if (child.type === NodeType.BLOCK || child.type === NodeType.LIST) {
                // Add folding range for this block
                if (child.range.start.line < child.range.end.line) {
                    ranges.push({
                        startLine: child.range.start.line,
                        endLine: child.range.end.line,
                        kind: FoldingRangeKind.Region,
                    });
                }
            }

            // Recurse into children
            if (child.children) {
                this.collectFoldingRanges(child, ranges);
            }
        }
    }
}
