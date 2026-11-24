/**
 * The planted-defect fixture, `fixtures/defects/` (docs/PLAN.md item 6.7): its manifest
 * describes its mod line for line, and the checker, over the fixture's game stub, reports
 * exactly the planted defects on `mod/` and nothing at all on `reference/`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { inventoryRows, openSpec } from '@pychivalry/core';
import { readGameBuild } from '../game.js';
import { repoRoot } from '../util.js';
import { checkMod, filesIn } from './graders.js';
import {
    committedManifest,
    DEFECTS_DIR,
    linesOf,
    manifestShapeProblems,
    reportedAt,
} from './manifest.js';

const root = repoRoot();
const manifest = committedManifest(root);
const spec = openSpec(path.join(root, 'spec'));
const modDir = path.join(root, DEFECTS_DIR, 'mod');
const referenceDir = path.join(root, DEFECTS_DIR, 'reference');
const gameDir = path.join(root, ...manifest.game.split('/'));

function modLines(file: string): string[] {
    return linesOf(readFileSync(path.join(modDir, ...file.split('/')), 'utf8')).map((l, i) =>
        i === 0 ? l.replace(/^\uFEFF/, '') : l,
    );
}

test('the manifest has the shape its reader states', () => {
    const value = JSON.parse(
        readFileSync(path.join(root, DEFECTS_DIR, 'manifest.json'), 'utf8'),
    ) as unknown;
    assert.deepEqual(manifestShapeProblems(value), []);
});

test('every error and warning code is planted at least once, and only codes of this build', () => {
    const codes = manifest.defects.map((d) => d.code);
    const rows = new Map(inventoryRows().map((r) => [r.code as string, r]));
    for (const code of codes) {
        assert.ok(rows.has(code), `${code} is a code of this build`);
    }
    const planted = new Set(codes);
    // The `style/` family's warnings too (the owner's word of 2026-11-23): a file not in the
    // format, and a file not UTF-8.
    const severe = [...rows.values()].filter(
        (r) => r.severity === 'error' || r.severity === 'warning',
    );
    assert.ok(severe.some((r) => r.code === 'style/not-formatted'));
    assert.ok(severe.some((r) => r.code === 'style/not-utf8'));
    assert.deepEqual(
        severe.filter((r) => !planted.has(r.code)).map((r) => r.code),
        [],
        'every error and warning code',
    );
    // Advice codes come in only once every error and warning code is planted (it is).
    assert.ok(codes.length >= severe.length);
});

test('the mod is hard enough to tell servers apart: defects that need a lookup, that interact, that are fixed elsewhere', () => {
    // tools/scored-run/README.md, proposal 1 of the first test sessions: every session fixed
    // every defect of the first mod in about a minute. The mod plants some codes more than
    // once, puts the fix of some defects in another file or on another line than the
    // finding, and has look-alikes close to the defects.
    const codes = manifest.defects.map((d) => d.code);
    const twice = [...new Set(codes)].filter((c) => codes.filter((x) => x === c).length > 1);
    assert.ok(twice.length >= 4, `codes planted more than once: ${twice.join(', ')}`);
    const elsewhere = manifest.defects.filter((d) =>
        d.fix.some((r) => r.file !== d.file || (r.lines !== undefined && r.lines[0] > d.line)),
    );
    assert.ok(elsewhere.length >= 5, `${String(elsewhere.length)} fixed elsewhere`);
    assert.ok(
        manifest.look_alikes.length >= 25,
        `${String(manifest.look_alikes.length)} look-alikes`,
    );
    const files = filesIn(modDir);
    const lines = files.reduce(
        (n, f) => n + linesOf(readFileSync(path.join(modDir, ...f.split('/')), 'utf8')).length,
        0,
    );
    assert.ok(
        files.length >= 15 && lines >= 500,
        `${String(files.length)} files, ${String(lines)} lines`,
    );
});

test("each defect's text and each look-alike's text is its line of mod/", () => {
    for (const d of manifest.defects) {
        assert.equal(
            modLines(d.file)[d.line - 1],
            d.text,
            `${d.code} at ${d.file}:${String(d.line)}`,
        );
        for (const r of d.fix) {
            const count = modLines(r.file).length;
            for (const n of [...(r.lines ?? []), ...(r.insert ?? [])]) {
                assert.ok(n <= count, `${d.code}: ${r.file} has no line ${String(n)}`);
            }
        }
    }
    for (const l of manifest.look_alikes) {
        assert.equal(
            modLines(l.file)[l.line - 1],
            l.text,
            `look-alike at ${l.file}:${String(l.line)}`,
        );
    }
    const places = manifest.look_alikes.map((l) => `${l.file}:${String(l.line)}`);
    assert.equal(new Set(places).size, places.length, 'each look-alike is listed once');
    for (const d of manifest.defects) {
        assert.ok(
            !places.includes(`${d.file}:${String(d.line)}`),
            `${d.code} is not on a look-alike line`,
        );
    }
});

test('some look-alikes sit inside a fix range, where only their own grader protects them', () => {
    const inside = manifest.look_alikes.filter((l) =>
        manifest.defects.some((d) =>
            d.fix.some(
                (r) =>
                    r.file === l.file &&
                    r.lines !== undefined &&
                    r.lines[0] <= l.line &&
                    l.line <= r.lines[1],
            ),
        ),
    );
    assert.ok(inside.length >= 1);
    assert.ok(inside.length < manifest.look_alikes.length);
});

test('mod/ and reference/ hold the same files', () => {
    assert.deepEqual(filesIn(referenceDir), filesIn(modDir));
});

test('the game stub states the build of the committed spec', () => {
    assert.equal(readGameBuild(gameDir), spec.version);
});

test('the checker reports exactly the planted defects on mod/, at every severity', () => {
    const found = checkMod(spec, gameDir, modDir)
        .map((f) => `${f.code} ${f.file}:${String(f.line)}`)
        .sort();
    const planted = manifest.defects
        .flatMap((d) => reportedAt(d).map((p) => `${d.code} ${p.file}:${String(p.line)}`))
        .sort();
    assert.deepEqual(found, planted);
});

test('the checker reports nothing on reference/, at any severity', () => {
    assert.deepEqual(checkMod(spec, gameDir, referenceDir), []);
});

test('with unused keys on or off, neither mod/ nor reference/ has one: the setting changes nothing', () => {
    // localization/unused-key is on by default in the one runner and in the agent server's
    // check since 2026-11-23 (replacing decision 76); the fixture means the same either way.
    for (const dir of [modDir, referenceDir]) {
        assert.deepEqual(
            checkMod(spec, gameDir, dir).filter((f) => f.code === 'localization/unused-key'),
            [],
        );
    }
    assert.equal(checkMod(spec, gameDir, referenceDir, { unusedKeys: false }).length, 0);
});
