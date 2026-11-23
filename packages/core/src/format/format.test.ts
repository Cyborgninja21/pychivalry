/**
 * The formatter's engine (docs/formatting.md): the guarantees on every hand-written script of the
 * fixtures, the rule table, the width, Format Selection, the files left as they are, and the
 * localization formatter.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parseLocalization } from '../index/localization.js';
import { REPO_ROOT } from '../spec/testing.js';
import { compareFormatted } from './compare.js';
import { formatRangeEdits, formatText } from './index.js';
import { applyFormatEdits, lineEndingOf } from './result.js';
import { FORMAT_RULES, type LayoutRules } from './rules.js';
import { formatScript } from './script.js';
import { columnsAfter, LINE_WIDTH } from './width.js';

const BOM = '﻿';

/** Every file under a folder with one of the extensions. */
function filesUnder(dir: string, extensions: readonly string[]): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            return filesUnder(full, extensions);
        }
        return extensions.some((e) => name.endsWith(e)) ? [full] : [];
    });
}

test('on every script and localization file of the fixtures: same tree, nothing lost, stable', () => {
    const files = filesUnder(path.join(REPO_ROOT, 'fixtures'), ['.txt', '.yml']);
    assert.ok(files.length > 200, `fixture files (${String(files.length)})`);
    let formatted = 0;
    for (const file of files) {
        const kind = file.endsWith('.yml') ? 'localization' : 'script';
        const text = readFileSync(file, 'utf8');
        const result = formatText(text, kind);
        if (result.left !== null) {
            assert.equal(result.text, text, `${file}: left as it is, byte for byte`);
            continue;
        }
        formatted++;
        const comparison = compareFormatted(text, result.text, kind);
        assert.equal(comparison.difference, null, file);
        assert.equal(comparison.commentsMoved, 0, file);
        assert.equal(formatText(result.text, kind).text, result.text, `${file}: a second format`);
        assert.equal(applyFormatEdits(text, result.edits), result.text, `${file}: its edits`);
    }
    assert.ok(formatted > 200);
});

test('the output follows the rules line by line', () => {
    const text = ['a={b=c d=e}', '  f = { g h i }', 'j = {', '', '', '    k = l   # c', '}'].join(
        '\n',
    );
    const out = formatScript(text).text;
    assert.ok(out.startsWith(BOM));
    const lines = out.slice(1).split('\r\n');
    assert.equal(lines.pop(), '', 'one line break at the end');
    assert.deepEqual(lines, [
        'a = {',
        '\tb = c',
        '\td = e',
        '}',
        'f = { g h i }',
        'j = {',
        '\tk = l # c',
        '}',
    ]);
    for (const line of lines) {
        assert.doesNotMatch(line, /[ \t]$/);
        assert.doesNotMatch(line, /^\t* /);
    }
});

test('a block of one simple pair, plain values or nothing goes on one line; others are broken', () => {
    const cases: [string, string][] = [
        ['a = {\n\tb = c\n}', 'a = { b = c }'],
        ['a = {\n\tb\n\tc\n}', 'a = { b c }'],
        ['a = {\n}', 'a = {}'],
        ['a = { b = { c = d } }', 'a = {\r\n\tb = { c = d }\r\n}'],
        ['a = { b = c d = e }', 'a = {\r\n\tb = c\r\n\td = e\r\n}'],
        ['a = { b c = d }', 'a = {\r\n\tb\r\n\tc = d\r\n}'],
        ['a = { color = rgb { 1 2 3 } }', 'a = {\r\n\tcolor = rgb { 1 2 3 }\r\n}'],
        ['a = { count $OP$ 3 }', 'a = { count $OP$ 3 }'],
        ['a = { b = "two\nlines" }', 'a = {\r\n\tb = "two\nlines"\r\n}'],
        ['a = { # note\n\tb = c\n}', 'a = { # note\r\n\tb = c\r\n}'],
    ];
    for (const [input, want] of cases) {
        assert.equal(formatScript(input).text, `${BOM}${want}\r\n`, input);
    }
});

test('a line wider than 120 columns breaks its outermost block on one line first, then measures again', () => {
    const values = Array.from({ length: 20 }, (_, i) => `v${String(i)}`).join(' ');
    const out = formatScript(`a = { b = { ${values} } }`).text.slice(1);
    // The outer block holds no simple pair: broken anyway; the list fits on its own line.
    assert.equal(out, `a = {\r\n\tb = { ${values} }\r\n}\r\n`);
    const long = Array.from({ length: 40 }, (_, i) => `value${String(i)}`).join(' ');
    const split = formatScript(`a = { ${long} }`).text.slice(1).split('\r\n');
    assert.equal(split.length, 40 + 3);
    assert.equal(split[1], '\tvalue0');
    // What does not fit and has nothing to break stays: a long word, quoted text, `@[ ]`.
    const word = `x_${'y'.repeat(130)}`;
    assert.equal(formatScript(`a = ${word}`).text, `${BOM}a = ${word}\r\n`);
    const arithmetic = `@[ ${'b + '.repeat(40)}c ]`;
    assert.equal(
        formatScript(`a = { v = ${arithmetic} }`).text.slice(1),
        `a = {\r\n\tv = ${arithmetic}\r\n}\r\n`,
    );
    assert.equal(LINE_WIDTH, 120);
});

test('a column is a code point; a tab moves to the next multiple of four', () => {
    assert.equal(columnsAfter('abc'), 3);
    assert.equal(columnsAfter('\t'), 4);
    assert.equal(columnsAfter('a\tb'), 5);
    assert.equal(columnsAfter('\t\t'), 8);
    assert.equal(columnsAfter('é'), 1);
    assert.equal(columnsAfter('é'), 2, 'a combining mark counts as a character');
    assert.equal(columnsAfter('\u{1F600}'), 1, 'one code point outside the BMP is one column');
    assert.equal(columnsAfter('漢字'), 2, 'a wide character counts one column');
});

test('the layout is one table of rules: the same engine keeps the author’s layout under another', () => {
    const asWritten: LayoutRules = {
        ...FORMAT_RULES,
        statements: { layout: 'as-written' },
        lists: { layout: 'as-written' },
        empty: { layout: 'as-written' },
        values: 'as-written',
        lineEnding: 'majority',
        bom: 'keep',
    };
    const text = 'a = {\n\tb = c\n}\nd = { e = f g = h }\nlist = { 1 2\n\t3 }\n';
    assert.equal(
        formatText(text, 'script', { rules: asWritten }).text,
        'a = {\n\tb = c\n}\nd = { e = f g = h }\nlist = {\n\t1 2\n\t3\n}\n',
    );
    const several: LayoutRules = { ...asWritten, statements: { layout: 'several' } };
    assert.equal(
        formatText('a = { b = c }\n', 'script', { rules: several }).text,
        'a = {\n\tb = c\n}\n',
    );
    assert.equal(lineEndingOf('a\r\nb\r\nc\n'), '\r\n');
    assert.equal(lineEndingOf('a\nb\nc\r\n'), '\n');
    assert.equal(lineEndingOf('a'), '\r\n', 'none: the game’s majority');
});

test('a file with a parse error, or quoted text never closed, is left as it is, with the reason', () => {
    for (const [text, id] of [
        ['a = {\n  b = c\n', 'syntax/missing-closing-brace'],
        ['a = b\n}\n', 'syntax/unexpected-closing-brace'],
        ['a = "open\n', 'syntax/unterminated-string'],
        ['a\nb = c', 'syntax/missing-operator'],
    ] as const) {
        const result = formatScript(text);
        assert.equal(result.text, text);
        assert.equal(result.changed, false);
        assert.equal(result.left?.id, id, text);
        assert.deepEqual(result.edits, []);
    }
    // `@[` without its `]` is information, not an error: formatted, the token kept.
    assert.equal(formatScript('a   =   @[ b').left, null);
    assert.equal(formatScript('a   =   @[ b').text, `${BOM}a = @[ b\r\n`);
});

test('a pair stays on its key’s line, but not across a comment or `@[` without its `]`', () => {
    assert.equal(formatScript('a\n=\n{\n\tb = c\n}').text.slice(1), 'a = { b = c }\r\n');
    assert.equal(formatScript('a = # why\n{ b = c }').text.slice(1), 'a = # why\r\n{ b = c }\r\n');
    // A prefix stays on the key's line: the parser reads it as one only there.
    assert.equal(
        formatScript('scripted_trigger   my_trigger = { always = yes }').text.slice(1),
        'scripted_trigger my_trigger = { always = yes }\r\n',
    );
});

test('Format Selection: the whole file is the full format; a part edits only its lines', () => {
    const text = 'a={b=c d=e}\n    f = g   \n\n\n\nh =\n{\n  i = j\n}\n';
    const full = formatText(text, 'script');
    const lines = text.split('\n').length;
    const all = formatRangeEdits(text, 'script', 0, lines);
    assert.equal(applyFormatEdits(text, all.edits), full.text.slice(1));
    // Only line 1 (`    f = g   `): its indentation and its trailing spaces.
    const part = formatRangeEdits(text, 'script', 1, 1);
    const once = applyFormatEdits(text, part.edits);
    assert.equal(once, 'a={b=c d=e}\nf = g\n\n\n\nh =\n{\n  i = j\n}\n');
    // A part formatted, then the whole file: the same as the whole file at once.
    assert.equal(formatText(once, 'script').text, full.text);
    // A file left as it is gives no edit.
    assert.deepEqual(formatRangeEdits('a = {', 'script', 0, 0).edits, []);
});

test('localization: whitespace only, never the text; the reader reads the same entries', () => {
    const text = [
        'l_english:   ',
        'key_one:0   "Text one" # a note  ',
        '\t\tkey_two: "Two \\"quoted\\" words"',
        '#  comment',
        '',
        '',
        '',
        '   key_three:"Three"',
        '  not an entry at all  ',
        ' key_four: "never closed  ',
        '',
    ].join('\n');
    const out = formatText(text, 'localization').text;
    assert.equal(
        out,
        [
            `${BOM}l_english:`,
            ' key_one:0 "Text one" # a note',
            ' key_two: "Two \\"quoted\\" words"',
            ' #  comment',
            '',
            ' key_three: "Three"',
            '  not an entry at all  ',
            ' key_four: "never closed  ',
            '',
        ].join('\r\n'),
    );
    const before = parseLocalization(text);
    const after = parseLocalization(out);
    assert.deepEqual(
        after.entries.map((e) => [
            e.key,
            e.version,
            e.terminated,
            after.text.slice(e.textStart, e.textEnd),
        ]),
        before.entries.map((e) => [
            e.key,
            e.version,
            e.terminated,
            before.text.slice(e.textStart, e.textEnd),
        ]),
    );
    assert.equal(formatText(out, 'localization').text, out);
});
