import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import {
    GUI_FOLDERS,
    readGuiClassifications,
    runGuiSuite,
    valueShape,
    type GuiClassificationEntry,
    type GuiSuiteFolder,
} from './gui-suite.js';
import { tempDir, writeTree } from './testing.js';
import { CommandError } from './util.js';

/** A small install: game/gui with a clean file and a defect, jomini/gui, and a mod. */
function fixtureInstall(dir: string): { game: string; mod: string } {
    writeTree(dir, {
        'game/gui/window.gui':
            '﻿window = {\n\tsize = { 100% 50 }\n\tusing = Window_Background\n\tblockoverride "header" {\n\t\ttext = "[Title]"\n\t}\n}\n',
        'game/gui/shared/types.gui':
            'types Shared\n{\n\ttype header_window = window {\n\t\tblock "header" {}\n\t}\n}\ntemplate Window_Background {\n\talpha = 0.5f\n}\n',
        'game/gui/broken.gui': 'widget = {\n\tsize { 5 0 }\n}\n',
        'game/common/traits/00_traits.txt': 'brave = {}\n',
        'jomini/gui/tool.gui': 'Types Tool { local_type tool_entry = button { } }\n',
        'mod/gui/mod_window.gui': 'window = {\n\tlayoutpolicy_horizontal = expanding;\n}\n',
    });
    return { game: path.join(dir, 'game'), mod: path.join(dir, 'mod') };
}

const FOLDERS: readonly GuiSuiteFolder[] = [
    { layer: 'game', folder: 'gui', expected: 3, why: 'The GUI folder.' },
    { layer: 'jomini', folder: 'gui', expected: 1, why: "jomini's GUI folder." },
];

const DEFECT: GuiClassificationEntry = {
    layer: 'game',
    file: 'gui/broken.gui',
    id: 'syntax/gui-missing-equals',
    line: 2,
    classification: 'game-defect',
    reason: 'Written without its =.',
};

test('the suite parses every GUI file of the folders, classifies every finding and passes', (t) => {
    const { game, mod } = fixtureInstall(tempDir(t));
    const results = runGuiSuite(game, {
        classifications: [DEFECT],
        folders: FOLDERS,
        mods: [{ slug: 'fixture-mod', dir: mod }],
    });
    assert.deepEqual(results.failures, []);
    assert.equal(results.passed, true);
    assert.equal(results.files, 4);
    assert.equal(results.trees, 4);
    assert.deepEqual(
        results.folders.map((f) => [f.layer, f.folder, f.files, f.trees, f.bom, f.findings]),
        [
            ['game', 'gui', 3, 3, 1, 1],
            ['jomini', 'gui', 1, 1, 0, 0],
        ],
    );
    assert.deepEqual(results.findings, [
        {
            layer: 'game',
            file: 'gui/broken.gui',
            line: 2,
            column: 7,
            id: 'syntax/gui-missing-equals',
            message:
                "'size' and its value have no '=' between them: a GUI file writes 'key = value' and 'key = { ... }'.",
            classification: 'game-defect',
            reason: 'Written without its =.',
        },
    ]);
    // A mod's findings are listed, not classified.
    assert.deepEqual(results.mods, [
        {
            slug: 'fixture-mod',
            files: 1,
            trees: 1,
            parse_ms: results.mods[0]?.parse_ms ?? -1,
            findings: [
                {
                    file: 'gui/mod_window.gui',
                    line: 2,
                    column: 37,
                    id: 'syntax/gui-trailing-semicolon',
                    message:
                        "A ';' after 'expanding', which GUI syntax does not use: it is read as part of the word, 'expanding;'.",
                },
            ],
        },
    ]);
});

test('the forms are counted, each with its files, its count by layer and its first place', (t) => {
    const { game } = fixtureInstall(tempDir(t));
    const { forms } = runGuiSuite(game, { classifications: [DEFECT], folders: FOLDERS });
    assert.deepEqual(forms['named:types'], {
        count: 2,
        files: 2,
        by_layer: { game: 1, jomini: 1 },
        example: 'game gui/shared/types.gui:1',
    });
    assert.deepEqual(forms['named:types:keyword-written-Types'], {
        count: 1,
        files: 1,
        by_layer: { jomini: 1 },
        example: 'jomini gui/tool.gui:1',
    });
    assert.equal(forms['type-definition:type:in-types-block']?.count, 1);
    assert.equal(forms['type-definition:local_type']?.count, 1);
    assert.equal(forms['named:template:top-level']?.count, 1);
    assert.equal(forms['named:blockoverride:name-quoted']?.count, 1);
    assert.equal(forms['named:block:name-quoted']?.count, 1);
    assert.equal(forms['using:word']?.count, 1);
    assert.equal(forms['value:number-with-f']?.count, 1);
    assert.equal(forms['value:quoted-data-binding']?.count, 1);
    assert.equal(forms['list-value:percent']?.count, 1);
    assert.equal(forms['property:without-equals']?.count, 1);
});

test('a finding without a classification, and a classification without a finding, fail the suite', (t) => {
    const { game } = fixtureInstall(tempDir(t));
    const stray: GuiClassificationEntry = { ...DEFECT, file: 'gui/window.gui' };
    const results = runGuiSuite(game, { classifications: [stray], folders: FOLDERS });
    assert.equal(results.passed, false);
    assert.deepEqual(results.failures, [
        'unclassified GUI finding: game gui/broken.gui:2 syntax/gui-missing-equals',
        'classification matches no GUI finding: game gui/window.gui:2 syntax/gui-missing-equals',
    ]);
});

test('a folder that holds another number of files than expected fails the suite', (t) => {
    const { game } = fixtureInstall(tempDir(t));
    const results = runGuiSuite(game, {
        classifications: [DEFECT],
        folders: [{ layer: 'game', folder: 'gui', expected: 2, why: 'The GUI folder.' }],
    });
    assert.deepEqual(results.failures, ['game/gui holds 3 .gui files; 2 are expected']);
});

test('the shapes of a value', () => {
    const scalar = (
        text: string,
        type: 'name' | 'string' | 'constant' | 'arithmetic' = 'name',
    ) => ({
        kind: 'scalar' as const,
        type,
        start: 0,
        end: text.length,
        text,
        value: type === 'string' ? text.slice(1, -1) : text,
        terminated: true,
    });
    assert.equal(valueShape(scalar('100%')), 'percent');
    assert.equal(valueShape(scalar('5.5f')), 'number-with-f');
    assert.equal(valueShape(scalar('top|right')), 'flags');
    assert.equal(valueShape(scalar('[Character.IsValid]')), 'data-binding');
    assert.equal(valueShape(scalar('[Not(')), 'data-binding-cut');
    assert.equal(valueShape(scalar('"[A( B )]"', 'string')), 'quoted-data-binding-with-space');
    assert.equal(valueShape(scalar('"TEXT"', 'string')), 'quoted-text');
    assert.equal(valueShape(scalar("'name'")), 'single-quoted');
    assert.equal(valueShape(scalar('@margin', 'constant')), 'constant');
    assert.equal(valueShape(scalar('expanding')), 'word');
});

test('the committed folder list reads the three folders of the install, 583 files', () => {
    assert.deepEqual(
        GUI_FOLDERS.map((f) => [f.layer, f.folder]),
        [
            ['game', 'gui'],
            ['game', 'tweakergui_assets'],
            ['jomini', 'gui'],
            ['jomini', 'jomini'],
            ['clausewitz', 'gui'],
        ],
    );
    assert.equal(
        GUI_FOLDERS.reduce((n, f) => n + f.expected, 0),
        583,
    );
});

test('a classification file of the wrong shape is a usage error', (t) => {
    const dir = tempDir(t);
    writeTree(dir, {
        'a.json': '{ "classifications": [ { "file": "gui/a.gui" } ] }',
        'b.json': '{}',
    });
    const usage = (err: unknown): boolean => err instanceof CommandError && err.exitCode === 2;
    assert.throws(() => readGuiClassifications(path.join(dir, 'a.json')), usage);
    assert.throws(() => readGuiClassifications(path.join(dir, 'b.json')), usage);
});
