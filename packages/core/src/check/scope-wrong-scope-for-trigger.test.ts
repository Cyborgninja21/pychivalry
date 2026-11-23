import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './scope-wrong-scope-for-trigger.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('scope-wrong-scope-for-trigger-bad');
    assert.deepEqual(found, expectedFindings('scope-wrong-scope-for-trigger-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Wrong scope for trigger: ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('scope-wrong-scope-for-trigger-good'), []);
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'wrong_scope_for_trigger_X_expected_X');
});

test(`${CODE}: a trigger whose scope data declares no requirement, or a scope not known, is not judged`, () => {
    // `exists` declares `none`; a scripted trigger runs in whatever scope calls it.
    const decision =
        'fixture_decision = {\n\tis_shown = {\n\t\tprimary_title = {\n\t\t\texists = holder\n\t\t}\n\t}\n}\n';
    assert.deepEqual(checkText('common/decisions/fixture.txt', decision), []);
    const scripted = 'fixture_trigger = {\n\ttier >= 2\n\tis_adult = yes\n}\n';
    assert.deepEqual(checkText('common/scripted_triggers/fixture.txt', scripted), []);
});
