/**
 * The graders (docs/PLAN.md item 6.9): they pass on `fixtures/defects/reference/` and fail on
 * the untouched `mod/`, and each fails on its own on a result made to break it alone.
 */

import assert from 'node:assert/strict';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { openSpec } from '@pychivalry/core';
import { tempDir } from '../testing.js';
import { repoRoot } from '../util.js';
import { lineDiff } from './diff.js';
import {
    contentWords,
    grade,
    gradeMod,
    GRADERS,
    MAX_PROBLEMS,
    type GraderName,
} from './graders.js';
import { committedManifest, DEFECTS_DIR, linesOf } from './manifest.js';

const root = repoRoot();
const manifest = committedManifest(root);
const spec = openSpec(path.join(root, 'spec'));
const original = path.join(root, DEFECTS_DIR, 'mod');
const reference = path.join(root, DEFECTS_DIR, 'reference');

/** The graders that fail on a result, by name. */
function failing(result: string): GraderName[] {
    return gradeMod({ root, spec, manifest, original, result })
        .grades.filter((g) => !g.passed)
        .map((g) => g.name);
}

/** A copy of `reference/` with `edit` applied to one of its files. */
function referenceWith(t: TestContext, file: string, edit: (text: string) => string): string {
    const dir = path.join(tempDir(t), 'mod');
    cpSync(reference, dir, { recursive: true });
    const at = path.join(dir, ...file.split('/'));
    const before = readFileSync(at, 'utf8');
    const after = edit(before);
    assert.notEqual(after, before, 'the edit changes the file');
    writeFileSync(at, after);
    return dir;
}

function replaceOnce(text: string, from: string, to: string): string {
    assert.equal(text.split(from).length, 2, `${JSON.stringify(from)} occurs once`);
    return text.replace(from, to);
}

test('every grader passes on reference/', () => {
    const { grades } = gradeMod({ root, spec, manifest, original, result: reference });
    assert.deepEqual(
        grades.map((g) => [g.name, g.passed, g.problems]),
        GRADERS.map((name) => [name, true, []]),
    );
});

test('on the untouched mod/, the checker graders fail and the others pass', () => {
    const { grades } = gradeMod({ root, spec, manifest, original, result: original });
    assert.deepEqual(failing(original), ['zero-errors', 'defects-gone']);
    const gone = grades.find((g) => g.name === 'defects-gone');
    // 28 findings of planted codes, shown up to the cap and counted past it.
    assert.equal(gone?.problems.length, MAX_PROBLEMS + 1);
    assert.equal(gone.problems[MAX_PROBLEMS], 'and 8 more');
});

test('a fix that deletes the offending block fails nothing-deleted alone', (t) => {
    // The effect run in the wrong scope is deleted instead of moved into the right one: the
    // finding is gone and only the planted lines changed, but content was lost.
    const dir = referenceWith(t, 'events/harvest_events.txt', (text) =>
        replaceOnce(
            text,
            '\t\tcapital_county = {\n\t\t\tadd_county_modifier = {\n\t\t\t\tmodifier = harvest_bounty_modifier\n\t\t\t\tyears = 5\n\t\t\t}\n\t\t}\n',
            '',
        ),
    );
    assert.deepEqual(failing(dir), ['nothing-deleted']);
});

test('commenting the offending line out fails nothing-deleted alone', (t) => {
    const dir = referenceWith(t, 'common/scripted_effects/harvest_effects.txt', (text) =>
        replaceOnce(text, '\tadd_piety = 10\n', '\t# add_piety =\n'),
    );
    assert.deepEqual(failing(dir), ['nothing-deleted']);
});

test('a fix that also edits a look-alike fails look-alikes-untouched alone', (t) => {
    // The interaction category is given its index, and its HSV colour, which is right, is
    // rewritten too, as RGBA: inside the lines the fix may change, but a look-alike.
    const dir = referenceWith(
        t,
        'common/character_interaction_categories/harvest_categories.txt',
        (text) =>
            replaceOnce(text, '\tcolor = hsv { 0.12 0.7 0.8 }\n', '\tcolor = { 0.8 0.6 0.2 1 }\n'),
    );
    assert.deepEqual(failing(dir), ['look-alikes-untouched']);
});

test('a fix that rewrites an unrelated file fails only-planted-lines alone', (t) => {
    const dir = referenceWith(t, 'common/modifiers/harvest_modifiers.txt', (text) =>
        replaceOnce(text, '\tstewardship = 2\n', '\tstewardship = 3\n'),
    );
    assert.deepEqual(failing(dir), ['only-planted-lines']);
});

test('a line added away from the planted lines fails only-planted-lines alone', (t) => {
    const dir = referenceWith(
        t,
        'common/script_values/harvest_values.txt',
        (text) => `${text}\n# Tidied up.\n`,
    );
    assert.deepEqual(failing(dir), ['only-planted-lines']);
});

test('a file added or removed fails only-planted-lines, and a removed one nothing-deleted', (t) => {
    const added = path.join(tempDir(t), 'mod');
    cpSync(reference, added, { recursive: true });
    writeFileSync(path.join(added, 'common', 'scripted_effects', 'notes.txt'), '# notes\n');
    assert.deepEqual(failing(added), ['only-planted-lines']);
    const removed = path.join(tempDir(t), 'mod');
    cpSync(reference, removed, { recursive: true });
    rmSync(path.join(removed, 'common', 'modifiers', 'harvest_modifiers.txt'));
    assert.deepEqual(failing(removed), ['only-planted-lines', 'nothing-deleted']);
});

test('a warning left unfixed fails defects-gone alone', (t) => {
    const dir = referenceWith(t, 'localization/english/harvest_l_english.yml', (text) =>
        replaceOnce(text, '"[ROOT.Char.GetFirstName] brings', '"[ROOT.Char.GetFirstName brings'),
    );
    assert.deepEqual(failing(dir), ['defects-gone']);
});

test('an error of a code not planted fails zero-errors alone', () => {
    // Every error code of this build is planted, so on the fixture an error always fails
    // defects-gone too; given the findings directly, zero-errors fails on its own.
    const grades = grade({
        manifest,
        original,
        result: reference,
        findings: [
            {
                file: 'events/harvest_events.txt',
                line: 1,
                code: 'test/not-planted',
                severity: 'error',
            },
        ],
    });
    assert.deepEqual(
        grades.filter((g) => !g.passed).map((g) => [g.name, g.problems]),
        [['zero-errors', ['events/harvest_events.txt:1 error test/not-planted']]],
    );
});

test('line endings and a final newline are not changes', (t) => {
    const dir = path.join(tempDir(t), 'mod');
    cpSync(reference, dir, { recursive: true });
    const file = path.join(dir, 'common', 'modifiers', 'harvest_modifiers.txt');
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('\n', '\r\n').replace(/\r\n$/, ''));
    assert.deepEqual(failing(dir), []);
});

test('words: comments and braces are not words; quoted text is one', () => {
    assert.deepEqual(contentWords('a = { b c } # d e\n f:0 "g # h" # i\n'), [
        'a',
        'b',
        'c',
        'f:0',
        '"g # h"',
    ]);
    assert.deepEqual(contentWords('\uFEFFx ?= y\nz >= -1'), ['x', 'y', 'z', '-1']);
});

test('the line diff keeps the longest common lines, removing before adding', () => {
    const diff = lineDiff(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e']);
    assert.deepEqual(diff.keptAs, [1, 0, 3, 4]);
    assert.deepEqual(diff.removed, [2]);
    assert.deepEqual(diff.added, [
        { after: 2, line: 2 },
        { after: 4, line: 5 },
    ]);
    assert.deepEqual(lineDiff([], ['a']).added, [{ after: 0, line: 1 }]);
    assert.deepEqual(lineDiff(['a'], []).removed, [1]);
    assert.deepEqual(linesOf('a\r\nb\n'), ['a', 'b']);
});
