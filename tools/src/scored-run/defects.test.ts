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

test('20 to 30 defects, one per check code, errors and warnings first', () => {
    const codes = manifest.defects.map((d) => d.code);
    assert.ok(codes.length >= 20 && codes.length <= 30, `${String(codes.length)} defects`);
    assert.equal(new Set(codes).size, codes.length, 'a code is planted once');
    const rows = new Map(inventoryRows().map((r) => [r.code as string, r]));
    for (const code of codes) {
        assert.ok(rows.has(code), `${code} is a code of this build`);
    }
    // Advice codes come in only once every error and warning code is planted.
    const planted = new Set(codes);
    const severe = [...rows.values()].filter(
        (r) => r.severity === 'error' || r.severity === 'warning',
    );
    const advice = codes.filter((c) => !['error', 'warning'].includes(rows.get(c)?.severity ?? ''));
    if (advice.length > 0) {
        assert.deepEqual(
            severe.filter((r) => !planted.has(r.code)).map((r) => r.code),
            [],
            'advice codes are planted only after every error and warning code',
        );
    }
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

test('with unused keys on, neither mod/ nor reference/ has one: the defaults change nothing', () => {
    // localization/unused-key is off by default in the one runner and in the agent server's
    // check (docs/decisions.md, decision 76); the fixture means the same either way.
    for (const dir of [modDir, referenceDir]) {
        assert.deepEqual(
            checkMod(spec, gameDir, dir, { unusedKeys: true }).filter(
                (f) => f.code === 'localization/unused-key',
            ),
            [],
        );
    }
    assert.equal(checkMod(spec, gameDir, referenceDir, { unusedKeys: true }).length, 0);
});
