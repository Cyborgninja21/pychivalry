/**
 * Scripted blocks (engine plug-in): a scripted effect or trigger that calls itself.
 *
 * DIAGNOSTIC CODES:
 *     CK3956 (information, convention): a scripted_effect or scripted_trigger definition
 *            calls itself (no engine evidence: the error catalogue has no recursion message)
 *
 * Removed in 2.2: CK3950 / CK3951 (undefined scripted effect / trigger, issue #93). The check
 * took every block with a value as a call, which in the AST is only a tagged value such as a
 * colour (`color = rgb { 255 0 0 }`, `hsv { … }`), so it reported colour values and never a
 * real call; an undefined scripted effect or trigger is reported by the engine's registry check
 * with the game's own message (unknown_effect_X / unknown_trigger_X), against the workspace
 * and the base game.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from 'pychivalry-engine';

export interface ScriptedBlockConfig {
    enabled: boolean;
    checkEffects: boolean;
    checkTriggers: boolean;
}

/**
 * CK3956 on the definitions of a scripted_effects / scripted_triggers file (`filePath` is
 * the file's path or URI).
 */
export function validateScriptedParameters(
    node: ASTNode,
    config: ScriptedBlockConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }
    const lower = filePath?.toLowerCase() ?? '';
    const isScriptedFile = lower.includes('scripted_trigger') || lower.includes('scripted_effect');
    if (!isScriptedFile || !node.children) {
        return [];
    }
    const diagnostics: Diagnostic[] = [];
    for (const child of node.children) {
        if (!child.key || !child.children) {
            continue;
        }
        for (const ref of collectSelfReferences(child, child.key)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: ref.range,
                message: `Convention: scripted block '${child.key}' calls itself recursively`,
                code: 'CK3956',
                source: 'ck3-lsp',
            });
        }
    }
    return diagnostics;
}

/** Self-references (recursive calls) within a scripted block. */
function collectSelfReferences(node: ASTNode, blockName: string): ASTNode[] {
    const refs: ASTNode[] = [];
    const traverse = (n: ASTNode): void => {
        if (n.key === blockName && n !== node) {
            refs.push(n);
        }
        n.children?.forEach(traverse);
    };
    node.children?.forEach(traverse);
    return refs;
}
