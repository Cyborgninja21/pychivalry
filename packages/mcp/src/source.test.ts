/**
 * `source` (the owner's decision of 2026-11-25), over a real round trip: the text around a place
 * of the base game and of the mod, as the index reads it; bounded (the context, the cap of 40
 * lines, a long line cut, a result's budget); only by a place a result could name, never by an
 * address (`..`, an absolute path, a backslash, a file the index does not read, a link, a file
 * whose real address is outside its layer); a file gone since the index read it; and a server
 * without the base game. It writes nothing (`read-only.test.ts`), and its answer through the
 * program that lends the base game is its own (`share.test.ts`).
 */

import assert from 'node:assert/strict';
import { mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { MAX_LINE_CHARACTERS, MAX_LINES } from './tools/source.js';
import { connect, gameStub, scratch, write, type Connection } from './testing.js';

const EFFECTS = 'common/scripted_effects/00_stub_effects.txt';
const MOD_EFFECTS = 'common/scripted_effects/my_effects.txt';

/** `count` lines of a script file, line n reading `stub_n = { }`, numbered from 1. */
function numbered(count: number, prefix: string): string[] {
    return Array.from({ length: count }, (_, i) => `${prefix}_${String(i + 1)} = { }`);
}

interface Setup {
    readonly dir: string;
    readonly game: string;
    readonly mod: string;
    readonly s: Connection;
}

async function setup(t: TestContext, extraGame: Record<string, string> = {}): Promise<Setup> {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'), {
        [EFFECTS]: `${numbered(100, 'stub').join('\n')}\n`,
        ...extraGame,
    });
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Source"\n');
    write(path.join(mod, ...MOD_EFFECTS.split('/')), `${numbered(30, 'mine').join('\r\n')}\r\n`);
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    return { dir, game, mod, s };
}

/** The lines a result shows, without their numbers. */
function textOf(out: Record<string, unknown>): string[] {
    return (out['lines'] as string[]).map((l) => l.slice(l.indexOf('\t') + 1));
}

function numbersOf(out: Record<string, unknown>): number[] {
    return (out['lines'] as string[]).map((l) => Number(l.slice(0, l.indexOf('\t'))));
}

test('the lines around a place of the base game and of the mod, numbered, by the one place writer', async (t) => {
    const { s } = await setup(t);
    const game = await s.output('source', { layer: 'game', file: EFFECTS, line: 50 });
    assert.deepEqual(
        numbersOf(game),
        Array.from({ length: 21 }, (_, i) => 40 + i),
    );
    assert.deepEqual(textOf(game), numbered(100, 'stub').slice(39, 60));
    assert.equal(game['line_count'], 101, 'the line after the last line break counts');
    assert.equal(game['encoding'], 'utf-8');
    assert.deepEqual(game['cut_lines'], []);
    // What was shown is a place of the base game, which says it is read with source.
    assert.deepEqual(game['shown'], {
        layer: 'game',
        file: EFFECTS,
        line: 40,
        column: 1,
        end_line: 60,
        end_column: 'stub_60 = { }'.length + 1,
        read_with: 'source',
    });
    // The mod's lines, its \r\n breaks not part of any line; a mod place has no read_with.
    const mod = await s.output('source', { layer: 'mod', file: MOD_EFFECTS, line: 1, context: 2 });
    assert.deepEqual(textOf(mod), ['mine_1 = { }', 'mine_2 = { }', 'mine_3 = { }']);
    assert.deepEqual(mod['shown'], {
        layer: 'mod',
        file: MOD_EFFECTS,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 13,
    });
    // A place of several lines, with no context.
    const span = await s.output('source', {
        layer: 'game',
        file: EFFECTS,
        line: 10,
        end_line: 12,
        context: 0,
    });
    assert.deepEqual(numbersOf(span), [10, 11, 12]);
    // Near the end and the start, what there is.
    const last = await s.output('source', { layer: 'game', file: EFFECTS, line: 100 });
    assert.deepEqual(numbersOf(last).at(0), 90);
    assert.deepEqual(numbersOf(last).at(-1), 101);
});

test('at most 40 lines: the context shrinks to fit, and a longer place is cut and says how to go on', async (t) => {
    const { s } = await setup(t);
    const wide = await s.output('source', {
        layer: 'game',
        file: EFFECTS,
        line: 40,
        end_line: 49,
        context: 20,
    });
    const lines = numbersOf(wide);
    assert.equal(lines.length, MAX_LINES);
    assert.ok(lines.includes(40) && lines.includes(49), 'the place itself is whole');
    const long = await s.output('source', {
        layer: 'game',
        file: EFFECTS,
        line: 5,
        end_line: 80,
    });
    assert.deepEqual(
        numbersOf(long),
        Array.from({ length: MAX_LINES }, (_, i) => 5 + i),
    );
    assert.match(
        String((long['notes'] as string[]).at(-1)),
        /the place is longer than 40 lines: lines 5 to 44 are shown; ask again with line 45 for the rest/,
    );
});

test('a long line is cut and named; a result stays within its budget', async (t) => {
    const long = `stub_long = { ${'a '.repeat(2_000)}}`;
    const { s } = await setup(t, {
        'common/scripted_triggers/00_long.txt': `${Array.from({ length: 40 }, () => long).join('\n')}\n`,
    });
    const out = await s.output('source', {
        layer: 'game',
        file: 'common/scripted_triggers/00_long.txt',
        line: 20,
        context: 20,
    });
    const shown = out['lines'] as string[];
    assert.ok(shown.length > 0 && shown.length <= MAX_LINES);
    for (const line of shown) {
        assert.ok(line.length <= MAX_LINE_CHARACTERS + 10, 'each line cut');
        assert.ok(line.endsWith('…'));
    }
    assert.deepEqual(out['cut_lines'], numbersOf(out));
    assert.ok(JSON.stringify(out).length <= 14_000);
});

test('decoded and split as the index reads it: the byte-order mark, \\r\\n, a lone \\r, a file not valid UTF-8, localization', async (t) => {
    const { s, game } = await setup(t, {
        'common/scripted_triggers/00_marked.txt': '\ufeffa = { }\r\nb = { }\rc = { }\n',
        'localization/english/stub_l_english.yml': '\ufeffl_english:\n stub_key:0 "Stub"\n',
    });
    // Bytes that are not UTF-8: written as bytes, after the stub made the folder.
    writeFileSync(
        path.join(game, 'common', 'scripted_triggers', '00_latin1.txt'),
        Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x3d, 0x20, 0x7b, 0x20, 0x7d, 0x0a]),
    );
    const marked = await s.output('source', {
        layer: 'game',
        file: 'common/scripted_triggers/00_marked.txt',
        line: 1,
    });
    assert.deepEqual(textOf(marked), ['a = { }', 'b = { }', 'c = { }', '']);
    const latin = await s.output('source', {
        layer: 'game',
        file: 'common/scripted_triggers/00_latin1.txt',
        line: 1,
        context: 0,
    });
    assert.deepEqual(textOf(latin), ['caf\ufffd = { }']);
    assert.match(String(latin['encoding']), /not valid UTF-8, read as UTF-8 with replacement/);
    const loc = await s.output('source', {
        layer: 'game',
        file: 'localization/english/stub_l_english.yml',
        line: 2,
        context: 1,
    });
    assert.deepEqual(textOf(loc), ['l_english:', ' stub_key:0 "Stub"', '']);
});

test('only a place a result could name: no .., no absolute path, no backslash, no file the index does not read', async (t) => {
    const { s, dir } = await setup(t);
    write(path.join(dir, 'secret.txt'), 'outside = yes\n');
    const refused: [Record<string, unknown>, RegExp][] = [
        [{ layer: 'game', file: '../../secret.txt' }, /may hold no empty, \. or \.\. part/],
        [
            { layer: 'game', file: 'common/../common/scripted_effects/00_stub_effects.txt' },
            /may hold no empty, \. or \.\. part/,
        ],
        [{ layer: 'game', file: './common/x.txt' }, /may hold no empty, \. or \.\. part/],
        [{ layer: 'game', file: 'common//x.txt' }, /may hold no empty, \. or \.\. part/],
        [{ layer: 'mod', file: '../secret.txt' }, /may hold no empty, \. or \.\. part/],
        [{ layer: 'game', file: path.join(dir, 'secret.txt') }, /an absolute path is not a place/],
        [{ layer: 'game', file: '/etc/hostname' }, /an absolute path is not a place/],
        [{ layer: 'game', file: 'C:/Windows/win.ini' }, /an absolute path is not a place/],
        [
            { layer: 'game', file: 'common\\scripted_effects\\00_stub_effects.txt' },
            /written with \\; give it as a result names it, with \//,
        ],
        [
            { layer: 'mod', file: 'descriptor.mod' },
            /the layer mod has no file descriptor\.mod that pychivalry reads/,
        ],
        [
            { layer: 'game', file: 'launcher/launcher-settings.json' },
            /the layer game has no file launcher\/launcher-settings\.json that pychivalry reads/,
        ],
        [
            { layer: 'game', file: 'common/scripted_effects/00_STUB_effects.txt' },
            /has no file common\/scripted_effects\/00_STUB_effects\.txt; it has common\/scripted_effects\/00_stub_effects\.txt/,
        ],
        [
            { layer: 'jomini', file: 'common/x.txt' },
            /layer: jomini is not a layer read here; the layers are mod, game/,
        ],
    ];
    for (const [args, expected] of refused) {
        const text = await s.error('source', { ...args, line: 1 });
        assert.match(text, /^(file|layer): /, JSON.stringify(args));
        assert.match(text, expected, JSON.stringify(args));
    }
});

test(
    'a link is never followed: one in the mod is not listed, a game file turned into a link or led outside is refused',
    { skip: process.platform === 'win32' ? 'links need a privilege on Windows' : false },
    async (t) => {
        const { s, dir, mod, game } = await setup(t);
        const outside = path.join(dir, 'outside');
        write(
            path.join(outside, 'common', 'scripted_effects', '00_stub_effects.txt'),
            'leak = yes\n',
        );
        write(path.join(outside, 'leak.txt'), 'leak = yes\n');
        // In the mod: a link to a file outside, and a folder linked outside. Neither is listed.
        symlinkSync(
            path.join(outside, 'leak.txt'),
            path.join(mod, 'common', 'scripted_effects', 'linked.txt'),
        );
        symlinkSync(path.join(outside, 'common'), path.join(mod, 'common', 'scripted_triggers'));
        for (const file of [
            'common/scripted_effects/linked.txt',
            'common/scripted_triggers/scripted_effects/00_stub_effects.txt',
        ]) {
            assert.match(
                await s.error('source', { layer: 'mod', file, line: 1 }),
                /the layer mod has no file .* that pychivalry reads/,
            );
        }
        // The base game was listed when the index was opened; a file of it that is a link now is
        // refused, and so is one whose folder now leads outside the game.
        const listed = path.join(game, ...EFFECTS.split('/'));
        assert.equal(
            (await s.output('source', { layer: 'game', file: EFFECTS, line: 1, context: 0 }))[
                'line_count'
            ],
            101,
        );
        renameSync(listed, `${listed}.moved`);
        symlinkSync(path.join(outside, 'leak.txt'), listed);
        assert.match(
            await s.error('source', { layer: 'game', file: EFFECTS, line: 1 }),
            /file: common\/scripted_effects\/00_stub_effects\.txt is a link; source reads no link/,
        );
        rmSync(listed);
        const folder = path.join(game, 'common', 'scripted_effects');
        renameSync(folder, `${folder}.moved`);
        symlinkSync(path.join(outside, 'common', 'scripted_effects'), folder);
        assert.match(
            await s.error('source', { layer: 'game', file: EFFECTS, line: 1 }),
            /leads outside the folder of the layer game; source reads nothing outside it/,
        );
    },
);

test('a file gone since the index read it, and a server without the base game', async (t) => {
    const { s, game, dir } = await setup(t);
    // The base game is listed when its index is opened, at the first call.
    await s.output('source', { layer: 'game', file: EFFECTS, line: 1, context: 0 });
    rmSync(path.join(game, ...EFFECTS.split('/')));
    assert.match(
        await s.error('source', { layer: 'game', file: EFFECTS, line: 1 }),
        /file: common\/scripted_effects\/00_stub_effects\.txt can no longer be read: it was removed or moved/,
    );
    const mod = path.join(dir, 'alone');
    write(path.join(mod, 'descriptor.mod'), 'name = "Alone"\n');
    write(path.join(mod, 'events', 'e.txt'), 'namespace = alone\n');
    mkdirSync(path.join(dir, 'cache2'));
    const alone = await connect(t, ['--mod', mod, '--no-vanilla'], path.join(dir, 'cache2'));
    assert.match(
        await alone.error('source', { layer: 'game', file: EFFECTS, line: 1 }),
        /layer: game is not a layer read here: the base game is not read, so the only layer is mod/,
    );
    const own = await alone.output('source', { layer: 'mod', file: 'events/e.txt', line: 1 });
    assert.deepEqual(textOf(own), ['namespace = alone', '']);
});
