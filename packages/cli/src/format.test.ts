/**
 * `format` (format.ts): files of a mod formatted in place by the core's formatter, `--check`
 * (exit 1 when a file would change, nothing written), `--diff` (a unified diff, nothing
 * written), a file with a parse error or not valid UTF-8 left as it is with the reason, and
 * nothing outside the mod touched.
 */

import { formatText } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { runCli, scratch, write, type Result } from './testing.js';

const BOM = '\uFEFF';

const EFFECTS =
    'my_effect = {\n    add_gold = 10   remove_trait = shy\n}\nother_effect = {\n\tadd_gold = 1\n}\n';
const LOC = `${BOM}l_english:\n  my_key:0  "Text"\n`;

/** A mod with a script file, a localization file and a broken file, and `format` run in it. */
function setup(t: TestContext): { mod: string; format: (...argv: string[]) => Result } {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Format"\n');
    write(path.join(mod, 'common', 'scripted_effects', 'my_effects.txt'), EFFECTS);
    write(path.join(mod, 'common', 'scripted_effects', 'broken_effects.txt'), 'a = {\n');
    write(path.join(mod, 'localization', 'english', 'my_l_english.yml'), LOC);
    write(path.join(mod, 'notes', 'readme.txt'), 'not   script\n');
    const cache = path.join(dir, 'cache');
    return { mod, format: (...argv) => runCli(['format', ...argv], { cache, cwd: mod }) };
}

const read = (mod: string, file: string): string =>
    readFileSync(path.join(mod, ...file.split('/')), 'utf8');

test('format writes each file of the mod the game reads as the formatter gives it', (t) => {
    const { mod, format } = setup(t);
    const r = format('.');
    assert.equal(r.code, 0, r.stderr);
    assert.equal(
        r.stdout,
        [
            'formatted  common/scripted_effects/my_effects.txt',
            'formatted  localization/english/my_l_english.yml',
            '2 files formatted, 0 files already formatted, 1 file left as it is',
            '',
        ].join('\n'),
    );
    assert.match(
        r.stderr,
        /^common\/scripted_effects\/broken_effects\.txt: left as it is: line 1, column 5: .*syntax\/missing-closing-brace/,
    );
    assert.equal(
        read(mod, 'common/scripted_effects/my_effects.txt'),
        formatText(EFFECTS, 'script').text,
    );
    assert.equal(
        read(mod, 'common/scripted_effects/my_effects.txt'),
        `${BOM}my_effect = {\r\n\tadd_gold = 10\r\n\tremove_trait = shy\r\n}\r\nother_effect = { add_gold = 1 }\r\n`,
    );
    assert.equal(
        read(mod, 'localization/english/my_l_english.yml'),
        `${BOM}l_english:\r\n my_key:0 "Text"\r\n`,
    );
    assert.equal(read(mod, 'common/scripted_effects/broken_effects.txt'), 'a = {\n');
    assert.equal(read(mod, 'notes/readme.txt'), 'not   script\n', 'a file the game does not read');
    // A second run changes nothing.
    const again = format('.', '--check');
    assert.equal(again.code, 0);
    assert.match(
        again.stdout,
        /^0 files would change, 2 files already formatted, 1 file left as it is\n$/,
    );
});

test('--check writes nothing and exits with 1 when a file would change; --diff shows it', (t) => {
    const { mod, format } = setup(t);
    const check = format('--check', 'common');
    assert.equal(check.code, 1);
    assert.match(check.stdout, /^would change {2}common\/scripted_effects\/my_effects\.txt\n/);
    assert.equal(read(mod, 'common/scripted_effects/my_effects.txt'), EFFECTS);
    const diff = format('--diff', 'common/scripted_effects/my_effects.txt');
    assert.equal(diff.code, 0);
    assert.equal(
        diff.stdout,
        [
            '--- a/common/scripted_effects/my_effects.txt',
            '+++ b/common/scripted_effects/my_effects.txt',
            '# the byte-order mark is added',
            '@@ -1,6 +1,5 @@',
            '-my_effect = {',
            '-    add_gold = 10   remove_trait = shy',
            '-}',
            '-other_effect = {',
            '-\tadd_gold = 1',
            '-}',
            '+my_effect = {',
            '+\tadd_gold = 10',
            '+\tremove_trait = shy',
            '+}',
            '+other_effect = { add_gold = 1 }',
            '1 file would change, 0 files already formatted, 0 files left as they are',
            '',
        ].join('\n'),
    );
    assert.equal(read(mod, 'common/scripted_effects/my_effects.txt'), EFFECTS);
});

test('nothing outside the mod, nothing the game does not read, and no file not UTF-8 is touched', (t) => {
    const { mod, format } = setup(t);
    const outside = format('--mod', mod, path.join(mod, '..'));
    assert.equal(outside.code, 2);
    assert.match(outside.stderr, /is outside the mod/);
    const notRead = format('notes/readme.txt');
    assert.equal(notRead.code, 2);
    assert.match(
        notRead.stderr,
        /notes\/readme\.txt is not a script or localization file the game reads/,
    );
    const missing = format('events/none.txt');
    assert.equal(missing.code, 2);
    const latin = path.join(mod, 'common', 'scripted_effects', 'latin_effects.txt');
    writeFileSync(latin, Buffer.from([0x61, 0x20, 0x3d, 0x20, 0xe9, 0x0a]));
    const r = format('common/scripted_effects/latin_effects.txt');
    assert.equal(r.code, 0);
    assert.match(r.stderr, /latin_effects\.txt: left as it is: the file is not valid UTF-8/);
    assert.deepEqual([...readFileSync(latin)], [0x61, 0x20, 0x3d, 0x20, 0xe9, 0x0a]);
});
