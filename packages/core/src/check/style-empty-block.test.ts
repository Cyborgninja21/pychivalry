import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE } from './style-empty-block.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-empty-block-bad');
    assert.deepEqual(found, expectedFindings('style-empty-block-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['block'], f.data['comments']]),
        [
            [CODE, 'hint', 'limit', 'no'],
            [CODE, 'hint', 'else', 'yes'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-empty-block-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test(`${CODE} judges the blocks inside records, never a record itself`, () => {
    const found = (text: string): string[] =>
        checkText('common/scripted_effects/x.txt', text, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => f.args[0] ?? '');
    // An empty definition is how a mod blanks one of the base game's out: not judged.
    assert.deepEqual(found('my_effect = { }\n'), []);
    assert.deepEqual(found('my_effect = { add_gold = 1 list = { } { } }\n'), ['list', '{ }']);
    assert.deepEqual(found('my_effect = { color = rgb { } }\n'), ['color']);
});
