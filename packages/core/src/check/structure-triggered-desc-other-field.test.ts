import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { catalogueFromSpec, placeholderCount } from '../syntax/findings.js';
import { CHECK_KINDS } from './finding.js';
import { closedBodiesOf, CODE } from './structure-triggered-desc-other-field.js';
import { checkFixture, checkText, expectedFindings } from './testing.js';

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = checkFixture('structure-triggered-desc-other-field-bad');
    assert.deepEqual(found, expectedFindings('structure-triggered-desc-other-field-bad'));
    assert.equal(found.length, 1);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'warning'));
    assert.ok(
        found.every((f) =>
            f.message.startsWith('The body of triggered_desc can only take desc and/or trigger. '),
        ),
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(checkFixture('structure-triggered-desc-other-field-good'), []);
});

test(`${CODE} rests on its catalogue message, its block and keys from part D4`, () => {
    const kind = CHECK_KINDS[CODE];
    assert.equal(kind.severity, 'warning');
    const text = catalogueFromSpec(committedSpec().data).get(kind.catalogue ?? '');
    assert.equal(text, 'The body of triggered_desc can only take desc and/or trigger. %s');
    assert.equal(placeholderCount(text), kind.slots.length);
    assert.deepEqual(
        closedBodiesOf(committedSpec()).map((b) => [b.keyword, b.parents, b.allows]),
        [['triggered_desc', [], ['desc', 'trigger']]],
    );
});

test(`${CODE}: a key in another letter case, and a bare value, are not judged`, () => {
    const text = [
        'namespace = fixture',
        'fixture.1 = {',
        '\tdesc = { triggered_desc = { Desc = x } }',
        '\ttitle = { triggered_desc = { trigger = { always = yes } desc = y loose } }',
        '}',
        '',
    ].join('\n');
    assert.deepEqual(
        checkText('events/x.txt', text).filter((f) => f.code === CODE),
        [],
    );
});

test(`${CODE}: every other key of the block is reported, at its key`, () => {
    const text = 'x = { desc = { triggered_desc = { desc = a tooltip = b effect = { } } } }\n';
    const found = checkText('common/decisions/x.txt', text).filter((f) => f.code === CODE);
    assert.deepEqual(
        found.map((f) => [f.data['key'], text.slice(f.start, f.end)]),
        [
            ['tooltip', 'tooltip'],
            ['effect', 'effect'],
        ],
    );
});
