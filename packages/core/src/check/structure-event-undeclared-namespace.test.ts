import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, idPrefixOf, namespaceDeclarations } from './structure-event-undeclared-namespace.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('structure-event-undeclared-namespace-bad');
    assert.deepEqual(found, expectedFindings('structure-event-undeclared-namespace-bad'));
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'warning'));
    assert.ok(found.every((f) => f.message.startsWith('Namespace ')));
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('structure-event-undeclared-namespace-good'), []);
});

test(`${CODE} rests on its catalogue message, its keyword from parts D2 and D4`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    const spec = committedSpec();
    assert.deepEqual(
        namespaceDeclarations(spec, 'events').map((d) => d.key),
        ['namespace'],
    );
    assert.deepEqual(namespaceDeclarations(spec, 'common/decisions'), []);
});

test(`${CODE}: an id is the namespace, a dot and a number`, () => {
    assert.equal(idPrefixOf('fixture.0001'), 'fixture');
    assert.equal(idPrefixOf('fixture_events.12'), 'fixture_events');
    assert.equal(idPrefixOf('fixture'), null);
    assert.equal(idPrefixOf('fixture.first'), null);
});

test(`${CODE}: a namespace declared after its event still counts; other folders are not judged`, () => {
    const after = 'fixture.1 = { hidden = yes }\nnamespace = fixture\n';
    assert.deepEqual(
        checkText('events/x.txt', after).filter((f) => f.code === CODE),
        [],
    );
    const decisions = 'fixture.1 = { }\n';
    assert.deepEqual(
        checkText('common/decisions/x.txt', decisions).filter((f) => f.code === CODE),
        [],
    );
});
