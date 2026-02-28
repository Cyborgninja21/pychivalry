/**
 * Activity Lifecycle Validation
 *
 * Validates CK3 activity_type definitions for structural correctness.
 *
 * DIAGNOSTIC CODES:
 *     ACT-001: missing is_shown
 *     ACT-002: phase references non-existent phase
 *     ACT-003: invalid province filter value
 *     ACT-004: lifecycle hook uses wrong context
 *     ACT-005: duplicate phase name
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ASTNode } from '../../core/parser';
import { CK3Language } from '../language';

export interface ActivityConfig {
    enabled: boolean;
}

export const DEFAULT_ACTIVITY_CONFIG: ActivityConfig = {
    enabled: true,
};

const VALID_PROVINCE_FILTERS = new Set([
    'all', 'coastal', 'inland', 'capital', 'realm',
    'holy_site', 'neighboring', 'same_continent',
]);

const ACTIVITY_LIFECYCLE_HOOKS = new Set([
    'on_activate', 'on_complete', 'on_invalidated',
    'on_host_death', 'on_start', 'on_enter_phase',
    'on_leave_phase',
]);

/**
 * Validate activity type definitions.
 */
export function validateActivities(
    node: ASTNode,
    config: ActivityConfig,
    filePath?: string
): Diagnostic[] {
    if (!config.enabled) return [];

    // Only validate files in activities directory
    if (filePath && !filePath.toLowerCase().includes('activit')) {
        return [];
    }

    const diagnostics: Diagnostic[] = [];
    walkForActivities(node, diagnostics);
    return diagnostics;
}

function walkForActivities(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    for (const child of node.children) {
        if (child.key && child.children && isActivityBlock(child)) {
            validateActivityBlock(child, diagnostics);
        }
    }
}

function isActivityBlock(node: ASTNode): boolean {
    if (!node.children) return false;
    const keys = new Set(node.children.map(c => c.key).filter(Boolean));
    return keys.has('on_activate') || keys.has('phases') ||
        keys.has('is_shown') || keys.has('on_complete');
}

function validateActivityBlock(node: ASTNode, diagnostics: Diagnostic[]): void {
    if (!node.children) return;

    const childKeys = new Set(node.children.map(c => c.key).filter(Boolean));

    // ACT-001: missing is_shown
    if (!childKeys.has('is_shown')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: node.range,
            message: `Activity '${node.key}' is missing 'is_shown'`,
            code: 'ACT-001',
            source: 'ck3-activities',
        });
    }

    // Collect defined phase names
    const phasesBlock = node.children.find(c => c.key === 'phases' && c.children);
    const definedPhases = new Set<string>();
    const phaseNameCounts = new Map<string, number>();

    if (phasesBlock && phasesBlock.children) {
        for (const phase of phasesBlock.children) {
            if (phase.key) {
                definedPhases.add(phase.key);
                phaseNameCounts.set(phase.key, (phaseNameCounts.get(phase.key) || 0) + 1);
            }
        }

        // ACT-005: duplicate phase name
        for (const [phaseName, count] of phaseNameCounts) {
            if (count > 1) {
                const dupes = phasesBlock.children.filter(c => c.key === phaseName);
                for (const dupe of dupes.slice(1)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: dupe.range,
                        message: `Duplicate phase name '${phaseName}'`,
                        code: 'ACT-005',
                        source: 'ck3-activities',
                    });
                }
            }
        }
    }

    // ACT-002: check phase references in transitions
    if (phasesBlock && phasesBlock.children) {
        for (const phase of phasesBlock.children) {
            if (!phase.children) continue;
            const nextPhase = phase.children.find(c => c.key === 'next_phase');
            if (nextPhase && typeof nextPhase.value === 'string') {
                if (!definedPhases.has(nextPhase.value)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: nextPhase.range,
                        message: `Phase '${nextPhase.value}' is not defined in this activity`,
                        code: 'ACT-002',
                        source: 'ck3-activities',
                    });
                }
            }
        }
    }

    // ACT-003: invalid province filter
    const provinceFilter = node.children.find(c => c.key === 'province_filter');
    if (provinceFilter && typeof provinceFilter.value === 'string') {
        if (!VALID_PROVINCE_FILTERS.has(provinceFilter.value)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: provinceFilter.range,
                message: `Unknown province filter '${provinceFilter.value}'`,
                code: 'ACT-003',
                source: 'ck3-activities',
            });
        }
    }

    // ACT-004: lifecycle hook uses wrong context (hooks are effect blocks, not trigger blocks)
    for (const child of node.children) {
        if (child.key && ACTIVITY_LIFECYCLE_HOOKS.has(child.key) && child.children) {
            for (const hookChild of child.children) {
                if (!hookChild.key) continue;
                // Trigger-only keywords should not appear directly in lifecycle hooks
                if (CK3Language.isTrigger(hookChild.key) && !CK3Language.isEffect(hookChild.key)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
                        range: hookChild.range,
                        message: `Trigger '${hookChild.key}' in lifecycle hook '${child.key}' — hooks are effect context`,
                        code: 'ACT-004',
                        source: 'ck3-activities',
                    });
                }
            }
        }
    }
}
