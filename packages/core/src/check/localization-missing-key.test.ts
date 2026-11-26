import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureIndex } from '../index/testing.js';
import type { SchemaField } from '../spec/package.js';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, implicitRowUse, judgedLocFields } from './localization-missing-key.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

const GAME = 'event-targets-and-localization';
const BAD = 'localization-missing-key-bad';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture(BAD, { game: GAME });
    assert.deepEqual(found, expectedFindings(BAD));
    assert.ok(found.every((f) => f.code === CODE));
    const warnings = found.filter((f) => f.severity === 'warning');
    assert.ok(warnings.every((f) => f.message.startsWith('Unknown loc key ')));
    // The keys every base-game decision group and game concept have are advice, not warnings.
    assert.deepEqual(
        found.filter((f) => f.severity === 'information').map((f) => f.data['key']),
        ['decision_group_type_fixture_decision_group', 'game_concept_fixture_concept'],
    );
    assert.ok(
        found.some(
            (f) =>
                f.severity === 'warning' && f.data['key'] === 'game_concept_fixture_concept_desc',
        ),
    );
});

test(`${CODE} takes the index's answer for a file without the byte-order mark`, () => {
    // On Linux the game reads no key from it (the package's rule `msg-localization-missing-bom`):
    // the index holds none of its keys, and the key it alone defines is missing.
    const index = fixtureIndex(GAME, BAD);
    assert.ok(!index.definitions('fixture_loc_no_bom').some((d) => d.read !== 'no'));
    assert.ok(
        expectedFindings(BAD).some((f) => f.data['key'] === 'fixture_loc_no_bom'),
        'the bad fixture expects the key missing',
    );
    // Defined in a file with the mark as well, it is not (the good fixture).
    const good = fixtureIndex(GAME, 'localization-missing-key-good');
    assert.ok(good.definitions('fixture_loc_no_bom').some((d) => d.read !== 'no'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('localization-missing-key-good', { game: GAME }), []);
});

test(`${CODE} is silent when no base game is read`, () => {
    assert.deepEqual(
        checkFixture(BAD).filter((f) => f.code === CODE),
        [],
    );
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'unknown_loc_key_X');
});

test(`${CODE} judges the fields the schema marks, but not those whose values need not be keys`, () => {
    const spec = committedSpec();
    let marked = 0;
    const walk = (fields: Readonly<Record<string, SchemaField>> | undefined): void => {
        for (const field of Object.values(fields ?? {})) {
            if (field.loc_key === true) {
                marked++;
            }
            walk(field.fields);
        }
    };
    for (const schema of Object.values(spec.data.schema)) {
        walk(schema.fields);
    }
    assert.equal(marked, 372);
    const judged = judgedLocFields(spec);
    const paths = (dir: string): string[] => (judged.get(dir) ?? []).map((f) => f.path.join('.'));
    assert.ok(paths('events').includes('option.name'));
    assert.ok(paths('events').includes('title'));
    // Free text: the game shows a history character's name as written when no key has it.
    assert.ok(!paths('history/characters').includes('name'));
    // Paradox's `.info` documents a flag, not a key.
    assert.ok(!paths('common/legitimacy').includes('level.flag'));
    // A trigger tests its value: no text of it is shown.
    assert.ok(!paths('common/scripted_modifiers').includes('modifier.government_has_flag'));
    assert.ok(paths('common/scripted_modifiers').includes('modifier.desc'));
    assert.ok(paths('events').includes('option.custom_tooltip'));
    const total = [...judged.values()].reduce((n, fields) => n + fields.length, 0);
    assert.ok(total > 300 && total < marked);
});

test(`${CODE}: a D5 row warns only when the package shows the game requires the key`, () => {
    const part = committedSpec().part('implicit_loc_keys');
    const rows = Object.values(part?.directories ?? {}).flat();
    const warning = rows.filter((r) => implicitRowUse(r) === 'warning');
    assert.ok(warning.length > 0);
    assert.ok(warning.every((r) => r.requirement === 'required' && r.status === 'confirmed'));
    const advice = rows.filter((r) => implicitRowUse(r) === 'advice');
    assert.ok(advice.every((r) => r.requirement === 'always-present-in-base-game'));
    assert.ok(
        rows
            .filter((r) => r.requirement === 'optional' || r.requirement === 'unknown')
            .every((r) => implicitRowUse(r) === null),
    );
    assert.ok(rows.filter((r) => r['condition'] != null).every((r) => implicitRowUse(r) === null));
});

test(`${CODE}: values that are no key are not judged`, () => {
    const text =
        'fixture.1 = {\n\ttype = character_event\n\ttitle = "[ROOT.Char.GetFirstName]"\n\tdesc = { desc = fixture_inner }\n\toption = { name = $NAME$ }\n\toption = { name = "" }\n\toption = { name = scope:fixture }\n\toption = { name = fixture.1.a }\n}\n';
    const found = checkText(
        'events/fixture.txt',
        text,
        {},
        {
            baseGame: true,
            isScopeSaved: () => true,
            isLocalizationKey: () => false,
            isBaseGameLocalizationKey: () => false,
            isUsed: () => true,
            hasDefinition: () => false,
            isRecordName: () => false,
            isVariableSet: () => true,
            textScopeReads: () => [],
        },
    ).filter((f) => f.code === CODE);
    assert.deepEqual(
        found.map((f) => f.args[0]),
        ['fixture.1.a'],
    );
});
