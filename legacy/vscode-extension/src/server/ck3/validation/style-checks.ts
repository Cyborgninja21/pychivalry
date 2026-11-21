/**
 * CK3 Style and Formatting Validation
 *
 * Code quality and consistency checks focused on style, not semantics. The game prints
 * nothing for any of them, so the style codes are hints (2.2 evidence audit); the brace
 * codes are information: the engine's parser reports an unbalanced brace with the game's
 * own message, these only point at the probable line.
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
 * Removed in 2.2: CK3340 (unknown or suspicious scope reference: the first segment was
 * judged against 17 hard-coded names; the engine's scope check reports an unknown chain
 * segment with the game's message, failed_to_parse_data_for_event_target_link_link_X_location_X,
 * and all 425 corpus findings were valid links) and CK3341 (truncated reference `root.`:
 * the engine's registry reports it as unknown_trigger_X / unknown_effect_X).
 * - CK3345: Identifier contains merged text
 */

import { Diagnostic, DiagnosticSeverity, Range, Position } from 'vscode-languageserver';
import { ASTNode } from 'pychivalry-engine';

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
                severity: DiagnosticSeverity.Hint,
                code: 'CK3303',
                message:
                    'Convention (style): indentation uses spaces instead of tabs (Paradox convention)',
                source: 'ck3-style',
            });
        }

        // Check for mixed tabs and spaces
        if (leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ')) {
            diagnostics.push({
                range: Range.create(
                    Position.create(i, 0),
                    Position.create(i, leadingWhitespace.length)
                ),
                severity: DiagnosticSeverity.Hint,
                code: 'CK3301',
                message: 'Convention (style): indentation mixes tabs and spaces',
                source: 'ck3-style',
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
                range: Range.create(Position.create(i, startCol), Position.create(i, line.length)),
                severity: DiagnosticSeverity.Hint,
                code: 'CK3304',
                message: 'Convention (style): trailing whitespace',
                source: 'ck3-style',
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
                severity: DiagnosticSeverity.Hint,
                code: 'CK3316',
                message: `Convention (style): line longer than ${config.maxLineLength} characters (${line.length})`,
                source: 'ck3-style',
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
                    severity: DiagnosticSeverity.Hint,
                    code: 'CK3306',
                    message:
                        'Convention (style): no spaces around the operator (Paradox convention)',
                    source: 'ck3-style',
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
                severity: DiagnosticSeverity.Hint,
                code: 'CK3314',
                message: 'Convention (style): empty block',
                source: 'ck3-style',
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
                severity: DiagnosticSeverity.Hint,
                code: 'CK3317',
                message: `Convention (style): blocks nested deeper than ${config.maxNestingDepth} (depth ${depth})`,
                source: 'ck3-style',
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
 *
 * Uses a stack-based approach to detect unmatched braces.
 * Skips braces inside comments (#) and quoted strings.
 *
 * When the file uses indentation (tabs/spaces), the checker segments the file
 * into independent top-level blocks by detecting non-indented definitions
 * (lines starting at column 0 with `identifier = `). Each segment is validated
 * independently so that a mismatch in one block can't cancel out a mismatch
 * in another.
 */
export function checkBraceMatching(text: string, config: StyleConfig): Diagnostic[] {
    if (!config.checkBraceMatching) {
        return [];
    }

    const lines = text.split('\n');

    // Determine whether the file uses indentation (tabs or 2+ spaces).
    // Real CK3 mod files always use indentation; if present, we segment
    // into independent top-level blocks so that a brace mismatch in one
    // block doesn't mask or cancel out a mismatch in another. Without
    // segmentation, a file with one block missing a '}' and another with
    // an extra '}' would show net-zero errors.
    //
    // When no indentation is detected (e.g. synthetic test data where all
    // lines start at column 0), segmentation can't reliably distinguish
    // top-level boundaries, so we fall back to a single-pass check.
    const hasIndentation = lines.some((l) => l.startsWith('\t') || l.startsWith('  '));

    if (!hasIndentation) {
        return checkBracesInRange(lines, 0, lines.length);
    }

    // Segment-based validation: find top-level boundaries.
    // A top-level boundary is a line starting at column 0 with an identifier
    // followed by '=' or '?=' — this pattern matches CK3 definition starts
    // like 'namespace = my_ns', 'my_event = { ... }', 'my_decision = { ... }'.
    // Each boundary starts a new independent segment for brace validation.
    const topLevelPattern = /^[a-zA-Z_@$][\w.:]*\s*[?]?=/;
    const boundaries: number[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip blank lines and comments
        if (line.trim() === '' || line.trimStart().startsWith('#')) {
            continue;
        }
        if (topLevelPattern.test(line)) {
            boundaries.push(i);
        }
    }

    if (boundaries.length === 0) {
        return checkBracesInRange(lines, 0, lines.length);
    }

    const diagnostics: Diagnostic[] = [];

    for (let b = 0; b < boundaries.length; b++) {
        const start = boundaries[b];
        const end = b + 1 < boundaries.length ? boundaries[b + 1] : lines.length;
        diagnostics.push(...checkBracesInRange(lines, start, end));
    }

    // Also check any content before the first boundary
    if (boundaries[0] > 0) {
        diagnostics.push(...checkBracesInRange(lines, 0, boundaries[0]));
    }

    return diagnostics;
}

/**
 * Validate brace matching within a contiguous range of lines [startLine, endLine).
 *
 * Uses a stack-based approach: opening braces push positions onto the stack,
 * closing braces pop from it. Extra closing braces (empty stack at '}') and
 * unclosed opening braces (non-empty stack at end) are reported as errors.
 *
 * Correctly handles:
 * - Comments: everything after an unquoted '#' is ignored
 * - Quoted strings: braces inside "..." are ignored
 * - Escape sequences: '\"' inside strings doesn't end the string
 *
 * @param lines - All lines of the file (indexed by line number)
 * @param startLine - First line of the segment (inclusive)
 * @param endLine - Last line of the segment (exclusive)
 * @returns Diagnostics for CK3330 (unclosed brace) and CK3331 (extra closing brace)
 */
function checkBracesInRange(lines: string[], startLine: number, endLine: number): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const stack: { line: number; col: number }[] = [];

    for (let i = startLine; i < endLine; i++) {
        const line = lines[i];
        let inString = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            // Skip comments — everything after an unquoted # is a comment
            if (char === '#' && !inString) {
                break;
            }

            // Track quoted strings so braces inside them are ignored
            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) {
                if (char === '\\' && j + 1 < line.length) {
                    j++;
                }
                continue;
            }

            if (char === '{') {
                stack.push({ line: i, col: j });
            } else if (char === '}') {
                if (stack.length === 0) {
                    diagnostics.push({
                        range: Range.create(Position.create(i, j), Position.create(i, j + 1)),
                        severity: DiagnosticSeverity.Information,
                        code: 'CK3331',
                        message:
                            'Convention: probable line of an extra closing brace (no matching "{" in this top-level block); the engine reports the parse error',
                        source: 'ck3-style',
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
            severity: DiagnosticSeverity.Information,
            code: 'CK3330',
            message:
                'Convention: probable line of an unclosed brace (no matching "}" in this top-level block); the engine reports the parse error',
            source: 'ck3-style',
        });
    }

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

    // Normalize CRLF to LF so text-based checks work identically on all platforms
    const normalizedText = text.replace(/\r\n/g, '\n');

    const diagnostics: Diagnostic[] = [];

    // Text-based checks
    diagnostics.push(...checkIndentation(normalizedText, config));
    diagnostics.push(...checkTrailingWhitespace(normalizedText, config));
    diagnostics.push(...checkLineLength(normalizedText, config));
    diagnostics.push(...checkOperatorSpacing(normalizedText, config));
    diagnostics.push(...checkBraceMatching(normalizedText, config));

    // AST-based checks
    diagnostics.push(...checkEmptyBlocks(ast, config));
    diagnostics.push(...checkNestingDepth(ast, config));

    return diagnostics;
}

/**
 * Auto-fix style issues (for formatting)
 */
export function autoFixStyle(text: string, config: StyleConfig): string {
    // Normalize CRLF to LF so replacements work identically on all platforms
    let fixed = text.replace(/\r\n/g, '\n');

    // Remove trailing whitespace
    if (config.trailingWhitespace) {
        fixed = fixed.replace(/[ \t]+$/gm, '');
    }

    // Convert spaces to tabs if preferred
    if (config.preferTabs) {
        const lines = fixed.split('\n');
        fixed = lines
            .map((line) => {
                const match = line.match(/^( +)/);
                if (match) {
                    const spaces = match[1].length;
                    const tabs = '\t'.repeat(Math.floor(spaces / 4));
                    return tabs + line.substring(spaces);
                }
                return line;
            })
            .join('\n');
    }

    // Fix operator spacing
    if (config.operatorSpacing) {
        fixed = fixed.replace(/(\S)=(\S)/g, '$1 = $2');
    }

    return fixed;
}
