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
    outputChannel = vscode.window.createOutputChannel('CK3 Language Server');
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
            vscode.env.openExternal(
                vscode.Uri.parse('https://ck3.paradoxwikis.com/Modding')
            );
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

async function checkPythonPath(pythonPath: string): Promise<boolean> {
    try {
        // Use array form to avoid shell injection
        const { stdout } = await execAsync(`"${pythonPath.replace(/"/g, '\\"')}" --version`);
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
        // Use array form to avoid shell injection
        await execAsync(`"${pythonPath.replace(/"/g, '\\"')}" -c "import pychivalry"`);
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
            vscode.env.openExternal(
                vscode.Uri.parse('https://www.python.org/downloads/')
            );
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
            description: 'Restart the language server' 
        },
        { 
            label: '$(output) Show Output', 
            description: 'Open output channel' 
        },
        { 
            label: '$(gear) Open Settings', 
            description: 'Configure extension' 
        },
        { 
            label: '$(book) Documentation', 
            description: 'Open CK3 modding docs' 
        },
    ];
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an action'
    });
    
    if (selected) {
        switch (selected.label) {
            case '$(refresh) Restart Server':
                await vscode.commands.executeCommand('ck3LanguageServer.restart');
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

