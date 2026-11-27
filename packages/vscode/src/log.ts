/**
 * The game's log against the mod's files in the editor (docs/PLAN.md item 11.7;
 * docs/game-log.md). Three commands: "Show the game's log against the mod" reads one log and
 * shows the places in the mod its messages tie to; "Watch the game's log" does so and again
 * each time the file changes; "Clear the game's log findings" stops watching and clears them.
 *
 * - **Apart from pychivalry's own.** The findings are kept in a diagnostics collection of their
 *   own, their source `CK3 game log`, each saying the log's line and the game's own text; they
 *   are the game's reports, not pychivalry's checks, and clearing them leaves those alone.
 * - **Which log.** The file the command is given, or the setting `pychivalry.log.file`, or the
 *   `error.log` of a log folder of the game the language server finds (Windows' Documents and
 *   OneDrive's, Linux's `~/.local/share`, the Proton prefix), asked when there is more than one;
 *   or one the user picks.
 * - **Only read.** The log is read, and its size and time looked at each second while it is
 *   watched; nothing is written there.
 *
 * Every analysis is the language server's (`pychivalry/log`), over its own index: this file only
 * shows the answer. No CK3 logic lives here.
 */

import type { LogAnswer, LogFolderAnswer } from '@pychivalry/lsp';
import { unwatchFile, watchFile, type Stats } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import {
    CLEAR_GAME_LOG,
    LOG_FOLDERS_REQUEST,
    LOG_REQUEST,
    SETTINGS_SECTION,
    SHOW_GAME_LOG,
    WATCH_GAME_LOG,
} from './ids.js';
import type { LanguageServer } from './language.js';

/** The source of the log's diagnostics: the game's own log, not pychivalry's checks. */
export const LOG_SOURCE = 'CK3 game log';

/** How long after a change to a watched log it is read again, in milliseconds. */
export const WATCH_DELAY_MS = 1_000;

/** How often a watched log's size and time are looked at, in milliseconds. */
export const WATCH_POLL_MS = 1_000;

/** What a show answered, for the person and for the editor tests. */
export interface ShownLog {
    readonly answer: LogAnswer;
    /** How many diagnostics the collection holds now. */
    readonly shown: number;
}

/** The game's log in the editor: its diagnostics, the log watched, and the commands. */
export class GameLog implements vscode.Disposable {
    private readonly collection =
        vscode.languages.createDiagnosticCollection('pychivalry-game-log');
    /** The log watched, and what is called when it changes. */
    private watched: { file: string; listener: (now: Stats, before: Stats) => void } | null = null;
    private timer: NodeJS.Timeout | null = null;
    /** Each show watched, for the editor tests: the answer of every read. */
    private readonly listeners: ((shown: ShownLog) => void)[] = [];

    constructor(private readonly language: LanguageServer) {}

    /** Called with every log read and shown. */
    onShown(listener: (shown: ShownLog) => void): vscode.Disposable {
        this.listeners.push(listener);
        return new vscode.Disposable(() => {
            const i = this.listeners.indexOf(listener);
            if (i >= 0) {
                this.listeners.splice(i, 1);
            }
        });
    }

    /** The log to read: the one given, the setting's, the one log folder's, or one asked for. */
    private async choose(target?: vscode.Uri): Promise<string | undefined> {
        if (target?.scheme === 'file') {
            return target.fsPath;
        }
        const setting = vscode.workspace
            .getConfiguration(SETTINGS_SECTION)
            .get<string>('log.file', '')
            .trim();
        if (setting !== '') {
            return setting;
        }
        await this.language.started;
        const folders =
            await this.language.client.sendRequest<LogFolderAnswer[]>(LOG_FOLDERS_REQUEST);
        const logs = folders.flatMap((f) =>
            f.errorLog === null ? [] : [{ log: f.errorLog, folder: f }],
        );
        const first = logs[0];
        if (logs.length === 1 && first !== undefined) {
            return first.log;
        }
        const browse = 'Choose a log file…';
        const items = [
            ...logs.map((l) => ({ label: l.log, description: l.folder.how })),
            {
                label: browse,
                description: logs.length === 0 ? 'no log folder of the game was found' : '',
            },
        ];
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: "The game's log to read against the mod",
        });
        if (picked === undefined) {
            return undefined;
        }
        if (picked.label !== browse) {
            return picked.label;
        }
        const chosen = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Read against the mod',
            filters: { Logs: ['log'], 'All files': ['*'] },
        });
        return chosen?.[0]?.fsPath;
    }

    /** Read one log and show its places in the mod; `quiet` for a re-read of a watched one. */
    async show(file: string, quiet = false): Promise<ShownLog> {
        await this.language.started;
        const answer = await this.language.client.sendRequest<LogAnswer>(LOG_REQUEST, {
            log: file,
        });
        this.collection.clear();
        if (answer.error !== null) {
            if (!quiet) {
                void vscode.window.showErrorMessage(`pychivalry: ${answer.error}`);
            }
            const shown = { answer, shown: 0 };
            this.listeners.forEach((l) => {
                l(shown);
            });
            return shown;
        }
        const byUri = new Map<string, vscode.Diagnostic[]>();
        for (const d of answer.diagnostics) {
            const range = new vscode.Range(
                d.range.start.line,
                d.range.start.character,
                d.range.end.line,
                d.range.end.character,
            );
            const diagnostic = new vscode.Diagnostic(
                range,
                d.message,
                vscode.DiagnosticSeverity.Warning,
            );
            diagnostic.source = LOG_SOURCE;
            diagnostic.code = d.code;
            const list = byUri.get(d.uri) ?? [];
            list.push(diagnostic);
            byUri.set(d.uri, list);
        }
        for (const [uri, list] of byUri) {
            this.collection.set(vscode.Uri.parse(uri), list);
        }
        const shown = { answer, shown: answer.diagnostics.length };
        if (!quiet) {
            const t = answer.totals;
            const more = answer.notShown > 0 ? `, ${String(answer.notShown)} more not shown` : '';
            void vscode.window.showInformationMessage(
                `pychivalry: ${path.basename(answer.log ?? file)}: ${String(t?.matched ?? 0)} messages, ${String(t?.tied_to_mod ?? 0)} about the mod (${String(answer.diagnostics.length)} places shown${more}), ${String(t?.unmatched ?? 0)} lines no message of the catalogue matches.`,
            );
        }
        this.listeners.forEach((l) => {
            l(shown);
        });
        return shown;
    }

    /** "Show the game's log against the mod". */
    async showCommand(target?: vscode.Uri): Promise<ShownLog | undefined> {
        const file = await this.choose(target);
        return file === undefined ? undefined : this.show(file);
    }

    /** "Watch the game's log": shown now, and again after each change to the file. */
    async watchCommand(target?: vscode.Uri): Promise<ShownLog | undefined> {
        const file = await this.choose(target);
        if (file === undefined) {
            return undefined;
        }
        this.stopWatching();
        const again = (): void => {
            if (this.timer !== null) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.timer = null;
                void this.show(file, true);
            }, WATCH_DELAY_MS);
        };
        // The file's size and time looked at every second: a file outside the workspace, which the
        // game writes anew, is seen this way on every system. Only read.
        const listener = (now: Stats, before: Stats): void => {
            if (now.mtimeMs !== before.mtimeMs || now.size !== before.size) {
                again();
            }
        };
        watchFile(file, { interval: WATCH_POLL_MS, persistent: false }, listener);
        this.watched = { file, listener };
        return this.show(file);
    }

    /** "Clear the game's log findings": no more watching, and no log diagnostics. */
    clear(): void {
        this.stopWatching();
        this.collection.clear();
    }

    private stopWatching(): void {
        if (this.watched !== null) {
            unwatchFile(this.watched.file, this.watched.listener);
            this.watched = null;
        }
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /** The commands, registered. */
    register(): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand(SHOW_GAME_LOG, (target?: vscode.Uri) =>
                this.showCommand(target),
            ),
            vscode.commands.registerCommand(WATCH_GAME_LOG, (target?: vscode.Uri) =>
                this.watchCommand(target),
            ),
            vscode.commands.registerCommand(CLEAR_GAME_LOG, () => {
                this.clear();
            }),
        ];
    }

    dispose(): void {
        this.clear();
        this.collection.dispose();
    }
}
