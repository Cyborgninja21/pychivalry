/**
 * Formatting in the editor (`formatting.ts`; docs/PLAN.md items 8.5 and 8.9): Format Document
 * gives the core formatter's text but the byte-order mark (the file's encoding in the editor),
 * Format Selection keeps the edits of the lines selected, on-type formatting answers Enter, `}`
 * and `=`, and a file with a parse error gets no edit and one message saying why.
 */

import { applyFormatEdits, formatText, LineIndex } from '@pychivalry/core';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import type { TextEdit } from 'vscode-languageserver/node';
import { gameStub, scratch, serverInProcess, write } from './testing.js';

/** A text with protocol edits applied. */
function applied(text: string, edits: readonly TextEdit[]): string {
    const lines = new LineIndex(text);
    return applyFormatEdits(
        text,
        edits
            .map((e) => ({
                start: lines.offsetAt(e.range.start),
                end: lines.offsetAt(e.range.end),
                text: e.newText,
            }))
            .sort((a, b) => a.start - b.start),
    );
}

const OPTIONS = { tabSize: 4, insertSpaces: true };

test('Format Document, Format Selection and on-type formatting answer from the core', async (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    const text =
        'my_effect = {\n    add_gold = 10   remove_trait = shy\n}\nother_effect = {\n\tadd_gold = 1\n}\n';
    const file = path.join(mod, 'common', 'scripted_effects', 'my_effects.txt');
    write(path.join(mod, 'descriptor.mod'), 'name = "Format"\n');
    write(file, text);
    const { client } = serverInProcess(t, { gamePath: gameStub(path.join(dir, 'install')) });
    await client.start([mod]);
    await client.settled();
    const uri = await client.open(file, text);
    const document = { textDocument: { uri } };

    const whole: TextEdit[] = await client.connection.sendRequest('textDocument/formatting', {
        ...document,
        options: OPTIONS,
    });
    assert.equal(
        applied(text, whole),
        formatText(text, 'script').text.replace(/^﻿/, ''),
        'the core formatter, but the mark: the encoding in the editor',
    );

    const part: TextEdit[] = await client.connection.sendRequest('textDocument/rangeFormatting', {
        ...document,
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
        options: OPTIONS,
    });
    assert.equal(
        applied(text, part),
        'my_effect = {\n\tadd_gold = 10\r\n\tremove_trait = shy\n}\nother_effect = {\n\tadd_gold = 1\n}\n',
        'only line 2: its indentation, and its two pairs one a line',
    );

    const typed = 'my_effect = {\n    }\nother_effect = {\n\tadd_gold = 1\n}\n';
    const uri2 = await client.open(
        path.join(mod, 'common', 'scripted_effects', 'typed.txt'),
        typed,
    );
    const onType: TextEdit[] = await client.connection.sendRequest(
        'textDocument/onTypeFormatting',
        {
            textDocument: { uri: uri2 },
            position: { line: 1, character: 5 },
            ch: '}',
            options: OPTIONS,
        },
    );
    assert.equal(applied(typed, onType), 'my_effect = {\n}\nother_effect = {\n\tadd_gold = 1\n}\n');
});

test('a file with a parse error gets no edit, and the reason is said once', async (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    const file = path.join(mod, 'common', 'scripted_effects', 'broken.txt');
    write(path.join(mod, 'descriptor.mod'), 'name = "Format"\n');
    write(file, 'a = {\n');
    const { client } = serverInProcess(t, { gamePath: gameStub(path.join(dir, 'install')) });
    await client.start([mod]);
    await client.settled();
    const uri = await client.open(file, 'a = {\n');
    for (let i = 0; i < 2; i++) {
        const edits: TextEdit[] = await client.connection.sendRequest('textDocument/formatting', {
            textDocument: { uri },
            options: OPTIONS,
        });
        assert.deepEqual(edits, []);
    }
    await client.until(() => client.messages.length > 0, 'the message');
    const said = client.messages.filter((m) => m.message.includes('did not format'));
    assert.equal(said.length, 1);
    assert.match(said[0]?.message ?? '', /line 1, column 5: .*syntax\/missing-closing-brace/);
});
