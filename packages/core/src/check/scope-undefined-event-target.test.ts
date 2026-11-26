import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureIndex, specFolders } from '../index/testing.js';
import { CHECK_KINDS } from './finding.js';
import { definedNamesOf } from './names.js';
import { CODE } from './scope-undefined-event-target.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

const GAME = 'event-targets-and-localization';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('scope-undefined-event-target-bad', { game: GAME });
    assert.deepEqual(found, expectedFindings('scope-undefined-event-target-bad'));
    assert.equal(found.length, 2);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'information'));
    assert.ok(found.every((f) => f.message.startsWith("Undefined event target 'scope:")));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('scope-undefined-event-target-good', { game: GAME }), []);
});

test(`${CODE} is silent when no base game is read`, () => {
    assert.deepEqual(
        checkFixture('scope-undefined-event-target-bad').filter((f) => f.code === CODE),
        [],
    );
});

test(`${CODE} rests on its catalogue message, at information`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'information');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'undefined_event_target_X');
});

test(`${CODE}: the link that reads a saved scope and the keys that save one come from the package`, () => {
    const folders = specFolders();
    assert.deepEqual([...folders.scopeLinks], ['scope']);
    // Format 9: the keys that save a value under a name are entries too, each with its rule.
    assert.deepEqual([...folders.saveKeys].sort(), [
        'save_opinion_value_as',
        'save_scope_as',
        'save_scope_value_as',
        'save_temporary_opinion_value_as',
        'save_temporary_scope_as',
        'save_temporary_scope_value_as',
    ]);
    assert.deepEqual(folders.saveRules.get('save_scope_value_as')?.nameIn, ['name']);
    // Part O1: the names the game saves from its own code.
    assert.equal(folders.savedFromCode.size, 409);
    assert.ok(folders.savedFromCode.has('actor'));
});

test(`${CODE}: the index records where a scope is saved and read, and the templates`, () => {
    const index = fixtureIndex(GAME, 'scope-undefined-event-target-bad');
    const saves = index.savedScopes('fixture_target_saved_here');
    assert.deepEqual(
        saves.map((s) => [s.layer, s.file, s.range.start.line + 1]),
        [['mod', 'events/fixture_target_events.txt', 8]],
    );
    assert.deepEqual(
        index.savedScopes('fixture_base_saved').map((s) => [s.layer, s.file]),
        [['game', 'common/scripted_effects/fixture_base_effects.txt']],
    );
    // Format 9: a value saved under a name (`save_scope_value_as = { name = x }`) is a save,
    // its name where the entry's `name_in` says.
    assert.deepEqual(
        index
            .savedScopes('fixture_target_saved_value')
            .map((s) => [s.file, s.range.start.line + 1]),
        [['common/scripted_effects/fixture_target_effects.txt', 5]],
    );
    // A name the game saves from its own code is saved by no script, and is read all the same.
    assert.deepEqual(index.savedScopes('actor'), []);
    assert.equal(index.scopeReads('fixture_target_never_saved').length, 1);
    assert.equal(index.isUsedBesideScopeReads('fixture_target_never_saved'), false);
    assert.ok(index.nameTemplates().includes('fixture_target_built_$WHAT$'));
    const names = definedNamesOf(index);
    assert.equal(names.isScopeSaved('fixture_target_built_one'), true);
    assert.equal(names.isScopeSaved('fixture_target_never_saved'), false);
});

test(`${CODE}: a chain's head, as a key or a value, in any case of the link; never a parameter`, () => {
    const text =
        'fixture.1 = {\n\ttype = character_event\n\thidden = yes\n\timmediate = {\n\t\tSCOPE:fixture_a = { add_gold = 1 }\n\t\tadd_gold = scope:fixture_b.gold\n\t\tscope:$X$ = { add_gold = 1 }\n\t\tscope:fixture_c = { add_gold = 1 }\n\t}\n}\n';
    const names = {
        isDefined: (): boolean => false,
        baseGame: true,
        isScopeSaved: (name: string): boolean => name === 'fixture_c',
        isLocalizationKey: (): boolean => true,
        isBaseGameLocalizationKey: (): boolean => false,
        isUsed: (): boolean => true,
        hasDefinition: (): boolean => false,
        isRecordName: (): boolean => false,
    };
    const found = checkText('events/fixture.txt', text, {}, names).filter((f) => f.code === CODE);
    assert.deepEqual(
        found.map((f) => [f.args[0], f.data['name']]),
        [
            ['SCOPE:fixture_a', 'fixture_a'],
            ['scope:fixture_b', 'fixture_b'],
        ],
    );
});
