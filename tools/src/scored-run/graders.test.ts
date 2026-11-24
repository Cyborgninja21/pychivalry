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
    // 36 findings of planted codes, shown up to the cap and counted past it.
    assert.equal(gone?.problems.length, MAX_PROBLEMS + 1);
    assert.equal(gone.problems[MAX_PROBLEMS], 'and 16 more');
});

test('a fix that deletes the offending block fails nothing-deleted, its block left out of the format', (t) => {
    // The effect run in the wrong scope is deleted instead of moved into the right one: the
    // finding is gone and only the planted lines changed, but content was lost, and the block
    // left holding one pair is no longer laid out as the format says (style/not-formatted).
    const dir = referenceWith(t, 'events/harvest_events.txt', (text) =>
        replaceOnce(
            text,
            '\t\tcapital_county = {\r\n\t\t\tadd_county_modifier = {\r\n\t\t\t\tmodifier = harvest_granary_modifier\r\n\t\t\t\tyears = 5\r\n\t\t\t}\r\n\t\t}\r\n',
            '',
        ),
    );
    assert.deepEqual(failing(dir), ['defects-gone', 'nothing-deleted']);
});

test('commenting the offending line out fails nothing-deleted alone', (t) => {
    const dir = referenceWith(t, 'common/scripted_effects/harvest_effects.txt', (text) =>
        replaceOnce(text, '\tadd_piety = 10\r\n', '\t# add_piety =\r\n'),
    );
    assert.deepEqual(failing(dir), ['nothing-deleted']);
});

test('a fix that also edits a look-alike fails look-alikes-untouched alone', (t) => {
    // The market's interaction category is given its index, and its RGB colour, which is
    // right, is rewritten too, as HSV: inside the lines the fix may change, but a look-alike.
    const dir = referenceWith(
        t,
        'common/character_interaction_categories/harvest_categories.txt',
        (text) =>
            replaceOnce(
                text,
                '\tcolor = { 0.8 0.6 0.2 }\r\n',
                '\tcolor = hsv { 0.1 0.75 0.8 }\r\n',
            ),
    );
    assert.deepEqual(failing(dir), ['look-alikes-untouched']);
});

test('a fix that rewrites an unrelated file fails only-planted-lines alone', (t) => {
    const dir = referenceWith(t, 'common/modifiers/harvest_modifiers.txt', (text) =>
        replaceOnce(text, '\tstewardship = 2\r\n', '\tstewardship = 3\r\n'),
    );
    assert.deepEqual(failing(dir), ['only-planted-lines']);
});

test('a line added away from the planted lines fails only-planted-lines alone', (t) => {
    const dir = referenceWith(
        t,
        'common/script_values/harvest_values.txt',
        (text) => `${text}\r\n# Tidied up.\r\n`,
    );
    assert.deepEqual(failing(dir), ['only-planted-lines']);
});

test('a file added or removed fails only-planted-lines, and a removed one nothing-deleted', (t) => {
    const added = path.join(tempDir(t), 'mod');
    cpSync(reference, added, { recursive: true });
    writeFileSync(path.join(added, 'common', 'scripted_effects', 'notes.txt'), '\uFEFF# notes\r\n');
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

test('a fix the game accepts is accepted, though the reference fixes it another way', (t) => {
    // The graders judge by the checker and the manifest's fix ranges, never by equality with
    // reference/ (item 6.11: the sessions fixed the wrong-scope link with primary_title.holder
    // where the reference uses liege, and the wrong-scope effect with add_character_modifier).
    const holder = referenceWith(t, 'common/decisions/harvest_decisions.txt', (text) =>
        replaceOnce(
            text,
            '\t\tliege = { is_alive = yes }',
            '\t\tprimary_title.holder = { is_alive = yes }',
        ),
    );
    assert.deepEqual(failing(holder), []);
    const character = referenceWith(t, 'events/harvest_events.txt', (text) =>
        replaceOnce(
            text,
            '\t\tcapital_county = {\r\n\t\t\tadd_county_modifier = {\r\n\t\t\t\tmodifier = harvest_granary_modifier\r\n\t\t\t\tyears = 5\r\n\t\t\t}\r\n\t\t}\r\n',
            '\t\tadd_character_modifier = {\r\n\t\t\tmodifier = harvest_granary_modifier\r\n\t\t\tyears = 5\r\n\t\t}\r\n',
        ),
    );
    assert.deepEqual(failing(character), []);
    // The clash fixed by renaming the court event to a free id, the on-action following it.
    const renamed = path.join(tempDir(t), 'mod');
    cpSync(reference, renamed, { recursive: true });
    for (const [file, from, to] of [
        ['events/harvest_court_events.txt', 'harvest.0012 = {', 'harvest.0006 = {'],
        ['common/on_action/harvest_on_actions.txt', '25 = harvest.0012', '25 = harvest.0006'],
    ] as const) {
        const at = path.join(renamed, ...file.split('/'));
        writeFileSync(at, replaceOnce(readFileSync(at, 'utf8'), from, to));
    }
    assert.deepEqual(failing(renamed), []);
});

test('the obvious fix of a defect that interacts with another fails', (t) => {
    // The hidden event harvst.0004 renamed to harvest.0004, which the court event already
    // has: the checker reports the clash, and the on-action that named the event an unknown
    // key.
    const clash = referenceWith(t, 'events/harvest_events.txt', (text) =>
        replaceOnce(text, 'harvest.0005 = {', 'harvest.0004 = {'),
    );
    assert.deepEqual(failing(clash), ['zero-errors', 'defects-gone']);
    // The faith event's scope removed instead of hiding it: its faith trigger and effect are
    // then in a character scope, and words are lost.
    const scope = referenceWith(t, 'events/harvest_faith_events.txt', (text) =>
        replaceOnce(text, '\tscope = faith\r\n\thidden = yes\r\n', ''),
    );
    assert.deepEqual(failing(scope), [
        'zero-errors',
        'defects-gone',
        'only-planted-lines',
        'look-alikes-untouched',
        'nothing-deleted',
    ]);
    // The unclosed block closed at the end of the file: no error is left, but the brace is not
    // where the block ends, and the line after it is no longer indented as the format says.
    const brace = referenceWith(t, 'common/scripted_effects/harvest_reward_effects.txt', (text) =>
        replaceOnce(
            text,
            '\t\tyears = 2\r\n\t}\r\n\tadd_gold = 25\r\n}\r\n',
            '\t\tyears = 2\r\n\tadd_gold = 25\r\n}\r\n}\r\n',
        ),
    );
    assert.deepEqual(failing(brace), ['defects-gone', 'only-planted-lines']);
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

test('line endings and a final newline are not changes of lines, but the checker flags them', (t) => {
    const dir = path.join(tempDir(t), 'mod');
    cpSync(reference, dir, { recursive: true });
    const file = path.join(dir, 'common', 'modifiers', 'harvest_modifiers.txt');
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('\r\n', '\n').replace(/\n$/, ''));
    // No line changed: only the file's form, which the planted code style/not-formatted reports.
    assert.deepEqual(failing(dir), ['defects-gone']);
    const { grades } = gradeMod({ root, spec, manifest, original, result: dir });
    assert.deepEqual(grades.find((g) => g.name === 'defects-gone')?.problems, [
        'common/modifiers/harvest_modifiers.txt:1 warning style/not-formatted (planted at events/harvest_market_events.txt:28)',
    ]);
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
