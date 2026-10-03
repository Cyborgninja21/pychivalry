/**
 * Starts, stops and restarts the language server (dist/server-main.js) and recovers from
 * crashes. Moved out of extension.ts in Phase 4 without behaviour changes.
 */

import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
    Trace,
} from 'vscode-languageclient/node';
import { CK3StatusBar } from '../statusBar';
import { logger, LogCategory } from '../logger';
import { registerLogNotifications } from './log-channels';
import { WorkspaceHealth } from './workspace-health';

const MAX_CRASH_RESTARTS = 3;
const CRASH_STABLE_WINDOW_MS = 60000;

export class ServerController {
    private client: LanguageClient | undefined;
    /** The crash watcher of the running client (disposed before a deliberate stop). */
    private crashWatch: vscode.Disposable | undefined;
    private restartInProgress = false;
    private crashCount = 0;
    private lastStableTimestamp = Date.now();

    constructor(
        private context: vscode.ExtensionContext,
        private statusBar: CK3StatusBar,
        private health?: WorkspaceHealth,
        /** Called on the server's ck3/modStructureChanged (the CK3 Explorer view). */
        private onStructureChanged?: () => void
    ) {}

    /** The running client, if any. */
    public getClient(): LanguageClient | undefined {
        return this.client;
    }

    public async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    public async start(): Promise<void> {
        if (this.restartInProgress) {
            logger.logServer('Server restart already in progress, skipping');
            return;
        }
        this.restartInProgress = true;
        try {
            await this.startInternal();
        } finally {
            this.restartInProgress = false;
        }
    }

    private async startInternal(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ck3LanguageServer');
        if (!config.get<boolean>('enable', true)) {
            logger.logServer('CK3 Language Server is disabled in settings');
            this.statusBar.updateState('stopped', 'Disabled in settings');
            return;
        }
        if (!vscode.workspace.isTrusted) {
            logger.logServer('Workspace not trusted, server disabled');
            this.statusBar.updateState('stopped', 'Workspace not trusted');
            return;
        }
        this.statusBar.updateState('starting');

        const args = config.get<string[]>('args', []);
        const traceLevel = config.get<string>('trace.server', 'off');
        const logLevel = config.get<string>('logLevel', 'info');
        logger.logServer(`Server args: ${args.join(' ') || '(none)'}`);
        logger.logServer(`Log level: ${logLevel}`);
        logger.logDebug(`Trace level: ${traceLevel}`);

        // The TypeScript server runs as a Node.js process
        const serverModule = this.context.asAbsolutePath('dist/server-main.js');
        logger.logServer(`Using TypeScript server at: ${serverModule}`);
        const serverOptions: ServerOptions = {
            module: serverModule,
            transport: 0, // TransportKind.stdio
            options: { env: { ...process.env, LOG_LEVEL: logLevel } },
        };
        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'ck3' },
                { scheme: 'file', pattern: '**/*.{txt,gui,gfx,asset}' },
            ],
            synchronize: {
                // workspace/didChangeWatchedFiles: files created, changed or deleted on disk
                // are re-indexed and re-validated in the background.
                fileEvents: [
                    vscode.workspace.createFileSystemWatcher('**/*.{txt,gui,gfx,asset}'),
                    vscode.workspace.createFileSystemWatcher('**/localization/**/*.yml'),
                    // Graphics files created or deleted (the GFX001 check's directory cache).
                    vscode.workspace.createFileSystemWatcher('**/*.{dds,png,tga}'),
                ],
            },
            outputChannel: logger.getChannel(LogCategory.Server),
            traceOutputChannel: logger.getChannel(LogCategory.Trace),
        };

        try {
            const client = new LanguageClient(
                'ck3LanguageServer',
                'CK3 Language Server',
                serverOptions,
                clientOptions
            );
            this.client = client;
            client.setTrace(
                traceLevel === 'messages'
                    ? Trace.Messages
                    : traceLevel === 'verbose'
                      ? Trace.Verbose
                      : Trace.Off
            );

            // Background validation results (file decorations, status bar).
            this.health?.reset();
            client.onNotification('ck3/workspaceDiagnostics', (message: unknown) =>
                this.health?.apply(message)
            );
            client.onNotification('ck3/modStructureChanged', () => this.onStructureChanged?.());

            logger.logServer('Starting language client...');
            logger.logDebug(`Client ID: ck3LanguageServer`);
            logger.logDebug(`Document selector: ck3, *.txt, *.gui, *.gfx, *.asset`);
            await client.start();
            logger.logServer('Language client started successfully');
            logger.logDebug(`Client state: running`);
            this.statusBar.updateState('running');

            registerLogNotifications(client);

            // Forward the log watcher settings to the server
            const lwCfg = vscode.workspace.getConfiguration('ck3LanguageServer');
            client.sendNotification('ck3/logWatcherSettings', {
                maxLogSize: lwCfg.get<number>('logWatcher.maxLogSize', 100),
                debounceDelay: lwCfg.get<number>('logWatcher.debounceDelay', 500),
                patterns: lwCfg.get<unknown[]>('logWatcher.patterns', []),
            });
            if (
                lwCfg.get<boolean>('logWatcher.enabled', true) &&
                lwCfg.get<boolean>('logWatcher.autoStart', false)
            ) {
                logger.logServer('Auto-starting log watcher (logWatcher.autoStart is true)');
                vscode.commands.executeCommand('ck3LanguageServer.startLogWatcher');
            }

            this.lastStableTimestamp = Date.now();
            this.crashCount = 0;
            this.crashWatch = client.onDidChangeState((event) => {
                if (event.oldState === State.Running && event.newState === State.Stopped) {
                    this.onCrash();
                }
            });
            this.context.subscriptions.push(client);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.logServer(`Failed to start language server: ${message}`);
            const action = await vscode.window.showErrorMessage(
                `CK3 Language Server error: ${message}`,
                'Show Output'
            );
            if (action === 'Show Output') {
                logger.showChannel(LogCategory.Server);
            }
            this.statusBar.updateState('error', message);
        }
    }

    /** Auto-restart after an unexpected stop, at most MAX_CRASH_RESTARTS in a row. */
    private onCrash(): void {
        if (Date.now() - this.lastStableTimestamp > CRASH_STABLE_WINDOW_MS) {
            this.crashCount = 0;
        }
        this.crashCount++;
        if (this.crashCount > MAX_CRASH_RESTARTS) {
            logger.logServer(
                `Server crashed ${this.crashCount} times, not restarting. Check Output for errors.`
            );
            this.statusBar.updateState('error', 'Server crashed repeatedly - restart manually');
            vscode.window
                .showErrorMessage(
                    `CK3 Language Server crashed ${this.crashCount} times. Please check the output panel for errors and restart manually.`,
                    'Restart Server'
                )
                .then((choice) => {
                    if (choice === 'Restart Server') {
                        this.crashCount = 0;
                        this.start();
                    }
                });
            return;
        }
        logger.logServer(
            `Language server stopped unexpectedly (crash ${this.crashCount}/${MAX_CRASH_RESTARTS}), restarting in 3s...`
        );
        this.statusBar.updateState('error', 'Server crashed - restarting...');
        setTimeout(async () => {
            try {
                await this.start();
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.logServer(`Failed to restart server: ${msg}`);
            }
        }, 3000);
    }

    public async stop(): Promise<void> {
        if (!this.client) {
            return;
        }
        // A deliberate stop is not a crash: without this, restart() started a second
        // client 3 s later through onCrash(), next to the one it had just started.
        this.crashWatch?.dispose();
        this.crashWatch = undefined;
        this.statusBar.updateState('stopped');
        logger.logServer('Stopping language client...');
        try {
            await this.client.stop();
            this.client = undefined;
            logger.logServer('Language client stopped');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.logServer(`Error stopping client: ${message}`);
        }
    }
}
