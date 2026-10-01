/**
 * The server's workspace/executeCommand handlers (ck3.*). Moved out of server.ts in
 * Phase 4; each command reads the engine workspace (index, event metadata, call graph)
 * and the localization index, and the log commands delegate to the log controller.
 */

import * as path from 'path';
import { promises as fsp } from 'fs';
import { Connection, Diagnostic, TextDocuments, WorkspaceFolder } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, LocalizationIndex, SymbolType, Workspace } from 'pychivalry-engine';
import { fileUriToPath, pathToFileUri } from './utils/uri';
import { LogWatcherController } from './log/controller';

/** Every command the server advertises in executeCommandProvider. */
export const SERVER_COMMANDS = [
    'ck3.validateWorkspace',
    'ck3.rescanWorkspace',
    'ck3.getWorkspaceStats',
    'ck3.getThreadingMetrics',
    'ck3.generateEventTemplate',
    'ck3.findOrphanedLocalization',
    'ck3.showEventChain',
    'ck3.checkDependencies',
    'ck3.showNamespaceEvents',
    'ck3.insertTextAtCursor',
    'ck3.generateLocalizationStubs',
    'ck3.renameEvent',
    'ck3.startLogWatcher',
    'ck3.stopLogWatcher',
    'ck3.pauseLogWatcher',
    'ck3.resumeLogWatcher',
    'ck3.forceRefreshLogs',
    'ck3.clearGameLogs',
    'ck3.getLogStatistics',
];

export interface CommandHost {
    connection: Connection;
    documents: TextDocuments<TextDocument>;
    workspace: Workspace;
    localization: LocalizationIndex;
    parser: CK3Parser;
    workspaceFolders: () => WorkspaceFolder[];
    diagnose: (document: TextDocument) => Promise<Diagnostic[]>;
    publish: (document: TextDocument) => Promise<void>;
    log: LogWatcherController;
}

type Args = unknown[];

export class ServerCommands {
    constructor(private host: CommandHost) {}

    public async execute(command: string, args: Args): Promise<unknown> {
        switch (command) {
            case 'ck3.validateWorkspace':
                return this.validateWorkspace();
            case 'ck3.rescanWorkspace':
                return this.rescanWorkspace();
            case 'ck3.getWorkspaceStats':
                return this.host.workspace.index.getStatistics();
            case 'ck3.getThreadingMetrics':
                // Single-threaded event-loop model — all requests are handled sequentially
                return {
                    isThreaded: false,
                    model: 'single-threaded',
                    note: 'TypeScript server runs in single process',
                };
            case 'ck3.generateEventTemplate':
                return this.generateEventTemplate(args);
            case 'ck3.findOrphanedLocalization':
                return this.findOrphanedLocalization();
            case 'ck3.showEventChain':
                return this.showEventChain(args);
            case 'ck3.checkDependencies':
                return this.checkDependencies();
            case 'ck3.showNamespaceEvents':
                return this.showNamespaceEvents(args);
            case 'ck3.insertTextAtCursor':
                return this.insertTextAtCursor(args);
            case 'ck3.generateLocalizationStubs':
                return this.generateLocalizationStubs(args);
            case 'ck3.renameEvent':
                return this.renameEvent(args);
            case 'ck3.startLogWatcher':
                return this.host.log.start();
            case 'ck3.stopLogWatcher':
                return this.host.log.stop();
            case 'ck3.pauseLogWatcher':
                return this.host.log.pause();
            case 'ck3.resumeLogWatcher':
                return this.host.log.resume();
            case 'ck3.forceRefreshLogs':
                return this.host.log.forceRefresh();
            case 'ck3.clearGameLogs':
                return this.host.log.clear();
            case 'ck3.getLogStatistics':
                return this.host.log.statistics();
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }

    private async validateWorkspace(): Promise<{
        success: boolean;
        errors: number;
        warnings: number;
    }> {
        const count = { errors: 0, warnings: 0 };
        for (const document of this.host.documents.all()) {
            for (const d of await this.host.diagnose(document)) {
                if (d.severity === 1) {
                    count.errors++;
                } else if (d.severity === 2) {
                    count.warnings++;
                }
            }
        }
        return { success: true, ...count };
    }

    /**
     * Index every CK3 file of the workspace folders (in batches), rebuild the
     * localization index, then validate every file (open or not) and publish diagnostics.
     */
    public async rescanWorkspace(): Promise<Record<string, unknown>> {
        const { connection, workspace, parser } = this.host;
        const BATCH_SIZE = 15;
        let filesScanned = 0;
        let errors = 0;
        const allFileUris: string[] = [];

        connection.sendNotification('ck3/indexLog', { message: 'Starting workspace rescan...' });
        for (const folder of this.host.workspaceFolders()) {
            const files = await workspace.findCK3Files(folder);
            connection.sendNotification('ck3/indexLog', {
                message: `Found ${files.length} CK3 files in ${folder.name}`,
            });
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const results = await Promise.allSettled(
                    files.slice(i, i + BATCH_SIZE).map(async (file) => {
                        const content = await fsp.readFile(file, 'utf-8');
                        const uri = pathToFileUri(file);
                        workspace.index.indexSync(uri, parser.parse(content).ast);
                        return uri;
                    })
                );
                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        filesScanned++;
                        allFileUris.push(result.value);
                    } else {
                        errors++;
                        connection.console.error(`Failed to scan file: ${result.reason}`);
                    }
                }
                connection.sendNotification('ck3/indexLog', {
                    message: `Indexed ${filesScanned} files...`,
                });
            }
        }
        await this.scanLocalization();

        connection.sendNotification('ck3/indexLog/bulk', {
            lines: [
                `Workspace rescan complete: ${filesScanned} files indexed`,
                errors > 0 ? `${errors} file(s) had errors` : 'No errors',
            ],
        });

        for (const document of this.host.documents.all()) {
            await this.host.publish(document);
        }
        // Workspace-wide diagnostics, not just for the open files
        const openUris = new Set(this.host.documents.all().map((d) => d.uri));
        for (const uri of allFileUris.filter((u) => !openUris.has(u))) {
            try {
                const content = await fsp.readFile(fileUriToPath(uri), 'utf-8');
                const doc = TextDocument.create(uri, 'ck3', 0, content);
                connection.sendDiagnostics({ uri, diagnostics: await this.host.diagnose(doc) });
            } catch (error) {
                connection.console.error(`Failed to validate ${uri}: ${error}`);
            }
        }

        return {
            success: true,
            message: `Workspace rescanned: ${filesScanned} files indexed${errors > 0 ? `, ${errors} errors` : ''}`,
            filesScanned,
            errors,
        };
    }

    /** Index the localization/ directory of every workspace folder. */
    public async scanLocalization(): Promise<void> {
        for (const folder of this.host.workspaceFolders()) {
            const locPath = path.join(fileUriToPath(folder.uri), 'localization');
            const count = await this.host.localization.scanDirectory(locPath);
            if (count > 0) {
                this.host.connection.sendNotification('ck3/indexLog', {
                    message: `Indexed ${count} localization keys`,
                });
            }
        }
    }

    private generateEventTemplate(args: Args): Record<string, unknown> {
        const namespace = String(args[0] ?? 'my_namespace');
        const id = String(args[1] ?? '0001');
        const template = `${namespace}.${id} = {
    type = character_event
    title = ${namespace}.${id}.t
    desc = ${namespace}.${id}.desc
    theme = realm

    trigger = {
        # Add trigger conditions here
    }

    immediate = {
        # Add immediate effects here
    }

    option = {
        name = ${namespace}.${id}.a
        # Add option effects here
    }
}`;
        return {
            template,
            event_id: `${namespace}.${id}`,
            localization_keys: [
                `${namespace}.${id}.t`,
                `${namespace}.${id}.desc`,
                `${namespace}.${id}.a`,
            ],
        };
    }

    private findOrphanedLocalization(): Record<string, unknown> {
        const index = this.host.workspace.index;
        const eventIds = new Set(index.findSymbolsByType(SymbolType.EVENT).map((e) => e.name));
        // Pattern: namespace.number.suffix (e.g., my_mod.0001.t) without a matching event
        const orphaned = index.getLocalizationKeys().filter((key) => {
            const parts = key.split('.');
            return parts.length >= 3 && !eventIds.has(parts.slice(0, -1).join('.'));
        });
        return { orphaned_keys: orphaned.slice(0, 100), total_count: orphaned.length };
    }

    private showEventChain(args: Args): Record<string, unknown> {
        const startEventId = String(args[0] ?? '');
        if (!startEventId) {
            return { events: [], chain_depth: 0 };
        }
        // Breadth-first over the events each event triggers
        const visited = new Set<string>();
        const chain: Array<{ event_id: string; depth: number }> = [];
        const queue: Array<{ id: string; depth: number }> = [{ id: startEventId, depth: 0 }];
        while (queue.length > 0 && chain.length < 50) {
            const current = queue.shift();
            if (!current || visited.has(current.id)) {
                continue;
            }
            visited.add(current.id);
            chain.push({ event_id: current.id, depth: current.depth });
            for (const next of this.host.workspace.index.getEventChain(current.id)) {
                if (!visited.has(next)) {
                    queue.push({ id: next, depth: current.depth + 1 });
                }
            }
        }
        return {
            start_event: startEventId,
            events: chain,
            chain_depth: chain.length > 0 ? Math.max(...chain.map((c) => c.depth)) : 0,
        };
    }

    private checkDependencies(): Record<string, unknown> {
        const index = this.host.workspace.index;
        const missing = index.getUndefinedReferences().map((ref) => ({
            name: ref.name,
            type: ref.type,
            referenced_in: ref.locations.map((loc) => ({
                file: loc.uri,
                line: loc.range.start.line,
            })),
        }));
        return {
            missing,
            missing_count: missing.length,
            satisfied_count: index.getStatistics().totalSymbols,
        };
    }

    private showNamespaceEvents(args: Args): Record<string, unknown> {
        const namespace = String(args[0] ?? '');
        const index = this.host.workspace.index;
        const metadata = index.getEventsByNamespace(namespace);
        if (metadata.length > 0) {
            return {
                namespace,
                events: metadata.map((e) => {
                    const symbol = index
                        .findSymbolsByName(e.id)
                        .find((s) => s.type === SymbolType.EVENT);
                    return {
                        event_id: e.id,
                        title: e.title || '(no title)',
                        file: e.sourceUri,
                        line: symbol?.range.start.line ?? 0,
                    };
                }),
                count: metadata.length,
            };
        }
        const events = index
            .findSymbolsByType(SymbolType.EVENT)
            .filter((s) => s.name.startsWith(namespace + '.'));
        return {
            namespace,
            events: events.map((e) => ({
                event_id: e.name,
                title: e.detail || '(no title)',
                file: e.uri,
                line: e.range.start.line,
            })),
            count: events.length,
        };
    }

    private async insertTextAtCursor(args: Args): Promise<Record<string, unknown>> {
        if (!args || args.length < 4) {
            return { error: 'Required arguments: uri, line, character, text' };
        }
        const uri = String(args[0]);
        const line = parseInt(String(args[1]), 10);
        const character = parseInt(String(args[2]), 10);
        const text = String(args[3]);
        try {
            const result = await this.host.connection.workspace.applyEdit({
                documentChanges: [
                    {
                        textDocument: { uri, version: null },
                        edits: [
                            {
                                range: { start: { line, character }, end: { line, character } },
                                newText: text,
                            },
                        ],
                    },
                ],
            });
            return { success: result.applied };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private generateLocalizationStubs(args: Args): Record<string, unknown> {
        if (!args || args.length < 1) {
            return { error: 'Event ID required' };
        }
        const eventId = String(args[0]);
        const eventMeta = this.host.workspace.index.getEvent(eventId);
        let lines: string[];
        let keys: string[];
        if (eventMeta && eventMeta.options.length > 0) {
            // Stubs from the event's actual options
            lines = [
                ` ${eventId}.t:0 "Event Title"`,
                ` ${eventId}.desc:0 "Event description goes here."`,
            ];
            keys = [`${eventId}.t`, `${eventId}.desc`];
            for (const option of eventMeta.options) {
                if (option.name) {
                    lines.push(` ${option.name}:0 "Option Text"`);
                    keys.push(option.name);
                }
            }
        } else {
            lines = [
                ` ${eventId}.t:0 "Event Title"`,
                ` ${eventId}.desc:0 "Event description goes here."`,
                ` ${eventId}.a:0 "First Option"`,
                ` ${eventId}.b:0 "Second Option"`,
            ];
            keys = [`${eventId}.t`, `${eventId}.desc`, `${eventId}.a`, `${eventId}.b`];
        }
        return {
            event_id: eventId,
            localization_text: lines.join('\n') + '\n',
            keys_generated: keys,
        };
    }

    private async renameEvent(args: Args): Promise<Record<string, unknown>> {
        if (!args || args.length < 2) {
            return { error: 'Required arguments: old_event_id, new_event_id' };
        }
        const oldId = String(args[0]);
        const newId = String(args[1]);
        const index = this.host.workspace.index;
        const eventSymbols = index.findSymbolsByName(oldId);
        if (!index.getEvent(oldId) && eventSymbols.length === 0) {
            return { error: `Event '${oldId}' not found` };
        }

        type Edit = {
            range: {
                start: { line: number; character: number };
                end: { line: number; character: number };
            };
            newText: string;
        };
        const changes: Record<string, Edit[]> = {};
        let total = 0;
        const add = (uri: string, edit: Edit): void => {
            const list = (changes[uri] = changes[uri] ?? []);
            const duplicate = list.some(
                (e) =>
                    e.range.start.line === edit.range.start.line &&
                    e.range.start.character === edit.range.start.character
            );
            if (!duplicate) {
                list.push(edit);
                total++;
            }
        };
        for (const symbol of eventSymbols) {
            add(symbol.uri, { range: symbol.range, newText: newId });
        }
        // Text references in open documents (e.g. trigger_event = { id = old_id })
        const pattern = new RegExp(`\\b${oldId.replace(/\./g, '\\.')}\\b`, 'g');
        for (const document of this.host.documents.all()) {
            const text = document.getText();
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                add(document.uri, {
                    range: {
                        start: document.positionAt(match.index),
                        end: document.positionAt(match.index + oldId.length),
                    },
                    newText: newId,
                });
            }
        }
        if (total === 0) {
            return { error: `No occurrences of '${oldId}' found to rename` };
        }
        try {
            const result = await this.host.connection.workspace.applyEdit({
                documentChanges: Object.entries(changes).map(([uri, edits]) => ({
                    textDocument: { uri, version: null },
                    edits,
                })),
            });
            return {
                success: result.applied,
                old_id: oldId,
                new_id: newId,
                files_changed: Object.keys(changes).length,
                total_replacements: total,
            };
        } catch (error) {
            return { error: `Rename failed: ${error}` };
        }
    }
}
