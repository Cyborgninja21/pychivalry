/**
 * Where trigger and effect blocks open, outside the per-directory schema.
 *
 * The schema (spec package) says which record fields are trigger or effect blocks; these
 * tables cover what it cannot: blocks nested below a record field, and registered
 * keywords whose block body is itself a trigger or effect block (`if`, `hidden_effect`,
 * `random_list` …). Ported from the coordinator's TRIGGER_CONTEXT_KEYS /
 * EFFECT_CONTEXT_KEYS, reduced to the entries the vanilla 1.20 corpus confirms.
 */

import { ChildContext } from './structural';

/** Block keys that open a context wherever they appear outside a trigger/effect block. */
export const OPENS_CONTEXT: ReadonlyMap<string, 'trigger' | 'effect'> = new Map<
    string,
    'trigger' | 'effect'
>([
    // effect blocks
    ['effect', 'effect'],
    ['immediate', 'effect'],
    ['after', 'effect'],
    ['option', 'effect'],
    // trigger blocks
    ['trigger', 'trigger'],
    ['limit', 'trigger'],
    ['is_shown', 'trigger'],
    ['is_valid', 'trigger'],
    ['is_valid_showing_failures_only', 'trigger'],
    ['potential', 'trigger'],
    ['allow', 'trigger'],
    ['ai_potential', 'trigger'],
]);

/**
 * Keys that mark a block as a script value (`value = x`, `add = 5` …) rather than a
 * trigger or effect block. A block whose direct children include one of them is read as
 * a value block even where the schema records an effect or trigger block (the schema
 * inventory classifies some value fields, e.g. accolade_types `weight`, as effect blocks).
 */
export const VALUE_BLOCK_KEYS: ReadonlySet<string> = new Set([
    'value',
    'base',
    'add',
    'subtract',
    'multiply',
    'divide',
    'factor',
    'round',
]);

export interface ContainerRule {
    /** Context of the body (relative to where the keyword is used, for 'same'). */
    child: ChildContext;
    /** Parameter keys of the body, read as values (or with their own context). */
    params?: ReadonlyMap<string, ChildContext>;
    /** Every other key of the body is a case label whose block keeps the context. */
    cases?: boolean;
    /** Parameter keys inside each case block. */
    caseParams?: ReadonlyMap<string, ChildContext>;
    /** Case blocks also accept scripted modifiers (random_list weight modifiers). */
    caseScriptedModifiers?: boolean;
    /** The body accepts scripted modifiers (random's chance modifiers). */
    scriptedModifiers?: boolean;
}

/**
 * Record fields read as script values even where the schema inventory records a trigger
 * block: interaction and court-position `cost` blocks hold currencies (gold, piety,
 * prestige, renown …), and gold/piety/prestige are also trigger names.
 */
export const VALUE_FIELDS: ReadonlySet<string> = new Set(['cost']);

/** Parameters of blocks that open a context, keyed by the block's key. */
export const BLOCK_PARAMS: ReadonlyMap<string, ReadonlyMap<string, ChildContext>> = new Map([
    ['ai_value_modifier', new Map<string, ChildContext>([['who', 'none']])],
]);

const RANDOM_LIST_ENTRY: ReadonlyMap<string, ChildContext> = new Map<string, ChildContext>([
    ['trigger', 'trigger'],
    ['modifier', 'none'],
    ['compare_modifier', 'none'],
    ['opinion_modifier', 'none'],
    ['ai_value_modifier', 'none'],
    ['compatibility_modifier', 'none'],
    ['show_chance', 'none'],
    ['desc', 'none'],
    ['min', 'none'],
    ['max', 'none'],
]);

/**
 * Registered keywords (in the triggers or effects bucket) whose block body holds
 * triggers or effects rather than parameters.
 */
export const CONTAINERS: ReadonlyMap<string, ContainerRule> = new Map<string, ContainerRule>([
    ['if', { child: 'same' }],
    ['else_if', { child: 'same' }],
    ['else', { child: 'same' }],
    ['trigger_if', { child: 'trigger' }],
    ['trigger_else_if', { child: 'trigger' }],
    ['trigger_else', { child: 'trigger' }],
    ['hidden_effect', { child: 'effect' }],
    ['show_as_tooltip', { child: 'effect' }],
    [
        'random',
        {
            child: 'effect',
            params: new Map<string, ChildContext>([
                ['chance', 'none'],
                ['modifier', 'none'],
                ['compare_modifier', 'none'],
                ['opinion_modifier', 'none'],
                ['ai_value_modifier', 'none'],
                ['compatibility_modifier', 'none'],
            ]),
            scriptedModifiers: true,
        },
    ],
    ['while', { child: 'effect', params: new Map<string, ChildContext>([['count', 'none']]) }],
    ['calc_true_if', { child: 'trigger', params: new Map([['amount', 'none']]) }],
    ['any_false', { child: 'trigger' }],
    ['all_false', { child: 'trigger' }],
    ['debug_only', { child: 'trigger' }],
    [
        'custom_tooltip',
        {
            child: 'same',
            params: new Map([
                ['text', 'none'],
                ['subject', 'none'],
                ['object', 'none'],
                ['value', 'none'],
            ]),
        },
    ],
    [
        'custom_description',
        {
            child: 'same',
            params: new Map([
                ['text', 'none'],
                ['subject', 'none'],
                ['object', 'none'],
                ['value', 'none'],
            ]),
        },
    ],
    ['switch', { child: 'same', params: new Map([['trigger', 'none']]), cases: true }],
    [
        'random_list',
        { child: 'same', cases: true, caseParams: RANDOM_LIST_ENTRY, caseScriptedModifiers: true },
    ],
]);
