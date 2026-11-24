/**
 * The agent server's `format` (docs/PLAN.md item 8.9): one file of the mod formatted, as the
 * core's formatter gives it, returned and written nowhere; a long file in pages whose text, put
 * together, is the whole; a file left as it is with its reason; a file in the format with no text.
 */

import { formatText } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { connect, gameStub, scratch, write } from './testing.js';

const BOM = '﻿';

test('format returns the formatter’s text as a proposal, in pages, and writes nothing', async (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Format"\n');
    const effects = Array.from(
        { length: 400 },
        (_, i) => `format_effect_${String(i)} = {\n    add_gold = ${String(i)}\n}`,
    ).join('\n');
    const long = path.join(mod, 'common', 'scripted_effects', 'long_effects.txt');
    write(long, `${effects}\n`);
    write(path.join(mod, 'common', 'scripted_effects', 'broken_effects.txt'), 'a = {\n');
    write(
        path.join(mod, 'common', 'scripted_effects', 'done_effects.txt'),
        `${BOM}done_effect = { add_gold = 1 }\r\n`,
    );
    write(
        path.join(mod, 'localization', 'english', 'format_l_english.yml'),
        `${BOM}l_english:\n  format_key:0  "Text"\n`,
    );
    const game = gameStub(path.join(dir, 'install'));
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));

    const before = readFileSync(long, 'utf8');
    const want = formatText(before, 'script');
    let text = '';
    let pages = 0;
    let cursor: string | null = null;
    do {
        const page = await s.output('format', {
            file: 'common/scripted_effects/long_effects.txt',
            ...(cursor === null ? {} : { cursor }),
        });
        assert.equal(page['changed'], true);
        assert.equal(page['formatted'], true);
        assert.equal(page['bom'], true);
        assert.equal(page['line_ending'], 'crlf');
        assert.equal(page['first_line'], text.split('\n').length);
        text += page['text'] as string;
        cursor = page['next_cursor'] as string | null;
        pages++;
    } while (cursor !== null);
    assert.ok(pages > 1, `a long file takes several pages (${String(pages)})`);
    assert.equal(`${BOM}${text}`, want.text, 'the pages put together are the formatted text');
    assert.equal(readFileSync(long, 'utf8'), before, 'nothing written');

    const broken = await s.output('format', { file: 'common/scripted_effects/broken_effects.txt' });
    assert.equal(broken['formatted'], false);
    assert.equal(broken['text'], '');
    assert.match(
        String(broken['reason']),
        /^left as it is: line 1, column 5: .*syntax\/missing-closing-brace/,
    );

    const done = await s.output('format', { file: 'common/scripted_effects/done_effects.txt' });
    assert.equal(done['formatted'], true);
    assert.equal(done['changed'], false);
    assert.equal(done['text'], '');

    const loc = await s.output('format', { file: 'localization/english/format_l_english.yml' });
    assert.equal(loc['kind'], 'localization');
    assert.equal(loc['text'], 'l_english:\r\n format_key:0 "Text"\r\n');
});
