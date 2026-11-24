/**
 * On-type formatting (docs/formatting.md, "On-type formatting"): Enter, `}` and `=` in a script
 * file, never inside quoted text or a comment, never on text whose depth is not known, never in
 * a localization file. Its agreement with the formatter is tested on the golden files
 * (`golden.test.ts`).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onTypeEdits } from './on-type.js';
import { applyFormatEdits } from './result.js';

/** The text with `|` marking the cursor, after on-type formatting for `key`. */
function after(marked: string, key: string): string {
    const at = marked.indexOf('|');
    const text = marked.slice(0, at) + marked.slice(at + 1);
    return applyFormatEdits(text, onTypeEdits(text, at, key));
}

test('Enter indents the new line by the blocks open before it and trims the line it leaves', () => {
    assert.equal(after('a = {   \n|', '\n'), 'a = {\n\t');
    assert.equal(after('a = {\n\tb = {\n|', '\n'), 'a = {\n\tb = {\n\t\t');
    assert.equal(after('a = {\n\t\n    |}', '\n'), 'a = {\n\n}', 'a line of nothing is emptied');
    assert.equal(after('a = {\r\n  |b = c', '\n'), 'a = {\r\n\tb = c');
    assert.equal(after('a = { b = c }\n  |', '\n'), 'a = { b = c }\n');
});

test('} typed first on its line takes the indentation of the line of its {', () => {
    assert.equal(after('a = {\n\tb = {\n\t\tc = d\n\t\t}|', '}'), 'a = {\n\tb = {\n\t\tc = d\n\t}');
    assert.equal(after('a = {\n\t\t\t}|', '}'), 'a = {\n}');
    assert.equal(after('a = { b = c }|', '}'), 'a = { b = c }', 'not first on its line');
});

test('= after a key gets one space before, and one after when something follows', () => {
    assert.equal(after('a=|', '='), 'a =');
    assert.equal(after('a=|b', '='), 'a = b');
    assert.equal(after('a  >=|   16', '='), 'a >= 16');
    assert.equal(after('scope:x?=|{', '='), 'scope:x ?= {');
    assert.equal(after('a = { b !=|c }', '='), 'a = { b != c }');
    assert.equal(after('=|', '='), '=', 'no key before it');
    assert.equal(after('a = b\n=|c', '='), 'a = b\n=c', 'no key before it on its line');
});

test('nothing happens inside quoted text or a comment, or where the depth is not known', () => {
    assert.equal(after('a = "text\n|', '\n'), 'a = "text\n');
    assert.equal(after('a = "x=|y"', '='), 'a = "x=y"');
    assert.equal(after('# a=|b', '='), '# a=b');
    assert.equal(after('a = b }\n}\n|', '\n'), 'a = b }\n}\n', 'a } that closes nothing');
    assert.equal(after('a = {\n\t}|', '}'), 'a = {\n}');
    assert.equal(after('}|', '}'), '}');
});

test('localization files get no on-type formatting', () => {
    const text = 'l_english:\n';
    assert.deepEqual(onTypeEdits(text, text.length, '\n', 'localization'), []);
});
