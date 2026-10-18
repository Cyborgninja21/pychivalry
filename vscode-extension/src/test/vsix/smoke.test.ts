/**
 * Smoke tests of the extension as installed (runVsix.ts): from the VSIX in a clean
 * extensions folder, or (CK3_SMOKE_MODE=linked) the development build linked by dev:link.
 * The workspace is `example mod/`. Each test asserts one thing a user sees:
 *
 *   - the extension is the installed copy (its folder is in the fresh extensions folder; for
 *     a VSIX not the development path) at the package.json version, and it activates
 *   - a known-bad file gets the engine's diagnostic (01_syntax/bad_syntax.txt line 50:
 *     `unexpected_token_expected_key`, an error)
 *   - a provider answers (hover on `is_adult` in 05_events/good_events.txt)
 *   - the CK3 Explorer has data (its top level from the server's index, the `adventure`
 *     namespace of 13_call_hierarchy/events/ and its event adventure.0001)
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { CK3ExtensionApi } from '../../extension';

const ID = 'cyborgninja21.ck3-language-support';

function env(name: string): string {
    const value = process.env[name];
    assert.ok(value, `${name} is set by runVsix.ts`);
    return value;
}

function real(p: string): string {
    return fs.realpathSync(p);
}

/** Run `query` until `done` accepts its result (the server may still be starting). */
async function poll<T>(query: () => Thenable<T>, done: (value: T) => boolean, ms = 60_000) {
    const until = Date.now() + ms;
    let value = await query();
    while (!done(value) && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        value = await query();
    }
    return value;
}

function workspaceFile(relative: string): vscode.Uri {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'example mod/ is the workspace');
    return vscode.Uri.joinPath(folder.uri, ...relative.split('/'));
}

suite(`Installed extension smoke (${process.env.CK3_SMOKE_MODE ?? 'vsix'})`, () => {
    let api: CK3ExtensionApi;

    suiteTeardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    test('the extension is the installed copy and activates', async () => {
        const extension = vscode.extensions.getExtension<CK3ExtensionApi>(ID);
        assert.ok(extension, `${ID} is installed`);
        const extensionsDir = real(env('CK3_SMOKE_EXTENSIONS_DIR'));
        const devPath = real(env('CK3_SMOKE_DEV_PATH'));
        const location = path.resolve(extension.extensionPath);
        assert.strictEqual(
            real(path.dirname(location)),
            extensionsDir,
            `${location} is in the fresh extensions folder`
        );
        if (env('CK3_SMOKE_MODE') === 'vsix') {
            assert.notStrictEqual(real(location), devPath, 'not the development path');
            assert.ok(
                !fs.existsSync(path.join(location, 'src')),
                'the installed copy carries no sources'
            );
        } else {
            assert.strictEqual(real(location), devPath, 'the link resolves to vscode-extension/');
        }
        assert.strictEqual(extension.packageJSON.version, env('CK3_SMOKE_VERSION'));
        api = extension.isActive ? extension.exports : await extension.activate();
        assert.ok(extension.isActive, 'activated');
        assert.ok(api.modExplorer, 'the extension API is returned');
    });

    test('a known-bad file gets the engine diagnostic', async () => {
        const uri = workspaceFile('01_syntax/bad_syntax.txt');
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
        const diagnostics = await poll(
            () => Promise.resolve(vscode.languages.getDiagnostics(uri)),
            (d) => d.some((x) => x.code === 'unexpected_token_expected_key')
        );
        const hit = diagnostics.find((d) => d.code === 'unexpected_token_expected_key');
        assert.ok(hit, diagnostics.map((d) => `${d.range.start.line + 1} ${d.code}`).join('; '));
        assert.strictEqual(hit.range.start.line, 49, 'line 50');
        assert.strictEqual(hit.severity, vscode.DiagnosticSeverity.Error);
    });

    test('a provider answers: hover on a trigger', async () => {
        const uri = workspaceFile('05_events/good_events.txt');
        const document = await vscode.workspace.openTextDocument(uri);
        const line = document.lineAt(35).text;
        const column = line.indexOf('is_adult');
        assert.ok(column >= 0, `line 36 holds is_adult: ${line}`);
        const hovers = await poll(
            () =>
                vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    uri,
                    new vscode.Position(35, column + 2)
                ),
            (h) => (h ?? []).length > 0
        );
        const text = (hovers ?? [])
            .flatMap((h) => h.contents)
            .map((c) => (typeof c === 'string' ? c : c.value))
            .join('\n');
        assert.ok(text.includes('is_adult'), text);
    });

    test('the CK3 Explorer has data', async () => {
        const top = await poll(
            () => api.modExplorer.getChildren(),
            (nodes) => nodes.length > 0 && nodes.every((n) => (n.count ?? 0) > 0)
        );
        assert.ok(top.length > 0, 'the tree has a top level');
        for (const node of top) {
            assert.ok((node.count ?? 0) > 0, `${node.label} is not empty`);
        }
        const events = top.find((n) => n.id === 'events');
        assert.ok(events, top.map((n) => n.label).join(', '));
        // 13_call_hierarchy/events/ is the example mod's one events folder.
        const namespaces = await api.modExplorer.getChildren(events);
        const adventure = namespaces.find((n) => n.label === 'adventure');
        assert.ok(adventure, namespaces.map((n) => n.label).join(', '));
        const items = await api.modExplorer.getChildren(adventure);
        assert.ok(
            items.some((n) => n.label === 'adventure.0001' && n.location),
            items.map((n) => n.label).join(', ')
        );
    });
});
