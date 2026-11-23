/**
 * The limits that keep checking usable (docs/PLAN.md item 4.11; docs/MVP.md, "Lessons from
 * 2.3.0"): a cap on findings per file that keeps the most severe and counts what it drops; no
 * unbounded "did you mean" work behind a finding; and silence, not wrong findings, when no game
 * folder is set.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileKindOf } from '../index/workspace.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import type { Severity } from '../syntax/findings.js';
import type { WorkspaceNames } from './names.js';
import {
    capFindings,
    checkWorkspace,
    localizationFindings,
    MAX_FINDINGS_PER_FILE,
    openWorkspace,
    scriptFindings,
    type WorkspaceFinding,
} from './workspace.js';

const spec = committedSpec();
const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-limits-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

function write(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** A finding of the given severity and code at an offset, for the cap's own tests. */
function finding(
    at: number,
    severity: Severity,
    code = 'localization/unused-key',
): WorkspaceFinding {
    return {
        file: 'localization/english/x_l_english.yml',
        layer: 'mod',
        code: code as WorkspaceFinding['code'],
        severity,
        range: { start: { line: at, character: 0 }, end: { line: at, character: 1 } },
        start: at,
        end: at + 1,
        message: `finding ${String(at)}`,
        evidence: { kind: 'advice' },
        data: {},
        fix: null,
    };
}

// ─── The cap on findings per file ─────────────────────────────────────────

test('a file under the cap keeps every finding', () => {
    const findings = [finding(1, 'hint'), finding(2, 'error', 'names/unknown-trigger')];
    const { kept, capped } = capFindings(findings, 2);
    assert.deepEqual(kept, findings);
    assert.equal(capped, null);
});

test('past the cap a file keeps its most severe findings, in place order, and counts the rest', () => {
    // A file full of hints, with an error at its very end and a warning in the middle: the
    // lesson of release 2.3.0 is that the hints must not hide them.
    const hints = Array.from({ length: MAX_FINDINGS_PER_FILE + 500 }, (_, i) =>
        finding(i * 10, 'hint'),
    );
    const warning = finding(5_001, 'warning', 'localization/missing-key');
    const error = finding(1_000_000, 'error', 'localization/unbalanced-brackets');
    const { kept, capped } = capFindings([...hints, warning, error], MAX_FINDINGS_PER_FILE);
    assert.equal(kept.length, MAX_FINDINGS_PER_FILE);
    assert.ok(kept.includes(error), 'the error is kept');
    assert.ok(kept.includes(warning), 'the warning is kept');
    assert.deepEqual(
        kept.map((f) => f.start),
        [...kept].sort((a, b) => a.start - b.start).map((f) => f.start),
        'kept in the order of where each starts',
    );
    // The hints kept are the first ones: by position within a severity.
    assert.deepEqual(
        kept.filter((f) => f.severity === 'hint').map((f) => f.start),
        hints.slice(0, MAX_FINDINGS_PER_FILE - 2).map((f) => f.start),
    );
    assert.ok(capped !== null);
    assert.equal(capped.found, MAX_FINDINGS_PER_FILE + 502);
    assert.equal(capped.dropped, 502);
    assert.deepEqual(capped.droppedBySeverity, { error: 0, warning: 0, information: 0, hint: 502 });
    assert.deepEqual(capped.droppedByCode, [
        { code: 'localization/unused-key', severity: 'hint', count: 502 },
    ]);
});

test('the runner applies the cap to each file and reports what it dropped', (t) => {
    const mod = scratch(t);
    // Five events with neither desc nor option, each an information finding twice (advice),
    // and a stray closing brace at the end of the file: a syntax error.
    const events = ['namespace = capped'];
    for (let i = 1; i <= 5; i++) {
        events.push(`capped.${String(i)} = { type = character_event }`);
    }
    events.push('}');
    write(path.join(mod, 'events', 'capped_events.txt'), `${events.join('\n')}\n`);
    write(path.join(mod, 'events', 'other_events.txt'), 'namespace = other\n');
    const all = checkWorkspace({ spec, modDir: mod, gameDir: null, cacheDir: null });
    assert.deepEqual(all.capped, []);
    assert.equal(all.maxFindingsPerFile, MAX_FINDINGS_PER_FILE);
    const found = all.findings.length;
    assert.ok(
        found > 4,
        `the file has more findings than the cap of the next run (${String(found)})`,
    );
    const run = checkWorkspace({
        spec,
        modDir: mod,
        gameDir: null,
        cacheDir: null,
        maxFindingsPerFile: 3,
    });
    assert.equal(run.findings.length, 3);
    assert.equal(run.maxFindingsPerFile, 3);
    assert.ok(
        run.findings.some(
            (f) => f.severity === 'error' && f.code === 'syntax/unexpected-closing-brace',
        ),
        'the error at the end of the file is kept',
    );
    assert.equal(run.capped.length, 1);
    const [capped] = run.capped;
    assert.equal(capped?.file, 'events/capped_events.txt');
    assert.equal(capped.found, found);
    assert.equal(capped.dropped, found - 3);
    assert.equal(
        capped.droppedByCode.reduce((n, row) => n + row.count, 0),
        found - 3,
    );
});

// ─── "Did you mean" ────────────────────────────────────────────────────────

test('no check computes "did you mean": the only suggestions are lookup\'s, under its work budget', () => {
    // The work behind a suggestion is bounded in lookup (suggest.ts, and its test that the work
    // never passes the budget). A finding carries no suggestion: no check module reaches the
    // lookup code, so checking a file can never do that work, once per finding or at all.
    const dir = path.join(REPO_ROOT, 'packages', 'core', 'src', 'check');
    const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    assert.ok(sources.length > 50);
    for (const file of sources) {
        const text = readFileSync(path.join(dir, file), 'utf8');
        assert.doesNotMatch(text, /from '\.\.\/lookup\//, `${file} imports the lookup code`);
    }
});

test('a file of many long unknown names is checked with no suggestion work', () => {
    const name = (i: number): string => `made_up_trigger_${'x'.repeat(4_000)}_${String(i)}`;
    const keys = Array.from({ length: 500 }, (_, i) => `\t\t${name(i)} = yes`);
    const text = ['namespace = fixture', 'fixture.1 = {', '\ttrigger = {', ...keys, '\t}', '}', ''];
    const findings = scriptFindings({
        spec,
        file: 'events/fixture_events.txt',
        bytes: new TextEncoder().encode(text.join('\n')),
        names: { isDefined: () => false },
    }).filter((f) => f.code === 'names/unknown-trigger');
    assert.equal(findings.length, 500);
    for (const f of findings) {
        assert.ok(!('suggestions' in f.data), 'a finding carries no suggestion');
    }
});

// ─── No game folder ───────────────────────────────────────────────────────

/**
 * A base game that defines every name, saves every scope and uses every word: the most any
 * base game could define. A finding that depends on a name the base game might define is
 * silent over it.
 */
const EVERYTHING: WorkspaceNames = {
    baseGame: true,
    isDefined: () => true,
    isScopeSaved: () => true,
    isLocalizationKey: () => true,
    isBaseGameLocalizationKey: () => true,
    isUsed: () => true,
    hasDefinition: () => true,
    isRecordName: () => true,
};

const place = (f: WorkspaceFinding): string =>
    `${f.file}:${String(f.start)}-${String(f.end)} ${f.code} ${f.message}`;

test("without a game folder, no finding on any fixture's bad half depends on a base-game name", () => {
    const bad = readdirSync(MODS).filter((m) => m.endsWith('-bad'));
    assert.ok(bad.length >= 50, `every check pair (${String(bad.length)})`);
    let silent = 0;
    for (const mod of bad) {
        const modDir = path.join(MODS, mod);
        const without = checkWorkspace({ spec, modDir, gameDir: null, cacheDir: null });
        // The same files over a base game that defines everything.
        const workspace = openWorkspace({ spec, modDir, gameDir: null, cacheDir: null });
        const over = new Set<string>();
        for (const file of workspace.mod?.files ?? []) {
            if (fileKindOf(file.path) === undefined) {
                continue;
            }
            const input = {
                spec,
                file: file.path,
                bytes: readFileSync(file.disk),
                names: EVERYTHING,
            };
            const found =
                fileKindOf(file.path) === 'localization'
                    ? localizationFindings(input)
                    : scriptFindings({
                          ...input,
                          index: { workspace: workspace.index, layer: file.layer },
                      });
            for (const f of found) {
                over.add(place(f));
            }
        }
        for (const f of without.findings) {
            assert.ok(
                over.has(place(f)),
                `${mod}: ${place(f)} is reported without a game but not over a game that defines every name`,
            );
        }
        if (without.findings.length === 0) {
            silent++;
        }
    }
    // Most bad halves need the game to be wrong at all: those checks are silent without one.
    assert.ok(silent > 0);
});
