/**
 * The index of GUI types and templates (docs/PLAN.md item 10.4) on its fixtures: the mod
 * `fixtures/mods/gui-index` over the game stub `fixtures/game/gui-index`, whose expected answers
 * are its `expected.json`: every definition with what is in force by the spec package's override
 * rules (part D1), each name written at a place of the mod and the definitions it goes to, and
 * the uses of a type, in any letter case in a GUI file.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CallGraph } from '../calls/graph.js';
import { lookup } from '../lookup/lookup.js';
import { fixtureIndex, repoPath } from '../index/testing.js';
import type { Definition } from '../index/workspace.js';
import { committedSpec } from '../spec/testing.js';
import { extractGui, guiWords } from './extract.js';
import { parseGui } from './parser.js';
import { StringTable } from '../index/strings.js';

interface Place {
    readonly layer: string;
    readonly file: string;
    readonly line: number;
    readonly read?: string;
}

interface Expected {
    readonly definitions: readonly {
        readonly database: string;
        readonly name: string;
        readonly status: string;
        readonly definitions: readonly Place[];
    }[];
    readonly go_to: readonly {
        readonly file: string;
        readonly line: number;
        readonly column: number;
        readonly name: string;
        readonly definitions: readonly Place[];
    }[];
    readonly references: readonly { readonly name: string; readonly uses: readonly Place[] }[];
}

const expected = JSON.parse(
    readFileSync(repoPath('fixtures/mods/gui-index/expected.json'), 'utf8'),
) as Expected;

const index = fixtureIndex('gui-index', 'gui-index');

const placeOf = (d: Definition): Place => ({
    layer: d.layer,
    file: d.file,
    line: d.range.start.line + 1,
    read: d.read,
});

test('every GUI definition of the fixture, with what is in force', () => {
    const found = [...new Set(expected.definitions.map((e) => e.database))].flatMap((database) =>
        [...new Set(index.definitionsOf(database).map((d) => d.name))].sort().map((name) => ({
            database,
            name,
            status: index.resolve(database, name).status,
            definitions: index.definitions(name, { database }).map(placeOf),
        })),
    );
    assert.deepEqual(found, expected.definitions);
});

test('a name written at a place of a mod GUI file goes to its definitions', () => {
    for (const want of expected.go_to) {
        const at = index.nameAt('mod', want.file, {
            line: want.line - 1,
            character: want.column - 1,
        });
        assert.equal(at?.name, want.name, `${want.file}:${String(want.line)}`);
        assert.deepEqual(
            index.definitions(want.name).map(placeOf),
            want.definitions,
            `${want.file}:${String(want.line)}`,
        );
    }
});

test('the uses of a GUI type, in any letter case in a GUI file', () => {
    for (const want of expected.references) {
        assert.deepEqual(
            index.references(want.name).map((u) => ({
                layer: u.layer,
                file: u.file,
                line: u.range.start.line + 1,
            })),
            want.uses,
            want.name,
        );
    }
});

test('a GUI type name is compared in lower case; a template name as written', () => {
    // Part D1's settled row key-identity-gui-types folds a type name; the template registry was
    // not read, so its names are compared byte for byte.
    assert.deepEqual([...index.foldingDatabases], ['gui']);
    assert.equal(index.definitions('FIXTURE_BUTTON', { database: 'gui' }).length, 2);
    assert.equal(index.definitions('fixture_window_background').length, 0);
    assert.equal(index.definitions('Fixture_Window_Background').length, 1);
});

test('lookup answers a GUI name with its definitions, grouped by database', () => {
    const result = lookup('Fixture_Button', {
        spec: committedSpec(),
        index,
        usesLimit: 50,
        suggestions: false,
    });
    const definitions = result.definitions;
    assert.ok(definitions.status === 'read', definitions.status);
    assert.deepEqual(
        definitions.groups.map((g) => [
            g.database,
            g.definitions.map((d) => `${d.layer} ${d.file}`),
        ]),
        [['gui', ['game gui/fixture_window.gui', 'mod gui/fixture_mod_types.gui']]],
    );
    const uses = result.uses;
    assert.ok(uses.status === 'read', uses.status);
    assert.equal(uses.count, 3);
});

test("a GUI file's words: in quoted text and data bindings, never a number or @[ ]", () => {
    const strings = new StringTable();
    const parsed = parseGui(
        'w = {\n\ttext = "[Localize(\'FIXTURE_KEY\')]"\n\tsize = { 100% 5.5f }\n\twidth = @[a + 2]\n\tspacing = @margin\n\tparentanchor = top|right\n}',
    );
    const extracted = extractGui(parsed.file, { strings, defines: true });
    assert.deepEqual(extracted.defs, []);
    const words: string[] = [];
    for (let i = 0; i < extracted.uses.length; i += 2) {
        words.push(strings.get(extracted.uses[i] ?? 0));
    }
    assert.deepEqual(words, [
        'w',
        'text',
        'Localize',
        'FIXTURE_KEY',
        'size',
        'width',
        'spacing',
        '@margin',
        'parentanchor',
        'top',
        'right',
    ]);
    const quoted: [string, number][] = [];
    guiWords(
        {
            kind: 'scalar',
            type: 'string',
            start: 10,
            end: 16,
            text: '"Name"',
            value: 'Name',
            terminated: true,
        },
        (w, at) => quoted.push([w, at]),
    );
    assert.deepEqual(quoted, [['Name', 11]]);
});

test('a type defined outside a types block, or a template inside a block, is no definition', () => {
    const strings = new StringTable();
    const parsed = parseGui(
        'type stray = widget { }\nwindow = { template Inner { } }\ntypes T { type real = widget { } }',
    );
    const extracted = extractGui(parsed.file, { strings, defines: true });
    const names: string[] = [];
    for (let i = 0; i < extracted.defs.length; i += 11) {
        names.push(strings.get(extracted.defs[i] ?? 0));
    }
    assert.deepEqual(names, ['real']);
    // A file in no folder the spec lists defines nothing.
    assert.deepEqual(extractGui(parsed.file, { strings, defines: false }).defs, []);
});

test('a GUI type or template is no definition of the call graph: it calls nothing', () => {
    const graph = new CallGraph({ spec: committedSpec(), index, files: () => undefined });
    assert.deepEqual(graph.definitionsOf('fixture_button'), []);
    assert.deepEqual(graph.definitionsOf('Fixture_Window_Background'), []);
    assert.equal(index.definitions('fixture_button').length, 2);
});
