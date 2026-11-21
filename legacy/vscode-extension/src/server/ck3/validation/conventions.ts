/**
 * Convention, control-flow and localization-reference checks (engine plug-in).
 *
 * The package describes none of the CONV / COND rules, so they are conventions at
 * information severity (2.2 evidence audit). The localization references are evidence-backed
 * (the game logs a missing key: catalogue `unknown_loc_key_X`, "Unknown loc key %s"; and
 * game/events/_events.info: "Missing localization keys are logged as errors").
 *
 * DIAGNOSTIC CODES:
 *     COND-001: if / else_if / trigger_if / trigger_else_if without limit (information)
 *     COND-002: else / trigger_else with a limit (information)
 *     COND-003: else / trigger_else without a preceding if (information)
 *     CK4101: a localization field holds literal text with spaces (warning; LOC-001 until
 *             2.1, renamed in 2.2 because LOC-001 means something else in .yml files)
 *     CK4102: a custom_tooltip holds literal text (warning; LOC-002 until 2.1)
 *     CK4100: a localization key defined neither in the workspace nor in the base game
 *             (warning; silent without the base game's localization)
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode, LocalizationIndex } from 'pychivalry-engine';
import { eventsOf, walk } from './event-helpers';

/** Control-flow ordering checks: COND-001..COND-003. */
export function validateConditionalBlocks(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    walkConditionalBlocks(node, diagnostics);
    return diagnostics;
}

/** Localization-reference checks: CK4101, CK4102 and (with the base game's keys) CK4100. */
export function validateLocalizationReferences(
    node: ASTNode,
    knowledge: LocalizationKnowledge = {}
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    checkLocalizationKeys(node, diagnostics, knowledge);
    return diagnostics;
}

/*
 * Retired in 2.2: CONV-001 (event without `type`: the game's events documentation,
 * game/events/_events.info, says `type` is optional and defaults to character_event),
 * CONV-002 (event with options and no title: merged into paradox-checks CK3765, issue #25),
 * CONV-003 (event without `desc`: the same check as paradox-checks CK3764) and CONV-004
 * (option without `name`: the same check as paradox-checks CK3450).
 */

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
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: `Convention: '${child.key}' has no 'limit' block`,
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
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message:
                        "Convention: 'trigger_else' has a 'limit' block; use 'trigger_else_if' instead",
                    code: 'COND-002',
                    source: 'ck3-conditional',
                });
            }
            // Check for orphaned trigger_else
            if (lastConditionalKey !== 'trigger_if' && lastConditionalKey !== 'trigger_else_if') {
                diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: "Convention: 'trigger_else' without a preceding 'trigger_if'",
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
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: `Convention: '${child.key}' has no 'limit' block`,
                    code: 'COND-001',
                    source: 'ck3-conditional',
                });
            }
            lastConditionalKey = child.key;
        } else if (child.key === 'else' && child.children) {
            const hasLimit = child.children.some((c) => c.key === 'limit');
            if (hasLimit) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: "Convention: 'else' has a 'limit' block; use 'else_if' instead",
                    code: 'COND-002',
                    source: 'ck3-conditional',
                });
            }
            if (lastConditionalKey !== 'if' && lastConditionalKey !== 'else_if') {
                diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: child.range,
                    message: "Convention: 'else' without a preceding 'if'",
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

/** Where a value is a localization key, and what the plug-in knows about keys. */
export interface LocalizationKnowledge {
    /** The workspace's localization files. */
    localization?: LocalizationIndex;
    /**
     * The base game's localization keys; without them CK4100 is silent (a key the mod does
     * not define may be the base game's).
     */
    baseKeys?: ReadonlySet<string>;
    /** Mod-relative path of the file. */
    file?: string;
}

/** custom_tooltip values found by localizationValueNodes (CK4102 instead of CK4101). */
const TOOLTIP_VALUES = new WeakSet<ASTNode>();

/** Dynamic-description fields (game/events/_events.info, Dynamic Description Appendix). */
const DYNAMIC_DESC_FIELDS = new Set(['title', 'desc', 'opening']);

/**
 * The values of a dynamic description (`title`, `desc`, `opening`, option `name`): the plain
 * key, or every `desc` / `text` / switch-case value nested in its block.
 */
function dynamicDescValues(node: ASTNode, out: ASTNode[]): void {
    if (typeof node.value === 'string') {
        out.push(node);
        return;
    }
    for (const child of node.children ?? []) {
        if (child.key === 'trigger' || child.key === 'count') {
            continue;
        }
        if (child.key === 'desc' || child.key === 'text' || child.key === 'fallback') {
            dynamicDescValues(child, out);
        } else if (child.children) {
            dynamicDescValues(child, out);
        }
    }
}

/**
 * Nodes whose value the game reads as a localization key: an event's title, desc and
 * opening, an option's name (also `name = { text = … }`), a decision's title, desc,
 * selection_tooltip and confirm_text, and `custom_tooltip` values anywhere. Other `name`,
 * `title` and `desc` keys are not localization (gene names in ethnicities, script value
 * breakdown labels, title scopes in effects …), nor is `custom_description = { text = x }`
 * (a key of the common/trigger_localization or effect_localization database).
 */
export function localizationValueNodes(ast: ASTNode, file: string): ASTNode[] {
    const out: ASTNode[] = [];
    const rel = file.replace(/\\/g, '/');
    if (/^events\//i.test(rel)) {
        for (const event of eventsOf(ast)) {
            for (const child of event.children ?? []) {
                if (child.key && DYNAMIC_DESC_FIELDS.has(child.key)) {
                    dynamicDescValues(child, out);
                } else if (child.key === 'option') {
                    for (const name of (child.children ?? []).filter((c) => c.key === 'name')) {
                        dynamicDescValues(name, out);
                    }
                }
            }
        }
    }
    if (/^common\/decisions\//i.test(rel)) {
        for (const decision of ast.children ?? []) {
            for (const child of decision.children ?? []) {
                if (child.key === 'title' || child.key === 'desc') {
                    dynamicDescValues(child, out);
                } else if (
                    (child.key === 'selection_tooltip' || child.key === 'confirm_text') &&
                    typeof child.value === 'string'
                ) {
                    out.push(child);
                }
            }
        }
    }
    walk(ast, (n) => {
        if (n.key === 'custom_tooltip') {
            const value =
                typeof n.value === 'string' ? n : (n.children ?? []).find((c) => c.key === 'text');
            if (value && typeof value.value === 'string') {
                TOOLTIP_VALUES.add(value);
                out.push(value);
            }
        }
    });
    return out;
}

/**
 * CK4101 / CK4102: literal text where a localization key belongs (warning: the game looks
 * the text up as a key and logs it missing, catalogue `unknown_loc_key_X`). CK4100: a key
 * defined neither in the workspace's localization files nor in the base game's (warning, same
 * evidence; silent without the base game's keys).
 */
function checkLocalizationKeys(
    node: ASTNode,
    diagnostics: Diagnostic[],
    knowledge: LocalizationKnowledge
): void {
    const file = knowledge.file ?? '';
    for (const child of localizationValueNodes(node, file)) {
        const value = child.value as string;
        const tooltip = TOOLTIP_VALUES.has(child);
        if (value.includes(' ')) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: child.range,
                message: tooltip
                    ? `Tooltip value '${value}' contains spaces: the game reads it as a localization key ('Unknown loc key')`
                    : `'${value}' contains spaces: the game reads it as a localization key ('Unknown loc key'), not as text`,
                code: tooltip ? 'CK4102' : 'CK4101',
                source: 'ck3-localization',
            });
            continue;
        }
        if (
            knowledge.localization &&
            knowledge.baseKeys &&
            /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value) &&
            !knowledge.localization.hasKey(value) &&
            !knowledge.baseKeys.has(value)
        ) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: child.range,
                message: `Missing localization key: '${value}' (defined neither in the workspace nor in the base game)`,
                code: 'CK4100',
                source: 'ck3-localization',
            });
        }
    }
}
