/**
 * Localization as index data (docs/PLAN.md item 3.9): keys per language, entries with and
 * without a version number, the byte-order mark handled. The first cases are release 2.3.0's
 * (`legacy/packages/engine/test/unit/host-api.test.ts`), carried over as data, with one
 * change: an entry written without indentation is read. 2.3.0 skipped it; game 1.21.0.3 writes
 * 7,544 entries that way (`TAX_SLOT_MANAGE_TAX_PAYERS_BUTTON: "..."` in
 * `localization/english/tax_collector_l_english.yml`), and its own interface uses them.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocalization, readLocalization } from './localization.js';

const keys = (text: string): string[] => parseLocalization(text).entries.map((e) => e.key);

test('2.3.0: entries with and without a version number, a trailing comment and CRLF', () => {
    const text = 'l_english:\r\n key_a:0 "A" # a comment\r\n key_b: "B"\r\nkey_c:0 "no indent"\r\n';
    const file = parseLocalization(text);
    assert.deepEqual(keys(text), ['key_a', 'key_b', 'key_c']);
    assert.deepEqual(
        file.entries.map((e) => [e.key, e.version, text.slice(e.textStart, e.textEnd)]),
        [
            ['key_a', 0, 'A'],
            ['key_b', null, 'B'],
            ['key_c', 0, 'no indent'],
        ],
    );
    assert.deepEqual(
        file.headers.map((h) => h.language),
        ['l_english'],
    );
});

test('2.3.0: the byte-order mark is removed and never counted in a position', () => {
    const bytes = new Uint8Array([
        0xef,
        0xbb,
        0xbf,
        ...new TextEncoder().encode('l_english:\n my_event.0001.t:0 "A Title"\n'),
    ]);
    const file = readLocalization(bytes);
    assert.equal(file.bom, true);
    assert.equal(file.validUtf8, true);
    const entry = file.entries[0];
    assert.equal(entry?.key, 'my_event.0001.t');
    assert.deepEqual(file.lines.positionAt(entry.start), { line: 1, character: 1 });
    assert.equal(parseLocalization('\uFEFFl_english:\n a: "x"\n').bom, true);
});

test('each entry has the language of the header above it, and a second header switches it', () => {
    const file = parseLocalization(
        'loose: "before"\nl_english:\n a: "1"\nl_french:\n a: "un"\n b:3 "deux"\n',
    );
    assert.deepEqual(
        file.entries.map((e) => [e.language, e.key, e.version]),
        [
            [null, 'loose', null],
            ['l_english', 'a', null],
            ['l_french', 'a', null],
            ['l_french', 'b', 3],
        ],
    );
});

test('the text runs to the quote that ends the line, keeping quotes and # inside it', () => {
    const text = 'l_english:\n a:0 "say "hi" #bold# now" # a comment\n b: "no end\n';
    const [a, b] = parseLocalization(text).entries;
    assert.equal(text.slice(a?.textStart, a?.textEnd), 'say "hi" #bold# now');
    assert.equal(a?.terminated, true);
    assert.equal(b?.terminated, false);
    assert.equal(text.slice(b.textStart, b.textEnd), 'no end');
});

test('$name$ in an entry is a use of the name before any |; $$ is no use', () => {
    const text = 'l_english:\n a: "$b$ and $c|U$ cost $$5, $not a name$ [d]"\n';
    const file = parseLocalization(text);
    assert.deepEqual(
        file.uses.map((u) => [u.name, text.slice(u.start, u.start + u.name.length)]),
        [
            ['b', 'b'],
            ['c', 'c'],
        ],
    );
});

test('comments, blank lines and lines of no known shape are not entries', () => {
    const file = parseLocalization(
        '# a comment\n\nl_english:\n  # indented comment\n just words\n a: "1"\n',
    );
    assert.deepEqual(
        file.entries.map((e) => e.key),
        ['a'],
    );
    assert.equal(file.unread.length, 1);
});

test('a file that is not valid UTF-8 is still read, as the parser reads one', () => {
    const bytes = new Uint8Array([
        ...new TextEncoder().encode('l_english:\n a: "caf'),
        0xe9,
        ...new TextEncoder().encode('"\n'),
    ]);
    const plain = readLocalization(bytes);
    assert.equal(plain.validUtf8, false);
    assert.deepEqual(
        plain.entries.map((e) => e.key),
        ['a'],
    );
    const fallback = readLocalization(bytes, { fallbackEncoding: 'windows-1252' });
    const entry = fallback.entries[0];
    assert.equal(fallback.text.slice(entry?.textStart, entry?.textEnd), 'café');
});
