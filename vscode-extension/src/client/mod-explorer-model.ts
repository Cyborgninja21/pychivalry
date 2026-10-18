/**
 * The CK3 Explorer view's mapping from the server's `ck3/modStructure` nodes to what a
 * tree item shows (client/mod-explorer.ts builds the vscode.TreeItem from it). No VS Code
 * import, so the mapping is unit tested without an editor.
 */

import type { ModStructureNode } from '../server/lsp/mod-structure';

export type { ModStructureNode, ModStructureParams } from '../server/lsp/mod-structure';

/** The range of an item's definition (LSP shape: 0-based lines and characters). */
export type ItemRange = NonNullable<ModStructureNode['location']>['range'];

export const VIEW_ID = 'ck3.modExplorer';
/** Context key: the workspace holds a descriptor.mod or CK3 files (the view's `when`). */
export const VIEW_CONTEXT_KEY = 'ck3.modExplorer.enabled';
export const REFRESH_COMMAND = 'ck3LanguageServer.refreshModExplorer';
export const REVEAL_COMMAND = 'ck3LanguageServer.revealModItem';
/** Refreshes are coalesced: the index changes in bursts (a save, a folder of files). */
export const REFRESH_DEBOUNCE_MS = 500;

export interface TreeItemSpec {
    label: string;
    /** Shown after the label: a count, an event type, a file name. */
    description?: string;
    tooltip: string;
    collapsible: boolean;
    /** Codicon id (vscode.ThemeIcon). */
    icon: string;
    /** `ck3.category`, `ck3.group`, `ck3.item` (for menus). */
    contextValue: string;
    /** The reveal command's arguments, for items with a location. */
    reveal?: { command: string; arguments: [string, ItemRange] };
}

/** Codicons per category (categories and their items) and for the groups. */
const CATEGORY_ICONS: Readonly<Record<string, string>> = {
    events: 'symbol-event',
    decisions: 'checklist',
    character_interactions: 'person',
    scripted_effects: 'symbol-method',
    scripted_triggers: 'symbol-boolean',
    script_values: 'symbol-number',
    on_actions: 'zap',
    localization: 'globe',
};
const GROUP_ICONS: Readonly<Record<string, string>> = {
    events: 'symbol-namespace',
    localization: 'symbol-string',
};

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

function countNoun(node: ModStructureNode): [string, string] {
    if (node.category === 'localization') {
        return ['key', 'keys'];
    }
    if (node.category === 'events') {
        return ['event', 'events'];
    }
    return ['definition', 'definitions'];
}

export function treeItemSpec(node: ModStructureNode): TreeItemSpec {
    const [one, many] = countNoun(node);
    const icon =
        node.kind === 'group'
            ? (GROUP_ICONS[node.category] ?? 'folder')
            : node.kind === 'category'
              ? (CATEGORY_ICONS[node.category] ?? 'folder')
              : (CATEGORY_ICONS[node.category] ?? 'symbol-misc');
    if (node.kind !== 'item') {
        const count = node.count ?? 0;
        return {
            label: node.label,
            description: String(count),
            tooltip: `${node.label}: ${plural(count, one, many)}`,
            collapsible: node.children !== undefined,
            icon,
            contextValue: `ck3.${node.kind}`,
        };
    }
    const description =
        node.count !== undefined
            ? plural(node.count, one, many)
            : node.detail !== undefined
              ? node.detail
              : undefined;
    return {
        label: node.label,
        description,
        tooltip: description ? `${node.label} (${description})` : node.label,
        collapsible: node.children !== undefined,
        icon,
        contextValue: 'ck3.item',
        reveal: node.location
            ? { command: REVEAL_COMMAND, arguments: [node.location.uri, node.location.range] }
            : undefined,
    };
}

/** Calls `run` once, `ms` after the last of a burst of `schedule()` calls. */
export class Debouncer {
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private run: () => void,
        private ms = REFRESH_DEBOUNCE_MS
    ) {}

    public schedule(): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.run();
        }, this.ms);
    }

    public get pending(): boolean {
        return this.timer !== undefined;
    }

    public dispose(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}
