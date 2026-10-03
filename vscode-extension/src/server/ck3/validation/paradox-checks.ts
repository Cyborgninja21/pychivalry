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
 *     after block in an event without options, CK3522 (hint) an after block that only cleans
 *     up (issue #19). Issue #19's CK3523 (a trigger in an after block) is not a plug-in code:
 *     `after` is effect context in the events schema, and the engine's registry reports a
 *     trigger there with the game's own message (unknown_effect_X). The evaluation order
 *     behind the after checks (after runs once the chosen option has run; a hidden event
 *     shows no options) is documented in scope-timing.ts.
 *     CK3765 (information) a non-hidden event without title (issue #25; CONV-002 merged in)
 *     CK3423, CK3424, CK3425, CK3426 (information) triggered_animation without trigger or
 *     animation, triggered_outfit without trigger, a portrait position given twice (issue
 *     #27; game/events/_events.info; the events schema marks none of these required)
 *     CK3431 (warning)     an override_background reference defined neither in the
 *                          workspace's nor in the base game's common/event_backgrounds
 *                          (catalogue failed_to_read_key_reference_X_from_database_X; silent
 *                          while the base game is unknown); CK3433 (information) an override
 *                          equal to the background the theme always shows (issue #28). Issue
 *                          #28's CK3432 (override_environment) is no event field (the engine's
 *                          schema check reports it, unknown_X_in_X); CK3434 (override_icon) is
 *                          GFX001's `reference` path check; CK3435 (override_sound) has no
 *                          source to check against (game/sound/GUIDs.txt names banks under
 *                          other paths than the event:/SFX/… references events use)
 *     CK3430 (warning)     an event theme defined neither in the workspace's nor in the
 *                          base game's common/event_themes: the game cannot read the
 *                          database key (catalogue failed_to_read_key_reference_X_from_database_X);
 *                          silent while the base game is unknown
 *   ai_chance (2.2, issues #21-#23): CK3610 negative base, CK3611 total always zero, CK3612
 *     total can be negative, CK3614 a modifier without a trigger (information); CK3613 an
 *     option without ai_chance (hint). Before 2.2, CK3611 was "base above 100 is clamped to
 *     100" (removed: false, ai_chance is a relative weight; the 1.20.0.2 events and common
 *     directories hold 640 bases above 100 among 16,865 ai_chance blocks) and CK3612 "base =
 *     0, the AI never picks the option" (merged into CK3611: of the base game's 1,288 blocks
 *     with base = 0, 333 have a modifier that adds weight)
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
import {
    childrenWithKey,
    eventsOf,
    isEventFile,
    isHiddenEvent,
    numberValue,
    walk,
} from './event-helpers';

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
    /** Is the name an effect of the spec package (CK3522)? */
    isEffect?: (name: string) => boolean;
    /**
     * Is the event background defined (workspace or base game)? Undefined while the base
     * game is unknown: CK3431 is then silent.
     */
    isKnownBackground?: (name: string) => boolean;
    /** The background a theme always shows first (CK3433), when known. */
    themeDefaultBackground?: (theme: string) => string | undefined;
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
export function checkEventStructure(
    event: ASTNode,
    config: ParadoxConfig,
    isEffect?: (name: string) => boolean
): Diagnostic[] {
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
        // CK3522: an after block that only cleans up (every entry a remove_/clear_ effect).
        for (const after of afters) {
            const entries = (after.children ?? []).filter((c) => c.type !== NodeType.COMMENT);
            if (
                entries.length > 0 &&
                entries.every(
                    (c) =>
                        c.key !== undefined &&
                        /^(remove|clear)_/.test(c.key) &&
                        (isEffect?.(c.key) ?? true)
                )
            ) {
                out.push(
                    diag(
                        `${CONVENTION}after block only cleans up (${entries.map((c) => c.key).join(', ')}), the usual use of after: it runs once the chosen option has run.`,
                        after.range,
                        DiagnosticSeverity.Hint,
                        'CK3522'
                    )
                );
            }
        }
        if (hidden) {
            out.push(
                diag(
                    `${CONVENTION}after block in hidden event '${event.key}': a hidden event shows no options, so its effects belong in immediate.`,
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

/** CK3765 (information, convention, issue #25): a non-hidden event without a title. */
export function checkMissingTitle(event: ASTNode): Diagnostic[] {
    if (isHiddenEvent(event) || (event.children ?? []).length === 0) {
        return [];
    }
    if ((event.children ?? []).some((c) => c.key === 'title')) {
        return [];
    }
    return [
        diag(
            `${CONVENTION}event '${event.key}' is not hidden and has no 'title'.`,
            event.range,
            INFO,
            'CK3765'
        ),
    ];
}

/**
 * Portrait extensions (information, conventions, issue #27; game/events/_events.info):
 *     CK3423 a triggered_animation without trigger
 *     CK3424 a triggered_animation without animation or scripted_animation
 *     CK3425 a triggered_outfit without trigger
 *     CK3426 a portrait position given twice in one event
 */
export function checkPortraitExtensions(event: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    const seen = new Set<string>();
    for (const portrait of (event.children ?? []).filter(
        (c) => c.key !== undefined && isValidPortraitPosition(c.key)
    )) {
        if (seen.has(portrait.key!)) {
            out.push(
                diag(
                    `${CONVENTION}portrait position '${portrait.key}' is given more than once in this event.`,
                    portrait.range,
                    INFO,
                    'CK3426'
                )
            );
        }
        seen.add(portrait.key!);
        for (const ta of childrenWithKey(portrait, 'triggered_animation')) {
            const keys = new Set((ta.children ?? []).map((c) => c.key));
            if (!keys.has('trigger')) {
                out.push(
                    diag(
                        `${CONVENTION}triggered_animation without a trigger.`,
                        ta.range,
                        INFO,
                        'CK3423'
                    )
                );
            }
            if (!keys.has('animation') && !keys.has('scripted_animation')) {
                out.push(
                    diag(
                        `${CONVENTION}triggered_animation without an animation or scripted_animation.`,
                        ta.range,
                        INFO,
                        'CK3424'
                    )
                );
            }
        }
        for (const to of childrenWithKey(portrait, 'triggered_outfit')) {
            if (!(to.children ?? []).some((c) => c.key === 'trigger')) {
                out.push(
                    diag(
                        `${CONVENTION}triggered_outfit without a trigger.`,
                        to.range,
                        INFO,
                        'CK3425'
                    )
                );
            }
        }
    }
    return out;
}

/**
 * Background overrides (issue #28):
 *     CK3431 (warning) an override_background reference defined neither in the workspace's
 *            nor in the base game's common/event_backgrounds (catalogue
 *            failed_to_read_key_reference_X_from_database_X); silent while unknown
 *     CK3433 (information) an untriggered override_background that is the background the
 *            theme always shows first (redundant)
 */
export function checkBackgrounds(event: ASTNode, knowledge: ParadoxKnowledge): Diagnostic[] {
    const out: Diagnostic[] = [];
    const theme = childrenWithKey(event, 'theme').find((t) => typeof t.value === 'string');
    const themeDefault =
        theme && knowledge.themeDefaultBackground
            ? knowledge.themeDefaultBackground(String(theme.value))
            : undefined;
    for (const override of childrenWithKey(event, 'override_background')) {
        const ref = (override.children ?? []).find((c) => c.key === 'reference');
        if (!ref || typeof ref.value !== 'string' || ref.value.includes('$')) {
            continue;
        }
        const name = ref.value;
        if (knowledge.isKnownBackground && !knowledge.isKnownBackground(name)) {
            out.push(
                diag(
                    `Unknown event background '${name}': defined neither in the workspace's nor in the base game's common/event_backgrounds`,
                    ref.range,
                    DiagnosticSeverity.Warning,
                    'CK3431'
                )
            );
            continue;
        }
        const triggered = (override.children ?? []).some((c) => c.key === 'trigger');
        if (!triggered && themeDefault === name) {
            out.push(
                diag(
                    `${CONVENTION}override_background '${name}' is already the default background of theme '${String(theme!.value)}'.`,
                    override.range,
                    INFO,
                    'CK3433'
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

/** A modifier's `add`: its numeric value, or undefined when it is not a plain number. */
function addValue(modifier: ASTNode): { present: boolean; value?: number } {
    const add = (modifier.children ?? []).find((c) => c.key === 'add');
    if (!add) {
        return { present: false };
    }
    const value = numberValue(add);
    return { present: true, value };
}

/**
 * ai_chance (all information or hint, conventions: no error-catalogue message):
 *     CK3610 a negative base
 *     CK3611 the total is zero whatever applies: base 0 and no modifier that can add weight,
 *            or an unconditional `factor = 0` (issue #21)
 *     CK3612 the total can be negative: base plus every negative `add` is below zero
 *            (issue #22); a negative base is CK3610
 *     CK3614 a modifier without a trigger applies unconditionally
 * The totals are judged only when every entry of the block is `base` or a `modifier` with
 * plain numbers (opinion_modifier, compare_modifier, scripted modifiers and script-value
 * adds can add anything).
 */
export function checkAiChance(node: ASTNode): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const block of aiChanceBlocks(node)) {
        const children = (block.children ?? []).filter((c) => c.type !== NodeType.COMMENT);
        const baseNode = children.find((c) => c.key === 'base');
        const base = numberValue(baseNode);
        const modifiers = children.filter((c) => c.key === 'modifier');
        if (base !== undefined && base < 0) {
            out.push(
                diag(
                    `${CONVENTION}negative ai_chance base (${base}).`,
                    baseNode!.range,
                    INFO,
                    'CK3610'
                )
            );
        }
        for (const modifier of modifiers) {
            const hasCondition = (modifier.children ?? []).some(
                (c) => c.key !== 'factor' && c.key !== 'add' && c.key !== 'multiply'
            );
            if (!hasCondition) {
                out.push(
                    diag(
                        `${CONVENTION}ai_chance modifier without a trigger applies unconditionally; fold it into base.`,
                        modifier.range,
                        INFO,
                        'CK3614'
                    )
                );
            }
        }
        const plain = children.every((c) => c.key === 'base' || c.key === 'modifier');
        if (!plain || base === undefined) {
            continue;
        }
        const adds = modifiers.map(addValue).filter((a) => a.present);
        const unconditionalZero = modifiers.some(
            (m) =>
                (m.children ?? []).every((c) => c.key === 'factor' || c.key === 'multiply') &&
                (m.children ?? []).some(
                    (c) => (c.key === 'factor' || c.key === 'multiply') && numberValue(c) === 0
                )
        );
        const mayAdd = adds.some((a) => a.value === undefined || a.value > 0);
        if (unconditionalZero || (base === 0 && !mayAdd)) {
            out.push(
                diag(
                    `${CONVENTION}the ai_chance total is zero whatever applies (${unconditionalZero ? 'an unconditional factor = 0' : 'base = 0 and no modifier adds weight'}): the AI never picks this option.`,
                    block.range,
                    INFO,
                    'CK3611'
                )
            );
            continue;
        }
        if (base >= 0 && adds.every((a) => a.value !== undefined)) {
            const lowest = base + adds.reduce((sum, a) => sum + Math.min(0, a.value!), 0);
            if (lowest < 0) {
                out.push(
                    diag(
                        `${CONVENTION}the ai_chance total can be negative (base ${base} plus the negative adds is ${lowest}).`,
                        block.range,
                        INFO,
                        'CK3612'
                    )
                );
            }
        }
    }
    return out;
}

/**
 * CK3613 (hint, convention, issue #23): an option of a non-hidden event with several options
 * has neither ai_chance nor ai_will_select, so the AI weighs it by default.
 */
export function checkMissingAiChance(event: ASTNode): Diagnostic[] {
    const options = childrenWithKey(event, 'option');
    if (isHiddenEvent(event) || options.length < 2) {
        return [];
    }
    const out: Diagnostic[] = [];
    for (const option of options) {
        const keys = new Set((option.children ?? []).map((c) => c.key));
        if (!keys.has('ai_chance') && !keys.has('ai_will_select')) {
            out.push(
                diag(
                    `${CONVENTION}option without ai_chance or ai_will_select; the AI weighs it by default.`,
                    option.range,
                    DiagnosticSeverity.Hint,
                    'CK3613'
                )
            );
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
            out.push(...checkEventStructure(event, config, knowledge.isEffect));
            out.push(...checkTheme(event, knowledge));
            if (config.descValidation) {
                out.push(...checkMissingTitle(event));
            }
            if (config.portraitValidation) {
                out.push(...checkPortraitExtensions(event));
            }
            out.push(...checkBackgrounds(event, knowledge));
            if (config.aiChanceValidation) {
                out.push(...checkMissingAiChance(event));
            }
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
