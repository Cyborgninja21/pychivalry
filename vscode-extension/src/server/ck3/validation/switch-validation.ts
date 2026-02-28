/**
 * Switch Statement Validation
 *
 * Validates that switch blocks have the correct structure:
 * - Must have a 'trigger' field specifying which trigger to evaluate
 * - Must have at least one branch value
 * - Branch values should be valid for the trigger type
 *
 * DIAGNOSTIC CODES:
 *     SWITCH-001: switch block missing 'trigger' field
 *     SWITCH-002: switch block has no branch values
 *     SWITCH-003: unknown trigger reference in switch
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';
import { getDataLoader } from '../../data/loader';

export interface SwitchValidationConfig {
    enabled: boolean;
}

export const DEFAULT_SWITCH_CONFIG: SwitchValidationConfig = {
    enabled: true,
};

/**
 * Validate switch statements in the given AST.
 */
export function validateSwitch(
    node: ASTNode,
    config: SwitchValidationConfig
): Diagnostic[] {
    if (!config.enabled) return [];

    const diagnostics: Diagnostic[] = [];
    walkForSwitch(node, diagnostics);
    return diagnostics;
}

/** Keys that are structural in a switch block, not branch values */
const SWITCH_STRUCTURAL_KEYS = new Set(['trigger', 'fallback']);

function walkForSwitch(
    node: ASTNode,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key === 'switch' && child.children) {
            validateSwitchBlock(child, diagnostics);
        }

        // Recurse
        walkForSwitch(child, diagnostics);
    }
}

function validateSwitchBlock(
    node: ASTNode,
    diagnostics: Diagnostic[]
): void {
    if (!node.children) return;

    let hasTrigger = false;
    let triggerValue: string | undefined;
    let branchCount = 0;

    for (const child of node.children) {
        if (!child.key) continue;

        if (child.key === 'trigger') {
            hasTrigger = true;
            if (typeof child.value === 'string') {
                triggerValue = child.value;
            }
        } else if (!SWITCH_STRUCTURAL_KEYS.has(child.key)) {
            branchCount++;
        }
    }

    if (!hasTrigger) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: node.range,
            message: "Switch block is missing required 'trigger' field",
            code: 'SWITCH-001',
            source: 'ck3-switch',
        });
    }

    if (branchCount === 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: 'Switch block has no branch values',
            code: 'SWITCH-002',
            source: 'ck3-switch',
        });
    }

    // Validate trigger reference exists
    if (triggerValue) {
        const dataLoader = getDataLoader();
        const triggers = dataLoader.getTriggers();
        if (triggers.size > 0 && !triggers.has(triggerValue)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: node.range,
                message: `Switch references unknown trigger '${triggerValue}'`,
                code: 'SWITCH-003',
                source: 'ck3-switch',
            });
        }
    }
}
