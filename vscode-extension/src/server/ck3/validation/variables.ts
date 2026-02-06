/**
 * Variables Validation Module
 * 
 * Validates variable usage in CK3 scripts:
 * - Variable declarations (set_variable, set_local_variable, etc.)
 * - Variable references
 * - Variable scope validity
 * - Variable type consistency
 * 
 * Diagnostic Codes:
 * - CK3700: Variable used before declaration
 * - CK3701: Variable never declared but used
 * - CK3702: Variable declared but never used
 * - CK3703: Variable scope mismatch
 * - CK3704: Invalid variable name
 * - CK3705: Variable type mismatch
 * - CK3706: Variable value out of range
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';

export interface VariableInfo {
    name: string;
    scope: string;
    declarationNode: ASTNode;
    usageNodes: ASTNode[];
    type?: 'flag' | 'value' | 'list';
    value?: any;
}

export interface VariablesConfig {
    /** Enable variable validation */
    enabled: boolean;
    /** Check for unused variables */
    checkUnused: boolean;
    /** Check for undeclared variables */
    checkUndeclared: boolean;
    /** Check variable scope validity */
    checkScope: boolean;
    /** Check variable type consistency */
    checkTypes: boolean;
}

/**
 * Variable declaration effects
 */
const VARIABLE_DECLARATIONS = [
    'set_variable',
    'set_local_variable',
    'set_global_variable',
    'change_variable',
    'add_to_variable',
    'subtract_from_variable',
    'multiply_variable',
    'divide_variable'
];

/**
 * Variable usage triggers
 */
const VARIABLE_CHECKS = [
    'has_variable',
    'has_local_variable',
    'has_global_variable',
    'variable_value',
    'check_variable'
];

/**
 * Validate variables in a document
 */
export function validateVariables(
    node: ASTNode,
    config: VariablesConfig
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const variables = collectVariableInfo(node);

    // Check for usage before declaration
    if (config.checkUndeclared) {
        diagnostics.push(...checkUndeclaredVariables(variables));
    }

    // Check for unused variables
    if (config.checkUnused) {
        diagnostics.push(...checkUnusedVariables(variables));
    }

    // Check variable scope validity
    if (config.checkScope) {
        diagnostics.push(...checkVariableScopes(node, variables));
    }

    // Check variable types
    if (config.checkTypes) {
        diagnostics.push(...checkVariableTypes(variables));
    }

    return diagnostics;
}

/**
 * Collect all variable declarations and usages
 */
function collectVariableInfo(node: ASTNode): Map<string, VariableInfo> {
    const variables = new Map<string, VariableInfo>();

    function traverse(n: ASTNode, currentScope: string = 'root') {
        // Check for variable declarations
        if (VARIABLE_DECLARATIONS.includes(n.key || '')) {
            const varName = getVariableName(n);
            if (varName) {
                if (!variables.has(varName)) {
                    variables.set(varName, {
                        name: varName,
                        scope: currentScope,
                        declarationNode: n,
                        usageNodes: [],
                        type: inferVariableType(n)
                    });
                }
            }
        }

        // Check for variable usages
        if (VARIABLE_CHECKS.includes(n.key || '')) {
            const varName = getVariableName(n);
            if (varName) {
                if (!variables.has(varName)) {
                    // Usage before declaration
                    variables.set(varName, {
                        name: varName,
                        scope: currentScope,
                        declarationNode: n, // First usage
                        usageNodes: [n],
                        type: 'value'
                    });
                } else {
                    variables.get(varName)!.usageNodes.push(n);
                }
            }
        }

        // Track scope changes
        let newScope = currentScope;
        if (n.key === 'every_' || n.key?.startsWith('any_') || n.key?.startsWith('random_')) {
            newScope = n.key;
        }

        // Traverse children
        if (n.children) {
            n.children.forEach((child: ASTNode) => traverse(child, newScope));
        }
    }

    traverse(node);
    return variables;
}

/**
 * Get variable name from a node
 */
function getVariableName(node: ASTNode): string | null {
    // Direct value (e.g., set_variable = my_var)
    if (typeof node.value === 'string') {
        return node.value;
    }

    // Block form (e.g., set_variable = { name = my_var })
    if (node.children) {
        const nameNode = node.children.find((c: ASTNode) => c.key === 'name');
        if (nameNode && typeof nameNode.value === 'string') {
            return nameNode.value;
        }
    }

    return null;
}

/**
 * Infer variable type from declaration
 */
function inferVariableType(node: ASTNode): 'flag' | 'value' | 'list' {
    // Flags are typically set without values
    if (node.key === 'set_variable' && !node.children) {
        return 'flag';
    }

    // Check for value assignment
    if (node.children) {
        const valueNode = node.children.find((c: ASTNode) => c.key === 'value');
        if (valueNode) {
            if (Array.isArray(valueNode.value)) {
                return 'list';
            }
            return 'value';
        }
    }

    return 'value'; // Default
}

/**
 * Check for undeclared variables
 */
function checkUndeclaredVariables(
    variables: Map<string, VariableInfo>
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [name, info] of variables) {
        // Variable used but never declared with set_variable
        const isDeclared = VARIABLE_DECLARATIONS.includes(info.declarationNode.key || '');
        
        if (!isDeclared && info.usageNodes.length > 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: info.usageNodes[0].range,
                message: `Variable "${name}" used but never declared`,
                code: 'CK3701',
                source: 'ck3-lsp'
            });
        }
    }

    return diagnostics;
}

/**
 * Check for unused variables
 */
function checkUnusedVariables(
    variables: Map<string, VariableInfo>
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [name, info] of variables) {
        const isDeclared = VARIABLE_DECLARATIONS.includes(info.declarationNode.key || '');
        
        if (isDeclared && info.usageNodes.length === 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Hint,
                range: info.declarationNode.range,
                message: `Variable "${name}" declared but never used`,
                code: 'CK3702',
                source: 'ck3-lsp'
            });
        }
    }

    return diagnostics;
}

/**
 * Check variable scope validity
 */
function checkVariableScopes(
    rootNode: ASTNode,
    variables: Map<string, VariableInfo>
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for local vs global variable mismatches
    for (const [name, info] of variables) {
        const isLocal = info.declarationNode.key?.includes('local');
        const isGlobal = info.declarationNode.key?.includes('global');

        for (const usage of info.usageNodes) {
            const usageIsLocal = usage.key?.includes('local');
            const usageIsGlobal = usage.key?.includes('global');

            if (isLocal && usageIsGlobal) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: usage.range,
                    message: `Variable "${name}" is local but accessed as global`,
                    code: 'CK3703',
                    source: 'ck3-lsp'
                });
            } else if (isGlobal && usageIsLocal) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: usage.range,
                    message: `Variable "${name}" is global but accessed as local`,
                    code: 'CK3703',
                    source: 'ck3-lsp'
                });
            }
        }
    }

    return diagnostics;
}

/**
 * Check variable type consistency
 */
function checkVariableTypes(
    variables: Map<string, VariableInfo>
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const [name, info] of variables) {
        // Check if variable is used as different types
        const usedAsList = info.usageNodes.some(n => 
            n.key === 'any_in_list' || n.key === 'ordered_in_list'
        );
        const usedAsValue = info.usageNodes.some(n => 
            n.key === 'variable_value' || n.key?.includes('compare')
        );

        if (usedAsList && usedAsValue) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: info.declarationNode.range,
                message: `Variable "${name}" used as both list and value`,
                code: 'CK3705',
                source: 'ck3-lsp'
            });
        }
    }

    return diagnostics;
}

/**
 * Validate variable name format
 */
export function isValidVariableName(name: string): boolean {
    // Variable names should be alphanumeric with underscores
    // Should not start with a number
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return validPattern.test(name);
}

/**
 * Validate variable value range
 */
export function isValidVariableValue(value: any, type: 'flag' | 'value' | 'list'): boolean {
    if (type === 'flag') {
        // Flags are boolean
        return typeof value === 'boolean';
    } else if (type === 'value') {
        // Values should be numbers
        return typeof value === 'number' && !isNaN(value);
    } else if (type === 'list') {
        // Lists should be arrays
        return Array.isArray(value);
    }
    return false;
}

/**
 * Get variable diagnostic description
 */
export function getVariableDiagnosticDescription(code: string): string {
    const descriptions: Record<string, string> = {
        'CK3700': 'Variable used before declaration. Declare the variable with set_variable first.',
        'CK3701': 'Variable never declared but used. Use set_variable to create the variable.',
        'CK3702': 'Variable declared but never used. Consider removing this unused variable.',
        'CK3703': 'Variable scope mismatch. Local and global variables cannot be mixed.',
        'CK3704': 'Invalid variable name. Use alphanumeric characters and underscores only.',
        'CK3705': 'Variable type mismatch. A variable is used as both a list and a value.',
        'CK3706': 'Variable value out of range. Check the value constraints.'
    };

    return descriptions[code] || 'Variable validation error';
}

/**
 * Suggest variable name corrections
 */
export function suggestVariableName(name: string): string[] {
    const suggestions: string[] = [];

    // Convert to snake_case
    const snakeCase = name
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    
    if (snakeCase !== name) {
        suggestions.push(snakeCase);
    }

    // Remove invalid characters
    const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (cleaned !== name) {
        suggestions.push(cleaned);
    }

    return suggestions;
}
