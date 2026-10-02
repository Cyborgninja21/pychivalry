/**
 * VS Code extension entry point — wiring only: the logger and status bar, the commands
 * (client/commands.ts), the game-log output channels (client/log-channels.ts) and the
 * language server's lifecycle (client/server-controller.ts). The server itself
 * (dist/server-main.js) delegates every request to a provider on pychivalry-engine.
 */

import * as vscode from 'vscode';
import { CK3StatusBar } from './statusBar';
import { logger } from './logger';
import { registerCommands } from './client/commands';
import { createLogChannels, disposeLogChannels } from './client/log-channels';
import { ServerController } from './client/server-controller';
import { WorkspaceHealth } from './client/workspace-health';

/** What activate() returns (vscode.extensions.getExtension(...).exports), for tests. */
export interface CK3ExtensionApi {
    /** The workspace's diagnostics as the client sees them (ck3/workspaceDiagnostics). */
    health: WorkspaceHealth;
    /** When activate() started (ms since epoch). */
    activatedAt: number;
}

let controller: ServerController | undefined;
let restartDebounceTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<CK3ExtensionApi> {
    const activatedAt = Date.now();
    logger.initialize(context);
    // Keys are VS Code's own spelling of a URI, so decorations find them by uri.toString().
    const health = new WorkspaceHealth((uri) => vscode.Uri.parse(uri).toString());
    const statusBar = new CK3StatusBar();
    context.subscriptions.push(statusBar);

    // Debug channels follow the logLevel setting
    if (
        vscode.workspace.getConfiguration('ck3LanguageServer').get<string>('logLevel', 'info') ===
        'debug'
    ) {
        logger.enableDebugMode();
    }
    logger.logServer('CK3 Language Server extension activating...');

    // Pre-create the log watcher channels so that they appear in the Output menu
    createLogChannels();

    const server = new ServerController(context, statusBar, health);
    controller = server;
    registerCommands(context, {
        getClient: () => server.getClient(),
        restart: async () => {
            if (restartDebounceTimer) {
                clearTimeout(restartDebounceTimer);
                restartDebounceTimer = undefined;
            }
            logger.logServer('Restarting CK3 Language Server...');
            await server.restart();
        },
    });

    await server.start();

    // Restart on relevant configuration changes (debounced)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (
                !e.affectsConfiguration('ck3LanguageServer.enable') &&
                !e.affectsConfiguration('ck3LanguageServer.logLevel')
            ) {
                return;
            }
            if (restartDebounceTimer) {
                clearTimeout(restartDebounceTimer);
            }
            restartDebounceTimer = setTimeout(async () => {
                restartDebounceTimer = undefined;
                logger.logServer('Configuration changed, restarting server...');
                const level = vscode.workspace
                    .getConfiguration('ck3LanguageServer')
                    .get<string>('logLevel', 'info');
                if (level === 'debug') {
                    logger.enableDebugMode();
                    logger.logServer('Debug mode enabled - Debug and Performance channels active');
                }
                await server.restart();
            }, 500);
        })
    );

    logger.logServer('CK3 Language Server extension activated');
    return { health, activatedAt };
}

export async function deactivate(): Promise<void> {
    if (restartDebounceTimer) {
        clearTimeout(restartDebounceTimer);
        restartDebounceTimer = undefined;
    }
    await controller?.stop();
    disposeLogChannels();
}
