/**
 * Background validation (post-2.0 Phase 1, issue #86): the engine's WorkspaceValidator
 * wired to the language server.
 *
 * Every script file (.txt) and localization file of the workspace is diagnosed in the
 * background after startup through the same DiagnosticsProvider path as an open file (the
 * plug-ins and the 1000-per-file cap apply), and published with sendDiagnostics, so the
 * Problems panel covers unopened files. Each publish also sends `ck3/workspaceDiagnostics`
 * with the file's counts, and the run sends `{ state, done, total }` events, for the
 * client's file decorations and status bar. ck3.validateWorkspace forces a full pass and
 * reports it through window/workDoneProgress.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    CancellationToken,
    Connection,
    Diagnostic,
    DiagnosticSeverity,
    TextDocuments,
    WorkDoneProgressReporter,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    isLocalizationFile,
    ValidationProgress,
    Workspace,
    WorkspaceValidator,
} from 'pychivalry-engine';
import { fileUriToPath, pathToFileUri } from './utils/uri';

export interface BackgroundSettings {
    enabled: boolean;
    concurrency: number;
    fileLimit: number;
}

export const DEFAULT_BACKGROUND: BackgroundSettings = {
    enabled: true,
    concurrency: 5,
    fileLimit: 3000,
};

/** Per-file counts sent with every publish. */
export interface FileCounts {
    uri: string;
    errors: number;
    warnings: number;
    information: number;
}

/** Run state events (`ck3/workspaceDiagnostics` with a `state`). */
export interface StateEvent {
    state: 'running' | 'idle';
    done: number;
    total: number;
    limited: boolean;
    cancelled?: boolean;
    /** Idle only: the run's duration and the server's resource use. */
    milliseconds?: number;
    /** Server uptime when the first full pass finished (time to first full result). */
    firstFullResultMs?: number;
    maxRssKb?: number;
    pid?: number;
    longestFileMs?: number;
    longestFile?: string;
    /** The longest diagnosis of a script (.txt) file and of a localization file. */
    longestScriptFileMs?: number;
    longestScriptFile?: string;
    longestLocalizationFileMs?: number;
    longestLocalizationFile?: string;
    filesValidated?: number;
}

export const WORKSPACE_DIAGNOSTICS = 'ck3/workspaceDiagnostics';

/** Result of ck3.validateWorkspace. */
export interface ValidateWorkspaceResult {
    files: number;
    errors: number;
    warnings: number;
    information: number;
    milliseconds: number;
    cancelled: boolean;
}

/** Counts of one file's diagnostics by severity (hints are not counted). */
export function countDiagnostics(uri: string, diagnostics: readonly Diagnostic[]): FileCounts {
    const counts: FileCounts = { uri, errors: 0, warnings: 0, information: 0 };
    for (const d of diagnostics) {
        if (d.severity === DiagnosticSeverity.Error) {
            counts.errors++;
        } else if (d.severity === DiagnosticSeverity.Warning) {
            counts.warnings++;
        } else if (d.severity === DiagnosticSeverity.Information) {
            counts.information++;
        }
    }
    return counts;
}

function walk(dir: string, accept: (name: string) => boolean, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, accept, out);
        } else if (entry.isFile() && accept(entry.name)) {
            out.push(full);
        }
    }
}

/** Is `file` validated in the background: a script .txt or a localization file? */
export function isBackgroundFile(file: string): boolean {
    const name = path.basename(file);
    return name.toLowerCase().endsWith('.txt') || isLocalizationFile(name);
}

const PROGRESS_INTERVAL_MS = 100;

export interface BackgroundHost {
    connection: Connection;
    documents: TextDocuments<TextDocument>;
    workspace: Workspace;
    /** Diagnose a file's text (DiagnosticsProvider.diagnoseText). */
    diagnose: (uri: string, text: string) => Diagnostic[];
}

export class BackgroundValidation {
    private readonly validator: WorkspaceValidator<Diagnostic[]>;
    private readonly counts = new Map<string, FileCounts>();
    private settings: BackgroundSettings = { ...DEFAULT_BACKGROUND };
    private lastProgressSent = 0;
    private limitMessageShown = false;
    private firstFullResultMs: number | undefined;
    private reporter: WorkDoneProgressReporter | undefined;
    private started = false;
    private readonly longest = {
        script: { ms: 0, file: undefined as string | undefined },
        localization: { ms: 0, file: undefined as string | undefined },
    };

    constructor(private readonly host: BackgroundHost) {
        this.validator = new WorkspaceValidator<Diagnostic[]>(host.workspace, {
            files: () => this.files(),
            accepts: isBackgroundFile,
            isOpen: (file) => this.openDocument(file) !== undefined,
            uriOf: (file) => this.openDocument(file)?.uri ?? pathToFileUri(file),
            fileOf: fileUriToPath,
            read: async (file) =>
                this.openDocument(file)?.getText() ?? fs.promises.readFile(file, 'utf-8'),
            diagnose: (file, uri, text) => this.timed(file, () => host.diagnose(uri, text)),
            publish: (_rel, uri, diagnostics) => this.publish(uri, diagnostics),
            onProgress: (progress) => this.onProgress(progress),
            onError: (file, error) =>
                host.connection.console.error(`Background validation of ${file}: ${error}`),
            ...this.settings,
        });
    }

    // ── publishing ──────────────────────────────────────────────────────

    /** Publish a file's diagnostics and its counts (foreground and background alike). */
    public publish(uri: string, diagnostics: Diagnostic[]): void {
        void this.host.connection.sendDiagnostics({ uri, diagnostics });
        const counts = countDiagnostics(uri, diagnostics);
        this.counts.set(uri, counts);
        void this.host.connection.sendNotification(WORKSPACE_DIAGNOSTICS, counts);
    }

    /** A file is gone: empty diagnostics, zero counts. */
    public clear(uri: string): void {
        this.publish(uri, []);
        this.counts.delete(uri);
    }

    // ── control ─────────────────────────────────────────────────────────

    public get enabled(): boolean {
        return this.settings.enabled;
    }

    public configure(settings: BackgroundSettings): void {
        const before = this.settings;
        this.settings = { ...settings };
        this.validator.configure(settings);
        if (!this.started) {
            return;
        }
        if (settings.enabled && (!before.enabled || settings.fileLimit !== before.fileLimit)) {
            this.validator.queueAll();
            this.validator.start();
            this.checkLimit();
        }
    }

    /** Start the first full pass (after the workspace is indexed). */
    public start(): void {
        this.started = true;
        this.validator.start();
        this.checkLimit();
    }

    /** Validate every file again (the base game or the workspace folders changed). */
    public restart(): void {
        if (!this.started) {
            return;
        }
        this.validator.queueAll();
        this.validator.start();
    }

    /** An open file was saved: it and its dependents. */
    public saved(file: string): void {
        if (this.started) {
            this.validator.invalidateWithDependents(file);
            this.validator.start();
        }
    }

    /** One file changed (closed, or created/changed on disk): queue it. */
    public changed(file: string, withDependents = false): void {
        if (!this.started) {
            return;
        }
        if (withDependents) {
            this.validator.invalidateWithDependents(file);
        } else {
            this.validator.invalidate(file);
        }
        this.validator.start();
    }

    /** Stop the run (server shutdown). */
    public stop(): void {
        this.validator.cancel();
    }

    public removed(file: string, uri: string): void {
        this.validator.remove(file);
        this.clear(uri);
    }

    /**
     * ck3.validateWorkspace: a full pass now (above fileLimit and with background
     * validation off too), reported through `reporter`, cancelled through `token`.
     */
    public async validateWorkspace(
        token: CancellationToken | undefined,
        reporter: WorkDoneProgressReporter | undefined
    ): Promise<ValidateWorkspaceResult> {
        const started = Date.now();
        const wasEnabled = this.settings.enabled;
        if (!wasEnabled) {
            this.validator.configure({ ...this.settings, enabled: true });
        }
        this.started = true;
        this.reporter = reporter;
        reporter?.begin('Validating the CK3 workspace', 0, undefined, true);
        const cancellation = token?.onCancellationRequested(() => this.validator.cancel());
        try {
            this.validator.start({ force: true });
            await this.validator.whenIdle();
        } finally {
            cancellation?.dispose();
            reporter?.done();
            this.reporter = undefined;
            if (!wasEnabled) {
                this.validator.configure(this.settings);
            }
        }
        const progress = this.validator.progress;
        const totals = this.totals();
        return {
            files: progress.done,
            errors: totals.errors,
            warnings: totals.warnings,
            information: totals.information,
            milliseconds: Date.now() - started,
            cancelled: progress.cancelled === true,
        };
    }

    // ── state ───────────────────────────────────────────────────────────

    public totals(): { files: number; errors: number; warnings: number; information: number } {
        const t = { files: 0, errors: 0, warnings: 0, information: 0 };
        for (const c of this.counts.values()) {
            t.files++;
            t.errors += c.errors;
            t.warnings += c.warnings;
            t.information += c.information;
        }
        return t;
    }

    /** For ck3.getWorkspaceStats. */
    public statistics(): Record<string, unknown> {
        return {
            enabled: this.settings.enabled,
            concurrency: this.settings.concurrency,
            fileLimit: this.settings.fileLimit,
            ...this.validator.progress,
            queued: this.validator.queued,
            ...this.validator.stats,
            firstFullResultMs: this.firstFullResultMs,
            totals: this.totals(),
        };
    }

    // ── internals ───────────────────────────────────────────────────────

    /** Run one file's diagnosis and keep the longest per kind (script, localization). */
    private timed(file: string, run: () => Diagnostic[]): Diagnostic[] {
        const started = process.hrtime.bigint();
        const result = run();
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        const kind = isLocalizationFile(path.basename(file)) ? 'localization' : 'script';
        if (ms > this.longest[kind].ms) {
            this.longest[kind] = { ms, file: this.host.workspace.relativePath(file) };
        }
        return result;
    }

    /** Every script and localization file of the workspace folders. */
    private files(): string[] {
        const files = this.host.workspace.scriptFiles();
        for (const root of this.host.workspace.roots()) {
            walk(path.join(root, 'localization'), isLocalizationFile, files);
        }
        return files;
    }

    private openDocument(file: string): TextDocument | undefined {
        const key = path.resolve(file);
        const sameFile =
            process.platform === 'win32'
                ? (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
                : (a: string, b: string) => a === b;
        return this.host.documents
            .all()
            .find((d) => sameFile(path.resolve(fileUriToPath(d.uri)), key));
    }

    private checkLimit(): void {
        const progress = this.validator.progress;
        if (!progress.limited || this.limitMessageShown) {
            return;
        }
        this.limitMessageShown = true;
        void this.host.connection.window.showInformationMessage(
            `CK3: this workspace has more files than ck3LanguageServer.backgroundValidation.fileLimit (${this.settings.fileLimit}), so only open files are validated in the background. Run "CK3: Validate Workspace" to validate every file now, or raise the limit.`
        );
    }

    private onProgress(progress: ValidationProgress): void {
        const now = Date.now();
        if (progress.state === 'running') {
            const first = progress.done === 0 && progress.current === undefined;
            if (!first && now - this.lastProgressSent < PROGRESS_INTERVAL_MS) {
                return;
            }
            this.lastProgressSent = now;
            const event: StateEvent = {
                state: 'running',
                done: progress.done,
                total: progress.total,
                limited: progress.limited,
            };
            void this.host.connection.sendNotification(WORKSPACE_DIAGNOSTICS, event);
            this.reporter?.report(
                progress.total > 0 ? Math.floor((100 * progress.done) / progress.total) : 0,
                `${progress.done}/${progress.total} files`
            );
            return;
        }
        const stats = this.validator.stats;
        const full = !progress.cancelled && !progress.limited;
        if (full && this.firstFullResultMs === undefined && stats.completedRuns > 0) {
            this.firstFullResultMs = Math.round(process.uptime() * 1000);
        }
        const event: StateEvent = {
            state: 'idle',
            done: progress.done,
            total: progress.total,
            limited: progress.limited,
            cancelled: progress.cancelled,
            milliseconds: stats.lastRunMilliseconds,
            firstFullResultMs: this.firstFullResultMs,
            maxRssKb: process.resourceUsage().maxRSS,
            pid: process.pid,
            longestFileMs: Math.round(stats.longestFileMilliseconds * 10) / 10,
            longestFile: stats.longestFile,
            longestScriptFileMs: Math.round(this.longest.script.ms * 10) / 10,
            longestScriptFile: this.longest.script.file,
            longestLocalizationFileMs: Math.round(this.longest.localization.ms * 10) / 10,
            longestLocalizationFile: this.longest.localization.file,
            filesValidated: stats.filesValidated,
        };
        void this.host.connection.sendNotification(WORKSPACE_DIAGNOSTICS, event);
    }
}
