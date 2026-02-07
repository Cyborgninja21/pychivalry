/**
 * Folding Range Provider - Provides code folding ranges
 * 
 * Features:
 * - Smart folding by block type (events, options, triggers, effects)
 * - Comment region folding
 * - Multi-line list folding
 * - Customizable folding strategies
 * - Metadata-based folding (e.g., fold event options, trigger blocks)
 */

import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Folding strategy configuration
 */
interface FoldingStrategy {
    foldBlocks: boolean;
    foldLists: boolean;
    foldComments: boolean;
    foldRegions: boolean;
    foldEventOptions: boolean;
    foldTriggerBlocks: boolean;
    foldEffectBlocks: boolean;
    minimumLines: number; // Minimum lines to create a fold
}

/**
 * Folding Range Provider
 */
export class FoldingRangeProvider {
    private strategy: FoldingStrategy = {
        foldBlocks: true,
        foldLists: true,
        foldComments: true,
        foldRegions: true,
        foldEventOptions: true,
        foldTriggerBlocks: true,
        foldEffectBlocks: true,
        minimumLines: 2,
    };

    constructor(private parser: CK3Parser) {}

    /**
     * Update folding strategy
     */
    public updateStrategy(strategy: Partial<FoldingStrategy>): void {
        this.strategy = { ...this.strategy, ...strategy };
    }

    /**
     * Provide folding ranges
     */
    public async provideFoldingRanges(document: TextDocument): Promise<FoldingRange[]> {
        const parsed = this.parser.parse(document.getText());
        const ranges: FoldingRange[] = [];
        
        // Collect folding ranges from AST
        this.collectFoldingRanges(parsed.ast, ranges);
        
        // Collect comment regions
        if (this.strategy.foldComments || this.strategy.foldRegions) {
            this.collectCommentFolds(document, ranges);
        }
        
        // Sort by start line
        ranges.sort((a, b) => a.startLine - b.startLine);
        
        return ranges;
    }

    /**
     * Collect folding ranges from AST
     */
    private collectFoldingRanges(node: ASTNode, ranges: FoldingRange[]): void {
        if (!node.children) return;

        for (const child of node.children) {
            const lineCount = child.range.end.line - child.range.start.line + 1;
            
            // Skip if below minimum line threshold
            if (lineCount < this.strategy.minimumLines) {
                if (child.children) {
                    this.collectFoldingRanges(child, ranges);
                }
                continue;
            }

            // Block folding
            if (this.strategy.foldBlocks && child.type === NodeType.BLOCK) {
                this.addBlockFold(child, ranges);
            }

            // List folding
            if (this.strategy.foldLists && child.type === NodeType.LIST) {
                this.addListFold(child, ranges);
            }

            // Event-specific folding
            if (this.strategy.foldEventOptions && this.isEventOption(child)) {
                this.addEventOptionFold(child, ranges);
            }

            // Trigger block folding
            if (this.strategy.foldTriggerBlocks && this.isTriggerBlock(child)) {
                this.addTriggerBlockFold(child, ranges);
            }

            // Effect block folding
            if (this.strategy.foldEffectBlocks && this.isEffectBlock(child)) {
                this.addEffectBlockFold(child, ranges);
            }

            // Recurse into children
            if (child.children) {
                this.collectFoldingRanges(child, ranges);
            }
        }
    }

    /**
     * Add block folding range
     */
    private addBlockFold(node: ASTNode, ranges: FoldingRange[]): void {
        ranges.push({
            startLine: node.range.start.line,
            endLine: node.range.end.line,
            kind: FoldingRangeKind.Region,
        });
    }

    /**
     * Add list folding range
     */
    private addListFold(node: ASTNode, ranges: FoldingRange[]): void {
        // Only fold multi-line lists
        if (node.range.end.line > node.range.start.line) {
            ranges.push({
                startLine: node.range.start.line,
                endLine: node.range.end.line,
                kind: FoldingRangeKind.Region,
            });
        }
    }

    /**
     * Add event option folding range
     */
    private addEventOptionFold(node: ASTNode, ranges: FoldingRange[]): void {
        ranges.push({
            startLine: node.range.start.line,
            endLine: node.range.end.line,
            kind: FoldingRangeKind.Region,
        });
    }

    /**
     * Add trigger block folding range
     */
    private addTriggerBlockFold(node: ASTNode, ranges: FoldingRange[]): void {
        ranges.push({
            startLine: node.range.start.line,
            endLine: node.range.end.line,
            kind: FoldingRangeKind.Region,
        });
    }

    /**
     * Add effect block folding range
     */
    private addEffectBlockFold(node: ASTNode, ranges: FoldingRange[]): void {
        ranges.push({
            startLine: node.range.start.line,
            endLine: node.range.end.line,
            kind: FoldingRangeKind.Region,
        });
    }

    /**
     * Check if node is an event option
     */
    private isEventOption(node: ASTNode): boolean {
        return node.type === NodeType.BLOCK && (
            node.key === 'option' ||
            node.key === 'immediate' ||
            node.key === 'after'
        );
    }

    /**
     * Check if node is a trigger block
     */
    private isTriggerBlock(node: ASTNode): boolean {
        if (node.type !== NodeType.BLOCK) return false;

        const triggerKeys = [
            'trigger',
            'limit',
            'potential',
            'allow',
            'is_valid',
            'is_shown',
            'is_valid_showing_failures_only',
            'ai_will_do',
            'ai_check_frequency',
        ];

        return node.key !== undefined && triggerKeys.includes(node.key);
    }

    /**
     * Check if node is an effect block
     */
    private isEffectBlock(node: ASTNode): boolean {
        if (node.type !== NodeType.BLOCK) return false;

        const effectKeys = [
            'effect',
            'immediate',
            'after',
            'on_start',
            'on_end',
            'on_success',
            'on_fail',
            'on_invalidated',
            'on_monthly',
            'on_yearly',
            'on_death',
        ];

        return node.key !== undefined && effectKeys.includes(node.key);
    }

    /**
     * Collect comment and region folding
     */
    private collectCommentFolds(document: TextDocument, ranges: FoldingRange[]): void {
        const text = document.getText();
        const lines = text.split('\n');
        
        let commentStart: number | null = null;
        let regionStart: number | null = null;
        let regionName: string | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Region markers
            if (this.strategy.foldRegions) {
                if (line.startsWith('#region') || line.startsWith('# region')) {
                    regionStart = i;
                    regionName = line.substring(line.indexOf('region') + 6).trim();
                } else if (line.startsWith('#endregion') || line.startsWith('# endregion')) {
                    if (regionStart !== null) {
                        ranges.push({
                            startLine: regionStart,
                            endLine: i,
                            kind: FoldingRangeKind.Region,
                        });
                        regionStart = null;
                        regionName = null;
                    }
                }
            }

            // Consecutive comment blocks
            if (this.strategy.foldComments) {
                if (line.startsWith('#')) {
                    if (commentStart === null) {
                        commentStart = i;
                    }
                } else if (commentStart !== null) {
                    // End of comment block
                    if (i - commentStart >= this.strategy.minimumLines) {
                        ranges.push({
                            startLine: commentStart,
                            endLine: i - 1,
                            kind: FoldingRangeKind.Comment,
                        });
                    }
                    commentStart = null;
                }
            }
        }

        // Handle comment block at end of file
        if (commentStart !== null && lines.length - commentStart >= this.strategy.minimumLines) {
            ranges.push({
                startLine: commentStart,
                endLine: lines.length - 1,
                kind: FoldingRangeKind.Comment,
            });
        }
    }
}
