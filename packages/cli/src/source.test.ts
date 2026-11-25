/**
 * `source <layer> <file> <line>` (the owner's decision of 2026-11-25): the text around a place of
 * the base game and of the mod, as text and as JSON, from the core's one reading (`readSource`,
 * which the agent server's `source` calls too); its limits; its refusals, each naming the
 * argument, with exit code 2 for a place no game or mod could hold and 1 for one that is not
 * read here; and nothing indexed: the base game is listed, never loaded or saved to the cache.
 * The same lines as the agent server's are held by the extension's same-answers test
 * (`packages/vscode/src/source-answers.test.ts`).
 */

import assert from 'node:assert/strict';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { gameStub, runCli, scratch, write, type Result } from './testing.js';

const EFFECTS = 'common/scripted_effects/00_stub_effects.txt';
const MOD_EFFECTS = 'common/scripted_effects/my_effects.txt';

/** `count` lines of a script file, line n reading `<prefix>_n = { }`, numbered from 1. */
function numbered(count: number, prefix: string): string[] {
    return Array.from({ length: count }, (_, i) => `${prefix}_${String(i + 1)} = { }`);
}

interface Setup {
    readonly dir: string;
    readonly game: string;
    readonly mod: string;
    readonly cache: string;
    readonly source: (...argv: string[]) => Result;
}

function setup(t: TestContext, extraGame: Record<string, string> = {}): Setup {
    const dir = scratch(t);
    const game = gameStub(path.join(dir, 'install'), {
        [EFFECTS]: `${numbered(100, 'stub').join('\n')}\n`,
        ...extraGame,
    });
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'descriptor.mod'), 'name = "Source"\n');
    write(path.join(mod, ...MOD_EFFECTS.split('/')), `${numbered(30, 'mine').join('\r\n')}\r\n`);
    const cache = path.join(dir, 'cache');
    mkdirSync(cache);
    return {
        dir,
        game,
        mod,
        cache,
        source: (...argv) => runCli(['source', ...argv], { cache, cwd: dir }),
    };
}

/** The JSON a `--json` run printed: one object on one line. */
function jsonOf(r: Result): Record<string, unknown> {
    assert.equal(r.code, 0, r.stderr);
    const lines = r.stdout.trimEnd().split('\n');
    assert.equal(lines.length, 1, 'one line');
    return JSON.parse(lines[0] ?? '') as Record<string, unknown>;
}

function numbersOf(out: Record<string, unknown>): number[] {
    return (out['lines'] as string[]).map((l) => Number(l.slice(0, l.indexOf('\t'))));
}

function textOf(out: Record<string, unknown>): string[] {
    return (out['lines'] as string[]).map((l) => l.slice(l.indexOf('\t') + 1));
}

test('the lines around a place of the base game and of the mod, as text and as JSON', (t) => {
    const { game, mod, cache, source } = setup(t);
    const text = source('game', EFFECTS, '50', '--vanilla', game, '--context', '2');
    assert.equal(text.code, 0, text.stderr);
    assert.equal(
        text.stdout,
        [
            `game ${EFFECTS}, lines 48 to 52 of 101`,
            '48\tstub_48 = { }',
            '49\tstub_49 = { }',
            '50\tstub_50 = { }',
            '51\tstub_51 = { }',
            '52\tstub_52 = { }',
            '',
        ].join('\n'),
    );
    assert.equal(text.stderr, '');
    const json = jsonOf(source('game', EFFECTS, '50', '--vanilla', game, '--json'));
    assert.deepEqual(json, {
        layer: 'game',
        file: EFFECTS,
        line: 40,
        end_line: 60,
        line_count: 101,
        lines: numbered(100, 'stub')
            .slice(39, 60)
            .map((l, i) => `${String(40 + i)}\t${l}`),
        cut_lines: [],
        encoding: 'utf-8',
        notes: [],
    });
    // The mod's lines, its \r\n breaks not part of any line; a place of several lines.
    const mine = jsonOf(
        source(
            'mod',
            MOD_EFFECTS,
            '2',
            '--end-line',
            '3',
            '--context',
            '1',
            '--mod',
            mod,
            '--json',
        ),
    );
    assert.deepEqual(textOf(mine), [
        'mine_1 = { }',
        'mine_2 = { }',
        'mine_3 = { }',
        'mine_4 = { }',
    ]);
    assert.equal(mine['layer'], 'mod');
    // Nothing indexed: the base game was listed, never loaded, built or saved.
    assert.deepEqual(existsSync(cache) ? readdirSync(cache) : [], []);
});

test('the limits: 40 lines at most, a long place cut and said to be, a long line cut and named', (t) => {
    const long = `stub_long = { ${'a '.repeat(2_000)}}`;
    const { game, source } = setup(t, {
        'common/scripted_triggers/00_long.txt': `${Array.from({ length: 40 }, () => long).join('\n')}\n`,
    });
    const wide = jsonOf(
        source(
            'game',
            EFFECTS,
            '40',
            '--end-line',
            '49',
            '--context',
            '20',
            '--vanilla',
            game,
            '--json',
        ),
    );
    assert.equal(numbersOf(wide).length, 40);
    const cut = source('game', EFFECTS, '5', '--end-line', '80', '--vanilla', game);
    assert.equal(cut.code, 0);
    assert.match(
        cut.stderr,
        /pychivalry source: the place is longer than 40 lines: lines 5 to 44 are shown; ask again with line 45 for the rest/,
    );
    const lines = jsonOf(
        source('game', 'common/scripted_triggers/00_long.txt', '20', '--vanilla', game, '--json'),
    );
    for (const line of lines['lines'] as string[]) {
        assert.ok(line.endsWith('…'), 'each line cut');
        assert.ok(line.length <= 400 + 10);
    }
    assert.deepEqual(lines['cut_lines'], numbersOf(lines));
    const past = source('game', EFFECTS, '100', '--end-line', '120', '--vanilla', game, '--json');
    assert.match(
        String((jsonOf(past)['notes'] as string[]).at(0)),
        /the place ends at line 120, past the end of the file, which has 101 lines/,
    );
});

test('a file not valid UTF-8 is read as the index reads it, and says so', (t) => {
    const { game, source } = setup(t);
    writeFileSync(
        path.join(game, 'common', 'scripted_effects', '00_latin1.txt'),
        Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x3d, 0x20, 0x7b, 0x20, 0x7d, 0x0a]),
    );
    const r = source(
        'game',
        'common/scripted_effects/00_latin1.txt',
        '1',
        '--context',
        '0',
        '--vanilla',
        game,
    );
    assert.equal(r.code, 0);
    assert.equal(
        r.stdout,
        'game common/scripted_effects/00_latin1.txt, lines 1 to 1 of 2 (not valid UTF-8, read as UTF-8 with replacement characters)\n1\tcaf\ufffd = { }\n',
    );
});

test('refusals name the argument: 2 for a place no game or mod could hold, 1 for one not read here', (t) => {
    const { dir, game, mod, source } = setup(t);
    write(path.join(dir, 'secret.txt'), 'outside = yes\n');
    const usage: [string[], RegExp][] = [
        [['game', '../secret.txt', '1'], /<file>: the path may hold no empty, \. or \.\. part/],
        [['game', path.join(dir, 'secret.txt'), '1'], /<file>: an absolute path is not a place/],
        [['game', 'C:/Windows/win.ini', '1'], /<file>: an absolute path is not a place/],
        [
            ['game', 'common\\scripted_effects\\00_stub_effects.txt', '1'],
            /<file>: the path is written with \\; give it as a result names it, with \//,
        ],
        [['game', EFFECTS, '0'], /<line>: 0 is not a line number; give a whole number from 1/],
        [['game', EFFECTS, 'first'], /<line>: first is not a whole number/],
        [['game', EFFECTS, '5', '--end-line', '4'], /--end-line: 4 is before line 5/],
        [
            ['game', EFFECTS, '5', '--context', '21'],
            /--context: 21 is not a number of lines from 0 to 20/,
        ],
        [['game', EFFECTS, '5', '--context', '-1'], /--context: -1 is not a whole number/],
    ];
    for (const [argv, expected] of usage) {
        const r = source(...argv, '--vanilla', game, '--mod', mod);
        assert.equal(r.code, 2, `${argv.join(' ')}: ${r.stderr}`);
        assert.equal(r.stdout, '');
        assert.match(r.stderr, expected, argv.join(' '));
    }
    const notRead: [string[], RegExp][] = [
        [
            ['mod', 'descriptor.mod', '1'],
            /<file>: the layer mod has no file descriptor\.mod that pychivalry reads/,
        ],
        [
            ['game', 'launcher/launcher-settings.json', '1'],
            /<file>: the layer game has no file launcher\/launcher-settings\.json that pychivalry reads/,
        ],
        [
            ['game', 'common/scripted_effects/00_STUB_effects.txt', '1'],
            /<file>: the layer game has no file common\/scripted_effects\/00_STUB_effects\.txt; it has common\/scripted_effects\/00_stub_effects\.txt/,
        ],
        [
            ['jomini', 'common/x.txt', '1'],
            /<layer>: jomini is not a layer read here; the layers are mod, game/,
        ],
        [
            ['game', EFFECTS, '102'],
            /<line>: 102 is past the end of common\/scripted_effects\/00_stub_effects\.txt, which has 101 lines/,
        ],
    ];
    for (const [argv, expected] of notRead) {
        const r = source(...argv, '--vanilla', game, '--mod', mod);
        assert.equal(r.code, 1, `${argv.join(' ')}: ${r.stderr}`);
        assert.equal(r.stdout, '');
        assert.match(r.stderr, expected, argv.join(' '));
    }
    // No game, or no mod: the layer is not read, and the command says how to give it.
    const noGame = source('game', EFFECTS, '1', '--no-vanilla', '--mod', mod);
    assert.equal(noGame.code, 1);
    assert.match(
        noGame.stderr,
        /<layer>: game is not a layer read here: the base game is not read, so the only layer is mod/,
    );
    const notFound = runCli(['source', 'game', EFFECTS, '1', '--mod', mod], {
        cache: path.join(dir, 'cache'),
        cwd: dir,
    });
    assert.equal(notFound.code, 1);
    assert.match(notFound.stderr, /give its game folder with --vanilla <game>/);
    const noMod = source('mod', MOD_EFFECTS, '1', '--vanilla', game);
    assert.equal(noMod.code, 1);
    assert.match(
        noMod.stderr,
        /<layer>: mod is not a layer read here: no mod is read; the layers are game/,
    );
    assert.match(noMod.stderr, /the layer mod is read only with --mod <mod>/);
    // Bad usage of the command itself.
    assert.equal(source('game', EFFECTS).code, 2);
    assert.equal(source('game', EFFECTS, '1', '2').code, 2);
    assert.match(
        source('game', EFFECTS, '1', '--mod', path.join(dir, 'nowhere')).stderr,
        /--mod: not a folder/,
    );
});

test(
    'a link is never followed: one in the mod is not listed, a game file that is a link or leads outside is refused',
    { skip: process.platform === 'win32' ? 'links need a privilege on Windows' : false },
    (t) => {
        const { dir, game, mod, source } = setup(t, {
            'common/scripted_triggers/00_other.txt': 'other = { }\n',
        });
        const outside = path.join(dir, 'outside');
        write(path.join(outside, 'leak.txt'), 'leak = yes\n');
        write(
            path.join(outside, 'common', 'scripted_effects', '00_stub_effects.txt'),
            'leak = yes\n',
        );
        symlinkSync(
            path.join(outside, 'leak.txt'),
            path.join(mod, 'common', 'scripted_effects', 'linked.txt'),
        );
        const linked = source(
            'mod',
            'common/scripted_effects/linked.txt',
            '1',
            '--mod',
            mod,
            '--vanilla',
            game,
        );
        assert.equal(linked.code, 1);
        assert.match(linked.stderr, /the layer mod has no file .* that pychivalry reads/);
        // A folder of the game that leads outside it: never listed, as the index would not list it.
        const folder = path.join(game, 'common', 'scripted_effects');
        renameSync(folder, `${folder}.moved`);
        symlinkSync(path.join(outside, 'common', 'scripted_effects'), folder);
        const led = source('game', EFFECTS, '1', '--vanilla', game);
        assert.equal(led.code, 1);
        assert.match(
            led.stderr,
            /the layer game has no file common\/scripted_effects\/00_stub_effects\.txt/,
        );
    },
);
