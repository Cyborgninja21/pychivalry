/**
 * Comprehensive Effect/Trigger Context Detection Engine
 *
 * Classifies the current script context based on:
 * - File path → content type (events, decisions, interactions, etc.)
 * - Parent block keys → trigger/effect context
 * - Iterator prefixes → context type
 * - Ancestor chain analysis
 *
 * This replaces hardcoded EFFECT_CONTEXT_KEYS/TRIGGER_CONTEXT_KEYS
 * with a data-driven, hierarchical context classification.
 */

import { ASTNode } from '../../core/parser';
import { DirectoryRegistry } from '../../data/directory-registry';

export type ContextType = 'trigger' | 'effect' | 'modifier' | 'value' | 'unknown';

export interface ContextClassification {
    context: ContextType;
    scopeType: string;
    confidence: 'high' | 'medium' | 'low';
    source: string; // what determined the context
}

/** Keys that definitively establish an effect context */
const EFFECT_KEYS = new Set([
    'effect', 'immediate', 'after', 'on_completion',
    'on_success', 'on_failure', 'on_start', 'on_invalidated',
    'on_monthly', 'on_accept', 'on_decline', 'on_send',
    'on_activate', 'on_complete', 'on_setup', 'on_end',
    'on_owner_death', 'on_enter_phase', 'on_leave_phase',
    'if', 'else_if', 'else',
]);

/** Keys that definitively establish a trigger context */
const TRIGGER_KEYS = new Set([
    'trigger', 'limit', 'is_shown', 'is_valid',
    'is_valid_showing_failures_only', 'potential', 'allow',
    'ai_potential', 'can_be_shown', 'can_start',
    'filter', 'has_character_flag', 'can_use_cb',
    'trigger_if', 'trigger_else_if', 'trigger_else',
]);

/** Keys that indicate a modifier/value context */
const MODIFIER_KEYS = new Set([
    'modifier', 'ai_will_do', 'ai_chance', 'weight',
    'cost', 'ai_weight',
]);

/** File path patterns that determine default context */
const PATH_CONTEXT_MAP: Array<{ pattern: RegExp; context: ContextType; scope: string }> = [
    { pattern: /\/events\//i, context: 'effect', scope: 'character' },
    { pattern: /\/decisions\//i, context: 'effect', scope: 'character' },
    { pattern: /\/character_interactions\//i, context: 'effect', scope: 'character' },
    { pattern: /\/on_actions\//i, context: 'effect', scope: 'character' },
    { pattern: /\/scripted_triggers\//i, context: 'trigger', scope: 'any' },
    { pattern: /\/scripted_effects\//i, context: 'effect', scope: 'any' },
    { pattern: /\/story_cycles\//i, context: 'effect', scope: 'character' },
    { pattern: /\/activities\//i, context: 'effect', scope: 'character' },
    { pattern: /\/schemes\//i, context: 'effect', scope: 'scheme' },
    { pattern: /\/script_values\//i, context: 'value', scope: 'any' },
    { pattern: /\/modifiers\//i, context: 'modifier', scope: 'character' },
];

/**
 * Classify the current context based on ancestor chain, current key, and file path.
 *
 * @param ancestorChain Array of ancestor ASTNodes from root to current node
 * @param currentKey The key of the current node (if any)
 * @param filePath The file path (URI) of the document
 * @returns Context classification with confidence
 */
export function classifyContext(
    ancestorChain: ASTNode[],
    currentKey: string | null,
    filePath: string
): ContextClassification {
    // Priority 1: Check immediate parent block keys (highest confidence)
    for (let i = ancestorChain.length - 1; i >= 0; i--) {
        const ancestor = ancestorChain[i];
        if (!ancestor.key) continue;

        if (EFFECT_KEYS.has(ancestor.key)) {
            return {
                context: 'effect',
                scopeType: inferScopeFromChain(ancestorChain, i),
                confidence: 'high',
                source: `parent block '${ancestor.key}'`,
            };
        }

        if (TRIGGER_KEYS.has(ancestor.key)) {
            return {
                context: 'trigger',
                scopeType: inferScopeFromChain(ancestorChain, i),
                confidence: 'high',
                source: `parent block '${ancestor.key}'`,
            };
        }

        if (MODIFIER_KEYS.has(ancestor.key)) {
            return {
                context: 'modifier',
                scopeType: inferScopeFromChain(ancestorChain, i),
                confidence: 'high',
                source: `parent block '${ancestor.key}'`,
            };
        }

        // Check iterator prefixes — any_* is trigger, every_*/random_*/ordered_* is effect
        if (ancestor.key.startsWith('any_')) {
            return {
                context: 'trigger',
                scopeType: inferScopeFromChain(ancestorChain, i),
                confidence: 'medium',
                source: `iterator '${ancestor.key}'`,
            };
        }

        if (ancestor.key.startsWith('every_') || ancestor.key.startsWith('random_') ||
            ancestor.key.startsWith('ordered_')) {
            return {
                context: 'effect',
                scopeType: inferScopeFromChain(ancestorChain, i),
                confidence: 'medium',
                source: `iterator '${ancestor.key}'`,
            };
        }
    }

    // Priority 2: Check file path (medium confidence)
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const mapping of PATH_CONTEXT_MAP) {
        if (mapping.pattern.test(normalizedPath)) {
            return {
                context: mapping.context,
                scopeType: mapping.scope,
                confidence: 'medium',
                source: `file path pattern`,
            };
        }
    }

    // Priority 3: Try directory registry (medium confidence)
    const registry = DirectoryRegistry.getInstance();
    if (registry.isLoaded()) {
        const contentType = registry.getContentType(filePath);
        const defaultScope = registry.getDefaultScope(filePath) || 'character';

        if (contentType) {
            const context = contentTypeToContext(contentType);
            return {
                context,
                scopeType: defaultScope,
                confidence: 'medium',
                source: `directory registry: ${contentType}`,
            };
        }
    }

    // Default: unknown
    return {
        context: 'unknown',
        scopeType: 'character',
        confidence: 'low',
        source: 'default',
    };
}

/**
 * Infer scope type from the ancestor chain up to a given index.
 */
function inferScopeFromChain(ancestorChain: ASTNode[], upToIndex: number): string {
    // Simple heuristic: check ancestor keys for scope hints
    for (let i = 0; i < upToIndex; i++) {
        const key = ancestorChain[i].key;
        if (!key) continue;

        // Event blocks default to character scope
        if (/^[a-z_]+\.\d+$/.test(key)) return 'character';
    }
    return 'character';
}

/**
 * Map content type to default context type.
 */
function contentTypeToContext(contentType: string): ContextType {
    switch (contentType) {
        case 'scripted_trigger':
            return 'trigger';
        case 'scripted_effect':
        case 'event':
        case 'decision':
        case 'character_interaction':
        case 'on_action':
        case 'story_cycle':
        case 'activity_type':
        case 'scheme_type':
            return 'effect';
        case 'modifier':
        case 'scripted_modifier':
            return 'modifier';
        case 'script_value':
            return 'value';
        default:
            return 'unknown';
    }
}
