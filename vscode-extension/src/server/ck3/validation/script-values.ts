/**
 * CK3 Script Values & Formulas Validation
 *
 * Validates script_value blocks: fixed numbers, ranges (min/max),
 * and formula values with arithmetic operations and conditionals.
 *
 * DIAGNOSTIC CODES:
 *   VALUE-001: Invalid script value type
 *   VALUE-002: Invalid range (min > max)
 *   VALUE-003: Unknown formula operation
 *   VALUE-004: Invalid conditional structure (else_if after else)
 *   VALUE-005: Missing value in arithmetic formula
 *   VALUE-006: Invalid round_to parameter (must be positive)
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode, NodeType } from '../../core/parser';

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
    'add', 'subtract', 'multiply', 'divide', 'modulo',
    // Constraints
    'min', 'max',
    // Rounding
    'round', 'round_to', 'ceiling', 'floor',
]);

/** Conditional keywords in formulas */
const CONDITIONAL_KEYWORDS = new Set(['if', 'else_if', 'else']);

/** Arithmetic operations that typically require a base value */
const ARITHMETIC_OPS = new Set(['add', 'subtract', 'multiply', 'divide', 'modulo']);

/** Common game value references that can appear as the value= target */
const COMMON_VALUE_REFERENCES = new Set([
    'gold', 'prestige', 'piety', 'age',
    'max_military_strength', 'realm_size',
    'num_of_vassals', 'num_of_powerful_vassals',
    'short_term_gold', 'monthly_character_income',
    'monthly_character_expenses',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNumber(v: string | number | boolean | undefined): boolean {
    if (v === undefined) return false;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
        const n = Number(v);
        return !isNaN(n) && v.trim() !== '';
    }
    return false;
}

function toNumber(v: string | number | boolean | undefined): number {
    if (typeof v === 'number') return v;
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
    if (!config.enabled) return [];

    const diagnostics: Diagnostic[] = [];
    walkForScriptValues(root, config, diagnostics);
    return diagnostics;
}

function walkForScriptValues(node: ASTNode, config: ScriptValuesConfig, out: Diagnostic[]): void {
    if (!node.children) return;

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

function validateSingleScriptValue(node: ASTNode, config: ScriptValuesConfig, out: Diagnostic[]): void {
    if (node.type === NodeType.COMMENT) return;

    // --- Fixed value: key = <number> or key = <reference> ---
    if (node.type === NodeType.ASSIGNMENT) {
        if (node.value !== undefined && typeof node.value === 'string'
            && !isNumber(node.value)
            && !COMMON_VALUE_REFERENCES.has(node.value)
            && !node.value.startsWith('scope:')
            && !node.value.startsWith('@')) {
            // VALUE-001: unrecognized script value reference
            out.push({
                severity: DiagnosticSeverity.Warning,
                range: node.range,
                message: `Unrecognized script value reference: '${node.value}'`,
                code: 'VALUE-001',
                source: 'ck3-values',
            });
        }
        return;
    }

    // --- Block value: key = { ... } ---
    if (node.type === NodeType.BLOCK && node.children) {
        const childKeys = node.children
            .filter(c => c.type !== NodeType.COMMENT)
            .map(c => c.key)
            .filter((k): k is string => k !== undefined);

        // Detect range: block with min and max keys
        const hasMin = childKeys.includes('min');
        const hasMax = childKeys.includes('max');
        if (hasMin && hasMax && config.checkRanges) {
            validateRange(node, out);
            return;
        }

        // Detect formula: block containing formula operations
        const hasFormulaOp = childKeys.some(k => FORMULA_OPERATIONS.has(k));
        const hasConditional = childKeys.some(k => CONDITIONAL_KEYWORDS.has(k));

        if (hasFormulaOp && config.checkFormulas) {
            validateFormula(node, out);
        }

        if (hasConditional && config.checkConditionals) {
            validateConditionals(node, out);
        }

        // If block has no recognised operations at all
        if (!hasFormulaOp && !hasConditional && !hasMin && !hasMax) {
            // Could be a list-style range { 50 100 } — represented as VALUE children
            const valueChildren = node.children.filter(c => c.type === NodeType.VALUE);
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
    if (!node.children) return;

    const minNode = node.children.find(c => c.key === 'min');
    const maxNode = node.children.find(c => c.key === 'max');

    if (!minNode || !maxNode) return;

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
    if (!node.children) return;

    let hasValueKey = false;
    let hasArithmeticOp = false;

    for (const child of node.children) {
        if (child.type === NodeType.COMMENT) continue;
        const key = child.key;
        if (!key) continue;

        if (key === 'value') {
            hasValueKey = true;
            continue;
        }

        // Check for unknown operations
        if (!FORMULA_OPERATIONS.has(key) && !CONDITIONAL_KEYWORDS.has(key)) {
            out.push({
                severity: DiagnosticSeverity.Warning,
                range: child.range,
                message: `Unknown formula operation: '${key}'`,
                code: 'VALUE-003',
                source: 'ck3-values',
            });
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
                        severity: DiagnosticSeverity.Error,
                        range: child.range,
                        message: `round_to parameter must be a positive number (got ${v})`,
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
            message: 'Formula uses arithmetic operations without an explicit value — implicit 0 will be used',
            code: 'VALUE-005',
            source: 'ck3-values',
        });
    }
}

// ---------------------------------------------------------------------------
// Conditional validation
// ---------------------------------------------------------------------------

function validateConditionals(node: ASTNode, out: Diagnostic[]): void {
    if (!node.children) return;

    let hasIf = false;
    let hasElse = false;

    for (const child of node.children) {
        if (child.type === NodeType.COMMENT) continue;
        const key = child.key;
        if (!key) continue;

        if (key === 'if') {
            hasIf = true;
        } else if (key === 'else_if') {
            if (hasElse) {
                out.push({
                    severity: DiagnosticSeverity.Error,
                    range: child.range,
                    message: 'else_if cannot follow else',
                    code: 'VALUE-004',
                    source: 'ck3-values',
                });
            }
            if (!hasIf) {
                out.push({
                    severity: DiagnosticSeverity.Error,
                    range: child.range,
                    message: 'else_if must follow an if block',
                    code: 'VALUE-004',
                    source: 'ck3-values',
                });
            }
        } else if (key === 'else') {
            if (hasElse) {
                out.push({
                    severity: DiagnosticSeverity.Error,
                    range: child.range,
                    message: 'Multiple else blocks are not allowed',
                    code: 'VALUE-004',
                    source: 'ck3-values',
                });
            }
            hasElse = true;
        }
    }
}
