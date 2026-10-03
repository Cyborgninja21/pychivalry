/**
 * Scope timing: when an event's blocks run, and which saved scopes and variables exist then.
 *
 * Evaluation order of a CK3 1.20 event (corrected in 2.2, issue #95):
 *     1. trigger              evaluated before the event fires
 *     2. immediate            runs when the event fires
 *     3. the window           title, desc (with its triggered_desc triggers), portraits and
 *                             options are evaluated when the window is shown, after immediate:
 *                             the base game saves scopes in immediate for its descriptions
 *                             (864 vanilla events read an immediate-saved scope in a desc
 *                             triggered_desc trigger, first birth.9002 `scope:suggester`)
 *     4. the chosen option    its effects run when the player or the AI picks it
 *     5. after                runs after the option
 *
 * None of these rules has engine evidence (no error-catalogue message, schema field or
 * oracle entry; a scope can also arrive from the calling event), so every code here is a
 * convention at information severity.
 *
 * DIAGNOSTIC CODES (all information, conventions):
 *     CK3550: a scope read in `trigger` is saved in `immediate` (which runs later) and not
 *             earlier in the trigger itself (issue #96); the calling event may pass it
 *     CK3551: a scope read in `desc` that this event saves only in an option or `after`
 *             (after the window is shown)
 *     CK3552: the same in a `triggered_desc` trigger of `desc` (issue #95: scopes saved in
 *             immediate are available there)
 *     CK3553: a local variable checked in `trigger` is set in `immediate`; local variables
 *             do not outlive the effect that sets them. Ordinary and global variables persist
 *             and are not reported (issue #97: an earlier firing set it)
 *     CK3554: a temporary scope passed to a triggered event (it does not persist)
 *     CK3560: the desc localization text reads a scope this event saves only in an option or
 *             `after` (the localization half of #60, on the corrected order of #95: a scope
 *             saved in immediate is available to the desc text and is not reported)
 *     CK3561: the same for the title localization text
 *     CK3563: trigger guard (#60): `immediate` saves a scope from a `random_` iterator, an
 *             option uses it and `trigger` has no `any_` iterator over the same list (the list
 *             base from the spec package), so the scope can be unset when nothing matches
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { ASTNode, LocalizationIndex, Spec } from 'pychivalry-engine';
import { childrenWithKey, eventsOf, isEventFile, walk } from './event-helpers';

export interface ScopeTimingConfig {
    checkTriggerBlock: boolean;
    checkDescBlock: boolean;
    checkTriggeredDesc: boolean;
    checkVariables: boolean;
    checkTemporaryScopes: boolean;
    checkLocalization: boolean;
    checkTriggerGuard: boolean;
}

export const DEFAULT_SCOPE_TIMING_CONFIG: ScopeTimingConfig = {
    checkTriggerBlock: true,
    checkDescBlock: true,
    checkTriggeredDesc: true,
    checkVariables: true,
    checkTemporaryScopes: true,
    checkLocalization: true,
    checkTriggerGuard: true,
};

const CONVENTION = 'Convention: ';

function info(message: string, range: Range, code: string): Diagnostic {
    return {
        message: CONVENTION + message,
        severity: DiagnosticSeverity.Information,
        range,
        code,
        source: 'ck3-ls-timing',
    };
}

/** The name a node saves as a scope (save_scope_as, save_temporary_scope_as, *_value_as). */
function savedName(node: ASTNode): string | undefined {
    if (
        (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') &&
        typeof node.value === 'string'
    ) {
        return node.value;
    }
    if (
        (node.key === 'save_scope_value_as' || node.key === 'save_temporary_scope_value_as') &&
        node.children
    ) {
        const name = node.children.find((c) => c.key === 'name');
        return name && typeof name.value === 'string' ? name.value : undefined;
    }
    return undefined;
}

function savedNames(nodes: ASTNode[]): Set<string> {
    const names = new Set<string>();
    for (const node of nodes) {
        walk(node, (n) => {
            const name = savedName(n);
            if (name) {
                names.add(name);
            }
        });
    }
    return names;
}

/** `scope:name` references of a key or value (the first chain segment). */
function scopeRefs(node: ASTNode): string[] {
    const out: string[] = [];
    for (const text of [node.key, typeof node.value === 'string' ? node.value : undefined]) {
        if (text) {
            const m = /^scope:([A-Za-z0-9_]+)/.exec(text);
            if (m) {
                out.push(m[1]);
            }
        }
    }
    return out;
}

/** Every `scope:name` read under `root`, with its node. */
function scopeReads(root: ASTNode): Array<{ name: string; node: ASTNode }> {
    const out: Array<{ name: string; node: ASTNode }> = [];
    walk(root, (n) => {
        for (const name of scopeRefs(n)) {
            out.push({ name, node: n });
        }
    });
    return out;
}

/** Scopes this event saves only after its window is shown (options and `after`). */
function savedAfterDisplay(event: ASTNode): Set<string> {
    const early = savedNames([
        ...childrenWithKey(event, 'trigger'),
        ...childrenWithKey(event, 'immediate'),
    ]);
    const late = savedNames([
        ...childrenWithKey(event, 'option'),
        ...childrenWithKey(event, 'after'),
    ]);
    return new Set([...late].filter((n) => !early.has(n)));
}

/** CK3550: scope read in trigger, saved in immediate, not saved before in the trigger. */
function checkTrigger(event: ASTNode, out: Diagnostic[]): void {
    const immediate = savedNames(childrenWithKey(event, 'immediate'));
    if (immediate.size === 0) {
        return;
    }
    for (const trigger of childrenWithKey(event, 'trigger')) {
        // Document order: a save earlier in the trigger makes the scope available (#96).
        const savedSoFar = new Set<string>();
        walk(trigger, (n) => {
            for (const name of scopeRefs(n)) {
                if (immediate.has(name) && !savedSoFar.has(name)) {
                    out.push(
                        info(
                            `scope '${name}' is read in the trigger but saved in immediate, which runs after the trigger is evaluated; it exists only if the calling event passes it.`,
                            n.range,
                            'CK3550'
                        )
                    );
                }
            }
            const saved = savedName(n);
            if (saved) {
                savedSoFar.add(saved);
            }
        });
    }
}

/** CK3551 / CK3552: desc reads of scopes saved only in options or after. */
function checkDesc(event: ASTNode, config: ScopeTimingConfig, out: Diagnostic[]): void {
    const late = savedAfterDisplay(event);
    if (late.size === 0) {
        return;
    }
    for (const desc of childrenWithKey(event, 'desc')) {
        const inTdTrigger = new Set<ASTNode>();
        walk(desc, (n) => {
            if (n.key === 'triggered_desc') {
                for (const t of childrenWithKey(n, 'trigger')) {
                    walk(t, (m) => inTdTrigger.add(m));
                }
            }
        });
        for (const { name, node } of scopeReads(desc)) {
            if (!late.has(name)) {
                continue;
            }
            const inTrigger = inTdTrigger.has(node);
            if (inTrigger && config.checkTriggeredDesc) {
                out.push(
                    info(
                        `scope '${name}' is read in a triggered_desc trigger but this event saves it only in an option or after, which run after the window is shown.`,
                        node.range,
                        'CK3552'
                    )
                );
            } else if (!inTrigger && config.checkDescBlock) {
                out.push(
                    info(
                        `scope '${name}' is read in desc but this event saves it only in an option or after, which run after the window is shown.`,
                        node.range,
                        'CK3551'
                    )
                );
            }
        }
    }
}

/** CK3553: local variable checked in trigger, set in immediate. */
function checkVariables(event: ASTNode, out: Diagnostic[]): void {
    const setInImmediate = new Set<string>();
    for (const imm of childrenWithKey(event, 'immediate')) {
        walk(imm, (n) => {
            if (n.key === 'set_local_variable') {
                const name =
                    typeof n.value === 'string'
                        ? n.value
                        : (n.children ?? []).find((c) => c.key === 'name')?.value;
                if (typeof name === 'string') {
                    setInImmediate.add(name);
                }
            }
        });
    }
    if (setInImmediate.size === 0) {
        return;
    }
    for (const trigger of childrenWithKey(event, 'trigger')) {
        walk(trigger, (n) => {
            const names: string[] = [];
            if (n.key === 'has_local_variable' && typeof n.value === 'string') {
                names.push(n.value);
            }
            for (const text of [n.key, typeof n.value === 'string' ? n.value : undefined]) {
                const m = text ? /(?:^|\.)local_var:([A-Za-z0-9_]+)/.exec(text) : null;
                if (m) {
                    names.push(m[1]);
                }
            }
            for (const name of names) {
                if (setInImmediate.has(name)) {
                    out.push(
                        info(
                            `local variable '${name}' is checked in the trigger but set in immediate; local variables do not outlive the effect that sets them.`,
                            n.range,
                            'CK3553'
                        )
                    );
                }
            }
        });
    }
}

/** CK3554: a temporary scope handed to trigger_event. */
function checkTemporaryScopes(event: ASTNode, out: Diagnostic[]): void {
    const temporary = new Set<string>();
    walk(event, (n) => {
        if (n.key === 'save_temporary_scope_as' && typeof n.value === 'string') {
            temporary.add(n.value);
        }
    });
    if (temporary.size === 0) {
        return;
    }
    walk(event, (n) => {
        if (n.key !== 'trigger_event') {
            return;
        }
        for (const child of n.children ?? []) {
            if (child.key === 'scope' && typeof child.value === 'string') {
                const ref = child.value.replace(/^scope:/, '');
                if (temporary.has(ref)) {
                    out.push(
                        info(
                            `temporary scope '${ref}' is passed to a triggered event but does not persist across events; use save_scope_as.`,
                            child.range,
                            'CK3554'
                        )
                    );
                }
            }
        }
    });
}

/** Localization keys a title or desc block names (plain keys and dynamic descriptions). */
function locKeysOf(block: ASTNode): string[] {
    const keys: string[] = [];
    walk(block, (n) => {
        if (
            (n === block || n.key === 'desc' || n.key === 'text') &&
            typeof n.value === 'string' &&
            /^[A-Za-z_][A-Za-z0-9_.]*$/.test(n.value)
        ) {
            keys.push(n.value);
        }
    });
    return keys;
}

/**
 * Saved-scope names a localization text reads: `[name.GetFirstName]`, `[name|E]` and
 * `[SCOPE.sC('name')…]` (the first segment of a bracket expression; ROOT, THIS and the
 * other capitalised data types are not saved scopes).
 */
export function locScopeNames(text: string): Set<string> {
    const names = new Set<string>();
    for (const m of text.matchAll(/\[([a-z_][A-Za-z0-9_]*)[.|\]]/g)) {
        names.add(m[1]);
    }
    for (const m of text.matchAll(/SCOPE\.s[A-Za-z]*\('([A-Za-z0-9_]+)'\)/g)) {
        names.add(m[1]);
    }
    return names;
}

/** CK3560 / CK3561: desc and title texts that read scopes saved only after display. */
function checkLocalization(
    event: ASTNode,
    localization: LocalizationIndex | undefined,
    out: Diagnostic[]
): void {
    if (!localization) {
        return;
    }
    const late = savedAfterDisplay(event);
    if (late.size === 0) {
        return;
    }
    for (const [field, code] of [
        ['desc', 'CK3560'],
        ['title', 'CK3561'],
    ] as const) {
        for (const block of childrenWithKey(event, field)) {
            for (const key of locKeysOf(block)) {
                const entry = localization.findLocalization(key);
                if (!entry) {
                    continue;
                }
                for (const name of locScopeNames(entry.text)) {
                    if (late.has(name)) {
                        out.push(
                            info(
                                `the ${field} text '${key}' reads scope '${name}', which this event saves only in an option or after, after the window is shown.`,
                                block.range,
                                code
                            )
                        );
                    }
                }
            }
        }
    }
}

/** The list base of an iterator key (`random_courtier` → `courtier`), from the spec. */
function listBaseOf(key: string, prefix: string, spec?: Spec): string | undefined {
    if (!key.startsWith(prefix)) {
        return undefined;
    }
    if (spec) {
        const match = spec.isIterator(key);
        return match && match.prefix === prefix ? match.base : undefined;
    }
    return key.slice(prefix.length);
}

/** CK3563: a random_ iterator saves the scope in immediate with no any_ guard in trigger. */
function checkTriggerGuard(event: ASTNode, out: Diagnostic[], spec?: Spec): void {
    const trigger = childrenWithKey(event, 'trigger');
    const guarded = new Set<string>();
    for (const t of trigger) {
        walk(t, (n) => {
            const base = n.key ? listBaseOf(n.key, 'any_', spec) : undefined;
            if (base) {
                guarded.add(base);
            }
        });
    }
    const usedInOptions = new Set<string>();
    for (const option of childrenWithKey(event, 'option')) {
        for (const { name } of scopeReads(option)) {
            usedInOptions.add(name);
        }
    }
    for (const imm of childrenWithKey(event, 'immediate')) {
        walk(imm, (n) => {
            const list = n.key ? listBaseOf(n.key, 'random_', spec) : undefined;
            if (!list || !n.children) {
                return;
            }
            for (const child of n.children) {
                const name = savedName(child);
                if (name && usedInOptions.has(name) && !guarded.has(list)) {
                    out.push(
                        info(
                            `scope '${name}' is saved from ${n.key} in immediate and used in an option, but the trigger has no any_${list} check: when nothing matches, the scope is unset.`,
                            n.range,
                            'CK3563'
                        )
                    );
                }
            }
        });
    }
}

/** Scope timing for every event of an events/ file. */
export function validateDocumentScopeTiming(
    rootNode: ASTNode,
    config: ScopeTimingConfig = DEFAULT_SCOPE_TIMING_CONFIG,
    file = 'events/',
    localization?: LocalizationIndex,
    spec?: Spec
): Diagnostic[] {
    if (!isEventFile(file)) {
        return [];
    }
    const out: Diagnostic[] = [];
    for (const event of eventsOf(rootNode)) {
        if (config.checkTriggerBlock) {
            checkTrigger(event, out);
        }
        if (config.checkDescBlock || config.checkTriggeredDesc) {
            checkDesc(event, config, out);
        }
        if (config.checkVariables) {
            checkVariables(event, out);
        }
        if (config.checkTemporaryScopes) {
            checkTemporaryScopes(event, out);
        }
        if (config.checkLocalization) {
            checkLocalization(event, localization, out);
        }
        if (config.checkTriggerGuard) {
            checkTriggerGuard(event, out, spec);
        }
    }
    return out;
}
