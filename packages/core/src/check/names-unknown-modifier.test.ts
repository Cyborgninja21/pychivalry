import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './names-unknown-modifier.js';
import { checkFixture, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('names-unknown-modifier-bad');
    assert.deepEqual(found, expectedFindings('names-unknown-modifier-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Unknown modifier type')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('names-unknown-modifier-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.notEqual(CHECK_KINDS[CODE].catalogue, '');
});
