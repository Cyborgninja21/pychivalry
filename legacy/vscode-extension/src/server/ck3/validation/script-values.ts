/**
 * CK3 Script Values & Formulas Validation
 *
 * Validates script_value blocks: fixed numbers, ranges (min/max),
 * and formula values with arithmetic operations and conditionals.
 *
 * The checks run on the definitions inside a `script_values = { … }` block (as the
 * validator has always been wired; the definitions of a common/script_values file are
 * top-level keys and are not reached).
 *
 * DIAGNOSTIC CODES:
 *   VALUE-002 (error): a range whose minimum is above its maximum; the game prints
 *              "min value in range directive is larger than the max value" (catalogue
 *              min_value_in_range_directive_is_larger_than_the_max_value_un)
 *   VALUE-004 (information, convention): else_if after else, else_if without if, several else
 *   VALUE-005 (information, convention): arithmetic without an explicit value
 *   VALUE-006 (information, convention): round_to not positive
 *
 * Removed in 2.2: VALUE-001 (a fixed value naming something outside 11 hard-coded game values)
 * and VALUE-003 (a formula key outside 13 hard-coded operations): both judged script against
 * hand-made name lists (a script value may name any script value, and a formula may hold
 * limits, iterators and saved values); the engine's registry check judges every key against
 * the spec package.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode, NodeType } from 'pychivalry-engine';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ScriptValuesConfig {
    enabled: boolean;
    checkRanges: boolean;
    checkFormulas: boolean;
    checkConditionals: boolean;
}

export const DEFAULT_SCRIPT_VALUES_CONFIG: ScriptValuesConfig = {
    enabled: true,
    checkRanges: true,
    checkFormulas: true,
    checkConditionals: true,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid formula operations */
const FORMULA_OPERATIONS = new Set([
    // Base value
    'value',
    // Arithmetic
    'add',
    'subtract',
    'multiply',
    'divide',
    'modulo',
    // Constraints
    'min',
    'max',
    // Rounding
    'round',
    'round_to',
    'ceiling',
    'floor',
]);

/** Conditional keywords in formulas */
const CONDITIONAL_KEYWORDS = new Set(['if', 'else_if', 'else']);

/** Arithmetic operations that typically require a base value */
const ARITHMETIC_OPS = new Set(['add', 'subtract', 'multiply', 'divide', 'modulo']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNumber(v: string | number | boolean | undefined): boolean {
    if (v === undefined) {
        return false;
    }
    if (typeof v === 'number') {
        return true;
    }
    if (typeof v === 'string') {
        const n = Number(v);
        return !isNaN(n) && v.trim() !== '';
    }
    return false;
}

function toNumber(v: string | number | boolean | undefined): number {
    if (typeof v === 'number') {
        return v;
    }
    return Number(v);
}

/**
 * Detect whether an AST BLOCK node looks like a script_value definition.
 * Script values live under a `script_values` top-level block, or can be
 * used inline in many contexts (ai_will_do, etc.).
 */
function isScriptValueContext(node: ASTNode): boolean {
    // Direct children of a block whose key is "script_values"
    return node.key === 'script_values';
}

// ---------------------------------------------------------------------------
// Validation entry point
// ---------------------------------------------------------------------------

/**
 * Validate script value definitions within the AST.
 */
export function validateScriptValues(root: ASTNode, config: ScriptValuesConfig): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForScriptValues(root, config, diagnostics);
    return diagnostics;
}

function walkForScriptValues(node: ASTNode, config: ScriptValuesConfig, out: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    if (isScriptValueContext(node)) {
        // Each child is an individual script_value definition
        for (const child of node.children) {
            validateSingleScriptValue(child, config, out);
        }
    }

    // Recurse to find nested script_values blocks
    for (const child of node.children) {
        walkForScriptValues(child, config, out);
    }
}

function validateSingleScriptValue(
    node: ASTNode,
    config: ScriptValuesConfig,
    out: Diagnostic[]
): void {
    if (node.type === NodeType.COMMENT) {
        return;
    }

    // A fixed value (key = <number> or a reference) has nothing to check here.
    if (node.type === NodeType.ASSIGNMENT) {
        return;
    }

    // --- Block value: key = { ... } ---
    if (node.type === NodeType.BLOCK && node.children) {
        const childKeys = node.children
            .filter((c) => c.type !== NodeType.COMMENT)
            .map((c) => c.key)
            .filter((k): k is string => k !== undefined);

        // Detect range: block with min and max keys
        const hasMin = childKeys.includes('min');
        const hasMax = childKeys.includes('max');
        if (hasMin && hasMax && config.checkRanges) {
            validateRange(node, out);
            return;
        }

        // Detect formula: block containing formula operations
        const hasFormulaOp = childKeys.some((k) => FORMULA_OPERATIONS.has(k));
        const hasConditional = childKeys.some((k) => CONDITIONAL_KEYWORDS.has(k));

        if (hasFormulaOp && config.checkFormulas) {
            validateFormula(node, out);
        }

        if (hasConditional && config.checkConditionals) {
            validateConditionals(node, out);
        }

        // If block has no recognised operations at all
        if (!hasFormulaOp && !hasConditional && !hasMin && !hasMax) {
            // Could be a list-style range { 50 100 } — represented as VALUE children
            const valueChildren = node.children.filter((c) => c.type === NodeType.VALUE);
            if (valueChildren.length === 2 && config.checkRanges) {
                const v0 = valueChildren[0].value;
                const v1 = valueChildren[1].value;
                if (isNumber(v0) && isNumber(v1)) {
                    const minVal = toNumber(v0);
                    const maxVal = toNumber(v1);
                    if (minVal > maxVal) {
                        out.push({
                            severity: DiagnosticSeverity.Error,
                            range: node.range,
                            message: `Range minimum (${minVal}) cannot be greater than maximum (${maxVal})`,
                            code: 'VALUE-002',
                            source: 'ck3-values',
                        });
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Range validation
// ---------------------------------------------------------------------------

function validateRange(node: ASTNode, out: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    const minNode = node.children.find((c) => c.key === 'min');
    const maxNode = node.children.find((c) => c.key === 'max');

    if (!minNode || !maxNode) {
        return;
    }

    const minVal = minNode.value;
    const maxVal = maxNode.value;

    if (minVal !== undefined && maxVal !== undefined && isNumber(minVal) && isNumber(maxVal)) {
        const mn = toNumber(minVal);
        const mx = toNumber(maxVal);
        if (mn > mx) {
            out.push({
                severity: DiagnosticSeverity.Error,
                range: node.range,
                message: `Range minimum (${mn}) cannot be greater than maximum (${mx})`,
                code: 'VALUE-002',
                source: 'ck3-values',
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Formula validation
// ---------------------------------------------------------------------------

function validateFormula(node: ASTNode, out: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    let hasValueKey = false;
    let hasArithmeticOp = false;

    for (const child of node.children) {
        if (child.type === NodeType.COMMENT) {
            continue;
        }
        const key = child.key;
        if (!key) {
            continue;
        }

        if (key === 'value') {
            hasValueKey = true;
            continue;
        }

        if (ARITHMETIC_OPS.has(key)) {
            hasArithmeticOp = true;
        }

        // round_to must be positive
        if (key === 'round_to') {
            if (child.value !== undefined && isNumber(child.value)) {
                const v = toNumber(child.value);
                if (v <= 0) {
                    out.push({
                        severity: DiagnosticSeverity.Information,
                        range: child.range,
                        message: `Convention: round_to should be a positive number (got ${v})`,
                        code: 'VALUE-006',
                        source: 'ck3-values',
                    });
                }
            }
        }
    }

    // Warn if arithmetic ops are used without an explicit value
    if (hasArithmeticOp && !hasValueKey) {
        out.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: 'Convention: arithmetic without an explicit value; the formula starts from 0',
            code: 'VALUE-005',
            source: 'ck3-values',
        });
    }
}

// ---------------------------------------------------------------------------
// Conditional validation
// ---------------------------------------------------------------------------

function validateConditionals(node: ASTNode, out: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    let hasIf = false;
    let hasElse = false;

    for (const child of node.children) {
        if (child.type === NodeType.COMMENT) {
            continue;
        }
        const key = child.key;
        if (!key) {
            continue;
        }

        if (key === 'if') {
            hasIf = true;
        } else if (key === 'else_if') {
            if (hasElse) {
                out.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: 'Convention: else_if after else',
                    code: 'VALUE-004',
                    source: 'ck3-values',
                });
            }
            if (!hasIf) {
                out.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: 'Convention: else_if without a preceding if',
                    code: 'VALUE-004',
                    source: 'ck3-values',
                });
            }
        } else if (key === 'else') {
            if (hasElse) {
                out.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: 'Convention: several else blocks',
                    code: 'VALUE-004',
                    source: 'ck3-values',
                });
            }
            hasElse = true;
        }
    }
}
