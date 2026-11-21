import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from './parser.js';
import { LineIndex } from './position.js';

test('a line ends at \\n, \\r\\n or a lone \\r, as in the language-server protocol', () => {
    const lines = new LineIndex('a\nb\r\nc\rd');
    assert.deepEqual(lines.lineStarts, [0, 2, 5, 7]);
    assert.deepEqual(lines.positionAt(0), { line: 0, character: 0 });
    assert.deepEqual(lines.positionAt(2), { line: 1, character: 0 });
    assert.deepEqual(lines.positionAt(3), { line: 1, character: 1 });
    assert.deepEqual(lines.positionAt(7), { line: 3, character: 0 });
    assert.equal(lines.lineCount, 4);
    assert.equal(new LineIndex('').lineCount, 1);
});

test('positions and offsets convert both ways', () => {
    const text = 'key = {\r\n\tvalue = 1\r\n}\n';
    const lines = new LineIndex(text);
    for (let offset = 0; offset <= text.length; offset++) {
        const position = lines.positionAt(offset);
        // Inside a \r\n the offset of the \n maps back to the end of its line.
        if (text.charAt(offset - 1) === '\r' && text.charAt(offset) === '\n') {
            continue;
        }
        assert.equal(lines.offsetAt(position), offset, `offset ${String(offset)}`);
    }
});

test('a character past the end of its line is the end of that line, before the break', () => {
    const lines = new LineIndex('ab\r\ncd');
    assert.equal(lines.offsetAt({ line: 0, character: 99 }), 2);
    assert.equal(lines.offsetAt({ line: 1, character: 99 }), 6);
    assert.equal(lines.offsetAt({ line: 9, character: 0 }), 6);
    assert.equal(lines.offsetAt({ line: -1, character: 3 }), 0);
    assert.deepEqual(lines.positionAt(-5), { line: 0, character: 0 });
    assert.deepEqual(lines.positionAt(99), { line: 1, character: 2 });
});

test('characters are UTF-16 code units: a character outside the BMP counts two', () => {
    // U+1D504 (MATHEMATICAL FRAKTUR CAPITAL A) is one surrogate pair.
    const result = parse('# \u{1D504}\u{1D504}\nkey = "\u{1D504}" next = 1');
    const next = result.file.items.find((item) => item.kind === 'pair' && item.key.text === 'next');
    assert.ok(next !== undefined);
    assert.deepEqual(result.lines.positionAt(next.start), { line: 1, character: 11 });
});

test('the byte-order mark is not counted: positions match the text without it', () => {
    const withMark = parse('﻿a = b\nc = d');
    const without = parse('a = b\nc = d');
    assert.equal(withMark.bom, true);
    assert.equal(withMark.text, without.text);
    assert.deepEqual(withMark.file, without.file);
    assert.deepEqual(withMark.lines.positionAt(withMark.file.items[1]?.start ?? -1), {
        line: 1,
        character: 0,
    });
});

test('a range is a pair of positions', () => {
    const lines = new LineIndex('one\ntwo');
    assert.deepEqual(lines.rangeOf(1, 6), {
        start: { line: 0, character: 1 },
        end: { line: 1, character: 2 },
    });
});
