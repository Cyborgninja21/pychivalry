import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './structure-casus-belli-without-outcome.js';
import { checkFixture, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = checkFixture('structure-casus-belli-without-outcome-bad');
    assert.deepEqual(found, expectedFindings('structure-casus-belli-without-outcome-bad'));
    assert.ok(found.some((f) => f.code === CODE && f.severity === 'information'));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('structure-casus-belli-without-outcome-good'), []);
});

test(`${CODE} is advice: information, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'information');
    assert.equal(CHECK_KINDS[CODE].advice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});
