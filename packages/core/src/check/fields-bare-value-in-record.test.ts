import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CODE } from './fields-bare-value-in-record.js';
import { CHECK_KINDS } from './finding.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('fields-bare-value-in-record-bad');
    assert.deepEqual(found, expectedFindings('fields-bare-value-in-record-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Unexpected token ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('fields-bare-value-in-record-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'unexpected_token_X_found_at_X_expected');
});

test(`${CODE}: a record that is a list of values, and a script value, are not judged`, () => {
    const list = checkText('common/decision_group_types/x.txt', 'fixture_group = { a b c }\n');
    assert.deepEqual(
        list.filter((f) => f.code === CODE),
        [],
    );
    const range = checkText('common/script_values/x.txt', 'fixture_value = { 1 5 }\n');
    assert.deepEqual(
        range.filter((f) => f.code === CODE),
        [],
    );
});
