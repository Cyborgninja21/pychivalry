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
    assert.deepEqual([...folders.saveKeys].sort(), ['save_scope_as', 'save_temporary_scope_as']);
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
    // A value save is no save key of the package, but writes the name: it may be saved there.
    assert.deepEqual(index.savedScopes('fixture_target_saved_value'), []);
    assert.equal(index.isUsedBesideScopeReads('fixture_target_saved_value'), true);
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
