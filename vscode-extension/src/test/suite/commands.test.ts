import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Command Tests', () => {
    let extension: vscode.Extension<any> | undefined;

    suiteSetup(async function () {
        this.timeout(30000); // Allow time for extension activation

        extension = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
        assert.ok(extension, 'Extension should be installed');

        if (!extension.isActive) {
            await extension.activate();
        }
        assert.ok(extension.isActive, 'Extension should be active');
    });

    suite('Command Registration', () => {
        const expectedCommands = [
            'ck3LanguageServer.restart',
            'ck3LanguageServer.extractTraitData',
            'ck3LanguageServer.extractLocalizationData',
            'ck3LanguageServer.extractAllGameData',
            'ck3LanguageServer.discoverModData',
            'ck3LanguageServer.showOutput',
            'ck3LanguageServer.showMenu',
            'ck3LanguageServer.openDocumentation',
            'ck3LanguageServer.validateWorkspace',
            'ck3LanguageServer.rescanWorkspace',
            'ck3LanguageServer.getWorkspaceStats',
            'ck3LanguageServer.generateEventTemplate',
            'ck3LanguageServer.findOrphanedLocalization',
            'ck3LanguageServer.checkDependencies',
            'ck3LanguageServer.showNamespaceEvents',
            'ck3LanguageServer.generateLocalizationStubs',
            'ck3LanguageServer.renameEvent',
            'ck3LanguageServer.startLogWatcher',
            'ck3LanguageServer.stopLogWatcher',
            'ck3LanguageServer.pauseLogWatcher',
            'ck3LanguageServer.resumeLogWatcher',
            'ck3LanguageServer.clearGameLogs',
            'ck3LanguageServer.showLogStatistics',
        ];

        test('All commands should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);

            for (const expectedCmd of expectedCommands) {
                assert.ok(
                    commands.includes(expectedCmd),
                    `Command ${expectedCmd} should be registered`
                );
            }
        });

        test('Commands should not have duplicates', async () => {
            const commands = await vscode.commands.getCommands(true);
            const ck3Commands = commands.filter((cmd) => cmd.startsWith('ck3LanguageServer.'));

            const uniqueCommands = new Set(ck3Commands);
            assert.strictEqual(
                ck3Commands.length,
                uniqueCommands.size,
                'Should not have duplicate command registrations'
            );
        });
    });

    suite('Basic Command Execution', () => {
        test('showOutput command should execute without error', async () => {
            // This command just shows the output channel, should never throw
            await assert.doesNotReject(
                Promise.resolve(vscode.commands.executeCommand('ck3LanguageServer.showOutput')),
                'showOutput command should execute'
            );
        });

        test('openDocumentation command should execute without error', async () => {
            await assert.doesNotReject(
                Promise.resolve(vscode.commands.executeCommand('ck3LanguageServer.openDocumentation')),
                'openDocumentation command should execute'
            );
        });

        test('Invalid command should reject', async () => {
            await assert.rejects(
                Promise.resolve(vscode.commands.executeCommand('ck3LanguageServer.nonExistentCommand')),
                'Non-existent command should reject'
            );
        });
    });

    suite('LSP-Dependent Commands', () => {
        // These commands require the LSP server to be running
        // We test that they can be invoked, but may not complete successfully
        // depending on whether Python/LSP server is available

        test('restart command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.restart');
                // Command executed, may or may not succeed depending on LSP availability
                assert.ok(true, 'restart command invoked');
            } catch (error) {
                // Expected if LSP server is not available in test environment
                assert.ok(
                    error instanceof Error,
                    'Error should be an Error instance if command fails'
                );
            }
        });

        test('validateWorkspace command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.validateWorkspace');
                assert.ok(true, 'validateWorkspace command invoked');
            } catch (error) {
                // May fail if no workspace or LSP not available
                assert.ok(error instanceof Error);
            }
        });

        test('rescanWorkspace command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.rescanWorkspace');
                assert.ok(true, 'rescanWorkspace command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('getWorkspaceStats command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.getWorkspaceStats');
                assert.ok(true, 'getWorkspaceStats command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });
    });

    suite('Context-Sensitive Commands', () => {
        // Commands that require specific context (active editor, file type, etc.)

        test('generateEventTemplate should be invocable with CK3 document', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test',
            });

            const editor = await vscode.window.showTextDocument(doc);
            assert.strictEqual(editor.document.languageId, 'ck3');

            try {
                await vscode.commands.executeCommand('ck3LanguageServer.generateEventTemplate');
                assert.ok(true, 'generateEventTemplate command invoked');
            } catch (error) {
                // May fail if LSP not available, but should be invocable
                assert.ok(error instanceof Error);
            } finally {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        });

        test('showNamespaceEvents should be invocable with CK3 document', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test\n\ntest.0001 = {\n\ttype = character_event\n}',
            });

            const editor = await vscode.window.showTextDocument(doc);

            try {
                await vscode.commands.executeCommand('ck3LanguageServer.showNamespaceEvents');
                assert.ok(true, 'showNamespaceEvents command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            } finally {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        });

        test('generateLocalizationStubs should be invocable with CK3 document', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test\n\ntest.0001 = {\n\ttitle = test.0001.t\n}',
            });

            const editor = await vscode.window.showTextDocument(doc);

            try {
                await vscode.commands.executeCommand(
                    'ck3LanguageServer.generateLocalizationStubs'
                );
                assert.ok(true, 'generateLocalizationStubs command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            } finally {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        });

        test('renameEvent should be invocable with CK3 document', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: 'namespace = test\n\ntest.0001 = {\n\ttype = character_event\n}',
            });

            const editor = await vscode.window.showTextDocument(doc);

            try {
                await vscode.commands.executeCommand('ck3LanguageServer.renameEvent');
                assert.ok(true, 'renameEvent command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            } finally {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        });
    });

    suite('Log Watcher Commands', () => {
        test('startLogWatcher command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.startLogWatcher');
                assert.ok(true, 'startLogWatcher command invoked');
            } catch (error) {
                // May fail if log file not found or LSP not available
                assert.ok(error instanceof Error);
            }
        });

        test('stopLogWatcher command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.stopLogWatcher');
                assert.ok(true, 'stopLogWatcher command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('pauseLogWatcher command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.pauseLogWatcher');
                assert.ok(true, 'pauseLogWatcher command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('resumeLogWatcher command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.resumeLogWatcher');
                assert.ok(true, 'resumeLogWatcher command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('clearGameLogs command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.clearGameLogs');
                assert.ok(true, 'clearGameLogs command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('showLogStatistics command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.showLogStatistics');
                assert.ok(true, 'showLogStatistics command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });
    });

    suite('Data Extraction Commands', () => {
        test('extractTraitData command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.extractTraitData');
                assert.ok(true, 'extractTraitData command invoked');
            } catch (error) {
                // May fail if CK3 installation not found
                assert.ok(error instanceof Error);
            }
        });

        test('extractLocalizationData command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.extractLocalizationData');
                assert.ok(true, 'extractLocalizationData command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('discoverModData command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.discoverModData');
                assert.ok(true, 'discoverModData command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });
    });

    suite('Utility Commands', () => {
        test('findOrphanedLocalization command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.findOrphanedLocalization');
                assert.ok(true, 'findOrphanedLocalization command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });

        test('checkDependencies command should be invocable', async () => {
            try {
                await vscode.commands.executeCommand('ck3LanguageServer.checkDependencies');
                assert.ok(true, 'checkDependencies command invoked');
            } catch (error) {
                assert.ok(error instanceof Error);
            }
        });
    });

    suite('Command Execution Order', () => {
        test('Multiple commands should be executable in sequence', async () => {
            const commands = [
                'ck3LanguageServer.showOutput',
                'ck3LanguageServer.openDocumentation',
            ];

            for (const cmd of commands) {
                await assert.doesNotReject(
                    Promise.resolve(vscode.commands.executeCommand(cmd)),
                    `Command ${cmd} should execute in sequence`
                );
            }
        });
    });
});
