import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, shownRuleOf } from './structure-event-non-character-shown.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('structure-event-non-character-shown-bad');
    assert.deepEqual(found, expectedFindings('structure-event-non-character-shown-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Error in event ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('structure-event-non-character-shown-good'), []);
});

test(`${CODE} rests on its catalogue message, its keywords from part D4`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'error');
    assert.deepEqual(shownRuleOf(committedSpec(), 'events'), {
        scopeKey: 'scope',
        needs: ['hidden', 'major'],
    });
    assert.equal(shownRuleOf(committedSpec(), 'common/decisions'), null);
});

test(`${CODE}: a major event, and a scope written as a parameter, are not reported`, () => {
    const text =
        'namespace = fixture\nfixture.1 = { scope = faith major = yes }\nfixture.2 = { scope = $SCOPE$ }\n';
    assert.deepEqual(
        checkText('events/x.txt', text).filter((f) => f.code === CODE),
        [],
    );
});
