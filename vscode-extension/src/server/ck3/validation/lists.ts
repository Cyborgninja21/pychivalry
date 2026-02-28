/**
 * CK3 Script Lists Module - Collection Iteration and Validation
 * 
 * DIAGNOSTIC CODES:
 *     LIST-001: Invalid list iterator prefix
 *     LIST-002: Invalid parameter for iterator type
 *     LIST-003: Trigger used in effect iterator outside limit block
 *     LIST-004: Effect used in trigger iterator (any_)
 *     LIST-005: Unknown list base for scope type
 * 
 * This module provides comprehensive validation of CK3's list iteration system.
 * List patterns enable iteration over collections (vassals, courtiers, etc.)
 * with filtering, counting, and ordering.
 */

/**
 * Structured information about a parsed list iterator
 */
export interface ListIteratorInfo {
    /** The list iterator prefix: 'any_', 'every_', 'random_', 'ordered_' */
    prefix: string;
    /** The collection name after the prefix: 'vassal', 'courtier', etc. */
    baseName: string;
    /** Semantic type: 'trigger' (conditional) or 'effect' (state modification) */
    iteratorType: 'trigger' | 'effect';
    /** Valid parameters for this iterator type */
    supportedParams: string[];
}

/**
 * Configuration for list iterator prefixes
 * This is the single source of truth for iterator validation
 */
interface ListPrefixConfig {
    type: 'trigger' | 'effect';
    supportedParams: string[];
}

/**
 * Master configuration for all list iterator prefixes
 */
export const LIST_PREFIXES: Record<string, ListPrefixConfig> = {
    // any_: Conditional check - "does ANY element match?"
    any_: {
        type: 'trigger',
        supportedParams: [
            'count',    // Minimum matching elements: count >= 3
            'percent',  // Minimum matching percentage: percent >= 0.5
            'limit',    // Filter conditions: limit = { is_adult = yes }
        ],
    },
    // every_: Apply to all - "do this to EVERY matching element"
    every_: {
        type: 'effect',
        supportedParams: [
            'limit',             // Filter which elements: limit = { is_adult = yes }
            'max',               // Maximum elements to affect: max = 5
            'alternative_limit', // Fallback filter if limit matches nothing
        ],
    },
    // random_: Apply to one random - "pick ONE random matching element"
    random_: {
        type: 'effect',
        supportedParams: [
            'limit',                   // Filter which elements can be picked
            'weight',                  // Probability weighting: weight = { base = 10 }
            'save_temporary_scope_as', // Save selected element to variable
        ],
    },
    // ordered_: Apply in sort order - "do this in sorted order"
    ordered_: {
        type: 'effect',
        supportedParams: [
            'limit',                   // Filter which elements to process
            'order_by',                // Sort criteria: order_by = gold
            'position',                // Which position to process: position = 0
            'max',                     // Maximum elements to process
            'min',                     // Minimum elements required
            'check_range_bounds',      // Validate position is in bounds: yes/no
            'save_temporary_scope_as', // Save selected element to variable
        ],
    },
};

/**
 * Parse a list iterator identifier into structured information
 * 
 * This is the primary entry point for list iterator analysis.
 * Examines an identifier and determines if it matches any of the four
 * list iterator patterns (any_, every_, random_, ordered_).
 */
export function parseListIterator(identifier: string): ListIteratorInfo | null {
    // Iterate through all known list iterator prefixes (only 4, so O(1))
    for (const [prefix, config] of Object.entries(LIST_PREFIXES)) {
        // Check if identifier starts with this prefix
        if (identifier.startsWith(prefix)) {
            // Extract the base name by removing the prefix
            // Example: 'any_vassal' -> 'vassal'
            const baseName = identifier.substring(prefix.length);

            // Validate that there's actually a base name after the prefix
            // Empty base (like 'any_') is invalid
            if (baseName) {
                return {
                    prefix,
                    baseName,
                    iteratorType: config.type,
                    supportedParams: config.supportedParams,
                };
            }
        }
    }

    // No prefix matched - not a list iterator
    return null;
}

/**
 * Quick check if an identifier is a list iterator pattern
 */
export function isListIterator(identifier: string): boolean {
    return parseListIterator(identifier) !== null;
}

/**
 * Extract the list of supported parameters from iterator info
 */
export function getSupportedParameters(iteratorInfo: ListIteratorInfo): string[] {
    return iteratorInfo.supportedParams;
}

/**
 * Check if a parameter is valid for a list iterator
 */
export function isValidParameter(iteratorInfo: ListIteratorInfo, parameter: string): boolean {
    return iteratorInfo.supportedParams.includes(parameter);
}

/**
 * Get the iterator type (trigger or effect)
 */
export function getIteratorType(identifier: string): 'trigger' | 'effect' | null {
    const info = parseListIterator(identifier);
    return info ? info.iteratorType : null;
}

/**
 * Check if an iterator is a trigger-type iterator (any_)
 */
export function isTriggerIterator(identifier: string): boolean {
    return getIteratorType(identifier) === 'trigger';
}

/**
 * Check if an iterator is an effect-type iterator (every_, random_, ordered_)
 */
export function isEffectIterator(identifier: string): boolean {
    return getIteratorType(identifier) === 'effect';
}

/**
 * Valid list bases for each scope type
 * These define what collections can be iterated for each scope
 */
export const SCOPE_LIST_BASES: Record<string, Set<string>> = {
    character: new Set([
        'vassal',
        'courtier',
        'prisoner',
        'child',
        'sibling',
        'parent',
        'spouse',
        'consort',
        'close_family_member',
        'extended_family_member',
        'dynasty_member',
        'house_member',
        'ally',
        'enemy',
        'realm_province',
        'held_title',
        'claim',
        'scheme',
        'secret',
        'owned_story',
        'character_artifact',
        'character_memory',
        'relation',
        'vassal_or_below',
        'liege_or_above',
        'former_spouse',
        'trait',
        'councillor',
        'knight',
        'pool_guest',
        'traveling_family_member',
        'betrothed',
    ]),
    title: new Set([
        'de_jure_county',
        'de_jure_duchy',
        'de_jure_kingdom',
        'de_jure_empire',
        'de_jure_liege',
        'de_jure_vassal',
        'de_jure_top_liege',
        'de_facto_vassal',
        'lessee',
        'election_candidate',
        'title_heir',
        'title_claimant',
        'title_joined_faction',
        'in_de_jure_hierarchy',
        'this_title_or_de_jure_above',
    ]),
    province: new Set([
        'neighboring_province',
        'county_province',
        'barony',
        'holy_order',
        'mercenary_company',
    ]),
    war: new Set([
        'war_attacker',
        'war_defender',
        'war_participant',
    ]),
    faith: new Set([
        'holy_order',
        'faith_character',
        'faith_holy_site',
    ]),
    culture: new Set([
        'culture_character',
    ]),
};

/**
 * Check if a list base is valid for a scope type
 */
export function isValidListBase(baseName: string, scopeType: string): boolean {
    const validBases = SCOPE_LIST_BASES[scopeType];
    if (!validBases) {
        return false;
    }
    return validBases.has(baseName);
}

/**
 * Get all valid list bases for a scope type
 */
export function getValidListBases(scopeType: string): string[] {
    const validBases = SCOPE_LIST_BASES[scopeType];
    return validBases ? Array.from(validBases) : [];
}

/**
 * Get the result scope type for a list iterator
 * Returns the scope type that the iterator will produce
 */
export function getListResultScope(baseName: string): string | null {
    // Map list bases to their result scope types
    const scopeMapping: Record<string, string> = {
        // Character collections
        vassal: 'character',
        courtier: 'character',
        prisoner: 'character',
        child: 'character',
        sibling: 'character',
        parent: 'character',
        spouse: 'character',
        consort: 'character',
        close_family_member: 'character',
        extended_family_member: 'character',
        dynasty_member: 'character',
        house_member: 'character',
        ally: 'character',
        enemy: 'character',
        councillor: 'character',
        knight: 'character',
        pool_guest: 'character',
        traveling_family_member: 'character',
        betrothed: 'character',
        vassal_or_below: 'character',
        liege_or_above: 'character',
        former_spouse: 'character',

        // Title collections
        held_title: 'title',
        claim: 'title',
        de_jure_county: 'title',
        de_jure_duchy: 'title',
        de_jure_kingdom: 'title',
        de_jure_empire: 'title',
        de_jure_liege: 'title',
        de_jure_vassal: 'title',
        de_jure_top_liege: 'title',
        de_facto_vassal: 'title',
        lessee: 'title',
        election_candidate: 'title',
        title_heir: 'title',
        title_claimant: 'title',
        title_joined_faction: 'title',
        in_de_jure_hierarchy: 'title',
        this_title_or_de_jure_above: 'title',

        // Province collections
        realm_province: 'province',
        neighboring_province: 'province',
        county_province: 'province',
        barony: 'province',

        // Other collections
        scheme: 'scheme',
        secret: 'secret',
        owned_story: 'story',
        character_artifact: 'artifact',
        character_memory: 'memory',
        relation: 'character',
        trait: 'trait',
        holy_order: 'holy_order',
        mercenary_company: 'mercenary_company',
        war_attacker: 'character',
        war_defender: 'character',
        war_participant: 'character',
        faith_character: 'character',
        faith_holy_site: 'province',
        culture_character: 'character',
    };

    return scopeMapping[baseName] || null;
}

/**
 * Validate a list iterator block content
 * Checks if the content is appropriate for the iterator type
 */
export function validateListBlockContent(
    iteratorInfo: ListIteratorInfo,
    contentType: 'trigger' | 'effect'
): { isValid: boolean; error?: string } {
    // any_ blocks can ONLY contain triggers
    if (iteratorInfo.iteratorType === 'trigger' && contentType === 'effect') {
        return {
            isValid: false,
            error: 'Effect used in trigger iterator (any_). Use every_, random_, or ordered_ for effects.',
        };
    }

    // every_/random_/ordered_ blocks primarily contain effects
    // Triggers must be inside limit = { }
    if (iteratorInfo.iteratorType === 'effect' && contentType === 'trigger') {
        return {
            isValid: false,
            error: 'Trigger used in effect iterator outside limit block. Wrap triggers in limit = { }.',
        };
    }

    return { isValid: true };
}

/**
 * Get suggested list iterators for a scope type
 * Returns common iterator patterns for the given scope
 */
export function suggestListIterators(scopeType: string): string[] {
    const bases = getValidListBases(scopeType);
    const suggestions: string[] = [];

    // Generate suggestions for the most common bases
    const commonBases = bases.slice(0, 5); // Top 5 most common
    for (const base of commonBases) {
        suggestions.push(`any_${base}`);
        suggestions.push(`every_${base}`);
        suggestions.push(`random_${base}`);
    }

    return suggestions;
}

/**
 * Get documentation for a list iterator
 */
export function getListIteratorDocumentation(identifier: string): string | null {
    const info = parseListIterator(identifier);
    if (!info) {
        return null;
    }

    const typeDesc = info.iteratorType === 'trigger' 
        ? 'Checks if any element matches conditions'
        : 'Applies effects to matching elements';

    const paramDocs = info.supportedParams.map(p => `  - ${p}`).join('\n');

    return `**${identifier}**\n\n${typeDesc}\n\n**Supported parameters:**\n${paramDocs}`;
}
