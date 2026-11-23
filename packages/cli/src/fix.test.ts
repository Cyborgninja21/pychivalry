/**
 * `check --fix` (fix.ts): the safe fixes of the findings kept are applied and the mod checked
 * again; `--dry-run` prints the edits and writes nothing; the filters choose the findings whose
 * fixes are applied; a file that is not valid UTF-8 is left alone; `--dry-run` alone is bad
 * usage.
 */

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { gameStub, REPO_ROOT, runCli, scratch, type Result } from './testing.js';

const BAD = path.join(REPO_ROOT, 'fixtures', 'mods', 'names-unknown-trigger-bad');
const TRIGGERS = path.join('common', 'scripted_triggers', 'fixture_triggers.txt');

function setup(t: TestContext): { mod: string; check: (...argv: string[]) => Result } {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    cpSync(BAD, mod, { recursive: true });
    const game = gameStub(path.join(dir, 'install'));
    const cache = path.join(dir, 'cache');
    return {
        mod,
        check: (...argv) => runCli(['check', mod, ...argv, '--vanilla', game], { cache }),
    };
}

test('--fix --dry-run prints the edits of the safe fixes and writes nothing', (t) => {
    const { mod, check } = setup(t);
    const before = readFileSync(path.join(mod, TRIGGERS), 'utf8');
    const r = check('--fix', '--dry-run');
    assert.equal(r.code, 1, r.stderr);
    assert.equal(
        r.stdout,
        [
            "common/scripted_triggers/fixture_triggers.txt:22:2  names/unknown-trigger  Replace 'has_special_building' with 'has_special_district'",
            '    common/scripted_triggers/fixture_triggers.txt 22:2-22:22 -> "has_special_district"',
            '1 safe fixes in 1 files would be applied (dry run: nothing written)',
            '',
        ].join('\n'),
    );
    assert.equal(readFileSync(path.join(mod, TRIGGERS), 'utf8'), before);
    const json = check('--fix', '--dry-run', '--json');
    const lines = json.stdout
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    const summary = lines.pop()?.['summary'] as Record<string, unknown>;
    assert.deepEqual(summary['fixes'], {
        applied: 1,
        files: ['common/scripted_triggers/fixture_triggers.txt'],
        skipped: 0,
        not_utf8: 0,
        dry_run: true,
    });
    assert.equal(lines.length, 1);
    assert.equal((lines[0]?.['fix'] as Record<string, unknown>)['code'], 'names/unknown-trigger');
});

test('--fix applies the safe fixes, then checks again and reports what is left', (t) => {
    const { mod, check } = setup(t);
    const r = check('--fix');
    assert.equal(r.code, 1, r.stderr);
    assert.match(r.stdout, /\n2 files checked: 4 errors, 0 warnings, 0 other\n$/);
    assert.match(r.stderr, /pychivalry: 1 safe fixes in 1 files applied\n/);
    const text = readFileSync(path.join(mod, TRIGGERS), 'utf8');
    assert.match(text, /\thas_special_district = yes\n/);
    assert.doesNotMatch(text, /has_special_building/);
    // Nothing safe is left: a second run changes nothing.
    const again = check('--fix', '--json');
    const summary = (
        JSON.parse(again.stdout.trim().split('\n').pop() ?? '{}') as {
            summary: { fixes: { applied: number } };
        }
    ).summary;
    assert.equal(summary.fixes.applied, 0);
    assert.equal(readFileSync(path.join(mod, TRIGGERS), 'utf8'), text);
});

test('--fix keeps to the filters, and leaves a file that is not valid UTF-8 as it is', (t) => {
    const { mod, check } = setup(t);
    // A '}' that closes no block (a safe fix) in a file with a byte that is not UTF-8.
    const effects = path.join(mod, 'common', 'scripted_effects', 'fixture_effects.txt');
    const bytes = Buffer.concat([
        Buffer.from('# caf'),
        Buffer.from([0xe9]),
        Buffer.from('\nfixture_effect = {\n\tadd_gold = 1\n}\n}\n'),
    ]);
    mkdirSync(path.dirname(effects), { recursive: true });
    writeFileSync(effects, bytes);
    const r = check('--fix', '--code', 'syntax/*');
    assert.match(
        r.stderr,
        /pychivalry: 0 safe fixes in 0 files applied; 1 in files that are not valid UTF-8 left alone\n/,
    );
    assert.deepEqual(readFileSync(effects), bytes, 'the file that is not UTF-8 is untouched');
    assert.match(
        readFileSync(path.join(mod, TRIGGERS), 'utf8'),
        /has_special_building/,
        'the filters keep the trigger finding, and its fix, out',
    );
});

test('--dry-run without --fix is bad usage', (t) => {
    const { check } = setup(t);
    const r = check('--dry-run');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /--dry-run: only with --fix/);
});
