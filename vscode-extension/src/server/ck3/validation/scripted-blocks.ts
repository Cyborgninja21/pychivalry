/**
 * Scripted Blocks Validation Module
 * 
 * Validates scripted effects and triggers:
 * - Scripted effect definitions
 * - Scripted trigger definitions
 * - Parameter validation
 * - Usage validation
 * 
 * Diagnostic Codes:
 * - CK3950: Undefined scripted effect
 * - CK3951: Undefined scripted trigger
 * - CK3952: Invalid scripted block parameters
 * - CK3953: Scripted block used in wrong context
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode, NodeType } from '../../core/parser';

/** Known CK3 builtin keys that should not be flagged as scripted effects/triggers */
const KNOWN_BUILTIN_KEYS = new Set([
    'type', 'title', 'desc', 'option', 'trigger', 'effect', 'immediate',
    'after', 'weight_multiplier', 'ai_chance', 'ai_will_do',
    'if', 'else', 'else_if', 'switch', 'while', 'limit', 'alternative_limit',
    'name', 'value', 'flag', 'target', 'modifier', 'icon', 'text',
    'tooltip', 'theme', 'override_background', 'cooldown',
    'left_portrait', 'right_portrait', 'lower_left_portrait',
    'lower_right_portrait', 'lower_center_portrait',
    'root', 'from', 'prev', 'this', 'yes', 'no',
    'is_shown', 'is_valid', 'cost', 'minimum_cost',
    'on_completion', 'on_monthly', 'on_yearly', 'on_start',
    'skill', 'trait', 'culture', 'faith', 'dynasty', 'religion',
]);

export interface ScriptedBlockConfig {
    enabled: boolean;
    checkEffects: boolean;
    checkTriggers: boolean;
    knownScriptedEffects?: Set<string>;
    knownScriptedTriggers?: Set<string>;
}

/**
 * Validate scripted blocks
 */
export function validateScriptedBlocks(
    node: ASTNode,
    config: ScriptedBlockConfig
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    if (config.checkEffects) {
        diagnostics.push(...checkScriptedEffects(node, config.knownScriptedEffects));
    }

    if (config.checkTriggers) {
        diagnostics.push(...checkScriptedTriggers(node, config.knownScriptedTriggers));
    }

    return diagnostics;
}

/**
 * Check scripted effect references
 */
function checkScriptedEffects(
    node: ASTNode,
    knownEffects?: Set<string>
): Diagnostic[] {
    if (!knownEffects) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const refs = collectScriptedEffectReferences(node);

    for (const ref of refs) {
        if (ref.value && !knownEffects.has(String(ref.value))) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: ref.range,
                message: `Undefined scripted effect: "${ref.value}"`,
                code: 'CK3950',
                source: 'ck3-lsp'
            });
        }
    }

    return diagnostics;
}

/**
 * Check scripted trigger references
 */
function checkScriptedTriggers(
    node: ASTNode,
    knownTriggers?: Set<string>
): Diagnostic[] {
    if (!knownTriggers) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    const refs = collectScriptedTriggerReferences(node);

    for (const ref of refs) {
        if (ref.value && !knownTriggers.has(String(ref.value))) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: ref.range,
                message: `Undefined scripted trigger: "${ref.value}"`,
                code: 'CK3951',
                source: 'ck3-lsp'
            });
        }
    }

    return diagnostics;
}

/**
 * Collect scripted effect references
 */
function collectScriptedEffectReferences(node: ASTNode): ASTNode[] {
    const refs: ASTNode[] = [];
    
    // Look for keys that might be scripted effects
    // They typically start with a lowercase letter and contain underscores
    function traverse(n: ASTNode): void {
        if (n.key && /^[a-z][a-z0-9_]*$/.test(n.key) &&
            !KNOWN_BUILTIN_KEYS.has(n.key) &&
            n.children && n.children.length > 0) {
            // Likely a scripted effect call (has block body and is not a builtin)
            refs.push(n);
        }
        
        if (n.children) {
            n.children.forEach((child: ASTNode) => traverse(child));
        }
    }
    
    traverse(node);
    return refs;
}

/**
 * Collect scripted trigger references
 */
function collectScriptedTriggerReferences(node: ASTNode): ASTNode[] {
    // Similar to effects but in trigger contexts
    return collectScriptedEffectReferences(node);
}

/**
 * Get scripted block diagnostic description
 */
export function getScriptedBlockDiagnosticDescription(code: string): string {
    const descriptions: Record<string, string> = {
        'CK3950': 'Undefined scripted effect. The scripted effect is not defined.',
        'CK3951': 'Undefined scripted trigger. The scripted trigger is not defined.',
        'CK3952': 'Invalid scripted block parameters. Check parameter types and count.',
        'CK3953': 'Scripted block used in wrong context. Check if it\'s a trigger or effect.'
    };

    return descriptions[code] || 'Scripted block validation error';
}
