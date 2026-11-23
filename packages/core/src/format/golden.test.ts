/**
 * The golden files (docs/PLAN.md item 8.4; docs/MVP.md, "Tests per feature", row "Formatter"):
 * `fixtures/format/<name>.before.<ext>` formatted gives `<name>.after.<ext>` byte for byte, a
 * second format changes nothing, the tree (or the localization reading) is the same, no comment
 * is lost or moved; and on-type formatting agrees with the formatter on every script output
 * (row "On-type formatting", item 8.5): typing the file key by key ends in the formatter's text,
 * and so do Enter, `}` and `=` typed again at any place.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from '../spec/testing.js';
import { tokenize } from '../syntax/lexer.js';
import { parse } from '../syntax/parser.js';
import type { Item } from '../syntax/tree.js';
import { compareFormatted } from './compare.js';
import { formatKindOf, formatText } from './index.js';
import { onTypeEdits } from './on-type.js';
import { applyFormatEdits, type FormatKind } from './result.js';

const DIR = path.join(REPO_ROOT, 'fixtures', 'format');

/** Every golden pair: its name, kind and the two texts. */
function goldens(): { name: string; kind: FormatKind; before: string; after: string }[] {
    return readdirSync(DIR)
        .filter((f) => f.includes('.before.'))
        .sort()
        .map((f) => {
            const kind = formatKindOf(f);
            assert.ok(kind !== undefined, f);
            return {
                name: f.replace('.before.', '.'),
                kind,
                before: readFileSync(path.join(DIR, f), 'utf8'),
                after: readFileSync(path.join(DIR, f.replace('.before.', '.after.')), 'utf8'),
            };
        });
}

test('every golden pair has its two halves, and the part has a README', () => {
    const files = readdirSync(DIR);
    const before = files.filter((f) => f.includes('.before.'));
    assert.ok(before.length >= 20, `golden pairs (${String(before.length)})`);
    for (const f of before) {
        assert.ok(files.includes(f.replace('.before.', '.after.')), f);
    }
    assert.ok(files.includes('README.md'));
    const readme = readFileSync(path.join(DIR, 'README.md'), 'utf8');
    for (const f of before) {
        assert.ok(readme.includes(`\`${f.replace(/\.before\..*$/, '')}\``), `README names ${f}`);
    }
});

for (const golden of goldens()) {
    test(`golden ${golden.name}: formatted, then formatted again, with nothing lost`, () => {
        const result = formatText(golden.before, golden.kind);
        assert.equal(result.text, golden.after, 'the formatter gives the golden file');
        assert.equal(applyFormatEdits(golden.before, result.edits), result.text, 'its edits');
        const again = formatText(golden.after, golden.kind);
        assert.equal(again.text, golden.after, 'a second format changes nothing');
        assert.equal(again.edits.length, 0);
        const comparison = compareFormatted(golden.before, result.text, golden.kind);
        assert.equal(comparison.difference, null);
        assert.ok(comparison.sameTree && comparison.sameTokens);
        assert.equal(comparison.commentsAfter, comparison.commentsBefore);
        assert.equal(comparison.commentsMoved, 0);
    });
}

/** Where each line of a text starts, and whether it starts inside quoted text. */
function lineStarts(text: string): { start: number; inText: boolean }[] {
    const tokens = tokenize(text);
    const out: { start: number; inText: boolean }[] = [];
    let start = 0;
    for (;;) {
        const inText = tokens.some((t) => t.kind === 'string' && t.start < start && start < t.end);
        out.push({ start, inText });
        const lf = text.indexOf('\n', start);
        if (lf < 0) {
            return out;
        }
        start = lf + 1;
    }
}

/** A text with what is typed at `at` (replacing `[at, end)`), and the on-type edits applied. */
function typed(text: string, at: number, end: number, what: string, key: string): string {
    const next = text.slice(0, at) + what + text.slice(end);
    return applyFormatEdits(next, onTypeEdits(next, at + what.length, key));
}

const scripts = goldens().filter(
    (g) => g.kind === 'script' && formatText(g.before, 'script').left === null,
);

for (const golden of scripts) {
    // On-type formatting works on the text an editor holds: without the byte-order mark.
    const output = golden.after.replace(/^﻿/, '');

    test(`on-type agrees with the formatter on ${golden.name}: typed key by key`, () => {
        let text = '';
        const lines = lineStarts(output);
        for (let n = 0; n < lines.length; n++) {
            const line = lines[n];
            if (line === undefined) {
                continue;
            }
            const next = lines[n + 1]?.start ?? output.length;
            let from = line.start;
            if (!line.inText) {
                // The indentation is Enter's to give.
                while (output[from] === '\t') {
                    from++;
                }
            }
            for (let i = from; i < next; i++) {
                const ch = output[i] ?? '';
                if (ch === '\r' && output[i + 1] === '\n') {
                    text = typed(text, text.length, text.length, '\r\n', '\n');
                    i++;
                    continue;
                }
                text =
                    ch === '\n' || ch === '}' || ch === '='
                        ? typed(text, text.length, text.length, ch, ch)
                        : text + ch;
            }
        }
        assert.equal(text, output);
    });

    test(`on-type agrees with the formatter on ${golden.name}: Enter, } and = typed again`, () => {
        // Enter, in place of the line break and indentation before each line that holds
        // something: a blank line keeps Enter's indentation until the cursor leaves it, when it
        // is emptied (the key-by-key test above ends with it empty).
        for (const line of lineStarts(output).slice(1)) {
            if (line.inText || /^(\r?\n|$)/.test(output.slice(line.start))) {
                continue;
            }
            const breakStart = output[line.start - 2] === '\r' ? line.start - 2 : line.start - 1;
            let end = line.start;
            while (output[end] === '\t') {
                end++;
            }
            const eol = output.slice(breakStart, line.start);
            assert.equal(
                typed(output, breakStart, end, eol, '\n'),
                output,
                `Enter at ${String(line.start)}`,
            );
        }
        // `}` at the start of a line, its indentation removed.
        for (const line of lineStarts(output)) {
            let first = line.start;
            while (output[first] === '\t') {
                first++;
            }
            if (output[first] === '}' && !line.inText) {
                assert.equal(
                    typed(output, line.start, first + 1, '}', '}'),
                    output,
                    `} at ${String(first)}`,
                );
            }
        }
        // `=` of each pair's operator, the spaces around it removed.
        const pairs: { key: number; op: number; opEnd: number; value: number }[] = [];
        const walk = (items: readonly Item[]): void => {
            for (const item of items) {
                if (item.kind === 'block') {
                    walk(item.items);
                }
                if (item.kind !== 'pair' || item.operator === null || item.value === null) {
                    continue;
                }
                if (!item.operator.parameter && item.value.kind !== 'operator') {
                    pairs.push({
                        key: item.key.end,
                        op: item.operator.start,
                        opEnd: item.operator.end,
                        value: item.value.start,
                    });
                }
                const v = item.value;
                if (v.kind === 'block') {
                    walk(v.items);
                } else if (v.kind === 'tagged' && v.body.kind === 'block') {
                    walk(v.body.items);
                }
            }
        };
        walk(parse(output).file.items);
        for (const p of pairs) {
            if (/[\r\n]/.test(output.slice(p.key, p.value))) {
                continue;
            }
            const operator = output.slice(p.op, p.opEnd);
            const cut = output.slice(0, p.key) + operator.slice(0, -1);
            const rest = output.slice(p.value);
            const text = cut + rest;
            assert.equal(
                typed(text, cut.length, cut.length, '=', '='),
                output,
                `= of ${operator} at ${String(p.op)}`,
            );
        }
    });
}
