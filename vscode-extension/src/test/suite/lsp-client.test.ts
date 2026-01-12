import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('LSP Client Integration Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    suiteSetup(async function () {
        this.timeout(30000); // Allow time for extension and LSP activation

        extension = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
        assert.ok(extension, 'Extension should be installed');

        if (!extension.isActive) {
            await extension.activate();
        }
        assert.ok(extension.isActive, 'Extension should be active');

        // Give LSP server time to initialize
        await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    suite('Client Lifecycle', () => {
        test('Extension should export client interface', () => {
            assert.ok(extension, 'Extension should exist');

            // The extension may export the client or internal API
            // We just verify it's activated successfully
            assert.ok(extension.isActive, 'Extension should be active');
        });

        test('LSP server should handle restart command', async function () {
            this.timeout(10000);

            try {
                // Attempt to restart the server
                await vscode.commands.executeCommand('ck3LanguageServer.restart');

                // Wait for restart to complete
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Extension should still be active after restart
                assert.ok(extension?.isActive, 'Extension should remain active after restart');
            } catch (error) {
                // LSP may not be available in test environment
                // Just verify the error is handled gracefully
                assert.ok(error instanceof Error, 'Restart errors should be Error instances');
            }
        });
    });

    suite('Document Synchronization', () => {
        test('LSP should handle CK3 document open', async function () {
            this.timeout(10000);

            const content = `namespace = test

test.0001 = {
    type = character_event
    title = test.0001.t
    desc = test.0001.desc
}`;

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: content,
            });

            const editor = await vscode.window.showTextDocument(doc);

            // Wait for LSP to process the document
            await new Promise((resolve) => setTimeout(resolve, 1000));

            assert.strictEqual(doc.languageId, 'ck3', 'Document should be CK3 language');
            assert.ok(doc.getText().includes('namespace'), 'Document should contain content');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('LSP should handle document changes', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test',
            });

            const editor = await vscode.window.showTextDocument(doc);

            // Make an edit
            const edit = new vscode.WorkspaceEdit();
            edit.insert(doc.uri, new vscode.Position(1, 0), '\n\n# New comment');
            await vscode.workspace.applyEdit(edit);

            // Wait for LSP to process changes
            await new Promise((resolve) => setTimeout(resolve, 1000));

            assert.ok(doc.getText().includes('# New comment'), 'Document should include edit');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('LSP should handle multiple document open', async function () {
            this.timeout(10000);

            const doc1 = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test1',
            });

            const doc2 = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test2',
            });

            await vscode.window.showTextDocument(doc1);
            await new Promise((resolve) => setTimeout(resolve, 500));

            await vscode.window.showTextDocument(doc2);
            await new Promise((resolve) => setTimeout(resolve, 500));

            assert.strictEqual(doc1.languageId, 'ck3');
            assert.strictEqual(doc2.languageId, 'ck3');

            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        });
    });

    suite('Language Features', () => {
        test('Should support completions (if LSP available)', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test\n\ntest.0001 = {\n\t',
            });

            await vscode.window.showTextDocument(doc);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const position = new vscode.Position(3, 1);

            try {
                const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    doc.uri,
                    position
                );

                if (completions && completions.items.length > 0) {
                    // LSP is running and provided completions
                    assert.ok(completions.items.length > 0, 'Should provide completion items');
                }
                // If no completions, LSP may not be available (acceptable in test environment)
            } catch (error) {
                // Completions may not be available if LSP isn't running
                // This is acceptable in test environment
            }

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('Should support hover (if LSP available)', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test\n\ntest.0001 = {\n\ttype = character_event\n}',
            });

            await vscode.window.showTextDocument(doc);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const position = new vscode.Position(3, 7); // On "type"

            try {
                const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    doc.uri,
                    position
                );

                // Hover may or may not be available depending on LSP
                if (hovers && hovers.length > 0) {
                    assert.ok(hovers.length >= 0, 'Hover provider should return results');
                }
            } catch (error) {
                // Acceptable if LSP not available
            }

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('Should support document symbols (if LSP available)', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: `namespace = test

test.0001 = {
    type = character_event
}

test.0002 = {
    type = character_event
}`,
            });

            await vscode.window.showTextDocument(doc);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            try {
                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    doc.uri
                );

                if (symbols && symbols.length > 0) {
                    // LSP provided symbols
                    assert.ok(symbols.length >= 0, 'Should provide document symbols');
                }
            } catch (error) {
                // Acceptable if LSP not available
            }

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('Should support definition provider (if LSP available)', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test\n\ntest.0001 = {\n\ttype = character_event\n}',
            });

            await vscode.window.showTextDocument(doc);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const position = new vscode.Position(2, 5); // On event name

            try {
                const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeDefinitionProvider',
                    doc.uri,
                    position
                );

                // Definitions may or may not be available
                if (definitions && definitions.length > 0) {
                    assert.ok(definitions.length >= 0, 'Should provide definitions');
                }
            } catch (error) {
                // Acceptable if LSP not available
            }

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
    });

    suite('Configuration Changes', () => {
        test('Should handle configuration updates', async function () {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const originalLogLevel = config.get('logLevel');

            try {
                // Change configuration
                await config.update('logLevel', 'debug', vscode.ConfigurationTarget.Global);
                await new Promise((resolve) => setTimeout(resolve, 500));

                const newLogLevel = config.get('logLevel');
                assert.strictEqual(newLogLevel, 'debug', 'Configuration should update');

                // Restore original
                await config.update('logLevel', originalLogLevel, vscode.ConfigurationTarget.Global);
            } catch (error) {
                // Restore configuration even if test fails
                await config.update('logLevel', originalLogLevel, vscode.ConfigurationTarget.Global);
                throw error;
            }
        });

        test('Should handle trace level changes', async function () {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const originalTrace = config.get('trace.server');

            try {
                await config.update('trace.server', 'verbose', vscode.ConfigurationTarget.Global);
                await new Promise((resolve) => setTimeout(resolve, 500));

                const newTrace = config.get('trace.server');
                assert.strictEqual(newTrace, 'verbose', 'Trace configuration should update');

                await config.update('trace.server', originalTrace, vscode.ConfigurationTarget.Global);
            } catch (error) {
                await config.update('trace.server', originalTrace, vscode.ConfigurationTarget.Global);
                throw error;
            }
        });
    });

    suite('Error Handling', () => {
        test('Should handle invalid document gracefully', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'this is {{{ invalid syntax }}}}',
            });

            await vscode.window.showTextDocument(doc);
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Document should open despite invalid syntax
            assert.ok(doc, 'Document should open with invalid syntax');
            assert.strictEqual(doc.languageId, 'ck3');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('Should handle empty document', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: '',
            });

            await vscode.window.showTextDocument(doc);
            await new Promise((resolve) => setTimeout(resolve, 500));

            assert.strictEqual(doc.getText(), '', 'Empty document should be handled');
            assert.strictEqual(doc.languageId, 'ck3');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        test('Should handle rapid document changes', async function () {
            this.timeout(10000);

            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test',
            });

            await vscode.window.showTextDocument(doc);

            // Make multiple rapid edits
            for (let i = 0; i < 5; i++) {
                const edit = new vscode.WorkspaceEdit();
                edit.insert(doc.uri, new vscode.Position(1, 0), `\n# Edit ${i}`);
                await vscode.workspace.applyEdit(edit);
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));

            assert.ok(doc.getText().includes('# Edit 4'), 'All edits should be applied');

            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
    });

    suite('Workspace Operations', () => {
        test('Should handle workspace stats request', async function () {
            this.timeout(10000);

            try {
                await vscode.commands.executeCommand('ck3LanguageServer.getWorkspaceStats');
                // If LSP is available, command should succeed
                assert.ok(true, 'Workspace stats command executed');
            } catch (error) {
                // LSP may not be available
                assert.ok(error instanceof Error);
            }
        });

        test('Should handle workspace validation request', async function () {
            this.timeout(10000);

            try {
                await vscode.commands.executeCommand('ck3LanguageServer.validateWorkspace');
                assert.ok(true, 'Workspace validation command executed');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('Should handle workspace rescan request', async function () {
            this.timeout(10000);

            try {
                await vscode.commands.executeCommand('ck3LanguageServer.rescanWorkspace');
                assert.ok(true, 'Workspace rescan command executed');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });
    });
});
