import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { catalogueFromSpec, openSpec } from '@pychivalry/core';
import {
    BASE_GAME_FOLDERS,
    readClassifications,
    runParseSuite,
    type ClassificationEntry,
    type SuiteFolder,
} from './parse-suite.js';
import { tempDir, writeTree } from './testing.js';
import { CommandError, repoRoot } from './util.js';

const catalogue = catalogueFromSpec(openSpec(path.join(repoRoot(), 'spec')).data);

/** A small game folder: clean script, a defect, a file that is not UTF-8, a non-script file. */
function fixtureGame(dir: string): string {
    writeTree(dir, {
        'common/traits/00_traits.txt': '﻿brave = {\n\tlevel = 1\n}\n',
        'events/fixture_events.txt':
            'namespace = fixture\nfixture.0001 = {\n\ttype = character_event\n',
        'history/titles/k_fixture.txt': new Uint8Array([
            ...new TextEncoder().encode('k_fixture = { 1066.1.1 = { holder = 1 } } # Ren'),
            0xe9,
            0x0a,
        ]),
        'gfx/lists/names.txt': 'name_a\nname_b\n',
        'gfx/styles/style.txt': 'style = { color = rgb { 1 2 3 } }\n',
        'gfx/models/model.asset': 'pdxmesh = { name = "x" }\n',
    });
    return dir;
}

const FOLDERS: readonly SuiteFolder[] = [
    { folder: 'common', extension: '.txt', expected: 1, why: 'Records.' },
    { folder: 'events', extension: '.txt', expected: 1, why: 'Events.' },
    { folder: 'history', extension: '.txt', expected: 1, why: 'History.' },
    {
        folder: 'gfx',
        extension: '.txt',
        expected: 1,
        why: 'Graphics script.',
        excluded: [{ file: 'gfx/lists/names.txt', why: 'A list of names.' }],
    },
];

const DEFECT: ClassificationEntry = {
    file: 'events/fixture_events.txt',
    id: 'syntax/missing-closing-brace',
    line: 2,
    classification: 'game-defect',
    reason: 'The event is never closed.',
};

test('the suite parses the listed folders, classifies every error and passes', (t) => {
    const game = fixtureGame(tempDir(t));
    const results = runParseSuite(game, { catalogue, classifications: [DEFECT], folders: FOLDERS });
    assert.deepEqual(results.failures, []);
    assert.equal(results.passed, true);
    assert.equal(results.files, 4);
    assert.equal(results.trees, 4);
    assert.deepEqual(
        results.folders.map((f) => [f.folder, f.files, f.trees, f.bom, f.not_utf8, f.errors]),
        [
            ['common', 1, 1, 1, 0, 0],
            ['events', 1, 1, 0, 0, 1],
            ['history', 1, 1, 0, 1, 0],
            ['gfx', 1, 1, 0, 0, 0],
        ],
    );
    assert.deepEqual(results.errors, [
        {
            file: 'events/fixture_events.txt',
            line: 2,
            column: 16,
            id: 'syntax/missing-closing-brace',
            catalogue: 'expected_after_arguments',
            message: 'Expected } after arguments',
            classification: 'game-defect',
            reason: 'The event is never closed.',
        },
    ]);
    assert.deepEqual(
        results.notes.map((n) => [n.file, n.line, n.id]),
        [['history/titles/k_fixture.txt', 1, 'encoding/not-utf8']],
    );
});

test('the encoding measurement covers every text file and finds where the bad bytes are', (t) => {
    const game = fixtureGame(tempDir(t));
    const { encoding } = runParseSuite(game, {
        catalogue,
        classifications: [DEFECT],
        folders: FOLDERS,
    });
    assert.equal(encoding.files, 6);
    assert.equal(encoding.bom, 1);
    assert.equal(encoding.not_utf8, 1);
    assert.deepEqual(encoding.line_endings, { lf: 6, crlf: 0, cr: 0, mixed: 0, none: 0 });
    assert.deepEqual(encoding.not_utf8_files, [
        {
            file: 'history/titles/k_fixture.txt',
            invalid_bytes: 1,
            first_line: 1,
            in_comments: 1,
            in_strings: 0,
            elsewhere: 0,
            valid_multibyte_sequences: 0,
        },
    ]);
    assert.deepEqual(
        encoding.by_folder.map((r) => `${r.folder} ${r.extension} ${String(r.files)}`),
        ['common .txt 1', 'events .txt 1', 'gfx .asset 1', 'gfx .txt 2', 'history .txt 1'],
    );
});

test('an unclassified error, a stale classification, a fault or a wrong count fails the suite', (t) => {
    const game = fixtureGame(tempDir(t));
    const run = (classifications: ClassificationEntry[], folders = FOLDERS): string[] =>
        runParseSuite(game, { catalogue, classifications, folders }).failures;
    assert.deepEqual(run([]), [
        'unclassified error: events/fixture_events.txt:2 syntax/missing-closing-brace',
    ]);
    assert.deepEqual(run([DEFECT, { ...DEFECT, line: 9 }]), [
        'classification matches no error: events/fixture_events.txt:9 syntax/missing-closing-brace',
    ]);
    assert.deepEqual(run([{ ...DEFECT, classification: 'pychivalry-fault' }]), [
        'pychivalry fault: events/fixture_events.txt:2 syntax/missing-closing-brace',
    ]);
    const counted = FOLDERS.map((f) => (f.folder === 'gfx' ? { ...f, excluded: [] } : f));
    assert.deepEqual(run([DEFECT], counted), [
        'gfx holds 2 .txt files; 1 are expected',
        'unclassified error: gfx/lists/names.txt:2 syntax/missing-operator',
    ]);
});

test('the classification file is read strictly', (t) => {
    const dir = tempDir(t);
    writeTree(dir, {
        'good.json': JSON.stringify({ classifications: [DEFECT] }),
        'bad.json': JSON.stringify({ classifications: [{ ...DEFECT, reason: '' }] }),
        'none.json': '{}',
    });
    assert.deepEqual(readClassifications(path.join(dir, 'good.json')), [DEFECT]);
    for (const name of ['bad.json', 'none.json']) {
        assert.throws(
            () => readClassifications(path.join(dir, name)),
            (err: unknown) => err instanceof CommandError && err.exitCode === 2,
        );
    }
    assert.ok(
        readClassifications(path.join(repoRoot(), 'tools', 'data', 'parse-classifications.json'))
            .length > 0,
    );
});

test('every folder of the base-game list says why it is read, and every exclusion why', () => {
    for (const folder of BASE_GAME_FOLDERS) {
        assert.ok(folder.why.length > 0, folder.folder);
        assert.ok(folder.expected > 0, folder.folder);
        for (const excluded of folder.excluded ?? []) {
            assert.ok(excluded.file.startsWith(`${folder.folder}/`), excluded.file);
            assert.ok(excluded.why.length > 0, excluded.file);
        }
    }
    assert.equal(
        BASE_GAME_FOLDERS.reduce((n, f) => n + f.expected, 0),
        4854,
    );
});
