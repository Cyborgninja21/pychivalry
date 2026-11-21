/**
 * The 2.3 editor features in the Extension Development Host: colour swatches and picker
 * presentations (#79) on a GUI fixture (read by the token path: the engine parser reports
 * errors on GUI syntax) and a script fixture (read from the tree), on-type formatting (#80)
 * on a script fixture, and the CK3 Explorer view (#83): its data through ck3/modStructure
 * on the test workspace and the reveal command.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import type { CK3ExtensionApi } from '../../extension';
import type { ModStructureNode } from '../../client/mod-explorer-model';

const FIXTURES = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'test',
    'fixtures',
    'editor-features'
);

async function api(): Promise<CK3ExtensionApi> {
    const extension = vscode.extensions.getExtension<CK3ExtensionApi>(
        'cyborgninja21.ck3-language-support'
    );
    assert.ok(extension, 'Extension should be installed');
    return extension.isActive ? extension.exports : await extension.activate();
}

/** Run `query` until `done` accepts its result (the server may still be starting). */
async function poll<T>(query: () => Thenable<T>, done: (value: T) => boolean, ms = 30_000) {
    const until = Date.now() + ms;
    let value = await query();
    while (!done(value) && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        value = await query();
    }
    return value;
}

async function open(name: string): Promise<vscode.TextDocument> {
    const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(path.join(FIXTURES, name))
    );
    await vscode.window.showTextDocument(document);
    return document;
}

function colors(document: vscode.TextDocument): Thenable<vscode.ColorInformation[]> {
    return vscode.commands.executeCommand<vscode.ColorInformation[]>(
        'vscode.executeDocumentColorProvider',
        document.uri
    );
}

suite('Editor features (2.3)', () => {
    suiteSetup(async function () {
        this.timeout(60_000);
        await api();
    });

    suiteTeardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    suite('Colour provider (#79)', () => {
        test('a GUI file shows its colour values (token path)', async function () {
            this.timeout(60_000);
            const document = await open('colors.gui');
            const found = await poll(
                () => colors(document),
                (c) => (c ?? []).length >= 3
            );
            assert.deepStrictEqual(
                found.map((c) => document.getText(c.range)),
                ['{ 1 0.5 0.1 0.8 }', '{ 0.9 0.9 0 1 }', '{ 200 20 0 0.8 }']
            );
            const tint = found[0].color;
            assert.deepStrictEqual(
                [tint.red, tint.green, tint.blue, tint.alpha],
                [1, 0.5, 0.1, 0.8]
            );
            const presentations = await vscode.commands.executeCommand<vscode.ColorPresentation[]>(
                'vscode.executeColorPresentationProvider',
                new vscode.Color(0, 0, 1, 0.5),
                {
                    uri: document.uri,
                    range: found[0].range,
                }
            );
            assert.deepStrictEqual(
                presentations.map((p) => p.label),
                ['{ 0.0 0.0 1.0 0.5 }']
            );
        });

        test('a script file shows every notation it uses (tree path)', async function () {
            this.timeout(60_000);
            const document = await open('colors.txt');
            const found = await poll(
                () => colors(document),
                (c) => (c ?? []).length >= 5
            );
            assert.deepStrictEqual(
                found.map((c) => document.getText(c.range)),
                [
                    '{ 0.8 0.2 0.2 }',
                    'rgb { 201 166 138 }',
                    'hsv{ 0.58 0.8 0.4 }',
                    'hsv360{ 021 074 045 }',
                    '{ 161 67 0 }',
                ]
            );
            const presentations = await vscode.commands.executeCommand<vscode.ColorPresentation[]>(
                'vscode.executeColorPresentationProvider',
                new vscode.Color(1, 0, 0, 1),
                {
                    uri: document.uri,
                    range: found[1].range,
                }
            );
            assert.strictEqual(presentations[0].label, 'rgb { 255 0 0 }');
            assert.deepStrictEqual(presentations[0].textEdit?.range, found[1].range);
        });
    });

    suite('On-type formatting (#80)', () => {
        const options = { tabSize: 4, insertSpaces: false };

        function onType(
            document: vscode.TextDocument,
            position: vscode.Position,
            ch: string
        ): Thenable<vscode.TextEdit[]> {
            return vscode.commands.executeCommand<vscode.TextEdit[]>(
                'vscode.executeFormatOnTypeProvider',
                document.uri,
                position,
                ch,
                options
            );
        }

        test('Enter indents to the block depth; } aligns with its opener', async function () {
            this.timeout(60_000);
            const document = await open('on-type.txt');
            const enter = await poll(
                () => onType(document, new vscode.Position(3, 0), '\n'),
                (e) => (e ?? []).length > 0
            );
            assert.deepStrictEqual(
                enter.map((e) => [e.range.start.line, e.range.end.character, e.newText]),
                [[3, 0, '\t\t\t']]
            );
            const brace = await onType(document, new vscode.Position(5, 1), '}');
            assert.deepStrictEqual(
                brace.map((e) => [e.range.start.line, e.range.end.character, e.newText]),
                [[5, 0, '\t']]
            );
        });

        test('the settings decide tabs or spaces', async function () {
            this.timeout(60_000);
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const original = config.inspect('formatting.insertSpaces')?.globalValue;
            const originalSize = config.inspect('formatting.tabSize')?.globalValue;
            try {
                await config.update(
                    'formatting.insertSpaces',
                    true,
                    vscode.ConfigurationTarget.Global
                );
                await config.update('formatting.tabSize', 2, vscode.ConfigurationTarget.Global);
                const document = await open('on-type.txt');
                const enter = await poll(
                    () => onType(document, new vscode.Position(3, 0), '\n'),
                    (e) => (e ?? []).length > 0 && e[0].newText === '      '
                );
                assert.deepStrictEqual(
                    enter.map((e) => e.newText),
                    ['      ']
                );
            } finally {
                await config.update(
                    'formatting.insertSpaces',
                    original,
                    vscode.ConfigurationTarget.Global
                );
                await config.update(
                    'formatting.tabSize',
                    originalSize,
                    vscode.ConfigurationTarget.Global
                );
            }
        });
    });

    suite('CK3 Explorer (#83)', () => {
        test('the tree lists the workspace structure and reveals a definition', async function () {
            this.timeout(60_000);
            const { modExplorer } = await api();
            const top = await poll(
                () => modExplorer.getChildren(),
                (nodes) => nodes.some((n) => n.id === 'events')
            );
            const labels = top.map((n) => n.label);
            assert.ok(labels.includes('Events'), labels.join(', '));
            assert.ok(labels.includes('Localization'), labels.join(', '));
            for (const node of top) {
                assert.ok((node.count ?? 0) > 0, `${node.label} is not empty`);
            }
            const events = top.find((n) => n.id === 'events')!;
            const namespaces = await modExplorer.getChildren(events);
            const testMod = namespaces.find((n) => n.label === 'test_mod');
            assert.ok(testMod, namespaces.map((n) => n.label).join(', '));
            const items: ModStructureNode[] = await modExplorer.getChildren(testMod);
            assert.strictEqual(items.length, testMod.count);
            const first = items.find((n) => n.label === 'test_mod.0001');
            assert.ok(first?.location, 'test_mod.0001 has a location');
            assert.strictEqual(first.detail, 'character_event');

            // An event item reveals its definition through the reveal command (checked on a
            // localization file below: the background-validation suite needs
            // events/test_events.txt never to have been opened).
            const eventItem = modExplorer.getTreeItem(first);
            assert.strictEqual(eventItem.command?.command, 'ck3LanguageServer.revealModItem');
            assert.deepStrictEqual(eventItem.command.arguments, [
                first.location.uri,
                first.location.range,
            ]);

            const localization = top.find((n) => n.id === 'localization')!;
            const languages = await modExplorer.getChildren(localization);
            const english = languages.find((n) => n.label === 'english');
            assert.ok(english, languages.map((n) => n.label).join(', '));
            const files = await modExplorer.getChildren(english);
            const file = files.find((n) => n.label === 'test_events_l_english.yml');
            assert.ok(file?.location, files.map((n) => n.label).join(', '));
            assert.ok((file.count ?? 0) > 0, 'the file has keys');
            const item = modExplorer.getTreeItem(file);
            assert.ok(item.command);
            await vscode.commands.executeCommand(
                item.command.command,
                ...(item.command.arguments ?? [])
            );
            const editor = vscode.window.activeTextEditor;
            assert.ok(editor, 'an editor is open');
            assert.strictEqual(
                editor.document.uri.toString(),
                vscode.Uri.parse(file.location.uri).toString()
            );
            assert.strictEqual(editor.selection.active.line, 0);
        });

        test('the view and its commands are contributed', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('ck3LanguageServer.refreshModExplorer'));
            assert.ok(commands.includes('ck3LanguageServer.revealModItem'));
            await vscode.commands.executeCommand('ck3LanguageServer.refreshModExplorer');
        });
    });
});
