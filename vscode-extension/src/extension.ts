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
import { logger, LogCategory } from './logger';

const execAsync = promisify(exec);

let client: LanguageClient | undefined;
let statusBar: CK3StatusBar;

// Log file output channels (created once and reused)
const logChannels = {
    combined: null as vscode.OutputChannel | null,
    game: null as vscode.OutputChannel | null,
    error: null as vscode.OutputChannel | null,
    exceptions: null as vscode.OutputChannel | null,
    system: null as vscode.OutputChannel | null,
    setup: null as vscode.OutputChannel | null,
    patterns: null as vscode.OutputChannel | null,
};

function getLogChannel(type: keyof typeof logChannels, name: string): vscode.OutputChannel {
    if (!logChannels[type]) {
        // Use { log: true } option to enable ANSI color support
        logChannels[type] = vscode.window.createOutputChannel(name, { log: true });
    }
    return logChannels[type]!;
}

// ANSI color codes for log output
const Colors = {
    // Foreground colors
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Bright variants
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',
    
    // Background colors
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
};

function colorizeLogLine(line: string): string {
    // Color timestamps
    line = line.replace(/\[(\d{2}:\d{2}:\d{2})\]/g, `${Colors.dim}[$1]${Colors.reset}`);
    
    // Color file sources
    line = line.replace(/\[(game\.log|error\.log|exceptions\.log|system\.log|setup\.log)\]/g, 
        (match, file) => {
            const colorMap: Record<string, string> = {
                'game.log': Colors.brightCyan,
                'error.log': Colors.brightRed,
                'exceptions.log': Colors.brightMagenta,
                'system.log': Colors.brightYellow,
                'setup.log': Colors.brightGreen,
            };
            return `${colorMap[file] || Colors.cyan}[${file}]${Colors.reset}`;
        });
    
    // Color error indicators
    line = line.replace(/\[E\]/g, `${Colors.brightRed}${Colors.bright}[E]${Colors.reset}`);
    line = line.replace(/\[W\]/g, `${Colors.brightYellow}[W]${Colors.reset}`);
    line = line.replace(/\[I\]/g, `${Colors.brightBlue}[I]${Colors.reset}`);
    
    // Color Error: prefix
    line = line.replace(/^(\s*)Error:/gm, `$1${Colors.brightRed}${Colors.bright}Error:${Colors.reset}`);
    
    // Color Script system error!
    line = line.replace(/(Script system error!)/g, `${Colors.bgRed}${Colors.brightWhite}$1${Colors.reset}`);
    
    // Color file paths
    line = line.replace(/(file:\s+)([^\s]+)/g, `$1${Colors.brightCyan}$2${Colors.reset}`);
    
    // Color line numbers
    line = line.replace(/\b(line:\s+)(\d+)/g, `$1${Colors.brightYellow}$2${Colors.reset}`);
    
    return line;
}

/**
 * Try to auto-detect CK3 installation path
 */
async function detectCK3Path(): Promise<string | null> {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const platform = os.platform();
    
    // Common Steam library locations
    const steamPaths: Record<string, string[]> = {
        'linux': [
            path.join(os.homedir(), '.local/share/Steam/steamapps/common/Crusader Kings III'),
            path.join(os.homedir(), '.steam/steam/steamapps/common/Crusader Kings III')
        ],
        'win32': [
            'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crusader Kings III',
            'D:\\SteamLibrary\\steamapps\\common\\Crusader Kings III',
            'E:\\SteamLibrary\\steamapps\\common\\Crusader Kings III'
        ],
        'darwin': [
            path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Crusader Kings III')
        ]
    };
    
    const paths = steamPaths[platform] || [];
    
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    
    return null;
}

/**
 * Get Python executable path from configuration
 */
function getPythonPath(): string {
    const config = vscode.workspace.getConfiguration('ck3LanguageServer');
    return config.get('pythonPath') || 'python';
}

/**
 * Command: Extract CK3 trait data from game installation
 */
async function extractTraitData(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('CK3 Trait Extraction');
    outputChannel.show();
    
    try {
        // Ask user to confirm and provide CK3 installation path
        const proceed = await vscode.window.showInformationMessage(
            'This will extract trait data from your Crusader Kings III installation. ' +
            'The extracted data is for personal use only and not redistributed. Continue?',
            'Yes', 'No'
        );
        
        if (proceed !== 'Yes') {
            return;
        }
        
        // Try to detect CK3 installation path
        let ck3Path = await detectCK3Path();
        
        if (!ck3Path) {
            // Ask user to manually specify path
            const selectedPath = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Crusader Kings III installation folder',
                openLabel: 'Select CK3 Folder'
            });
            
            if (!selectedPath || selectedPath.length === 0) {
                vscode.window.showWarningMessage('CK3 installation path not provided. Extraction cancelled.');
                return;
            }
            
            ck3Path = selectedPath[0].fsPath;
        }
        
        // Validate path
        const path = require('path');
        const fs = require('fs');
        const traitsFile = path.join(ck3Path, 'game', 'common', 'traits', '00_traits.txt');
        if (!fs.existsSync(traitsFile)) {
            vscode.window.showErrorMessage(
                `Invalid CK3 installation path. Could not find: ${traitsFile}`
            );
            return;
        }
        
        outputChannel.appendLine(`Using CK3 installation: ${ck3Path}`);
        outputChannel.appendLine('Starting trait extraction...\n');
        
        // Get Python executable from language server config
        const pythonPath = getPythonPath();
        
        // Get extension path and construct script path
        const extensionPath = context.extensionPath;
        const scriptPath = path.join(extensionPath, '..', 'tools', 'extract_traits.py');
        
        // Run extraction script
        const cmd = `"${pythonPath}" "${scriptPath}" --ck3-path "${ck3Path}"`;
        outputChannel.appendLine(`Running: ${cmd}\n`);
        
        const { stdout, stderr } = await execAsync(cmd);
        
        outputChannel.appendLine(stdout);
        if (stderr) {
            outputChannel.appendLine('Errors:\n' + stderr);
        }
        
        // Check if successful
        const outputDir = path.join(extensionPath, '..', 'pychivalry', 'data', 'traits');
        const yamlFiles = fs.readdirSync(outputDir).filter((f: string) => f.endsWith('.yaml'));
        
        if (yamlFiles.length > 0) {
            const result = await vscode.window.showInformationMessage(
                `✅ Successfully extracted ${yamlFiles.length} trait data files! ` +
                `Trait validation is now enabled. Restart the language server for changes to take effect.`,
                'Restart Language Server', 'Later'
            );
            
            if (result === 'Restart Language Server') {
                await vscode.commands.executeCommand('ck3LanguageServer.restart');
            }
        } else {
            vscode.window.showErrorMessage('Extraction completed but no data files were created. Check output for errors.');
        }
        
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`\nError: ${message}`);
        vscode.window.showErrorMessage(`Failed to extract trait data: ${message}`);
    }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize multi-channel logger
    logger.initialize(context);

    // Create status bar
    statusBar = new CK3StatusBar();
    context.subscriptions.push(statusBar);

    // Auto-enable debug channels based on logLevel setting
    const config = vscode.workspace.getConfiguration('ck3LanguageServer');
    const logLevel = config.get<string>('logLevel', 'info');
    if (logLevel === 'debug') {
        logger.enableDebugMode();
    }

    logger.logServer('CK3 Language Server extension activating...');

    // Pre-create all log watcher channels so they appear in Output menu
    getLogChannel('combined', 'CK3L: Live Monitor');
    getLogChannel('game', 'CK3L: game.log');
    getLogChannel('error', 'CK3L: error.log');
    getLogChannel('exceptions', 'CK3L: exceptions.log');
    getLogChannel('system', 'CK3L: system.log');
    getLogChannel('setup', 'CK3L: setup.log');
    getLogChannel('patterns', 'CK3L: Script Errors');

    // Register restart command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.restart', async () => {
            logger.logServer('Restarting CK3 Language Server...');
            await deactivate();
            await startServer(context);
        })
    );

    // Register trait extraction command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.extractTraitData', async () => {
            await extractTraitData(context);
        })
    );

    // Register show menu command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.showMenu', async () => {
            await showMenuCommand();
        })
    );

    // Register show output command with channel picker
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.showOutput', async () => {
            const items: Array<{ label: string; description: string; category: LogCategory }> = [
                {
                    label: '$(server) Server Log',
                    description: 'Lifecycle and startup messages',
                    category: LogCategory.Server,
                },
                {
                    label: '$(terminal) Command Results',
                    description: 'Output from CK3 commands',
                    category: LogCategory.Commands,
                },
                {
                    label: '$(file-text) Game Logs',
                    description: 'Real-time game.log monitoring',
                    category: LogCategory.GameLogs,
                },
                {
                    label: '$(debug) LSP Trace',
                    description: 'Protocol communication (if enabled)',
                    category: LogCategory.Trace,
                },
            ];

            // Add debug channel if enabled
            if (logger.hasDebugChannel()) {
                items.splice(1, 0, {
                    label: '$(bug) Debug Log',
                    description: 'Detailed debug information',
                    category: LogCategory.Debug,
                });
            }

            // Add performance channel if enabled
            if (logger.hasPerformanceChannel()) {
                items.push({
                    label: '$(dashboard) Performance',
                    description: 'Timing and cache metrics',
                    category: LogCategory.Performance,
                });
            }

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select output channel to show',
            });

            if (selected) {
                logger.showChannel(selected.category);
            }
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
                });
                logger.logCommand(`Validation result: ${JSON.stringify(result, null, 2)}`);
                logger.showChannel(LogCategory.Commands);
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
                });
                logger.logCommand(`Rescan result: ${JSON.stringify(result, null, 2)}`);
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
                })) as Record<string, number | boolean>;

                // Show stats in a nice format
                const statsLines = [
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
                ];

                logger.appendCommandLines(statsLines);
                logger.showChannel(LogCategory.Commands);

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
                [
                    'character_event',
                    'letter_event',
                    'court_event',
                    'fullscreen_event',
                    'activity_event',
                ],
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
                })) as { orphaned_keys: string[]; total_count: number };

                if (result.orphaned_keys.length > 0) {
                    const lines = [`\nOrphaned Localization Keys (${result.total_count} total):`];
                    result.orphaned_keys.forEach((key) => {
                        lines.push(`  - ${key}`);
                    });
                    if (result.total_count > result.orphaned_keys.length) {
                        lines.push(
                            `  ... and ${result.total_count - result.orphaned_keys.length} more`
                        );
                    }
                    logger.appendCommandLines(lines);
                    logger.showChannel(LogCategory.Commands);
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
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Dependency check failed: ${message}`);
            }
        })
    );

    // Register showNamespaceEvents command (also used by Code Lens)
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'ck3LanguageServer.showNamespaceEvents',
            async (namespace?: string) => {
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
                    })) as {
                        namespace: string;
                        events: Array<{
                            event_id: string;
                            title: string;
                            file: string;
                            line: number;
                        }>;
                        count: number;
                    };

                    if (result.count === 0) {
                        vscode.window.showInformationMessage(
                            `No events found in namespace '${namespace}'`
                        );
                        return;
                    }

                    // Show events in a quick pick for navigation
                    const items = result.events.map((event) => ({
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
                        editor.revealRange(
                            new vscode.Range(position, position),
                            vscode.TextEditorRevealType.InCenter
                        );
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Failed to show namespace events: ${message}`);
                }
            }
        )
    );

    // Note: ck3.showNamespaceEvents is registered by the language server via executeCommandProvider
    // The Code Lens uses this command directly, and the server handles it.

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

    // =========================================================================
    // Log Watcher Commands
    // =========================================================================

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.startLogWatcher', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                // Get custom log path from settings
                const config = vscode.workspace.getConfiguration('ck3LanguageServer');
                const logPath = config.get<string>('logWatcher.logPath', '');

                logger.logDebug(`[startLogWatcher] Custom log path from settings: '${logPath}'`);
                const args = logPath ? [logPath] : [];
                logger.logDebug(`[startLogWatcher] Sending arguments: ${JSON.stringify(args)}`);
                
                const requestPayload = {
                    command: 'ck3.startLogWatcher',
                    arguments: args,
                };
                logger.logDebug(`[startLogWatcher] Full request payload: ${JSON.stringify(requestPayload)}`);

                const result = (await client.sendRequest('workspace/executeCommand', requestPayload)) as { success: boolean; path?: string; watching?: string[]; error?: string; message?: string };

                logger.logDebug(`[startLogWatcher] Server response: ${JSON.stringify(result)}`);

                if (result.success) {
                    logger.logServer(`Log watcher started: ${result.path}`);
                    logger.logServer(`Monitoring files: ${result.watching?.join(', ')}`);
                    
                    // Show welcome message in GameLogs channel
                    const gameLogsChannel = logger.getChannel(LogCategory.GameLogs);
                    if (gameLogsChannel) {
                        gameLogsChannel.appendLine('='.repeat(80));
                        gameLogsChannel.appendLine('CK3 Game Log Watcher Started');
                        gameLogsChannel.appendLine(`Monitoring: ${result.watching?.join(', ')}`);
                        gameLogsChannel.appendLine(`Log path: ${result.path}`);
                        gameLogsChannel.appendLine('='.repeat(80));
                        gameLogsChannel.appendLine('');
                    }
                    
                    vscode.window.showInformationMessage(
                        `Now monitoring CK3 logs: ${result.watching?.length} files`
                    );
                } else {
                    vscode.window.showErrorMessage(`Failed to start log watcher: ${result.error || result.message}`);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to start log watcher: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.stopLogWatcher', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.stopLogWatcher',
                })) as { success: boolean; message?: string };

                if (result.success) {
                    logger.logServer('Log watcher stopped');
                    vscode.window.showInformationMessage('Log monitoring stopped');
                } else {
                    vscode.window.showWarningMessage('Log watcher was not running');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to stop log watcher: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.pauseLogWatcher', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.pauseLogWatcher',
                    arguments: [],
                })) as { success: boolean };

                if (result.success) {
                    vscode.window.showInformationMessage('Log monitoring paused');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to pause: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.resumeLogWatcher', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.resumeLogWatcher',
                    arguments: [],
                })) as { success: boolean };

                if (result.success) {
                    vscode.window.showInformationMessage('Log monitoring resumed');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to resume: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.clearGameLogs', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.clearGameLogs',
                });
                
                // Also clear the output channel
                const channel = logger.getChannel(LogCategory.GameLogs);
                if (channel) {
                    channel.clear();
                }
                
                vscode.window.showInformationMessage('Game log diagnostics cleared');
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to clear logs: ${message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.showLogStatistics', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.getLogStatistics',
                })) as { success: boolean; statistics?: any; error?: string };

                if (result.success && result.statistics) {
                    const stats = result.statistics;
                    const lines = [
                        `📊 CK3 Game Log Statistics`,
                        `─────────────────────────────`,
                        `Total Lines Processed: ${stats.total_lines_processed}`,
                        `Errors: ${stats.total_errors}`,
                        `Warnings: ${stats.total_warnings}`,
                        `Info: ${stats.total_info}`,
                        ``,
                        `Errors by Category:`,
                    ];

                    // Add errors by category
                    for (const [category, count] of Object.entries(stats.errors_by_category)) {
                        lines.push(`  ${category}: ${count}`);
                    }

                    // Add slow events if any
                    if (Object.keys(stats.slow_events).length > 0) {
                        lines.push('', 'Slow Events (>50ms):');
                        for (const [event, timings] of Object.entries(stats.slow_events as Record<string, number[]>)) {
                            const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
                            lines.push(`  ${event}: ${avg.toFixed(1)}ms avg`);
                        }
                    }

                    logger.appendCommandLines(lines);
                    logger.showChannel(LogCategory.Commands);
                } else {
                    vscode.window.showWarningMessage(result.error || 'No statistics available');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to get statistics: ${message}`);
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
                logger.logServer('Configuration changed, restarting server...');

                // Enable debug channels if switching to debug mode
                const cfg = vscode.workspace.getConfiguration('ck3LanguageServer');
                if (cfg.get<string>('logLevel', 'info') === 'debug') {
                    logger.enableDebugMode();
                    logger.logServer('Debug mode enabled - Debug and Performance channels active');
                }

                await deactivate();
                await startServer(context);
            }
        })
    );

    logger.logServer('CK3 Language Server extension activated');
}

async function startServer(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('ck3LanguageServer');

    // Check if server is enabled
    const enabled = config.get<boolean>('enable', true);
    if (!enabled) {
        logger.logServer('CK3 Language Server is disabled in settings');
        statusBar.updateState('stopped', 'Disabled in settings');
        return;
    }

    // Check workspace trust
    if (!vscode.workspace.isTrusted) {
        logger.logServer('Workspace not trusted, server disabled');
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

    logger.logServer(`Using Python: ${pythonPath}`);

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

    logger.logServer(`Server args: ${args.join(' ') || '(none)'}`);
    logger.logServer(`Log level: ${logLevel}`);
    logger.logDebug(`Python path: ${pythonPath}`);
    logger.logDebug(`Trace level: ${traceLevel}`);

    // Server options
    const serverOptions: ServerOptions = {
        command: pythonPath,
        args: ['-m', 'pychivalry.server', '--log-level', logLevel, ...args],
        options: {
            env: { ...process.env },
        },
    };

    // Client options - use separate channels for output and trace
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'ck3' },
            { scheme: 'file', pattern: '**/*.{txt,gui,gfx,asset}' },
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{txt,gui,gfx,asset}'),
        },
        outputChannel: logger.getChannel(LogCategory.Server)!,
        traceOutputChannel: logger.getChannel(LogCategory.Trace)!,
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

        logger.logServer('Starting language client...');
        logger.logDebug(`Client ID: ck3LanguageServer`);
        logger.logDebug(`Document selector: ck3, *.txt, *.gui, *.gfx, *.asset`);
        await client.start();
        logger.logServer('Language client started successfully');
        logger.logDebug(`Client state: running`);
        statusBar.updateState('running');

        // Register log watcher notification handlers
        
        // Bulk notification handlers (efficient)
        client.onNotification('ck3/logEntry/combined/bulk', (params: any) => {
            const channel = getLogChannel('combined', 'CK3L: Live Monitor');
            const sourceFile = params.log_file ? `[${params.log_file}]` : '';
            
            // Batch append all lines at once with colors (logs already have timestamps)
            const output = params.lines
                .map((line: string) => colorizeLogLine(`${sourceFile} ${line}`.trim()))
                .join('\n');
            channel.append(output + '\n');
        });
        
        client.onNotification('ck3/logEntry/game/bulk', (params: any) => {
            const channel = getLogChannel('game', 'CK3L: game.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });
        
        client.onNotification('ck3/logEntry/error/bulk', (params: any) => {
            const channel = getLogChannel('error', 'CK3L: error.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });
        
        client.onNotification('ck3/logEntry/exceptions/bulk', (params: any) => {
            const channel = getLogChannel('exceptions', 'CK3L: exceptions.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });
        
        client.onNotification('ck3/logEntry/system/bulk', (params: any) => {
            const channel = getLogChannel('system', 'CK3L: system.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });
        
        client.onNotification('ck3/logEntry/setup/bulk', (params: any) => {
            const channel = getLogChannel('setup', 'CK3L: setup.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });
        
        client.onNotification('ck3/logEntry/pattern/bulk', (params: any) => {
            const channel = getLogChannel('patterns', 'CK3L: Script Errors');
            
            // Format all pattern matches with colors
            const output = params.results.map((result: any) => {
                const icon = getSeverityIcon(result.severity);
                const severityColor = result.severity === 1 ? Colors.brightRed : Colors.brightYellow;
                
                let lines = [
                    `${severityColor}${icon}${Colors.reset} ${Colors.bright}${result.message}${Colors.reset}`
                ];
                
                if (result.source_file) {
                    lines.push(`  ${Colors.cyan}→${Colors.reset} ${Colors.brightCyan}${result.source_file}${Colors.reset}:${Colors.brightYellow}${result.line_number || '?'}${Colors.reset}`);
                }
                
                if (result.suggestions && result.suggestions.length > 0) {
                    lines.push(`  ${Colors.brightGreen}💡 Suggestions:${Colors.reset} ${Colors.green}${result.suggestions.join(', ')}${Colors.reset}`);
                }
                
                if (result.log_file) {
                    const fileColor = result.log_file.includes('error') ? Colors.brightRed : 
                                     result.log_file.includes('exception') ? Colors.brightMagenta :
                                     Colors.brightCyan;
                    lines.push(`  ${Colors.dim}📁 From:${Colors.reset} ${fileColor}${result.log_file}${Colors.reset}`);
                }
                
                lines.push(''); // Blank line
                return lines.join('\n');
            }).join('\n');
            
            channel.append(output);
        });
        
        // Legacy single-line handlers (kept for backward compatibility)
        client.onNotification('ck3/logEntry/combined', (params: any) => {
            const channel = getLogChannel('combined', 'CK3L: Live Monitor');
            const sourceFile = params.log_file ? `[${params.log_file}]` : '';
            channel.appendLine(colorizeLogLine(`${sourceFile} ${params.message}`.trim()));
        });
        
        client.onNotification('ck3/logEntry/game', (params: any) => {
            const channel = getLogChannel('game', 'CK3L: game.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });
        
        client.onNotification('ck3/logEntry/error', (params: any) => {
            const channel = getLogChannel('error', 'CK3L: error.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });
        
        client.onNotification('ck3/logEntry/exceptions', (params: any) => {
            const channel = getLogChannel('exceptions', 'CK3L: exceptions.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });
        
        client.onNotification('ck3/logEntry/system', (params: any) => {
            const channel = getLogChannel('system', 'CK3L: system.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });
        
        client.onNotification('ck3/logEntry/setup', (params: any) => {
            const channel = getLogChannel('setup', 'CK3L: setup.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });
        
        client.onNotification('ck3/logEntry/pattern', (params: any) => {
            const channel = getLogChannel('patterns', 'CK3L: Script Errors');
            const icon = getSeverityIcon(params.severity);
            const severityColor = params.severity === 1 ? Colors.brightRed : Colors.brightYellow;
            
            channel.appendLine(`${severityColor}${icon}${Colors.reset} ${Colors.bright}${params.message}${Colors.reset}`);
            
            if (params.source_file) {
                channel.appendLine(`  ${Colors.cyan}→${Colors.reset} ${Colors.brightCyan}${params.source_file}${Colors.reset}:${Colors.brightYellow}${params.line_number || '?'}${Colors.reset}`);
            }
            
            if (params.suggestions && params.suggestions.length > 0) {
                channel.appendLine(`  ${Colors.brightGreen}💡 Suggestions:${Colors.reset} ${Colors.green}${params.suggestions.join(', ')}${Colors.reset}`);
            }
            
            if (params.log_file) {
                const fileColor = params.log_file.includes('error') ? Colors.brightRed : 
                                 params.log_file.includes('exception') ? Colors.brightMagenta :
                                 Colors.brightCyan;
                channel.appendLine(`  ${Colors.dim}📁 From:${Colors.reset} ${fileColor}${params.log_file}${Colors.reset}`);
            }
            channel.appendLine(''); // Blank line for readability
        });

        client.onNotification('ck3/logWatcherStarted', (params: any) => {
            logger.logServer(`Log watcher started for ${params.files?.length || 0} files`);
        });

        client.onNotification('ck3/logWatcherStopped', () => {
            logger.logServer('Log watcher stopped');
        });

        client.onNotification('ck3/logWatcherPaused', () => {
            logger.logServer('Log watcher paused');
        });

        client.onNotification('ck3/logWatcherResumed', () => {
            logger.logServer('Log watcher resumed');
        });

        // Register for disposal
        context.subscriptions.push(client);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.logServer(`Failed to start language server: ${message}`);
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
            logger.showChannel(LogCategory.Server);
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
            label: '$(play) Start Log Watcher',
            description: 'Monitor game logs for errors',
        },
        {
            label: '$(debug-stop) Stop Log Watcher',
            description: 'Stop monitoring game logs',
        },
        {
            label: '$(graph-line) Show Log Statistics',
            description: 'Display log analysis stats',
        },
        {
            label: '$(clear-all) Clear Log Diagnostics',
            description: 'Clear all log-related diagnostics',
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
            case '$(play) Start Log Watcher':
                await vscode.commands.executeCommand('ck3LanguageServer.startLogWatcher');
                break;
            case '$(debug-stop) Stop Log Watcher':
                await vscode.commands.executeCommand('ck3LanguageServer.stopLogWatcher');
                break;
            case '$(graph-line) Show Log Statistics':
                await vscode.commands.executeCommand('ck3LanguageServer.getLogStatistics');
                break;
            case '$(clear-all) Clear Log Diagnostics':
                await vscode.commands.executeCommand('ck3LanguageServer.clearGameLogs');
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

function getSeverityIcon(severity: any): string {
    // Map LSP diagnostic severity to icons
    switch(severity) {
        case 1: // Error
            return '❌';
        case 2: // Warning  
            return '⚠️';
        case 3: // Information
            return 'ℹ️';
        case 4: // Hint
            return '💡';
        default:
            return '📝';
    }
}

export async function deactivate(): Promise<void> {
    if (!client) {
        return;
    }

    statusBar.updateState('stopped');
    logger.logServer('Stopping language client...');
    try {
        await client.stop();
        client = undefined;
        logger.logServer('Language client stopped');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.logServer(`Error stopping client: ${message}`);
    }
}
