import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CODE, VALUE_TYPE_RULES } from './fields-wrong-kind-of-value.js';
import { CHECK_KINDS } from './finding.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

const values = (
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
): string[] =>
    checkText(file, text, defined)
        .filter((f) => f.code === CODE)
        .map((f) => f.args[0] ?? '');

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('fields-wrong-kind-of-value-bad');
    assert.deepEqual(found, expectedFindings('fields-wrong-kind-of-value-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'information'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('fields-wrong-kind-of-value-good'), []);
});

test(`${CODE} is advice: information, with no catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'information');
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
    const [found] = checkText(
        'common/decision_group_types/x.txt',
        'fixture_group = { sort_order = ten }\n',
    );
    assert.deepEqual(found?.evidence, { kind: 'advice' });
});

test(`${CODE} judges only the value types measured clean on the base game`, () => {
    assert.deepEqual(Object.keys(VALUE_TYPE_RULES).sort(), [
        'boolean',
        'date',
        'decimal',
        'integer',
        'list',
        'number',
        'path',
    ]);
});

test(`${CODE}: a script value goes where a number goes`, () => {
    const file = 'common/decision_group_types/x.txt';
    const text = (v: string): string => `fixture_group = { sort_order = ${v} }\n`;
    assert.deepEqual(
        values(file, text('fixture_value'), { 'common/script_values': ['fixture_value'] }),
        [],
    );
    assert.deepEqual(values(file, text('scope:fixture_saved')), []);
    assert.deepEqual(values(file, text('{ value = 5 add = 1 }')), []);
    assert.deepEqual(values(file, text('@fixture_constant')), []);
    assert.deepEqual(values(file, text('"7"')), []);
    assert.deepEqual(values(file, text('fixture_value')), ['fixture_value']);
    assert.deepEqual(values(file, text('yes')), ['yes']);
});

test(`${CODE}: a colour value is not a call`, () => {
    // `color` of an interaction category is a list the base game writes `{ r g b }`; a tagged
    // colour `rgb { ... }` is a value, not a key `rgb` holding a block.
    const file = 'common/character_interaction_categories/x.txt';
    const found = checkText(
        file,
        'fixture_category = {\n\tindex = 0\n\tcolor = rgb { 255 128 0 }\n}\n',
    );
    assert.deepEqual(found, []);
});

test(`${CODE}: \`always = no\` is deliberate`, () => {
    // A trigger that never passes is written on purpose (the base game writes 222), and a
    // yes-or-no field set to `no` is of the kind the field takes: neither is reported.
    const group = 'fixture_group = {\n\tsort_order = 1\n\timportant_decision_group = no\n}\n';
    assert.deepEqual(checkText('common/decision_group_types/x.txt', group), []);
    const decision = 'fixture_decision = {\n\tis_shown = { always = no }\n}\n';
    assert.deepEqual(
        checkText('common/decisions/x.txt', decision).filter((f) => f.code === CODE),
        [],
    );
});
