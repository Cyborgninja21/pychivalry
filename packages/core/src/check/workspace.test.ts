/**
 * The workspace runner (workspace.ts): every check over a mod, over a base game. On the
 * fixture mods it reports exactly what the parser's and the checks' own fixtures expect; it
 * checks only the files the index reads and counts the others; a name the game defines is
 * known; without a game no name the game might define is reported; and the second run takes
 * the base game from the cache.
 */

import assert from 'node:assert/strict';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { syncMod } from '../index/read-game.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { CHECK_KINDS, isAdvice, type CheckCode } from './finding.js';
import { checkFixture, expectedFindings, isStyle, PAIR_GAMES } from './testing.js';
import {
    checkWorkspace,
    GAME_NOT_LOADED,
    openWorkspace,
    type WorkspaceFinding,
} from './workspace.js';

const spec = committedSpec();
const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-workspace-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

function write(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** A game install with the given script files, its build stated by its launcher. */
function gameStub(root: string, files: Readonly<Record<string, string>> = {}): string {
    write(
        path.join(root, 'launcher', 'launcher-settings.json'),
        `${JSON.stringify({ gameId: 'ck3', rawVersion: spec.version, dlcPath: '../game' })}\n`,
    );
    const game = path.join(root, 'game');
    mkdirSync(path.join(game, 'common'), { recursive: true });
    for (const [rel, text] of Object.entries(files)) {
        write(path.join(game, ...rel.split('/')), text);
    }
    return game;
}

function written(findings: readonly WorkspaceFinding[]): Record<string, unknown>[] {
    return findings.map((f) => ({
        file: f.file,
        line: f.range.start.line + 1,
        column: f.range.start.character + 1,
        code: f.code,
        severity: f.severity,
        message: f.message,
        data: f.data,
    }));
}

const isParse = (f: WorkspaceFinding): boolean => /^(syntax|encoding)\//.test(f.code);

/**
 * What a finding rests on, for the pair tests: the game's evidence, item 4.7's advice, or a
 * best-practice rule of the family `style`.
 */
function classOf(code: string): 'evidence' | 'advice' | 'style' {
    if (isStyle(code)) {
        return 'style';
    }
    return code in CHECK_KINDS && isAdvice(code as CheckCode) ? 'advice' : 'evidence';
}

/** The code a check pair is named for: the code with its `/` written as `-`. */
function codeOfPair(pair: string): string | undefined {
    const name = pair.replace(/-(bad|good)$/, '');
    return Object.keys(CHECK_KINDS).find((code) => code.replace('/', '-') === name);
}

test("on each check's fixture pair the runner reports what every check reports, and what the pair expects", (t) => {
    const game = gameStub(scratch(t));
    // Every check pair: a bad mod whose expected.json lists findings (the parse mods list files).
    const pairs = readdirSync(MODS).filter(
        (m) =>
            m.endsWith('-bad') &&
            existsSync(path.join(MODS, m, 'expected.json')) &&
            'findings' in
                (JSON.parse(readFileSync(path.join(MODS, m, 'expected.json'), 'utf8')) as object),
    );
    assert.ok(pairs.includes('definitions-clash-bad'));
    assert.ok(pairs.includes('structure-event-without-desc-bad'));
    assert.ok(pairs.length >= 6);
    // The fixtures' expected findings are Linux's, as `checkFixture` reads them: a folder in
    // another letter case is a file the game does not read there (definitions-not-read-bad).
    for (const bad of pairs) {
        const code = codeOfPair(bad);
        assert.ok(code !== undefined, `${bad} is named for a code`);
        // A pair lists the findings of its own check and of every check with the game's
        // evidence; the advice checks of item 4.7 and the best-practice rules of the family
        // `style` are each tested on their own pairs, so a pair of another kind leaves them out,
        // as its own test does (#133).
        const keep = (f: Record<string, unknown>): boolean => {
            const kind = classOf(String(f['code']));
            return kind === 'evidence' || kind === classOf(code);
        };
        // A pair whose checks need a base game is read over its game stub (item 4.6); every
        // check runs as the runner runs it by default.
        const stub = PAIR_GAMES[bad.replace(/-bad$/, '')];
        for (const [mod, expected] of [
            [bad, expectedFindings(bad)],
            [bad.replace(/-bad$/, '-good'), []],
        ] as const) {
            const run = checkWorkspace({
                spec,
                modDir: path.join(MODS, mod),
                gameDir:
                    stub === undefined
                        ? game
                        : path.join(REPO_ROOT, 'fixtures', 'game', stub, 'game'),
                cacheDir: null,
                platform: 'linux',
            });
            const found = written(run.findings);
            assert.deepEqual(
                found,
                checkFixture(
                    mod,
                    stub === undefined ? { style: true } : { game: stub, style: true },
                ),
                `${mod}: the runner is every check`,
            );
            assert.deepEqual(found.filter(keep), expected, `${mod}: what the pair expects`);
        }
    }
});

test("on each parse fixture the runner reports the parser's findings", (t) => {
    const game = gameStub(scratch(t));
    for (const mod of readdirSync(MODS).filter((m) => m.startsWith('parse-'))) {
        const expected = JSON.parse(
            readFileSync(path.join(MODS, mod, 'expected.json'), 'utf8'),
        ) as {
            files: Record<
                string,
                { findings?: { id: string; line: number; column: number; message: string }[] }
            >;
        };
        const run = checkWorkspace({
            spec,
            modDir: path.join(MODS, mod),
            gameDir: game,
            cacheDir: null,
        });
        const want = Object.entries(expected.files).flatMap(([file, e]) =>
            (e.findings ?? []).map((f) => [file, f.id, f.line, f.column, f.message]),
        );
        const got = run.findings
            .filter(isParse)
            .map((f) => [
                f.file,
                f.code,
                f.range.start.line + 1,
                f.range.start.character + 1,
                f.message,
            ]);
        assert.deepEqual(got, want, mod);
    }
});

test('only the files the index reads are checked; the others are counted by folder', (t) => {
    const mod = scratch(t);
    write(path.join(mod, 'descriptor.mod'), 'name = "fixture"\n');
    write(path.join(mod, 'events', 'b.txt'), 'namespace = b\n');
    write(path.join(mod, 'events', 'a.txt'), 'namespace = a\n}\n');
    write(path.join(mod, 'notes', 'c.txt'), '} not script at all {\n');
    write(path.join(mod, 'notes', 'd.yml'), 'l_english:\n');
    write(path.join(mod, 'README.md'), '# not read\n');
    const run = checkWorkspace({ spec, modDir: mod, gameDir: null, cacheDir: null });
    assert.deepEqual(run.files, ['events/a.txt', 'events/b.txt']);
    assert.deepEqual([...run.notChecked], [['notes', 2]]);
    assert.deepEqual(
        run.findings.map((f) => [f.file, f.code, f.range.start.line]),
        [['events/a.txt', 'syntax/unexpected-closing-brace', 1]],
    );
    assert.equal(run.game, null);
    assert.equal(run.gameBuild, null);
});

const MOD_EVENTS = [
    'namespace = fixture',
    'fixture.0001 = {',
    '\ttrigger = {',
    '\t\tfixture_game_trigger = yes',
    '\t\tfixture_made_up_trigger = yes',
    '\t}',
    '}',
    '',
].join('\n');

test('a name the game defines is known; without the game no such name is reported', (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'events', 'fixture_events.txt'), MOD_EVENTS);
    write(path.join(mod, 'events', 'broken.txt'), 'namespace = broken\n}\n');
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/fixture_triggers.txt':
            'fixture_game_trigger = { always = yes }\n',
    });
    // The event has no desc and no option: advice of item 4.7, which is not what this is about.
    const withGame = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null });
    assert.deepEqual(
        withGame.findings
            .filter((f) => classOf(f.code) === 'evidence')
            .map((f) => [f.file, f.code, f.message]),
        [
            [
                'events/broken.txt',
                'syntax/unexpected-closing-brace',
                "Unexpected token, expected 'key = {'",
            ],
            [
                'events/fixture_events.txt',
                'names/unknown-trigger',
                "Unknown trigger 'fixture_made_up_trigger'",
            ],
        ],
    );
    assert.equal(withGame.gameBuild, spec.version);
    const without = checkWorkspace({ spec, modDir: mod, gameDir: null, cacheDir: null });
    assert.deepEqual(
        without.findings.filter((f) => classOf(f.code) === 'evidence').map((f) => [f.file, f.code]),
        [['events/broken.txt', 'syntax/unexpected-closing-brace']],
    );
    assert.equal(GAME_NOT_LOADED.isDefined('anything', 'common/scripted_triggers'), true);
});

test('the second run takes the base game from the cache', (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'events', 'fixture_events.txt'), MOD_EVENTS);
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/fixture_triggers.txt':
            'fixture_game_trigger = { always = yes }\n',
    });
    const cacheDir = path.join(dir, 'cache');
    const first = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir });
    const second = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir });
    assert.ok(first.game !== null && second.game !== null);
    assert.equal(first.game.fromCache, false);
    assert.equal(first.game.miss, 'absent');
    assert.equal(second.game.fromCache, true);
    assert.equal(second.game.ms.build, 0);
    assert.deepEqual(written(second.findings), written(first.findings));
    assert.equal(readdirSync(cacheDir).length, 1);
});

test('a workspace opens with or without a game and with or without a mod', (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'events', 'fixture_events.txt'), MOD_EVENTS);
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/fixture_triggers.txt':
            'fixture_game_trigger = { always = yes }\n',
    });
    const both = openWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null });
    assert.deepEqual(
        both.index.allFiles().map((f) => [f.layer, f.path]),
        [
            ['game', 'common/scripted_triggers/fixture_triggers.txt'],
            ['mod', 'events/fixture_events.txt'],
        ],
    );
    assert.deepEqual(
        both.mod?.files.map((f) => f.path),
        ['events/fixture_events.txt'],
    );
    assert.equal(both.game?.listing.files.length, 1);
    const gameOnly = openWorkspace({ spec, modDir: null, gameDir: game, cacheDir: null });
    assert.equal(gameOnly.mod, null);
    assert.equal(gameOnly.index.allFiles().length, 1);
    const modOnly = openWorkspace({ spec, modDir: mod, gameDir: null, cacheDir: null });
    assert.equal(modOnly.game, null);
    assert.equal(modOnly.index.allFiles().length, 1);
});

test('a workspace kept open and brought up to date gives the findings of a fresh run; only keeps some files', (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'events', 'fixture_events.txt'), MOD_EVENTS);
    write(
        path.join(mod, 'common', 'scripted_triggers', 'fixture_triggers.txt'),
        'fixture_mod_trigger = { made_up = yes }\n',
    );
    const game = gameStub(path.join(dir, 'install'), {
        'common/scripted_triggers/fixture_triggers.txt':
            'fixture_game_trigger = { always = yes }\n',
    });
    const opened = openWorkspace({ spec, modDir: null, gameDir: game, cacheDir: null });
    const fresh = (): WorkspaceFinding[] => [
        ...checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null }).findings,
    ];
    let synced = syncMod(opened.index, mod, null);
    const kept = (only?: (file: string) => boolean): WorkspaceFinding[] => [
        ...checkWorkspace({
            spec,
            modDir: mod,
            gameDir: game,
            cacheDir: null,
            workspace: { ...opened, mod: synced },
            only,
        }).findings,
    ];
    assert.deepEqual(kept(), fresh());
    assert.ok(fresh().length > 0);
    write(path.join(mod, 'events', 'fixture_events.txt'), `${MOD_EVENTS}\n}\n`);
    synced = syncMod(opened.index, mod, synced);
    assert.deepEqual(kept(), fresh(), 'after an edit');
    const events = kept((file) => file.startsWith('events/'));
    assert.deepEqual(
        events,
        fresh().filter((f) => f.file.startsWith('events/')),
    );
    assert.ok(events.length > 0 && events.length < fresh().length);
});

test('a name defined in 1,000 files is checked in seconds, not minutes', (t) => {
    // The index resolved the name once per definition and compared every pair of its
    // definitions each time: 100 files took 0.3 seconds, 300 files 7.5, 1,000 would take
    // minutes. It now resolves a name once (index/workspace.test.ts) and sorts its definitions
    // in n log n comparisons (index/order.test.ts, counted). Here, the whole check, with a bound
    // far above what it takes (about half a second) and far below what the old way took.
    const mod = path.join(scratch(t), 'many');
    write(path.join(mod, 'descriptor.mod'), 'name = "Many"\n');
    for (let i = 0; i < 1000; i++) {
        write(
            path.join(mod, 'common', 'scripted_triggers', `many_${String(i).padStart(4, '0')}.txt`),
            'shared_trigger = { always = yes }\n',
        );
    }
    const started = performance.now();
    const result = checkWorkspace({ spec, modDir: mod, gameDir: null, cacheDir: null });
    const took = performance.now() - started;
    t.diagnostic(`1,000 files: ${took.toFixed(0)} ms`);
    assert.equal(result.files.length, 1000);
    assert.ok(took < 30_000, `${took.toFixed(0)} ms`);
});
