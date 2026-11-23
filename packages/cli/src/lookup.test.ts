/**
 * `lookup` (lookup.ts): the core's lookup answer, as text and as JSON, over the stub game
 * `fixtures/game/lookup` and the mod `fixtures/mods/lookup-definitions-and-uses` (their
 * READMEs say what a correct lookup answers), and over the spec package alone; exit codes.
 */

import assert from 'node:assert/strict';
import { diskFileSource, lookup, openSpec, openWorkspace } from '@pychivalry/core';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir } from './io.js';
import { REPO_ROOT, runCli, scratch } from './testing.js';

const GAME = path.join(REPO_ROOT, 'fixtures', 'game', 'lookup', 'game');
const MOD = path.join(REPO_ROOT, 'fixtures', 'mods', 'lookup-definitions-and-uses');
const OVER = ['--vanilla', GAME, '--mod', MOD];

test('lookup as text: readings, definitions with the one in force, uses', (t) => {
    const cache = scratch(t);
    const r = runCli(['lookup', 'fixture_scripted_trigger', 'add_gold', ...OVER], { cache });
    assert.equal(r.code, 0, r.stderr);
    const [trigger, gold] = r.stdout.trimEnd().split('\n\n');
    assert.equal(
        trigger,
        [
            'fixture_scripted_trigger',
            '  defined in common/scripted_triggers, called as one of the triggers',
            '  unknown: the spec package has no reading of this name',
            '  defined in common/scripted_triggers: winner (scripted-triggers-and-effects-later-wins-whole)',
            '    game common/scripted_triggers/00_fixture_triggers.txt:1:1, not in force',
            '    mod common/scripted_triggers/zz_fixture_triggers.txt:1:1, in force',
            '  uses: 5 (game 3, mod 2)',
            '    game events/fixture_lookup_events.txt:6:3',
            '    game events/fixture_lookup_events.txt:7:11',
            '    game events/fixture_lookup_events.txt:11:14',
            '    mod events/fixture_lookup_mod_events.txt:6:3',
            '    mod events/fixture_lookup_mod_events.txt:14:15',
        ].join('\n'),
    );
    assert.match(
        gold ?? '',
        /^add_gold\n {2}effects\n {4}"adds gold to a character" \(doc, script_docs\)\n {4}scopes: character\n/,
    );
});

test("lookup --json: one object per name, the core's answer as it is", (t) => {
    const cache = scratch(t);
    const names = [
        'fixture_character',
        'monthly_prestige',
        'every_fixture_list',
        'add_fixture_lifestyle_xp',
    ];
    const r = runCli(['lookup', ...names, ...OVER, '--json'], { cache });
    assert.equal(r.code, 0, r.stderr);
    const lines = r.stdout
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l) as unknown);
    const spec = openSpec(defaultSpecDir());
    const workspace = openWorkspace({ spec, modDir: MOD, gameDir: GAME, cacheDir: null });
    const files = diskFileSource(
        workspace.game === null || workspace.mod === null
            ? []
            : [workspace.game.listing, workspace.mod],
    );
    assert.deepEqual(
        lines,
        names.map(
            (name) =>
                JSON.parse(
                    JSON.stringify(lookup(name, { spec, index: workspace.index, files })),
                ) as unknown,
        ),
    );
});

test('lookup --language keeps one language of a modifier localization', (t) => {
    const cache = scratch(t);
    const r = runCli(['lookup', 'monthly_prestige', ...OVER, '--language', 'l_french'], { cache });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^ +l_french: "Prestige de la fixture"/m);
    assert.doesNotMatch(r.stdout, /^ +l_english: "/m);
});

test('a name nothing knows: exit 1, with the names close to it', (t) => {
    const cache = scratch(t);
    const over = runCli(['lookup', 'fixture_scripted_trigge', ...OVER], { cache });
    assert.equal(over.code, 1);
    assert.match(over.stdout, /\n {2}did you mean: fixture_scripted_trigger \(workspace\)\n$/);
    const alone = runCli(['lookup', 'add_prestge', '--no-vanilla'], { cache });
    assert.equal(alone.code, 1);
    assert.equal(
        alone.stdout,
        [
            'add_prestge',
            '  unknown: the spec package has no reading of this name',
            '  definitions and uses: no game folder and no mod were given',
            '  did you mean: add_prestige (package)',
            '',
        ].join('\n'),
    );
    const notFound = runCli(['lookup', 'add_gold'], { cache });
    assert.equal(notFound.code, 0);
    assert.match(notFound.stderr, /the game was not found in any Steam library/);
});

test('lookup: bad usage and a mod that is not a folder exit 2', (t) => {
    const cache = scratch(t);
    assert.equal(runCli(['lookup', '--no-vanilla'], { cache }).code, 2);
    const mod = runCli(['lookup', 'add_gold', '--no-vanilla', '--mod', path.join(cache, 'none')], {
        cache,
    });
    assert.equal(mod.code, 2);
    assert.match(mod.stderr, /--mod: not a folder/);
    assert.equal(runCli(['lookup', 'add_gold', '--no-vanilla', '--limit', '3'], { cache }).code, 2);
});
