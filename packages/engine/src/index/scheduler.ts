/**
 * The workspace validator: an incremental, cancellable scheduler that diagnoses every
 * script file of a workspace in the background and re-diagnoses what an edit can affect.
 *
 * - start() validates every file once (the first time), yielding to the event loop after
 *   each file, so a host (the language server) keeps answering requests meanwhile.
 * - invalidate(file) re-queues one file (an edit); invalidateWithDependents(file) re-queues
 *   it and every file that mentions a name it defines, or defined before the edit (a save;
 *   Indexer.dependentsOf).
 * - cancel() stops before the next file; start() resumes from the queue.
 * - Progress ({ state, done, total, current }) goes to onProgress; whenIdle() resolves when
 *   the run stops (queue drained or cancelled).
 * - Options: `concurrency` = files read ahead at once (diagnosis itself runs one file at a
 *   time with a yield after each), `fileLimit` = above this many files only the files the
 *   host marks open are validated unless a pass is forced, `enabled`.
 *
 * The engine's own diagnose() is the default per-file step; a host passes its own `read`
 * (open editor text before disk) and `diagnose` (plug-ins, LSP mapping) to publish exactly
 * what its foreground validation publishes.
 */

import * as fs from 'fs';
import * as path from 'path';

import { diagnose as engineDiagnose, Diagnostic, Plugin } from '../diagnostics';
import { pathToUri, uriToPath, Workspace } from './workspace';

export type ValidationState = 'running' | 'idle';

export interface ValidationProgress {
    state: ValidationState;
    /** Files diagnosed in the current (or last) run. */
    done: number;
    /** Files of the current (or last) run: done plus still queued. */
    total: number;
    /** The file being diagnosed (running only). */
    current?: string;
    /** True when the run stopped because of cancel() with files still queued. */
    cancelled?: boolean;
    /** True when the file count is above fileLimit and only open files are validated. */
    limited: boolean;
}

export interface ValidatorStats {
    /** Files diagnosed since the validator was created. */
    filesValidated: number;
    /** Runs that reached idle with an empty queue. */
    completedRuns: number;
    /** Duration of the last completed run (ms). */
    lastRunMilliseconds: number;
    /** The longest single-file diagnosis (ms) and its file. */
    longestFileMilliseconds: number;
    longestFile?: string;
}

export interface WorkspaceValidatorOptions<T> {
    /** Receives each file's result: mod-relative path, URI, result. */
    publish: (relPath: string, uri: string, result: T) => void | Promise<void>;
    /** Plug-ins for the default (engine) diagnose step. */
    plugins?: readonly Plugin[];
    /** Per-file step (default: the engine's diagnose with `plugins`). */
    diagnose?: (file: string, uri: string, text: string) => T;
    /** Read a file's text (default: from disk). */
    read?: (file: string) => Promise<string>;
    /** Every file to validate (default: workspace.scriptFiles()). */
    files?: () => string[];
    /** Can `file` be validated (filters dependents; default: .txt files). */
    accepts?: (file: string) => boolean;
    /** Is `file` open in the host (used above fileLimit; default: none is). */
    isOpen?: (file: string) => boolean;
    /** File → URI the index uses for it (default pathToUri), and back (default uriToPath). */
    uriOf?: (file: string) => string;
    fileOf?: (uri: string) => string;
    onProgress?: (progress: ValidationProgress) => void;
    /** A file could not be read or diagnosed (it is skipped). */
    onError?: (file: string, error: unknown) => void;
    /** Files read ahead at once (default 5). */
    concurrency?: number;
    /** Above this many files only open files are validated unless forced (default 2000). */
    fileLimit?: number;
    /** Background validation on or off (default true). */
    enabled?: boolean;
}

export type ValidatorSettings = Pick<
    WorkspaceValidatorOptions<unknown>,
    'concurrency' | 'fileLimit' | 'enabled'
>;

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export class WorkspaceValidator<T = Diagnostic[]> {
    private readonly queue = new Set<string>();
    private readonly definedBefore = new Map<string, string[]>();
    private readonly idleWaiters: Array<() => void> = [];
    private running = false;
    private paused = true;
    private seeded = false;
    private forced = false;
    private limitedNow = false;
    private done = 0;
    private current: string | undefined;
    private cancelledRun = false;
    private runStarted = 0;
    private settings: Required<ValidatorSettings>;
    private readonly statsData: ValidatorStats = {
        filesValidated: 0,
        completedRuns: 0,
        lastRunMilliseconds: 0,
        longestFileMilliseconds: 0,
    };

    constructor(
        private readonly workspace: Workspace,
        private readonly options: WorkspaceValidatorOptions<T>
    ) {
        this.settings = {
            concurrency: Math.max(1, options.concurrency ?? 5),
            fileLimit: options.fileLimit ?? 2000,
            enabled: options.enabled ?? true,
        };
    }

    // ── control ─────────────────────────────────────────────────────────

    /**
     * Start (or resume) background validation. The first call queues every file; later
     * calls resume the queue. `force` validates every file even above fileLimit, from now
     * on, and queues every file again.
     */
    public start(options: { force?: boolean } = {}): void {
        if (!this.settings.enabled) {
            return;
        }
        if (options.force) {
            this.forced = true;
        }
        if (!this.seeded || options.force) {
            this.seeded = true;
            this.queueEverything();
        }
        this.paused = false;
        void this.run();
    }

    /** Queue every file again (a full pass) and run, if started. */
    public queueAll(): void {
        if (!this.settings.enabled) {
            return;
        }
        this.seeded = true;
        this.queueEverything();
        this.kick();
    }

    /** Stop before the next file; the rest stays queued for start(). */
    public cancel(): void {
        this.paused = true;
    }

    /** Re-validate one file (it changed). */
    public invalidate(file: string): void {
        if (!this.settings.enabled) {
            return;
        }
        this.queueFiles([file], true);
        this.kick();
    }

    /**
     * Re-validate a file and every file that depends on a name it defines now or defined
     * when it was last validated (it was saved).
     */
    public invalidateWithDependents(file: string): void {
        if (!this.settings.enabled) {
            return;
        }
        const key = path.resolve(file);
        const uri = this.uriOf(key);
        const dependents = this.workspace.index
            .dependentsOf(uri, this.definedBefore.get(key) ?? [])
            .map((u) => path.resolve(this.fileOf(u)))
            .filter((f) => this.accepts(f));
        this.queueFiles([key, ...dependents], true);
        this.kick();
    }

    /** Forget a deleted file (dropped from the queue). */
    public remove(file: string): void {
        const key = path.resolve(file);
        this.queue.delete(key);
        this.definedBefore.delete(key);
    }

    /** Change concurrency, fileLimit or enabled; disabling cancels the run. */
    public configure(settings: ValidatorSettings): void {
        this.settings = {
            concurrency: Math.max(1, settings.concurrency ?? this.settings.concurrency),
            fileLimit: settings.fileLimit ?? this.settings.fileLimit,
            enabled: settings.enabled ?? this.settings.enabled,
        };
        if (!this.settings.enabled) {
            this.cancel();
            this.queue.clear();
        }
    }

    /** Resolves when the run stops (queue drained or cancelled); at once when not running. */
    public whenIdle(): Promise<void> {
        if (!this.running) {
            return Promise.resolve();
        }
        return new Promise((resolve) => this.idleWaiters.push(resolve));
    }

    // ── state ───────────────────────────────────────────────────────────

    public get progress(): ValidationProgress {
        return {
            state: this.running ? 'running' : 'idle',
            done: this.done,
            total: this.done + this.queue.size + (this.current !== undefined ? 1 : 0),
            current: this.current,
            cancelled: this.cancelledRun || undefined,
            limited: this.limitedNow,
        };
    }

    public get stats(): ValidatorStats {
        return { ...this.statsData };
    }

    public get enabled(): boolean {
        return this.settings.enabled;
    }

    /** Files waiting to be validated. */
    public get queued(): number {
        return this.queue.size;
    }

    // ── internals ───────────────────────────────────────────────────────

    private uriOf(file: string): string {
        return (this.options.uriOf ?? pathToUri)(file);
    }

    private fileOf(uri: string): string {
        return (this.options.fileOf ?? uriToPath)(uri);
    }

    private accepts(file: string): boolean {
        return this.options.accepts
            ? this.options.accepts(file)
            : file.toLowerCase().endsWith('.txt');
    }

    private allFiles(): string[] {
        return this.options.files ? this.options.files() : this.workspace.scriptFiles();
    }

    /** Queue every file of the workspace; above fileLimit (not forced) only open ones. */
    private queueEverything(): void {
        const files = this.allFiles();
        this.limitedNow = !this.forced && files.length > this.settings.fileLimit;
        this.queueFiles(files);
    }

    /**
     * Queue files; while limited (above fileLimit, not forced) only open ones. `front` puts
     * them ahead of what is queued (an edit is more urgent than the rest of a full pass).
     */
    private queueFiles(files: string[], front = false): void {
        const isOpen = this.options.isOpen ?? (() => false);
        const accepted = files
            .map((file) => path.resolve(file))
            .filter((key) => !this.limitedNow || isOpen(key));
        if (front && this.queue.size > 0) {
            const rest = Array.from(this.queue);
            this.queue.clear();
            for (const key of [...accepted, ...rest]) {
                this.queue.add(key);
            }
            return;
        }
        for (const key of accepted) {
            this.queue.add(key);
        }
    }

    private kick(): void {
        if (!this.paused) {
            void this.run();
        }
    }

    private emit(): void {
        this.options.onProgress?.(this.progress);
    }

    private async read(file: string): Promise<string> {
        return this.options.read ? this.options.read(file) : fs.promises.readFile(file, 'utf-8');
    }

    private diagnoseOne(file: string, uri: string, text: string): T {
        if (this.options.diagnose) {
            return this.options.diagnose(file, uri, text);
        }
        return engineDiagnose(this.workspace, file, {
            text,
            uri,
            plugins: this.options.plugins,
        }) as unknown as T;
    }

    private async run(): Promise<void> {
        if (this.running || this.paused || this.queue.size === 0) {
            return;
        }
        this.running = true;
        this.cancelledRun = false;
        this.done = 0;
        this.runStarted = Date.now();
        this.emit();
        while (!this.paused && this.queue.size > 0) {
            // Read the next `concurrency` files at once; diagnose them one at a time.
            const batch = Array.from(this.queue).slice(0, this.settings.concurrency);
            for (const file of batch) {
                this.queue.delete(file);
            }
            const texts = await Promise.all(
                batch.map((file) =>
                    this.read(file).then(
                        (text) => ({ text }),
                        (error: unknown) => ({ error })
                    )
                )
            );
            for (let i = 0; i < batch.length; i++) {
                if (this.paused) {
                    // Cancelled: nothing more is started; the rest goes back to the front.
                    const rest = batch.slice(i).filter((f) => !this.queue.has(f));
                    const after = Array.from(this.queue);
                    this.queue.clear();
                    for (const f of [...rest, ...after]) {
                        this.queue.add(f);
                    }
                    break;
                }
                const file = batch[i];
                const read = texts[i];
                if ('error' in read) {
                    this.options.onError?.(file, read.error);
                    this.done++;
                    continue;
                }
                await this.validateOne(file, read.text);
                await yieldToEventLoop();
            }
        }
        this.current = undefined;
        this.running = false;
        if (this.queue.size === 0) {
            this.statsData.completedRuns++;
            this.statsData.lastRunMilliseconds = Date.now() - this.runStarted;
        } else {
            this.cancelledRun = true;
        }
        this.emit();
        for (const resolve of this.idleWaiters.splice(0)) {
            resolve();
        }
    }

    private async validateOne(file: string, text: string): Promise<void> {
        this.current = file;
        this.emit();
        const uri = this.uriOf(file);
        const started = process.hrtime.bigint();
        let result: T;
        try {
            result = this.diagnoseOne(file, uri, text);
        } catch (error) {
            this.options.onError?.(file, error);
            this.current = undefined;
            this.done++;
            return;
        }
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        if (ms > this.statsData.longestFileMilliseconds) {
            this.statsData.longestFileMilliseconds = ms;
            this.statsData.longestFile = this.workspace.relativePath(file);
        }
        this.definedBefore.set(file, this.workspace.index.definedNames(uri));
        this.statsData.filesValidated++;
        try {
            await this.options.publish(this.workspace.relativePath(file), uri, result);
        } catch (error) {
            this.options.onError?.(file, error);
        }
        this.current = undefined;
        this.done++;
    }
}
