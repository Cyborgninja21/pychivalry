/**
 * When a scored authoring run stops (`stop-rule.ts`): only when the trials after the last would
 * say as little. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOT_HELD_IN_A_ROW, stopReason, type TrialOutcome } from './stop-rule.js';

const held: TrialOutcome = { held: true, setUp: [], broke: false };
/** A session that ran to its end and named a file outside its mod, as the third run's did. */
const strayed: TrialOutcome = { held: false, setUp: [], broke: false };
const broke: TrialOutcome = { held: false, setUp: [], broke: true };
const notSetUp: TrialOutcome = {
    held: false,
    setUp: ['the pychivalry skills were not offered: pychivalry-write-content'],
    broke: false,
};

test('a trial that held never stops the run', () => {
    assert.equal(stopReason([]), null);
    assert.equal(stopReason([held]), null);
    assert.equal(stopReason([strayed, strayed, held]), null);
});

test('one trial that did not hold for what its session did does not stop the run, its first trial either', () => {
    // The third run's 14th trial: a Read of a game file the tool results had named.
    assert.equal(stopReason([held, held, held, strayed]), null);
    assert.equal(stopReason([strayed]), null);
    assert.equal(stopReason([held, strayed, held, strayed]), null);
});

test('a session not set up as the run asks stops it at once, whichever trial it is', () => {
    assert.match(
        stopReason([notSetUp]) ?? '',
        /^its session was not set up as the run asks \(the pychivalry skills were not offered: pychivalry-write-content\), and every trial after it would be set up the same way$/,
    );
    assert.notEqual(stopReason([held, held, notSetUp]), null);
});

test("the run's first trial broken stops it; a later one alone does not", () => {
    assert.match(
        stopReason([broke]) ?? '',
        /^it was the run's first trial and a session of it broke/,
    );
    assert.equal(stopReason([held, broke]), null);
    assert.equal(stopReason([held, held, broke]), null);
});

test(`${String(NOT_HELD_IN_A_ROW)} trials in a row that did not hold stop the run, whatever the reasons`, () => {
    assert.equal(NOT_HELD_IN_A_ROW, 3);
    assert.equal(stopReason([held, strayed, strayed]), null);
    assert.match(
        stopReason([held, strayed, broke, strayed]) ?? '',
        /^it ended 3 trials in a row whose harness did not hold/,
    );
    assert.equal(stopReason([strayed, strayed, held, strayed, strayed]), null);
});
