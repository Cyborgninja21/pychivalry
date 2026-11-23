import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CODE, infoFieldNames } from './fields-unknown-field.js';
import { CHECK_KINDS } from './finding.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

const codes = (
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
): string[] =>
    checkText(file, text, defined)
        .filter((f) => f.code === CODE)
        .map((f) => f.args[0] ?? '');

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('fields-unknown-field-bad');
    assert.deepEqual(found, expectedFindings('fields-unknown-field-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'warning'));
    assert.ok(found.every((f) => f.message.startsWith('Unknown ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('fields-unknown-field-good'), []);
});

test(`${CODE} rests on its catalogue message, a warning (docs/decisions.md, row 50)`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'unknown_X_in_X');
});

test(`${CODE}: a folder with no schema, and a scripted trigger's body, are not judged`, () => {
    assert.deepEqual(codes('common/fixture_no_such_folder/x.txt', 'a = { b = c }\n'), []);
    assert.deepEqual(
        codes('common/scripted_triggers/x.txt', 'fixture_trigger = { fixture_made_up = yes }\n'),
        [],
    );
});

test(`${CODE}: what is not a field is never reported`, () => {
    // A link and a scope chain written as keys, an iterator over a list, a constant and a
    // macro parameter: none is a field of the record.
    const text =
        'fixture_group = {\n\tsort_order = 1\n\troot = { }\n\tscope:fixture = { }\n\tevery_vassal = { }\n\t@fixture = 1\n\t$FIXTURE$ = 1\n}\n';
    assert.deepEqual(codes('common/decision_group_types/x.txt', text), []);
});

test(`${CODE}: a field Paradox's .info files document is a field, though the base game sets it nowhere`, () => {
    const spec = committedSpec();
    // `potential` of a trait: documented in common/traits/_traits.info.
    assert.ok(infoFieldNames(spec, 'common/traits').has('potential'));
    const field = spec.data.schema['common/casus_belli_types']?.fields['my_war_name_base'];
    assert.equal(field, undefined);
    assert.ok(infoFieldNames(spec, 'common/casus_belli_types').has('my_war_name_base'));
    const text =
        'fixture_cb = {\n\ton_invalidated_desc = fixture_desc\n\tmy_war_name_base = fixture_name\n}\n';
    assert.deepEqual(codes('common/casus_belli_types/x.txt', text), []);
});

test(`${CODE}: only a record's own body is judged, not a field's sub-fields`, () => {
    // `can_construct` of a domicile building is measured a plain block; it holds scripted
    // triggers the schema's sub-field list does not have.
    const text = 'fixture_building = {\n\tcan_construct = { fixture_scripted_trigger = yes }\n}\n';
    assert.deepEqual(codes('common/domiciles/buildings/x.txt', text), []);
});

test(`${CODE}: a colour value is not a call, and its tag is no field`, () => {
    const text =
        'fixture_category = {\n\tindex = 0\n\tcolor = rgb { 255 128 0 }\n\tfixture_made_up = hsv { 0.5 0.5 0.5 }\n}\n';
    assert.deepEqual(codes('common/character_interaction_categories/x.txt', text), [
        "'fixture_made_up'",
    ]);
});

test(`${CODE}: a modifier in a record whose body part D7 says holds modifiers is no field`, () => {
    // common/modifiers::(record) is a D7 row (status unknown): its keys are modifiers.
    const text = 'fixture_modifier = {\n\tmonthly_prestige = 1\n\tfixture_made_up = 1\n}\n';
    assert.deepEqual(codes('common/modifiers/x.txt', text), ["'fixture_made_up'"]);
});
