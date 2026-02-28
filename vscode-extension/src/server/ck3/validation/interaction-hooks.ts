/**
 * Interaction Hook Validation
 *
 * Validates that hooks used in character_interaction, activity, and scheme
 * definitions are from the known set of 150 hooks extracted from the CK3 binary.
 *
 * DIAGNOSTIC CODES:
 *     HOOK-001: Unknown interaction hook name
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';
import { DataLoader, InteractionHookDefinition } from '../../data/loader';

export interface InteractionHookConfig {
    enabled: boolean;
}

export const DEFAULT_INTERACTION_HOOK_CONFIG: InteractionHookConfig = {
    enabled: true,
};

/**
 * Validate interaction hooks in the given AST.
 * Walks the AST looking for character_interaction blocks and validates
 * that any on_* fields use known hook names.
 */
export function validateInteractionHooks(
    node: ASTNode,
    config: InteractionHookConfig
): Diagnostic[] {
    if (!config.enabled) return [];

    const dataLoader = DataLoader.getInstance();
    const knownHooks = dataLoader.getInteractionHooks();

    // If no hook data loaded, skip validation
    if (knownHooks.size === 0) return [];

    const diagnostics: Diagnostic[] = [];
    walkForInteractionBlocks(node, knownHooks, diagnostics);
    return diagnostics;
}

/**
 * Known parent block types that contain interaction hooks
 */
const HOOK_PARENT_TYPES = new Set([
    'character_interaction',
    'activity_type',
    'scheme_type',
]);

/**
 * Walk AST looking for blocks that might contain interaction hooks
 */
function walkForInteractionBlocks(
    node: ASTNode,
    knownHooks: Map<string, InteractionHookDefinition>,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    for (const child of node.children) {
        // Check if this child is an on_* field inside a relevant parent
        if (child.key && child.key.startsWith('on_') && child.children) {
            // This is a hook-like field — validate it
            if (!knownHooks.has(child.key)) {
                // Find the closest match for suggestion
                const suggestion = findClosestHook(child.key, knownHooks);
                const message = suggestion
                    ? `Unknown interaction hook '${child.key}'. Did you mean '${suggestion}'?`
                    : `Unknown interaction hook '${child.key}'`;

                diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message,
                    code: 'HOOK-001',
                    source: 'ck3-hooks',
                });
            }
        }

        // Recurse into children
        walkForInteractionBlocks(child, knownHooks, diagnostics);
    }
}

/**
 * Find the closest matching hook name using simple edit distance heuristic
 */
function findClosestHook(
    name: string,
    knownHooks: Map<string, InteractionHookDefinition>
): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const hookName of knownHooks.keys()) {
        // Simple prefix/suffix matching score
        const score = commonPrefixLength(name, hookName) + commonSuffixLength(name, hookName);
        if (score > bestScore && score >= 5) {
            bestScore = score;
            bestMatch = hookName;
        }
    }

    return bestMatch;
}

function commonPrefixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
}

function commonSuffixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    return i;
}
