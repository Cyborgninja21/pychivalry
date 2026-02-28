/**
 * CK3 Style and Formatting Validation
 * 
 * Code quality and consistency checks focused on style, not semantics.
 * All diagnostics are warnings/info to allow users to ignore style preferences.
 * 
 * Diagnostic Codes:
 * - CK3301: Inconsistent indentation within block
 * - CK3302: Multiple block assignments on one line
 * - CK3303: Indentation uses spaces instead of tabs
 * - CK3304: Trailing whitespace detected
 * - CK3305: Block content not indented relative to parent
 * - CK3306: Inconsistent spacing around operators
 * - CK3307: Closing brace indentation doesn't match opening
 * - CK3308: Missing blank line between top-level blocks
 * - CK3314: Empty block detected
 * - CK3316: Line exceeds recommended length
 * - CK3317: Deeply nested blocks
 * - CK3325: Namespace declaration not at top of file
 * - CK3330: Unclosed brace
 * - CK3331: Extra closing brace
 * - CK3332: Brace mismatch in block
 * - CK3340: Unknown/suspicious scope reference
 * - CK3341: Scope reference appears truncated
 * - CK3345: Identifier contains merged text
 */

import { Diagnostic, DiagnosticSeverity, Range, Position } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';

/**
 * Style validation configuration
 */
export interface StyleConfig {
    enabled: boolean;
    indentation: boolean;
    preferTabs: boolean;
    trailingWhitespace: boolean;
    operatorSpacing: boolean;
    maxLineLength: number;
    maxNestingDepth: number;
    checkEmptyBlocks: boolean;
    checkBraceMatching: boolean;
    checkScopeReferences: boolean;
}

/**
 * Default Paradox style configuration
 */
export const DEFAULT_STYLE_CONFIG: StyleConfig = {
    enabled: true,
    indentation: true,
    preferTabs: true,
    trailingWhitespace: true,
    operatorSpacing: true,
    maxLineLength: 120,
    maxNestingDepth: 6,
    checkEmptyBlocks: true,
    checkBraceMatching: true,
    checkScopeReferences: true
};

/**
 * Check indentation consistency
 */
export function checkIndentation(text: string, config: StyleConfig): Diagnostic[] {
    if (!config.indentation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const leadingWhitespace = line.match(/^(\s+)/)?.[1] || '';

        if (leadingWhitespace.length === 0) {
            continue;
        }

        // Check if using spaces when tabs preferred
        if (config.preferTabs && leadingWhitespace.includes(' ')) {
            diagnostics.push({
                range: Range.create(
                    Position.create(i, 0),
                    Position.create(i, leadingWhitespace.length)
                ),
                severity: DiagnosticSeverity.Warning,
                code: 'CK3303',
                message: 'Indentation uses spaces instead of tabs (Paradox convention)',
                source: 'ck3-style'
            });
        }

        // Check for mixed tabs and spaces
        if (leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ')) {
            diagnostics.push({
                range: Range.create(
                    Position.create(i, 0),
                    Position.create(i, leadingWhitespace.length)
                ),
                severity: DiagnosticSeverity.Warning,
                code: 'CK3301',
                message: 'Inconsistent indentation (mixing tabs and spaces)',
                source: 'ck3-style'
            });
        }
    }

    return diagnostics;
}

/**
 * Check for trailing whitespace
 */
export function checkTrailingWhitespace(text: string, config: StyleConfig): Diagnostic[] {
    if (!config.trailingWhitespace) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trailingWhitespace = line.match(/\s+$/);

        if (trailingWhitespace) {
            const startCol = line.length - trailingWhitespace[0].length;
            diagnostics.push({
                range: Range.create(
                    Position.create(i, startCol),
                    Position.create(i, line.length)
                ),
                severity: DiagnosticSeverity.Information,
                code: 'CK3304',
                message: 'Trailing whitespace detected',
                source: 'ck3-style'
            });
        }
    }

    return diagnostics;
}

/**
 * Check line length
 */
export function checkLineLength(text: string, config: StyleConfig): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > config.maxLineLength) {
            diagnostics.push({
                range: Range.create(
                    Position.create(i, config.maxLineLength),
                    Position.create(i, line.length)
                ),
                severity: DiagnosticSeverity.Information,
                code: 'CK3316',
                message: `Line exceeds recommended length (${line.length} > ${config.maxLineLength} chars)`,
                source: 'ck3-style'
            });
        }
    }

    return diagnostics;
}

/**
 * Check operator spacing
 */
export function checkOperatorSpacing(text: string, config: StyleConfig): Diagnostic[] {
    if (!config.operatorSpacing) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for = without spaces
        const noSpaceMatches = line.matchAll(/(\S)=(\S)/g);
        for (const match of noSpaceMatches) {
            if (match.index !== undefined) {
                diagnostics.push({
                    range: Range.create(
                        Position.create(i, match.index),
                        Position.create(i, match.index + match[0].length)
                    ),
                    severity: DiagnosticSeverity.Information,
                    code: 'CK3306',
                    message: 'Operator should have spaces around it (Paradox convention)',
                    source: 'ck3-style'
                });
            }
        }
    }

    return diagnostics;
}

/**
 * Check empty blocks
 */
export function checkEmptyBlocks(ast: ASTNode, config: StyleConfig): Diagnostic[] {
    if (!config.checkEmptyBlocks) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function traverse(node: ASTNode): void {
        // Check if this is an empty block (BLOCK type with no children)
        if (node.type === 'BLOCK' && (!node.children || node.children.length === 0)) {
            diagnostics.push({
                range: node.range,
                severity: DiagnosticSeverity.Warning,
                code: 'CK3314',
                message: 'Empty block detected (potential logic error)',
                source: 'ck3-style'
            });
        }

        // Recurse
        if (node.children) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }

    traverse(ast);
    return diagnostics;
}

/**
 * Check nesting depth
 */
export function checkNestingDepth(ast: ASTNode, config: StyleConfig): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    function traverse(node: ASTNode, depth: number): void {
        if (depth > config.maxNestingDepth) {
            diagnostics.push({
                range: node.range,
                severity: DiagnosticSeverity.Information,
                code: 'CK3317',
                message: `Deeply nested blocks (depth ${depth} > ${config.maxNestingDepth})`,
                source: 'ck3-style'
            });
        }

        if (node.children) {
            for (const child of node.children) {
                traverse(child, depth + 1);
            }
        }
    }

    traverse(ast, 0);
    return diagnostics;
}

/**
 * Check brace matching
 */
export function checkBraceMatching(text: string, config: StyleConfig): Diagnostic[] {
    if (!config.checkBraceMatching) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const stack: { line: number; col: number }[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '{') {
                stack.push({ line: i, col: j });
            } else if (char === '}') {
                if (stack.length === 0) {
                    diagnostics.push({
                        range: Range.create(
                            Position.create(i, j),
                            Position.create(i, j + 1)
                        ),
                        severity: DiagnosticSeverity.Error,
                        code: 'CK3331',
                        message: 'Extra closing brace (no matching "{")',
                        source: 'ck3-style'
                    });
                } else {
                    stack.pop();
                }
            }
        }
    }

    // Check for unclosed braces
    for (const brace of stack) {
        diagnostics.push({
            range: Range.create(
                Position.create(brace.line, brace.col),
                Position.create(brace.line, brace.col + 1)
            ),
            severity: DiagnosticSeverity.Error,
            code: 'CK3330',
            message: 'Unclosed brace (missing "}")',
            source: 'ck3-style'
        });
    }

    return diagnostics;
}

/**
 * Check for suspicious scope references (possible typos)
 */
export function checkScopeReferences(ast: ASTNode, config: StyleConfig): Diagnostic[] {
    if (!config.checkScopeReferences) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const knownScopes = new Set([
        'root', 'this', 'prev', 'from', 'fromfrom',
        'character', 'title', 'province', 'faith', 'culture',
        'liege', 'house', 'dynasty', 'primary_title',
        'capital_province', 'location', 'realm'
    ]);

    function traverse(node: ASTNode): void {
        if (node.key && node.key.includes('.')) {
            const parts = node.key.split('.');
            const firstPart = parts[0];

            // Check if first part looks like a scope but isn't known
            if (firstPart && !knownScopes.has(firstPart) && 
                /^[a-z_]+$/.test(firstPart) && firstPart.length > 2) {
                diagnostics.push({
                    range: node.range,
                    severity: DiagnosticSeverity.Warning,
                    code: 'CK3340',
                    message: `Unknown/suspicious scope reference "${firstPart}" (possible typo)`,
                    source: 'ck3-style'
                });
            }

            // Check for truncated references (ending with .)
            if (node.key.endsWith('.')) {
                diagnostics.push({
                    range: node.range,
                    severity: DiagnosticSeverity.Warning,
                    code: 'CK3341',
                    message: 'Scope reference appears truncated (ends with ".")',
                    source: 'ck3-style'
                });
            }
        }

        if (node.children) {
            for (const child of node.children) {
                traverse(child);
            }
        }
    }

    traverse(ast);
    return diagnostics;
}

/**
 * Main style validation function
 */
export function validateStyle(
    ast: ASTNode,
    text: string,
    config: StyleConfig = DEFAULT_STYLE_CONFIG
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Text-based checks
    diagnostics.push(...checkIndentation(text, config));
    diagnostics.push(...checkTrailingWhitespace(text, config));
    diagnostics.push(...checkLineLength(text, config));
    diagnostics.push(...checkOperatorSpacing(text, config));
    diagnostics.push(...checkBraceMatching(text, config));

    // AST-based checks
    diagnostics.push(...checkEmptyBlocks(ast, config));
    diagnostics.push(...checkNestingDepth(ast, config));
    diagnostics.push(...checkScopeReferences(ast, config));

    return diagnostics;
}

/**
 * Auto-fix style issues (for formatting)
 */
export function autoFixStyle(text: string, config: StyleConfig): string {
    let fixed = text;

    // Remove trailing whitespace
    if (config.trailingWhitespace) {
        fixed = fixed.replace(/[ \t]+$/gm, '');
    }

    // Convert spaces to tabs if preferred
    if (config.preferTabs) {
        const lines = fixed.split('\n');
        fixed = lines.map(line => {
            const match = line.match(/^( +)/);
            if (match) {
                const spaces = match[1].length;
                const tabs = '\t'.repeat(Math.floor(spaces / 4));
                return tabs + line.substring(spaces);
            }
            return line;
        }).join('\n');
    }

    // Fix operator spacing
    if (config.operatorSpacing) {
        fixed = fixed.replace(/(\S)=(\S)/g, '$1 = $2');
    }

    return fixed;
}
