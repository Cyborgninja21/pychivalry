import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // Get Python path from configuration
    const config = workspace.getConfiguration('ck3LanguageServer');
    const pythonPath = config.get<string>('pythonPath', 'python');

    // Command to start the language server
    const serverOptions: ServerOptions = {
        command: pythonPath,
        args: ['-m', 'pychivalry.server'],
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'ck3' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.{txt,gui,gfx,asset}')
        }
    };

    // Create the language client and start the client
    client = new LanguageClient(
        'ck3LanguageServer',
        'CK3 Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client (this will also launch the server)
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
