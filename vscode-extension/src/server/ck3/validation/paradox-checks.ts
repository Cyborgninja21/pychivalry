/**
 * Paradox Convention Validation - CK3-Specific Best Practices
 *
 * DIAGNOSTIC CODES:
 *     CK3872: Redundant trigger = { always = yes }
 *     CK3873: Impossible trigger = { always = no }
 *     CK3875: Missing limit in random_ iterator
 *     CK3977: every_ without limit (can be expensive)
 *     CK3760: Event missing type declaration
 *     CK3761: Invalid event type
 *     CK3762: Hidden event with options
 *     CK3763: Event with no options
 *     CK3764: Non-hidden event missing desc
 *     CK3766: Multiple after blocks
 *     CK3768: Multiple immediate blocks
 *     CK5137: is_alive without exists check
 *     CK5142: `this = ` comparisons, CK3005: logical operator with a scalar value
 *   folded in from the former paradox-checks-extended.ts:
 *     CK3656 (inline opinion values), CK3761/CK3764/CK3767/CK3769 (event type, desc,
 *     empty event, portraits), CK3450 (option name), CK3420/CK3421/CK3422 (portrait
 *     position, character, animation), CK3430 (theme), CK3520/CK3521 (after blocks),
 *     CK3610/CK3611/CK3612/CK3614 (ai_chance), CK3510/CK3511 (trigger_else ordering)
 *
 * Retired in Phase 4 because the engine's registry check reports the same defect with
 * the game's own message (unknown_trigger_X / unknown_effect_X): CK3870 and CK3871
 * (effect in a trigger or limit block) and CK3976 (effect in an any_ iterator).
 *
 * This module validates scripts against Paradox modding conventions
 * and catches common pitfalls that are syntactically valid but
 * semantically incorrect or likely to cause runtime bugs.
 */

import { ASTNode, NodeType } from 'pychivalry-engine';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import {
    isValidEventType,
    isValidTheme,
    isValidPortraitPosition,
    isValidPortraitAnimation,
} from './events';

/**
 * Configuration for Paradox convention checks
 */
export interface ParadoxConfig {
    effectTriggerContext: boolean;
    listIterators: boolean;
    opinionModifiers: boolean;
    eventStructure: boolean;
    commonGotchas: boolean;
    portraitValidation: boolean;
    descValidation: boolean;
    optionValidation: boolean;
    aiChanceValidation: boolean;
    triggerValidation: boolean;
    afterBlockValidation: boolean;
}

/**
 * Default configuration with all checks enabled
 */
export const DEFAULT_PARADOX_CONFIG: ParadoxConfig = {
    effectTriggerContext: true,
    listIterators: true,
    opinionModifiers: true,
    eventStructure: true,
    commonGotchas: true,
    portraitValidation: true,
    descValidation: true,
    optionValidation: true,
    aiChanceValidation: true,
    triggerValidation: true,
    afterBlockValidation: true,
};

/**
 * Check for redundant or impossible trigger conditions
 * DIAGNOSTIC: CK3872, CK3873
 */
export function checkRedundantTriggers(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        // Check for always = yes (redundant)
        // Parser converts 'yes' to boolean true, 'no' to boolean false
        if (child.key === 'always' && (child.value === true || child.value === 'yes')) {
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Information,
                code: 'CK3872',
                source: 'ck3-lsp',
                message:
                    "Redundant 'always = yes' trigger. This is always true and can be removed.",
            });
        }

        // Check for always = no (impossible)
        if (child.key === 'always' && (child.value === false || child.value === 'no')) {
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Error,
                code: 'CK3873',
                source: 'ck3-lsp',
                message: "Impossible 'always = no' trigger. This code will never execute.",
            });
        }

        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkRedundantTriggers(child));
        }
    }

    return diagnostics;
}

/**
 * Check list iterator misuse
 * DIAGNOSTIC: CK3875, CK3977
 */
export function checkListIteratorMisuse(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        if (!child.key) {
            continue;
        }

        // Check for random_ without limit
        if (child.key.startsWith('random_') && child.type === NodeType.BLOCK) {
            const blockChildren = child.children || [];
            const hasLimit = blockChildren.some((c) => c.key === 'limit');
            if (!hasLimit) {
                diagnostics.push({
                    range: child.range,
                    severity: DiagnosticSeverity.Information,
                    code: 'CK3875',
                    source: 'ck3-lsp',
                    message: `random_ iterator without limit. Consider adding limit = { ... } to filter candidates.`,
                });
            }
        }

        // Check for every_ without limit (performance warning)
        if (child.key.startsWith('every_') && child.type === NodeType.BLOCK) {
            const blockChildren = child.children || [];
            const hasLimit = blockChildren.some((c) => c.key === 'limit');
            if (!hasLimit) {
                diagnostics.push({
                    range: child.range,
                    severity: DiagnosticSeverity.Information,
                    code: 'CK3977',
                    source: 'ck3-lsp',
                    message: `every_ iterator without limit affects ALL matching elements. Consider adding limit = { ... } for better performance.`,
                });
            }
        }

        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkListIteratorMisuse(child));
        }
    }

    return diagnostics;
}

/**
 * Check event structure issues
 * DIAGNOSTIC: CK3760, CK3761, CK3762, CK3763, CK3764, CK3766, CK3768
 */
export function checkEventStructure(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    // Check for type declaration
    const typeNode = children.find((c) => c.key === 'type');
    if (!typeNode) {
        diagnostics.push({
            range: node.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3760',
            source: 'ck3-lsp',
            message: 'Event is missing type declaration (character_event, letter_event, etc.)',
        });
        return diagnostics; // Can't check further without type
    }

    // Validate event type
    const validTypes = [
        'character_event',
        'letter_event',
        'court_event',
        'duel_event',
        'feast_event',
        'story_cycle',
    ];
    const eventType = String(typeNode.value);
    if (!validTypes.includes(eventType)) {
        diagnostics.push({
            range: typeNode.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3761',
            source: 'ck3-lsp',
            message: `Invalid event type '${eventType}'. Valid types: ${validTypes.join(', ')}`,
        });
    }

    // Check for hidden events with options
    const isHidden = children.some((c) => c.key === 'hidden' && c.value === 'yes');
    const optionNodes = children.filter((c) => c.key === 'option');

    if (isHidden && optionNodes.length > 0) {
        diagnostics.push({
            range: optionNodes[0].range,
            severity: DiagnosticSeverity.Warning,
            code: 'CK3762',
            source: 'ck3-lsp',
            message: 'Hidden event has option blocks. Options are ignored in hidden events.',
        });
    }

    // Check for non-hidden events without options
    if (!isHidden && optionNodes.length === 0) {
        diagnostics.push({
            range: node.range,
            severity: DiagnosticSeverity.Warning,
            code: 'CK3763',
            source: 'ck3-lsp',
            message: 'Event has no option blocks. Players need choices to interact with events.',
        });
    }

    // Check for non-hidden events missing desc
    const descNode = children.find((c) => c.key === 'desc');
    if (!isHidden && !descNode) {
        diagnostics.push({
            range: node.range,
            severity: DiagnosticSeverity.Error,
            code: 'CK3764',
            source: 'ck3-lsp',
            message: 'Non-hidden event is missing desc field.',
        });
    }

    // Check for multiple after blocks
    const afterNodes = children.filter((c) => c.key === 'after');
    if (afterNodes.length > 1) {
        for (let i = 1; i < afterNodes.length; i++) {
            diagnostics.push({
                range: afterNodes[i].range,
                severity: DiagnosticSeverity.Warning,
                code: 'CK3766',
                source: 'ck3-lsp',
                message: 'Multiple after blocks detected. Only the first after block will execute.',
            });
        }
    }

    // Check for multiple immediate blocks
    const immediateNodes = children.filter((c) => c.key === 'immediate');
    if (immediateNodes.length > 1) {
        for (let i = 1; i < immediateNodes.length; i++) {
            diagnostics.push({
                range: immediateNodes[i].range,
                severity: DiagnosticSeverity.Error,
                code: 'CK3768',
                source: 'ck3-lsp',
                message:
                    'Multiple immediate blocks detected. Only one immediate block is allowed per event.',
            });
        }
    }

    return diagnostics;
}

/**
 * Check for common CK3 gotchas
 * DIAGNOSTIC: CK5137, CK5142
 */
export function checkCommonGotchas(node: ASTNode): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const children = node.children || [];

    for (const child of children) {
        // Check for is_alive without exists check
        if (child.key === 'is_alive') {
            // This is a simplified check - in reality we'd need to track scope chain
            // to see if there's a protective exists check
            diagnostics.push({
                range: child.range,
                severity: DiagnosticSeverity.Information,
                code: 'CK5137',
                source: 'ck3-lsp',
                message:
                    "Using 'is_alive' without an 'exists' check may crash if the target doesn't exist. Consider wrapping in exists = { ... }.",
            });
        }

        // Check for character comparison with = instead of 'this ='  (CK5142)
        // e.g., 'liege = root' should be 'liege = { this = root }'
        // Scope links used as simple assignments with another scope name as the value
        if (child.key && child.type !== NodeType.BLOCK && typeof child.value === 'string') {
            const scopeLinks = [
                'liege',
                'father',
                'mother',
                'spouse',
                'primary_heir',
                'killer',
                'guardian',
                'host',
                'employer',
                'court_owner',
                'betrothed',
            ];
            const scopeValues = ['root', 'prev', 'from', 'fromfrom', 'this'];
            if (
                scopeLinks.includes(child.key) &&
                (scopeValues.includes(child.value) || child.value.startsWith('scope:'))
            ) {
                diagnostics.push({
                    range: child.range,
                    severity: DiagnosticSeverity.Error,
                    code: 'CK5142',
                    source: 'ck3-lsp',
                    message: `Invalid character comparison '${child.key} = ${child.value}'. Use '${child.key} = { this = ${child.value} }' to compare characters.`,
                });
            }
        }

        // Recursively check nested blocks
        if (child.type === NodeType.BLOCK) {
            diagnostics.push(...checkCommonGotchas(child));
        }
    }

    return diagnostics;
}

/**
 * Validate all Paradox conventions for a node
 */
export function validateParadoxConventions(
    node: ASTNode,
    config: ParadoxConfig = DEFAULT_PARADOX_CONFIG
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Effect/trigger context checks
    if (config.effectTriggerContext) {
        // Walk recursively to find trigger and limit blocks at any depth
        const walkForTriggerContext = (n: ASTNode) => {
            const children = n.children || [];
            for (const child of children) {
                // Check logical operators without block value (CK3005)
                if (
                    child.key &&
                    ['NOT', 'OR', 'AND', 'NOR', 'NAND'].includes(child.key) &&
                    child.type !== NodeType.BLOCK
                ) {
                    diagnostics.push({
                        range: child.range,
                        severity: DiagnosticSeverity.Error,
                        code: 'CK3005',
                        source: 'ck3-lsp',
                        message: `Logical operator '${child.key}' requires a block value { ... }, not a scalar.`,
                    });
                }
                if (child.type === NodeType.BLOCK) {
                    walkForTriggerContext(child);
                }
            }
        };
        walkForTriggerContext(node);

        // Check for redundant triggers
        diagnostics.push(...checkRedundantTriggers(node));
    }

    // List iterator checks
    if (config.listIterators) {
        diagnostics.push(...checkListIteratorMisuse(node));
    }

    // Event structure checks
    if (config.eventStructure) {
        // Check if this looks like an event (has type field)
        const children = node.children || [];
        if (children.some((c) => c.key === 'type')) {
            diagnostics.push(...checkEventStructure(node));
        }
    }

    // Common gotchas
    if (config.commonGotchas) {
        diagnostics.push(...checkCommonGotchas(node));
    }

    // Event, option, portrait, theme, after-block, ai_chance and trigger_else checks
    diagnostics.push(...validateExtendedParadoxConventions(node, config));

    return diagnostics;
}

// ── Folded in from paradox-checks-extended.ts ─────────────────────────────

function createDiagnostic(
    message: string,
    range: Range,
    severity: DiagnosticSeverity,
    code: string
): Diagnostic {
    return {
        message,
        range,
        severity,
        code,
        source: 'ck3-paradox',
    };
}

/**
 * Check for inline opinion modifiers (CK3656)
 * Inline opinion values should be replaced with predefined opinion modifiers
 */
export function checkOpinionModifiers(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.opinionModifiers) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        // Check for add_opinion or reverse_add_opinion with inline opinion value
        if (n.key === 'add_opinion' || n.key === 'reverse_add_opinion') {
            for (const child of n.children || []) {
                if (child.key === 'opinion') {
                    // Inline opinion value detected
                    diagnostics.push(
                        createDiagnostic(
                            `Inline opinion value in ${n.key}. Define opinion modifier in common/opinion_modifiers/ and reference by name with 'modifier = your_modifier_name'.`,
                            n.range,
                            DiagnosticSeverity.Information,
                            'CK3656'
                        )
                    );
                    break;
                }
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for invalid event type (CK3761)
 */
export function checkEventTypeValid(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.eventStructure) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Check if this is an event node (namespace.number format)
    if (node.key && node.key.includes('.') && (node.children || []).length > 0) {
        for (const child of node.children || []) {
            if (child.key === 'type' && child.value) {
                const eventType = String(child.value);
                if (!isValidEventType(eventType)) {
                    const validTypes = [
                        'character_event',
                        'letter_event',
                        'toast_event',
                        'fullscreen_event',
                        'duel_event',
                        'story_event',
                    ];
                    diagnostics.push(
                        createDiagnostic(
                            `Invalid event type '${eventType}'. Valid types: ${validTypes.join(', ')}`,
                            child.range,
                            DiagnosticSeverity.Error,
                            'CK3761'
                        )
                    );
                }
            }
        }
    }

    return diagnostics;
}

/**
 * Check for missing desc in non-hidden events (CK3764)
 */
export function checkEventHasDesc(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.eventStructure) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Check if this is an event node
    if (node.key && node.key.includes('.') && (node.children || []).length > 0) {
        const parts = node.key.split('.');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
            // This is an event
            let hasDesc = false;
            let isHidden = false;

            for (const child of node.children || []) {
                if (child.key === 'desc') {
                    hasDesc = true;
                } else if (
                    child.key === 'hidden' &&
                    (child.value === 'yes' || child.value === true)
                ) {
                    isHidden = true;
                }
            }

            if (!hasDesc && !isHidden) {
                diagnostics.push(
                    createDiagnostic(
                        `Event '${node.key}' is missing 'desc' field. Events need descriptions for players to understand what's happening.`,
                        node.range,
                        DiagnosticSeverity.Warning,
                        'CK3764'
                    )
                );
            }
        }
    }

    return diagnostics;
}

/**
 * Check for options missing name field (CK3450)
 */
export function checkOptionHasName(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.optionValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function checkOptionNode(n: ASTNode): void {
        if (n.key === 'option' && (n.children || []).length > 0) {
            const hasName = (n.children || []).some((child) => child.key === 'name');
            if (!hasName) {
                diagnostics.push(
                    createDiagnostic(
                        `Option is missing 'name' field for localization`,
                        n.range,
                        DiagnosticSeverity.Warning,
                        'CK3450'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            checkOptionNode(child);
        }
    }

    checkOptionNode(node);
    return diagnostics;
}

/**
 * Check for invalid portrait position (CK3420)
 */
export function checkPortraitPosition(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.portraitValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key && n.key.endsWith('_portrait')) {
            if (!isValidPortraitPosition(n.key)) {
                const validPositions = [
                    'left_portrait',
                    'right_portrait',
                    'lower_left_portrait',
                    'lower_center_portrait',
                    'lower_right_portrait',
                ];
                diagnostics.push(
                    createDiagnostic(
                        `Invalid portrait position '${n.key}'. Valid positions: ${validPositions.join(', ')}`,
                        n.range,
                        DiagnosticSeverity.Error,
                        'CK3420'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check that portrait blocks have character field (CK3421)
 */
export function checkPortraitHasCharacter(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.portraitValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key && isValidPortraitPosition(n.key)) {
            const hasCharacter = (n.children || []).some((child) => child.key === 'character');
            if (!hasCharacter && (n.children || []).length > 0) {
                diagnostics.push(
                    createDiagnostic(
                        `Portrait '${n.key}' is missing required 'character' field`,
                        n.range,
                        DiagnosticSeverity.Warning,
                        'CK3421'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for invalid animation names (CK3422)
 */
export function checkAnimationValid(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.portraitValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key === 'animation' && n.value) {
            const animation = String(n.value);
            if (!isValidPortraitAnimation(animation)) {
                diagnostics.push(
                    createDiagnostic(
                        `Invalid animation '${animation}'. Check valid animations in game files.`,
                        n.range,
                        DiagnosticSeverity.Warning,
                        'CK3422'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for invalid theme names (CK3430)
 */
export function checkThemeValid(node: ASTNode, config: Partial<ParadoxConfig> = {}): Diagnostic[] {
    if (!config.eventStructure) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key === 'theme' && n.value) {
            const theme = String(n.value);
            if (!isValidTheme(theme)) {
                diagnostics.push(
                    createDiagnostic(
                        `Invalid theme '${theme}'. Check valid themes in game files.`,
                        n.range,
                        DiagnosticSeverity.Warning,
                        'CK3430'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for after block in hidden event (CK3520)
 */
export function checkAfterBlockInHiddenEvent(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.afterBlockValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Check if this is an event node
    if (node.key && node.key.includes('.') && (node.children || []).length > 0) {
        let isHidden = false;
        let hasAfter = false;
        let afterNode: ASTNode | null = null;

        for (const child of node.children || []) {
            if (child.key === 'hidden' && (child.value === 'yes' || child.value === true)) {
                isHidden = true;
            } else if (child.key === 'after') {
                hasAfter = true;
                afterNode = child;
            }
        }

        if (isHidden && hasAfter && afterNode) {
            diagnostics.push(
                createDiagnostic(
                    `'after' block in hidden event '${node.key}' has no effect (hidden events don't display options)`,
                    afterNode.range,
                    DiagnosticSeverity.Warning,
                    'CK3520'
                )
            );
        }
    }

    return diagnostics;
}

/**
 * Check for after block without options (CK3521)
 */
export function checkAfterBlockWithoutOptions(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.afterBlockValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Check if this is an event node
    if (node.key && node.key.includes('.') && (node.children || []).length > 0) {
        let hasOptions = false;
        let hasAfter = false;
        let afterNode: ASTNode | null = null;

        for (const child of node.children || []) {
            if (child.key === 'option') {
                hasOptions = true;
            } else if (child.key === 'after') {
                hasAfter = true;
                afterNode = child;
            }
        }

        if (hasAfter && !hasOptions && afterNode) {
            diagnostics.push(
                createDiagnostic(
                    `'after' block without options is unnecessary (options trigger the after block)`,
                    afterNode.range,
                    DiagnosticSeverity.Information,
                    'CK3521'
                )
            );
        }
    }

    return diagnostics;
}

/**
 * Check for negative base ai_chance (CK3610)
 */
export function checkAiChanceNegative(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.aiChanceValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                    const value = Number(child.value);
                    if (!isNaN(value) && value < 0) {
                        diagnostics.push(
                            createDiagnostic(
                                `Negative base ai_chance (${value}) - AI will never select this option`,
                                child.range,
                                DiagnosticSeverity.Warning,
                                'CK3610'
                            )
                        );
                    }
                }
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for ai_chance > 100 (CK3611)
 */
export function checkAiChanceOver100(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.aiChanceValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                    const value = Number(child.value);
                    if (!isNaN(value) && value > 100) {
                        diagnostics.push(
                            createDiagnostic(
                                `ai_chance base ${value} > 100 is clamped to 100`,
                                child.range,
                                DiagnosticSeverity.Information,
                                'CK3611'
                            )
                        );
                    }
                }
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for ai_chance = 0 (CK3612)
 */
export function checkAiChanceZero(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.aiChanceValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                    const value = Number(child.value);
                    if (!isNaN(value) && value === 0) {
                        diagnostics.push(
                            createDiagnostic(
                                `ai_chance base = 0 - AI will never select this option. Consider using 'ai_accept = no' instead.`,
                                child.range,
                                DiagnosticSeverity.Information,
                                'CK3612'
                            )
                        );
                    }
                }
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for ai_chance modifier without trigger (CK3614)
 */
export function checkAiChanceModifierWithoutTrigger(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.aiChanceValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'modifier') {
                    const hasCondition = (child.children || []).some(
                        (c) => c.key !== 'factor' && c.key !== 'add' && c.key !== 'multiply'
                    );

                    if (!hasCondition) {
                        diagnostics.push(
                            createDiagnostic(
                                `ai_chance modifier without trigger applies unconditionally - move to base value instead`,
                                child.range,
                                DiagnosticSeverity.Warning,
                                'CK3614'
                            )
                        );
                    }
                }
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for trigger_else without trigger_if (CK3510)
 */
export function checkTriggerElseWithoutIf(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.triggerValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        let hasTriggerIf = false;
        const triggerElseNodes: ASTNode[] = [];

        for (const child of n.children || []) {
            if (child.key === 'trigger_if') {
                hasTriggerIf = true;
            } else if (child.key === 'trigger_else') {
                triggerElseNodes.push(child);
            }
        }

        if (triggerElseNodes.length > 0 && !hasTriggerIf) {
            for (const elseNode of triggerElseNodes) {
                diagnostics.push(
                    createDiagnostic(
                        `'trigger_else' without preceding 'trigger_if' has no effect`,
                        elseNode.range,
                        DiagnosticSeverity.Error,
                        'CK3510'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for multiple trigger_else blocks (CK3511)
 */
export function checkMultipleTriggerElse(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.triggerValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    function walk(n: ASTNode): void {
        const triggerElseNodes: ASTNode[] = [];

        for (const child of n.children || []) {
            if (child.key === 'trigger_else') {
                triggerElseNodes.push(child);
            }
        }

        if (triggerElseNodes.length > 1) {
            for (let i = 1; i < triggerElseNodes.length; i++) {
                diagnostics.push(
                    createDiagnostic(
                        `Multiple 'trigger_else' blocks - only the first executes`,
                        triggerElseNodes[i].range,
                        DiagnosticSeverity.Warning,
                        'CK3511'
                    )
                );
            }
        }

        for (const child of n.children || []) {
            walk(child);
        }
    }

    walk(node);
    return diagnostics;
}

/**
 * Check for empty event (CK3767)
 */
export function checkEmptyEvent(node: ASTNode, config: Partial<ParadoxConfig> = {}): Diagnostic[] {
    if (!config.eventStructure) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Check if this is an event node
    if (node.key && node.key && node.key.includes('.') && (node.children || []).length === 0) {
        const parts = node.key.split('.');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
            diagnostics.push(
                createDiagnostic(
                    `Event '${node.key}' is empty - events need content`,
                    node.range,
                    DiagnosticSeverity.Error,
                    'CK3767'
                )
            );
        }
    }

    return diagnostics;
}

/**
 * Check for non-hidden event with no portraits (CK3769)
 */
export function checkEventHasPortraits(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    if (!config.portraitValidation) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];

    // Check if this is an event node
    if (node.key && node.key && node.key.includes('.') && (node.children || []).length > 0) {
        const parts = node.key.split('.');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
            let isHidden = false;
            let hasPortrait = false;

            for (const child of node.children || []) {
                if (child.key === 'hidden' && (child.value === 'yes' || child.value === true)) {
                    isHidden = true;
                } else if (child.key && child.key.endsWith('_portrait')) {
                    hasPortrait = true;
                }
            }

            if (!isHidden && !hasPortrait) {
                diagnostics.push(
                    createDiagnostic(
                        `Non-hidden event '${node.key}' has no portraits - events should show relevant characters`,
                        node.range,
                        DiagnosticSeverity.Information,
                        'CK3769'
                    )
                );
            }
        }
    }

    return diagnostics;
}

/**
 * Validate all extended Paradox conventions on an AST node
 */
export function validateExtendedParadoxConventions(
    node: ASTNode,
    config: Partial<ParadoxConfig> = {}
): Diagnostic[] {
    const allDiagnostics: Diagnostic[] = [];

    // Opinion and event structure checks
    allDiagnostics.push(...checkOpinionModifiers(node, config));
    allDiagnostics.push(...checkEventTypeValid(node, config));
    allDiagnostics.push(...checkEventHasDesc(node, config));
    allDiagnostics.push(...checkEmptyEvent(node, config));

    // Option checks
    allDiagnostics.push(...checkOptionHasName(node, config));

    // Portrait checks
    allDiagnostics.push(...checkPortraitPosition(node, config));
    allDiagnostics.push(...checkPortraitHasCharacter(node, config));
    allDiagnostics.push(...checkAnimationValid(node, config));
    allDiagnostics.push(...checkEventHasPortraits(node, config));

    // Theme checks
    allDiagnostics.push(...checkThemeValid(node, config));

    // After block checks
    allDiagnostics.push(...checkAfterBlockInHiddenEvent(node, config));
    allDiagnostics.push(...checkAfterBlockWithoutOptions(node, config));

    // AI chance checks
    allDiagnostics.push(...checkAiChanceNegative(node, config));
    allDiagnostics.push(...checkAiChanceOver100(node, config));
    allDiagnostics.push(...checkAiChanceZero(node, config));
    allDiagnostics.push(...checkAiChanceModifierWithoutTrigger(node, config));

    // Trigger checks
    allDiagnostics.push(...checkTriggerElseWithoutIf(node, config));
    allDiagnostics.push(...checkMultipleTriggerElse(node, config));

    return allDiagnostics;
}
