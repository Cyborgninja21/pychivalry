import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Trace,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('CK3 Language Server');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('CK3 Language Server extension activating...');

    // Register restart command
    context.subscriptions.push(
        vscode.commands.registerCommand('ck3LanguageServer.restart', async () => {
            outputChannel.appendLine('Restarting CK3 Language Server...');
            await deactivate();
            await startServer(context);
        })
    );

    // Start the server
    await startServer(context);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (
                e.affectsConfiguration('ck3LanguageServer.pythonPath') ||
                e.affectsConfiguration('ck3LanguageServer.enable')
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
        return;
    }

    const pythonPath = config.get<string>('pythonPath', 'python');
    const args = config.get<string[]>('args', []);
    const traceLevel = config.get<string>('trace.server', 'off');

    outputChannel.appendLine(`Using Python: ${pythonPath}`);
    outputChannel.appendLine(`Server args: ${args.join(' ')}`);

    // Server options
    const serverOptions: ServerOptions = {
        command: pythonPath,
        args: ['-m', 'pychivalry.server', ...args],
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
            fileEvents: vscode.workspace.createFileSystemWatcher(
                '**/*.{txt,gui,gfx,asset}'
            ),
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

        // Register for disposal
        context.subscriptions.push(client);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Failed to start language server: ${message}`);
        vscode.window.showErrorMessage(
            `Failed to start CK3 Language Server: ${message}`
        );
    }
}

export async function deactivate(): Promise<void> {
    if (!client) {
        return;
    }
    
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

