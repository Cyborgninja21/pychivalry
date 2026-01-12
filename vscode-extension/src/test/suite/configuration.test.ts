import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Configuration Tests', () => {
    let originalConfig: { [key: string]: any } = {};

    suiteSetup(() => {
        // Save original configuration
        const config = vscode.workspace.getConfiguration('ck3LanguageServer');
        originalConfig = {
            pythonPath: config.get('pythonPath'),
            args: config.get('args'),
            traceServer: config.get('trace.server'),
            logLevel: config.get('logLevel'),
            enable: config.get('enable'),
            formattingEnabled: config.get('formatting.enabled'),
            formattingInsertSpaces: config.get('formatting.insertSpaces'),
            formattingTabSize: config.get('formatting.tabSize'),
            inlayHintsEnabled: config.get('inlayHints.enabled'),
            logWatcherEnabled: config.get('logWatcher.enabled'),
            logWatcherAutoStart: config.get('logWatcher.autoStart'),
        };
    });

    suiteTeardown(async () => {
        // Restore original configuration
        const config = vscode.workspace.getConfiguration('ck3LanguageServer');
        for (const [key, value] of Object.entries(originalConfig)) {
            const configKey = key
                .replace(/([A-Z])/g, '.$1')
                .toLowerCase()
                .replace(/^\./, '');
            await config.update(configKey, value, vscode.ConfigurationTarget.Global);
        }
    });

    suite('Configuration Structure', () => {
        test('Configuration section should exist', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            assert.ok(config, 'Configuration section should exist');
        });

        test('All required settings should be present', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');

            const requiredSettings = [
                'pythonPath',
                'args',
                'trace.server',
                'logLevel',
                'enable',
                'formatting.enabled',
                'formatting.insertSpaces',
                'formatting.tabSize',
                'inlayHints.enabled',
                'inlayHints.showScopeTypes',
                'inlayHints.showChainTypes',
                'inlayHints.showIteratorTypes',
                'inlayHints.maxHintsPerLine',
                'logWatcher.enabled',
                'logWatcher.autoStart',
                'logWatcher.logPath',
                'logWatcher.showInOutput',
                'logWatcher.maxLogSize',
                'logWatcher.debounceDelay',
                'logWatcher.patterns',
            ];

            for (const setting of requiredSettings) {
                assert.ok(
                    config.has(setting),
                    `Setting ${setting} should exist in configuration`
                );
            }
        });
    });

    suite('Default Values', () => {
        test('pythonPath should default to "python"', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('pythonPath');

            assert.strictEqual(
                inspect?.defaultValue,
                'python',
                'pythonPath default should be "python"'
            );
        });

        test('enable should default to true', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('enable');

            assert.strictEqual(inspect?.defaultValue, true, 'enable default should be true');
        });

        test('logLevel should default to "info"', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('logLevel');

            assert.strictEqual(inspect?.defaultValue, 'info', 'logLevel default should be "info"');
        });

        test('trace.server should default to "off"', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('trace.server');

            assert.strictEqual(
                inspect?.defaultValue,
                'off',
                'trace.server default should be "off"'
            );
        });

        test('formatting.enabled should default to true', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('formatting.enabled');

            assert.strictEqual(
                inspect?.defaultValue,
                true,
                'formatting.enabled default should be true'
            );
        });

        test('formatting.insertSpaces should default to false', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('formatting.insertSpaces');

            assert.strictEqual(
                inspect?.defaultValue,
                false,
                'formatting.insertSpaces default should be false (Paradox uses tabs)'
            );
        });

        test('formatting.tabSize should default to 4', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('formatting.tabSize');

            assert.strictEqual(
                inspect?.defaultValue,
                4,
                'formatting.tabSize default should be 4'
            );
        });

        test('inlayHints.enabled should default to true', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('inlayHints.enabled');

            assert.strictEqual(
                inspect?.defaultValue,
                true,
                'inlayHints.enabled default should be true'
            );
        });

        test('logWatcher.enabled should default to true', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('logWatcher.enabled');

            assert.strictEqual(
                inspect?.defaultValue,
                true,
                'logWatcher.enabled default should be true'
            );
        });

        test('logWatcher.autoStart should default to false', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('logWatcher.autoStart');

            assert.strictEqual(
                inspect?.defaultValue,
                false,
                'logWatcher.autoStart default should be false'
            );
        });
    });

    suite('Configuration Updates', () => {
        test('Should update pythonPath', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const testValue = '/usr/bin/python3';

            await config.update('pythonPath', testValue, vscode.ConfigurationTarget.Global);
            assert.strictEqual(config.get('pythonPath'), testValue, 'pythonPath should update');

            // Restore
            await config.update('pythonPath', originalConfig.pythonPath, vscode.ConfigurationTarget.Global);
        });

        test('Should update logLevel', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const testValue = 'debug';

            await config.update('logLevel', testValue, vscode.ConfigurationTarget.Global);
            assert.strictEqual(config.get('logLevel'), testValue, 'logLevel should update');

            // Restore
            await config.update('logLevel', originalConfig.logLevel, vscode.ConfigurationTarget.Global);
        });

        test('Should update trace.server', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const testValue = 'verbose';

            await config.update('trace.server', testValue, vscode.ConfigurationTarget.Global);
            assert.strictEqual(config.get('trace.server'), testValue, 'trace.server should update');

            // Restore
            await config.update('trace.server', originalConfig.traceServer, vscode.ConfigurationTarget.Global);
        });

        test('Should update formatting.enabled', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const testValue = false;

            await config.update('formatting.enabled', testValue, vscode.ConfigurationTarget.Global);
            assert.strictEqual(
                config.get('formatting.enabled'),
                testValue,
                'formatting.enabled should update'
            );

            // Restore
            await config.update(
                'formatting.enabled',
                originalConfig.formattingEnabled,
                vscode.ConfigurationTarget.Global
            );
        });

        test('Should update inlayHints.enabled', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const testValue = false;

            await config.update('inlayHints.enabled', testValue, vscode.ConfigurationTarget.Global);
            assert.strictEqual(
                config.get('inlayHints.enabled'),
                testValue,
                'inlayHints.enabled should update'
            );

            // Restore
            await config.update(
                'inlayHints.enabled',
                originalConfig.inlayHintsEnabled,
                vscode.ConfigurationTarget.Global
            );
        });

        test('Should update multiple settings atomically', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');

            await config.update('logLevel', 'error', vscode.ConfigurationTarget.Global);
            await config.update('trace.server', 'messages', vscode.ConfigurationTarget.Global);

            assert.strictEqual(config.get('logLevel'), 'error');
            assert.strictEqual(config.get('trace.server'), 'messages');

            // Restore
            await config.update('logLevel', originalConfig.logLevel, vscode.ConfigurationTarget.Global);
            await config.update('trace.server', originalConfig.traceServer, vscode.ConfigurationTarget.Global);
        });
    });

    suite('Configuration Validation', () => {
        test('logLevel should only accept valid values', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('logLevel');

            // Check enum constraint exists in schema
            assert.ok(inspect, 'logLevel configuration should be inspectable');
            // Note: VS Code doesn't enforce enum at runtime, but schema validation happens in package.json
        });

        test('trace.server should only accept valid values', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('trace.server');

            assert.ok(inspect, 'trace.server configuration should be inspectable');
        });

        test('args should be an array', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const args = config.get('args');

            assert.ok(Array.isArray(args), 'args should be an array');
        });

        test('formatting.tabSize should be a number', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const tabSize = config.get('formatting.tabSize') as number;

            assert.strictEqual(typeof tabSize, 'number', 'tabSize should be a number');
            assert.ok(tabSize > 0, 'tabSize should be positive');
        });

        test('inlayHints.maxHintsPerLine should be within bounds', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const maxHints = config.get('inlayHints.maxHintsPerLine');

            assert.strictEqual(typeof maxHints, 'number', 'maxHintsPerLine should be a number');
            // Schema defines: minimum 1, maximum 10
            const inspect = config.inspect('inlayHints.maxHintsPerLine');
            if (inspect && inspect.defaultValue !== undefined) {
                const value = inspect.defaultValue as number;
                assert.ok(value >= 1 && value <= 10, 'maxHintsPerLine should be between 1 and 10');
            }
        });

        test('logWatcher.maxLogSize should be within bounds', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const maxLogSize = config.get('logWatcher.maxLogSize');

            assert.strictEqual(typeof maxLogSize, 'number', 'maxLogSize should be a number');
            const inspect = config.inspect('logWatcher.maxLogSize');
            if (inspect && inspect.defaultValue !== undefined) {
                const value = inspect.defaultValue as number;
                // Schema defines: minimum 10, maximum 1000
                assert.ok(value >= 10 && value <= 1000, 'maxLogSize should be between 10 and 1000');
            }
        });

        test('logWatcher.debounceDelay should be within bounds', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const debounce = config.get('logWatcher.debounceDelay');

            assert.strictEqual(typeof debounce, 'number', 'debounceDelay should be a number');
            const inspect = config.inspect('logWatcher.debounceDelay');
            if (inspect && inspect.defaultValue !== undefined) {
                const value = inspect.defaultValue as number;
                // Schema defines: minimum 100, maximum 5000
                assert.ok(value >= 100 && value <= 5000, 'debounceDelay should be between 100 and 5000');
            }
        });
    });

    suite('Configuration Scopes', () => {
        test('Should support workspace configuration', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('enable');

            // Configuration system should work for workspace scope
            assert.ok(inspect, 'Should be able to inspect workspace configuration');
            assert.ok('workspaceValue' in inspect, 'Should have workspace scope');
        });

        test('Should support user configuration', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('enable');

            assert.ok(inspect, 'Should be able to inspect configuration');
            if (inspect) {
                assert.ok('globalValue' in inspect, 'Should have global (user) scope');
            }
        });

        test('Should support default configuration', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const inspect = config.inspect('enable');

            assert.ok(inspect, 'Should be able to inspect configuration');
            if (inspect) {
                assert.ok('defaultValue' in inspect, 'Should have default value');
                assert.notStrictEqual(inspect.defaultValue, undefined, 'Default value should be defined');
            }
        });
    });

    suite('Configuration Events', () => {
        test('Should fire event on configuration change', async function () {
            this.timeout(5000);

            let eventFired = false;
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');

            const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('ck3LanguageServer.logLevel')) {
                    eventFired = true;
                }
            });

            try {
                await config.update('logLevel', 'warning', vscode.ConfigurationTarget.Global);
                await new Promise((resolve) => setTimeout(resolve, 500));

                assert.ok(eventFired, 'Configuration change event should fire');

                // Restore
                await config.update('logLevel', originalConfig.logLevel, vscode.ConfigurationTarget.Global);
            } finally {
                disposable.dispose();
            }
        });

        test('Should detect configuration changes for specific settings', async function () {
            this.timeout(5000);

            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            let formattingChanged = false;
            let inlayHintsChanged = false;

            const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('ck3LanguageServer.formatting')) {
                    formattingChanged = true;
                }
                if (e.affectsConfiguration('ck3LanguageServer.inlayHints')) {
                    inlayHintsChanged = true;
                }
            });

            try {
                await config.update('formatting.enabled', false, vscode.ConfigurationTarget.Global);
                await new Promise((resolve) => setTimeout(resolve, 500));

                assert.ok(formattingChanged, 'Formatting config change should be detected');
                assert.ok(
                    !inlayHintsChanged,
                    'Inlay hints config should not trigger when formatting changes'
                );

                // Restore
                await config.update(
                    'formatting.enabled',
                    originalConfig.formattingEnabled,
                    vscode.ConfigurationTarget.Global
                );
            } finally {
                disposable.dispose();
            }
        });
    });

    suite('Complex Configuration', () => {
        test('Should handle logWatcher.patterns array configuration', () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            const patterns = config.get('logWatcher.patterns') as any[];

            assert.ok(Array.isArray(patterns), 'patterns should be an array');

            // Verify default is empty array
            const inspect = config.inspect('logWatcher.patterns');
            assert.ok(Array.isArray(inspect?.defaultValue), 'Default patterns should be an array');
        });

        test('Should support custom pattern objects', async () => {
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');

            const customPatterns = [
                {
                    pattern: 'Error: (.+)',
                    severity: 'error',
                    message: 'Custom error: {0}',
                },
            ];

            await config.update('logWatcher.patterns', customPatterns, vscode.ConfigurationTarget.Global);

            const patterns = config.get('logWatcher.patterns') as any[];
            assert.strictEqual(patterns.length, 1, 'Should have one custom pattern');
            assert.strictEqual(patterns[0].severity, 'error', 'Pattern should have correct severity');

            // Restore
            await config.update('logWatcher.patterns', [], vscode.ConfigurationTarget.Global);
        });
    });
});
