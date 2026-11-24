import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocalization } from '../index/localization.js';
import { CHECK_KINDS } from './finding.js';
import { CODE, keyProblem, localizationKeyFindings } from './style-localization-key-characters.js';
import { expectedFindings, styleFixture } from './testing.js';

test(`${CODE} fires on its bad fixture, as expected.json lists`, () => {
    const found = styleFixture('style-localization-key-characters-bad');
    assert.deepEqual(found, expectedFindings('style-localization-key-characters-bad'));
    assert.deepEqual(
        found.map((f) => [f.code, f.severity, f.data['key']]),
        [
            [CODE, 'hint', 'fixture_key_with-dash'],
            [CODE, 'hint', '1fixture_leading_digit'],
        ],
    );
});

test(`${CODE} is silent on its good fixture`, () => {
    assert.deepEqual(styleFixture('style-localization-key-characters-good'), []);
});

test(`${CODE} is a best-practice rule, at hint, with no game evidence`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'hint');
    assert.equal(CHECK_KINDS[CODE].bestPractice, true);
    assert.equal(CHECK_KINDS[CODE].catalogue, null);
});

test("a key starts with a letter or '_' and holds only letters, digits, '_' and '.'", () => {
    for (const key of ['a', '_a', 'a.b_c9', 'Ab.0']) {
        assert.equal(keyProblem(key), null, key);
    }
    assert.deepEqual(keyProblem('9a'), { first: '9', characters: [] });
    assert.deepEqual(keyProblem('a-b-c/d'), { first: null, characters: ['-', '/'] });
    assert.deepEqual(keyProblem('.a'), { first: '.', characters: [] });
    assert.deepEqual(keyProblem('-a'), { first: null, characters: ['-'] });
    assert.deepEqual(keyProblem('café'), { first: null, characters: ['é'] });
});

test(`${CODE} judges every entry of a file, one finding a key, at the key`, () => {
    const parsed = parseLocalization('l_english:\n a-b:0 "x"\n ok:0 "y"\n 2c-d:0 "z"\n .e:0 "w"\n');
    const result = localizationKeyFindings(parsed, { lines: parsed.lines });
    assert.equal(result.judged, 4);
    assert.deepEqual(
        result.findings.map((f) => [f.range.start.line, f.range.start.character, f.args[1]]),
        [
            [1, 1, "holds '-'"],
            [3, 1, "starts with a digit and holds '-'"],
            [4, 1, "starts with '.'"],
        ],
    );
});
