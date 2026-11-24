/**
 * The `style/` family (docs/checks.md, "Formatting"): each code fires on its bad fixture, as
 * `expected.json` lists, and is silent on its good one; every finding rests on pychivalry's own
 * formatting rules and carries a safe fix made by the formatter; a file with a parse error has
 * none; the warning's fix leaves a file the runner finds nothing in to format.
 */

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { writeMod } from '../fix/testing.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { CHECK_KINDS } from './finding.js';
import { STYLE_KINDS } from './style-kinds.js';
import { expectedFindings } from './testing.js';
import { checkWorkspace, type WorkspaceFinding } from './workspace.js';

const spec = committedSpec();
const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');

function styleOf(modDir: string): WorkspaceFinding[] {
    return checkWorkspace({
        spec,
        modDir,
        gameDir: null,
        cacheDir: null,
        platform: 'linux',
    }).findings.filter((f) => f.code.startsWith('style/'));
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

for (const code of Object.keys(STYLE_KINDS)) {
    const pair = code.replace('/', '-');
    test(`${code} fires on its bad fixture and is silent on its good one`, () => {
        const bad = styleOf(path.join(MODS, `${pair}-bad`));
        assert.deepEqual(written(bad), expectedFindings(`${pair}-bad`));
        assert.ok(
            bad.some((f) => f.code === code),
            `${pair}-bad has a ${code}`,
        );
        assert.deepEqual(styleOf(path.join(MODS, `${pair}-good`)), []);
        for (const f of bad) {
            assert.deepEqual(f.evidence, {
                kind: 'formatting-rules',
                source: 'docs/formatting.md',
            });
            assert.equal(f.fix?.safety, 'safe', `${f.code}: a safe fix`);
            assert.equal(f.fix.basis, 'formatting');
            assert.equal(f.fix.alternatives.length, 1);
        }
    });
}

test('one warning a file not in the format; every other style finding is a hint', () => {
    assert.equal(CHECK_KINDS['style/not-formatted'].severity, 'warning');
    for (const [code, kind] of Object.entries(STYLE_KINDS)) {
        assert.equal(kind.formattingRules, true, code);
        if (code !== 'style/not-formatted') {
            assert.equal(kind.severity, 'hint', code);
        }
    }
    // The formatter's pairs: those of its own codes (the best-practice rules of `style/` have
    // theirs, tested with their checks).
    const pairs = readdirSync(MODS).filter(
        (m) =>
            m.endsWith('-bad') &&
            Object.keys(STYLE_KINDS).some((code) => `${code.replace('/', '-')}-bad` === m),
    );
    assert.equal(pairs.length, Object.keys(STYLE_KINDS).length);
    for (const pair of pairs) {
        const found = styleOf(path.join(MODS, pair));
        const files = new Set(found.map((f) => f.file));
        for (const file of files) {
            assert.equal(
                found.filter((f) => f.file === file && f.code === 'style/not-formatted').length,
                1,
                `${pair}: ${file}`,
            );
        }
    }
});

test('a file with a parse error has no style finding', () => {
    const run = checkWorkspace({
        spec,
        modDir: writeMod({ 'events/broken.txt': 'a = {\n    b = c\n' }),
        gameDir: null,
        cacheDir: null,
    });
    assert.ok(run.findings.some((f) => f.code === 'syntax/missing-closing-brace'));
    assert.ok(run.findings.every((f) => !f.code.startsWith('style/')));
});
