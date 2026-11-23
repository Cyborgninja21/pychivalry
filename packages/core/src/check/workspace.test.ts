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
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { expectedFindings } from './testing.js';
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

test("on each check's fixture pair the runner reports what the fixture expects", (t) => {
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
    assert.ok(pairs.length >= 6);
    // The fixtures' expected findings are Linux's, as `checkFixture` reads them: a folder in
    // another letter case is a file the game does not read there (definitions-not-read-bad).
    for (const bad of pairs) {
        const run = checkWorkspace({
            spec,
            modDir: path.join(MODS, bad),
            gameDir: game,
            cacheDir: null,
            platform: 'linux',
        });
        assert.deepEqual(written(run.findings), expectedFindings(bad), bad);
        const good = bad.replace(/-bad$/, '-good');
        const clean = checkWorkspace({
            spec,
            modDir: path.join(MODS, good),
            gameDir: game,
            cacheDir: null,
            platform: 'linux',
        });
        assert.deepEqual(written(clean.findings), [], good);
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
    const withGame = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null });
    assert.deepEqual(
        withGame.findings.map((f) => [f.file, f.code, f.message]),
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
        without.findings.map((f) => [f.file, f.code]),
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
