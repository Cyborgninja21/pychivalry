import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { clashMessageOf, CLASH, NOT_READ } from './definitions.js';
import { CHECK_KINDS } from './finding.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CLASH} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('definitions-clash-bad');
    assert.deepEqual(found, expectedFindings('definitions-clash-bad'));
    assert.equal(found.length, 2);
    assert.ok(found.every((f) => f.code === CLASH && f.severity === 'error'));
    assert.ok(found.every((f) => f.message.startsWith('Duplicated event ID ')));
});

test(`${CLASH} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('definitions-clash-good'), []);
});

test(`${CLASH} takes its message from the rules row, and a partial row decides nothing`, () => {
    assert.equal(CHECK_KINDS[CLASH].evidenceFrom, 'rules-row');
    const spec = committedSpec();
    assert.equal(
        clashMessageOf(spec, 'events-by-override-priority'),
        'duplicated_event_id_X_with_the_same_override_priority_X_foun',
    );
    // The characters row names its message, but is partial: the index names no clash for it.
    const row = spec
        .part('override_rules')
        ?.rules.find((r) => r['id'] === 'characters-by-override-priority');
    assert.equal(row?.status, 'partial');
    assert.equal(
        clashMessageOf(spec, 'characters-by-override-priority'),
        'duplicate_character_id_X_found_in_history',
    );
});

test(`${NOT_READ} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('definitions-not-read-bad');
    assert.deepEqual(found, expectedFindings('definitions-not-read-bad'));
    assert.equal(found.length, 1);
    assert.ok(found.every((f) => f.code === NOT_READ && f.severity === 'information'));
});

test(`${NOT_READ} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('definitions-not-read-good'), []);
});

test(`${NOT_READ} is advice`, () => {
    assert.equal(CHECK_KINDS[NOT_READ].severity, 'information');
    assert.equal(CHECK_KINDS[NOT_READ].catalogue, null);
});

test('the checks of definitions are silent without the index', () => {
    const text =
        'namespace = fixture\nfixture.1 = { hidden = yes }\nfixture.1 = { hidden = yes }\n';
    assert.deepEqual(
        checkText('events/x.txt', text).filter((f) => f.code.startsWith('definitions/')),
        [],
    );
});
