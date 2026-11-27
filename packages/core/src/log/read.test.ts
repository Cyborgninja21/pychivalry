/** A log read into lines: Windows and Unix line breaks, the byte-order mark, a line not UTF-8. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { logLines } from './read.js';

test('lines end at \\n, a \\r before it is part of the line break, the last line counts without one', () => {
    const lines = logLines(new TextEncoder().encode('one\r\ntwo\nthree'));
    assert.deepEqual(
        lines.map((l) => [l.number, l.text, l.notUtf8]),
        [
            [1, 'one', false],
            [2, 'two', false],
            [3, 'three', false],
        ],
    );
    assert.equal(logLines('a\n').length, 1);
    assert.equal(logLines('').length, 0);
    assert.deepEqual(
        logLines('a\n\nb').map((l) => l.text),
        ['a', '', 'b'],
    );
});

test('the byte-order mark is no text; a line not valid UTF-8 is read as Windows-1252 and marked', () => {
    const bytes = new Uint8Array([
        0xef, 0xbb, 0xbf, 0x61, 0x0a, 0x62, 0x97, 0x63, 0x0a, 0xc3, 0xa9,
    ]);
    const lines = logLines(bytes);
    assert.deepEqual(
        lines.map((l) => [l.text, l.notUtf8]),
        [
            ['a', false],
            ['b—c', true],
            ['é', false],
        ],
    );
    assert.equal(logLines('\uFEFFx')[0]?.text, 'x');
});
