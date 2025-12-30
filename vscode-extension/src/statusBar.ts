import * as vscode from 'vscode';

export type ServerState = 'starting' | 'running' | 'stopped' | 'error';

export class CK3StatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private state: ServerState = 'stopped';

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'ck3LanguageServer.showMenu';
        this.updateState('stopped');
    }

    updateState(state: ServerState, message?: string): void {
        this.state = state;
        switch (state) {
            case 'starting':
                this.statusBarItem.text = '$(sync~spin) CK3';
                this.statusBarItem.tooltip = 'CK3 Language Server starting...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'running':
                this.statusBarItem.text = '$(check) CK3';
                this.statusBarItem.tooltip = 'CK3 Language Server running';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'stopped':
                this.statusBarItem.text = '$(circle-slash) CK3';
                this.statusBarItem.tooltip = 'CK3 Language Server stopped';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                break;
            case 'error':
                this.statusBarItem.text = '$(error) CK3';
                this.statusBarItem.tooltip = message || 'CK3 Language Server error';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                break;
        }
        this.statusBarItem.show();
    }

    getState(): ServerState {
        return this.state;
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
