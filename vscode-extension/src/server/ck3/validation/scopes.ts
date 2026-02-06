/**
 * Scope System for CK3 Scripts
 * 
 * Provides comprehensive scope type tracking, validation, and navigation.
 * Scopes are the fundamental context system in CK3 scripting, representing
 * different game entities (characters, titles, provinces, etc.) and defining
 * what operations are valid in each context.
 * 
 * DIAGNOSTIC CODES:
 *     SCOPE-001: Unknown scope type
 *     SCOPE-002: Invalid scope link
 *     SCOPE-003: Invalid scope chain
 *     SCOPE-004: Trigger not valid in scope
 *     SCOPE-005: Effect not valid in scope
 *     SCOPE-006: Invalid list base for scope
 */

import { getDataLoader } from '../../data/loader';

/**
 * Universal scope links that work in ALL scope types
 * These maintain the current scope type
 */
const UNIVERSAL_LINKS = ['root', 'this', 'prev', 'from', 'fromfrom'];

/**
 * Get valid scope links for a given scope type
 * 
 * Scope links are single-step navigations to related objects (e.g., 'liege', 'spouse').
 * 
 * @param scopeType The scope type to query ('character', 'title', 'province')
 * @returns List of valid link names, always including universal links
 */
export function getScopeLinks(scopeType: string): string[] {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    
    if (!scopes.has(scopeType)) {
        console.warn(`SCOPE-001: Unknown scope type: ${scopeType}`);
        return [...UNIVERSAL_LINKS];
    }
    
    const scopeData = scopes.get(scopeType)!;
    const links = Object.keys(scopeData.links || {});
    
    // Combine scope-specific links with universal links
    const allLinks = [...links, ...UNIVERSAL_LINKS];
    // Remove duplicates
    return Array.from(new Set(allLinks));
}

/**
 * Get valid list iterations for a given scope type
 * 
 * List iterations are base names that can be prefixed with any_*, every_*, random_*,
 * or ordered_* to create collection iterators.
 * 
 * @param scopeType The scope type to query
 * @returns List of valid list iteration base names
 */
export function getScopeLists(scopeType: string): string[] {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    
    if (!scopes.has(scopeType)) {
        console.warn(`SCOPE-001: Unknown scope type: ${scopeType}`);
        return [];
    }
    
    const scopeData = scopes.get(scopeType)!;
    return scopeData.lists || [];
}

/**
 * Get the target scope type for a given scope link
 * 
 * @param scopeType Current scope type
 * @param link Scope link name
 * @returns Target scope type, or null if invalid
 */
export function getTargetScopeType(scopeType: string, link: string): string | null {
    // Universal links maintain the same scope type
    if (UNIVERSAL_LINKS.includes(link)) {
        return scopeType;
    }
    
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    
    if (!scopes.has(scopeType)) {
        console.warn(`SCOPE-001: Unknown scope type: ${scopeType}`);
        return null;
    }
    
    const scopeData = scopes.get(scopeType)!;
    const links = scopeData.links || {};
    
    if (link in links) {
        return links[link];
    }
    
    console.warn(`SCOPE-002: Invalid scope link '${link}' for scope type '${scopeType}'`);
    return null;
}

/**
 * Validate a scope chain and determine the result type
 * 
 * Scope chains use dot notation to navigate through relationships:
 * Example: root.liege.primary_title.holder
 * 
 * @param chain Scope chain (e.g., "liege.primary_title.holder")
 * @param startScope Starting scope type
 * @returns [isValid, resultType, errorMessage?]
 */
export function validateScopeChain(
    chain: string,
    startScope: string
): [boolean, string | null, string?] {
    if (!chain || chain.trim() === '') {
        return [true, startScope];
    }
    
    const parts = chain.split('.');
    let currentScope = startScope;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        
        if (!part) {
            continue;
        }
        
        // Check if it's a saved scope (scope:name, event_target:name, etc.)
        if (part.includes(':')) {
            // Saved scopes can be any type, we can't validate without runtime info
            // For now, assume it's valid and maintain the current scope type
            continue;
        }
        
        // Check if it's a valid link
        const targetScope = getTargetScopeType(currentScope, part);
        
        if (targetScope === null) {
            const error = `SCOPE-003: Invalid scope chain at '${part}' (step ${i + 1}). ` +
                         `'${part}' is not a valid link from scope type '${currentScope}'`;
            return [false, null, error];
        }
        
        currentScope = targetScope;
    }
    
    return [true, currentScope];
}

/**
 * Get the result scope type for a scope chain
 * 
 * @param chain Scope chain
 * @param startScope Starting scope type
 * @returns Result scope type, or null if invalid
 */
export function getScopeResultType(chain: string, startScope: string): string | null {
    const [isValid, resultType] = validateScopeChain(chain, startScope);
    return isValid ? resultType : null;
}

/**
 * Check if an effect is valid in a given scope
 * 
 * @param effectName Effect name
 * @param scopeType Scope type
 * @returns True if the effect is valid in this scope
 */
export function isValidEffect(effectName: string, scopeType: string): boolean {
    const dataLoader = getDataLoader();
    const effects = dataLoader.getEffects();
    
    if (!effects.has(effectName)) {
        // Unknown effect - can't validate
        return false;
    }
    
    const effect = effects.get(effectName)!;
    
    // If effect has no scope requirement, it's valid everywhere
    if (!effect.scope) {
        return true;
    }
    
    // Check if current scope matches required scope
    // 'any' means valid in all scopes
    if (effect.scope === 'any') {
        return true;
    }
    
    return effect.scope === scopeType;
}

/**
 * Check if a trigger is valid in a given scope
 * 
 * @param triggerName Trigger name
 * @param scopeType Scope type
 * @returns True if the trigger is valid in this scope
 */
export function isValidTrigger(triggerName: string, scopeType: string): boolean {
    const dataLoader = getDataLoader();
    const triggers = dataLoader.getTriggers();
    
    if (!triggers.has(triggerName)) {
        // Unknown trigger - can't validate
        return false;
    }
    
    const trigger = triggers.get(triggerName)!;
    
    // If trigger has no scope requirement, it's valid everywhere
    if (!trigger.scope) {
        return true;
    }
    
    // Check if current scope matches required scope
    // 'any' means valid in all scopes
    if (trigger.scope === 'any') {
        return true;
    }
    
    return trigger.scope === scopeType;
}

/**
 * Check if a string is a valid list base for a scope
 * 
 * @param listBase List base name (e.g., 'vassal' from 'any_vassal')
 * @param scopeType Scope type
 * @returns True if the list base is valid
 */
export function isValidListBase(listBase: string, scopeType: string): boolean {
    const lists = getScopeLists(scopeType);
    return lists.includes(listBase);
}

/**
 * Parse a list iterator to extract the base name
 * 
 * Handles prefixes: any_, every_, random_, ordered_
 * 
 * @param iterator List iterator name (e.g., 'any_vassal')
 * @returns [prefix, baseName] or null if not a list iterator
 */
export function parseListIterator(iterator: string): [string, string] | null {
    const prefixes = ['any_', 'every_', 'random_', 'ordered_'];
    
    for (const prefix of prefixes) {
        if (iterator.startsWith(prefix)) {
            const baseName = iterator.substring(prefix.length);
            return [prefix, baseName];
        }
    }
    
    return null;
}

/**
 * Check if a string is a list iterator
 * 
 * @param name Identifier to check
 * @returns True if it's a list iterator
 */
export function isListIterator(name: string): boolean {
    return parseListIterator(name) !== null;
}

/**
 * Get the result scope type for a list iterator
 * 
 * For example, 'every_vassal' in character scope returns 'character'
 * 
 * @param iterator List iterator name
 * @param scopeType Current scope type
 * @returns Result scope type, or null if invalid
 */
export function getListResultScope(iterator: string, scopeType: string): string | null {
    const parsed = parseListIterator(iterator);
    
    if (!parsed) {
        return null;
    }
    
    const [prefix, baseName] = parsed;
    
    // Validate the list base is valid for this scope
    if (!isValidListBase(baseName, scopeType)) {
        console.warn(`SCOPE-006: Invalid list base '${baseName}' for scope type '${scopeType}'`);
        return null;
    }
    
    // Most list iterators maintain the same scope type
    // Special cases could be handled here if needed
    
    // For now, check if there's explicit information in the scope data
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    
    if (scopes.has(scopeType)) {
        const scopeData = scopes.get(scopeType)!;
        
        // Some scope data might include result types for lists
        // For now, we'll use a heuristic: most lists return the same type
        
        // Common pattern: iterating over characters returns character scope
        if (baseName.includes('vassal') || baseName.includes('courtier') || 
            baseName.includes('child') || baseName.includes('heir') ||
            baseName.includes('spouse') || baseName.includes('prisoner')) {
            return 'character';
        }
        
        // Iterating over titles returns title scope
        if (baseName.includes('title') || baseName.includes('county') ||
            baseName.includes('barony') || baseName.includes('duchy') ||
            baseName.includes('kingdom') || baseName.includes('empire')) {
            return 'title';
        }
        
        // Iterating over provinces returns province scope
        if (baseName.includes('province')) {
            return 'province';
        }
    }
    
    // Default: maintain the same scope type
    return scopeType;
}

/**
 * Get all valid scope types
 * 
 * @returns Array of valid scope type names
 */
export function getAllScopeTypes(): string[] {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    return Array.from(scopes.keys());
}

/**
 * Check if a scope type is valid
 * 
 * @param scopeType Scope type to check
 * @returns True if valid
 */
export function isValidScopeType(scopeType: string): boolean {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    return scopes.has(scopeType);
}

/**
 * Get documentation for a scope link
 * 
 * @param scopeType Current scope type
 * @param link Scope link name
 * @returns Documentation string
 */
export function getScopeLinkDocumentation(scopeType: string, link: string): string {
    if (UNIVERSAL_LINKS.includes(link)) {
        const docs: Record<string, string> = {
            'root': 'The original scope when the script started executing',
            'this': 'The current scope',
            'prev': 'The previous scope in a scope transition',
            'from': 'The scope that triggered the current event/effect',
            'fromfrom': 'The scope two levels back in the trigger chain',
        };
        return docs[link] || 'Universal scope link';
    }
    
    const targetType = getTargetScopeType(scopeType, link);
    
    if (targetType) {
        return `Navigate from ${scopeType} to ${targetType}`;
    }
    
    return 'Unknown scope link';
}
