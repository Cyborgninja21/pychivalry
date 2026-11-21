import * as vscode from 'vscode';
import {
    statusBarBackground,
    statusBarText,
    statusBarTooltip,
    WorkspaceHealth,
} from './client/workspace-health';

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
                this.statusBarItem.text = '$(sync~spin) Crusader Kings 3';
                this.statusBarItem.tooltip = 'Crusader Kings 3 Language Server starting...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'running':
                this.statusBarItem.text = '$(check) Crusader Kings 3';
                this.statusBarItem.tooltip = 'Crusader Kings 3 Language Server running';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'stopped':
                this.statusBarItem.text = '$(circle-slash) Crusader Kings 3';
                this.statusBarItem.tooltip = 'Crusader Kings 3 Language Server stopped';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                break;
            case 'error':
                this.statusBarItem.text = '$(error) Crusader Kings 3';
                this.statusBarItem.tooltip = message || 'Crusader Kings 3 Language Server error';
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

/**
 * The workspace health item (#84), next to the server item: error and warning totals of
 * the whole workspace from background validation, a spinner with done/total while a pass
 * runs, the colour of the worst severity. Click opens the Problems panel (VS Code has no
 * public API to set its filter, so it opens unfiltered).
 */
export class CK3HealthStatusBar implements vscode.Disposable {
    private readonly item: vscode.StatusBarItem;
    private readonly subscription: { dispose(): void };

    constructor(private readonly health: WorkspaceHealth) {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.item.command = 'workbench.action.problems.focus';
        this.subscription = health.onDidChange(() => this.update());
        this.update();
    }

    /** The text shown now (for tests). */
    public get text(): string {
        return this.item.text;
    }

    private update(): void {
        const summary = this.health.summary();
        if (summary.state === 'unknown' && this.health.keys().length === 0) {
            this.item.hide();
            return;
        }
        this.item.text = statusBarText(summary);
        this.item.tooltip = statusBarTooltip(summary);
        const background = statusBarBackground(summary);
        this.item.backgroundColor = background ? new vscode.ThemeColor(background) : undefined;
        this.item.show();
    }

    public dispose(): void {
        this.subscription.dispose();
        this.item.dispose();
    }
}
