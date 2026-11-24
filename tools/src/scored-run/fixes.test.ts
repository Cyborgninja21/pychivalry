/**
 * The safe fixes of the core (docs/PLAN.md item 8.6) on the planted-defect mod: every finding
 * the checker reports on `mod/` with a safe fix is fixed by applying that fix alone to a copy
 * of the mod, as `check --fix` and an editor apply it, and the copy is graded. For the defect
 * the finding is: its finding is gone, no error or warning comes in, the lines changed are in
 * that defect's own fix ranges, and the graders that judge a single fix pass
 * (`only-planted-lines`, `look-alikes-untouched`, `nothing-deleted`). A safe fix is the one
 * outcome that can be right, so it must be one the graders accept.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
    applyFixes,
    checkWorkspace,
    openSpec,
    type FixAlternative,
    type WorkspaceFinding,
} from '@pychivalry/core';
import { tempDir } from '../testing.js';
import { repoRoot } from '../util.js';
import { lineDiff } from './diff.js';
import { grade } from './graders.js';
import {
    committedManifest,
    DEFECTS_DIR,
    insertRange,
    linesOf,
    reportedAt,
    type PlantedDefect,
} from './manifest.js';

const root = repoRoot();
const manifest = committedManifest(root);
const spec = openSpec(path.join(root, 'spec'));
const modDir = path.join(root, DEFECTS_DIR, 'mod');
const gameDir = path.join(root, ...manifest.game.split('/'));

/** The findings on the mod in `dir`, but the `style/` family's, which plants nothing. */
function check(dir: string): WorkspaceFinding[] {
    return checkWorkspace({
        spec,
        gameDir,
        cacheDir: null,
        modDir: dir,
        platform: 'linux',
    }).findings.filter((f) => !f.code.startsWith('style/'));
}

/** Apply one alternative to the mod in `dir`. */
function apply(dir: string, alternative: FixAlternative): void {
    const read = (file: string): string | null => {
        const at = path.join(dir, ...file.split('/'));
        return existsSync(at) ? readFileSync(at, 'utf8') : null;
    };
    for (const [file, text] of applyFixes([alternative], read).files) {
        const at = path.join(dir, ...file.split('/'));
        mkdirSync(path.dirname(at), { recursive: true });
        writeFileSync(at, text);
    }
}

/** The planted defect a finding is: its code, reported at the finding's file and line. */
function defectOf(f: WorkspaceFinding): PlantedDefect | undefined {
    return manifest.defects.find(
        (d) =>
            d.code === f.code &&
            reportedAt(d).some((p) => p.file === f.file && p.line === f.range.start.line + 1),
    );
}

function seriousByCode(findings: readonly WorkspaceFinding[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const f of findings) {
        if (f.severity === 'error' || f.severity === 'warning') {
            out.set(f.code, (out.get(f.code) ?? 0) + 1);
        }
    }
    return out;
}

/** What is wrong with the copy `dir` after the fix of `finding`, for its defect alone. */
function problemsOf(dir: string, finding: WorkspaceFinding, defect: PlantedDefect): string[] {
    const problems: string[] = [];
    const before = check(modDir);
    const after = check(dir);
    const still = after.filter(
        (f) =>
            f.code === finding.code &&
            reportedAt(defect).some((p) => p.file === f.file && p.line === f.range.start.line + 1),
    );
    if (still.length > 0) {
        problems.push(`its finding stays: ${still.map((f) => f.message).join('; ')}`);
    }
    const was = seriousByCode(before);
    for (const [code, n] of seriousByCode(after)) {
        const allowed = (was.get(code) ?? 0) - (code === finding.code ? 1 : 0);
        if (n > allowed) {
            problems.push(
                `${code}: ${String(n)} errors and warnings after, at most ${String(allowed)}`,
            );
        }
    }
    // The lines changed: only those of this defect's own fix ranges.
    for (const file of new Set(finding.fix?.alternatives[0]?.edits.map((e) => e.file) ?? [])) {
        const old = path.join(modDir, ...file.split('/'));
        const now = path.join(dir, ...file.split('/'));
        const diff = lineDiff(
            linesOf(existsSync(old) ? readFileSync(old, 'utf8') : ''),
            linesOf(readFileSync(now, 'utf8')),
        );
        const ranges = defect.fix.filter((r) => r.file === file);
        for (const line of diff.removed) {
            if (
                !ranges.some(
                    (r) => r.lines !== undefined && r.lines[0] <= line && line <= r.lines[1],
                )
            ) {
                problems.push(`${file}:${String(line)} changed outside the defect's fix ranges`);
            }
        }
        for (const add of diff.added) {
            if (
                !ranges.some((r) => {
                    const range = insertRange(r);
                    return range !== null && range[0] <= add.after && add.after <= range[1];
                })
            ) {
                problems.push(
                    `${file}: a line added after ${String(add.after)}, outside the defect's fix ranges`,
                );
            }
        }
    }
    const grades = grade({ manifest, original: modDir, result: dir, findings: [] });
    for (const g of grades) {
        if (
            (g.name === 'only-planted-lines' ||
                g.name === 'look-alikes-untouched' ||
                g.name === 'nothing-deleted') &&
            !g.passed
        ) {
            problems.push(`${g.name}: ${g.problems.join('; ')}`);
        }
    }
    return problems;
}

test("each safe fix of the planted-defect mod fixes its defect as the mod's graders accept", (t) => {
    const findings = check(modDir);
    const safe = findings.filter((f) => f.fix?.safety === 'safe');
    const problems: string[] = [];
    for (const finding of safe) {
        const alternative = finding.fix?.alternatives[0];
        const defect = defectOf(finding);
        const where = `${finding.file}:${String(finding.range.start.line + 1)} ${finding.code}`;
        if (alternative === undefined || defect === undefined) {
            problems.push(`${where}: a safe fix on no planted defect`);
            continue;
        }
        const dir = path.join(tempDir(t), 'mod');
        cpSync(modDir, dir, { recursive: true });
        apply(dir, alternative);
        problems.push(...problemsOf(dir, finding, defect).map((p) => `${where}: ${p}`));
    }
    assert.deepEqual(problems, []);
    // Most of the planted defects that are misspellings or syntax have a safe fix.
    const codes = new Set<string>(safe.map((f) => f.code));
    t.diagnostic(`${String(safe.length)} safe fixes: ${[...codes].sort().join(', ')}`);
    for (const code of [
        'names/unknown-trigger',
        'names/unknown-effect',
        'names/unknown-link',
        'names/unknown-modifier',
        'names/unknown-on-action',
        'fields/unknown-field',
        'syntax/missing-equals-before-block',
        'syntax/unexpected-closing-brace',
        'structure/range-min-above-max',
    ]) {
        assert.ok(codes.has(code), `a safe fix of ${code}`);
    }
});

test('no fix of the planted-defect mod, safe or not, touches a look-alike or deletes content', (t) => {
    const problems: string[] = [];
    for (const finding of check(modDir)) {
        for (const alternative of finding.fix?.alternatives ?? []) {
            const dir = path.join(tempDir(t), 'mod');
            cpSync(modDir, dir, { recursive: true });
            apply(dir, alternative);
            for (const g of grade({ manifest, original: modDir, result: dir, findings: [] })) {
                if (
                    (g.name === 'look-alikes-untouched' || g.name === 'nothing-deleted') &&
                    !g.passed
                ) {
                    problems.push(
                        `${finding.file}:${String(finding.range.start.line + 1)} "${alternative.title}": ${g.name}: ${g.problems.join('; ')}`,
                    );
                }
            }
        }
    }
    assert.deepEqual(problems, []);
});
