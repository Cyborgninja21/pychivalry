/**
 * Paradox conventions: CK3-specific pitfalls that are syntactically valid (engine plug-in).
 *
 * Severity follows the evidence rule of the 2.2 audit
 * (Documentation/developer-guide/diagnostics-evidence.md): a warning or error needs engine
 * evidence; every other check is a convention at information (semantic advice) or hint.
 *
 * DIAGNOSTIC CODES:
 *     CK3005 (information) a logical operator (AND, OR, NOT, NOR, NAND) with a scalar value
 *     CK3872 (information) redundant `always = yes`
 *     CK3873 (hint)        `always = no`: the block is disabled, the usual way to switch
 *                          content off (issue #92; 167 uses in the base game)
 *     CK3875 (information) a random_ iterator without a limit
 *     CK3977 (information) an every_ iterator without a limit
 *     CK5137 (information) is_alive without an exists check
 *     CK3656 (information) an inline opinion value in add_opinion
 *   per event of an events/ file (information):
 *     CK3762 hidden event with options, CK3763 non-hidden event without options, CK3764
 *     non-hidden event without desc, CK3766 several after blocks, CK3767 empty event, CK3768
 *     several immediate blocks, CK3769 non-hidden event without portraits, CK3450 option
 *     without name, CK3421 portrait without character, CK3422 unknown portrait animation
 *     (the optional extracted animation data), CK3520 after block in a hidden event, CK3521
 *     after block in an event without options
 *     CK3430 (warning)     an event theme defined neither in the workspace's nor in the
 *                          base game's common/event_themes: the game cannot read the
 *                          database key (catalogue failed_to_read_key_reference_X_from_database_X);
 *                          silent while the base game is unknown
 *   ai_chance (information): CK3610 negative base, CK3611 old (base above 100), CK3612 old
 *     (base = 0), CK3614 a modifier without a trigger
 *   trigger_else ordering (information): CK3510 trigger_else without trigger_if, CK3511
 *     several trigger_else blocks
 *
 * Removed in 2.2: CK5142 (`liege = root` is the ordinary comparison form, 1,475 uses in the
 * base game; issue #91), CK3420 (invalid portrait position: every key ending in `_portrait`
 * was checked; an unknown event field is reported by the engine's schema check, unknown_X_in_X;
 * issue #94), CK3760 (event without type: `type` is optional, game/events/_events.info) and
 * CK3761 (invalid event type: events EVENT-001). The event checks used to run on the file's
 * root node only and so never reported; they now run on every event.
 *
 * Retired in Phase 4: CK3870, CK3871, CK3976 (the engine's registry reports the same defect
 * with the game's own message, unknown_trigger_X / unknown_effect_X).
 */

import { ASTNode, NodeType } from 'pychivalry-engine';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { isValidPortraitAnimation, isValidPortraitPosition } from './events';
import { childrenWithKey, eventsOf, isEventFile, isHiddenEvent, walk } from './event-helpers';

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

/** What the checks know beyond the file. */
export interface ParadoxKnowledge {
    /** Mod-relative path (event checks run on events/ files only). */
    file?: string;
    /**
     * Is the theme defined (workspace or base game)? Undefined while the base game is
     * unknown: CK3430 is then silent.
     */
    isKnownTheme?: (theme: string) => boolean;
}

function diag(
    message: string,
    range: Range,
    severity: DiagnosticSeverity,
    code: string
): Diagnostic {
    return { message, range, severity, code, source: 'ck3-paradox' };
}

const INFO = DiagnosticSeverity.Information;
const CONVENTION = 'Convention: ';

/** CK3872 / CK3873. */
export function checkRedundantTriggers(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    walk(node, (child) => {
        if (child.key !== 'always') {
            return;
        }
        if (child.value === true || child.value === 'yes') {
            out.push(
                diag(
                    `${CONVENTION}'always = yes' is always true and can be removed.`,
                    child.range,
                    INFO,
                    'CK3872'
                )
            );
        } else if (child.value === false || child.value === 'no') {
            out.push(
                diag(
                    "'always = no' is never true: the content is switched off (the usual way to disable it on purpose).",
                    child.range,
                    DiagnosticSeverity.Hint,
                    'CK3873'
                )
            );
        }
    });
    return out;
}

/** CK3875 / CK3977. */
export function checkListIteratorMisuse(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    walk(node, (child) => {
        if (!child.key || child.type !== NodeType.BLOCK) {
            return;
        }
        const hasLimit = (child.children ?? []).some((c) => c.key === 'limit');
        if (hasLimit) {
            return;
        }
        if (child.key.startsWith('random_')) {
            out.push(
                diag(
                    `${CONVENTION}random_ iterator without a limit; consider limit = { … } to filter candidates.`,
                    child.range,
                    INFO,
                    'CK3875'
                )
            );
        } else if (child.key.startsWith('every_')) {
            out.push(
                diag(
                    `${CONVENTION}every_ iterator without a limit affects every matching element.`,
                    child.range,
                    INFO,
                    'CK3977'
                )
            );
        }
    });
    return out;
}

/** CK3005 and CK5137. */
export function checkCommonGotchas(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    walk(node, (child) => {
        if (child.key === 'is_alive') {
            out.push(
                diag(
                    `${CONVENTION}'is_alive' on a scope that may not exist; check exists first.`,
                    child.range,
                    INFO,
                    'CK5137'
                )
            );
        }
        if (
            child.key &&
            ['NOT', 'OR', 'AND', 'NOR', 'NAND'].includes(child.key) &&
            child.type !== NodeType.BLOCK
        ) {
            out.push(
                diag(
                    `${CONVENTION}logical operator '${child.key}' takes a block { … }, not a scalar.`,
                    child.range,
                    INFO,
                    'CK3005'
                )
            );
        }
    });
    return out;
}

/** CK3656. */
export function checkOpinionModifiers(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    walk(node, (n) => {
        if (
            (n.key === 'add_opinion' || n.key === 'reverse_add_opinion') &&
            (n.children ?? []).some((c) => c.key === 'opinion')
        ) {
            out.push(
                diag(
                    `${CONVENTION}inline opinion value in ${n.key}; define an opinion modifier in common/opinion_modifiers/ and reference it with 'modifier = …'.`,
                    n.range,
                    INFO,
                    'CK3656'
                )
            );
        }
    });
    return out;
}

/** Event structure checks on one event (CK3762-CK3769, CK3450, CK3520, CK3521). */
export function checkEventStructure(event: ASTNode, config: ParadoxConfig): Diagnostic[] {
    const out: Diagnostic[] = [];
    const children = event.children ?? [];
    if (children.length === 0) {
        if (config.eventStructure) {
            out.push(
                diag(`${CONVENTION}event '${event.key}' is empty.`, event.range, INFO, 'CK3767')
            );
        }
        return out;
    }
    const hidden = isHiddenEvent(event);
    const options = childrenWithKey(event, 'option');
    const afters = childrenWithKey(event, 'after');
    if (config.eventStructure) {
        if (hidden && options.length > 0) {
            out.push(
                diag(
                    `${CONVENTION}hidden event '${event.key}' has options; no window is shown for a hidden event.`,
                    options[0].range,
                    INFO,
                    'CK3762'
                )
            );
        }
        if (!hidden && options.length === 0) {
            out.push(
                diag(
                    `${CONVENTION}event '${event.key}' is not hidden and has no options.`,
                    event.range,
                    INFO,
                    'CK3763'
                )
            );
        }
        for (const extra of afters.slice(1)) {
            out.push(
                diag(`${CONVENTION}several after blocks in one event.`, extra.range, INFO, 'CK3766')
            );
        }
        for (const extra of childrenWithKey(event, 'immediate').slice(1)) {
            out.push(
                diag(
                    `${CONVENTION}several immediate blocks in one event.`,
                    extra.range,
                    INFO,
                    'CK3768'
                )
            );
        }
    }
    if (config.descValidation && !hidden && !children.some((c) => c.key === 'desc')) {
        out.push(
            diag(
                `${CONVENTION}event '${event.key}' is not hidden and has no desc.`,
                event.range,
                INFO,
                'CK3764'
            )
        );
    }
    if (config.optionValidation) {
        for (const option of options) {
            if (
                (option.children ?? []).length > 0 &&
                !option.children!.some((c) => c.key === 'name')
            ) {
                out.push(
                    diag(
                        `${CONVENTION}option without a 'name' for its localization.`,
                        option.range,
                        INFO,
                        'CK3450'
                    )
                );
            }
        }
    }
    if (config.portraitValidation) {
        const portraits = children.filter((c) => c.key && isValidPortraitPosition(c.key));
        if (!hidden && portraits.length === 0) {
            out.push(
                diag(
                    `${CONVENTION}event '${event.key}' is not hidden and shows no portrait.`,
                    event.range,
                    INFO,
                    'CK3769'
                )
            );
        }
        for (const portrait of portraits) {
            if (
                (portrait.children ?? []).length > 0 &&
                !portrait.children!.some((c) => c.key === 'character')
            ) {
                out.push(
                    diag(
                        `${CONVENTION}portrait '${portrait.key}' has no 'character'.`,
                        portrait.range,
                        INFO,
                        'CK3421'
                    )
                );
            }
            walk(portrait, (n) => {
                if (
                    n.key === 'animation' &&
                    typeof n.value === 'string' &&
                    !isValidPortraitAnimation(n.value)
                ) {
                    out.push(
                        diag(
                            `${CONVENTION}animation '${n.value}' is not in the extracted animation data.`,
                            n.range,
                            INFO,
                            'CK3422'
                        )
                    );
                }
            });
        }
    }
    if (config.afterBlockValidation && afters.length > 0) {
        if (hidden) {
            out.push(
                diag(
                    `${CONVENTION}after block in hidden event '${event.key}': it runs after an option is chosen, and a hidden event shows none.`,
                    afters[0].range,
                    INFO,
                    'CK3520'
                )
            );
        } else if (options.length === 0) {
            out.push(
                diag(
                    `${CONVENTION}after block in an event without options; it runs after an option.`,
                    afters[0].range,
                    INFO,
                    'CK3521'
                )
            );
        }
    }
    return out;
}

/** CK3430: the event's theme is defined neither in the workspace nor in the base game. */
export function checkTheme(event: ASTNode, knowledge: ParadoxKnowledge): Diagnostic[] {
    const isKnown = knowledge.isKnownTheme;
    if (!isKnown) {
        return [];
    }
    const out: Diagnostic[] = [];
    for (const theme of childrenWithKey(event, 'theme')) {
        if (
            typeof theme.value === 'string' &&
            !theme.value.includes('$') &&
            !isKnown(theme.value)
        ) {
            out.push(
                diag(
                    `Unknown event theme '${theme.value}': defined neither in the workspace's nor in the base game's common/event_themes`,
                    theme.range,
                    DiagnosticSeverity.Warning,
                    'CK3430'
                )
            );
        }
    }
    return out;
}

function aiChanceBlocks(node: ASTNode): ASTNode[] {
    const out: ASTNode[] = [];
    walk(node, (n) => {
        if (n.key === 'ai_chance' && n.children) {
            out.push(n);
        }
    });
    return out;
}

/** CK3610, CK3611 (old), CK3612 (old), CK3614. */
export function checkAiChance(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const block of aiChanceBlocks(node)) {
        for (const child of block.children ?? []) {
            if (child.key === 'base' && child.value !== null && child.value !== undefined) {
                const value = Number(child.value);
                if (!isNaN(value) && value < 0) {
                    out.push(
                        diag(
                            `${CONVENTION}negative ai_chance base (${value}).`,
                            child.range,
                            INFO,
                            'CK3610'
                        )
                    );
                }
                if (!isNaN(value) && value > 100) {
                    out.push(
                        diag(
                            `ai_chance base ${value} > 100 is clamped to 100`,
                            child.range,
                            INFO,
                            'CK3611'
                        )
                    );
                }
                if (!isNaN(value) && value === 0) {
                    out.push(
                        diag(
                            `ai_chance base = 0 - AI will never select this option. Consider using 'ai_accept = no' instead.`,
                            child.range,
                            INFO,
                            'CK3612'
                        )
                    );
                }
            }
            if (child.key === 'modifier') {
                const hasCondition = (child.children ?? []).some(
                    (c) => c.key !== 'factor' && c.key !== 'add' && c.key !== 'multiply'
                );
                if (!hasCondition) {
                    out.push(
                        diag(
                            `${CONVENTION}ai_chance modifier without a trigger applies unconditionally; fold it into base.`,
                            child.range,
                            INFO,
                            'CK3614'
                        )
                    );
                }
            }
        }
    }
    return out;
}

/** CK3510 / CK3511. */
export function checkTriggerElse(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    walk(node, (n) => {
        const children = n.children ?? [];
        const elses = children.filter((c) => c.key === 'trigger_else');
        if (elses.length === 0) {
            return;
        }
        if (!children.some((c) => c.key === 'trigger_if')) {
            for (const e of elses) {
                out.push(
                    diag(
                        `${CONVENTION}'trigger_else' without a preceding 'trigger_if'.`,
                        e.range,
                        INFO,
                        'CK3510'
                    )
                );
            }
        }
        for (const e of elses.slice(1)) {
            out.push(
                diag(
                    `${CONVENTION}several 'trigger_else' blocks; only the first applies.`,
                    e.range,
                    INFO,
                    'CK3511'
                )
            );
        }
    });
    return out;
}

/** Every Paradox convention check on a file. */
export function validateParadoxConventions(
    node: ASTNode,
    config: ParadoxConfig = DEFAULT_PARADOX_CONFIG,
    knowledge: ParadoxKnowledge = {}
): Diagnostic[] {
    const out: Diagnostic[] = [];
    if (config.effectTriggerContext) {
        out.push(...checkRedundantTriggers(node));
    }
    if (config.listIterators) {
        out.push(...checkListIteratorMisuse(node));
    }
    if (config.commonGotchas) {
        out.push(...checkCommonGotchas(node));
    }
    if (config.opinionModifiers) {
        out.push(...checkOpinionModifiers(node));
    }
    if (isEventFile(knowledge.file ?? 'events/')) {
        for (const event of eventsOf(node)) {
            out.push(...checkEventStructure(event, config));
            out.push(...checkTheme(event, knowledge));
        }
    }
    if (config.aiChanceValidation) {
        out.push(...checkAiChance(node));
    }
    if (config.triggerValidation) {
        out.push(...checkTriggerElse(node));
    }
    return out;
}
