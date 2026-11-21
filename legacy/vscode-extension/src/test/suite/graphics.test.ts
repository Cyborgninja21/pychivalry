/**
 * The graphics-file check (GFX001) in the Extension Development Host: PR #56's fixture
 * (mock-ck3-mod/events/bad_graphics.txt) opened in the editor, with the mock base game
 * (src/test/fixtures/mock-ck3-game) as ck3LanguageServer.gamePath, shows exactly its two
 * missing files as warnings; ck3LanguageServer.graphics.enabled = false clears them.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

const FIXTURES = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures');

function gfx001(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages
        .getDiagnostics(uri)
        .filter((d) => (typeof d.code === 'object' ? d.code.value : d.code) === 'GFX001');
}

/** Wait until `count` GFX001 diagnostics are shown on `uri` (or the time is up). */
async function waitFor(uri: vscode.Uri, count: number, ms = 30_000): Promise<vscode.Diagnostic[]> {
    const until = Date.now() + ms;
    let found = gfx001(uri);
    while (found.length !== count && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        found = gfx001(uri);
    }
    return found;
}

suite('Graphics files (GFX001)', () => {
    const config = () => vscode.workspace.getConfiguration('ck3LanguageServer');
    let originalGamePath: unknown;
    let originalEnabled: unknown;

    suiteSetup(async function () {
        this.timeout(30_000);
        const extension = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
        assert.ok(extension, 'Extension should be installed');
        if (!extension.isActive) {
            await extension.activate();
        }
        originalGamePath = config().inspect('gamePath')?.globalValue;
        originalEnabled = config().inspect('graphics.enabled')?.globalValue;
    });

    suiteTeardown(async function () {
        this.timeout(30_000);
        await config().update(
            'graphics.enabled',
            originalEnabled,
            vscode.ConfigurationTarget.Global
        );
        await config().update('gamePath', originalGamePath, vscode.ConfigurationTarget.Global);
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    test('the fixture shows its two missing graphics files, once each', async function () {
        this.timeout(60_000);
        const file = path.join(FIXTURES, 'mock-ck3-mod', 'events', 'bad_graphics.txt');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
        await vscode.window.showTextDocument(doc);
        await config().update(
            'gamePath',
            path.join(FIXTURES, 'mock-ck3-game'),
            vscode.ConfigurationTarget.Global
        );

        const found = await waitFor(doc.uri, 2);
        assert.deepStrictEqual(
            found
                .map((d) => ({
                    line: d.range.start.line + 1,
                    severity: d.severity,
                    source: d.source,
                    message: d.message,
                    value: doc.getText(d.range),
                }))
                .sort((a, b) => a.line - b.line),
            [
                {
                    line: 16,
                    severity: vscode.DiagnosticSeverity.Warning,
                    source: 'ck3-plugin',
                    message:
                        'Graphics file not found: "gfx/interface/backgrounds/missing_background.dds"',
                    value: '"gfx/interface/backgrounds/missing_background.dds"',
                },
                {
                    line: 22,
                    severity: vscode.DiagnosticSeverity.Warning,
                    source: 'ck3-plugin',
                    message: 'Graphics file not found: "gfx/interface/icons/missing_icon.dds"',
                    value: '"gfx/interface/icons/missing_icon.dds"',
                },
            ]
        );
    });

    test('ck3LanguageServer.graphics.enabled = false clears them', async function () {
        this.timeout(60_000);
        const file = path.join(FIXTURES, 'mock-ck3-mod', 'events', 'bad_graphics.txt');
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
        await vscode.window.showTextDocument(doc);
        assert.strictEqual((await waitFor(doc.uri, 2)).length, 2);
        await config().update('graphics.enabled', false, vscode.ConfigurationTarget.Global);
        assert.strictEqual((await waitFor(doc.uri, 0)).length, 0);
    });
});
