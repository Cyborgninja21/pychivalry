/**
 * Paradox Convention Validation - CK3-Specific Best Practices
 * 
 * DIAGNOSTIC CODES:
 *     CK3870: Effect used in trigger block
 *     CK3871: Effect used in limit block
 *     CK3872: Redundant trigger = { always = yes }
 *     CK3873: Impossible trigger = { always = no }
 *     CK3875: Missing limit in random_ iterator
 *     CK3976: Effect in any_ iterator (use every_ instead)
 *     CK3977: every_ without limit (can be expensive)
 *     CK3760: Event missing type declaration
 *     CK3761: Invalid event type
 *     CK3762: Hidden event with options
 *     CK3763: Event with no options
 *     CK3764: Non-hidden event missing desc
 *     CK3766: Multiple after blocks
 *     CK3768: Multiple immediate blocks
 *     CK5137: is_alive without exists check
 * 
 * This module validates scripts against Paradox modding conventions
 * and catches common pitfalls that are syntactically valid but
 * semantically incorrect or likely to cause runtime bugs.
 */

import { ASTNode, NodeType } from '../../core/parser';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { CK3Language } from '../language';

/**
 * Configuration for Paradox convention checks
 */
export interface ParadoxConfig {
    effectTriggerContext: boolean;
    listIterators: boolean;
    opinionModifiers: boolean;
    eventStructure: boolean;
    commonGotchas: boolean;
}

/**
 * Default configuration with all checks enabled
 */
export const DEFAULT_PARADOX_CONFIG: ParadoxConfig = {
    effectTriggerContext: true,
    listIterators: true,
    opinionModifiers: true,
    eventStructure: true,
    commonGotchas: true,
};

/**
 * Check if an identifier is an effect
 */
function isEffect(identifier: string): boolean {
    const effects = CK3Language.getEffects();
    return identifier in effects;
}

/**
 * Check if an identifier is a trigger
 */
function isTrigger(identifier: string): boolean {
    const triggers = CK3Language.getTriggers();
    return identifier in triggers;
}

/**
 * Check for effects used in trigger contexts
 * DIAGNOSTIC: CK3870, CK3871
 */
export function checkEffectInTriggerContext(node: ASTNode, context: 'trigger' | 'limit'): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        if (child.key && isEffect(child.key)) {
            const code = context === 'limit' ? 'CK3871' : 'CK3870';
            const contextName = context === 'limit' ? 'limit' : 'trigger';
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Error,
                code,
                source: 'ck3-lsp',
                message: `Effect '${child.key}' used in ${contextName} block. ${contextName} blocks can only contain triggers (checks), not effects (actions).`,
            });
        }
        
        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkEffectInTriggerContext(child, context));
        }
    }

    return diagnostics;
}

/**
 * Check for redundant or impossible trigger conditions
 * DIAGNOSTIC: CK3872, CK3873
 */
export function checkRedundantTriggers(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        // Check for always = yes (redundant)
        if (child.key === 'always' && child.value === 'yes') {
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Warning,
                code: 'CK3872',
                source: 'ck3-lsp',
                message: "Redundant 'always = yes' trigger. This is always true and can be removed.",
            });
        }

        // Check for always = no (impossible)
        if (child.key === 'always' && child.value === 'no') {
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Error,
                code: 'CK3873',
                source: 'ck3-lsp',
                message: "Impossible 'always = no' trigger. This code will never execute.",
            });
        }

        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkRedundantTriggers(child));
        }
    }

    return diagnostics;
}

/**
 * Check list iterator misuse
 * DIAGNOSTIC: CK3875, CK3976, CK3977
 */
export function checkListIteratorMisuse(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        if (!child.key) continue;

        // Check for any_ with effects
        if (child.key.startsWith('any_') && child.type === NodeType.BLOCK) {
            const blockChildren = child.children || [];
            for (const blockChild of blockChildren) {
                if (blockChild.key && isEffect(blockChild.key)) {
                    diagnostics.push({
                        range: blockChild.range,
                        severity: DiagnosticSeverity.Error,
                        code: 'CK3976',
                        source: 'ck3-lsp',
                        message: `Effect '${blockChild.key}' used in any_ iterator. Use every_, random_, or ordered_ for effects.`,
                    });
                }
            }
        }

        // Check for random_ without limit
        if (child.key.startsWith('random_') && child.type === NodeType.BLOCK) {
            const blockChildren = child.children || [];
            const hasLimit = blockChildren.some(c => c.key === 'limit');
            if (!hasLimit) {
                diagnostics.push({
                    range: child.range,
                    severity: DiagnosticSeverity.Warning,
                    code: 'CK3875',
                    source: 'ck3-lsp',
                    message: `random_ iterator without limit. Consider adding limit = { ... } to filter candidates.`,
                });
            }
        }

        // Check for every_ without limit (performance warning)
        if (child.key.startsWith('every_') && child.type === NodeType.BLOCK) {
            const blockChildren = child.children || [];
            const hasLimit = blockChildren.some(c => c.key === 'limit');
            if (!hasLimit) {
                diagnostics.push({
                    range: child.range,
                    severity: DiagnosticSeverity.Information,
                    code: 'CK3977',
                    source: 'ck3-lsp',
                    message: `every_ iterator without limit affects ALL matching elements. Consider adding limit = { ... } for better performance.`,
                });
            }
        }

        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkListIteratorMisuse(child));
        }
    }

    return diagnostics;
}

/**
 * Check event structure issues
 * DIAGNOSTIC: CK3760, CK3761, CK3762, CK3763, CK3764, CK3766, CK3768
 */
export function checkEventStructure(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    // Check for type declaration
    const typeNode = children.find(c => c.key === 'type');
    if (!typeNode) {
        diagnostics.push({
            range: node.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3760',
            source: 'ck3-lsp',
            message: 'Event is missing type declaration (character_event, letter_event, etc.)',
        });
        return diagnostics; // Can't check further without type
    }

    // Validate event type
    const validTypes = ['character_event', 'letter_event', 'court_event', 'duel_event', 'feast_event', 'story_cycle'];
    const eventType = String(typeNode.value);
    if (!validTypes.includes(eventType)) {
        diagnostics.push({
            range: typeNode.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3761',
            source: 'ck3-lsp',
            message: `Invalid event type '${eventType}'. Valid types: ${validTypes.join(', ')}`,
        });
    }

    // Check for hidden events with options
    const isHidden = children.some(c => c.key === 'hidden' && c.value === 'yes');
    const optionNodes = children.filter(c => c.key === 'option');
    
    if (isHidden && optionNodes.length > 0) {
        diagnostics.push({
            range: optionNodes[0].range,
            severity: DiagnosticSeverity.Warning,
            code: 'CK3762',
            source: 'ck3-lsp',
            message: 'Hidden event has option blocks. Options are ignored in hidden events.',
        });
    }

    // Check for non-hidden events without options
    if (!isHidden && optionNodes.length === 0) {
        diagnostics.push({
            range: node.range,
            severity: DiagnosticSeverity.Warning,
            code: 'CK3763',
            source: 'ck3-lsp',
            message: 'Event has no option blocks. Players need choices to interact with events.',
        });
    }

    // Check for non-hidden events missing desc
    const descNode = children.find(c => c.key === 'desc');
    if (!isHidden && !descNode) {
        diagnostics.push({
            range: node.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3764',
            source: 'ck3-lsp',
            message: 'Non-hidden event is missing desc field.',
        });
    }

    // Check for multiple after blocks
    const afterNodes = children.filter(c => c.key === 'after');
    if (afterNodes.length > 1) {
        for (let i = 1; i < afterNodes.length; i++) {
            diagnostics.push({
                range: afterNodes[i].range,
                severity: DiagnosticSeverity.Warning,
                code: 'CK3766',
                source: 'ck3-lsp',
                message: 'Multiple after blocks detected. Only the first after block will execute.',
            });
        }
    }

    // Check for multiple immediate blocks
    const immediateNodes = children.filter(c => c.key === 'immediate');
    if (immediateNodes.length > 1) {
        for (let i = 1; i < immediateNodes.length; i++) {
            diagnostics.push({
                range: immediateNodes[i].range,
                severity: DiagnosticSeverity.Error,
                code: 'CK3768',
                source: 'ck3-lsp',
                message: 'Multiple immediate blocks detected. Only one immediate block is allowed per event.',
            });
        }
    }

    return diagnostics;
}

/**
 * Check for common CK3 gotchas
 * DIAGNOSTIC: CK5137
 */
export function checkCommonGotchas(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        // Check for is_alive without exists check
        if (child.key === 'is_alive') {
            // This is a simplified check - in reality we'd need to track scope chain
            // to see if there's a protective exists check
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Information,
                code: 'CK5137',
                source: 'ck3-lsp',
                message: "Using 'is_alive' without an 'exists' check may crash if the target doesn't exist. Consider wrapping in exists = { ... }.",
            });
        }

        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkCommonGotchas(child));
        }
    }

    return diagnostics;
}

/**
 * Validate all Paradox conventions for a node
 */
export function validateParadoxConventions(node: ASTNode, config: ParadoxConfig = DEFAULT_PARADOX_CONFIG): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Effect/trigger context checks
    if (config.effectTriggerContext) {
        // Check trigger blocks
        const children = node.children || [];
        for (const child of children) {
            if (child.key === 'trigger' && child.type === NodeType.BLOCK) {
                diagnostics.push(...checkEffectInTriggerContext(child, 'trigger'));
            }
            if (child.key === 'limit' && child.type === NodeType.BLOCK) {
                diagnostics.push(...checkEffectInTriggerContext(child, 'limit'));
            }
        }

        // Check for redundant triggers
        diagnostics.push(...checkRedundantTriggers(node));
    }

    // List iterator checks
    if (config.listIterators) {
        diagnostics.push(...checkListIteratorMisuse(node));
    }

    // Event structure checks
    if (config.eventStructure) {
        // Check if this looks like an event (has type field)
        const children = node.children || [];
        if (children.some(c => c.key === 'type')) {
            diagnostics.push(...checkEventStructure(node));
        }
    }

    // Common gotchas
    if (config.commonGotchas) {
        diagnostics.push(...checkCommonGotchas(node));
    }

    return diagnostics;
}

/**
 * Export all Paradox convention checking functions
 */
export const ParadoxChecks = {
    checkEffectInTriggerContext,
    checkRedundantTriggers,
    checkListIteratorMisuse,
    checkEventStructure,
    checkCommonGotchas,
    validateParadoxConventions,
};
