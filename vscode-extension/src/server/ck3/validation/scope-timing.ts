/**
 * CK3 Scope Timing Validation - The Golden Rule of Event Scripting
 * 
 * DIAGNOSTIC CODES:
 *     CK3550: Scope used in trigger but defined in immediate
 *     CK3551: Scope used in desc but defined in immediate
 *     CK3552: Scope used in triggered_desc trigger but defined in immediate
 *     CK3553: Variable checked before being set
 *     CK3554: Temporary scope used across events (lost between events)
 *     CK3555: Scope needed in triggered event but not passed
 *     CK3560: Scope used in desc localization but defined in immediate
 *     CK3561: Scope used in title localization but defined in immediate
 *     CK3562: Scope may be used in desc block but defined in immediate
 * 
 * THE GOLDEN RULE:
 *     Event Evaluation Order:
 *     1. trigger = { }         ← Evaluated FIRST (pre-display)
 *     2. desc = { }            ← Evaluated SECOND (pre-display)
 *        triggered_desc        ← Triggers evaluated here too
 *     3. immediate = { }       ← Runs THIRD (execution begins)
 *     4. portraits             ← Displayed FOURTH (immediate done)
 *     5. options               ← Rendered FIFTH (user choice)
 *     
 *     Scopes created in immediate (step 3) are NOT available in steps 1-2!
 * 
 * COMMON VIOLATIONS:
 *     Example 1: Scope in Trigger (CK3550)
 *     ```
 *     my_event = {
 *         trigger = {
 *             scope:saved_target = { is_alive = yes }  # ❌ CK3550
 *         }
 *         immediate = {
 *             save_scope_as = saved_target             # Created here
 *         }
 *     }
 *     ```
 *     Fix: Move save_scope_as before immediate, or remove from trigger.
 *     
 *     Example 2: Scope in Triggered Desc (CK3552)
 *     ```
 *     my_event = {
 *         desc = {
 *             triggered_desc = {
 *                 trigger = { scope:enemy = { exists = yes } }  # ❌ CK3552
 *             }
 *         }
 *         immediate = {
 *             save_scope_as = enemy              # Created here
 *         }
 *     }
 *     ```
 *     Fix: Pass scope via trigger_event or create in parent event.
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';

/**
 * Configuration for scope timing checks
 */
export interface ScopeTimingConfig {
    checkTriggerBlock: boolean;
    checkDescBlock: boolean;
    checkTriggeredDesc: boolean;
    checkVariables: boolean;
    checkTemporaryScopes: boolean;
}

/**
 * Default configuration - all checks enabled
 */
export const DEFAULT_SCOPE_TIMING_CONFIG: ScopeTimingConfig = {
    checkTriggerBlock: true,
    checkDescBlock: true,
    checkTriggeredDesc: true,
    checkVariables: true,
    checkTemporaryScopes: true
};

/**
 * Built-in scopes that don't require save_scope_as
 * These are always available and should NOT trigger timing violations
 */
const BUILTIN_SCOPES = new Set([
    'root', 'this', 'prev', 'from', 'actor', 'recipient',
    'liege', 'spouse', 'father', 'mother', 'killer',
    'imprisoner', 'guardian', 'player', 'character',
    'title', 'faith', 'culture', 'scope', 'prevprev',
    'prevprevprev', 'prevprevprevprev'
]);

/**
 * Create a scope timing diagnostic
 */
function createTimingDiagnostic(
    message: string,
    range: Range,
    code: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
): Diagnostic {
    return {
        message,
        severity,
        range,
        code,
        source: 'ck3-ls-timing'
    };
}

/**
 * Extract all scope:xxx references from a node and its children
 * Returns set of scope names (without 'scope:' prefix)
 */
function extractScopeReferences(node: ASTNode): Set<string> {
    const scopes = new Set<string>();

    // Check the node key
    if (node.key?.startsWith('scope:')) {
        scopes.add(node.key.substring(6)); // Remove 'scope:' prefix
    }

    // Check the node value if it's a string
    if (typeof node.value === 'string' && node.value.startsWith('scope:')) {
        scopes.add(node.value.substring(6));
    }

    // Recurse into children
    for (const child of (node.children || [])) {
        const childScopes = extractScopeReferences(child);
        childScopes.forEach(s => scopes.add(s));
    }

    return scopes;
}

/**
 * Extract scope names defined via save_scope_as in a node and its children
 * Returns set of scope names that are defined
 */
function extractScopeDefinitions(node: ASTNode): Set<string> {
    const scopes = new Set<string>();

    if (node.key === 'save_scope_as' && typeof node.value === 'string') {
        scopes.add(node.value);
    }

    for (const child of (node.children || [])) {
        const childScopes = extractScopeDefinitions(child);
        childScopes.forEach(s => scopes.add(s));
    }

    return scopes;
}

/**
 * Extract temporary scope names defined via save_temporary_scope_as
 * Returns set of temporary scope names
 */
function extractTemporaryScopeDefinitions(node: ASTNode): Set<string> {
    const scopes = new Set<string>();

    if (node.key === 'save_temporary_scope_as' && typeof node.value === 'string') {
        scopes.add(node.value);
    }

    for (const child of (node.children || [])) {
        const childScopes = extractTemporaryScopeDefinitions(child);
        childScopes.forEach(s => scopes.add(s));
    }

    return scopes;
}

/**
 * Extract variable references (var:xxx, has_variable = xxx)
 * Returns set of variable names referenced
 */
function extractVariableReferences(node: ASTNode): Set<string> {
    const variables = new Set<string>();

    // Check for var: prefix
    if (node.key?.startsWith('var:')) {
        variables.add(node.key.substring(4));
    }
    if (typeof node.value === 'string' && node.value.startsWith('var:')) {
        variables.add(node.value.substring(4));
    }

    // Check for has_variable
    // Note: has_variable checks for EXISTENCE, not value.
    // Using has_variable in trigger with set_variable in immediate is a valid
    // "fire once" pattern (NOT = { has_variable = X } / set_variable = X).
    // Only flag var: references as problematic timing, not existence checks.
    // if (node.key === 'has_variable' && typeof node.value === 'string') {
    //     variables.add(node.value);
    // }

    for (const child of (node.children || [])) {
        const childVars = extractVariableReferences(child);
        childVars.forEach(v => variables.add(v));
    }

    return variables;
}

/**
 * Extract variable names defined via set_variable
 * Returns set of variable names that are defined
 */
function extractVariableDefinitions(node: ASTNode): Set<string> {
    const variables = new Set<string>();

    if (node.key === 'set_variable') {
        for (const child of (node.children || [])) {
            if (child.key === 'name' && typeof child.value === 'string') {
                variables.add(child.value);
            }
        }
    }

    for (const child of (node.children || [])) {
        const childVars = extractVariableDefinitions(child);
        childVars.forEach(v => variables.add(v));
    }

    return variables;
}

/**
 * Find all child nodes with a specific key
 */
function findNodesWithKey(node: ASTNode, key: string): ASTNode[] {
    const results: ASTNode[] = [];

    if (node.key === key) {
        results.push(node);
    }

    for (const child of (node.children || [])) {
        results.push(...findNodesWithKey(child, key));
    }

    return results;
}

/**
 * Find all nodes that reference a specific scope
 */
function findScopeReferenceNodes(node: ASTNode, scopeName: string): ASTNode[] {
    const results: ASTNode[] = [];
    const target = `scope:${scopeName}`;

    if (node.key === target) {
        results.push(node);
    }
    if (typeof node.value === 'string' && node.value === target) {
        results.push(node);
    }

    for (const child of (node.children || [])) {
        results.push(...findScopeReferenceNodes(child, scopeName));
    }

    return results;
}

/**
 * Check a single event for scope timing issues (CK3550-CK3552)
 * 
 * Detects:
 * - CK3550: Scope used in trigger but defined in immediate
 * - CK3551: Scope used in desc but defined in immediate
 * - CK3552: Scope used in triggered_desc trigger but defined in immediate
 */
export function checkEventScopeTiming(
    eventNode: ASTNode,
    config: ScopeTimingConfig = DEFAULT_SCOPE_TIMING_CONFIG
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find the key blocks
    const triggerBlocks = (eventNode.children || []).filter((c: ASTNode) => c.key === 'trigger');
    const descBlocks = (eventNode.children || []).filter((c: ASTNode) => c.key === 'desc');
    const immediateBlocks = (eventNode.children || []).filter((c: ASTNode) => c.key === 'immediate');

    // Extract scopes defined in immediate
    const scopesInImmediate = new Set<string>();
    for (const immBlock of immediateBlocks) {
        const scopes = extractScopeDefinitions(immBlock);
        scopes.forEach(s => scopesInImmediate.add(s));
    }

    // If no scopes defined in immediate, nothing to check
    if (scopesInImmediate.size === 0) {
        return diagnostics;
    }

    // CK3550: Check trigger blocks for scope references
    if (config.checkTriggerBlock) {
        for (const triggerBlock of triggerBlocks) {
            const scopesUsed = extractScopeReferences(triggerBlock);

            // Find scopes that are used in trigger but defined in immediate
            const problematic = new Set([...scopesUsed].filter(s => scopesInImmediate.has(s)));

            for (const scopeName of problematic) {
                // Find the specific node for better error location
                const refNodes = findScopeReferenceNodes(triggerBlock, scopeName);
                for (const refNode of refNodes) {
                    diagnostics.push(createTimingDiagnostic(
                        `Scope 'scope:${scopeName}' used in trigger block but defined in immediate. Trigger evaluates BEFORE immediate runs. Pass scope from calling event or use variable check instead.`,
                        refNode.range,
                        'CK3550'
                    ));
                }
            }
        }
    }

    // CK3551/CK3552: Check desc blocks
    if (config.checkDescBlock || config.checkTriggeredDesc) {
        for (const descBlock of descBlocks) {
            // Check for direct scope references in desc
            const scopesUsed = extractScopeReferences(descBlock);

            // Handle triggered_desc specially
            const triggeredDescs = findNodesWithKey(descBlock, 'triggered_desc');

            if (config.checkTriggeredDesc) {
                for (const td of triggeredDescs) {
                    // Find trigger inside triggered_desc
                    const tdTriggers = (td.children || []).filter((c: ASTNode) => c.key === 'trigger');
                    for (const tdTrigger of tdTriggers) {
                        const tdScopes = extractScopeReferences(tdTrigger);
                        const problematic = new Set([...tdScopes].filter(s => scopesInImmediate.has(s)));

                        for (const scopeName of problematic) {
                            const refNodes = findScopeReferenceNodes(tdTrigger, scopeName);
                            for (const refNode of refNodes) {
                                diagnostics.push(createTimingDiagnostic(
                                    `Scope 'scope:${scopeName}' used in triggered_desc trigger but defined in immediate. triggered_desc triggers evaluate BEFORE immediate. Use variable check or pass scope from calling event.`,
                                    refNode.range,
                                    'CK3552'
                                ));
                            }
                        }
                    }
                }
            }

            // Check other desc scope references (CK3551)
            if (config.checkDescBlock) {
                const problematic = new Set([...scopesUsed].filter(s => scopesInImmediate.has(s)));

                // Exclude scopes that were already reported in triggered_desc
                const alreadyReported = new Set<string>();
                for (const td of triggeredDescs) {
                    const tdTriggers = (td.children || []).filter((c: ASTNode) => c.key === 'trigger');
                    for (const tdTrigger of tdTriggers) {
                        const tdScopes = extractScopeReferences(tdTrigger);
                        tdScopes.forEach(s => alreadyReported.add(s));
                    }
                }

                for (const scopeName of problematic) {
                    if (alreadyReported.has(scopeName)) continue;

                    const refNodes = findScopeReferenceNodes(descBlock, scopeName);
                    for (const refNode of refNodes) {
                        // Check if this is inside a triggered_desc trigger (already handled)
                        let isInTdTrigger = false;
                        for (const td of triggeredDescs) {
                            const tdTriggers = (td.children || []).filter((c: ASTNode) => c.key === 'trigger');
                            for (const tdTrigger of tdTriggers) {
                                if (findScopeReferenceNodes(tdTrigger, scopeName).length > 0) {
                                    isInTdTrigger = true;
                                    break;
                                }
                            }
                        }

                        if (!isInTdTrigger) {
                            diagnostics.push(createTimingDiagnostic(
                                `Scope 'scope:${scopeName}' used in desc block but defined in immediate. Desc may evaluate BEFORE immediate. Consider using triggered_desc with variable checks.`,
                                refNode.range,
                                'CK3551',
                                DiagnosticSeverity.Warning
                            ));
                        }
                    }
                }
            }
        }
    }

    return diagnostics;
}

/**
 * Check event for variable timing issues (CK3553)
 * 
 * Detects variables checked in trigger but set in immediate
 */
export function checkEventVariableTiming(
    eventNode: ASTNode,
    config: ScopeTimingConfig = DEFAULT_SCOPE_TIMING_CONFIG
): Diagnostic[] {
    if (!config.checkVariables) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Find the key blocks
    const triggerBlocks = (eventNode.children || []).filter((c: ASTNode) => c.key === 'trigger');
    const immediateBlocks = (eventNode.children || []).filter((c: ASTNode) => c.key === 'immediate');

    // Extract variables defined in immediate
    const varsInImmediate = new Set<string>();
    for (const immBlock of immediateBlocks) {
        const vars = extractVariableDefinitions(immBlock);
        vars.forEach(v => varsInImmediate.add(v));
    }

    // If no variables defined in immediate, nothing to check
    if (varsInImmediate.size === 0) {
        return diagnostics;
    }

    // Check trigger blocks for variable references
    for (const triggerBlock of triggerBlocks) {
        const varsUsed = extractVariableReferences(triggerBlock);

        // Find variables that are used in trigger but defined in immediate
        const problematic = new Set([...varsUsed].filter(v => varsInImmediate.has(v)));

        for (const varName of problematic) {
            diagnostics.push(createTimingDiagnostic(
                `Variable '${varName}' checked in trigger but set in immediate. Trigger evaluates BEFORE immediate runs. Set variable in parent event or before usage.`,
                triggerBlock.range,
                'CK3553'
            ));
        }
    }

    return diagnostics;
}

/**
 * Check event for temporary scope leakage (CK3554)
 * 
 * Detects temporary scopes that won't persist across events
 */
export function checkTemporaryScopeLeakage(
    eventNode: ASTNode,
    config: ScopeTimingConfig = DEFAULT_SCOPE_TIMING_CONFIG
): Diagnostic[] {
    if (!config.checkTemporaryScopes) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Find temporary scopes defined in the event
    const tempScopes = extractTemporaryScopeDefinitions(eventNode);

    // Check if any trigger_event calls try to pass these temporary scopes
    const triggerEventNodes = findNodesWithKey(eventNode, 'trigger_event');

    for (const triggerEvent of triggerEventNodes) {
        // Check for scope parameter passing
        for (const child of (triggerEvent.children || [])) {
            if (child.key === 'scope' && typeof child.value === 'string') {
                // Check if this is a temporary scope
                const scopeRef = child.value.startsWith('scope:') 
                    ? child.value.substring(6) 
                    : child.value;

                if (tempScopes.has(scopeRef)) {
                    diagnostics.push(createTimingDiagnostic(
                        `Temporary scope '${scopeRef}' is passed to triggered event but will not persist. Use save_scope_as instead of save_temporary_scope_as if scope needs to cross event boundaries.`,
                        child.range,
                        'CK3554',
                        DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    return diagnostics;
}

/**
 * Main validation function - checks all scope timing issues in an event
 * 
 * Returns diagnostics for:
 * - CK3550-CK3552: Scope timing violations
 * - CK3553: Variable timing violations
 * - CK3554: Temporary scope leakage
 */
export function validateScopeTiming(
    eventNode: ASTNode,
    config: ScopeTimingConfig = DEFAULT_SCOPE_TIMING_CONFIG
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check scope timing (CK3550-CK3552)
    diagnostics.push(...checkEventScopeTiming(eventNode, config));

    // Check variable timing (CK3553)
    diagnostics.push(...checkEventVariableTiming(eventNode, config));

    // Check temporary scope leakage (CK3554)
    diagnostics.push(...checkTemporaryScopeLeakage(eventNode, config));

    return diagnostics;
}

/**
 * Validate scope timing for all events in a document
 */
export function validateDocumentScopeTiming(
    rootNode: ASTNode,
    config: ScopeTimingConfig = DEFAULT_SCOPE_TIMING_CONFIG
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find all event nodes (they have keys like namespace.number)
    function isEventNode(node: ASTNode): boolean {
        return node.key ? /^[a-z_]+\.\d+$/.test(node.key) : false;
    }

    function findEvents(node: ASTNode): ASTNode[] {
        const events: ASTNode[] = [];

        if (isEventNode(node)) {
            events.push(node);
        }

        for (const child of (node.children || [])) {
            events.push(...findEvents(child));
        }

        return events;
    }

    const events = findEvents(rootNode);

    for (const event of events) {
        diagnostics.push(...validateScopeTiming(event, config));
    }

    return diagnostics;
}

/**
 * Get a description for a scope timing diagnostic code
 */
export function getScopeTimingDiagnosticDescription(code: string): string {
    switch (code) {
        case 'CK3550':
            return 'Scope used in trigger but defined in immediate block. Trigger evaluates BEFORE immediate runs.';
        case 'CK3551':
            return 'Scope used in desc block but defined in immediate. Desc may evaluate BEFORE immediate runs.';
        case 'CK3552':
            return 'Scope used in triggered_desc trigger but defined in immediate. Triggered triggers evaluate BEFORE immediate runs.';
        case 'CK3553':
            return 'Variable checked before being set. Variable is set in immediate but checked in trigger.';
        case 'CK3554':
            return 'Temporary scope passed to another event. Temporary scopes do not persist across events.';
        case 'CK3555':
            return 'Scope needed in triggered event but not passed. Add scope parameter to trigger_event call.';
        case 'CK3560':
            return 'Scope used in desc localization but defined in immediate. Desc localization evaluates BEFORE immediate runs.';
        case 'CK3561':
            return 'Scope used in title localization but defined in immediate. Title localization evaluates BEFORE immediate runs.';
        case 'CK3562':
            return 'Scope may be used in desc block but defined in immediate. Consider triggered_desc with variable checks.';
        default:
            return 'Scope timing violation detected.';
    }
}
