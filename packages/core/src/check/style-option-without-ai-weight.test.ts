import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { aiWeightsOf, CODE } from './style-option-without-ai-weight.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-option-without-ai-weight-bad');
    assert.deepEqual(found, expectedFindings('style-option-without-ai-weight-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['event'], f.data['option']]),
        [[CODE, 'hint', 'fixture.0001', '2']],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-option-without-ai-weight-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE} reads the option and its weights from part D4`, () => {
    assert.deepEqual(aiWeightsOf({ spec: committedSpec() }), {
        option: 'option',
        weights: ['ai_chance', 'ai_will_select'],
    });
});

test(`${CODE} judges shown events with several options only`, () => {
    const found = (event: string): string[] =>
        checkText('events/x.txt', `namespace = x\nx.1 = {\n${event}\n}\n`, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => String(f.data['option']));
    assert.deepEqual(found('\toption = { name = a }\n\toption = { name = b }'), ['1', '2']);
    assert.deepEqual(
        found('\toption = { name = a ai_will_select = { always = yes } }\n\toption = { name = b }'),
        ['2'],
    );
    assert.deepEqual(found('\thidden = yes\n\toption = { name = a }\n\toption = { name = b }'), []);
    assert.deepEqual(found('\toption = { name = a }'), []);
});
