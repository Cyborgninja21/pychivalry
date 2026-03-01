/**
 * Selection Range Provider - Provides smart expand/shrink selection
 *
 * Enables AST-aware selection expansion (Shift+Alt+Right/Left in VS Code)
 * that understands CK3 script block structure. Selection expands through
 * meaningful levels: value -> assignment -> block content -> full block -> parent.
 */

import { SelectionRange, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode, NodeType } from '../core/parser';

/**
 * Selection Range Provider
 */
export class SelectionRangeProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide selection ranges for the given positions
     */
    public provideSelectionRanges(
        document: TextDocument,
        positions: Position[],
    ): SelectionRange[] {
        const text = document.getText();
        const parsed = this.parser.parse(text);

        return positions.map(pos => this.buildSelectionRange(parsed.ast, pos, text));
    }

    /**
     * Build a SelectionRange chain for a single position.
     * The chain goes from innermost (most specific) to outermost (ROOT).
     */
    private buildSelectionRange(root: ASTNode, position: Position, text: string): SelectionRange {
        // Collect ancestor path from root to innermost node containing position
        const path = this.collectAncestorPath(root, position);

        // Build expansion ranges from outermost to innermost
        const ranges: Range[] = [];

        for (let i = 0; i < path.length; i++) {
            const node = path[i];
            const isInnermost = i === path.length - 1;

            switch (node.type) {
                case NodeType.ROOT:
                    ranges.push(node.range);
                    break;

                case NodeType.BLOCK:
                case NodeType.LIST: {
                    // Full block range (key = { ... })
                    ranges.push(node.range);
                    // Inner content range (between braces)
                    const innerRange = this.getInnerBraceRange(node, text);
                    if (innerRange) {
                        ranges.push(innerRange);
                    }
                    break;
                }

                case NodeType.ASSIGNMENT:
                case NodeType.COMPARISON: {
                    // Full assignment range
                    ranges.push(node.range);
                    // Value-only range (if cursor is on the value side)
                    if (isInnermost) {
                        const valueRange = this.getValueRange(node, text);
                        if (valueRange && this.isCursorOnValue(node, position, text)) {
                            ranges.push(valueRange);
                        }
                    }
                    break;
                }

                case NodeType.VALUE:
                    ranges.push(node.range);
                    break;

                case NodeType.COMMENT:
                    ranges.push(node.range);
                    break;
            }
        }

        // Add consecutive comment grouping if the innermost node is a comment
        const innermost = path[path.length - 1];
        if (innermost && innermost.type === NodeType.COMMENT) {
            const parent = path.length >= 2 ? path[path.length - 2] : null;
            if (parent?.children) {
                const groupRange = this.getCommentGroupRange(innermost, parent.children);
                if (groupRange) {
                    // Insert after the comment's own range but before the parent
                    const commentRangeIdx = ranges.indexOf(innermost.range);
                    if (commentRangeIdx >= 0) {
                        ranges.splice(commentRangeIdx, 0, groupRange);
                    }
                }
            }
        }

        // Deduplicate and ensure strictly nesting order (innermost first)
        const deduplicated = this.deduplicateRanges(ranges.reverse());

        // Build linked list from innermost to outermost
        return this.buildChain(deduplicated);
    }

    /**
     * Collect the path from root to the innermost node containing position.
     * Returns array ordered [ROOT, ..., innermost].
     */
    private collectAncestorPath(node: ASTNode, position: Position): ASTNode[] {
        const path: ASTNode[] = [node];

        if (!node.children) return path;

        for (const child of node.children) {
            if (this.containsPosition(child.range, position)) {
                const childPath = this.collectAncestorPath(child, position);
                path.push(...childPath);
                break;
            }
        }

        return path;
    }

    /**
     * Check if a range contains a position (inclusive).
     */
    private containsPosition(range: Range, position: Position): boolean {
        if (position.line < range.start.line || position.line > range.end.line) {
            return false;
        }
        if (position.line === range.start.line && position.character < range.start.character) {
            return false;
        }
        if (position.line === range.end.line && position.character > range.end.character) {
            return false;
        }
        return true;
    }

    /**
     * Get the range of content between braces for a BLOCK or LIST node.
     * Excludes the braces themselves and any leading/trailing whitespace on brace lines.
     */
    private getInnerBraceRange(node: ASTNode, text: string): Range | null {
        const lines = text.split('\n');

        // Find opening brace position by scanning from node start
        let openLine = -1;
        let openChar = -1;
        for (let line = node.range.start.line; line <= node.range.end.line; line++) {
            const lineText = lines[line];
            const startChar = line === node.range.start.line ? node.range.start.character : 0;
            const braceIdx = lineText.indexOf('{', startChar);
            if (braceIdx !== -1) {
                openLine = line;
                openChar = braceIdx;
                break;
            }
        }

        // Find closing brace position by scanning from node end backwards
        let closeLine = -1;
        let closeChar = -1;
        for (let line = node.range.end.line; line >= node.range.start.line; line--) {
            const lineText = lines[line];
            const endChar = line === node.range.end.line ? node.range.end.character : lineText.length;
            const braceIdx = lineText.lastIndexOf('}', endChar);
            if (braceIdx !== -1) {
                closeLine = line;
                closeChar = braceIdx;
                break;
            }
        }

        if (openLine === -1 || closeLine === -1) return null;

        // Inner range starts after '{' and ends before '}'
        const innerStart: Position = { line: openLine, character: openChar + 1 };
        const innerEnd: Position = { line: closeLine, character: closeChar };

        // Don't return if inner range is empty or inverted
        if (innerStart.line > innerEnd.line ||
            (innerStart.line === innerEnd.line && innerStart.character >= innerEnd.character)) {
            return null;
        }

        return { start: innerStart, end: innerEnd };
    }

    /**
     * Get the range of just the value portion of an ASSIGNMENT or COMPARISON node.
     */
    private getValueRange(node: ASTNode, text: string): Range | null {
        if (node.value === undefined && node.value !== '') return null;

        const lines = text.split('\n');

        // Find the operator position on the node's line(s)
        for (let line = node.range.start.line; line <= node.range.end.line; line++) {
            const lineText = lines[line];
            const startChar = line === node.range.start.line ? node.range.start.character : 0;

            // Look for the operator (=, ==, !=, >=, <=, >, <, ?=)
            const operatorMatch = this.findOperator(lineText, startChar);
            if (operatorMatch) {
                // Value starts after operator + whitespace
                let valueStart = operatorMatch.end;
                while (valueStart < lineText.length && (lineText[valueStart] === ' ' || lineText[valueStart] === '\t')) {
                    valueStart++;
                }

                if (valueStart < lineText.length) {
                    return {
                        start: { line, character: valueStart },
                        end: node.range.end,
                    };
                }
            }
        }

        return null;
    }

    /**
     * Find operator position in a line of text.
     */
    private findOperator(lineText: string, startChar: number): { start: number; end: number } | null {
        for (let i = startChar; i < lineText.length; i++) {
            const ch = lineText[i];
            const next = i + 1 < lineText.length ? lineText[i + 1] : '';

            if (ch === '=' && next === '=') return { start: i, end: i + 2 };
            if (ch === '!' && next === '=') return { start: i, end: i + 2 };
            if (ch === '>' && next === '=') return { start: i, end: i + 2 };
            if (ch === '<' && next === '=') return { start: i, end: i + 2 };
            if (ch === '?' && next === '=') return { start: i, end: i + 2 };
            if (ch === '>' && next !== '=') return { start: i, end: i + 1 };
            if (ch === '<' && next !== '=') return { start: i, end: i + 1 };
            if (ch === '=' && next !== '=') return { start: i, end: i + 1 };
        }
        return null;
    }

    /**
     * Determine if the cursor is on the value side (right of operator) of an assignment.
     */
    private isCursorOnValue(node: ASTNode, position: Position, text: string): boolean {
        const lines = text.split('\n');

        for (let line = node.range.start.line; line <= node.range.end.line; line++) {
            const lineText = lines[line];
            const startChar = line === node.range.start.line ? node.range.start.character : 0;
            const op = this.findOperator(lineText, startChar);

            if (op) {
                // Cursor is on value side if it's on a line after the operator,
                // or on the same line and past the operator
                if (position.line > line) return true;
                if (position.line === line && position.character >= op.end) return true;
                return false;
            }
        }

        return false;
    }

    /**
     * Get the range covering a group of consecutive comment lines.
     * Returns null if the comment is not part of a group (only 1 comment).
     */
    private getCommentGroupRange(comment: ASTNode, siblings: ASTNode[]): Range | null {
        const commentIdx = siblings.indexOf(comment);
        if (commentIdx === -1) return null;

        // Find the start of the consecutive comment group
        let groupStart = commentIdx;
        while (groupStart > 0) {
            const prev = siblings[groupStart - 1];
            if (prev.type !== NodeType.COMMENT) break;
            // Must be on consecutive lines
            if (prev.range.end.line + 1 !== siblings[groupStart].range.start.line) break;
            groupStart--;
        }

        // Find the end of the consecutive comment group
        let groupEnd = commentIdx;
        while (groupEnd < siblings.length - 1) {
            const next = siblings[groupEnd + 1];
            if (next.type !== NodeType.COMMENT) break;
            if (siblings[groupEnd].range.end.line + 1 !== next.range.start.line) break;
            groupEnd++;
        }

        // Only create a group range if there are multiple consecutive comments
        if (groupStart === groupEnd) return null;

        return {
            start: siblings[groupStart].range.start,
            end: siblings[groupEnd].range.end,
        };
    }

    /**
     * Remove duplicate ranges and ensure strictly increasing containment.
     * Input should be ordered innermost-first.
     */
    private deduplicateRanges(ranges: Range[]): Range[] {
        if (ranges.length === 0) return [];

        const result: Range[] = [ranges[0]];

        for (let i = 1; i < ranges.length; i++) {
            const prev = result[result.length - 1];
            const curr = ranges[i];

            // Skip if same range
            if (this.rangesEqual(prev, curr)) continue;

            // Only include if strictly larger than previous
            if (this.rangeContains(curr, prev)) {
                result.push(curr);
            }
        }

        return result;
    }

    /**
     * Check if two ranges are equal.
     */
    private rangesEqual(a: Range, b: Range): boolean {
        return a.start.line === b.start.line &&
            a.start.character === b.start.character &&
            a.end.line === b.end.line &&
            a.end.character === b.end.character;
    }

    /**
     * Check if range `outer` strictly contains range `inner`.
     */
    private rangeContains(outer: Range, inner: Range): boolean {
        const startsBeforeOrAt =
            outer.start.line < inner.start.line ||
            (outer.start.line === inner.start.line && outer.start.character <= inner.start.character);
        const endsAfterOrAt =
            outer.end.line > inner.end.line ||
            (outer.end.line === inner.end.line && outer.end.character >= inner.end.character);

        return startsBeforeOrAt && endsAfterOrAt && !this.rangesEqual(outer, inner);
    }

    /**
     * Build a linked SelectionRange chain from an array of ranges (innermost first).
     */
    private buildChain(ranges: Range[]): SelectionRange {
        if (ranges.length === 0) {
            return { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
        }

        let current: SelectionRange = { range: ranges[ranges.length - 1] };

        for (let i = ranges.length - 2; i >= 0; i--) {
            current = { range: ranges[i], parent: current };
        }

        return current;
    }
}
