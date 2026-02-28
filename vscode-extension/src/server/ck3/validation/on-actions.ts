/**
 * On-Action Validation
 *
 * Validates CK3 on_action definitions for structural correctness.
 * On-actions fire events and effects in response to game events.
 *
 * DIAGNOSTIC CODES:
 *     ON_ACTION-001: On-action has no effects or events (does nothing)
 *     ON_ACTION-002: On-action has empty events list
 *     ON_ACTION-003: Event ID in on-action not found in workspace
 *     ON_ACTION-004: random_events block with zero total weight
 *     ON_ACTION-005: Nested on_actions reference to unknown on-action
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';

export interface OnActionConfig {
    enabled: boolean;
    checkEventReferences: boolean;
    knownEventIds?: Set<string>;
    knownOnActionNames?: Set<string>;
}

export const DEFAULT_ON_ACTION_CONFIG: OnActionConfig = {
    enabled: true,
    checkEventReferences: false,
};

/**
 * Validate on_action blocks in the given AST.
 */
export function validateOnActions(
    node: ASTNode,
    config: OnActionConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    // Only validate files in on_action directory
    if (filePath) {
        const lower = filePath.toLowerCase();
        if (!lower.includes('on_action') && !lower.includes('on_actions')) {
            return [];
        }
    }

    const diagnostics: Diagnostic[] = [];
    walkForOnActions(node, config, diagnostics);
    return diagnostics;
}

function walkForOnActions(node: ASTNode, config: OnActionConfig, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isOnActionBlock(child)) {
            validateOnActionBlock(child, config, diagnostics);
        }
    }
}

function isOnActionBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    // An on_action typically has: trigger, effect, events, random_events, first_valid, or on_actions
    return keys.has('trigger') || keys.has('effect') || keys.has('events') ||
           keys.has('random_events') || keys.has('first_valid') || keys.has('on_actions');
}

function validateOnActionBlock(node: ASTNode, config: OnActionConfig, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // ON_ACTION-001: No effects or events — does nothing
    const hasContent = childKeys.has('effect') || childKeys.has('events') ||
                       childKeys.has('random_events') || childKeys.has('first_valid') ||
                       childKeys.has('on_actions');
    if (!hasContent) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: node.range,
            message: `On-action '${node.key}' has no effects or events — does nothing`,
            code: 'ON_ACTION-001',
            source: 'ck3-on-actions',
        });
    }

    // ON_ACTION-002: Empty events list
    const eventsChild = node.children.find(c => c.key === 'events');
    if (eventsChild && eventsChild.children && eventsChild.children.length === 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: eventsChild.range,
            message: `On-action '${node.key}' has empty events list`,
            code: 'ON_ACTION-002',
            source: 'ck3-on-actions',
        });
    }

    // ON_ACTION-003: Event ID references (cross-ref with workspace)
    if (config.checkEventReferences && config.knownEventIds) {
        if (eventsChild && eventsChild.children) {
            for (const eventRef of eventsChild.children) {
                const eventId = eventRef.value ? String(eventRef.value) : eventRef.key;
                if (eventId && !config.knownEventIds.has(eventId)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: eventRef.range,
                        message: `Event '${eventId}' referenced in on-action not found in workspace`,
                        code: 'ON_ACTION-003',
                        source: 'ck3-on-actions',
                    });
                }
            }
        }
    }

    // ON_ACTION-004: random_events with zero total weight
    const randomEventsChild = node.children.find(c => c.key === 'random_events' && c.children);
    if (randomEventsChild && randomEventsChild.children) {
        let totalWeight = 0;
        let hasWeightedEntries = false;
        for (const entry of randomEventsChild.children) {
            if (entry.key === 'chance_to_happen' || entry.key === 'chance_of_no_event') {
                continue;
            }
            // Weighted entries are typically: event_id = { weight = N }
            if (entry.value !== undefined) {
                const w = Number(entry.value);
                if (!isNaN(w)) {
                    totalWeight += w;
                    hasWeightedEntries = true;
                }
            }
        }
        if (hasWeightedEntries && totalWeight <= 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: randomEventsChild.range,
                message: `random_events block in '${node.key}' has total weight of 0 — no event will fire`,
                code: 'ON_ACTION-004',
                source: 'ck3-on-actions',
            });
        }
    }

    // ON_ACTION-005: Nested on_actions reference to unknown on-action
    if (config.knownOnActionNames) {
        const onActionsChild = node.children.find(c => c.key === 'on_actions' && c.children);
        if (onActionsChild && onActionsChild.children) {
            for (const ref of onActionsChild.children) {
                const refName = ref.value ? String(ref.value) : ref.key;
                if (refName && !config.knownOnActionNames.has(refName)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: ref.range,
                        message: `Nested on_action '${refName}' not found`,
                        code: 'ON_ACTION-005',
                        source: 'ck3-on-actions',
                    });
                }
            }
        }
    }
}
