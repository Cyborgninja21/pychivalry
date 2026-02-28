/**
 * Advanced Scope Validation Features for CK3 Scripts
 * 
 * This module provides advanced scope tracking and validation features:
 * - Saved scope handling (prev, root, from, fromfrom)
 * - Scope history tracking through complex chains
 * - Compare operator scope tracking
 * - Context-aware scope validation
 * - Advanced scope chain resolution
 * 
 * DIAGNOSTIC CODES:
 *   SCOPE-007: Invalid saved scope reference
 *   SCOPE-008: Scope history violation
 *   SCOPE-009: Invalid compare operator scope
 *   SCOPE-010: Scope chain resolution failed
 */

import { ASTNode } from '../../core/parser';

/**
 * Scope context tracks the scope state during script execution
 */
export interface ScopeContext {
    current: string;          // Current scope type
    root: string;             // Original starting scope
    prev: string | null;      // Previous scope in transition
    from: string | null;      // Scope that triggered current context
    fromfrom: string | null;  // Two levels back in trigger chain
    history: string[];        // History of scope transitions
}

/**
 * Create initial scope context
 */
export function createScopeContext(startingScope: string): ScopeContext {
    return {
        current: startingScope,
        root: startingScope,
        prev: null,
        from: null,
        fromfrom: null,
        history: [startingScope]
    };
}

/**
 * Transition to a new scope, updating context
 */
export function transitionScope(
    context: ScopeContext,
    newScope: string,
    link: string
): ScopeContext {
    return {
        current: newScope,
        root: context.root,
        prev: context.current,
        from: context.current,
        fromfrom: context.from,
        history: [...context.history, newScope]
    };
}

/**
 * Handle universal scope links (root, this, prev, from, fromfrom)
 */
export function resolveUniversalScope(
    link: string,
    context: ScopeContext
): string | null {
    switch (link) {
        case 'root':
            return context.root;
        case 'this':
            return context.current;
        case 'prev':
            return context.prev;
        case 'from':
            return context.from;
        case 'fromfrom':
            return context.fromfrom;
        default:
            return null;
    }
}

/**
 * Validate that a saved scope reference is valid in the current context
 */
export function validateSavedScope(
    link: string,
    context: ScopeContext
): { valid: boolean; error?: string } {
    const universalLinks = ['root', 'this', 'prev', 'from', 'fromfrom'];
    
    if (!universalLinks.includes(link)) {
        return { valid: true }; // Not a saved scope
    }
    
    const resolvedScope = resolveUniversalScope(link, context);
    
    if (resolvedScope === null) {
        return {
            valid: false,
            error: `Saved scope '${link}' is not available in this context`
        };
    }
    
    return { valid: true };
}

/**
 * Track scope through compare operators (>, <, >=, <=, ==, !=)
 * These operators compare two scope values
 */
export interface CompareOperation {
    operator: string;
    leftScope: string;
    rightScope: string;
    valid: boolean;
    error?: string;
}

/**
 * Validate compare operator scope compatibility
 */
export function validateCompareOperation(
    leftScope: string,
    rightScope: string,
    operator: string
): CompareOperation {
    // Both scopes must be the same type for comparison
    if (leftScope !== rightScope) {
        return {
            operator,
            leftScope,
            rightScope,
            valid: false,
            error: `Cannot compare ${leftScope} with ${rightScope} - types must match`
        };
    }
    
    // Certain types cannot be compared
    const nonComparableTypes = ['trigger', 'effect', 'value'];
    if (nonComparableTypes.includes(leftScope)) {
        return {
            operator,
            leftScope,
            rightScope,
            valid: false,
            error: `Scope type ${leftScope} cannot be used in comparisons`
        };
    }
    
    return {
        operator,
        leftScope,
        rightScope,
        valid: true
    };
}

/**
 * Advanced scope chain resolution with full context tracking
 */
export function resolveScopeChainAdvanced(
    chain: string,
    context: ScopeContext,
    getScopeLink: (scope: string, link: string) => string | null
): { valid: boolean; resultScope: string | null; error?: string; context: ScopeContext } {
    const parts = chain.split('.');
    let currentScope = context.current;
    let newContext = { ...context };
    
    for (let i = 0; i < parts.length; i++) {
        const link = parts[i];
        
        // Check if it's a universal link
        const universalScope = resolveUniversalScope(link, newContext);
        if (universalScope !== null) {
            currentScope = universalScope;
            newContext.history.push(currentScope);
            continue;
        }
        
        // Regular scope link
        const nextScope = getScopeLink(currentScope, link);
        if (nextScope === null) {
            return {
                valid: false,
                resultScope: null,
                error: `Invalid scope link '${link}' from scope '${currentScope}'`,
                context: newContext
            };
        }
        
        // Update context
        newContext = transitionScope(newContext, nextScope, link);
        currentScope = nextScope;
    }
    
    return {
        valid: true,
        resultScope: currentScope,
        context: newContext
    };
}

/**
 * Detect scope loops in chains (e.g., a.b.c.a)
 */
export function detectScopeLoop(history: string[]): boolean {
    if (history.length < 2) {
        return false;
    }
    
    const lastScope = history[history.length - 1];
    const previousOccurrences = history.slice(0, -1).filter(s => s === lastScope);
    
    return previousOccurrences.length > 0;
}

/**
 * Find the most efficient scope chain between two scope types
 */
export interface ScopePathResult {
    path: string[];
    length: number;
    valid: boolean;
}

/**
 * Suggest alternative scope chains if the current one is invalid
 */
export function suggestAlternativeChains(
    targetScope: string,
    currentScope: string,
    getAllLinks: (scope: string) => string[]
): string[][] {
    const suggestions: string[][] = [];
    const maxDepth = 3;
    
    function searchPaths(
        scope: string,
        target: string,
        path: string[],
        depth: number
    ): void {
        if (depth > maxDepth) return;
        if (scope === target) {
            suggestions.push([...path]);
            return;
        }
        
        const links = getAllLinks(scope);
        for (const link of links) {
            if (!path.includes(link)) {  // Avoid immediate loops
                searchPaths(link, target, [...path, link], depth + 1);
            }
        }
    }
    
    searchPaths(currentScope, targetScope, [], 0);
    
    // Sort by length (shorter paths first)
    return suggestions.sort((a, b) => a.length - b.length).slice(0, 5);
}

/**
 * Validate scope usage in a node hierarchy
 */
export function validateNodeScopeUsage(
    node: ASTNode,
    expectedScope: string,
    getCurrentScope: (node: ASTNode) => string
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const actualScope = getCurrentScope(node);
    
    if (actualScope !== expectedScope) {
        errors.push(
            `Expected scope '${expectedScope}' but found '${actualScope}' at line ${node.range.start.line}`
        );
    }
    
    // Recursively validate children
    if (node.children) {
        for (const child of node.children) {
            const childResult = validateNodeScopeUsage(child, expectedScope, getCurrentScope);
            errors.push(...childResult.errors);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Track scopes through conditional blocks (if/else/else_if)
 */
export interface ConditionalScopeInfo {
    condition: string;
    trueScope: string;
    falseScope: string | null;
    branches: Array<{
        condition: string;
        scope: string;
    }>;
}

/**
 * Merge scope possibilities from multiple branches
 */
export function mergeScopePossibilities(scopes: string[]): string[] {
    // Remove duplicates
    return Array.from(new Set(scopes));
}

/**
 * Get detailed scope information for diagnostics
 */
export interface ScopeInfo {
    type: string;
    description: string;
    availableLinks: string[];
    availableLists: string[];
    examples: string[];
}

/**
 * Get comprehensive scope information for hover/documentation
 */
export function getScopeInfo(scopeType: string): ScopeInfo {
    const scopeDescriptions: Record<string, string> = {
        'character': 'A character in the game (ruler, courtier, etc.)',
        'landed_title': 'A landed title (county, duchy, kingdom, empire)',
        'province': 'A province/barony on the map',
        'faith': 'A religion/faith',
        'culture': 'A cultural group',
        'dynasty': 'A dynasty/bloodline',
        'house': 'A cadet branch of a dynasty'
    };
    
    const scopeExamples: Record<string, string[]> = {
        'character': [
            'root.liege.primary_title',
            'this.spouse.location',
            'prev.father.dynasty'
        ],
        'landed_title': [
            'root.primary_title.holder',
            'this.de_jure_liege',
            'prev.capital_county'
        ],
        'province': [
            'root.location.county',
            'this.barony.holder'
        ]
    };
    
    return {
        type: scopeType,
        description: scopeDescriptions[scopeType] || 'Unknown scope type',
        availableLinks: [], // Would be populated from scope data
        availableLists: [], // Would be populated from scope data
        examples: scopeExamples[scopeType] || []
    };
}

/**
 * Performance: Cache scope chain validations
 */
const MAX_SCOPE_CACHE_SIZE = 1000;
const scopeChainCache = new Map<string, { valid: boolean; result: string | null }>();

export function cachedValidateScopeChain(
    chain: string,
    startScope: string,
    validator: (chain: string, start: string) => { valid: boolean; result: string | null }
): { valid: boolean; result: string | null } {
    const cacheKey = `${startScope}::${chain}`;

    if (scopeChainCache.has(cacheKey)) {
        return scopeChainCache.get(cacheKey)!;
    }

    const result = validator(chain, startScope);

    // Evict oldest entry if cache is full
    if (scopeChainCache.size >= MAX_SCOPE_CACHE_SIZE) {
        const firstKey = scopeChainCache.keys().next().value;
        if (firstKey !== undefined) scopeChainCache.delete(firstKey);
    }
    scopeChainCache.set(cacheKey, result);

    return result;
}

/**
 * Clear the scope chain cache (call when data reloads)
 */
export function clearScopeChainCache(): void {
    scopeChainCache.clear();
}
