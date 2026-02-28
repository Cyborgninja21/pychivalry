import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
    Trace,
} from 'vscode-languageclient/node';
import { CK3StatusBar } from './statusBar';
import { logger, LogCategory } from './logger';

let client: LanguageClient | undefined;
let statusBar: CK3StatusBar;
let restartDebounceTimer: NodeJS.Timeout | undefined;
let restartInProgress = false;
let crashCount = 0;
let lastStableTimestamp = Date.now();
const MAX_CRASH_RESTARTS = 3;
const CRASH_STABLE_WINDOW_MS = 60000;

// Type definitions for log notification parameters
interface LogBulkParams {
    lines: string[];
    log_file?: string;
}

interface LogSingleParams {
    message: string;
    raw_line?: string;
    log_file?: string;
}

interface PatternMatchResult {
    severity: number;
    message: string;
    source_file?: string;
    line_number?: number;
    suggestions?: string[];
    log_file?: string;
}

interface PatternBulkParams {
    results: PatternMatchResult[];
}

interface LogWatcherStartedParams {
    files?: string[];
}

interface LogStatistics {
    [key: string]: unknown;
    errors_by_category?: Record<string, number>;
    slow_events?: Record<string, number[]>;
}

interface LogStatisticsResponse {
    success: boolean;
    statistics?: LogStatistics;
    error?: string;
}

interface EventTemplateResponse {
    template: string;
    event_id: string;
    localization_keys: string[];
}

interface LocalizationCheckResponse {
    orphaned_keys: string[];
    total_count: number;
}

interface LocalizationGenerationResponse {
    localization_text: string;
    keys_generated: string[];
}

interface NamespaceEvent {
    event_id: string;
    title: string;
    file: string;
    line: number;
}

interface NamespaceEventsResponse {
    namespace: string;
    events: NamespaceEvent[];
    count: number;
}

// Log file output channels (created once and reused)
const logChannels = {
    combined: null as vscode.OutputChannel | null,
    game: null as vscode.OutputChannel | null,
    error: null as vscode.OutputChannel | null,
    exceptions: null as vscode.OutputChannel | null,
    system: null as vscode.OutputChannel | null,
    setup: null as vscode.OutputChannel | null,
    patterns: null as vscode.OutputChannel | null,
    traitExtraction: null as vscode.OutputChannel | null,
    modDiscovery: null as vscode.OutputChannel | null,
    allDataExtraction: null as vscode.OutputChannel | null,
};

function getLogChannel(type: keyof typeof logChannels, name: string): vscode.OutputChannel {
    if (!logChannels[type]) {
        // Use { log: true } option to enable ANSI color support
        logChannels[type] = vscode.window.createOutputChannel(name, { log: true });
    }
    return logChannels[type]!;
}

// ANSI color codes for log output
const COLORS = {
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
    line = line.replace(/\[(\d{2}:\d{2}:\d{2})\]/g, `${COLORS.dim}[$1]${COLORS.reset}`);

    // Color file sources
    line = line.replace(
        /\[(game\.log|error\.log|exceptions\.log|system\.log|setup\.log)\]/g,
        (match, file) => {
            const colorMap: Record<string, string> = {
                gameLog: COLORS.brightCyan,
                errorLog: COLORS.brightRed,
                exceptionsLog: COLORS.brightMagenta,
                systemLog: COLORS.brightYellow,
                setupLog: COLORS.brightGreen,
            };
            // Map the dotted file names to camelCase keys
            const fileKey = file.replace(/\./g, '').replace(/log$/, 'Log');
            return `${colorMap[fileKey] || COLORS.cyan}[${file}]${COLORS.reset}`;
        }
    );

    // Color error indicators
    line = line.replace(/\[E\]/g, `${COLORS.brightRed}${COLORS.bright}[E]${COLORS.reset}`);
    line = line.replace(/\[W\]/g, `${COLORS.brightYellow}[W]${COLORS.reset}`);
    line = line.replace(/\[I\]/g, `${COLORS.brightBlue}[I]${COLORS.reset}`);

    // Color Error: prefix
    line = line.replace(
        /^(\s*)Error:/gm,
        `$1${COLORS.brightRed}${COLORS.bright}Error:${COLORS.reset}`
    );

    // Color Script system error!
    line = line.replace(
        /(Script system error!)/g,
        `${COLORS.bgRed}${COLORS.brightWhite}$1${COLORS.reset}`
    );

    // Color file paths
    line = line.replace(/(file:\s+)([^\s]+)/g, `$1${COLORS.brightCyan}$2${COLORS.reset}`);

    // Color line numbers
    line = line.replace(/\b(line:\s+)(\d+)/g, `$1${COLORS.brightYellow}$2${COLORS.reset}`);

    return line;
}

/**
 * Try to auto-detect CK3 installation path
 */
async function detectCK3Path(): Promise<string | null> {
    const platform = os.platform();

    // Common Steam library locations
    const steamPaths: Record<string, string[]> = {
        linux: [
            path.join(os.homedir(), '.local/share/Steam/steamapps/common/Crusader Kings III'),
            path.join(os.homedir(), '.steam/steam/steamapps/common/Crusader Kings III'),
        ],
        win32: [
            'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crusader Kings III',
            'D:\\SteamLibrary\\steamapps\\common\\Crusader Kings III',
            'E:\\SteamLibrary\\steamapps\\common\\Crusader Kings III',
        ],
        darwin: [
            path.join(
                os.homedir(),
                'Library/Application Support/Steam/steamapps/common/Crusader Kings III'
            ),
        ],
    };

    const paths = steamPaths[platform] || [];

    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return null;
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
            if (restartDebounceTimer) {
                clearTimeout(restartDebounceTimer);
                restartDebounceTimer = undefined;
            }
            logger.logServer('Restarting CK3 Language Server...');
            await deactivate();
            await startServer(context);
        })
    );

    // Data extraction commands — now handled by the built-in TypeScript language server
    const deprecatedMsg = 'This command has been replaced by the built-in TypeScript language server. Game data is bundled with the extension.';
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.extractTraitData', () => {
            vscode.window.showInformationMessage(deprecatedMsg);
        }),
        vscode.commands.registerCommand('ck3LanguageServer.extractAllGameData', () => {
            vscode.window.showInformationMessage(deprecatedMsg);
        }),
        vscode.commands.registerCommand('ck3LanguageServer.extractLocalizationData', () => {
            vscode.window.showInformationMessage(deprecatedMsg);
        }),
        vscode.commands.registerCommand('ck3LanguageServer.discoverModData', () => {
            vscode.window.showInformationMessage(deprecatedMsg);
        }),
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
                    label: '$(list-tree) Index Log',
                    description: 'Workspace scanning and indexing',
                    category: LogCategory.Index,
                },
                {
                    label: '$(terminal) Command Results',
                    description: 'Output from CK3 commands',
                    category: LogCategory.Commands,
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
                })) as EventTemplateResponse;

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
                })) as LocalizationCheckResponse;

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
                    })) as NamespaceEventsResponse;

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
                })) as LocalizationGenerationResponse;

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

            // Check if log watcher is enabled
            const lwConfig = vscode.workspace.getConfiguration('ck3LanguageServer');
            if (!lwConfig.get<boolean>('logWatcher.enabled', true)) {
                vscode.window.showWarningMessage('Log watcher is disabled. Enable it in settings: ck3LanguageServer.logWatcher.enabled');
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
                logger.logDebug(
                    `[startLogWatcher] Full request payload: ${JSON.stringify(requestPayload)}`
                );

                const result = (await client.sendRequest(
                    'workspace/executeCommand',
                    requestPayload
                )) as {
                    success: boolean;
                    path?: string;
                    watching?: string[];
                    error?: string;
                    message?: string;
                };

                logger.logDebug(`[startLogWatcher] Server response: ${JSON.stringify(result)}`);

                if (result.success) {
                    logger.logServer(`Log watcher started: ${result.path}`);
                    logger.logServer(`Monitoring files: ${result.watching?.join(', ')}`);

                    // Show welcome message in combined log channel (CK3L: Live Monitor)
                    const combinedChannel = getLogChannel('combined', 'CK3L: Live Monitor');
                    combinedChannel.appendLine('='.repeat(80));
                    combinedChannel.appendLine('CK3 Game Log Watcher Started');
                    combinedChannel.appendLine(`Monitoring: ${result.watching?.join(', ')}`);
                    combinedChannel.appendLine(`Log path: ${result.path}`);
                    combinedChannel.appendLine('='.repeat(80));
                    combinedChannel.appendLine('');

                    vscode.window.showInformationMessage(
                        `Now monitoring CK3 logs: ${result.watching?.length} files`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to start log watcher: ${result.error || result.message}`
                    );
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
        vscode.commands.registerCommand('ck3LanguageServer.forceRefreshLogs', async () => {
            if (!client) {
                vscode.window.showErrorMessage('CK3 Language Server is not running');
                return;
            }

            try {
                const result = (await client.sendRequest('workspace/executeCommand', {
                    command: 'ck3.forceRefreshLogs',
                    arguments: [],
                })) as { success: boolean; files_read?: number; total_lines?: number; error?: string };

                if (result.success) {
                    if (result.total_lines && result.total_lines > 0) {
                        vscode.window.showInformationMessage(
                            `Refreshed: ${result.total_lines} new lines from ${result.files_read} files`
                        );
                    } else {
                        vscode.window.showInformationMessage('No new log content found');
                    }
                } else {
                    vscode.window.showWarningMessage(result.error || 'Failed to refresh logs');
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to refresh logs: ${message}`);
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

                // Also clear the combined log output channel (CK3L: Live Monitor)
                const combinedChannel = getLogChannel('combined', 'CK3L: Live Monitor');
                combinedChannel.clear();

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
                })) as LogStatisticsResponse;

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
                    if (stats.errors_by_category) {
                        for (const [category, count] of Object.entries(stats.errors_by_category)) {
                            lines.push(`  ${category}: ${count}`);
                        }
                    }

                    // Add slow events if any
                    if (stats.slow_events && Object.keys(stats.slow_events).length > 0) {
                        lines.push('', 'Slow Events (>50ms):');
                        for (const [event, timings] of Object.entries(stats.slow_events)) {
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

    // Watch for configuration changes (debounced to avoid rapid restarts)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (
                e.affectsConfiguration('ck3LanguageServer.enable') ||
                e.affectsConfiguration('ck3LanguageServer.logLevel')
            ) {
                // Debounce restart to avoid rapid-fire restarts
                if (restartDebounceTimer) {
                    clearTimeout(restartDebounceTimer);
                }
                restartDebounceTimer = setTimeout(async () => {
                    restartDebounceTimer = undefined;
                    logger.logServer('Configuration changed, restarting server...');

                    // Enable debug channels if switching to debug mode
                    const cfg = vscode.workspace.getConfiguration('ck3LanguageServer');
                    if (cfg.get<string>('logLevel', 'info') === 'debug') {
                        logger.enableDebugMode();
                        logger.logServer('Debug mode enabled - Debug and Performance channels active');
                    }

                    await deactivate();
                    await startServer(context);
                }, 500);
            }
        })
    );

    logger.logServer('CK3 Language Server extension activated');
}

async function startServer(context: vscode.ExtensionContext): Promise<void> {
    if (restartInProgress) {
        logger.logServer('Server restart already in progress, skipping');
        return;
    }

    restartInProgress = true;
    try {
        await startServerInternal(context);
    } finally {
        restartInProgress = false;
    }
}

async function startServerInternal(context: vscode.ExtensionContext): Promise<void> {
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

    const args = config.get<string[]>('args', []);
    const traceLevel = config.get<string>('trace.server', 'off');
    const logLevel = config.get<string>('logLevel', 'info');

    logger.logServer(`Server args: ${args.join(' ') || '(none)'}`);
    logger.logServer(`Log level: ${logLevel}`);
    logger.logDebug(`Trace level: ${traceLevel}`);

    // TypeScript server runs as Node.js process
    const serverModule = context.asAbsolutePath(
        path.join('dist', 'server-main.js')
    );

    logger.logServer(`Using TypeScript server at: ${serverModule}`);

    const serverOptions: ServerOptions = {
        module: serverModule,
        transport: 0, // TransportKind.stdio
        options: {
            env: { ...process.env, LOG_LEVEL: logLevel },
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
        client.onNotification('ck3/logEntry/combined/bulk', (params: LogBulkParams) => {
            const channel = getLogChannel('combined', 'CK3L: Live Monitor');
            const sourceFile = params.log_file ? `[${params.log_file}]` : '';

            // Batch append all lines at once with colors (logs already have timestamps)
            const output = params.lines
                .map((line: string) => colorizeLogLine(`${sourceFile} ${line}`.trim()))
                .join('\n');
            channel.append(output + '\n');
        });

        client.onNotification('ck3/logEntry/game/bulk', (params: LogBulkParams) => {
            const channel = getLogChannel('game', 'CK3L: game.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });

        client.onNotification('ck3/logEntry/error/bulk', (params: LogBulkParams) => {
            const channel = getLogChannel('error', 'CK3L: error.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });

        client.onNotification('ck3/logEntry/exceptions/bulk', (params: LogBulkParams) => {
            const channel = getLogChannel('exceptions', 'CK3L: exceptions.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });

        client.onNotification('ck3/logEntry/system/bulk', (params: LogBulkParams) => {
            const channel = getLogChannel('system', 'CK3L: system.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });

        client.onNotification('ck3/logEntry/setup/bulk', (params: LogBulkParams) => {
            const channel = getLogChannel('setup', 'CK3L: setup.log');
            const output = params.lines.map((line: string) => colorizeLogLine(line)).join('\n');
            channel.append(output + '\n');
        });

        client.onNotification('ck3/logEntry/pattern/bulk', (params: PatternBulkParams) => {
            const channel = getLogChannel('patterns', 'CK3L: Script Errors');

            // Format all pattern matches with colors
            const output = params.results
                .map((result: PatternMatchResult) => {
                    const icon = getSeverityIcon(result.severity);
                    const severityColor =
                        result.severity === 1 ? COLORS.brightRed : COLORS.brightYellow;

                    const lines = [
                        `${severityColor}${icon}${COLORS.reset} ${COLORS.bright}${result.message}${COLORS.reset}`,
                    ];

                    if (result.source_file) {
                        lines.push(
                            `  ${COLORS.cyan}→${COLORS.reset} ${COLORS.brightCyan}${result.source_file}${COLORS.reset}:${COLORS.brightYellow}${result.line_number || '?'}${COLORS.reset}`
                        );
                    }

                    if (result.suggestions && result.suggestions.length > 0) {
                        lines.push(
                            `  ${COLORS.brightGreen}💡 Suggestions:${COLORS.reset} ${COLORS.green}${result.suggestions.join(', ')}${COLORS.reset}`
                        );
                    }

                    if (result.log_file) {
                        const fileColor = result.log_file.includes('error')
                            ? COLORS.brightRed
                            : result.log_file.includes('exception')
                                ? COLORS.brightMagenta
                                : COLORS.brightCyan;
                        lines.push(
                            `  ${COLORS.dim}📁 From:${COLORS.reset} ${fileColor}${result.log_file}${COLORS.reset}`
                        );
                    }

                    lines.push(''); // Blank line
                    return lines.join('\n');
                })
                .join('\n');

            channel.append(output);
        });

        // Legacy single-line handlers (kept for backward compatibility)
        client.onNotification('ck3/logEntry/combined', (params: LogSingleParams) => {
            const channel = getLogChannel('combined', 'CK3L: Live Monitor');
            const sourceFile = params.log_file ? `[${params.log_file}]` : '';
            channel.appendLine(colorizeLogLine(`${sourceFile} ${params.message}`.trim()));
        });

        client.onNotification('ck3/logEntry/game', (params: LogSingleParams) => {
            const channel = getLogChannel('game', 'CK3L: game.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });

        client.onNotification('ck3/logEntry/error', (params: LogSingleParams) => {
            const channel = getLogChannel('error', 'CK3L: error.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });

        client.onNotification('ck3/logEntry/exceptions', (params: LogSingleParams) => {
            const channel = getLogChannel('exceptions', 'CK3L: exceptions.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });

        client.onNotification('ck3/logEntry/system', (params: LogSingleParams) => {
            const channel = getLogChannel('system', 'CK3L: system.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });

        client.onNotification('ck3/logEntry/setup', (params: LogSingleParams) => {
            const channel = getLogChannel('setup', 'CK3L: setup.log');
            channel.appendLine(colorizeLogLine(params.raw_line || params.message));
        });

        client.onNotification('ck3/logEntry/pattern', (params: PatternMatchResult) => {
            const channel = getLogChannel('patterns', 'CK3L: Script Errors');
            const icon = getSeverityIcon(params.severity);
            const severityColor = params.severity === 1 ? COLORS.brightRed : COLORS.brightYellow;

            channel.appendLine(
                `${severityColor}${icon}${COLORS.reset} ${COLORS.bright}${params.message}${COLORS.reset}`
            );

            if (params.source_file) {
                channel.appendLine(
                    `  ${COLORS.cyan}→${COLORS.reset} ${COLORS.brightCyan}${params.source_file}${COLORS.reset}:${COLORS.brightYellow}${params.line_number || '?'}${COLORS.reset}`
                );
            }

            if (params.suggestions && params.suggestions.length > 0) {
                channel.appendLine(
                    `  ${COLORS.brightGreen}💡 Suggestions:${COLORS.reset} ${COLORS.green}${params.suggestions.join(', ')}${COLORS.reset}`
                );
            }

            if (params.log_file) {
                const fileColor = params.log_file.includes('error')
                    ? COLORS.brightRed
                    : params.log_file.includes('exception')
                        ? COLORS.brightMagenta
                        : COLORS.brightCyan;
                channel.appendLine(
                    `  ${COLORS.dim}📁 From:${COLORS.reset} ${fileColor}${params.log_file}${COLORS.reset}`
                );
            }
            channel.appendLine(''); // Blank line for readability
        });

        client.onNotification('ck3/logWatcherStarted', (params: LogWatcherStartedParams) => {
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

        // Index log notification handlers (workspace scanning & indexing output)
        client.onNotification('ck3/indexLog', (params: { message: string }) => {
            logger.logServer(`[Index notification received] ${params.message}`);
            logger.logIndex(params.message);
        });

        client.onNotification('ck3/indexLog/bulk', (params: { lines: string[] }) => {
            logger.logServer(`[Index bulk notification received] ${params.lines.length} lines`);
            logger.appendIndexLines(params.lines);
        });

        // 8c: Forward logWatcher settings to server
        const lwCfg = vscode.workspace.getConfiguration('ck3LanguageServer');
        const logWatcherSettings = {
            maxLogSize: lwCfg.get<number>('logWatcher.maxLogSize', 100),
            debounceDelay: lwCfg.get<number>('logWatcher.debounceDelay', 500),
            patterns: lwCfg.get<any[]>('logWatcher.patterns', []),
        };
        client.sendNotification('ck3/logWatcherSettings', logWatcherSettings);

        // 8a: Auto-start log watcher if configured
        if (lwCfg.get<boolean>('logWatcher.enabled', true) && lwCfg.get<boolean>('logWatcher.autoStart', false)) {
            logger.logServer('Auto-starting log watcher (logWatcher.autoStart is true)');
            vscode.commands.executeCommand('ck3LanguageServer.startLogWatcher');
        }

        // Reset crash counter after stable running period
        lastStableTimestamp = Date.now();
        crashCount = 0;

        // 8d: Server crash recovery - auto-restart after unexpected stop (with limit)
        client.onDidChangeState((event) => {
            if (event.oldState === State.Running && event.newState === State.Stopped) {
                // Reset crash counter if server was stable for long enough
                if (Date.now() - lastStableTimestamp > CRASH_STABLE_WINDOW_MS) {
                    crashCount = 0;
                }

                crashCount++;

                if (crashCount > MAX_CRASH_RESTARTS) {
                    logger.logServer(`Server crashed ${crashCount} times, not restarting. Check Output for errors.`);
                    statusBar.updateState('error', 'Server crashed repeatedly - restart manually');
                    vscode.window.showErrorMessage(
                        `CK3 Language Server crashed ${crashCount} times. Please check the output panel for errors and restart manually.`,
                        'Restart Server'
                    ).then(choice => {
                        if (choice === 'Restart Server') {
                            crashCount = 0;
                            startServer(context);
                        }
                    });
                    return;
                }

                logger.logServer(`Language server stopped unexpectedly (crash ${crashCount}/${MAX_CRASH_RESTARTS}), restarting in 3s...`);
                statusBar.updateState('error', 'Server crashed - restarting...');
                setTimeout(async () => {
                    try {
                        await startServer(context);
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        logger.logServer(`Failed to restart server: ${msg}`);
                    }
                }, 3000);
            }
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

async function handleServerError(error: Error): Promise<void> {
    const action = await vscode.window.showErrorMessage(
        `CK3 Language Server error: ${error.message}`,
        'Show Output'
    );
    if (action === 'Show Output') {
        logger.showChannel(LogCategory.Server);
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
            label: '$(database) Extract Trait Data',
            description: 'Extract trait data from CK3 installation',
        },
        {
            label: '$(package) Discover Mod Data',
            description: 'Scan for Carnalitas and other registered mods',
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
            label: '$(sync) Force Refresh Logs',
            description: 'Manually read log files for new content',
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
            case '$(database) Extract Trait Data':
                await vscode.commands.executeCommand('ck3LanguageServer.extractTraitData');
                break;
            case '$(package) Discover Mod Data':
                await vscode.commands.executeCommand('ck3LanguageServer.discoverModData');
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
            case '$(sync) Force Refresh Logs':
                await vscode.commands.executeCommand('ck3LanguageServer.forceRefreshLogs');
                break;
            case '$(graph-line) Show Log Statistics':
                await vscode.commands.executeCommand('ck3LanguageServer.showLogStatistics');
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

function getSeverityIcon(severity: number): string {
    // Map LSP diagnostic severity to icons
    switch (severity) {
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
    // Clear restart debounce timer
    if (restartDebounceTimer) {
        clearTimeout(restartDebounceTimer);
        restartDebounceTimer = undefined;
    }

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

    // Dispose all log output channels
    for (const key of Object.keys(logChannels) as Array<keyof typeof logChannels>) {
        if (logChannels[key]) {
            logChannels[key]!.dispose();
            logChannels[key] = null;
        }
    }
}
