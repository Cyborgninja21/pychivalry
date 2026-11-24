/**
 * The agent server's `format` (docs/PLAN.md item 8.9): one file of the mod formatted, as the
 * core's formatter gives it, returned and written nowhere; a long file in pages whose text, put
 * together, is the whole; a file left as it is with its reason; a file in the format with no text.
 *
 * And `apply_format` (item 9.8): the same formatting written to the file, byte for byte what the
 * command line's format writes (the formatter's text, its byte-order mark and Windows line
 * breaks), after which `check` finds no `style/` finding in it; a second call writes nothing; a
 * file with a parse error or not valid UTF-8 is not written; no other file is touched.
 */

import { formatText } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { connect, gameStub, scratch, write } from './testing.js';

/** Every file under a folder with its digest. */
function digests(
    dir: string,
    out: Record<string, string> = {},
    base = dir,
): Record<string, string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            digests(full, out, base);
        } else {
            out[path.relative(base, full)] = createHash('sha256')
                .update(readFileSync(full))
                .digest('hex');
        }
    }
    return out;
}

const BOM = '\uFEFF';

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

test('apply_format writes the file in the format, as the command line does, and nothing else', async (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Apply"\n');
    // As an AI harness's file tool writes a new file: \n line breaks, the layout its own.
    const effects = path.join(mod, 'common', 'scripted_effects', 'apply_effects.txt');
    const effectsText =
        '\uFEFFapply_effect = {\n    add_gold = 10\n\n\n    add_prestige    = 5\n}\n';
    write(effects, effectsText);
    const loc = path.join(mod, 'localization', 'english', 'apply_l_english.yml');
    write(loc, 'l_english:\n  apply_key:0 "Text"\n');
    const broken = path.join(mod, 'common', 'scripted_effects', 'broken_effects.txt');
    write(broken, 'a = {\n');
    const notUtf8 = path.join(mod, 'common', 'scripted_effects', 'latin_effects.txt');
    write(notUtf8, Buffer.from([0x61, 0x20, 0x3d, 0x20, 0x7b, 0x20, 0x7d, 0x20, 0x23, 0x92, 0x0a]));
    const game = gameStub(path.join(dir, 'install'));
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));

    const before = digests(mod);
    const styleBefore = await s.output('check', {
        path: 'common/scripted_effects/apply_effects.txt',
        min_severity: 'hint',
        codes: ['style/*'],
    });
    assert.ok((styleBefore['matched'] as number) > 0, 'the file is not in the format');

    const out = await s.output('apply_format', {
        file: 'common/scripted_effects/apply_effects.txt',
    });
    assert.equal(out['written'], true);
    assert.equal(out['changed'], true);
    assert.equal(out['bom'], true);
    assert.equal(out['line_ending'], 'crlf');
    const want = formatText(effectsText, 'script').text;
    assert.deepEqual(
        readFileSync(effects),
        Buffer.from(want, 'utf8'),
        "the bytes are the formatter's text, as the command line writes them",
    );
    assert.ok(
        readFileSync(effects)
            .subarray(0, 3)
            .equals(Buffer.from([0xef, 0xbb, 0xbf])),
    );
    assert.ok(!/[^\r]\n/.test(readFileSync(effects, 'utf8')), 'every line break is \\r\\n');
    const styleAfter = await s.output('check', {
        path: 'common/scripted_effects/apply_effects.txt',
        min_severity: 'hint',
        codes: ['style/*'],
    });
    assert.equal(styleAfter['matched'], 0, 'no style/ finding is left');

    const written = await s.output('apply_format', {
        file: 'localization/english/apply_l_english.yml',
    });
    assert.equal(written['written'], true);
    assert.equal(readFileSync(loc, 'utf8'), '\uFEFFl_english:\r\n apply_key:0 "Text"\r\n');

    // A second call: the file is in the format, so nothing is written.
    const time = statSync(effects).mtimeMs;
    const again = await s.output('apply_format', {
        file: 'common/scripted_effects/apply_effects.txt',
    });
    assert.equal(again['written'], false);
    assert.equal(again['changed'], false);
    assert.equal(statSync(effects).mtimeMs, time, 'not written again');

    const left = await s.output('apply_format', {
        file: 'common/scripted_effects/broken_effects.txt',
    });
    assert.equal(left['written'], false);
    assert.equal(left['formatted'], false);
    assert.match(String(left['reason']), /^left as it is: line 1, column 5: /);
    const latin = await s.output('apply_format', {
        file: 'common/scripted_effects/latin_effects.txt',
    });
    assert.equal(latin['written'], false);
    assert.match(String(latin['reason']), /not valid UTF-8/);

    const after = digests(mod);
    for (const [file, digest] of Object.entries(before)) {
        const named = ['apply_effects.txt', 'apply_l_english.yml'].includes(path.basename(file));
        assert.equal(after[file] === digest, !named, `${file} ${named ? 'written' : 'untouched'}`);
    }
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort(), 'no file added');
});
