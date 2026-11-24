/**
 * The expectations of a request, checked in code on a result (`expectations.ts`): each kind is
 * met on a request's example result and not met, with its reason, on a copy of it that breaks
 * the expectation. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { checkOver, exampleResult, root } from './authoring-testing.js';
import { checkExpectations, type ExpectationResult } from './expectations.js';
import { baseDir, committedRequests, type ContentRequest, type Expectation } from './requests.js';

const list = committedRequests(root);

function request(id: string): ContentRequest {
    const found = list.requests.find((r) => r.id === id);
    assert.ok(found !== undefined, id);
    return found;
}

/** The expectations of a request held against its example result, changed by `change`. */
function held(
    t: TestContext,
    id: string,
    change: (mod: string) => void,
    expect?: readonly Expectation[],
): ExpectationResult[] {
    const r = request(id);
    const mod = exampleResult(t, r);
    change(mod);
    const check = checkOver(t, mod);
    return checkExpectations(
        { index: check.index, modDir: mod, givenDir: baseDir(root, r.base) },
        expect ?? r.expect,
    );
}

function unmet(results: readonly ExpectationResult[]): string[] {
    return results.filter((r) => !r.met).map((r) => `${r.expectation}: ${String(r.problem)}`);
}

/** Replace `from` with `to` in a file of the mod (both with `\r\n` line breaks). */
function edit(mod: string, file: string, from: string, to: string): void {
    const full = path.join(mod, ...file.split('/'));
    const text = readFileSync(full, 'utf8');
    assert.ok(text.includes(from), `${file} holds ${JSON.stringify(from)}`);
    writeFileSync(full, text.replace(from, to));
}

test('a result that writes nothing meets none of its expectations', (t) => {
    const results = held(t, 'event-merchant-debt', (mod) => {
        rmSync(path.join(mod, 'events'), { recursive: true });
        rmSync(path.join(mod, 'localization'), { recursive: true });
    });
    assert.ok(results.every((r) => !r.met));
    assert.deepEqual(unmet(results).slice(0, 4), [
        'a new file in events: the mod has no new file in events',
        'a new file in localization: the mod has no new file in localization',
        'namespace = authoring_merchant at the top of a file in events: no file in events has namespace = authoring_merchant at its top',
        'events defines authoring_merchant.0001: the mod does not define authoring_merchant.0001 in events',
    ]);
});

test('field: a value, a count and a field present are each checked in the record itself', (t) => {
    const file = 'events/authoring_merchant_events.txt';
    const results = held(t, 'event-merchant-debt', (mod) => {
        edit(mod, file, 'type = character_event', 'type = letter_event');
        edit(
            mod,
            file,
            '\toption = {\r\n\t\tname = authoring_merchant.0001.b',
            '\tafter = {\r\n\t\tname = authoring_merchant.0001.b',
        );
    });
    assert.deepEqual(
        unmet(results).filter((p) => p.startsWith('authoring_merchant.0001 (events) has')),
        [
            'authoring_merchant.0001 (events) has type = character_event: authoring_merchant.0001 has no type = character_event',
            'authoring_merchant.0001 (events) has option 2 times: authoring_merchant.0001 has option 1 time, not 2',
        ],
    );
    // A field written deeper than the record's own block is not the record's.
    const deeper = held(t, 'event-sleepless-night', (mod) => {
        edit(
            mod,
            'events/authoring_sleep_events.txt',
            '\ttrigger = {\r\n\t\tis_adult = yes\r\n\t\tis_imprisoned = no\r\n\t\tstress >= 50\r\n\t}\r\n',
            '',
        );
    });
    assert.ok(
        unmet(deeper).includes(
            'authoring_sleep.0001 (events) has trigger: authoring_sleep.0001 has no trigger',
        ),
        unmet(deeper).join('\n'),
    );
});

test('uses: the name must be written inside the definition, not elsewhere in its file', (t) => {
    const results = held(t, 'effect-children-gift', (mod) => {
        // The gold moves out of the first effect into the second.
        const file = 'common/scripted_effects/authoring_family_effects.txt';
        edit(mod, file, '\t\tadd_gold = 25\r\n', '');
        edit(mod, file, '\tadd_stress = -15\r\n', '\tadd_stress = -15\r\n\tadd_gold = 25\r\n');
    });
    assert.deepEqual(unmet(results), [
        'authoring_children_gift_effect (common/scripted_effects) uses add_gold: authoring_children_gift_effect does not use add_gold',
    ]);
});

test('resolves: the name must be defined in the database named, by the mod or the base game', (t) => {
    const results = held(t, 'event-letter-from-spouse', (mod) => {
        edit(
            mod,
            'events/authoring_letter_events.txt',
            'id = authoring_letter.0002',
            'id = authoring_letter.0003',
        );
    });
    const problems = unmet(results);
    assert.ok(
        problems.includes(
            'authoring_letter.0001 (events) uses authoring_letter.0002, defined in events: authoring_letter.0001 does not use authoring_letter.0002',
        ),
        problems.join('\n'),
    );
    // Used, but defined in another database than the one named.
    const elsewhere = held(t, 'decision-hold-banquet', () => undefined, [
        {
            kind: 'resolves',
            database: 'common/decisions',
            name: 'authoring_hold_banquet_decision',
            uses: 'banquet_host_reward_effect',
            to: 'common/scripted_triggers',
        },
    ]);
    assert.deepEqual(unmet(elsewhere), [
        'authoring_hold_banquet_decision (common/decisions) uses banquet_host_reward_effect, defined in common/scripted_triggers: banquet_host_reward_effect is defined in common/scripted_triggers by neither the mod nor the base game',
    ]);
});

test('through: a name used in an on-action the record fires, as the game documents it, is met', (t) => {
    // The game's own `common/on_action/_on_actions.info` lets an on-action fire others
    // (`on_actions = { ... }`), and gives that as the way a mod appends to one of the game's; the
    // base game hooks its own content into yearly_playable_pulse so. Two sessions of the first
    // scored authoring run did it, and the expectation without `through` failed them.
    const file = 'common/on_action/authoring_letter_on_actions.txt';
    const chained = (mod: string): void => {
        edit(
            mod,
            file,
            'yearly_playable_pulse = {\r\n\tevents = { authoring_letter.0001 }\r\n}\r\n',
            'yearly_playable_pulse = {\r\n\ton_actions = { authoring_letter_pulse }\r\n}\r\n\r\nauthoring_letter_pulse = {\r\n\ton_actions = { authoring_letter_relay }\r\n}\r\n\r\nauthoring_letter_relay = {\r\n\tevents = { authoring_letter.0001 }\r\n}\r\n',
        );
    };
    assert.deepEqual(unmet(held(t, 'event-letter-from-spouse', chained)), []);
    // Without `through`, as the first run's list had it, only a name written in the record counts.
    const direct: Expectation = {
        kind: 'resolves',
        database: 'common/on_action',
        name: 'yearly_playable_pulse',
        uses: 'authoring_letter.0001',
        to: 'events',
    };
    assert.deepEqual(unmet(held(t, 'event-letter-from-spouse', chained, [direct])), [
        'yearly_playable_pulse (common/on_action) uses authoring_letter.0001, defined in events: yearly_playable_pulse does not use authoring_letter.0001',
    ]);
    // An on-action of the mod that nothing in the record reaches does not count.
    const unhooked = held(t, 'event-letter-from-spouse', (mod) => {
        edit(
            mod,
            file,
            'yearly_playable_pulse = {\r\n\tevents = { authoring_letter.0001 }\r\n}\r\n',
            'yearly_playable_pulse = {\r\n\ton_actions = { authoring_letter_other }\r\n}\r\n\r\nauthoring_letter_other = {\r\n\ttrigger = { is_adult = yes }\r\n}\r\n\r\nauthoring_letter_pulse = {\r\n\tevents = { authoring_letter.0001 }\r\n}\r\n',
        );
    });
    assert.deepEqual(
        unmet(unhooked).filter((p) => p.startsWith('yearly_playable_pulse')),
        [
            "yearly_playable_pulse (common/on_action) uses authoring_letter.0001, directly or through the mod's common/on_action it uses, defined in events: yearly_playable_pulse does not use authoring_letter.0001, directly or through the mod's common/on_action",
        ],
    );
});

test('localization: a key the English file does not define, or a file the game does not read, is not met', (t) => {
    const file = 'localization/english/authoring_alms_l_english.yml';
    const results = held(t, 'decision-give-alms', (mod) => {
        edit(mod, file, 'authoring_alms_decision_desc:0', 'authoring_alms_decision_text:0');
    });
    assert.deepEqual(unmet(results), [
        "the English localization defines authoring_alms_decision_desc: the mod's English localization does not define authoring_alms_decision_desc",
    ]);
    // Without the byte-order mark, the game adds none of the file's keys (part D1).
    const unmarked = held(t, 'decision-give-alms', (mod) => {
        const full = path.join(mod, ...file.split('/'));
        writeFileSync(full, readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
    });
    assert.equal(unmet(unmarked).filter((p) => p.startsWith('the English localization')).length, 2);
});

test('unchanged: a file of the base changed or removed is not met', (t) => {
    const results = held(t, 'decision-hold-banquet', (mod) => {
        edit(
            mod,
            'common/scripted_effects/banquet_effects.txt',
            'add_piety = 10',
            'add_piety = 20',
        );
        rmSync(path.join(mod, 'localization', 'english', 'banquet_l_english.yml'));
    });
    assert.deepEqual(unmet(results), [
        'common/scripted_effects/banquet_effects.txt is unchanged: common/scripted_effects/banquet_effects.txt was changed',
        'localization/english/banquet_l_english.yml is unchanged: localization/english/banquet_l_english.yml was removed',
    ]);
});

test('file: a file the base already had is not new', (t) => {
    const results = held(t, 'trigger-banquet-guest', () => undefined, [
        { kind: 'file', folder: 'events', new: true },
        { kind: 'file', folder: 'events' },
        { kind: 'file', folder: 'common/scripted_triggers', new: true },
    ]);
    assert.deepEqual(unmet(results), ['a new file in events: the mod has no new file in events']);
});

test('within: a name used inside the block the request names its scope by, at any depth', (t) => {
    // The example runs the gift effect inside scope:envoy, and the courtier is picked inside
    // random_courtier: both met.
    assert.deepEqual(unmet(held(t, 'event-envoy-chain', () => undefined)), []);
    const file = 'events/authoring_envoy_events.txt';
    // Run on the character instead of on the saved courtier: used, but not inside scope:envoy.
    const self = held(t, 'event-envoy-chain', (mod) => {
        edit(
            mod,
            file,
            'scope:envoy = { authoring_envoy_gift_effect = yes }',
            'authoring_envoy_gift_effect = yes',
        );
    });
    assert.deepEqual(unmet(self), [
        'authoring_envoy.0002 (events) uses authoring_envoy_gift_effect inside scope:envoy, defined in common/scripted_effects: authoring_envoy.0002 does not use authoring_envoy_gift_effect inside scope:envoy',
    ]);
    // A name written in the block's key alone is not inside the block, and a block of the same
    // key in another definition does not count.
    const results = held(t, 'effect-heir-household', () => undefined, [
        {
            kind: 'uses',
            database: 'common/scripted_effects',
            name: 'authoring_heir_household_effect',
            uses: 'primary_heir',
            within: 'primary_heir',
        },
        {
            kind: 'uses',
            database: 'common/scripted_effects',
            name: 'authoring_heir_household_effect',
            uses: 'add_prestige',
            within: 'primary_heir',
        },
        {
            kind: 'uses',
            database: 'common/scripted_effects',
            name: 'authoring_heir_household_effect',
            uses: 'add_stress',
            within: 'primary_heir',
        },
    ]);
    assert.deepEqual(unmet(results), [
        'authoring_heir_household_effect (common/scripted_effects) uses primary_heir inside primary_heir: authoring_heir_household_effect does not use primary_heir inside primary_heir',
        'authoring_heir_household_effect (common/scripted_effects) uses add_stress inside primary_heir: authoring_heir_household_effect does not use add_stress inside primary_heir',
    ]);
});

test("defines with a count: a definition written a second time beside the base's is not met", (t) => {
    const results = held(t, 'effect-granary-gift-edit', (mod) => {
        writeFileSync(
            path.join(mod, 'common', 'scripted_effects', 'zz_override.txt'),
            '\uFEFFgranary_vassal_gift_effect = {\r\n\tadd_gold = 20\r\n}\r\n',
        );
    });
    assert.deepEqual(unmet(results), [
        'common/scripted_effects defines granary_vassal_gift_effect 1 time: the mod defines granary_vassal_gift_effect in common/scripted_effects 2 times, not 1',
    ]);
});

test('kept: a definition of the base changed, moved or removed is not met; one left alone is', (t) => {
    const file = 'common/scripted_effects/granary_effects.txt';
    const expect: Expectation[] = [
        { kind: 'kept', database: 'common/scripted_effects', name: 'granary_pay_effect' },
        { kind: 'kept', database: 'common/scripted_effects', name: 'granary_reward_effect' },
    ];
    // The example changes the file, but not these two.
    assert.deepEqual(unmet(held(t, 'effect-granary-gift-edit', () => undefined, expect)), []);
    const changed = held(
        t,
        'effect-granary-gift-edit',
        (mod) => {
            edit(mod, file, 'add_prestige = 40', 'add_prestige = 45');
            edit(mod, file, 'granary_pay_effect = { add_gold = -150 }\r\n', '');
        },
        expect,
    );
    assert.deepEqual(unmet(changed), [
        "the base's granary_pay_effect (common/scripted_effects) is kept as it was: granary_pay_effect is no longer in common/scripted_effects/granary_effects.txt",
        "the base's granary_reward_effect (common/scripted_effects) is kept as it was: granary_reward_effect was changed in common/scripted_effects/granary_effects.txt",
    ]);
    // Moved to a file of its own: not where the base has it.
    const moved = held(
        t,
        'effect-granary-gift-edit',
        (mod) => {
            edit(mod, file, 'granary_pay_effect = { add_gold = -150 }\r\n', '');
            writeFileSync(
                path.join(mod, 'common', 'scripted_effects', 'granary_pay.txt'),
                '\uFEFFgranary_pay_effect = {\r\n\tadd_gold = -150\r\n}\r\n',
            );
        },
        expect,
    );
    assert.deepEqual(unmet(moved), [
        "the base's granary_pay_effect (common/scripted_effects) is kept as it was: granary_pay_effect is no longer in common/scripted_effects/granary_effects.txt",
    ]);
    // A name the base does not define is a fault of the request, said as such.
    assert.deepEqual(
        unmet(
            held(t, 'effect-granary-gift-edit', () => undefined, [
                { kind: 'kept', database: 'common/scripted_effects', name: 'granary_other_effect' },
            ]),
        ),
        [
            "the base's granary_other_effect (common/scripted_effects) is kept as it was: the base does not define granary_other_effect in common/scripted_effects",
        ],
    );
});
