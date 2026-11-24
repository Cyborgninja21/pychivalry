import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECK_KINDS } from './finding.js';
import { CODE, MAX_DEPTH } from './style-deep-nesting.js';
import { checkText, expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-deep-nesting-bad');
    assert.deepEqual(found, expectedFindings('style-deep-nesting-bad'));
    assert.deepEqual(
        found.map((f) => [
            f.code,
            f.severity,
            f.data['depth'],
            f.data['max_depth'],
            f.data['places'],
        ]),
        [[CODE, 'hint', '7', '6', '1']],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-deep-nesting-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(MAX_DEPTH, 6);
});

test(`${CODE}: one finding a record, at the first block past the limit, counting the places`, () => {
    const nest = (depth: number, inner: string): string =>
        depth === 0 ? inner : `a = { ${nest(depth - 1, inner)} }`;
    const found = (text: string): string[][] =>
        checkText('common/scripted_effects/x.txt', text, {}, {}, { style: true })
            .filter((f) => f.code === CODE)
            .map((f) => [f.args[1] ?? '', f.args[3] ?? '']);
    // The record's body is depth 1: five more blocks reach 6, six more reach 7.
    assert.deepEqual(found(`r = { ${nest(5, 'x = 1')} }\n`), []);
    assert.deepEqual(found(`r = { ${nest(6, 'x = 1')} }\n`), [['7', '1']]);
    // Nothing inside the block that crosses counts again.
    assert.deepEqual(found(`r = { ${nest(9, 'x = 1')} }\n`), [['7', '1']]);
    assert.deepEqual(found(`r = { ${nest(6, 'x = 1')} ${nest(7, 'y = 2')} }\n`), [['7', '2']]);
    assert.deepEqual(found(`r = { ${nest(6, 'x = 1')} }\ns = { ${nest(6, 'x = 1')} }\n`), [
        ['7', '1'],
        ['7', '1'],
    ]);
});
