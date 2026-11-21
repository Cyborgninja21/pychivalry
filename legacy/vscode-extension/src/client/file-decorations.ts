/**
 * Explorer file decorations (#87): each file with errors or warnings gets a badge with the
 * count of its highest severity and that severity's colour; the colour propagates to its
 * folders. Fed by ck3/workspaceDiagnostics through WorkspaceHealth, so unopened files are
 * decorated as soon as the server's background validation publishes them.
 */

import * as vscode from 'vscode';
import { decorationFor, parentFolderUris, WorkspaceHealth } from './workspace-health';

export class CK3FileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    public readonly onDidChangeFileDecorations = this.emitter.event;
    private readonly subscription: { dispose(): void };

    constructor(private readonly health: WorkspaceHealth) {
        this.subscription = health.onDidChange((change) => {
            if (change.kind === 'files') {
                this.emitter.fire(this.withParents(change.keys));
            }
        });
    }

    public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const spec = decorationFor(this.health.countsOf(uri.toString()));
        if (!spec) {
            return undefined;
        }
        const decoration = new vscode.FileDecoration(
            spec.badge,
            spec.tooltip,
            new vscode.ThemeColor(spec.color)
        );
        decoration.propagate = true;
        return decoration;
    }

    /** The changed files and every folder above them inside the workspace. */
    private withParents(keys: string[]): vscode.Uri[] {
        const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.toString());
        const all = new Set<string>();
        for (const key of keys) {
            all.add(key);
            for (const parent of parentFolderUris(key, roots)) {
                all.add(parent);
            }
        }
        return Array.from(all).map((u) => vscode.Uri.parse(u));
    }

    public dispose(): void {
        this.subscription.dispose();
        this.emitter.dispose();
    }
}
