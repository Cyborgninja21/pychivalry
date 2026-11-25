/**
 * `lookup` answers every name whole (the owner's decision of 2026-11-25, tool schema version 4),
 * held on the very calls that showed the need, and on the largest names of the spec package.
 *
 * - **The expert requests' development run, replayed.** Its 61 sessions' first `lookup` calls,
 *   each name and language exactly as the session gave them (read from the run's kept output
 *   streams, which are not committed; the record keeps no tool input). Each asked for 2 to 20
 *   names and got 1 to 3 of them on its first page. Now each call answers every name whole or
 *   names it in `not_answered`: every name asked is one or the other, never both, the answers in
 *   the order asked; a name's answer in the call is exactly its answer asked alone (nothing is
 *   cut inside a name); asking again with `not_answered` answers the rest; and there is no
 *   cursor anywhere. In CI over a game stub in which each name is used in 20 files of long
 *   paths, as the real game uses them; locally over the installed game too (`CK3_GAME_PATH`).
 * - **The largest names of the spec package.** Every name of its buckets, its record schemas and
 *   its scope types fits one result alone (`NAME_ROOM`), the largest written smaller as
 *   `answerOf` says; the twenty largest are each answered whole through the server, under the
 *   result size limit.
 */

import assert from 'node:assert/strict';
import { lookup, openSpec } from '@pychivalry/core';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { defaultSpecDir } from './args.js';
import { answerOf, NAME_ROOM } from './tools/lookup-answer.js';
import { ASK_AGAIN } from './tools/lookup.js';
import {
    connect,
    gameStub,
    MAX_RESULT_CHARACTERS,
    resultSize,
    scratch,
    write,
    type Connection,
} from './testing.js';

const spec = openSpec(defaultSpecDir());

/**
 * The first `lookup` of each session of the expert requests' development run
 * (`records/scored/authoring-expert-run-1.json`): its trial, its names and its language.
 */
const FIRST_LOOKUPS: readonly (readonly [string, readonly string[], string | null])[] = [
    [
        'event-granary-inspection-1',
        ['every_vassal', 'is_adult', 'add_stress', 'trigger_event', 'granary.0002'],
        'l_english',
    ],
    [
        'event-granary-inspection-2',
        ['every_vassal', 'is_adult', 'add_stress', 'trigger_event', 'character_event', 'limit'],
        'l_english',
    ],
    [
        'event-granary-inspection-3',
        ['every_vassal', 'is_adult', 'add_stress', 'trigger_event', 'limit'],
        'l_english',
    ],
    [
        'event-granary-inspection-4',
        ['every_vassal', 'is_adult', 'add_stress', 'trigger_event', 'granary.0002'],
        'l_english',
    ],
    [
        'event-granary-inspection-5',
        [
            'every_vassal',
            'is_adult',
            'add_stress',
            'trigger_event',
            'type',
            'title',
            'desc',
            'option',
            'name',
            'namespace',
        ],
        'l_english',
    ],
    [
        'event-envoy-chain-1',
        [
            'is_ruler',
            'is_adult',
            'is_at_war',
            'add_gold',
            'add_prestige',
            'add_piety',
            'random_courtier',
            'save_scope_as',
            'trigger_event',
            'character_event',
            'authoring_envoy_host_trigger',
            'authoring_envoy_gift_effect',
        ],
        'l_english',
    ],
    [
        'event-envoy-chain-2',
        [
            'is_ruler',
            'is_adult',
            'is_at_war',
            'add_gold',
            'add_prestige',
            'add_piety',
            'random_courtier',
            'save_scope_as',
            'trigger_event',
            'character_event',
        ],
        'l_english',
    ],
    [
        'event-envoy-chain-3',
        [
            'is_ruler',
            'is_adult',
            'is_at_war',
            'add_gold',
            'add_prestige',
            'add_piety',
            'random_courtier',
            'save_scope_as',
            'trigger_event',
            'character_event',
            'scope:envoy',
        ],
        'l_english',
    ],
    [
        'event-envoy-chain-4',
        [
            'is_ruler',
            'is_adult',
            'is_at_war',
            'add_gold',
            'add_prestige',
            'add_piety',
            'random_courtier',
            'save_scope_as',
            'trigger_event',
            'character_event',
            'scope:envoy',
        ],
        'l_english',
    ],
    [
        'event-envoy-chain-5',
        [
            'is_ruler',
            'is_adult',
            'is_at_war',
            'add_gold',
            'add_prestige',
            'add_piety',
            'random_courtier',
            'save_scope_as',
            'trigger_event',
            'character_event',
            'scope:envoy',
        ],
        null,
    ],
    [
        'event-county-unrest-1',
        [
            'is_ruler',
            'any_sub_realm_county',
            'random_sub_realm_county',
            'save_scope_as',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'county_opinion',
            'add_county_modifier',
            'change_county_opinion',
            'county_opinion_target',
        ],
        'l_english',
    ],
    [
        'event-county-unrest-2',
        [
            'is_ruler',
            'any_sub_realm_county',
            'random_sub_realm_county',
            'save_scope_as',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'county_opinion',
            'change_county_opinion',
            'county_opinion_add',
            'holder',
        ],
        'l_english',
    ],
    [
        'event-county-unrest-3',
        [
            'is_ruler',
            'any_sub_realm_county',
            'random_sub_realm_county',
            'save_scope_as',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'county_opinion',
            'county_opinion_add',
            'change_county_opinion',
            'holder',
            'character_event',
        ],
        'l_english',
    ],
    [
        'event-county-unrest-4',
        [
            'is_ruler',
            'any_sub_realm_county',
            'random_sub_realm_county',
            'save_scope_as',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'county_opinion',
            'change_county_opinion',
            'add_county_modifier',
            'county_opinion_add_even_if_baron',
        ],
        'l_english',
    ],
    [
        'event-county-unrest-5',
        [
            'is_ruler',
            'any_sub_realm_county',
            'random_sub_realm_county',
            'save_scope_as',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'county_opinion',
            'change_county_opinion',
            'add_county_modifier',
            'county_opinion_add',
        ],
        'l_english',
    ],
    [
        'event-county-unrest-6',
        [
            'is_ruler',
            'any_sub_realm_county',
            'random_sub_realm_county',
            'save_scope_as',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'county_opinion',
            'county_opinion_add',
            'change_county_opinion',
        ],
        'l_english',
    ],
    [
        'decision-fund-granaries-1',
        [
            'is_shown',
            'is_valid',
            'effect',
            'cooldown',
            'desc',
            'title',
            'is_ruler',
            'ai_check_interval',
            'ai_will_do',
            'picture',
        ],
        'l_english',
    ],
    [
        'decision-fund-granaries-2',
        ['is_shown', 'is_valid', 'effect', 'cooldown', 'is_ruler', 'desc', 'title'],
        'l_english',
    ],
    [
        'decision-fund-granaries-3',
        [
            'is_shown',
            'is_valid',
            'effect',
            'cooldown',
            'is_ruler',
            'desc',
            'ai_check_interval',
            'ai_will_do',
        ],
        null,
    ],
    [
        'decision-fund-granaries-4',
        [
            'is_shown',
            'is_valid',
            'effect',
            'cooldown',
            'is_ruler',
            'picture',
            'ai_check_interval',
            'ai_will_do',
            'desc',
            'title',
            'selection_tooltip',
        ],
        null,
    ],
    [
        'decision-fund-granaries-5',
        [
            'is_shown',
            'is_valid',
            'effect',
            'cooldown',
            'is_ruler',
            'title',
            'desc',
            'selection_tooltip',
            'ai_check_interval',
            'ai_will_do',
        ],
        'l_english',
    ],
    [
        'decision-pardon-prisoners-1',
        [
            'is_ruler',
            'is_at_war',
            'any_prisoner',
            'add_gold',
            'every_prisoner',
            'is_adult',
            'add_stress',
            'release_from_prison',
            'cooldown',
            'ai_will_do',
            'is_shown',
            'is_valid',
            'effect',
            'title',
            'desc',
            'selection_tooltip',
            'picture',
            'authoring_pardon_decision',
        ],
        'l_english',
    ],
    [
        'decision-pardon-prisoners-2',
        [
            'is_ruler',
            'is_at_war',
            'any_prisoner',
            'add_gold',
            'every_prisoner',
            'is_adult',
            'add_stress',
            'cooldown',
            'ai_will_do',
            'is_shown',
            'is_valid',
            'effect',
            'release_from_prison',
            'is_valid_showing_failures_only',
            'desc',
            'title',
            'selection_tooltip',
        ],
        'l_english',
    ],
    [
        'decision-pardon-prisoners-3',
        [
            'is_ruler',
            'is_at_war',
            'any_prisoner',
            'add_gold',
            'every_prisoner',
            'is_adult',
            'add_stress',
            'release_from_prison',
            'cooldown',
            'ai_will_do',
            'is_shown',
            'is_valid',
            'effect',
            'authoring_pardon_decision',
            'picture',
            'title',
            'desc',
            'selection_tooltip',
            'is_valid_showing_failures_only',
            'ai_check_interval',
        ],
        'l_english',
    ],
    [
        'decision-pardon-prisoners-4',
        [
            'is_ruler',
            'is_at_war',
            'any_prisoner',
            'add_gold',
            'every_prisoner',
            'is_adult',
            'release_from_prison',
            'add_stress',
            'cooldown',
            'ai_will_do',
            'is_shown',
            'is_valid',
            'effect',
            'cost',
            'authoring_pardon_decision',
        ],
        'l_english',
    ],
    [
        'decision-pardon-prisoners-5',
        [
            'is_ruler',
            'is_at_war',
            'any_prisoner',
            'add_gold',
            'every_prisoner',
            'is_adult',
            'add_stress',
            'release_from_prison',
            'cooldown',
            'ai_will_do',
            'is_shown',
            'is_valid',
            'effect',
            'is_valid_showing_failures_only',
            'authoring_pardon_decision',
        ],
        'l_english',
    ],
    [
        'decision-house-feast-1',
        [
            'is_ruler',
            'house',
            'gold',
            'add_gold',
            'every_house_member',
            'is_adult',
            'add_prestige',
            'trigger_event',
            'add_piety',
            'is_shown',
            'is_valid',
            'effect',
            'ai_check_interval',
            'cost',
            'house_power_score',
        ],
        'l_english',
    ],
    [
        'decision-house-feast-2',
        [
            'is_ruler',
            'house',
            'power_score',
            'gold',
            'add_gold',
            'every_house_member',
            'is_adult',
            'add_prestige',
            'trigger_event',
            'character_event',
            'add_piety',
            'is_shown',
            'is_valid',
            'effect',
            'cost',
            'ai_will_do',
            'house_power_score',
        ],
        'l_english',
    ],
    [
        'decision-house-feast-3',
        [
            'is_ruler',
            'house',
            'gold',
            'add_gold',
            'every_house_member',
            'is_adult',
            'add_prestige',
            'trigger_event',
            'add_piety',
            'is_shown',
            'is_valid',
            'effect',
            'ai_check_interval',
            'house_power_score',
            'power_score',
        ],
        'l_english',
    ],
    [
        'decision-house-feast-4',
        [
            'is_ruler',
            'house',
            'power_score',
            'gold',
            'add_gold',
            'every_house_member',
            'is_adult',
            'add_prestige',
            'trigger_event',
            'add_piety',
            'is_shown',
            'is_valid',
            'effect',
            'ai_check_interval',
            'cost',
            'character_event',
        ],
        'l_english',
    ],
    [
        'decision-house-feast-5',
        [
            'is_ruler',
            'house',
            'gold',
            'add_gold',
            'every_house_member',
            'is_adult',
            'add_prestige',
            'trigger_event',
            'character_event',
            'add_piety',
            'is_shown',
            'is_valid',
            'effect',
            'cost',
            'house_power_score',
        ],
        'l_english',
    ],
    [
        'effect-realm-relief-1',
        [
            'every_sub_realm_county',
            'county_control',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'holder',
            'limit',
        ],
        'l_english',
    ],
    [
        'effect-realm-relief-2',
        [
            'every_sub_realm_county',
            'county_control',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'holder',
        ],
        'l_english',
    ],
    [
        'effect-realm-relief-3',
        [
            'every_sub_realm_county',
            'county_control',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'holder',
            'authoring_realm_relief_effect',
        ],
        'l_english',
    ],
    [
        'effect-realm-relief-4',
        [
            'every_sub_realm_county',
            'county_control',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'holder',
            'authoring_realm_relief_effect',
        ],
        null,
    ],
    [
        'effect-realm-relief-5',
        [
            'every_sub_realm_county',
            'county_control',
            'change_county_control',
            'add_gold',
            'add_prestige',
            'holder',
            'limit',
        ],
        'l_english',
    ],
    [
        'effect-granary-gift-edit-1',
        ['add_gold', 'add_prestige', 'opinion', 'liege', 'if', 'else'],
        'l_english',
    ],
    [
        'effect-granary-gift-edit-2',
        ['add_gold', 'add_prestige', 'opinion', 'liege', 'if', 'else'],
        'l_english',
    ],
    [
        'effect-granary-gift-edit-3',
        ['add_gold', 'add_prestige', 'opinion', 'liege', 'if', 'else'],
        'l_english',
    ],
    [
        'effect-granary-gift-edit-4',
        ['add_gold', 'add_prestige', 'opinion', 'liege', 'if', 'else'],
        'l_english',
    ],
    [
        'effect-granary-gift-edit-5',
        ['opinion', 'liege', 'add_gold', 'add_prestige', 'if', 'else'],
        'l_english',
    ],
    [
        'effect-heir-household-1',
        [
            'primary_heir',
            'add_gold',
            'every_sibling',
            'is_adult',
            'add_prestige',
            'add_stress',
            'authoring_heir_household_effect',
        ],
        'l_english',
    ],
    [
        'effect-heir-household-2',
        [
            'primary_heir',
            'add_gold',
            'every_sibling',
            'is_adult',
            'add_prestige',
            'add_stress',
            'authoring_heir_household_effect',
        ],
        null,
    ],
    [
        'effect-heir-household-3',
        [
            'primary_heir',
            'add_gold',
            'every_sibling',
            'is_adult',
            'add_prestige',
            'add_stress',
            'authoring_heir_household_effect',
        ],
        'l_english',
    ],
    [
        'effect-heir-household-4',
        [
            'primary_heir',
            'add_gold',
            'every_sibling',
            'is_adult',
            'add_prestige',
            'add_stress',
            'authoring_heir_household_effect',
            'exists',
        ],
        'l_english',
    ],
    [
        'effect-heir-household-5',
        [
            'primary_heir',
            'add_gold',
            'every_sibling',
            'is_adult',
            'add_prestige',
            'add_stress',
            'authoring_heir_household_effect',
        ],
        null,
    ],
    [
        'trigger-loyal-realm-1',
        [
            'any_sub_realm_county',
            'county_control',
            'county_opinion',
            'holder',
            'authoring_loyal_realm_trigger',
            'count',
            'opinion',
        ],
        'l_english',
    ],
    [
        'trigger-loyal-realm-2',
        [
            'any_sub_realm_county',
            'county_control',
            'county_opinion',
            'authoring_loyal_realm_trigger',
            'count',
        ],
        'l_english',
    ],
    [
        'trigger-loyal-realm-3',
        [
            'any_sub_realm_county',
            'county_control',
            'county_opinion',
            'count',
            'authoring_loyal_realm_trigger',
        ],
        null,
    ],
    [
        'trigger-loyal-realm-4',
        [
            'any_sub_realm_county',
            'county_control',
            'county_opinion',
            'holder',
            'count',
            'authoring_loyal_realm_trigger',
        ],
        'l_english',
    ],
    [
        'trigger-loyal-realm-5',
        [
            'any_sub_realm_county',
            'county_control',
            'county_opinion',
            'holder',
            'opinion',
            'count',
            'authoring_loyal_realm_trigger',
        ],
        'l_english',
    ],
    [
        'trigger-granary-patron-1',
        ['any_vassal', 'count', 'authoring_granary_patron_trigger'],
        'l_english',
    ],
    ['trigger-granary-patron-2', ['any_vassal', 'count'], 'l_english'],
    [
        'trigger-granary-patron-3',
        ['any_vassal', 'count', 'authoring_granary_patron_trigger'],
        'l_english',
    ],
    ['trigger-granary-patron-4', ['any_vassal', 'count'], 'l_english'],
    ['trigger-granary-patron-5', ['any_vassal', 'count'], 'l_english'],
    [
        'trigger-settled-ruler-1',
        [
            'is_at_war',
            'is_married',
            'any_child',
            'is_adult',
            'count',
            'primary_heir',
            'is_imprisoned',
            'exists',
        ],
        'l_english',
    ],
    [
        'trigger-settled-ruler-2',
        [
            'is_at_war',
            'is_married',
            'any_child',
            'is_adult',
            'primary_heir',
            'is_imprisoned',
            'count',
            'authoring_settled_ruler_trigger',
        ],
        'l_english',
    ],
    [
        'trigger-settled-ruler-3',
        [
            'is_at_war',
            'is_married',
            'any_child',
            'is_adult',
            'primary_heir',
            'is_imprisoned',
            'count',
        ],
        null,
    ],
    [
        'trigger-settled-ruler-4',
        [
            'is_at_war',
            'is_married',
            'any_child',
            'count',
            'is_adult',
            'primary_heir',
            'is_imprisoned',
            'exists',
        ],
        null,
    ],
    [
        'trigger-settled-ruler-5',
        [
            'is_at_war',
            'is_married',
            'any_child',
            'is_adult',
            'primary_heir',
            'is_imprisoned',
            'count',
        ],
        null,
    ],
];

/** Every name the first lookups asked about, each once. */
const ASKED = [...new Set(FIRST_LOOKUPS.flatMap(([, names]) => names))];

/**
 * A game stub in which every asked name is used in 20 files of long paths, and the base game's
 * languages are read, as in the installed game.
 */
function stubGame(dir: string): string {
    const files: Record<string, string> = {
        'localization/english/stub_l_english.yml': '\ufeffl_english:\n stub_key:0 "Stub"\n',
        'localization/french/stub_l_french.yml': '\ufeffl_french:\n stub_key:0 "Stub"\n',
    };
    for (let i = 0; i < 20; i++) {
        const n = String(i).padStart(2, '0');
        files[`common/scripted_effects/${'e'.repeat(100)}_${n}.txt`] =
            `stub_effect_${n} = {\n${ASKED.map((name) => `\t${name} = yes`).join('\n')}\n}\n`;
    }
    return gameStub(path.join(dir, 'install'), files);
}

interface Replay {
    /** The calls each first lookup took until every name was answered. */
    readonly calls: readonly number[];
}

/** Every key of every object in a value. */
function keysOf(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap(keysOf);
    }
    if (typeof value !== 'object' || value === null) {
        return [];
    }
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
}

/** Each first lookup made, then made again with its names not answered, to the end. */
async function replay(s: Connection): Promise<Replay> {
    const alone = new Map<string, unknown>();
    const calls: number[] = [];
    for (const [trial, names, language] of FIRST_LOOKUPS) {
        const asked = [...new Set(names)];
        const answered = new Map<string, unknown>();
        let ask = asked;
        let count = 0;
        while (ask.length > 0) {
            count++;
            assert.ok(count <= asked.length, `${trial}: each call answers at least one name`);
            const args = { names: ask, ...(language === null ? {} : { language }) };
            const result = await s.call('lookup', args);
            assert.notEqual(result.isError, true, trial);
            assert.ok(resultSize(result) <= MAX_RESULT_CHARACTERS, `${trial}: under the limit`);
            const out = result.structuredContent ?? {};
            assert.deepEqual(Object.keys(out), ['results', 'not_answered', 'notes'], trial);
            assert.ok(!keysOf(out).some((k) => /cursor/.test(k)), `${trial}: no cursor anywhere`);
            const results = out['results'] as Record<string, unknown>[];
            const left = out['not_answered'] as { names: string[]; ask: string } | null;
            const got = results.map((r) => r['name'] as string);
            // Every name asked is answered or named, never both, the answers in the order asked.
            assert.deepEqual(
                [...got, ...(left?.names ?? [])].sort(),
                [...ask].sort(),
                `${trial}: every name answered or named`,
            );
            assert.deepEqual(
                got,
                ask.filter((n) => got.includes(n)),
                `${trial}: in the order asked`,
            );
            assert.ok(got.length > 0, `${trial}: at least one name a call`);
            if (left !== null) {
                assert.equal(left.ask, ASK_AGAIN);
                assert.ok(left.names.length > 0);
            }
            for (const answer of results) {
                const name = answer['name'] as string;
                assert.ok(!answered.has(name), `${trial}: ${name} answered once`);
                answered.set(name, answer);
                // Whole: the same answer as the name asked alone, with the same language.
                const key = JSON.stringify([name, language]);
                if (!alone.has(key)) {
                    const one = await s.output('lookup', {
                        names: [name],
                        ...(language === null ? {} : { language }),
                    });
                    assert.equal(one['not_answered'], null, `${name} alone is answered`);
                    alone.set(key, (one['results'] as unknown[])[0]);
                }
                assert.deepEqual(answer, alone.get(key), `${trial}: ${name} whole`);
            }
            ask = left?.names ?? [];
        }
        assert.deepEqual([...answered.keys()].sort(), [...asked].sort(), trial);
        calls.push(count);
    }
    return { calls };
}

function summary(t: TestContext, where: string, { calls }: Replay): void {
    const one = calls.filter((c) => c === 1).length;
    t.diagnostic(
        `${where}: ${String(one)} of ${String(calls.length)} first lookups answered whole in one call; the others in ${String(Math.min(...calls.filter((c) => c > 1)))} to ${String(Math.max(...calls))} calls`,
    );
}

test("the expert run's 61 first lookups: every name answered whole or named, none cut, no cursor (over a game stub)", async (t) => {
    assert.equal(FIRST_LOOKUPS.length, 61);
    const dir = scratch(t);
    const game = stubGame(dir);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Empty"\n');
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    summary(t, 'game stub', await replay(s));
});

test("the expert run's 61 first lookups over the installed game (local: CK3_GAME_PATH)", async (t) => {
    const gameDir = process.env['CK3_GAME_PATH'];
    if (gameDir === undefined || gameDir === '') {
        t.skip('needs the installed game: CK3_GAME_PATH (a local game-file test)');
        return;
    }
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Empty"\n');
    const s = await connect(t, ['--mod', mod, '--vanilla', gameDir], null);
    summary(t, 'installed game', await replay(s));
});

/** Every name of the spec package's buckets, record schemas and scope types. */
function specNames(): string[] {
    const names = new Set<string>();
    for (const bucket of Object.values(spec.data.buckets)) {
        for (const name of Object.keys(bucket)) {
            names.add(name);
        }
    }
    const walk = (
        fields: Readonly<Record<string, { readonly fields?: unknown }>> | undefined,
    ): void => {
        for (const [name, field] of Object.entries(fields ?? {})) {
            names.add(name);
            walk(
                field.fields as Readonly<Record<string, { readonly fields?: unknown }>> | undefined,
            );
        }
    };
    for (const directory of Object.values(spec.data.schema)) {
        walk(directory.fields as Readonly<Record<string, { readonly fields?: unknown }>>);
    }
    for (const name of Object.keys(spec.data.scope_types)) {
        names.add(name);
    }
    return [...names];
}

test('every name of the spec package fits one result alone; the twenty largest are answered whole through the server', async (t) => {
    const sizes: [number, string][] = [];
    const levels: Record<string, number> = {};
    for (const name of specNames()) {
        const core = lookup(name, { spec, suggestions: false });
        const { answer, detail } = answerOf(core, null, null);
        assert.ok(JSON.stringify(answer).length <= NAME_ROOM, `${name} fits alone`);
        levels[detail] = (levels[detail] ?? 0) + 1;
        sizes.push([JSON.stringify(core.readings).length, name]);
    }
    sizes.sort((a, b) => b[0] - a[0]);
    t.diagnostic(
        `${String(sizes.length)} names: ${JSON.stringify(levels)}; the largest, ${sizes[0]?.[1] ?? ''}, is ${String(sizes[0]?.[0] ?? 0)} characters of readings in the core`,
    );
    assert.ok(sizes.length > 10_000, 'the whole spec package');
    const dir = scratch(t);
    const game = stubGame(dir);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Empty"\n');
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    for (const [, name] of sizes.slice(0, 20)) {
        const result = await s.call('lookup', { names: [name] });
        assert.notEqual(result.isError, true, name);
        assert.ok(resultSize(result) <= MAX_RESULT_CHARACTERS, `${name}: under the limit`);
        assert.equal(result.structuredContent?.['not_answered'], null, `${name} answered`);
    }
});
