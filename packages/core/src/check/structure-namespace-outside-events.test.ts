import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './structure-namespace-outside-events.js';
import { checkFixture, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = checkFixture('structure-namespace-outside-events-bad');
    assert.deepEqual(found, expectedFindings('structure-namespace-outside-events-bad'));
    assert.ok(found.some((f) => f.code === CODE && f.severity === 'information'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('structure-namespace-outside-events-good'), []);
});

test(`${CODE} is advice: information, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'information');
    assert.equal(CHECK_KINDS[CODE].advice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});
