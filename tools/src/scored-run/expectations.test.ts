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
    const elsewhere = held(t, 'decision-hold-feast', () => undefined, [
        {
            kind: 'resolves',
            database: 'common/decisions',
            name: 'authoring_hold_feast_decision',
            uses: 'feast_host_reward_effect',
            to: 'common/scripted_triggers',
        },
    ]);
    assert.deepEqual(unmet(elsewhere), [
        'authoring_hold_feast_decision (common/decisions) uses feast_host_reward_effect, defined in common/scripted_triggers: feast_host_reward_effect is defined in common/scripted_triggers by neither the mod nor the base game',
    ]);
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
    const results = held(t, 'decision-hold-feast', (mod) => {
        edit(mod, 'common/scripted_effects/feast_effects.txt', 'add_piety = 10', 'add_piety = 20');
        rmSync(path.join(mod, 'localization', 'english', 'feast_l_english.yml'));
    });
    assert.deepEqual(unmet(results), [
        'common/scripted_effects/feast_effects.txt is unchanged: common/scripted_effects/feast_effects.txt was changed',
        'localization/english/feast_l_english.yml is unchanged: localization/english/feast_l_english.yml was removed',
    ]);
});

test('file: a file the base already had is not new', (t) => {
    const results = held(t, 'trigger-feast-guest', () => undefined, [
        { kind: 'file', folder: 'events', new: true },
        { kind: 'file', folder: 'events' },
        { kind: 'file', folder: 'common/scripted_triggers', new: true },
    ]);
    assert.deepEqual(unmet(results), ['a new file in events: the mod has no new file in events']);
});
