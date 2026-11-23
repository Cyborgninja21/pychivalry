/**
 * The check suites (check-suite.ts): how a finding meets its classification, what a
 * classification file must hold, how the errors compare with release 2.3.0's, and both suites
 * run end to end on a stub game written in the test, through the core's one runner.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import {
    classifyFindings,
    compareErrors,
    GAME_CLASSES,
    MOD_CLASSES,
    readCheckClassifications,
    runCheckSuite,
    runModsSuite,
    type WorkerFinding,
} from './check-suite.js';
import { fixtureGame, fixtureMod, tempDir, writeTree } from './testing.js';
import { CommandError, repoRoot } from './util.js';

const root = repoRoot();

function found(file: string, line: number, code = 'names/unknown-trigger'): WorkerFinding {
    return {
        file,
        layer: 'game',
        line,
        column: 1,
        code,
        severity: 'error',
        message: 'm',
        name: null,
        data: {},
    };
}

test('an entry covers the findings of its code and file at its lines; the rest are unclassified', () => {
    const { findings, unmatched } = classifyFindings(
        [found('a.txt', 1), found('a.txt', 2), found('a.txt', 3, 'names/unknown-effect')],
        [
            {
                file: 'a.txt',
                code: 'names/unknown-trigger',
                lines: [1, 9],
                classification: 'game-defect',
                reason: 'r',
            },
        ],
        { layered: true },
    );
    assert.deepEqual(
        findings.map((f) => [f.line, f.code, f.classification]),
        [
            [1, 'names/unknown-trigger', 'game-defect'],
            [2, 'names/unknown-trigger', 'unclassified'],
            [3, 'names/unknown-effect', 'unclassified'],
        ],
    );
    assert.deepEqual(unmatched, ['a.txt:9 names/unknown-trigger']);
});

test("a mod's entries apply to that mod only", () => {
    const entry = {
        slug: 'rice',
        file: 'a.txt',
        code: 'names/unknown-trigger',
        lines: [1],
        classification: 'real-defect',
        reason: 'r',
    };
    const rice = classifyFindings([found('a.txt', 1)], [entry], { slug: 'rice', layered: false });
    assert.equal(rice.findings[0]?.classification, 'real-defect');
    const other = classifyFindings([found('a.txt', 1)], [entry], {
        slug: 'viet-events',
        layered: false,
    });
    assert.equal(other.findings[0]?.classification, 'unclassified');
});

test('a classification file with an unknown class or no reason is a usage error', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'c.json');
    const entry = {
        file: 'a.txt',
        code: 'c',
        lines: [1],
        classification: 'game-defect',
        reason: 'r',
    };
    writeTree(dir, { 'c.json': JSON.stringify({ classifications: [entry] }) });
    assert.equal(readCheckClassifications(file, GAME_CLASSES).length, 1);
    assert.throws(() => readCheckClassifications(file, MOD_CLASSES), CommandError);
    writeTree(dir, { 'c.json': JSON.stringify({ classifications: [{ ...entry, reason: '' }] }) });
    assert.throws(() => readCheckClassifications(file, GAME_CLASSES), CommandError);
    writeTree(dir, { 'c.json': JSON.stringify({ classifications: [{ ...entry, lines: [] }] }) });
    assert.throws(() => readCheckClassifications(file, GAME_CLASSES), CommandError);
});

test('errors compare with release 2.3.0 by file and line', () => {
    assert.deepEqual(
        compareErrors(
            [
                { file: 'a', line: 1 },
                { file: 'a', line: 2 },
            ],
            [
                { file: 'a', line: 2 },
                { file: 'b', line: 1 },
            ],
        ),
        { errors_at_same_line: 1, errors_only_2_3_0: 1, errors_only_here: 1 },
    );
});

test('the base-game suite lists and classifies every error; an unclassified one fails it', (t) => {
    const dir = tempDir(t);
    const game = fixtureGame(path.join(dir, 'install'));
    writeTree(dir, {
        'install/game/common/scripted_triggers/x.txt':
            'x_trigger = {\n\tis_adult = yes\n\tmade_up_trigger = yes\n}\n',
        'none.json': JSON.stringify({ classifications: [] }),
        'one.json': JSON.stringify({
            classifications: [
                {
                    file: 'common/scripted_triggers/x.txt',
                    code: 'names/unknown-trigger',
                    lines: [3],
                    classification: 'game-defect',
                    reason: 'No such trigger.',
                },
            ],
        }),
    });
    const failing = runCheckSuite({
        root,
        gameDir: game,
        classificationsFile: path.join(dir, 'none.json'),
    });
    assert.equal(failing['passed'], false);
    assert.deepEqual(failing['failures'], [
        'unclassified: game/common/scripted_triggers/x.txt:3 names/unknown-trigger',
    ]);
    const passing = runCheckSuite({
        root,
        gameDir: game,
        classificationsFile: path.join(dir, 'one.json'),
    });
    assert.equal(passing['passed'], true, JSON.stringify(passing['failures']));
    assert.equal(passing['files'], 2);
    assert.deepEqual(passing['error_list'], [
        {
            file: 'common/scripted_triggers/x.txt',
            layer: 'game',
            line: 3,
            column: 2,
            code: 'names/unknown-trigger',
            message: "Unknown trigger 'made_up_trigger'",
            classification: 'game-defect',
            reason: 'No such trigger.',
        },
    ]);
    // is_adult, in a scripted trigger: a keyword use, not judged (its caller's scope).
    const scope = passing['scope'] as { keyword_uses: number; keyword_uses_judged: number };
    assert.equal(scope.keyword_uses, 1);
    assert.equal(scope.keyword_uses_judged, 0);
});

test('the real-mod suite checks each mod over the base game from a cache it removes', (t) => {
    const dir = tempDir(t);
    const game = fixtureGame(path.join(dir, 'install'));
    const corpus = path.join(dir, 'corpus');
    fixtureMod(corpus, 'fixture-mod');
    writeTree(corpus, {
        'fixture-mod/common/scripted_triggers/x.txt': 'x_trigger = {\n\tmade_up_trigger = yes\n}\n',
    });
    writeTree(dir, { 'none.json': JSON.stringify({ classifications: [] }) });
    const results = runModsSuite({
        root,
        gameDir: game,
        corpus: { dir: corpus, slugs: ['fixture-mod'] },
        classificationsFile: path.join(dir, 'none.json'),
        tempParent: dir,
    });
    assert.equal(results['passed'], false);
    assert.deepEqual(results['failures'], [
        'fixture-mod: an error not shown to be a real defect: common/scripted_triggers/x.txt:2 names/unknown-trigger',
    ]);
    const [mod] = results['mods'] as Record<string, unknown>[];
    assert.equal(mod?.['errors'], 1);
    assert.equal(mod['slug'], 'fixture-mod');
});
