/**
 * The extension's commands (ck3LanguageServer.*). Most forward to the language server's
 * ck3.* commands and present the result. Moved out of extension.ts in Phase 4.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { logger, LogCategory } from '../logger';
import { getLogChannel } from './log-channels';

export interface CommandHost {
    getClient(): LanguageClient | undefined;
    restart(): Promise<void>;
}

interface LogStatistics {
    [key: string]: unknown;
    errors_by_category?: Record<string, number>;
    slow_events?: Record<string, number[]>;
}

interface NamespaceEvent {
    event_id: string;
    title: string;
    file: string;
    line: number;
}

const NOT_RUNNING = 'CK3 Language Server is not running';

const DEPRECATED_EXTRACTION =
    'This command has been replaced by the built-in TypeScript language server. Game data is bundled with the extension.';

export function registerCommands(context: vscode.ExtensionContext, host: CommandHost): void {
    /** Send ck3.<command> to the server; undefined (after an error message) on failure. */
    async function server<T>(
        command: string,
        failure: string,
        args?: unknown[]
    ): Promise<T | undefined> {
        const client = host.getClient();
        if (!client) {
            vscode.window.showErrorMessage(NOT_RUNNING);
            return undefined;
        }
        try {
            const request = args === undefined ? { command } : { command, arguments: args };
            return (await client.sendRequest('workspace/executeCommand', request)) as T;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`${failure}: ${message}`);
            return undefined;
        }
    }

    const ask = (prompt: string, placeHolder: string, value?: string) =>
        vscode.window.showInputBox({ prompt, placeHolder, value });

    const commands: Record<string, (...args: never[]) => unknown> = {
        restart: () => host.restart(),

        // Data extraction is no longer run from the extension
        extractTraitData: () => vscode.window.showInformationMessage(DEPRECATED_EXTRACTION),
        extractAllGameData: () => vscode.window.showInformationMessage(DEPRECATED_EXTRACTION),
        extractLocalizationData: () => vscode.window.showInformationMessage(DEPRECATED_EXTRACTION),
        discoverModData: () => vscode.window.showInformationMessage(DEPRECATED_EXTRACTION),

        showMenu: () => showMenu(),
        showOutput: () => showOutput(),
        openDocumentation: () =>
            vscode.env.openExternal(vscode.Uri.parse('https://ck3.paradoxwikis.com/Modding')),

        validateWorkspace: async () => {
            const result = await server('ck3.validateWorkspace', 'Validation failed');
            if (result !== undefined) {
                logger.logCommand(`Validation result: ${JSON.stringify(result, null, 2)}`);
                logger.showChannel(LogCategory.Commands);
            }
        },

        rescanWorkspace: async () => {
            const result = await server('ck3.rescanWorkspace', 'Rescan failed');
            if (result !== undefined) {
                logger.logCommand(`Rescan result: ${JSON.stringify(result, null, 2)}`);
                vscode.window.showInformationMessage('Workspace rescan complete');
            }
        },

        getWorkspaceStats: async () => {
            const result = await server<Record<string, number | boolean>>(
                'ck3.getWorkspaceStats',
                'Failed to get stats'
            );
            if (result === undefined) {
                return;
            }
            logger.appendCommandLines([
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
            ]);
            logger.showChannel(LogCategory.Commands);
            vscode.window.showInformationMessage(
                `Indexed: ${result.events} events, ${result.scripted_effects} effects, ${result.scripted_triggers} triggers`
            );
        },

        generateEventTemplate: async () => {
            if (!host.getClient()) {
                vscode.window.showErrorMessage(NOT_RUNNING);
                return;
            }
            const namespace = await ask('Enter event namespace', 'e.g., my_mod', 'my_mod');
            if (!namespace) {
                return;
            }
            const eventNum = await ask('Enter event number', 'e.g., 0001', '0001');
            if (!eventNum) {
                return;
            }
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
            const result = await server<{ template: string; localization_keys: string[] }>(
                'ck3.generateEventTemplate',
                'Failed to generate template',
                [namespace, eventNum, eventType]
            );
            if (result === undefined) {
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await editor.edit((b) => b.insert(editor.selection.active, result.template));
                vscode.window.showInformationMessage(
                    `Event template inserted. Remember to add localization keys: ${result.localization_keys.join(', ')}`
                );
            } else {
                await vscode.env.clipboard.writeText(result.template);
                vscode.window.showInformationMessage('Event template copied to clipboard');
            }
        },

        findOrphanedLocalization: async () => {
            const result = await server<{ orphaned_keys: string[]; total_count: number }>(
                'ck3.findOrphanedLocalization',
                'Failed to find orphaned localization'
            );
            if (result && result.orphaned_keys.length > 0) {
                const lines = [`\nOrphaned Localization Keys (${result.total_count} total):`];
                result.orphaned_keys.forEach((key) => lines.push(`  - ${key}`));
                if (result.total_count > result.orphaned_keys.length) {
                    lines.push(
                        `  ... and ${result.total_count - result.orphaned_keys.length} more`
                    );
                }
                logger.appendCommandLines(lines);
                logger.showChannel(LogCategory.Commands);
            }
        },

        checkDependencies: () => server('ck3.checkDependencies', 'Dependency check failed'),

        // Also used by the namespace code lens
        showNamespaceEvents: async (namespace?: string) => {
            if (!host.getClient()) {
                vscode.window.showErrorMessage(NOT_RUNNING);
                return;
            }
            const ns = namespace ?? (await ask('Enter namespace name', 'e.g., my_mod'));
            if (!ns) {
                return;
            }
            const result = await server<{ events: NamespaceEvent[]; count: number }>(
                'ck3.showNamespaceEvents',
                'Failed to show namespace events',
                [ns]
            );
            if (result === undefined) {
                return;
            }
            if (result.count === 0) {
                vscode.window.showInformationMessage(`No events found in namespace '${ns}'`);
                return;
            }
            const selected = await vscode.window.showQuickPick(
                result.events.map((event) => ({
                    label: event.event_id,
                    description: event.title,
                    detail: event.file ? `Line ${event.line + 1}` : undefined,
                    event,
                })),
                {
                    placeHolder: `${result.count} events in namespace '${ns}'`,
                    matchOnDescription: true,
                }
            );
            if (selected && selected.event.file) {
                const doc = await vscode.workspace.openTextDocument(
                    vscode.Uri.parse(selected.event.file)
                );
                const editor = await vscode.window.showTextDocument(doc);
                const position = new vscode.Position(selected.event.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        },

        generateLocalizationStubs: async () => {
            if (!host.getClient()) {
                vscode.window.showErrorMessage(NOT_RUNNING);
                return;
            }
            const eventId = await ask(
                'Enter event ID to generate localization for',
                'e.g., my_mod.0001'
            );
            if (!eventId) {
                return;
            }
            const result = await server<{ localization_text: string; keys_generated: string[] }>(
                'ck3.generateLocalizationStubs',
                'Failed to generate localization',
                [eventId]
            );
            if (result === undefined) {
                return;
            }
            await vscode.env.clipboard.writeText(result.localization_text);
            const action = await vscode.window.showInformationMessage(
                `Localization stubs copied to clipboard for: ${result.keys_generated.join(', ')}`,
                'Paste at Cursor'
            );
            const editor = vscode.window.activeTextEditor;
            if (action === 'Paste at Cursor' && editor) {
                await editor.edit((b) =>
                    b.insert(editor.selection.active, result.localization_text)
                );
            }
        },

        renameEvent: async () => {
            if (!host.getClient()) {
                vscode.window.showErrorMessage(NOT_RUNNING);
                return;
            }
            const oldId = await ask('Enter current event ID', 'e.g., my_mod.0001');
            if (!oldId) {
                return;
            }
            const newId = await ask('Enter new event ID', 'e.g., my_mod.0100');
            if (!newId) {
                return;
            }
            const result = await server<{ suggestion?: string; error?: string }>(
                'ck3.renameEvent',
                'Rename failed',
                [oldId, newId]
            );
            if (result?.error) {
                vscode.window.showErrorMessage(result.error);
            } else if (result?.suggestion) {
                vscode.window.showInformationMessage(result.suggestion);
            }
        },

        startLogWatcher: async () => {
            if (!host.getClient()) {
                vscode.window.showErrorMessage(NOT_RUNNING);
                return;
            }
            const config = vscode.workspace.getConfiguration('ck3LanguageServer');
            if (!config.get<boolean>('logWatcher.enabled', true)) {
                vscode.window.showWarningMessage(
                    'Log watcher is disabled. Enable it in settings: ck3LanguageServer.logWatcher.enabled'
                );
                return;
            }
            const logPath = config.get<string>('logWatcher.logPath', '');
            logger.logDebug(`[startLogWatcher] Custom log path from settings: '${logPath}'`);
            const args = logPath ? [logPath] : [];
            logger.logDebug(`[startLogWatcher] Sending arguments: ${JSON.stringify(args)}`);
            const result = await server<{
                success: boolean;
                path?: string;
                watching?: string[];
                error?: string;
                message?: string;
            }>('ck3.startLogWatcher', 'Failed to start log watcher', args);
            if (result === undefined) {
                return;
            }
            logger.logDebug(`[startLogWatcher] Server response: ${JSON.stringify(result)}`);
            if (result.success) {
                logger.logServer(`Log watcher started: ${result.path}`);
                logger.logServer(`Monitoring files: ${result.watching?.join(', ')}`);
                const channel = getLogChannel('combined');
                channel.appendLine('='.repeat(80));
                channel.appendLine('CK3 Game Log Watcher Started');
                channel.appendLine(`Monitoring: ${result.watching?.join(', ')}`);
                channel.appendLine(`Log path: ${result.path}`);
                channel.appendLine('='.repeat(80));
                channel.appendLine('');
                vscode.window.showInformationMessage(
                    `Now monitoring CK3 logs: ${result.watching?.length} files`
                );
            } else {
                vscode.window.showErrorMessage(
                    `Failed to start log watcher: ${result.error || result.message}`
                );
            }
        },

        stopLogWatcher: async () => {
            const result = await server<{ success: boolean }>(
                'ck3.stopLogWatcher',
                'Failed to stop log watcher'
            );
            if (result?.success) {
                logger.logServer('Log watcher stopped');
                vscode.window.showInformationMessage('Log monitoring stopped');
            } else if (result) {
                vscode.window.showWarningMessage('Log watcher was not running');
            }
        },

        pauseLogWatcher: async () => {
            const result = await server<{ success: boolean }>(
                'ck3.pauseLogWatcher',
                'Failed to pause',
                []
            );
            if (result?.success) {
                vscode.window.showInformationMessage('Log monitoring paused');
            }
        },

        resumeLogWatcher: async () => {
            const result = await server<{ success: boolean }>(
                'ck3.resumeLogWatcher',
                'Failed to resume',
                []
            );
            if (result?.success) {
                vscode.window.showInformationMessage('Log monitoring resumed');
            }
        },

        forceRefreshLogs: async () => {
            const result = await server<{
                success: boolean;
                files_read?: number;
                total_lines?: number;
                error?: string;
            }>('ck3.forceRefreshLogs', 'Failed to refresh logs', []);
            if (result === undefined) {
                return;
            }
            if (!result.success) {
                vscode.window.showWarningMessage(result.error || 'Failed to refresh logs');
            } else if (result.total_lines && result.total_lines > 0) {
                vscode.window.showInformationMessage(
                    `Refreshed: ${result.total_lines} new lines from ${result.files_read} files`
                );
            } else {
                vscode.window.showInformationMessage('No new log content found');
            }
        },

        clearGameLogs: async () => {
            const result = await server('ck3.clearGameLogs', 'Failed to clear logs');
            if (result !== undefined) {
                getLogChannel('combined').clear();
                vscode.window.showInformationMessage('Game log diagnostics cleared');
            }
        },

        showLogStatistics: async () => {
            const result = await server<{
                success: boolean;
                statistics?: LogStatistics;
                error?: string;
            }>('ck3.getLogStatistics', 'Failed to get statistics');
            if (result === undefined) {
                return;
            }
            if (!result.success || !result.statistics) {
                vscode.window.showWarningMessage(result.error || 'No statistics available');
                return;
            }
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
            for (const [category, count] of Object.entries(stats.errors_by_category ?? {})) {
                lines.push(`  ${category}: ${count}`);
            }
            if (stats.slow_events && Object.keys(stats.slow_events).length > 0) {
                lines.push('', 'Slow Events (>50ms):');
                for (const [event, timings] of Object.entries(stats.slow_events)) {
                    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
                    lines.push(`  ${event}: ${avg.toFixed(1)}ms avg`);
                }
            }
            logger.appendCommandLines(lines);
            logger.showChannel(LogCategory.Commands);
        },
    };

    for (const [name, run] of Object.entries(commands)) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`ck3LanguageServer.${name}`, run)
        );
    }
}

/** The output channel picker (ck3LanguageServer.showOutput). */
async function showOutput(): Promise<void> {
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
    if (logger.hasDebugChannel()) {
        items.splice(1, 0, {
            label: '$(bug) Debug Log',
            description: 'Detailed debug information',
            category: LogCategory.Debug,
        });
    }
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
}

/** The quick menu (ck3LanguageServer.showMenu): label, description, command. */
const MENU: Array<[string, string, string, ...unknown[]]> = [
    ['$(refresh) Restart Server', 'Restart the language server', 'ck3LanguageServer.restart'],
    [
        '$(sync) Rescan Workspace',
        'Rescan workspace for symbols',
        'ck3LanguageServer.rescanWorkspace',
    ],
    [
        '$(checklist) Validate Workspace',
        'Run full workspace validation',
        'ck3LanguageServer.validateWorkspace',
    ],
    [
        '$(graph) Show Statistics',
        'Display workspace index statistics',
        'ck3LanguageServer.getWorkspaceStats',
    ],
    [
        '$(add) Generate Event Template',
        'Insert a new event template',
        'ck3LanguageServer.generateEventTemplate',
    ],
    [
        '$(symbol-string) Generate Localization Stubs',
        'Generate localization entries for an event',
        'ck3LanguageServer.generateLocalizationStubs',
    ],
    [
        '$(database) Extract Trait Data',
        'Extract trait data from CK3 installation',
        'ck3LanguageServer.extractTraitData',
    ],
    [
        '$(package) Discover Mod Data',
        'Scan for Carnalitas and other registered mods',
        'ck3LanguageServer.discoverModData',
    ],
    ['$(edit) Rename Event', 'Rename an event ID', 'ck3LanguageServer.renameEvent'],
    [
        '$(search) Find Orphaned Localization',
        'Find unused localization keys',
        'ck3LanguageServer.findOrphanedLocalization',
    ],
    [
        '$(list-tree) Show Namespace Events',
        'List events in a namespace',
        'ck3LanguageServer.showNamespaceEvents',
    ],
    [
        '$(references) Check Dependencies',
        'Check for undefined dependencies',
        'ck3LanguageServer.checkDependencies',
    ],
    [
        '$(play) Start Log Watcher',
        'Monitor game logs for errors',
        'ck3LanguageServer.startLogWatcher',
    ],
    [
        '$(debug-stop) Stop Log Watcher',
        'Stop monitoring game logs',
        'ck3LanguageServer.stopLogWatcher',
    ],
    [
        '$(sync) Force Refresh Logs',
        'Manually read log files for new content',
        'ck3LanguageServer.forceRefreshLogs',
    ],
    [
        '$(graph-line) Show Log Statistics',
        'Display log analysis stats',
        'ck3LanguageServer.showLogStatistics',
    ],
    [
        '$(clear-all) Clear Log Diagnostics',
        'Clear all log-related diagnostics',
        'ck3LanguageServer.clearGameLogs',
    ],
    ['$(output) Show Output', 'Open output channel', 'ck3LanguageServer.showOutput'],
    [
        '$(gear) Open Settings',
        'Configure extension',
        'workbench.action.openSettings',
        'ck3LanguageServer',
    ],
    ['$(book) Documentation', 'Open CK3 modding docs', 'ck3LanguageServer.openDocumentation'],
];

async function showMenu(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
        MENU.map(([label, description]) => ({ label, description })),
        { placeHolder: 'Select an action' }
    );
    const entry = MENU.find(([label]) => label === selected?.label);
    if (entry) {
        const [, , command, ...args] = entry;
        await vscode.commands.executeCommand(command, ...args);
    }
}
