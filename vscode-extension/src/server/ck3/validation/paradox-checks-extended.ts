/**
 * Extended Paradox Convention Checks - Additional Validators
 * 
 * This file contains additional validation functions to complete the Paradox checks module.
 * These will be integrated into paradox-checks.ts.
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { ASTNode } from '../../core/parser';
import { isValidEventType, isValidTheme, isValidPortraitPosition, isValidPortraitAnimation } from './events';

interface ParadoxConfig {
    opinionModifiers?: boolean;
    eventStructure?: boolean;
    portraitValidation?: boolean;
    descValidation?: boolean;
    optionValidation?: boolean;
    aiChanceValidation?: boolean;
    triggerValidation?: boolean;
    afterBlockValidation?: boolean;
}

function createDiagnostic(message: string, range: Range, severity: DiagnosticSeverity, code: string): Diagnostic {
    return {
        message,
        range,
        severity,
        code,
        source: 'ck3-paradox'
    };
}

/**
 * Check for inline opinion modifiers (CK3656)
 * Inline opinion values should be replaced with predefined opinion modifiers
 */
export function checkOpinionModifiers(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.opinionModifiers) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        // Check for add_opinion or reverse_add_opinion with inline opinion value
        if (n.key === 'add_opinion' || n.key === 'reverse_add_opinion') {
            for (const child of n.children || []) {
                if (child.key === 'opinion') {
                    // Inline opinion value detected
                    diagnostics.push(createDiagnostic(
                        `Inline opinion value in ${n.key}. Define opinion modifier in common/opinion_modifiers/ and reference by name with 'modifier = your_modifier_name'.`,
                        n.range,
                        DiagnosticSeverity.Information,
                        'CK3656'
                    ));
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
export function checkEventTypeValid(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.eventStructure) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    // Check if this is an event node (namespace.number format)
    if (node.key && node.key.includes('.') && (node.children || []).length > 0) {
        for (const child of node.children || []) {
            if (child.key === 'type' && child.value) {
                const eventType = String(child.value);
                if (!isValidEventType(eventType)) {
                    const validTypes = ['character_event', 'letter_event', 'toast_event', 'fullscreen_event', 'duel_event', 'story_event'];
                    diagnostics.push(createDiagnostic(
                        `Invalid event type '${eventType}'. Valid types: ${validTypes.join(', ')}`,
                        child.range,
                        DiagnosticSeverity.Error,
                        'CK3761'
                    ));
                }
            }
        }
    }
    
    return diagnostics;
}

/**
 * Check for missing desc in non-hidden events (CK3764)
 */
export function checkEventHasDesc(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.eventStructure) return [];
    
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
                } else if (child.key === 'hidden' && (child.value === 'yes' || child.value === true)) {
                    isHidden = true;
                }
            }
            
            if (!hasDesc && !isHidden) {
                diagnostics.push(createDiagnostic(
                    `Event '${node.key}' is missing 'desc' field. Events need descriptions for players to understand what's happening.`,
                    node.range,
                    DiagnosticSeverity.Warning,
                    'CK3764'
                ));
            }
        }
    }
    
    return diagnostics;
}

/**
 * Check for options missing name field (CK3450)
 */
export function checkOptionHasName(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.optionValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function checkOptionNode(n: ASTNode): void {
        if (n.key === 'option' && (n.children || []).length > 0) {
            const hasName = (n.children || []).some(child => child.key === 'name');
            if (!hasName) {
                diagnostics.push(createDiagnostic(
                    `Option is missing 'name' field for localization`,
                    n.range,
                    DiagnosticSeverity.Warning,
                    'CK3450'
                ));
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
export function checkPortraitPosition(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.portraitValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key && n.key.endsWith('_portrait')) {
            if (!isValidPortraitPosition(n.key)) {
                const validPositions = ['left_portrait', 'right_portrait', 'lower_left_portrait', 'lower_center_portrait', 'lower_right_portrait'];
                diagnostics.push(createDiagnostic(
                    `Invalid portrait position '${n.key}'. Valid positions: ${validPositions.join(', ')}`,
                    n.range,
                    DiagnosticSeverity.Error,
                    'CK3420'
                ));
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
export function checkPortraitHasCharacter(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.portraitValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key && isValidPortraitPosition(n.key)) {
            const hasCharacter = (n.children || []).some(child => child.key === 'character');
            if (!hasCharacter && (n.children || []).length > 0) {
                diagnostics.push(createDiagnostic(
                    `Portrait '${n.key}' is missing required 'character' field`,
                    n.range,
                    DiagnosticSeverity.Warning,
                    'CK3421'
                ));
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
export function checkAnimationValid(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.portraitValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key === 'animation' && n.value) {
            const animation = String(n.value);
            if (!isValidPortraitAnimation(animation)) {
                diagnostics.push(createDiagnostic(
                    `Invalid animation '${animation}'. Check valid animations in game files.`,
                    n.range,
                    DiagnosticSeverity.Warning,
                    'CK3422'
                ));
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
export function checkThemeValid(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.eventStructure) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key === 'theme' && n.value) {
            const theme = String(n.value);
            if (!isValidTheme(theme)) {
                diagnostics.push(createDiagnostic(
                    `Invalid theme '${theme}'. Check valid themes in game files.`,
                    n.range,
                    DiagnosticSeverity.Warning,
                    'CK3430'
                ));
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
export function checkAfterBlockInHiddenEvent(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.afterBlockValidation) return [];
    
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
            diagnostics.push(createDiagnostic(
                `'after' block in hidden event '${node.key}' has no effect (hidden events don't display options)`,
                afterNode.range,
                DiagnosticSeverity.Warning,
                'CK3520'
            ));
        }
    }
    
    return diagnostics;
}

/**
 * Check for after block without options (CK3521)
 */
export function checkAfterBlockWithoutOptions(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.afterBlockValidation) return [];
    
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
            diagnostics.push(createDiagnostic(
                `'after' block without options is unnecessary (options trigger the after block)`,
                afterNode.range,
                DiagnosticSeverity.Information,
                'CK3521'
            ));
        }
    }
    
    return diagnostics;
}

/**
 * Check for negative base ai_chance (CK3610)
 */
export function checkAiChanceNegative(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.aiChanceValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                    const value = Number(child.value);
                    if (!isNaN(value) && value < 0) {
                        diagnostics.push(createDiagnostic(
                            `Negative base ai_chance (${value}) - AI will never select this option`,
                            child.range,
                            DiagnosticSeverity.Warning,
                            'CK3610'
                        ));
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
export function checkAiChanceOver100(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.aiChanceValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                    const value = Number(child.value);
                    if (!isNaN(value) && value > 100) {
                        diagnostics.push(createDiagnostic(
                            `ai_chance base ${value} > 100 is clamped to 100`,
                            child.range,
                            DiagnosticSeverity.Information,
                            'CK3611'
                        ));
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
export function checkAiChanceZero(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.aiChanceValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                    const value = Number(child.value);
                    if (!isNaN(value) && value === 0) {
                        diagnostics.push(createDiagnostic(
                            `ai_chance base = 0 - AI will never select this option. Consider using 'ai_accept = no' instead.`,
                            child.range,
                            DiagnosticSeverity.Information,
                            'CK3612'
                        ));
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
export function checkAiChanceModifierWithoutTrigger(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.aiChanceValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        if (n.key === 'ai_chance') {
            for (const child of n.children || []) {
                if (child.key === 'modifier') {
                    const hasTrigger = (child.children || []).some(c => 
                        c.key === 'trigger' || c.key === 'factor' || c.key === 'add' || c.key === 'multiply'
                    );
                    const hasCondition = (child.children || []).some(c => 
                        c.key !== 'factor' && c.key !== 'add' && c.key !== 'multiply'
                    );
                    
                    if (!hasCondition) {
                        diagnostics.push(createDiagnostic(
                            `ai_chance modifier without trigger applies unconditionally - move to base value instead`,
                            child.range,
                            DiagnosticSeverity.Warning,
                            'CK3614'
                        ));
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
export function checkTriggerElseWithoutIf(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.triggerValidation) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    function walk(n: ASTNode): void {
        let hasTriggerIf = false;
        let triggerElseNodes: ASTNode[] = [];
        
        for (const child of n.children || []) {
            if (child.key === 'trigger_if') {
                hasTriggerIf = true;
            } else if (child.key === 'trigger_else') {
                triggerElseNodes.push(child);
            }
        }
        
        if (triggerElseNodes.length > 0 && !hasTriggerIf) {
            for (const elseNode of triggerElseNodes) {
                diagnostics.push(createDiagnostic(
                    `'trigger_else' without preceding 'trigger_if' has no effect`,
                    elseNode.range,
                    DiagnosticSeverity.Error,
                    'CK3510'
                ));
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
export function checkMultipleTriggerElse(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.triggerValidation) return [];
    
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
                diagnostics.push(createDiagnostic(
                    `Multiple 'trigger_else' blocks - only the first executes`,
                    triggerElseNodes[i].range,
                    DiagnosticSeverity.Warning,
                    'CK3511'
                ));
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
export function checkEmptyEvent(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.eventStructure) return [];
    
    const diagnostics: Diagnostic[] = [];
    
    // Check if this is an event node
    if (node.key && node.key && node.key.includes('.') && (node.children || []).length === 0) {
        const parts = node.key.split('.');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
            diagnostics.push(createDiagnostic(
                `Event '${node.key}' is empty - events need content`,
                node.range,
                DiagnosticSeverity.Error,
                'CK3767'
            ));
        }
    }
    
    return diagnostics;
}

/**
 * Check for non-hidden event with no portraits (CK3769)
 */
export function checkEventHasPortraits(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
    if (!config.portraitValidation) return [];
    
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
                diagnostics.push(createDiagnostic(
                    `Non-hidden event '${node.key}' has no portraits - events should show relevant characters`,
                    node.range,
                    DiagnosticSeverity.Information,
                    'CK3769'
                ));
            }
        }
    }
    
    return diagnostics;
}

/**
 * Validate all extended Paradox conventions on an AST node
 */
export function validateExtendedParadoxConventions(node: ASTNode, config: ParadoxConfig = {}): Diagnostic[] {
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
