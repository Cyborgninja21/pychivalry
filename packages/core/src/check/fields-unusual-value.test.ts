import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './fields-unusual-value.js';
import { checkFixture, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = checkFixture('fields-unusual-value-bad');
    assert.deepEqual(found, expectedFindings('fields-unusual-value-bad'));
    assert.ok(found.some((f) => f.code === CODE && f.severity === 'hint'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('fields-unusual-value-good'), []);
});

test(`${CODE} is advice: hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].advice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});
