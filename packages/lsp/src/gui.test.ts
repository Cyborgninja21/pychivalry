/**
 * GUI files in the editor (docs/PLAN.md item 10.4; docs/gui-syntax.md), over a real round trip:
 * go to definition and find references on GUI types and templates, the fixture mod `gui-index`
 * read over the game stub `gui-index` (whose `expected.json` the core's own test holds); the
 * outline of a GUI file; the GUI parser's findings as diagnostics; and no formatting, said once.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { SymbolKind, type DocumentSymbol } from 'vscode-languageserver-protocol/node';
import { GUI_NOT_FORMATTED } from '@pychivalry/core';
import { GAMES, modCopy, MODS, readDocument, spawnServer, uriOf } from './testing.js';

const MOD = path.join(MODS, 'gui-index');
const STUB = path.join(GAMES, 'gui-index');
const GAME = path.join(STUB, 'game');
const WINDOW = path.join(MOD, 'gui', 'fixture_mod_window.gui');
const TYPES = path.join(MOD, 'gui', 'fixture_mod_types.gui');

/** The line and character of the first `needle` in `text`, plus `shift` characters. */
function at(text: string, needle: string, shift = 0): { line: number; character: number } {
    const offset = text.indexOf(needle);
    assert.ok(offset >= 0, needle);
    const before = text.slice(0, offset + shift);
    const line = before.split(/\r?\n/).length - 1;
    return { line, character: before.length - Math.max(before.lastIndexOf('\n'), -1) - 1 };
}

const tree = (symbols: readonly DocumentSymbol[]): unknown =>
    symbols.map((s) => [s.name, s.kind, ...(s.children === undefined ? [] : [tree(s.children)])]);

test('GUI files in the editor: definitions, references, symbols, no formatting', async (t) => {
    const { client } = spawnServer(t, { gamePath: GAME });
    await client.start([MOD]);
    await client.settled();
    const text = readDocument(WINDOW);
    const uri = await client.open(WINDOW, text, 'ck3-gui');

    await t.test('a template goes to its one definition, in the base game', async () => {
        const pos = at(text, 'Fixture_Window_Background', 2);
        const found = await client.definition(uri, pos.line, pos.character);
        assert.deepEqual(
            found?.map((l) => [l.uri, l.range.start.line]),
            [[uriOf(path.join(GAME, 'gui', 'fixture_window.gui')), 18]],
        );
    });

    await t.test(
        'a type in another letter case goes to both definitions: winner not known',
        async () => {
            const pos = at(text, 'FIXTURE_BUTTON', 2);
            const found = await client.definition(uri, pos.line, pos.character);
            assert.deepEqual(
                new Set(found?.map((l) => l.uri)),
                new Set([uriOf(path.join(GAME, 'gui', 'fixture_window.gui')), uriOf(TYPES)]),
            );
        },
    );

    await t.test("a type whose file the mod replaces goes to the mod's definition", async () => {
        const pos = at(text, 'fixture_replaced_type', 2);
        const found = await client.definition(uri, pos.line, pos.character);
        assert.deepEqual(
            found?.map((l) => l.uri),
            [uriOf(path.join(MOD, 'gui', 'fixture_replaced.gui'))],
        );
    });

    await t.test(
        'references of a type: every place, in any letter case in a GUI file',
        async () => {
            const pos = at(text, 'FIXTURE_BUTTON', 2);
            const uses = await client.references(uri, pos.line, pos.character);
            assert.deepEqual(uses?.map((l) => [path.basename(l.uri), l.range.start.line]).sort(), [
                ['fixture_mod_window.gui', 6],
                ['fixture_window.gui', 4],
                ['fixture_window.gui', 7],
            ]);
        },
    );

    await t.test(
        "a GUI file's outline: its types blocks with their types, its templates",
        async () => {
            const types = await client.open(TYPES, readDocument(TYPES), 'ck3-gui');
            const symbols = await client.symbols(types);
            assert.deepEqual(tree(symbols ?? []), [
                [
                    'FixtureModTypes',
                    SymbolKind.Namespace,
                    [
                        ['fixture_button', SymbolKind.Class],
                        ['fixture_local_type', SymbolKind.Class],
                    ],
                ],
                ['Fixture_Mod_Template', SymbolKind.Struct],
                ['Fixture_Local', SymbolKind.Struct],
            ]);
            await client.close(types);
        },
    );

    await t.test('Format Document gives no edit on a GUI file, and says why once', async () => {
        const edits: unknown = await client.connection.sendRequest('textDocument/formatting', {
            textDocument: { uri },
            options: { tabSize: 4, insertSpaces: false },
        });
        assert.deepEqual(edits, []);
        await client.until(
            () => client.messages.some((m) => m.message.includes(GUI_NOT_FORMATTED)),
            'the message that GUI files are not formatted',
        );
    });
});

test("a GUI file's findings are the GUI parser's, shown as diagnostics", async (t) => {
    const mod = modCopy(t, 'gui-missing-equals-bad');
    const { client } = spawnServer(t, { gamePath: GAME });
    await client.start([mod]);
    await client.settled();
    const file = path.join(mod, 'gui', 'fixture_window.gui');
    const diagnostics = await client.diagnosticsOf(uriOf(file), (d) => d.length > 0);
    assert.deepEqual(
        diagnostics.map((d) => [d.code, d.range.start.line + 1, d.range.start.character + 1]),
        [
            ['syntax/gui-missing-equals', 4, 8],
            ['syntax/gui-missing-equals', 7, 9],
        ],
    );
});
