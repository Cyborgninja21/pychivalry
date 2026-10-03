/**
 * Switch Statement Validation
 *
 * Validates that switch blocks have the correct structure:
 * - Must have a 'trigger' field specifying which trigger to evaluate
 * - Must have at least one branch value
 * - Branch values should be valid for the trigger type
 *
 * DIAGNOSTIC CODES:
 *     SWITCH-001 (information, convention): switch block without a 'trigger' field
 *     SWITCH-002 (information, convention): switch block without branch values
 *     SWITCH-003 (warning): the header names no trigger of the spec package and no scripted
 *                trigger of the workspace or the base game (the game's "Unknown trigger '%s'",
 *                catalogue unknown_trigger_X); only plain names are judged (not
 *                `scope:x.var:y` or `$PARAM$` headers), and only while the base game is
 *                loaded (its scripted triggers are otherwise unknown)
 *
 * Kept as an engine plug-in: the engine reads `switch` as a container (its `trigger`
 * parameter and case blocks) but does not check that the header names a trigger or that
 * a case exists. SWITCH-003 judges the header against the spec package's triggers bucket
 * (and the workspace's scripted triggers, passed in by the plug-in).
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from 'pychivalry-engine';

export interface SwitchValidationConfig {
    enabled: boolean;
    /** Is `name` a trigger (engine bucket or a scripted trigger)? Unchecked when absent. */
    isTrigger?: (name: string) => boolean;
}

export const DEFAULT_SWITCH_CONFIG: SwitchValidationConfig = {
    enabled: true,
};

/**
 * Validate switch statements in the given AST.
 */
export function validateSwitch(node: ASTNode, config: SwitchValidationConfig): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForSwitch(node, diagnostics, config);
    return diagnostics;
}

/** Keys that are structural in a switch block, not branch values */
const SWITCH_STRUCTURAL_KEYS = new Set(['trigger', 'fallback']);

function walkForSwitch(
    node: ASTNode,
    diagnostics: Diagnostic[],
    config: SwitchValidationConfig
): void {
    if (!node.children) {
        return;
    }

    for (const child of node.children) {
        if (child.key === 'switch' && child.children) {
            validateSwitchBlock(child, diagnostics, config);
        }

        // Recurse
        walkForSwitch(child, diagnostics, config);
    }
}

function validateSwitchBlock(
    node: ASTNode,
    diagnostics: Diagnostic[],
    config: SwitchValidationConfig
): void {
    if (!node.children) {
        return;
    }

    let hasTrigger = false;
    let triggerValue: string | undefined;
    let branchCount = 0;

    for (const child of node.children) {
        if (!child.key) {
            continue;
        }

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
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: "Convention: switch block without a 'trigger' field",
            code: 'SWITCH-001',
            source: 'ck3-switch',
        });
    }

    if (branchCount === 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: 'Convention: switch block without branch values',
            code: 'SWITCH-002',
            source: 'ck3-switch',
        });
    }

    // Validate trigger reference exists
    if (triggerValue && config.isTrigger && /^[A-Za-z_][A-Za-z0-9_]*$/.test(triggerValue)) {
        if (!config.isTrigger(triggerValue)) {
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
