import assert from 'node:assert/strict';
import { test } from 'node:test';
import { folderTableFromSpec } from '../index/folders.js';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './variables-read-without-set.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

const GAME = 'event-targets-and-localization';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = checkFixture('variables-read-without-set-bad', { game: GAME });
    assert.deepEqual(found, expectedFindings('variables-read-without-set-bad'));
    assert.deepEqual(
        found.map((f) => [
            f.code,
            f.severity,
            f.data['variable'],
            f.data['namespace'],
            f.data['holds'],
        ]),
        [
            [CODE, 'information', 'fixture_guests', 'scope', 'value'],
            [CODE, 'information', 'fixture_missing', 'scope', 'value'],
            [CODE, 'information', 'fixture_count', 'global', 'value'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('variables-read-without-set-good', { game: GAME }), []);
});

test(`${CODE} is advice: information, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'information');
    assert.equal(CHECK_KINDS[CODE].advice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE} reads the keywords of the table variables: which set, which read`, () => {
    const variables = folderTableFromSpec(committedSpec().data).variables;
    assert.equal(variables.size, 75);
    const setting = [...variables]
        .filter(([, r]) => r.defines)
        .map(([k]) => k)
        .sort();
    assert.deepEqual(setting, [
        'add_to_global_variable_list',
        'add_to_global_variable_map',
        'add_to_local_variable_list',
        'add_to_local_variable_map',
        'add_to_variable_list',
        'add_to_variable_map',
        'set_dead_character_variable',
        'set_global_variable',
        'set_local_variable',
        'set_variable',
    ]);
});

test(`${CODE} judges nothing without the base game, nor a name built with a parameter`, () => {
    const text =
        'x = {\n\tif = { limit = { has_variable = fixture_none has_variable = a_$P$ } }\n}\n';
    const file = 'common/scripted_effects/x.txt';
    assert.deepEqual(
        checkText(file, text).filter((f) => f.code === CODE),
        [],
    );
    const over = checkText(
        file,
        text,
        {},
        {
            baseGame: true,
            isScopeSaved: () => true,
            isLocalizationKey: () => true,
            isBaseGameLocalizationKey: () => true,
            isUsed: () => true,
            hasDefinition: () => true,
            isRecordName: () => false,
            isVariableSet: () => false,
            textScopeReads: () => [],
        },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        over.map((f) => f.data['variable']),
        ['fixture_none'],
    );
});
