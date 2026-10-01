/**
 * Convention, control-flow and localization-reference checks (engine plug-in).
 *
 * Moved unchanged from the retired diagnostics coordinator (ck3/validation/diagnostics.ts):
 * the package describes none of these rules, so they stay as a plug-in.
 *
 * DIAGNOSTIC CODES:
 *     CONV-001..CONV-003: event with options missing type / title / desc
 *     CONV-004: option block without a name
 *     COND-001: if / else_if / trigger_if / trigger_else_if without limit
 *     COND-002: else / trigger_else with a limit
 *     COND-003: else / trigger_else without a preceding if
 *     LOC-001: title/desc/name value with spaces (literal text instead of a key)
 *     LOC-002: tooltip value with spaces
 *     CK4100: localization key not found in the localization index
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode, LocalizationIndex } from 'pychivalry-engine';

/** Convention checks: CONV-001..CONV-004. */
export function validateConventions(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    checkCK3Conventions(node, diagnostics);
    return diagnostics;
}

/** Control-flow ordering checks: COND-001..COND-003. */
export function validateConditionalBlocks(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    walkConditionalBlocks(node, diagnostics);
    return diagnostics;
}

/** Localization-reference checks: LOC-001, LOC-002 and (with an index) CK4100. */
export function validateLocalizationReferences(
    node: ASTNode,
    localizationIndex?: LocalizationIndex
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    checkLocalizationKeys(node, diagnostics, localizationIndex);
    return diagnostics;
}

/**
 * CK3-specific convention checks on AST nodes
 */
function checkCK3Conventions(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    for (const child of node.children) {
        // Events should have a type field
        if (child.key && child.key.includes('.') && child.children) {
            const hasOption = child.children.some((c) => c.key === 'option');

            if (hasOption) {
                const hasType = child.children.some((c) => c.key === 'type');
                if (!hasType) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: `Event '${child.key}' is missing 'type' field`,
                        code: 'CONV-001',
                        source: 'ck3-convention',
                    });
                }

                const hasTitle = child.children.some((c) => c.key === 'title');
                if (!hasTitle) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: child.range,
                        message: `Event '${child.key}' is missing 'title' localization key`,
                        code: 'CONV-002',
                        source: 'ck3-convention',
                    });
                }

                const hasDesc = child.children.some((c) => c.key === 'desc');
                if (!hasDesc) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Information,
                        range: child.range,
                        message: `Event '${child.key}' is missing 'desc' localization key`,
                        code: 'CONV-003',
                        source: 'ck3-convention',
                    });
                }
            }
        }

        // Option blocks should have a name
        if (child.key === 'option' && child.children) {
            const hasName = child.children.some((c) => c.key === 'name');
            if (!hasName) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: "Option block is missing a 'name' field for localization",
                    code: 'CONV-004',
                    source: 'ck3-convention',
                });
            }
        }

        checkCK3Conventions(child, diagnostics);
    }
}

function walkConditionalBlocks(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) {
        return;
    }

    let lastConditionalKey: string | null = null;

    for (const child of node.children) {
        if (!child.key) {
            continue;
        }

        // trigger_if / trigger_else_if must have 'limit'
        if ((child.key === 'trigger_if' || child.key === 'trigger_else_if') && child.children) {
            const hasLimit = child.children.some((c) => c.key === 'limit');
            if (!hasLimit) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: `'${child.key}' is missing required 'limit' block`,
                    code: 'COND-001',
                    source: 'ck3-conditional',
                });
            }
            lastConditionalKey = child.key;
        }
        // trigger_else should NOT have 'limit'
        else if (child.key === 'trigger_else' && child.children) {
            const hasLimit = child.children.some((c) => c.key === 'limit');
            if (hasLimit) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message:
                        "'trigger_else' should not have a 'limit' block - use 'trigger_else_if' instead",
                    code: 'COND-002',
                    source: 'ck3-conditional',
                });
            }
            // Check for orphaned trigger_else
            if (lastConditionalKey !== 'trigger_if' && lastConditionalKey !== 'trigger_else_if') {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: "'trigger_else' without preceding 'trigger_if'",
                    code: 'COND-003',
                    source: 'ck3-conditional',
                });
            }
            lastConditionalKey = child.key;
        }
        // Effect-side: if/else_if must have 'limit', else should not
        else if ((child.key === 'if' || child.key === 'else_if') && child.children) {
            const hasLimit = child.children.some((c) => c.key === 'limit');
            if (!hasLimit) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: `'${child.key}' is missing required 'limit' block`,
                    code: 'COND-001',
                    source: 'ck3-conditional',
                });
            }
            lastConditionalKey = child.key;
        } else if (child.key === 'else' && child.children) {
            const hasLimit = child.children.some((c) => c.key === 'limit');
            if (hasLimit) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: "'else' should not have a 'limit' block - use 'else_if' instead",
                    code: 'COND-002',
                    source: 'ck3-conditional',
                });
            }
            if (lastConditionalKey !== 'if' && lastConditionalKey !== 'else_if') {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: "'else' without preceding 'if'",
                    code: 'COND-003',
                    source: 'ck3-conditional',
                });
            }
            lastConditionalKey = child.key;
        } else {
            // Non-conditional node resets the chain
            lastConditionalKey = null;
        }

        // Recurse into children
        walkConditionalBlocks(child, diagnostics);
    }
}

/**
 * Check localization key references in the AST
 */
function checkLocalizationKeys(
    node: ASTNode,
    diagnostics: Diagnostic[],
    localizationIndex?: LocalizationIndex
): void {
    if (!node.children) {
        return;
    }

    for (const child of node.children) {
        // Check title, desc, name fields for localization key format
        if (
            (child.key === 'title' || child.key === 'desc' || child.key === 'name') &&
            child.value &&
            typeof child.value === 'string'
        ) {
            const locKey = child.value;
            if (locKey.includes(' ') && !locKey.startsWith('"')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: `'${locKey}' contains spaces - this should be a localization key, not literal text`,
                    code: 'LOC-001',
                    source: 'ck3-localization',
                });
            }

            // Cross-file: check if loc key exists in the localization index.
            // `name` inside a variable effect/trigger (set_variable = { name = x })
            // or a saved scope value names a variable, not a localization key.
            const parentKey = node.key ?? '';
            const namesVariable =
                child.key === 'name' &&
                (parentKey.includes('variable') ||
                    parentKey === 'save_scope_value_as' ||
                    parentKey === 'save_temporary_scope_value_as');
            if (
                localizationIndex &&
                !namesVariable &&
                locKey &&
                !locKey.includes(' ') &&
                !locKey.includes('$') &&
                !locKey.includes('[') &&
                !localizationIndex.hasKey(locKey)
            ) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: `Missing localization key: '${locKey}'`,
                    code: 'CK4100',
                    source: 'ck3-localization',
                });
            }
        }

        // Check tooltip fields
        if (
            (child.key === 'custom_tooltip' || child.key === 'selection_tooltip') &&
            child.value &&
            typeof child.value === 'string'
        ) {
            const locKey = child.value;
            if (locKey.includes(' ')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: child.range,
                    message: `Tooltip value '${locKey}' contains spaces - this should be a localization key`,
                    code: 'LOC-002',
                    source: 'ck3-localization',
                });
            }
        }

        checkLocalizationKeys(child, diagnostics, localizationIndex);
    }
}
