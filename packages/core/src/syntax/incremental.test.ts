/**
 * Incremental re-parse (docs/PLAN.md item 2.7): on every fixture, an edit followed by a
 * re-parse gives the same tree and findings as a full parse of the new text.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { decodeScript } from './decode.js';
import { parse, reparse, type ParseResult, type TextEdit } from './parser.js';
import { filesUnder, fixtureMods, random } from './testing.js';
import { blockOf } from './tree.js';

const fixtures = filesUnder(fixtureMods, '.txt').map((rel) => ({
    rel,
    text: decodeScript(readFileSync(path.join(fixtureMods, rel))).text,
}));

/** Texts typed or deleted at each place: whole tokens, and the characters that unbalance. */
const INSERTS = ['x', ' ', '\n', '{', '}', '"', '#', '= ', 'a = { b }', '@['];

function apply(text: string, edit: TextEdit): string {
    return text.slice(0, edit.start) + edit.text + text.slice(edit.end);
}

/** The parts of a result a full parse defines: everything but which span was re-parsed. */
function comparable(result: ParseResult): unknown {
    return {
        text: result.text,
        bom: result.bom,
        file: result.file,
        findings: result.findings,
        lines: result.lines.lineStarts,
    };
}

function assertSame(previous: ParseResult, edit: TextEdit, where: string): ParseResult {
    const incremental = reparse(previous, edit);
    const full = parse(apply(previous.text, edit));
    assert.deepEqual(comparable(incremental), comparable(full), where);
    return incremental;
}

test('fixtures to edit exist', () => {
    assert.ok(fixtures.length >= 19);
});

for (const { rel, text } of fixtures) {
    test(`an edit then a re-parse equals a full parse: ${rel}`, () => {
        const previous = parse(text);
        const step = Math.max(1, Math.floor(text.length / 150));
        for (let at = 0; at <= text.length; at += step) {
            for (const insert of INSERTS) {
                assertSame(
                    previous,
                    { start: at, end: at, text: insert },
                    `insert ${JSON.stringify(insert)} at ${String(at)}`,
                );
            }
            for (const length of [1, 3]) {
                const end = Math.min(text.length, at + length);
                assertSame(
                    previous,
                    { start: at, end, text: '' },
                    `delete ${String(at)}-${String(end)}`,
                );
                assertSame(
                    previous,
                    { start: at, end, text: '} {' },
                    `replace ${String(at)}-${String(end)}`,
                );
            }
        }
    });

    test(`a chain of edits, each re-parsed, stays equal to a full parse: ${rel}`, () => {
        const next = random(rel.length * 7919 + text.length);
        let current = parse(text);
        for (let n = 0; n < 40; n++) {
            const start = Math.floor(next() * (current.text.length + 1));
            const end = Math.min(current.text.length, start + Math.floor(next() * 4));
            const insert = INSERTS[Math.floor(next() * INSERTS.length)] ?? '';
            current = assertSame(
                current,
                { start, end, text: next() < 0.3 ? '' : insert },
                `edit ${String(n)}`,
            );
        }
    });
}

test('an edit inside a block re-parses that block only and reuses the nodes around it', () => {
    const text =
        'namespace = n\n\nn.1 = {\n\ttype = character_event\n\toption = { name = n.1.a }\n}\n\nn.2 = {\n\ttype = character_event\n}\n';
    const previous = parse(text);
    const at = text.indexOf('n.1.a') + 'n.1.a'.length;
    const result = reparse(previous, { start: at, end: at, text: 'x' });
    assert.equal(result.text, apply(text, { start: at, end: at, text: 'x' }));
    // Only the inside of `option = { ... }` was parsed again.
    const option = text.indexOf('{ name');
    assert.deepEqual(result.reparsed, { start: option + 1, end: text.indexOf(' }', option) + 2 });
    // The pair before the edited event is the very same node; the event after is moved.
    assert.equal(result.file.items[0], previous.file.items[0]);
    const after = result.file.items[2];
    assert.ok(after?.kind === 'pair');
    assert.equal(after.start, (previous.file.items[2]?.start ?? 0) + 1);
    // The unchanged `type` pair inside the edited event is shared too.
    const event = result.file.items[1];
    const before = previous.file.items[1];
    assert.ok(event?.kind === 'pair' && before?.kind === 'pair');
    assert.equal(blockOf(event.value)?.items[0], blockOf(before.value)?.items[0]);
    assert.deepEqual(comparable(result), comparable(parse(result.text)));
});

test('an edit that changes what lies outside its block is re-parsed further out', () => {
    const text = 'a = {\n\tb = { c = d }\n}\ne = f\n';
    const previous = parse(text);
    const at = text.indexOf('c = d');
    // An extra `}` inside b closes a early: b's own `}` then closes a, and a's is stray.
    const result = reparse(previous, { start: at, end: at, text: '} ' });
    assert.deepEqual(result.reparsed, { start: 0, end: result.text.length });
    assert.deepEqual(comparable(result), comparable(parse(result.text)));
    assert.deepEqual(
        result.findings.map((f) => f.id),
        ['syntax/unexpected-closing-brace'],
    );
});

test('a re-parse keeps the byte-order mark of the text it came from', () => {
    const previous = parse('﻿a = { b = c }');
    const result = reparse(previous, { start: 10, end: 11, text: 'd' });
    assert.equal(result.bom, true);
    assert.equal(result.text, 'a = { b = d }');
});

test('an edit outside the text is clamped to it', () => {
    const previous = parse('a = b');
    const result = reparse(previous, { start: 10, end: 20, text: ' c = d' });
    assert.equal(result.text, 'a = b c = d');
    assert.deepEqual(comparable(result), comparable(parse('a = b c = d')));
});
