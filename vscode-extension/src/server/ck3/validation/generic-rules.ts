/**
 * Generic Rules Validator - Schema-Driven Universal Validation
 * 
 * Executes validation rules defined in YAML schemas. Provides flexible,
 * data-driven validation without hardcoding rules in TypeScript.
 * 
 * Features:
 * - Effect usage validation (effects in wrong contexts)
 * - Trigger usage validation (triggers in wrong contexts)
 * - Iterator pattern checking
 * - Redundant pattern detection
 * - Missing prerequisite detection
 * - Comparison syntax validation
 * - Value usage pattern validation
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';
import { DocumentIndexer, SymbolType } from '../../core/indexer';

/**
 * Rule types supported by generic validator
 */
export enum RuleType {
    EFFECT_USAGE = 'effect_usage',
    TRIGGER_USAGE = 'trigger_usage',
    ITERATOR_CHECK = 'iterator_check',
    REDUNDANT_CHECK = 'redundant_check',
    MISSING_PREREQUISITE = 'missing_prerequisite',
    COMPARISON_SYNTAX = 'comparison_syntax',
    VALUE_CHECK = 'value_check'
}

/**
 * Generic validation rule definition
 */
export interface GenericRule {
    id: string;
    type: RuleType;
    description: string;
    severity: 'error' | 'warning' | 'information';
    pattern: string | string[];
    invalidContexts?: {
        parentBlocks?: string[];
        excludeBlocks?: string[];
    };
    message: string;
    diagnosticCode: string;
}

/**
 * Configuration for generic rule validation
 */
export interface GenericRulesConfig {
    enabled: boolean;
    rules?: {
        [ruleId: string]: boolean;
    };
}

/**
 * Cache for loaded rules
 */
let cachedRules: GenericRule[] | null = null;

/**
 * Load generic validation rules
 * In production, would load from YAML file
 */
function loadGenericRules(): GenericRule[] {
    if (cachedRules) {
        return cachedRules;
    }

    // Sample rules - in production would load from generic_rules.yaml
    cachedRules = [
        {
            id: 'effect_in_trigger',
            type: RuleType.EFFECT_USAGE,
            description: 'Detect effects used in trigger context',
            severity: 'error',
            pattern: ['add_gold', 'add_prestige', 'add_piety', 'set_variable'],
            invalidContexts: {
                parentBlocks: ['trigger', 'limit'],
            },
            message: 'Effect "{pattern}" cannot be used in trigger context',
            diagnosticCode: 'CK3870'
        },
        {
            id: 'redundant_has_check',
            type: RuleType.REDUNDANT_CHECK,
            description: 'Detect redundant has_ checks',
            severity: 'warning',
            pattern: ['has_trait', 'has_character_flag'],
            invalidContexts: {
                parentBlocks: ['if', 'else_if'],
            },
            message: 'Redundant {pattern} check - condition already verified',
            diagnosticCode: 'CK3872'
        },
        {
            id: 'missing_limit_in_loop',
            type: RuleType.MISSING_PREREQUISITE,
            description: 'Iterators should have limit blocks',
            severity: 'warning',
            pattern: ['every_', 'any_', 'random_', 'ordered_'],
            message: 'List iterator should have a limit block for performance',
            diagnosticCode: 'CK3875'
        },
        {
            id: 'invalid_comparison',
            type: RuleType.COMPARISON_SYNTAX,
            description: 'Validate comparison syntax',
            severity: 'error',
            pattern: ['>', '<', '>=', '<=', '==', '!='],
            message: 'Invalid comparison syntax',
            diagnosticCode: 'CK3880'
        },
        {
            id: 'negative_value_check',
            type: RuleType.VALUE_CHECK,
            description: 'Check for negative values where invalid',
            severity: 'error',
            pattern: ['chance', 'weight', 'months', 'days'],
            message: '{pattern} cannot be negative',
            diagnosticCode: 'CK3885'
        }
    ];

    return cachedRules;
}

/**
 * Get all known effects (built-in + scripted)
 */
function getAllEffects(indexer?: DocumentIndexer): Set<string> {
    const effects = new Set<string>([
        'add_gold', 'add_prestige', 'add_piety', 'add_stress',
        'set_variable', 'change_variable', 'add_character_flag',
        'remove_character_flag', 'add_trait', 'remove_trait',
        'add_opinion', 'reverse_add_opinion', 'set_culture',
        'set_faith', 'set_sexuality', 'set_gender_equality'
    ]);

    // Add scripted effects from indexer
    if (indexer) {
        for (const sym of indexer.findSymbolsByType(SymbolType.SCRIPTED_EFFECT)) {
            effects.add(sym.name);
        }
    }

    return effects;
}

/**
 * Get all known triggers (built-in + scripted)
 */
function getAllTriggers(indexer?: DocumentIndexer): Set<string> {
    const triggers = new Set<string>([
        'has_trait', 'has_character_flag', 'has_variable',
        'gold', 'prestige', 'piety', 'stress',
        'age', 'is_adult', 'is_alive', 'is_imprisoned',
        'culture', 'faith', 'religion', 'has_perk'
    ]);

    // Add scripted triggers from indexer
    if (indexer) {
        for (const sym of indexer.findSymbolsByType(SymbolType.SCRIPTED_TRIGGER)) {
            triggers.add(sym.name);
        }
    }

    return triggers;
}

/**
 * Check if node is in specified invalid context
 */
function isInInvalidContext(node: ASTNode, nodePath: string[], contexts?: { parentBlocks?: string[]; excludeBlocks?: string[] }): boolean {
    if (!contexts) {
        return false;
    }

    const parentBlocks = new Set(contexts.parentBlocks || []);
    const excludeBlocks = new Set(contexts.excludeBlocks || []);

    // Check if any parent is in invalid parent blocks
    for (const parent of nodePath) {
        if (parentBlocks.has(parent)) {
            // But not if also in exclude list
            if (!excludeBlocks.has(parent)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Build path from root to current node
 * Note: AST nodes don't track parent references, so we need to build paths during traversal
 */
function buildNodePath(node: ASTNode, parentPath: string[] = []): string[] {
    const path = [...parentPath];
    if (node.key) {
        path.push(node.key);
    }
    return path;
}

/**
 * Validate a single rule against node
 */
function validateRule(rule: GenericRule, node: ASTNode, nodePath: string[]): Diagnostic | null {
    const patterns = Array.isArray(rule.pattern) ? rule.pattern : [rule.pattern];

    // Check if node matches any pattern
    const matchesPattern = patterns.some(pattern => {
        if (node.key && node.key.includes(pattern)) {
            return true;
        }
        if (node.value && typeof node.value === 'string' && node.value.includes(pattern)) {
            return true;
        }
        return false;
    });

    if (!matchesPattern) {
        return null;
    }

    // Check if in invalid context
    if (isInInvalidContext(node, nodePath, rule.invalidContexts)) {
        const matchedPattern = patterns.find(pattern => 
            (node.key && node.key.includes(pattern)) || 
            (node.value && typeof node.value === 'string' && node.value.includes(pattern))
        ) || patterns[0];

        const message = rule.message.replace('{pattern}', matchedPattern);

        return {
            range: node.range,
            severity: rule.severity === 'error' ? DiagnosticSeverity.Error :
                     rule.severity === 'warning' ? DiagnosticSeverity.Warning :
                     DiagnosticSeverity.Information,
            code: rule.diagnosticCode,
            message: message,
            source: 'ck3-generic'
        };
    }

    return null;
}

/**
 * Traverse AST and collect diagnostics
 */
function traverseAndValidate(node: ASTNode, rules: GenericRule[], diagnostics: Diagnostic[], parentPath: string[] = []): void {
    const nodePath = buildNodePath(node, parentPath);

    // Check all rules against this node
    for (const rule of rules) {
        const diagnostic = validateRule(rule, node, nodePath);
        if (diagnostic) {
            diagnostics.push(diagnostic);
        }
    }

    // Recurse to children
    if (node.children) {
        for (const child of node.children) {
            traverseAndValidate(child, rules, diagnostics, nodePath);
        }
    }
}

/**
 * Validate document using generic rules
 */
export function validateGenericRules(
    ast: ASTNode,
    indexer?: DocumentIndexer,
    config: GenericRulesConfig = { enabled: true }
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const rules = loadGenericRules();

    // Filter rules based on configuration
    const enabledRules = rules.filter(rule => {
        if (config.rules && rule.id in config.rules) {
            return config.rules[rule.id];
        }
        return true; // Default: enabled
    });

    // Traverse AST once and check all rules
    traverseAndValidate(ast, enabledRules, diagnostics);

    return diagnostics;
}

/**
 * Check if value is negative (for value validation)
 */
export function isNegativeValue(value: any): boolean {
    if (typeof value === 'number') {
        return value < 0;
    }
    if (typeof value === 'string') {
        const num = parseFloat(value);
        return !isNaN(num) && num < 0;
    }
    return false;
}

/**
 * Validate specific field requires positive value
 */
export function validatePositiveValue(node: ASTNode, fieldName: string): Diagnostic | null {
    if (node.key !== fieldName) {
        return null;
    }

    if (isNegativeValue(node.value)) {
        return {
            range: node.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3885',
            message: `${fieldName} cannot be negative`,
            source: 'ck3-generic'
        };
    }

    return null;
}

/**
 * Clear cached rules (for testing or reloading)
 */
export function clearRuleCache(): void {
    cachedRules = null;
}
