/**
 * The context reader (docs/PLAN.md item 4.3): which blocks hold triggers, effects, modifiers
 * and script values, and the rules of reading docs/decisions.md records for item 4.2. Each
 * case is a few lines of text read as the file at a path in a mod.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { parse } from '../syntax/parser.js';
import { blockOf, type Block } from '../syntax/tree.js';
import { readContext, type BlockKind } from './context.js';
import { checkMessage } from './finding.js';
import { checkText, specContext } from './testing.js';

/** The messages every check gives on a text read as `file`. */
function messages(
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
): string[] {
    return checkText(file, text, defined).map((f) => checkMessage(f));
}

/** The kind of the block below each top-level record's field `key`. */
function kindsOf(file: string, text: string): Record<string, BlockKind | undefined> {
    const parsed = parse(text);
    const reading = readContext({
        spec: committedSpec(),
        folders: specContext().folders,
        file,
        tree: parsed.file,
        names: { isDefined: () => false },
    });
    const out: Record<string, BlockKind | undefined> = {};
    for (const record of parsed.file.items) {
        const body = record.kind === 'pair' ? blockOf(record.value) : undefined;
        for (const item of body?.items ?? []) {
            if (item.kind === 'pair') {
                const block: Block | undefined = blockOf(item.value);
                out[item.key.text] = block === undefined ? undefined : reading.blocks.get(block);
            }
        }
    }
    return out;
}

test("a record's fields hold triggers or effects by their kind in the directory's schema", () => {
    assert.deepEqual(
        kindsOf(
            'common/decisions/fixture.txt',
            'fixture_decision = { is_shown = { } effect = { } ai_will_do = { } cost = { gold = 5 } }',
        ),
        { is_shown: 'trigger', effect: 'effect', ai_will_do: 'none', cost: 'script-value' },
    );
    assert.deepEqual(
        messages(
            'common/decisions/fixture.txt',
            'fixture_decision = { is_shown = { add_gold = 5 } }',
        ),
        ["Unknown trigger 'add_gold'"],
    );
});

test('a field the schema marks as holding modifiers is a modifier block', () => {
    assert.deepEqual(
        kindsOf(
            'common/culture/eras/fixture.txt',
            'era = { character_modifier = { diplomacy = 1 } }',
        ),
        { character_modifier: 'modifiers' },
    );
});

test('a file of a directory without a record schema is not read for triggers or effects', () => {
    assert.deepEqual(
        messages(
            'gfx/map/spline_network/spline_styles/fixture.txt',
            'style = { effect = { shaderfile = x } }',
        ),
        [],
    );
    assert.deepEqual(
        messages('not_a_game_folder/fixture.txt', 'x = { trigger = { fixture_bad = yes } }'),
        [],
    );
});

test("a dated history entry is read as the record's fields, whatever its measured kind", () => {
    const text =
        'k_fixture = { 1066.1.1 = { succession_laws = { x } effect = { fixture_bad = yes } } }';
    assert.deepEqual(messages('history/titles/fixture.txt', text), [
        "Unknown effect 'fixture_bad'",
    ]);
});

test('the records of the script-value directory are script values; a trigger block inside opens', () => {
    const text = [
        'fixture_value = {',
        '\tfaith = {',
        '\t\tevery_holy_site = {',
        '\t\t\tlimit = { fixture_bad = yes }',
        '\t\t\tadd = 1',
        '\t\t}',
        '\t}',
        '}',
    ].join('\n');
    assert.deepEqual(messages('common/script_values/fixture.txt', text), [
        "Unknown trigger 'fixture_bad'",
    ]);
});

test('outside trigger and effect blocks, a chain or a link written as a key is a scope switch', () => {
    const text =
        'fixture_decision = { scope:fixture ?= { add_gold = 5 } liege = { is_adult = yes } }';
    assert.deepEqual(messages('common/decisions/fixture.txt', text), []);
});

test('a key that differs from a known name only in letter case is read as that name', () => {
    const text =
        'fixture_trigger = { ROOT = { is_adult = yes } NOt = { Is_Adult = yes } Trigger_If = { } }';
    assert.deepEqual(messages('common/scripted_triggers/fixture.txt', text), []);
});

test('an inline scripted trigger is a trigger of its file, and its body holds triggers', () => {
    const text = [
        'scripted_trigger fixture_local = { add_gold = 5 }',
        'fixture_trigger = { fixture_local = yes fixture_elsewhere = yes }',
    ].join('\n');
    assert.deepEqual(messages('common/scripted_triggers/fixture.txt', text), [
        "Unknown trigger 'add_gold'",
        "Unknown trigger 'fixture_elsewhere'",
    ]);
    assert.deepEqual(
        messages(
            'common/scripted_triggers/fixture.txt',
            'fixture_trigger = { fixture_elsewhere = yes }',
            {
                'common/scripted_triggers': ['fixture_elsewhere'],
            },
        ),
        [],
        'a scripted trigger the index knows',
    );
    assert.deepEqual(
        messages(
            'common/scripted_effects/fixture.txt',
            'fixture_effect = { fixture_elsewhere = yes }',
            {
                'common/scripted_triggers': ['fixture_elsewhere'],
            },
        ),
        ["Unknown effect 'fixture_elsewhere'"],
        'a scripted trigger is no effect',
    );
});

test("containers read their body by their rule: a switch's cases, a random list's entries", () => {
    const text = [
        'fixture_effect = {',
        '\tswitch = {',
        '\t\ttrigger = has_trait',
        '\t\tbrave = { add_gold = 1 }',
        '\t\tfallback = { fixture_bad = yes }',
        '\t}',
        '\trandom_list = { 10 = { trigger = { fixture_worse = yes } add_gold = 1 } }',
        '}',
    ].join('\n');
    assert.deepEqual(messages('common/scripted_effects/fixture.txt', text), [
        "Unknown effect 'fixture_bad'",
        "Unknown trigger 'fixture_worse'",
    ]);
});

test("an iterator reads its parameters, the game's documented ones among them", () => {
    const text = [
        'fixture_effect = {',
        '\tevery_ruler = { culture_filter = root faith_filter = root add_gold = 1 }',
        '\tordered_vassal = { order_by = gold max = 3 add_gold = 1 }',
        '}',
    ].join('\n');
    assert.deepEqual(messages('common/scripted_effects/fixture.txt', text), []);
});

test('a trigger the game documents as yes or no is no container', () => {
    assert.deepEqual(
        messages('common/scripted_triggers/fixture.txt', 'fixture_trigger = { debug_only = yes }'),
        [],
    );
});

test('a keyword template is a keyword when a key of its database fills it', () => {
    const text = 'fixture_effect = { add_fixturelife_xp = 5 }';
    assert.deepEqual(messages('common/scripted_effects/fixture.txt', text), [
        "Unknown effect 'add_fixturelife_xp'",
    ]);
    assert.deepEqual(
        messages('common/scripted_effects/fixture.txt', text, {
            'common/lifestyles': ['fixturelife'],
        }),
        [],
    );
});

test('a chain may end in a value: a comparison trigger, a value given its data, a script value', () => {
    const text = [
        'fixture_trigger = {',
        '\troot.liege.gold > 5',
        '\tscope:fixture.primary_title.tier >= 2',
        '\tvalue = scope:fixture.tax_collector_aptitude:fixture_slot',
        '\tvalue = root.fixture_script_value',
        '\tvalue = root.fixture_not_defined',
        '}',
    ].join('\n');
    assert.deepEqual(
        messages('common/scripted_triggers/fixture.txt', text, {
            'common/script_values': ['fixture_script_value'],
        }),
        [
            'Failed to parse data for event target link. Link: root.fixture_not_defined, location: line 6',
        ],
    );
});
