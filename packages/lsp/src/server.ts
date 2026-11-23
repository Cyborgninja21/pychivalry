/**
 * The language server (docs/PLAN.md items 7.3 to 7.6): one mod, the base game it is read over,
 * and the files the editor has open. It holds the core's workspace index between requests and
 * answers from it; every finding comes from the one runner's own per-file check
 * (`checkSourceFile`, over `checkNames`), so the editor's findings for a file are the command
 * line's (docs/MVP.md, definition of done 4).
 *
 * - **The mod** is the first workspace folder that holds a `descriptor.mod`, otherwise the first
 *   workspace folder. A file outside it gets no diagnostics.
 * - **The base game** comes from the on-disk cache when it answers for the installed game, as
 *   for the command line and the agent server (`openWorkspace`). The game folder is the setting
 *   `pychivalry.gamePath`, or the game found in a Steam library (`game.ts`).
 * - **While typing,** an open file is re-parsed incrementally (`documents.ts`), the index is
 *   given its text, and it is checked again a short while after the last change. The files
 *   whose findings can depend on what changed (they define, use, save or read a name the file
 *   gained or lost) are checked again in the background.
 * - **In the background,** the mod's files are checked one at a time, with a yield between
 *   files so that the server keeps answering, up to the setting `pychivalry.background.fileLimit`;
 *   progress is reported, and a change to the files cancels the pass and starts a new one
 *   over what is left and what the change affects. A file open in the editor is checked first.
 * - **Closing a file keeps its diagnostics;** the index goes back to the file on disk.
 * - **`pychivalry/findings`** returns a file's findings from the server's state in the core's
 *   own shape (`fileFindings`), for the test that every surface gives the same answers.
 */

import {
    catalogueFromSpec,
    checkNames,
    checkSourceFile,
    compareCodePoints,
    decodeScript,
    fileKindOf,
    folderTableFromSpec,
    lookup,
    openWorkspace,
    syncMod,
    UNREAD_TEXT_EXTENSIONS,
    unreadWords,
    extensionOf,
    type CheckSource,
    type DefinedNames,
    type Finding,
    type FolderTable,
    type GameIndex,
    type MessageCatalogue,
    type Spec,
    type SyncedMod,
    type UpdateResult,
    type WorkspaceFinding,
    type WorkspaceIndex,
    type WorkspaceNames,
} from '@pychivalry/core';
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
    CompletionList,
    DidChangeConfigurationNotification,
    DidChangeWatchedFilesNotification,
    MessageType,
    ShowMessageNotification,
    TextDocumentSyncKind,
    type CompletionParams,
    type Connection,
    type DefinitionParams,
    type DocumentSymbol,
    type DocumentSymbolParams,
    type FileEvent,
    type Hover,
    type HoverParams,
    type InitializeParams,
    type InitializeResult,
    type Location,
    type ReferenceParams,
    type WorkDoneProgressServerReporter,
} from 'vscode-languageserver/node';
import { completionList } from './completion.js';
import { toDiagnostic } from './diagnostics.js';
import { OpenDocument } from './documents.js';
import { chooseGame, gameNotices, type GameChoice, type Notice } from './game.js';
import { renderHover } from './hover.js';
import {
    knownPath,
    pathInside,
    pathOnDisk,
    pathToUri,
    THIS_SYSTEM,
    uriToPath,
    type Flavour,
} from './paths.js';
import {
    DEFAULT_SETTINGS,
    readSettings,
    SETTINGS_SECTION,
    settingsChange,
    type Settings,
} from './settings.js';
import { documentSymbols } from './symbols.js';
import { SERVER_NAME, VERSION } from './version.js';

/** The layer of the mod's files in the index. */
const MOD = 'mod';

/** The file a folder must hold to be taken as the mod, in preference to the others. */
const DESCRIPTOR = 'descriptor.mod';

/** The most uses find references lists: the mod's first, then the base game's. */
export const REFERENCES_LIMIT = 2000;

/** The request that returns a file's findings from the server's state. */
export const FINDINGS_REQUEST = 'pychivalry/findings';

/** The notification sent when a background pass ends. */
export const BACKGROUND_DONE = 'pychivalry/backgroundDone';

/** What `pychivalry/findings` takes. */
export interface FindingsParams {
    readonly uri: string;
}

/** What `pychivalry/findings` answers: the file's findings, as the core gives them. */
export interface FindingsResult {
    /** The file's path inside the mod, or null when it is no file the server checks. */
    readonly file: string | null;
    readonly findings: readonly WorkspaceFinding[];
}

/** What `pychivalry/backgroundDone` says about a background pass. */
export interface BackgroundDone {
    /** The files the pass checked, and how many it had to check when it started. */
    readonly checked: number;
    readonly total: number;
    /** True when a change to the files stopped it before its end. */
    readonly cancelled: boolean;
    /** True when the mod has more files than the background checks (`fileLimit`). */
    readonly limited: boolean;
    /** True when nothing is left to check: every file covered has its findings. */
    readonly complete: boolean;
    /** How long the pass took, and the time since the server's process started, in milliseconds. */
    readonly ms: number;
    readonly sinceStartMs: number;
    /**
     * The server process's peak resident memory so far, in KiB (`process.resourceUsage().maxRSS`),
     * the figure release 2.3.0's editor baseline records.
     */
    readonly peakRssKib: number;
}

/** What the server is started with. */
export interface ServerOptions {
    readonly spec: Spec;
    /** Where the base game's index is cached (`defaultCacheDir()`), or null for no cache. */
    readonly cacheDir: string | null;
    /** The game folder of the game `gameId` in a Steam library, or null. */
    readonly findGame: (gameId: string) => string | null;
    /** The system whose paths and URIs the editor gives; this one by default. */
    readonly flavour?: Flavour | undefined;
    /** How long after the last change an open file is checked, in milliseconds; 150 by default. */
    readonly editDelay?: number | undefined;
    /** How long after the last change on disk the mod is read again, in milliseconds; 200 by default. */
    readonly diskDelay?: number | undefined;
}

/** A file as it is on disk, read when it was opened and when it changed. */
interface OnDisk {
    readonly bytes: Uint8Array | null;
    readonly text: string | null;
    readonly bom: boolean;
    /** The decoder's note, when the file is not valid UTF-8. */
    readonly notes: readonly Finding[];
}

/** What the server has open: the mod over the base game. */
interface Opened {
    readonly modDir: string | null;
    readonly game: GameChoice;
    readonly index: WorkspaceIndex;
    readonly gameIndex: GameIndex | null;
    mod: SyncedMod | null;
    /** The paths of the mod's listed files. */
    listed: ReadonlySet<string>;
    /** The words of the mod's text files the index does not read (`unreadWords`). */
    unread: ReadonlySet<string> | null;
    /** The definitions the checks see, made once per state of the index. */
    names: {
        readonly generation: number;
        readonly value: DefinedNames & Partial<WorkspaceNames>;
    } | null;
    /** Where each file of the base game is on disk, by layer and path. */
    disk: Map<string, string> | null;
    /** Each file of the base game by where it is on disk (folded on Windows). */
    places: Map<string, { readonly layer: string; readonly file: string }> | null;
}

/** What a file's findings may depend on in other files (`footprint`). */
interface Footprint {
    readonly definitions: ReadonlyMap<string, string>;
    readonly uses: ReadonlySet<string>;
    readonly saves: ReadonlySet<string>;
    readonly reads: ReadonlySet<string>;
    readonly templates: ReadonlySet<string>;
}

/** A background pass under way. */
interface Pass {
    readonly started: number;
    readonly total: number;
    checked: number;
    cancelled: boolean;
    progress: WorkDoneProgressServerReporter | null;
    lastReport: number;
}

const yieldNow = (): Promise<void> =>
    new Promise((resolve) => {
        setImmediate(resolve);
    });

function differ(a: ReadonlySet<string>, b: ReadonlySet<string>, out: Set<string>): boolean {
    let found = false;
    for (const x of a) {
        if (!b.has(x)) {
            out.add(x);
            found = true;
        }
    }
    for (const x of b) {
        if (!a.has(x)) {
            out.add(x);
            found = true;
        }
    }
    return found;
}

export class LanguageServer {
    readonly spec: Spec;
    private readonly connection: Connection;
    private readonly options: ServerOptions;
    private readonly flavour: Flavour;
    private readonly catalogue: MessageCatalogue;
    private readonly folders: FolderTable;
    private settings: Settings = DEFAULT_SETTINGS;
    private initialSettings: unknown = undefined;
    private capabilities = {
        configuration: false,
        configurationChange: false,
        watchedFiles: false,
        workspaceFolders: false,
    };
    private workspaceFolders: string[] = [];
    private readonly docs = new Map<string, OpenDocument>();
    private readonly onDisk = new Map<string, OnDisk>();
    /** What the index holds for an open file: its text on disk, or the editor's text. */
    private readonly indexed = new Map<
        string,
        { readonly from: 'disk' | 'editor'; readonly text: string | null }
    >();
    private opened: Opened | null = null;
    private opening = 0;
    private generation = 0;
    private readonly results = new Map<string, { uri: string; findings: WorkspaceFinding[] }>();
    /** The files the background covers: the first `fileLimit` of the mod, and every file opened. */
    private covered = new Set<string>();
    private queue = new Set<string>();
    private pass: Pass | null = null;
    private running = false;
    private readonly noticed = new Set<string>();
    private readonly editTimers = new Map<string, NodeJS.Timeout>();
    private diskTimer: NodeJS.Timeout | null = null;
    private diskChanges: FileEvent[] = [];
    private firstFullResultMs: number | null = null;

    constructor(connection: Connection, options: ServerOptions) {
        this.connection = connection;
        this.options = options;
        this.spec = options.spec;
        this.flavour = options.flavour ?? THIS_SYSTEM;
        this.catalogue = catalogueFromSpec(options.spec.data);
        this.folders = folderTableFromSpec(options.spec.data);
        this.listen();
    }

    // ─── The protocol ──────────────────────────────────────────────────────

    private listen(): void {
        const c = this.connection;
        c.onInitialize((params) => this.initialize(params));
        c.onInitialized(() => {
            void this.initialized();
        });
        c.onDidOpenTextDocument((params) => {
            const { uri, version, text } = params.textDocument;
            this.didOpen(uri, version, text);
        });
        c.onDidChangeTextDocument((params) => {
            const doc = this.docs.get(params.textDocument.uri);
            if (doc !== undefined) {
                doc.change(params.textDocument.version, params.contentChanges);
                this.scheduleEdit(doc);
            }
        });
        c.onDidCloseTextDocument((params) => {
            this.didClose(params.textDocument.uri);
        });
        c.onDidChangeConfiguration((params) => {
            void this.configurationChanged(params.settings);
        });
        c.onDidChangeWatchedFiles((params) => {
            this.diskChanged(params.changes);
        });
        c.onHover((params) => this.hover(params));
        c.onDefinition((params) => this.definition(params));
        c.onReferences((params) => this.references(params));
        c.onDocumentSymbol((params) => this.symbols(params));
        c.onCompletion((params) => this.complete(params));
        c.onRequest(FINDINGS_REQUEST, (params: FindingsParams): FindingsResult => {
            const file = this.pathOf(params.uri);
            return { file, findings: file === null ? [] : this.fileFindings(file) };
        });
        c.onShutdown(() => {
            this.stop();
        });
    }

    private initialize(params: InitializeParams): InitializeResult {
        const caps = params.capabilities;
        this.capabilities = {
            configuration: caps.workspace?.configuration === true,
            configurationChange:
                caps.workspace?.didChangeConfiguration?.dynamicRegistration === true,
            watchedFiles: caps.workspace?.didChangeWatchedFiles?.dynamicRegistration === true,
            workspaceFolders: caps.workspace?.workspaceFolders === true,
        };
        const init: unknown = params.initializationOptions;
        if (typeof init === 'object' && init !== null && 'settings' in init) {
            this.initialSettings = init.settings;
        }
        const folders = params.workspaceFolders ?? [];
        this.workspaceFolders = folders
            .map((f) => uriToPath(f.uri, this.flavour))
            .filter((p): p is string => p !== null);
        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Incremental,
                },
                hoverProvider: true,
                definitionProvider: true,
                referencesProvider: true,
                documentSymbolProvider: true,
                completionProvider: { resolveProvider: false },
                workspace: {
                    workspaceFolders: { supported: true, changeNotifications: true },
                },
            },
            serverInfo: { name: SERVER_NAME, version: VERSION },
        };
    }

    private async initialized(): Promise<void> {
        if (this.capabilities.configurationChange) {
            await this.connection.client.register(DidChangeConfigurationNotification.type, {
                section: SETTINGS_SECTION,
            });
        }
        if (this.capabilities.watchedFiles) {
            await this.connection.client.register(DidChangeWatchedFilesNotification.type, {
                watchers: [
                    { globPattern: '**/*.txt' },
                    { globPattern: '**/*.yml' },
                    { globPattern: `**/${DESCRIPTOR}` },
                    ...UNREAD_TEXT_EXTENSIONS.filter((e) => e !== '.txt' && e !== '.yml').map(
                        (e) => ({ globPattern: `**/*${e}` }),
                    ),
                ],
            });
        }
        if (this.capabilities.workspaceFolders) {
            this.connection.workspace.onDidChangeWorkspaceFolders((event) => {
                const removed = new Set(
                    event.removed
                        .map((f) => uriToPath(f.uri, this.flavour))
                        .filter((p) => p !== null),
                );
                const added = event.added
                    .map((f) => uriToPath(f.uri, this.flavour))
                    .filter((p): p is string => p !== null);
                this.workspaceFolders = [
                    ...this.workspaceFolders.filter((f) => !removed.has(f)),
                    ...added,
                ];
                void this.open();
            });
        }
        this.settings = await this.pullSettings(this.initialSettings);
        await this.open();
    }

    private async pullSettings(pushed: unknown): Promise<Settings> {
        if (this.capabilities.configuration) {
            try {
                const section: unknown =
                    await this.connection.workspace.getConfiguration(SETTINGS_SECTION);
                return readSettings(section);
            } catch {
                // The editor could not answer: keep what was pushed.
            }
        }
        const value =
            typeof pushed === 'object' && pushed !== null && SETTINGS_SECTION in pushed
                ? (pushed as Record<string, unknown>)[SETTINGS_SECTION]
                : pushed;
        return readSettings(value);
    }

    private async configurationChanged(pushed: unknown): Promise<void> {
        const before = this.settings;
        this.settings = await this.pullSettings(pushed);
        const change = settingsChange(before, this.settings);
        if (change.reopen) {
            await this.open();
            return;
        }
        if (this.opened === null) {
            return;
        }
        if (change.recheck || change.more) {
            this.cover();
            if (change.recheck) {
                this.checkOpenFiles();
            }
            this.enqueue(
                change.recheck
                    ? this.covered
                    : [...this.covered].filter((f) => !this.results.has(f)),
            );
        }
    }

    private notify(notice: Notice): void {
        if (this.noticed.has(notice.key)) {
            return;
        }
        this.noticed.add(notice.key);
        // A notification: the server does not wait for the person to close it.
        void this.connection.sendNotification(ShowMessageNotification.type, {
            type:
                notice.severity === 'error'
                    ? MessageType.Error
                    : notice.severity === 'warning'
                      ? MessageType.Warning
                      : MessageType.Info,
            message: notice.text,
        });
    }

    // ─── Opening the mod over the base game ────────────────────────────────

    /** The mod: the first workspace folder with a descriptor, otherwise the first folder. */
    private modFolder(): string | null {
        for (const folder of this.workspaceFolders) {
            if (existsSync(pathOnDisk(folder, DESCRIPTOR, this.flavour))) {
                return folder;
            }
        }
        return this.workspaceFolders[0] ?? null;
    }

    /** Open (or open again) the mod over the base game, then check everything. */
    async open(): Promise<void> {
        try {
            await this.openNow();
        } catch (err) {
            this.fail('opening the mod over the base game', err);
        }
    }

    /** Something went wrong that no request can be answered for: said once, and logged. */
    private fail(what: string, err: unknown): void {
        const message = err instanceof Error ? err.message : String(err);
        this.connection.console.error(
            `pychivalry: ${what} failed: ${err instanceof Error ? (err.stack ?? message) : message}`,
        );
        this.notify({
            key: `fail:${what}:${message}`,
            severity: 'error',
            text: `pychivalry: ${what} failed: ${message}`,
        });
    }

    private async openNow(): Promise<void> {
        const turn = ++this.opening;
        this.cancelPass();
        const modDir = this.modFolder();
        const game = chooseGame(this.settings.gamePath, () =>
            this.options.findGame(this.spec.data.manifest.game),
        );
        for (const notice of gameNotices(game, this.settings.gamePath, this.spec.version)) {
            this.notify(notice);
        }
        let progress: WorkDoneProgressServerReporter | null = null;
        if (game.dir !== null) {
            progress = await this.connection.window.createWorkDoneProgress();
            progress.begin('pychivalry', undefined, 'Reading the base game');
            // Let the message out before the synchronous read blocks.
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (turn !== this.opening) {
            progress?.done();
            return;
        }
        const previous = this.opened;
        const workspace = openWorkspace({
            spec: this.spec,
            gameDir: game.dir,
            cacheDir: this.options.cacheDir,
            modDir: null,
            fallbackEncoding: this.settings.fallbackEncoding ?? undefined,
        });
        const mod = modDir === null ? null : syncMod(workspace.index, modDir, null);
        progress?.done();
        const opened: Opened = {
            modDir,
            game,
            index: workspace.index,
            gameIndex: workspace.game,
            mod,
            listed: new Set(mod?.files.map((f) => f.path) ?? []),
            unread: null,
            names: null,
            disk: null,
            places: null,
        };
        this.opened = opened;
        this.generation++;
        this.indexed.clear();
        this.onDisk.clear();
        // Files of another mod, or no longer the mod's: their diagnostics go.
        const files = new Set(mod?.files.map((f) => f.path) ?? []);
        for (const [file, result] of this.results) {
            if (previous?.modDir !== modDir || !files.has(file)) {
                void this.connection.sendDiagnostics({ uri: result.uri, diagnostics: [] });
                this.results.delete(file);
            }
        }
        for (const doc of this.docs.values()) {
            this.docs.set(doc.uri, this.reopenDocument(doc));
        }
        this.queue.clear();
        this.covered.clear();
        this.cover();
        this.syncEditorText();
        this.checkOpenFiles();
        this.enqueue(this.closedCovered());
        if (this.queue.size === 0) {
            // Nothing to check in the background: the first full result is there.
            await this.announce({
                started: performance.now(),
                total: 0,
                checked: 0,
                cancelled: false,
                progress: null,
                lastReport: 0,
            });
        }
    }

    /** An open document read again against the mod as it is now opened. */
    private reopenDocument(doc: OpenDocument): OpenDocument {
        return new OpenDocument(
            doc.uri,
            this.pathOf(doc.uri),
            doc.version,
            doc.text,
            this.catalogue,
        );
    }

    /** The mod's files to check: its script and localization files, in code-point order. */
    private modFiles(): string[] {
        const mod = this.opened?.mod;
        if (mod === null || mod === undefined) {
            return [];
        }
        return mod.files
            .filter((f) => fileKindOf(f.path) !== undefined)
            .map((f) => f.path)
            .sort(compareCodePoints);
    }

    /** The files the background covers: the first `fileLimit`, and every file open or opened. */
    private cover(): void {
        const files = this.modFiles();
        const limit = this.settings.fileLimit;
        const next = new Set(files.slice(0, limit));
        for (const file of this.covered) {
            if (files.includes(file)) {
                next.add(file);
            }
        }
        for (const doc of this.docs.values()) {
            if (doc.path !== null && this.isChecked(doc.path)) {
                next.add(doc.path);
            }
        }
        this.covered = next;
        if (files.length > limit) {
            this.notify({
                key: `background-limit:${String(limit)}`,
                severity: 'information',
                text:
                    limit === 0
                        ? `pychivalry checks no file of the mod in the background (pychivalry.background.fileLimit is 0); a file opened in the editor is checked.`
                        : `pychivalry checks the first ${String(limit)} of the mod's ${String(files.length)} files in the background (pychivalry.background.fileLimit); a file opened in the editor is always checked.`,
            });
        }
    }

    /** The files the background covers that are not open: an open file is checked as it changes. */
    private closedCovered(): string[] {
        return [...this.covered].filter((f) => this.docByPath(f) === undefined);
    }

    /** Whether a path inside the mod is a file the runner checks: listed, a script or localization file. */
    private isChecked(file: string): boolean {
        return fileKindOf(file) !== undefined && (this.opened?.listed.has(file) ?? false);
    }

    // ─── Files and their text ──────────────────────────────────────────────

    /** The path inside the mod of a document's URI, or null when it is outside the mod. */
    pathOf(uri: string): string | null {
        const modDir = this.opened?.modDir ?? this.modFolder();
        const file = uriToPath(uri, this.flavour);
        if (modDir === null || file === null) {
            return null;
        }
        const relative = pathInside(modDir, file, this.flavour);
        if (relative === null) {
            return null;
        }
        return knownPath(relative, this.opened?.mod?.files.map((f) => f.path) ?? []);
    }

    private uriOf(file: string): string {
        const doc = this.docByPath(file);
        if (doc !== undefined) {
            return doc.uri;
        }
        return pathToUri(pathOnDisk(this.opened?.modDir ?? '', file, this.flavour), this.flavour);
    }

    private docByPath(file: string): OpenDocument | undefined {
        for (const doc of this.docs.values()) {
            if (doc.path === file) {
                return doc;
            }
        }
        return undefined;
    }

    /** The file on disk, as the runner reads it. */
    private readDisk(file: string): OnDisk {
        const modDir = this.opened?.modDir;
        let bytes: Uint8Array | null = null;
        if (modDir !== null && modDir !== undefined) {
            try {
                bytes = readFileSync(pathOnDisk(modDir, file, this.flavour));
            } catch {
                bytes = null;
            }
        }
        if (bytes === null) {
            return { bytes: null, text: null, bom: false, notes: [] };
        }
        const decoded = decodeScript(bytes, {
            catalogue: this.catalogue,
            fallbackEncoding: this.settings.fallbackEncoding ?? undefined,
        });
        return { bytes, text: decoded.text, bom: decoded.bom, notes: decoded.findings };
    }

    private disk(file: string): OnDisk {
        let found = this.onDisk.get(file);
        if (found === undefined) {
            found = this.readDisk(file);
            this.onDisk.set(file, found);
        }
        return found;
    }

    /**
     * The editor's text as the bytes the file would be saved as: UTF-8, with the byte-order
     * mark when the file on disk starts with one, so that the index reads it as it would read
     * the saved file (a localization file without the mark is one the game reads no key of).
     */
    private editorBytes(doc: OpenDocument): Uint8Array {
        const text = Buffer.from(doc.text, 'utf8');
        return doc.path !== null && this.disk(doc.path).bom
            ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), text])
            : text;
    }

    /** What an open file is checked from. */
    private sourceOf(doc: OpenDocument, file: string): CheckSource {
        const disk = this.disk(file);
        const same = disk.text === doc.text;
        if (doc.kind === 'script') {
            return { script: doc.script(), notes: same ? disk.notes : [] };
        }
        return { bytes: same && disk.bytes !== null ? disk.bytes : this.editorBytes(doc) };
    }

    // ─── Open files ────────────────────────────────────────────────────────

    private didOpen(uri: string, version: number, text: string): void {
        const doc = new OpenDocument(uri, this.pathOf(uri), version, text, this.catalogue);
        this.docs.set(uri, doc);
        const file = doc.path;
        if (this.opened === null || file === null) {
            return;
        }
        if (!this.isChecked(file)) {
            // A file new on disk, before the editor's watcher says so.
            if (fileKindOf(file) !== undefined && this.folders.classify(file) !== undefined) {
                this.diskChanged([]);
            }
            return;
        }
        this.onDisk.delete(file);
        this.covered.add(file);
        this.flush(doc);
    }

    private didClose(uri: string): void {
        const doc = this.docs.get(uri);
        this.docs.delete(uri);
        const timer = this.editTimers.get(uri);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.editTimers.delete(uri);
        }
        const file = doc?.path ?? null;
        if (doc === undefined || file === null || this.opened === null || !this.isChecked(file)) {
            return;
        }
        // The index goes back to the file on disk; its diagnostics stay.
        const held = this.indexed.get(file);
        this.indexed.delete(file);
        this.onDisk.delete(file);
        if (held?.from === 'editor') {
            const affected = this.update(file, () => {
                const bytes = this.disk(file).bytes;
                return bytes === null ? undefined : this.opened?.index.setFile(MOD, file, bytes);
            });
            this.enqueue([file, ...affected], true);
        }
    }

    private scheduleEdit(doc: OpenDocument): void {
        const old = this.editTimers.get(doc.uri);
        if (old !== undefined) {
            clearTimeout(old);
        }
        this.editTimers.set(
            doc.uri,
            setTimeout(() => {
                this.editTimers.delete(doc.uri);
                if (this.docs.get(doc.uri) === doc) {
                    this.flush(doc);
                }
            }, this.options.editDelay ?? 150),
        );
    }

    /** Bring the index up to date with an open file's text now, if a change is waiting. */
    private ensureFresh(doc: OpenDocument): void {
        const timer = this.editTimers.get(doc.uri);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.editTimers.delete(doc.uri);
            this.flush(doc);
        }
    }

    /**
     * Give the index an open file's text, check the file, and queue the files its change can
     * affect.
     */
    private flush(doc: OpenDocument): void {
        const file = doc.path;
        if (this.opened === null || file === null || !this.isChecked(file)) {
            return;
        }
        const affected = this.holdEditorText(doc, file);
        this.checkFile(file);
        if (affected.length > 0) {
            this.enqueue(
                affected.filter((f) => f !== file),
                true,
            );
        }
    }

    /**
     * The index holds the editor's text of an open file where it differs from the file on disk,
     * and the file on disk where it does not. Returns the files the change affects.
     */
    private holdEditorText(doc: OpenDocument, file: string): string[] {
        const disk = this.disk(file);
        const held = this.indexed.get(file) ?? { from: 'disk', text: disk.text };
        const want: 'disk' | 'editor' = disk.text === doc.text ? 'disk' : 'editor';
        if (held.from === want && held.text === doc.text) {
            return [];
        }
        if (want === 'disk' && held.from === 'disk') {
            this.indexed.set(file, { from: 'disk', text: doc.text });
            return [];
        }
        this.indexed.set(file, { from: want, text: doc.text });
        return this.update(file, () => {
            const index = this.opened?.index;
            if (index === undefined) {
                return undefined;
            }
            if (want === 'editor') {
                return index.setFile(MOD, file, this.editorBytes(doc));
            }
            return disk.bytes === null ? undefined : index.setFile(MOD, file, disk.bytes);
        });
    }

    /** The open files the index should hold from the editor, given to it. */
    private syncEditorText(): void {
        for (const doc of this.docs.values()) {
            if (doc.path !== null && this.isChecked(doc.path)) {
                this.indexed.delete(doc.path);
                this.onDisk.delete(doc.path);
                this.holdEditorText(doc, doc.path);
            }
        }
    }

    private checkOpenFiles(): void {
        for (const doc of this.docs.values()) {
            if (doc.path !== null && this.isChecked(doc.path)) {
                this.checkFile(doc.path);
            }
        }
    }

    // ─── What a change affects ─────────────────────────────────────────────

    /** What another file's findings can depend on in this one. */
    private footprint(file: string): Footprint | null {
        const index = this.opened?.index;
        const names = index?.namesIn(MOD, file);
        if (index === undefined || names === undefined) {
            return null;
        }
        const definitions = new Map<string, string>();
        for (const d of index.definitionsIn(MOD, file)) {
            const place = `${d.database}\u0000${String(d.container)}\u0000${d.form}\u0000${String(d.priority)}\u0000${String(d.range.start.line)}`;
            definitions.set(d.name, `${definitions.get(d.name) ?? ''}\u0001${place}`);
        }
        return {
            definitions,
            uses: new Set(names.uses),
            saves: new Set(names.saves),
            reads: new Set(names.reads),
            templates: new Set(names.templates),
        };
    }

    /**
     * Run a change to one file of the index, and return the other files of the mod whose
     * findings it can change: those that define, use, save or read a name whose definitions,
     * uses, saves or reads in the file changed, and those whose status the change touched;
     * every file when a `$PARAM$` word changed; every localization file when a use changed and
     * `localization/unused-key` is on.
     */
    private update(file: string, change: () => UpdateResult | undefined): string[] {
        const opened = this.opened;
        if (opened === null) {
            change();
            return [];
        }
        const before = this.footprint(file);
        const result = change();
        const after = this.footprint(file);
        this.generation++;
        const empty: Footprint = {
            definitions: new Map(),
            uses: new Set(),
            saves: new Set(),
            reads: new Set(),
            templates: new Set(),
        };
        const a = before ?? empty;
        const b = after ?? empty;
        // The index's own answer: the names the file and the files whose status it changes
        // (another layer's file at the same path) define, before and after.
        const names = new Set<string>(result?.names ?? []);
        for (const name of new Set([...a.definitions.keys(), ...b.definitions.keys()])) {
            if (a.definitions.get(name) !== b.definitions.get(name)) {
                names.add(name);
            }
        }
        const usesChanged = differ(a.uses, b.uses, names);
        differ(a.saves, b.saves, names);
        differ(a.reads, b.reads, names);
        const templates = new Set<string>();
        if (differ(a.templates, b.templates, templates)) {
            return [...this.covered];
        }
        const out = new Set(opened.index.filesNaming(names, MOD));
        for (const dependent of result?.dependents ?? []) {
            if (dependent.layer === MOD) {
                out.add(dependent.path);
            }
        }
        if (usesChanged && this.settings.unusedKeys) {
            for (const f of this.covered) {
                if (fileKindOf(f) === 'localization') {
                    out.add(f);
                }
            }
        }
        out.delete(file);
        return [...out].filter((f) => this.covered.has(f));
    }

    // ─── Checking ──────────────────────────────────────────────────────────

    private names(): DefinedNames & Partial<WorkspaceNames> {
        const opened = this.opened;
        if (opened === null) {
            throw new Error('no workspace is open');
        }
        if (opened.names?.generation !== this.generation) {
            if (opened.unread === null && opened.modDir !== null && opened.gameIndex !== null) {
                opened.unread = unreadWords(opened.modDir, opened.index);
            }
            opened.names = {
                generation: this.generation,
                value: checkNames(
                    { index: opened.index, game: opened.gameIndex },
                    opened.modDir,
                    opened.unread ?? undefined,
                ),
            };
        }
        return opened.names.value;
    }

    /** Check one file of the mod, from the editor's text when it is open, and publish. */
    private checkFile(file: string): void {
        const opened = this.opened;
        if (opened === null || !this.isChecked(file)) {
            return;
        }
        const doc = this.docByPath(file);
        let source: CheckSource;
        if (doc !== undefined) {
            source = this.sourceOf(doc, file);
        } else {
            const disk = this.readDisk(file);
            if (disk.bytes === null) {
                return;
            }
            source = { bytes: disk.bytes };
        }
        const { kept } = checkSourceFile({
            spec: this.spec,
            file,
            layer: MOD,
            source,
            names: this.names(),
            index: opened.index,
            fallbackEncoding: this.settings.fallbackEncoding ?? undefined,
            unusedKeys: this.settings.unusedKeys,
        });
        const uri = this.uriOf(file);
        this.results.set(file, { uri, findings: kept });
        void this.connection.sendDiagnostics({
            uri,
            ...(doc === undefined ? {} : { version: doc.version }),
            diagnostics: kept.map(toDiagnostic),
        });
    }

    /**
     * A file's findings from the server's state: those last published for it, as the core gives
     * them. An open file with a change waiting is checked first.
     */
    fileFindings(file: string): WorkspaceFinding[] {
        const doc = this.docByPath(file);
        if (doc !== undefined) {
            this.ensureFresh(doc);
        }
        return [...(this.results.get(file)?.findings ?? [])];
    }

    // ─── The background ────────────────────────────────────────────────────

    /** Queue files for the background, at the front when they matter now; a pass under way restarts. */
    private enqueue(files: Iterable<string>, front = false): void {
        const add = [...files].filter((f) => this.covered.has(f));
        if (add.length === 0) {
            return;
        }
        this.queue = front ? new Set([...add, ...this.queue]) : new Set([...this.queue, ...add]);
        this.cancelPass();
        if (!this.running) {
            void this.runBackground();
        }
    }

    private cancelPass(): void {
        if (this.pass !== null) {
            this.pass.cancelled = true;
        }
    }

    private stop(): void {
        this.queue.clear();
        this.cancelPass();
        for (const timer of this.editTimers.values()) {
            clearTimeout(timer);
        }
        this.editTimers.clear();
        if (this.diskTimer !== null) {
            clearTimeout(this.diskTimer);
            this.diskTimer = null;
        }
    }

    private async runBackground(): Promise<void> {
        this.running = true;
        try {
            // Let the request or change that queued the files finish first.
            await yieldNow();
            while (this.queue.size > 0 && this.opened !== null) {
                await this.runPass();
            }
        } catch (err) {
            this.fail('the background check', err);
        } finally {
            this.running = false;
        }
    }

    private async runPass(): Promise<void> {
        const pass: Pass = {
            started: performance.now(),
            total: this.queue.size,
            checked: 0,
            cancelled: false,
            progress: null,
            lastReport: 0,
        };
        this.pass = pass;
        const progress = await this.connection.window.createWorkDoneProgress();
        pass.progress = progress;
        progress.begin(
            'pychivalry',
            0,
            `Checking the mod: 0 of ${String(pass.total)} files`,
            false,
        );
        while (!pass.cancelled && this.queue.size > 0) {
            const [file] = this.queue;
            if (file === undefined) {
                break;
            }
            this.queue.delete(file);
            try {
                this.checkFile(file);
            } catch (err) {
                this.fail(`checking ${file}`, err);
            }
            pass.checked++;
            const now = performance.now();
            if (now - pass.lastReport > 100) {
                pass.lastReport = now;
                progress.report(
                    Math.floor((100 * pass.checked) / Math.max(1, pass.total)),
                    `Checking the mod: ${String(pass.checked)} of ${String(pass.total)} files`,
                );
            }
            await yieldNow();
        }
        progress.done();
        if (this.pass === pass) {
            this.pass = null;
        }
        await this.announce(pass);
    }

    /** Say that a background pass ended, and how. */
    private async announce(pass: Pass): Promise<void> {
        const ended = performance.now();
        const complete = this.queue.size === 0 && !pass.cancelled;
        // `performance.now()` counts from the start of the server's process.
        const sinceStartMs = Math.round(ended);
        if (complete && this.firstFullResultMs === null) {
            this.firstFullResultMs = sinceStartMs;
        }
        const done: BackgroundDone = {
            checked: pass.checked,
            total: pass.total,
            cancelled: pass.cancelled,
            limited: this.modFiles().length > this.settings.fileLimit,
            complete,
            ms: Math.round(ended - pass.started),
            sinceStartMs,
            peakRssKib: process.resourceUsage().maxRSS,
        };
        await this.connection.sendNotification(BACKGROUND_DONE, done);
    }

    // ─── Changes on disk ───────────────────────────────────────────────────

    private diskChanged(changes: readonly FileEvent[]): void {
        this.diskChanges.push(...changes);
        if (this.diskTimer !== null) {
            clearTimeout(this.diskTimer);
        }
        this.diskTimer = setTimeout(() => {
            this.diskTimer = null;
            const events = this.diskChanges;
            this.diskChanges = [];
            this.sync(events);
        }, this.options.diskDelay ?? 200);
    }

    /**
     * Read the mod's folder again (`syncMod`). A file saved from the editor holds what the
     * index held already; any other change checks every file covered again.
     */
    private sync(events: readonly FileEvent[]): void {
        const opened = this.opened;
        if (opened === null || opened.modDir === null) {
            return;
        }
        const modDir = opened.modDir;
        const before = new Map((opened.mod?.files ?? []).map((f) => [f.path, f]));
        opened.mod = syncMod(opened.index, modDir, opened.mod);
        opened.listed = new Set(opened.mod.files.map((f) => f.path));
        opened.disk = null;
        const after = new Map(opened.mod.files.map((f) => [f.path, f]));
        const changed: string[] = [];
        for (const [file, now] of after) {
            const old = before.get(file);
            if (old === undefined || old.size !== now.size || old.mtimeMs !== now.mtimeMs) {
                changed.push(file);
            }
        }
        const removed = [...before.keys()].filter((f) => !after.has(f));
        for (const file of removed) {
            const result = this.results.get(file);
            if (result !== undefined) {
                void this.connection.sendDiagnostics({ uri: result.uri, diagnostics: [] });
                this.results.delete(file);
            }
            this.covered.delete(file);
            this.indexed.delete(file);
            this.onDisk.delete(file);
        }
        // What the editor holds stays what the index holds: a file saved from the editor
        // changes nothing the index answers.
        for (const doc of this.docs.values()) {
            const file = this.pathOf(doc.uri);
            if (file !== doc.path) {
                this.docs.set(doc.uri, this.reopenDocument(doc));
            }
        }
        const isChanged = new Set(changed);
        let external = removed.length > 0 || changed.some((f) => this.docByPath(f) === undefined);
        for (const doc of this.docs.values()) {
            const file = doc.path;
            if (file === null || !this.isChecked(file)) {
                continue;
            }
            if (isChanged.has(file)) {
                this.onDisk.delete(file);
                if (this.disk(file).text !== doc.text) {
                    external = true;
                }
                this.indexed.delete(file);
                this.holdEditorText(doc, file);
            } else if (this.indexed.get(file)?.from === 'editor') {
                // `syncMod` reads a file again whose time is too close to call: the editor's text.
                opened.index.setFile(MOD, file, this.editorBytes(doc));
            }
        }
        const unreadChanged = events.some((e) => {
            const file = this.pathOf(e.uri);
            return (
                file !== null &&
                UNREAD_TEXT_EXTENSIONS.includes(extensionOf(file)) &&
                opened.index.getFile(MOD, file) === undefined
            );
        });
        if (unreadChanged) {
            opened.unread = null;
        }
        if (!opened.mod.changed && !unreadChanged) {
            return;
        }
        this.generation++;
        this.cover();
        if (external) {
            this.checkOpenFiles();
            this.enqueue(this.closedCovered());
            return;
        }
        if (unreadChanged) {
            this.enqueue(this.closedCovered().filter((f) => fileKindOf(f) === 'localization'));
        }
        for (const file of changed) {
            if (this.docByPath(file) !== undefined) {
                this.checkFile(file);
            }
        }
    }

    // ─── Names at a place ──────────────────────────────────────────────────

    /** Where each indexed file is on disk, by layer and path. */
    private diskOf(layer: string, file: string): string | null {
        const opened = this.opened;
        if (opened === null) {
            return null;
        }
        if (layer === MOD) {
            return opened.modDir === null ? null : pathOnDisk(opened.modDir, file, this.flavour);
        }
        if (opened.disk === null) {
            opened.disk = new Map();
            for (const f of opened.gameIndex?.listing.files ?? []) {
                opened.disk.set(`${f.layer}\u0000${f.path}`, f.disk);
            }
        }
        return opened.disk.get(`${layer}\u0000${file}`) ?? null;
    }

    /** The layer and path of an open document in the index: the mod's, or the base game's. */
    private placeOf(doc: OpenDocument): { layer: string; file: string } | null {
        if (doc.path !== null && this.isChecked(doc.path)) {
            this.ensureFresh(doc);
            return { layer: MOD, file: doc.path };
        }
        const opened = this.opened;
        const disk = uriToPath(doc.uri, this.flavour);
        if (opened === null || disk === null) {
            return null;
        }
        const fold = (p: string): string => (this.flavour.windows ? p.toLowerCase() : p);
        if (opened.places === null) {
            opened.places = new Map();
            for (const f of opened.gameIndex?.listing.files ?? []) {
                opened.places.set(fold(f.disk), { layer: f.layer, file: f.path });
            }
        }
        return opened.places.get(fold(disk)) ?? null;
    }

    private location(item: {
        readonly layer: string;
        readonly file: string;
        readonly range: {
            readonly start: { readonly line: number; readonly character: number };
            readonly end: { readonly line: number; readonly character: number };
        };
    }): Location | null {
        let uri: string | null;
        if (item.layer === MOD) {
            uri = this.opened?.modDir === null ? null : this.uriOf(item.file);
        } else {
            const disk = this.diskOf(item.layer, item.file);
            uri = disk === null ? null : pathToUri(disk, this.flavour);
        }
        return uri === null
            ? null
            : {
                  uri,
                  range: {
                      start: { line: item.range.start.line, character: item.range.start.character },
                      end: { line: item.range.end.line, character: item.range.end.character },
                  },
              };
    }

    /**
     * The name at a place of an open file: the name the index records there (a definition's key,
     * or a use), otherwise the word under the cursor, one segment of a chain.
     */
    private nameAt(
        doc: OpenDocument,
        position: { line: number; character: number },
    ): {
        name: string;
        range: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
    } | null {
        const place = this.placeOf(doc);
        const found =
            place === null
                ? undefined
                : this.opened?.index.nameAt(place.layer, place.file, position);
        if (found !== undefined) {
            return { name: found.name, range: found.range };
        }
        const lines = doc.lines;
        const offset = lines.offsetAt(position);
        const text = doc.text;
        const word = /[A-Za-z0-9_\-'@]/;
        let start = offset;
        while (start > 0 && word.test(text.charAt(start - 1))) {
            start--;
        }
        let end = offset;
        while (end < text.length && word.test(text.charAt(end))) {
            end++;
        }
        if (start === end) {
            return null;
        }
        return { name: text.slice(start, end), range: lines.rangeOf(start, end) };
    }

    // ─── Features ──────────────────────────────────────────────────────────

    private hover(params: HoverParams): Hover | null {
        const doc = this.docs.get(params.textDocument.uri);
        const opened = this.opened;
        if (doc === undefined || opened === null) {
            return null;
        }
        const at = this.nameAt(doc, params.position);
        if (at === null) {
            return null;
        }
        const result = lookup(at.name, {
            spec: this.spec,
            index: opened.index,
            files: (layer, file) => this.contentOf(layer, file),
            usesLimit: 0,
            suggestions: false,
        });
        const value = renderHover(result, (item) => this.placeText(item));
        return value === null ? null : { contents: { kind: 'markdown', value }, range: at.range };
    }

    /** An indexed file's content: the editor's text when it is open, otherwise the file on disk. */
    private contentOf(layer: string, file: string): Uint8Array | string | undefined {
        if (layer === MOD) {
            const doc = this.docByPath(file);
            if (doc !== undefined) {
                return this.editorBytes(doc);
            }
        }
        const disk = this.diskOf(layer, file);
        if (disk === null) {
            return undefined;
        }
        try {
            return readFileSync(disk);
        } catch {
            return undefined;
        }
    }

    /** A place for a person: the layer, the path and the line, counted from 1. */
    private placeText(item: {
        readonly layer: string;
        readonly file: string;
        readonly range: { readonly start: { readonly line: number } };
    }): string {
        return `${item.layer} ${item.file}:${String(item.range.start.line + 1)}`;
    }

    private definition(params: DefinitionParams): Location[] | null {
        const doc = this.docs.get(params.textDocument.uri);
        const opened = this.opened;
        if (doc === undefined || opened === null) {
            return null;
        }
        const at = this.nameAt(doc, params.position);
        if (at === null) {
            return null;
        }
        const result = lookup(at.name, {
            spec: this.spec,
            index: opened.index,
            usesLimit: 0,
            suggestions: false,
        });
        if (result.definitions.status !== 'read') {
            return null;
        }
        const out: Location[] = [];
        for (const group of result.definitions.groups) {
            const inForce = group.definitions.filter((d) => d.inForce === 'yes');
            // One winner where the override rules name it; every definition where they do not
            // ("winner not known"), or where every definition counts.
            const shown = inForce.length === 1 ? inForce : group.definitions;
            for (const d of shown) {
                const loc = this.location(d);
                if (loc !== null) {
                    out.push(loc);
                }
            }
        }
        return out;
    }

    private references(params: ReferenceParams): Location[] | null {
        const doc = this.docs.get(params.textDocument.uri);
        const opened = this.opened;
        if (doc === undefined || opened === null) {
            return null;
        }
        const at = this.nameAt(doc, params.position);
        if (at === null) {
            return null;
        }
        const out: Location[] = [];
        if (params.context.includeDeclaration) {
            for (const d of opened.index.definitions(at.name)) {
                const loc = this.location(d);
                if (loc !== null) {
                    out.push(loc);
                }
            }
        }
        // The mod's uses first, then the base game's; a word written everywhere is cut.
        const uses = opened.index.references(at.name);
        const ordered = [
            ...uses.filter((u) => u.layer === MOD),
            ...uses.filter((u) => u.layer !== MOD),
        ];
        for (const use of ordered.slice(0, REFERENCES_LIMIT)) {
            const loc = this.location(use);
            if (loc !== null) {
                out.push(loc);
            }
        }
        if (ordered.length > REFERENCES_LIMIT) {
            this.connection.console.info(
                `pychivalry: '${at.name}' is used ${String(ordered.length)} times; the first ${String(REFERENCES_LIMIT)} are listed, the mod's first.`,
            );
        }
        return out;
    }

    private symbols(params: DocumentSymbolParams): DocumentSymbol[] | null {
        const doc = this.docs.get(params.textDocument.uri);
        if (doc === undefined || doc.kind === null) {
            return null;
        }
        const place = this.placeOf(doc);
        const definitions =
            place === null || this.opened === null
                ? []
                : this.opened.index.definitionsIn(place.layer, place.file);
        return documentSymbols(doc, definitions);
    }

    private complete(params: CompletionParams): CompletionList | null {
        const doc = this.docs.get(params.textDocument.uri);
        const opened = this.opened;
        if (doc === undefined || opened === null || doc.kind !== 'script' || doc.path === null) {
            return null;
        }
        return completionList({
            spec: this.spec,
            folders: this.folders,
            file: doc.path,
            parsed: doc.script(),
            offset: doc.lines.offsetAt(params.position),
            names: this.names(),
            index: opened.index,
        });
    }

    // ─── For tests and measurement ─────────────────────────────────────────

    /** The time from the start of the server's process to the end of its first complete background pass. */
    get timeToFirstFullResult(): number | null {
        return this.firstFullResultMs;
    }
}

/** Start the language server on a connection; it answers until the connection closes. */
export function startServer(connection: Connection, options: ServerOptions): LanguageServer {
    const server = new LanguageServer(connection, options);
    connection.listen();
    return server;
}
