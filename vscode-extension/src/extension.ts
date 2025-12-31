import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Trace,
} from 'vscode-languageclient/node';
import { CK3StatusBar } from './statusBar';

const execAsync = promisify(exec);

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel;
let statusBar: CK3StatusBar;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Crusader Kings 3 Language Server');
    context.subscriptions.push(outputChannel);

    // Create status bar
    statusBar = new CK3StatusBar();
    context.subscriptions.push(statusBar);

    outputChannel.appendLine('CK3 Language Server extension activating...');

    // Register restart command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.restart', async () => {
            outputChannel.appendLine('Restarting CK3 Language Server...');
            await deactivate();
            await startServer(context);
        })
    );

    // Register show menu command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.showMenu', async () => {
            await showMenuCommand();
        })
    );

    // Register show output command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.showOutput', () => {
            outputChannel.show();
        })
    );

    // Register open documentation command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.openDocumentation', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://ck3.paradoxwikis.com/Modding'));
        })
    );

    // Register server commands that forward to the language server
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.validateWorkspace', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }
            try {
                const result = await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.validateWorkspace',
                    arguments: [],
                });
                outputChannel.appendLine(`Validation result: ${JSON.stringify(result, null, 2)}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Validation failed: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.rescanWorkspace', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }
            try {
                const result = await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.rescanWorkspace',
                    arguments: [],
                });
                outputChannel.appendLine(`Rescan result: ${JSON.stringify(result, null, 2)}`);
                vscode.window.showInformationMessage('Workspace rescan complete');
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Rescan failed: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.getWorkspaceStats', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }
            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.getWorkspaceStats',
                    arguments: [],
                })) as Record<string, number | boolean>;

                // Show stats in a nice format
                const statsMessage = [
                    `📊 Workspace Statistics`,
                    `───────────────────────`,
                    `Events: ${result.events}`,
                    `Namespaces: ${result.namespaces}`,
                    `Scripted Effects: ${result.scripted_effects}`,
                    `Scripted Triggers: ${result.scripted_triggers}`,
                    `Script Values: ${result.script_values}`,
                    `Localization Keys: ${result.localization_keys}`,
                    `Character Flags: ${result.character_flags}`,
                    `Saved Scopes: ${result.saved_scopes}`,
                    `Character Interactions: ${result.character_interactions}`,
                    `Modifiers: ${result.modifiers}`,
                    `On-Actions: ${result.on_actions}`,
                    `Opinion Modifiers: ${result.opinion_modifiers}`,
                    `Scripted GUIs: ${result.scripted_guis}`,
                ].join('\n');

                outputChannel.appendLine(statsMessage);
                outputChannel.show();

                vscode.window.showInformationMessage(
                    `Indexed: ${result.events} events, ${result.scripted_effects} effects, ${result.scripted_triggers} triggers`
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to get stats: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.generateEventTemplate', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            // Get namespace from user
            const namespace = await vscode.window.showInputBox({
                prompt: 'Enter event namespace',
                value: 'my_mod',
                placeHolder: 'e.g., my_mod',
            });

            if (!namespace) {
                return;
            }

            // Get event number from user
            const eventNum = await vscode.window.showInputBox({
                prompt: 'Enter event number',
                value: '0001',
                placeHolder: 'e.g., 0001',
            });

            if (!eventNum) {
                return;
            }

            // Get event type
            const eventType = await vscode.window.showQuickPick(
                ['character_event', 'letter_event', 'court_event', 'fullscreen_event', 'activity_event'],
                { placeHolder: 'Select event type' }
            );

            if (!eventType) {
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.generateEventTemplate',
                    arguments: [namespace, eventNum, eventType],
                })) as { template: string; event_id: string; localization_keys: string[] };

                // Insert at cursor position if editor is active
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await editor.edit((editBuilder) => {
                        editBuilder.insert(editor.selection.active, result.template);
                    });

                    // Show localization keys that need to be created
                    const locKeys = result.localization_keys.join(', ');
                    vscode.window.showInformationMessage(
                        `Event template inserted. Remember to add localization keys: ${locKeys}`
                    );
                } else {
                    // Copy to clipboard if no active editor
                    await vscode.env.clipboard.writeText(result.template);
                    vscode.window.showInformationMessage('Event template copied to clipboard');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to generate template: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.findOrphanedLocalization', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }
            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.findOrphanedLocalization',
                    arguments: [],
                })) as { orphaned_keys: string[]; total_count: number };

                if (result.orphaned_keys.length > 0) {
                    outputChannel.appendLine(`\nOrphaned Localization Keys (${result.total_count} total):`);
                    result.orphaned_keys.forEach((key) => {
                        outputChannel.appendLine(`  - ${key}`);
                    });
                    if (result.total_count > result.orphaned_keys.length) {
                        outputChannel.appendLine(
                            `  ... and ${result.total_count - result.orphaned_keys.length} more`
                        );
                    }
                    outputChannel.show();
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to find orphaned localization: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.checkDependencies', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }
            try {
                await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.checkDependencies',
                    arguments: [],
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Dependency check failed: ${message}`);
            }
        })
    );

    // Register showNamespaceEvents command (also used by Code Lens)
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.showNamespaceEvents', async (namespace?: string) => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            // If namespace not provided (direct command invocation), ask for it
            if (!namespace) {
                namespace = await vscode.window.showInputBox({
                    prompt: 'Enter namespace name',
                    placeHolder: 'e.g., my_mod',
                });

                if (!namespace) {
                    return;
                }
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.showNamespaceEvents',
                    arguments: [namespace],
                })) as { namespace: string; events: Array<{ event_id: string; title: string; file: string; line: number }>; count: number };

                if (result.count === 0) {
                    vscode.window.showInformationMessage(`No events found in namespace '${namespace}'`);
                    return;
                }

                // Show events in a quick pick for navigation
                const items = result.events.map(event => ({
                    label: event.event_id,
                    description: event.title,
                    detail: event.file ? `Line ${event.line + 1}` : undefined,
                    event: event,
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `${result.count} events in namespace '${namespace}'`,
                    matchOnDescription: true,
                });

                // Navigate to selected event
                if (selected && selected.event.file) {
                    const uri = vscode.Uri.parse(selected.event.file);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(doc);
                    const position = new vscode.Position(selected.event.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to show namespace events: ${message}`);
            }
        })
    );

    // Register the ck3.showNamespaceEvents command alias (used by Code Lens directly)
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3.showNamespaceEvents', async (namespace: string) => {
            await vscode.commands.executeCommand('ck3LanguageServer.showNamespaceEvents', namespace);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.generateLocalizationStubs', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            // Get event ID from user
            const eventId = await vscode.window.showInputBox({
                prompt: 'Enter event ID to generate localization for',
                placeHolder: 'e.g., my_mod.0001',
            });

            if (!eventId) {
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.generateLocalizationStubs',
                    arguments: [eventId],
                })) as { localization_text: string; keys_generated: string[] };

                // Copy to clipboard
                await vscode.env.clipboard.writeText(result.localization_text);

                const action = await vscode.window.showInformationMessage(
                    `Localization stubs copied to clipboard for: ${result.keys_generated.join(', ')}`,
                    'Paste at Cursor'
                );

                if (action === 'Paste at Cursor') {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        await editor.edit((editBuilder) => {
                            editBuilder.insert(editor.selection.active, result.localization_text);
                        });
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to generate localization: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.renameEvent', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            // Get old event ID
            const oldId = await vscode.window.showInputBox({
                prompt: 'Enter current event ID',
                placeHolder: 'e.g., my_mod.0001',
            });

            if (!oldId) {
                return;
            }

            // Get new event ID
            const newId = await vscode.window.showInputBox({
                prompt: 'Enter new event ID',
                placeHolder: 'e.g., my_mod.0100',
            });

            if (!newId) {
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.renameEvent',
                    arguments: [oldId, newId],
                })) as { message?: string; suggestion?: string; error?: string };

                if (result.error) {
                    vscode.window.showErrorMessage(result.error);
                } else if (result.suggestion) {
                    vscode.window.showInformationMessage(result.suggestion);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Rename failed: ${message}`);
            }
        })
    );

    // Start the server
    await startServer(context);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (
                e.affectsConfiguration('ck3LanguageServer.pythonPath') ||
                e.affectsConfiguration('ck3LanguageServer.enable') ||
                e.affectsConfiguration('ck3LanguageServer.logLevel')
            ) {
                outputChannel.appendLine('Configuration changed, restarting server...');
                await deactivate();
                await startServer(context);
            }
        })
    );

    outputChannel.appendLine('CK3 Language Server extension activated');
}

async function startServer(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('ck3LanguageServer');

    // Check if server is enabled
    const enabled = config.get<boolean>('enable', true);
    if (!enabled) {
        outputChannel.appendLine('CK3 Language Server is disabled in settings');
        statusBar.updateState('stopped', 'Disabled in settings');
        return;
    }

    // Check workspace trust
    if (!vscode.workspace.isTrusted) {
        outputChannel.appendLine('Workspace not trusted, server disabled');
        statusBar.updateState('stopped', 'Workspace not trusted');
        return;
    }

    statusBar.updateState('starting');

    // Find Python installation
    const pythonPath = await findPython();
    if (!pythonPath) {
        const error = new Error('Python not found');
        await handleServerError(error);
        statusBar.updateState('error', 'Python not found');
        return;
    }

    outputChannel.appendLine(`Using Python: ${pythonPath}`);

    // Check if pychivalry server is installed
    const serverInstalled = await checkServerInstalled(pythonPath);
    if (!serverInstalled) {
        const error = new Error('pychivalry module not installed');
        await handleServerError(error);
        statusBar.updateState('error', 'pychivalry not installed');
        return;
    }

    const args = config.get<string[]>('args', []);
    const traceLevel = config.get<string>('trace.server', 'off');
    const logLevel = config.get<string>('logLevel', 'info');

    outputChannel.appendLine(`Server args: ${args.join(' ')}`);
    outputChannel.appendLine(`Log level: ${logLevel}`);

    // Server options
    const serverOptions: ServerOptions = {
        command: pythonPath,
        args: ['-m', 'pychivalry.server', '--log-level', logLevel, ...args],
        options: {
            env: { ...process.env },
        },
    };

    // Client options
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'ck3' },
            { scheme: 'file', pattern: '**/*.{txt,gui,gfx,asset}' },
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{txt,gui,gfx,asset}'),
        },
        outputChannel: outputChannel,
        traceOutputChannel: outputChannel,
    };

    try {
        // Create and start the language client
        client = new LanguageClient(
            'ck3LanguageServer',
            'CK3 Language Server',
            serverOptions,
            clientOptions
        );

        // Set trace level
        switch (traceLevel) {
            case 'messages':
                client.setTrace(Trace.Messages);
                break;
            case 'verbose':
                client.setTrace(Trace.Verbose);
                break;
            default:
                client.setTrace(Trace.Off);
        }

        outputChannel.appendLine('Starting language client...');
        await client.start();
        outputChannel.appendLine('Language client started successfully');
        statusBar.updateState('running');

        // Register for disposal
        context.subscriptions.push(client);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Failed to start language server: ${message}`);
        await handleServerError(error as Error);
        statusBar.updateState('error', message);
    }
}

async function findPython(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('ck3LanguageServer');
    const configuredPath = config.get<string>('pythonPath');

    // Try configured path first
    if (configuredPath && configuredPath !== 'python') {
        if (await checkPythonPath(configuredPath)) {
            return configuredPath;
        }
    }

    // Try common paths
    const candidates = [
        'python3',
        'python',
        process.platform === 'win32' ? 'py' : undefined,
    ].filter((p): p is string => p !== undefined);

    for (const candidate of candidates) {
        if (await checkPythonPath(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

function shellEscape(arg: string): string {
    // Escape shell arguments to prevent injection
    // For Windows, wrap in quotes and escape inner quotes
    // For Unix, use single quotes and escape single quotes
    if (process.platform === 'win32') {
        // Windows: wrap in double quotes and escape backslashes and quotes
        return `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    } else {
        // Unix: use single quotes, escape single quotes by ending quote, adding escaped quote, starting quote again
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
}

async function checkPythonPath(pythonPath: string): Promise<boolean> {
    try {
        const escapedPath = shellEscape(pythonPath);
        const { stdout } = await execAsync(`${escapedPath} --version`);
        const version = stdout.match(/Python (\d+)\.(\d+)/);
        if (version) {
            const major = parseInt(version[1]);
            const minor = parseInt(version[2]);
            return major >= 3 && minor >= 9;
        }
    } catch {
        return false;
    }
    return false;
}

async function checkServerInstalled(pythonPath: string): Promise<boolean> {
    try {
        const escapedPath = shellEscape(pythonPath);
        await execAsync(`${escapedPath} -c "import pychivalry"`);
        return true;
    } catch {
        return false;
    }
}

async function handleServerError(error: Error): Promise<void> {
    const pythonMissing = error.message.includes('not found');
    const moduleMissing = error.message.includes('not installed');

    if (pythonMissing) {
        const action = await vscode.window.showErrorMessage(
            'Python not found. The CK3 Language Server requires Python 3.9+.',
            'Configure Python Path',
            'Install Python'
        );

        if (action === 'Configure Python Path') {
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'ck3LanguageServer.pythonPath'
            );
        } else if (action === 'Install Python') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
        }
    } else if (moduleMissing) {
        const action = await vscode.window.showErrorMessage(
            'pychivalry language server not installed.',
            'Install Server',
            'View Documentation'
        );

        if (action === 'Install Server') {
            const confirm = await vscode.window.showWarningMessage(
                'This will run "pip install pychivalry" in a terminal. Continue?',
                'Yes',
                'No'
            );

            if (confirm === 'Yes') {
                const terminal = vscode.window.createTerminal('Install CK3 Server');
                terminal.show();
                // Hardcoded safe command - no user input
                terminal.sendText('pip install pychivalry');
            }
        } else if (action === 'View Documentation') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/Cyborgninja21/pychivalry#readme')
            );
        }
    } else {
        const action = await vscode.window.showErrorMessage(
            `CK3 Language Server error: ${error.message}`,
            'Show Output'
        );
        if (action === 'Show Output') {
            outputChannel.show();
        }
    }
}

async function showMenuCommand(): Promise<void> {
    const items: vscode.QuickPickItem[] = [
        {
            label: '$(refresh) Restart Server',
            description: 'Restart the language server',
        },
        {
            label: '$(sync) Rescan Workspace',
            description: 'Rescan workspace for symbols',
        },
        {
            label: '$(checklist) Validate Workspace',
            description: 'Run full workspace validation',
        },
        {
            label: '$(graph) Show Statistics',
            description: 'Display workspace index statistics',
        },
        {
            label: '$(add) Generate Event Template',
            description: 'Insert a new event template',
        },
        {
            label: '$(symbol-string) Generate Localization Stubs',
            description: 'Generate localization entries for an event',
        },
        {
            label: '$(edit) Rename Event',
            description: 'Rename an event ID',
        },
        {
            label: '$(search) Find Orphaned Localization',
            description: 'Find unused localization keys',
        },
        {
            label: '$(list-tree) Show Namespace Events',
            description: 'List events in a namespace',
        },
        {
            label: '$(references) Check Dependencies',
            description: 'Check for undefined dependencies',
        },
        {
            label: '$(output) Show Output',
            description: 'Open output channel',
        },
        {
            label: '$(gear) Open Settings',
            description: 'Configure extension',
        },
        {
            label: '$(book) Documentation',
            description: 'Open CK3 modding docs',
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an action',
    });

    if (selected) {
        switch (selected.label) {
            case '$(refresh) Restart Server':
                await vscode.commands.executeCommand('ck3LanguageServer.restart');
                break;
            case '$(sync) Rescan Workspace':
                await vscode.commands.executeCommand('ck3LanguageServer.rescanWorkspace');
                break;
            case '$(checklist) Validate Workspace':
                await vscode.commands.executeCommand('ck3LanguageServer.validateWorkspace');
                break;
            case '$(graph) Show Statistics':
                await vscode.commands.executeCommand('ck3LanguageServer.getWorkspaceStats');
                break;
            case '$(add) Generate Event Template':
                await vscode.commands.executeCommand('ck3LanguageServer.generateEventTemplate');
                break;
            case '$(symbol-string) Generate Localization Stubs':
                await vscode.commands.executeCommand('ck3LanguageServer.generateLocalizationStubs');
                break;
            case '$(edit) Rename Event':
                await vscode.commands.executeCommand('ck3LanguageServer.renameEvent');
                break;
            case '$(search) Find Orphaned Localization':
                await vscode.commands.executeCommand('ck3LanguageServer.findOrphanedLocalization');
                break;
            case '$(list-tree) Show Namespace Events':
                await vscode.commands.executeCommand('ck3LanguageServer.showNamespaceEvents');
                break;
            case '$(references) Check Dependencies':
                await vscode.commands.executeCommand('ck3LanguageServer.checkDependencies');
                break;
            case '$(output) Show Output':
                await vscode.commands.executeCommand('ck3LanguageServer.showOutput');
                break;
            case '$(gear) Open Settings':
                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'ck3LanguageServer'
                );
                break;
            case '$(book) Documentation':
                await vscode.commands.executeCommand('ck3LanguageServer.openDocumentation');
                break;
        }
    }
}

export async function deactivate(): Promise<void> {
    if (!client) {
        return;
    }

    statusBar.updateState('stopped');
    outputChannel.appendLine('Stopping language client...');
    try {
        await client.stop();
        client = undefined;
        outputChannel.appendLine('Language client stopped');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error stopping client: ${message}`);
    }
}
