/**
 * `check` (check.ts): every exit code, the JSON lines and their fields, the summary, the
 * filters, the game found in a Steam library, silence without a game, and the notes on
 * standard error. On the fixture mods; every game here is a stand-in in a temporary folder.
 */

import assert from 'node:assert/strict';
import { checkWorkspace, findGameFolders, openSpec } from '@pychivalry/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { findingJson } from './check.js';
import { defaultSpecDir } from './io.js';
import { gameStub, REPO_ROOT, runCli, scratch, spawnCli, write, type Result } from './testing.js';

const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');
const BAD = path.join(MODS, 'names-unknown-trigger-bad');
const GOOD = path.join(MODS, 'names-unknown-trigger-good');
const SYNTAX = path.join(MODS, 'parse-broken-syntax');

interface Setup {
    readonly dir: string;
    readonly cache: string;
    readonly game: string;
    readonly check: (...argv: string[]) => Result;
}

/** A scratch folder, its cache folder, an empty stand-in game, and `check` run against it. */
function setup(t: TestContext): Setup {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const game = gameStub(path.join(dir, 'install'));
    return {
        dir,
        cache,
        game,
        check: (...argv) => runCli(['check', ...argv, '--vanilla', game], { cache }),
    };
}

function jsonLines(stdout: string): Record<string, unknown>[] {
    const lines = stdout.split('\n');
    assert.equal(lines.pop(), '', 'the output ends with a new line');
    return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

test('exit code 0 when no error is found, 1 when one is', (t) => {
    const { check } = setup(t);
    const good = check(GOOD);
    assert.equal(good.code, 0, good.stderr);
    assert.equal(good.stdout, '2 files checked: 0 errors, 0 warnings, 0 other\n');
    const bad = check(BAD);
    assert.equal(bad.code, 1, bad.stderr);
    assert.match(
        bad.stdout,
        /^common\/scripted_triggers\/fixture_triggers\.txt\n {2}16:2 {2}error {2}names\/unknown-trigger {2}Unknown trigger 'fixture_made_up_trigger'\n/,
    );
    assert.match(bad.stdout, /\n2 files checked: 5 errors, 0 warnings, 0 other\n$/);
});

test('exit code 2 on bad usage, a mod that is not a folder, or a game or spec that cannot be used', (t) => {
    const { dir, cache, game, check } = setup(t);
    const cli = (...argv: string[]): Result => runCli(argv, { cache });
    const usage: Result[] = [
        cli(),
        cli('lint', BAD),
        cli('check'),
        cli('check', BAD, GOOD, '--no-vanilla'),
        cli('check', BAD, '--no-vanilla', '--unknown'),
        cli('check', BAD, '--no-vanilla', '--json=yes'),
        cli('check', BAD, '--vanilla'),
        cli('check', BAD, '--vanilla', game, '--no-vanilla'),
        cli('check', BAD, '--vanilla', game, '--vanilla', game),
        check(BAD, '--severity', 'fatal'),
        check(BAD, '--code', 'names/no-such-check'),
        check(BAD, '--code', 'nope/*'),
        check(BAD, '--limit', '-1'),
        check(BAD, '--limit', 'ten'),
    ];
    for (const r of usage) {
        assert.equal(r.code, 2, r.stderr);
        assert.equal(r.stdout, '');
        assert.match(r.stderr, /usage: pychivalry/);
    }
    const file = path.join(dir, 'a-file.txt');
    writeFileSync(file, 'x = y\n');
    const notGame = path.join(dir, 'not-a-game');
    mkdirSync(notGame);
    const badSpec = path.join(dir, 'spec');
    write(path.join(badSpec, 'ck3-spec-1.21.0.3.json.gz'), 'not gzip');
    write(
        path.join(badSpec, 'ck3-spec-1.21.0.3.sha256'),
        `${'0'.repeat(64)}  ck3-spec-1.21.0.3.json\n`,
    );
    const input: [Result, RegExp][] = [
        [check(path.join(dir, 'missing')), /not a folder/],
        [check(file), /not a folder/],
        [cli('check', BAD, '--vanilla', notGame), /is not a game folder/],
        [cli('check', BAD, '--vanilla', path.dirname(game)), /is the install; its game folder is/],
        [check(BAD, '--spec', path.join(dir, 'none.json.gz')), /no such file/],
        [check(BAD, '--spec', file), /spec package cannot be read|not a spec package file/],
        [check(BAD, '--spec', badSpec), /the spec package cannot be read/],
    ];
    for (const [r, message] of input) {
        assert.equal(r.code, 2, r.stderr);
        assert.equal(r.stdout, '');
        assert.match(r.stderr, message);
        assert.doesNotMatch(r.stderr, /usage:/);
    }
});

test('the exit codes of the command run as its own process', (t) => {
    const { cache, game } = setup(t);
    assert.equal(spawnCli(['check', GOOD, '--vanilla', game], cache).code, 0);
    const bad = spawnCli(['check', BAD, '--vanilla', game], cache);
    assert.equal(bad.code, 1, bad.stderr);
    assert.match(bad.stdout, /2 files checked: 5 errors/);
    assert.equal(spawnCli(['check', '--no-vanilla'], cache).code, 2);
    assert.equal(spawnCli(['--version'], cache).stdout, 'pychivalry 0.0.0\n');
});

test("JSON: one finding per line with 2.3.0's six fields and the new ones, then the summary", (t) => {
    const { check } = setup(t);
    const r = check(BAD, '--json');
    assert.equal(r.code, 1);
    assert.equal(r.stderr, '');
    const lines = jsonLines(r.stdout);
    const summary = lines.pop();
    assert.equal(lines.length, 5);
    for (const line of lines) {
        assert.deepEqual(Object.keys(line), [
            'file',
            'range',
            'severity',
            'code',
            'message',
            'source',
            'evidence',
            'fix',
            'data',
        ]);
        assert.equal(typeof line['file'], 'string');
        assert.equal(line['source'], 'engine');
        assert.equal(line['fix'], null);
        assert.equal(line['code'], 'names/unknown-trigger');
        assert.deepEqual(line['evidence'], {
            kind: 'catalogue',
            id: 'unknown_trigger_X',
            text: "Unknown trigger '%s'",
        });
    }
    assert.deepEqual(lines[0], {
        file: 'common/scripted_triggers/fixture_triggers.txt',
        range: { start: { line: 15, character: 1 }, end: { line: 15, character: 24 } },
        severity: 'error',
        code: 'names/unknown-trigger',
        message: "Unknown trigger 'fixture_made_up_trigger'",
        source: 'engine',
        evidence: { kind: 'catalogue', id: 'unknown_trigger_X', text: "Unknown trigger '%s'" },
        fix: null,
        data: { name: 'fixture_made_up_trigger' },
    });
    const spec = openSpec(defaultSpecDir());
    const s = summary?.['summary'] as Record<string, unknown>;
    assert.deepEqual(Object.keys(summary ?? {}), ['summary']);
    assert.equal(s['tool'], 'pychivalry');
    assert.equal(s['version'], '0.0.0');
    assert.deepEqual(s['spec'], { version: spec.version, sha256: spec.sha256 });
    const game = s['game'] as Record<string, unknown>;
    assert.equal(game['build'], '1.21.0.3');
    assert.equal(game['found_by'], 'vanilla');
    assert.equal(s['files_checked'], 2);
    assert.deepEqual(s['files_not_checked'], { total: 0, by_folder: {} });
    assert.deepEqual(s['counts'], {
        by_severity: { error: 5, warning: 0, information: 0, hint: 0 },
        by_code: { 'names/unknown-trigger': 5 },
    });
    assert.equal(s['matched'], 5);
    assert.equal(s['shown'], 5);
});

test("the command line's findings are the core's", (t) => {
    const { game, check } = setup(t);
    const spec = openSpec(defaultSpecDir());
    for (const mod of [BAD, SYNTAX, path.join(MODS, 'names-unknown-modifier-bad')]) {
        const lines = jsonLines(check(mod, '--json').stdout);
        lines.pop();
        const core = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null });
        assert.deepEqual(
            lines,
            core.findings.map((f) => JSON.parse(JSON.stringify(findingJson(f))) as unknown),
        );
    }
});

test('--severity and --code keep the findings they match and set the exit code; --limit shortens the list', (t) => {
    const { check } = setup(t);
    const codes = (r: Result): string[] => {
        const lines = jsonLines(r.stdout);
        lines.pop();
        return lines.map((l) => `${String(l['severity'])} ${String(l['code'])}`);
    };
    const all = codes(check(SYNTAX, '--json'));
    assert.ok(all.includes('error syntax/missing-closing-brace'));
    assert.ok(all.includes('information syntax/unterminated-string'));
    const info = check(SYNTAX, '--json', '--severity', 'information');
    assert.equal(info.code, 0, 'no error is kept');
    assert.deepEqual(
        codes(info),
        all.filter((c) => c.startsWith('information ')),
    );
    const both = check(SYNTAX, '--json', '--severity', 'error,information');
    assert.deepEqual(codes(both), all);
    assert.deepEqual(
        codes(check(SYNTAX, '--json', '--severity', 'error', '--severity', 'information')),
        all,
    );
    assert.deepEqual(
        codes(check(SYNTAX, '--json', '--code', 'syntax/*')),
        all.filter((c) => c.includes(' syntax/')),
    );
    const one = check(SYNTAX, '--json', '--code', 'syntax/unterminated-string');
    assert.deepEqual(codes(one), ['information syntax/unterminated-string']);
    assert.equal(one.code, 0);
    const names = check(BAD, '--code', 'names/unknown-effect');
    assert.equal(names.code, 0, 'no finding of that code');
    assert.equal(names.stdout, '2 files checked: 5 errors, 0 warnings, 0 other (0 shown)\n');
    const limited = check(BAD, '--limit', '2');
    assert.equal(limited.code, 1, 'the limit does not change the exit code');
    assert.equal(limited.stdout.split('\n').filter((l) => l.startsWith('  ')).length, 2);
    assert.match(limited.stdout, /\n2 files checked: 5 errors, 0 warnings, 0 other \(2 shown\)\n$/);
    const zero = jsonLines(check(BAD, '--json', '--limit', '0').stdout);
    assert.equal(zero.length, 1);
    const s = zero[0]?.['summary'] as Record<string, unknown>;
    assert.equal(s['matched'], 5);
    assert.equal(s['shown'], 0);
});

test('without the game no name the game might define is reported, and a note says why', (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const notFound = runCli(['check', BAD], { cache });
    assert.equal(notFound.code, 0);
    assert.equal(notFound.stdout, '2 files checked: 0 errors, 0 warnings, 0 other\n');
    assert.match(
        notFound.stderr,
        /the game was not found in any Steam library and --vanilla was not given: names the game defines are not judged/,
    );
    const asked = runCli(['check', BAD, '--no-vanilla'], { cache });
    assert.equal(asked.stdout, notFound.stdout);
    assert.equal(asked.stderr, '');
    const syntax = runCli(['check', SYNTAX, '--no-vanilla'], { cache });
    assert.equal(syntax.code, 1, 'a parse error does not depend on the game');
    assert.match(syntax.stdout, /syntax\/missing-closing-brace/);
    const json = jsonLines(runCli(['check', BAD, '--no-vanilla', '--json'], { cache }).stdout);
    assert.equal((json[0]?.['summary'] as Record<string, unknown>)['game'], null);
});

test('the game is found in a Steam library when --vanilla is not given', (t) => {
    const dir = scratch(t);
    const home = path.join(dir, 'home');
    const steam =
        process.platform === 'win32'
            ? path.join(dir, 'Programs', 'Steam')
            : path.join(home, '.local', 'share', 'Steam');
    const library = path.join(dir, 'disk', 'SteamLibrary');
    const vdf = `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${steam.replaceAll('\\', '\\\\')}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${library.replaceAll('\\', '\\\\')}"\n\t}\n}\n`;
    write(path.join(steam, 'steamapps', 'libraryfolders.vdf'), vdf);
    const game = gameStub(path.join(library, 'steamapps', 'common', 'Crusader Kings III'));
    const r = runCli(['check', BAD, '--json'], {
        cache: path.join(dir, 'cache'),
        findGame: (id) =>
            findGameFolders(id, {
                platform: process.platform,
                home,
                env: { 'ProgramFiles(x86)': path.join(dir, 'Programs') },
                registry: () => [],
            })[0] ?? null,
    });
    assert.equal(r.code, 1, r.stderr);
    const lines = jsonLines(r.stdout);
    const s = lines.pop()?.['summary'] as Record<string, unknown>;
    const found = s['game'] as Record<string, unknown>;
    assert.equal(found['found_by'], 'steam');
    assert.equal(found['dir'], game);
    assert.equal(lines.length, 5);
});

test('notes: a game of another build, and files in folders the game does not read', (t) => {
    const dir = scratch(t);
    const cache = path.join(dir, 'cache');
    const game = gameStub(path.join(dir, 'install'), {}, '1.20.0.2');
    const mod = path.join(dir, 'mod');
    write(path.join(mod, 'events', 'a.txt'), 'namespace = a\n');
    write(path.join(mod, 'event', 'b.txt'), 'namespace = b\n');
    write(path.join(mod, 'event', 'c.txt'), 'namespace = c\n');
    const r = runCli(['check', mod, '--vanilla', game], { cache });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, '1 files checked: 0 errors, 0 warnings, 0 other\n');
    assert.match(r.stderr, /the game is build 1\.20\.0\.2; the spec package is for 1\.21\.0\.3/);
    assert.match(
        r.stderr,
        /2 files in folders the game does not read as script were not checked: event \(2\)/,
    );
    const json = jsonLines(runCli(['check', mod, '--vanilla', game, '--json'], { cache }).stdout);
    const s = json[0]?.['summary'] as Record<string, unknown>;
    assert.deepEqual(s['files_not_checked'], { total: 2, by_folder: { event: 2 } });
    assert.equal((s['game'] as Record<string, unknown>)['build'], '1.20.0.2');
});

test('--spec takes the package file or its folder', (t) => {
    const { check } = setup(t);
    const spec = openSpec(defaultSpecDir());
    const file = path.join(defaultSpecDir(), `ck3-spec-${spec.version}.json.gz`);
    for (const given of [file, defaultSpecDir()]) {
        const r = check(BAD, '--spec', given);
        assert.equal(r.code, 1, r.stderr);
        assert.match(r.stdout, /5 errors/);
    }
});

test('help and version', (t) => {
    const cache = scratch(t);
    const help = runCli(['--help'], { cache });
    assert.equal(help.code, 0);
    assert.match(help.stdout, /^usage: pychivalry <command>/);
    assert.match(help.stdout, /\n {2}check <mod> {2,}Check a mod/);
    assert.match(help.stdout, /\n {2}explain <code>\.\.\. {2}What a finding's code means/);
    const checkHelp = runCli(['check', '--help'], { cache });
    assert.equal(checkHelp.code, 0);
    for (const option of [
        '--vanilla <game>',
        '--no-vanilla',
        '--spec <file>',
        '--json',
        '--severity',
        '--code',
        '--limit <n>',
    ]) {
        assert.ok(checkHelp.stdout.includes(option), option);
    }
    assert.equal(runCli(['--version'], { cache }).stdout, 'pychivalry 0.0.0\n');
});
