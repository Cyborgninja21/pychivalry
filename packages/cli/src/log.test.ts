/**
 * `log` (log.ts, docs/PLAN.md item 11.6): the hand-made logs of `fixtures/logs/hand-made/` over
 * the planted-defect mod and its game stub, as text and as JSON (the core's report as it is); a
 * log folder, and the error log of a log folder found in a stand-in home; the line prefix and the
 * place format; `--catalogue`; exit codes. No test reads a real log folder: the home folder is
 * the test's own.
 */

import assert from 'node:assert/strict';
import { analyzeLog, catalogueCoverage, logShape, openSpec, openWorkspace } from '@pychivalry/core';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { defaultSpecDir } from './io.js';
import { REPO_ROOT, runCli, scratch } from './testing.js';

const HAND_MADE = path.join(REPO_ROOT, 'fixtures', 'logs', 'hand-made');
const PLANTED = path.join(HAND_MADE, 'planted-defects.log');
const MOD = path.join(REPO_ROOT, 'fixtures', 'defects', 'mod');
const GAME = path.join(REPO_ROOT, 'fixtures', 'game', 'planted-defects', 'game');
const OVER = ['--mod', MOD, '--vanilla', GAME];
const spec = openSpec(defaultSpecDir());

test("log --json: the core's report as it is, with the log read", (t) => {
    const r = runCli(['log', PLANTED, ...OVER, '--json'], { cache: scratch(t) });
    assert.equal(r.code, 1, r.stderr);
    const out = JSON.parse(r.stdout) as Record<string, unknown>;
    const workspace = openWorkspace({ spec, modDir: MOD, gameDir: GAME, cacheDir: null });
    const core = analyzeLog({ spec, index: workspace.index, log: readFileSync(PLANTED) });
    assert.deepEqual(out, JSON.parse(JSON.stringify({ log: PLANTED, ...core })));
});

test('log as text: the totals, each message with its lines and places, the unmatched lines', (t) => {
    const r = runCli(['log', PLANTED, ...OVER], { cache: scratch(t) });
    assert.equal(r.code, 1, r.stderr);
    const lines = r.stdout.split('\n');
    assert.equal(
        lines[0],
        `${PLANTED}: 18 lines, 17 messages (1 ambiguous), 0 unmatched; tied to the mod 14, to the base game only 1, not tied 2`,
    );
    assert.equal(lines[1], 'spec 1.21.0.3; line prefix: none given; place format: none given');
    const at = lines.indexOf(
        "unknown_trigger_X (trigger; names/unknown-trigger): Unknown trigger '<value>' (1 line)",
    );
    assert.ok(at > 0, r.stdout);
    assert.deepEqual(lines.slice(at + 1, at + 3), [
        '  line 1: "is_imprisonned"',
        '    use of is_imprisonned: mod events/harvest_events.txt:11:3',
    ]);
    assert.ok(
        lines.includes(
            '    file: mod common/culture/traditions/harvest_traditions.txt (line not known)',
        ),
    );
    assert.ok(
        lines.includes(
            '    file: game common/culture/traditions/00_traditions.txt (line not known)',
        ),
    );
    const unmatched = runCli(['log', path.join(HAND_MADE, 'unmatched.log'), '--no-vanilla'], {
        cache: scratch(t),
    });
    assert.equal(unmatched.code, 0, unmatched.stderr);
    assert.ok(unmatched.stdout.includes('\nunmatched 3:\n  line 1: ERROR: harvest\n'));
});

test('a log folder is read for its error.log; with no log given, the first log folder found', (t) => {
    const home = scratch(t);
    const logs = path.join(
        home,
        '.local',
        'share',
        'Paradox Interactive',
        'Crusader Kings III',
        'logs',
    );
    mkdirSync(logs, { recursive: true });
    const none = runCli(['log', '--no-vanilla'], { cache: home, env: { XDG_DATA_HOME: '' } });
    if (process.platform === 'linux') {
        assert.equal(none.code, 2);
        assert.match(none.stderr, /no error\.log found: give a log file or folder; looked in /);
        copyFileSync(PLANTED, path.join(logs, 'error.log'));
        const found = runCli(['log', '--no-vanilla', '--json'], {
            cache: home,
            env: { XDG_DATA_HOME: '' },
        });
        assert.equal(found.code, 0, found.stderr);
        assert.equal(
            (JSON.parse(found.stdout) as { log: string }).log,
            path.join(logs, 'error.log'),
        );
    }
    copyFileSync(PLANTED, path.join(home, 'error.log'));
    const folder = runCli(['log', home, '--no-vanilla', '--json'], { cache: scratch(t) });
    assert.equal(folder.code, 0, folder.stderr);
    assert.equal((JSON.parse(folder.stdout) as { log: string }).log, path.join(home, 'error.log'));
});

test('--prefix and --location give the line shape; one that cannot be used is bad usage', (t) => {
    const stand = path.join(HAND_MADE, 'planted-defects-stand-in-prefix.log');
    const prefix = '^hand-made line \\d+ \\| ';
    const r = runCli(['log', stand, ...OVER, '--prefix', prefix, '--json'], { cache: scratch(t) });
    assert.equal(r.code, 1, r.stderr);
    const workspace = openWorkspace({ spec, modDir: MOD, gameDir: GAME, cacheDir: null });
    const core = analyzeLog({
        spec,
        index: workspace.index,
        log: readFileSync(stand),
        shape: logShape({ prefix }),
    });
    assert.deepEqual(JSON.parse(r.stdout), JSON.parse(JSON.stringify({ log: stand, ...core })));
    const bad = runCli(['log', stand, '--no-vanilla', '--prefix', '('], { cache: scratch(t) });
    assert.equal(bad.code, 2);
    assert.match(bad.stderr, /the line prefix: not a regular expression/);
    const noFile = runCli(['log', stand, '--no-vanilla', '--location', '(?<path>.+)'], {
        cache: scratch(t),
    });
    assert.equal(noFile.code, 2);
    assert.match(noFile.stderr, /must name the group file/);
    const missing = runCli(['log', path.join(HAND_MADE, 'no-such.log'), '--no-vanilla'], {
        cache: scratch(t),
    });
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /no such log/);
});

test('--catalogue: what the matcher makes of the catalogue, as text and as JSON', (t) => {
    const json = runCli(['log', '--catalogue', '--json'], { cache: scratch(t) });
    assert.equal(json.code, 0, json.stderr);
    assert.deepEqual(JSON.parse(json.stdout), JSON.parse(JSON.stringify(catalogueCoverage(spec))));
    const text = runCli(['log', '--catalogue'], { cache: scratch(t) });
    assert.equal(text.code, 0, text.stderr);
    const lines = text.stdout.split('\n');
    assert.equal(lines[0], 'the catalogue of spec 1.21.0.3: 2,671 messages');
    assert.match(lines[1] ?? '', /^ {2}matched against log lines: 2,108 \(/);
    assert.ok(lines.includes('  unknown_gfx_culture_flag_X | unknown_gfx_culture_flag_X_2'));
    const withLog = runCli(['log', PLANTED, '--catalogue'], { cache: scratch(t) });
    assert.equal(withLog.code, 2);
});
