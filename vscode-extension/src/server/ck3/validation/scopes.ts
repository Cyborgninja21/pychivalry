/**
 * Scope System for CK3 Scripts
 *
 * Provides comprehensive scope type tracking, validation, and navigation.
 * Scopes are the fundamental context system in CK3 scripting, representing
 * different game entities (characters, titles, provinces, etc.) and defining
 * what operations are valid in each context.
 *
 * SPECIAL SCOPES:
 *     root      - The initial/top-level scope when execution began
 *     this      - The current scope (usually implicit)
 *     prev      - The previous scope in the chain
 *     prev_prev - Two scopes back (equivalent to prev.prev)
 *     from      - The scope that triggered the current context (events/on_actions)
 *     fromfrom  - Two 'from' steps back
 *
 * NULL-SAFE ACCESS:
 *     The `?=` operator provides null-safe scope access:
 *     scope:optional_target ?= { ... }  # Only executes if scope exists
 *
 * DIAGNOSTIC CODES (emitted by diagnostics.ts, not this module):
 *     SCOPE-003: Invalid scope chain
 *     SCOPE-004: Trigger not valid in scope
 *     SCOPE-005: Effect not valid in scope
 *     SCOPE-006: Invalid list base for scope
 *
 * INTERNAL LOGGING CODES (serverLogger only, not user-facing):
 *     SCOPE-001: Unknown scope type (debug aid)
 *     SCOPE-002: Invalid scope link (debug aid)
 */

import { getDataLoader } from '../../data/loader';
import { serverLogger } from '../../utils/logger';

// Universal scope links that work in ALL scope types.
// These maintain the current scope type.
//
// - root: Returns to the initial scope when script execution began
// - this: Explicit reference to current scope (usually implicit)
// - prev: Navigate one scope back in the chain
// - prev_prev: Navigate two scopes back (alias for prev.prev)
// - from: The triggering scope context (used in events/on_actions)
// - fromfrom: Two 'from' steps back
const UNIVERSAL_LINKS = ['root', 'this', 'prev', 'prev_prev', 'from', 'fromfrom'];

// Check if a name is a recognized scope link (universal or scope-specific).
//
// Use this to distinguish scope chains (root.liege.primary_title) from
// dotted identifiers (my_namespace.0001) before attempting scope chain validation.
// Returns true if the name is a valid scope link for the given scope type.
export function isScopeLink(name: string, scopeType: string): boolean {
    // Universal links (root, this, prev, etc.) are always valid
    if (UNIVERSAL_LINKS.includes(name)) {
        return true;
    }

    // Look up scope-specific links from the data loader
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();

    if (!scopes.has(scopeType)) {
        return false;
    }

    const scopeData = scopes.get(scopeType)!;
    const links = scopeData.links || {};
    // Check if the name exists as a defined link for this scope type
    return name in links;
}

// Get valid scope links for a given scope type.
// Scope links are single-step navigations to related objects (e.g., 'liege', 'spouse').
// Returns the list of valid link names, always including universal links.
export function getScopeLinks(scopeType: string): string[] {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();

    // Fall back to just universal links if scope type is unknown
    if (!scopes.has(scopeType)) {
        serverLogger.warn(`SCOPE-001: Unknown scope type: ${scopeType}`);
        return [...UNIVERSAL_LINKS];
    }

    const scopeData = scopes.get(scopeType)!;
    const links = Object.keys(scopeData.links || {});

    // Combine scope-specific links with universal links, deduplicating
    const allLinks = [...links, ...UNIVERSAL_LINKS];
    return Array.from(new Set(allLinks));
}

// Get valid list iteration base names for a given scope type.
// List iterations are base names that can be prefixed with any_*, every_*, random_*,
// or ordered_* to create collection iterators.
export function getScopeLists(scopeType: string): string[] {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();

    if (!scopes.has(scopeType)) {
        serverLogger.warn(`SCOPE-001: Unknown scope type: ${scopeType}`);
        return [];
    }

    const scopeData = scopes.get(scopeType)!;
    const lists = scopeData.lists;
    // Lists can be either an array of names or a map of name -> result scope type
    if (Array.isArray(lists)) return lists;
    if (lists && typeof lists === 'object') return Object.keys(lists);
    return [];
}

// Get the target scope type after following a scope link.
// Universal links (root, this, prev, from, etc.) maintain the current scope type.
// Scope-specific links return the type defined in the scope data.
// Returns null if the link is not valid for the given scope type.
export function getTargetScopeType(scopeType: string, link: string): string | null {
    // Universal links maintain the same scope type
    if (UNIVERSAL_LINKS.includes(link)) {
        return scopeType;
    }

    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();

    if (!scopes.has(scopeType)) {
        serverLogger.warn(`SCOPE-001: Unknown scope type: ${scopeType}`);
        return null;
    }

    const scopeData = scopes.get(scopeType)!;
    const links = scopeData.links || {};

    // Return the target scope type if the link is defined
    if (link in links) {
        return links[link];
    }

    serverLogger.warn(`SCOPE-002: Invalid scope link '${link}' for scope type '${scopeType}'`);
    return null;
}

// Validate a scope chain and determine the result scope type.
// Scope chains use dot notation to navigate through relationships,
// e.g. "root.liege.primary_title.holder" walks character -> character -> title -> character.
// Returns a tuple of [isValid, resultScopeType, errorMessage?].
export function validateScopeChain(
    chain: string,
    startScope: string
): [boolean, string | null, string?] {
    // Empty/blank chains are valid and stay in the start scope
    if (!chain || chain.trim() === '') {
        return [true, startScope];
    }

    const parts = chain.split('.');
    let currentScope = startScope;

    // Walk each segment of the chain, validating and resolving the scope type at each step
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();

        if (!part) {
            continue;
        }

        // Saved scopes (scope:name, event_target:name) can be any type;
        // we can't validate without runtime info, so assume valid and keep current scope
        if (part.includes(':')) {
            continue;
        }

        // Validate the segment is a recognized link and resolve the target scope
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

// Convenience wrapper: get the result scope type for a scope chain,
// or null if the chain is invalid.
export function getScopeResultType(chain: string, startScope: string): string | null {
    const [isValid, resultType] = validateScopeChain(chain, startScope);
    return isValid ? resultType : null;
}

// Check if an effect is valid in a given scope type.
// Looks up the effect in the data loader and checks its scope requirement.
// Effects with scope 'any' or no scope requirement are valid everywhere.
// Returns false for unknown effects (can't validate what we don't know).
export function isValidEffect(effectName: string, scopeType: string): boolean {
    const dataLoader = getDataLoader();
    const effects = dataLoader.getEffects();

    if (!effects.has(effectName)) {
        return false; // Unknown effect - can't validate
    }

    const effect = effects.get(effectName)!;

    // No scope requirement or 'any' means valid everywhere
    if (!effect.scope || effect.scope === 'any') {
        return true;
    }

    // Otherwise, the current scope must match the effect's required scope
    return effect.scope === scopeType;
}

// Check if a trigger is valid in a given scope type.
// Same logic as isValidEffect but for triggers.
// Returns false for unknown triggers.
export function isValidTrigger(triggerName: string, scopeType: string): boolean {
    const dataLoader = getDataLoader();
    const triggers = dataLoader.getTriggers();

    if (!triggers.has(triggerName)) {
        return false; // Unknown trigger - can't validate
    }

    const trigger = triggers.get(triggerName)!;

    // No scope requirement or 'any' means valid everywhere
    if (!trigger.scope || trigger.scope === 'any') {
        return true;
    }

    return trigger.scope === scopeType;
}

// Check if an effect name exists in our data, regardless of scope.
// Use this before isValidEffect to distinguish "wrong scope" from "unknown name".
export function isKnownEffect(name: string): boolean {
    return getDataLoader().getEffects().has(name);
}

// Check if a trigger name exists in our data, regardless of scope.
// Use this before isValidTrigger to distinguish "wrong scope" from "unknown name".
export function isKnownTrigger(name: string): boolean {
    return getDataLoader().getTriggers().has(name);
}

// Check if a string is a valid list base name for a scope type.
// For example, 'vassal' is a valid list base in 'character' scope,
// enabling iterators like any_vassal, every_vassal, etc.
export function isValidListBase(listBase: string, scopeType: string): boolean {
    const lists = getScopeLists(scopeType);
    return lists.includes(listBase);
}

// Parse a list iterator name to extract the prefix and base name.
// Handles the four iterator prefixes: any_, every_, random_, ordered_.
// Returns [prefix, baseName] or null if not a list iterator.
// Example: 'any_vassal' -> ['any_', 'vassal']
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

// Check if a string is a list iterator (starts with any_, every_, random_, or ordered_).
export function isListIterator(name: string): boolean {
    return parseListIterator(name) !== null;
}

// Get the result scope type for a list iterator.
// For example, 'every_vassal' in character scope returns 'character' (vassals are characters).
// First checks the current scope's list definitions, then falls back to global lists
// (e.g., "living_character" works from any scope).
// Returns null if the iterator is invalid, or defaults to the current scope type.
export function getListResultScope(iterator: string, scopeType: string): string | null {
    const parsed = parseListIterator(iterator);

    if (!parsed) {
        return null;
    }

    const [prefix, baseName] = parsed;

    // Validate the list base is defined for this scope
    if (!isValidListBase(baseName, scopeType)) {
        serverLogger.warn(`SCOPE-006: Invalid list base '${baseName}' for scope type '${scopeType}'`);
        return null;
    }

    // Look up the result scope type from the data-driven scope definitions
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();

    // Check the current scope's list definitions first
    if (scopes.has(scopeType)) {
        const scopeData = scopes.get(scopeType)!;
        const lists = scopeData.lists;

        // If lists is a map (Record<string, string>), look up the result type directly
        if (lists && !Array.isArray(lists) && typeof lists === 'object') {
            const resultType = (lists as Record<string, string>)[baseName];
            if (resultType) {
                return resultType;
            }
        }
    }

    // Fall back: check all other scope types for global lists
    for (const [otherScopeType, scopeData] of scopes.entries()) {
        if (otherScopeType === scopeType) continue;
        const lists = scopeData.lists;
        if (lists && !Array.isArray(lists) && typeof lists === 'object') {
            const resultType = (lists as Record<string, string>)[baseName];
            if (resultType) {
                return resultType;
            }
        }
    }

    // Default: maintain the same scope type when no explicit mapping exists
    return scopeType;
}

// Get all valid scope types from the data loader (e.g., character, title, province, etc.).
export function getAllScopeTypes(): string[] {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    return Array.from(scopes.keys());
}

// Check if a scope type string is a recognized scope type.
export function isValidScopeType(scopeType: string): boolean {
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    return scopes.has(scopeType);
}

// Check if a key is a recognized scope link in ANY scope type.
// This helps distinguish scope navigation keys (liege, spouse, primary_title)
// from non-scope keys (effects, triggers, structural fields) when validating
// block-style scope transitions.
export function isAnyScopeLink(name: string): boolean {
    if (UNIVERSAL_LINKS.includes(name)) {
        return true;
    }
    const dataLoader = getDataLoader();
    const scopes = dataLoader.getScopes();
    for (const scopeData of scopes.values()) {
        const links = scopeData.links || {};
        if (name in links) {
            return true;
        }
    }
    return false;
}

// Get a human-readable documentation string for a scope link.
// Universal links get predefined descriptions; scope-specific links
// describe the navigation as "Navigate from X to Y".
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
