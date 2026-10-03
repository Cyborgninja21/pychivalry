/**
 * The CK3 Explorer view (#83): the mod's logical structure in the Explorer container,
 * one level at a time from the server's `ck3/modStructure` request (the engine index, no
 * file walk in the client). Clicking an item reveals its definition. The view refreshes
 * (debounced) when the server reports an index change (`ck3/modStructureChanged`: files on
 * disk, saves, the first index) and when a background validation pass goes idle, and from
 * the refresh button in its title bar.
 */

import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import { logger } from '../logger';
import {
    Debouncer,
    ItemRange,
    ModStructureNode,
    ModStructureParams,
    REFRESH_COMMAND,
    REVEAL_COMMAND,
    treeItemSpec,
    VIEW_CONTEXT_KEY,
    VIEW_ID,
} from './mod-explorer-model';
import { WorkspaceHealth } from './workspace-health';

const MOD_STRUCTURE_REQUEST = 'ck3/modStructure';

export class ModExplorerProvider
    implements vscode.TreeDataProvider<ModStructureNode>, vscode.Disposable
{
    private emitter = new vscode.EventEmitter<ModStructureNode | undefined | void>();
    public readonly onDidChangeTreeData = this.emitter.event;
    private debouncer = new Debouncer(() => this.emitter.fire());
    private subscriptions: vscode.Disposable[] = [];

    constructor(
        private client: () => LanguageClient | undefined,
        health?: WorkspaceHealth
    ) {
        if (health) {
            const listener = health.onDidChange((change) => {
                if (change.kind === 'state' && health.lastState?.state === 'idle') {
                    this.refresh();
                }
            });
            this.subscriptions.push({ dispose: () => listener.dispose() });
        }
    }

    /** Refresh soon (coalesced with other refreshes within REFRESH_DEBOUNCE_MS). */
    public refresh(): void {
        this.debouncer.schedule();
    }

    /** Refresh at once (the title bar button). */
    public refreshNow(): void {
        this.debouncer.dispose();
        this.emitter.fire();
    }

    public getTreeItem(node: ModStructureNode): vscode.TreeItem {
        const spec = treeItemSpec(node);
        const item = new vscode.TreeItem(
            spec.label,
            spec.collapsible
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        item.id = node.id;
        item.description = spec.description;
        item.tooltip = spec.tooltip;
        item.iconPath = new vscode.ThemeIcon(spec.icon);
        item.contextValue = spec.contextValue;
        if (spec.reveal) {
            item.command = {
                command: spec.reveal.command,
                title: 'Reveal Definition',
                arguments: spec.reveal.arguments,
            };
            item.resourceUri = vscode.Uri.parse(spec.reveal.arguments[0]);
        }
        return item;
    }

    public async getChildren(node?: ModStructureNode): Promise<ModStructureNode[]> {
        if (node && !node.children) {
            return [];
        }
        return this.request(node?.children ?? {});
    }

    /** One `ck3/modStructure` request; [] while the server is not running. */
    public async request(params: ModStructureParams): Promise<ModStructureNode[]> {
        const client = this.client();
        if (!client || !client.isRunning()) {
            return [];
        }
        try {
            return await client.sendRequest<ModStructureNode[]>(MOD_STRUCTURE_REQUEST, params);
        } catch (error) {
            logger.logServer(`CK3 Explorer: ${error instanceof Error ? error.message : error}`);
            return [];
        }
    }

    public dispose(): void {
        this.debouncer.dispose();
        this.emitter.dispose();
        for (const s of this.subscriptions) {
            s.dispose();
        }
    }
}

/** Open the item's file and put the cursor on its definition. */
export async function revealModItem(uri: string, range: ItemRange): Promise<vscode.TextEditor> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
    const start = new vscode.Position(range.start.line, range.start.character);
    const editor = await vscode.window.showTextDocument(document, {
        preview: true,
        selection: new vscode.Range(start, start),
    });
    editor.revealRange(
        new vscode.Range(start, start),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
    return editor;
}

/**
 * Register the view, its commands and its context key. The view is shown when the
 * workspace holds a descriptor.mod or files of the CK3 languages.
 */
export function registerModExplorer(
    context: vscode.ExtensionContext,
    client: () => LanguageClient | undefined,
    health?: WorkspaceHealth
): ModExplorerProvider {
    const provider = new ModExplorerProvider(client, health);
    context.subscriptions.push(
        provider,
        vscode.window.createTreeView(VIEW_ID, {
            treeDataProvider: provider,
            showCollapseAll: true,
        }),
        vscode.commands.registerCommand(REFRESH_COMMAND, () => provider.refreshNow()),
        vscode.commands.registerCommand(REVEAL_COMMAND, (uri: string, range: ItemRange) =>
            revealModItem(uri, range)
        )
    );
    void vscode.workspace
        .findFiles(
            '**/{descriptor.mod,*.txt,*.gui,*.gfx,*.asset,*_l_*.yml}',
            '**/node_modules/**',
            1
        )
        .then(
            (found) =>
                vscode.commands.executeCommand('setContext', VIEW_CONTEXT_KEY, found.length > 0),
            () => undefined
        );
    return provider;
}
