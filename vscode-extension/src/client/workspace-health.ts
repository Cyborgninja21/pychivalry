/**
 * The client's view of the workspace's diagnostics, fed by the server's
 * `ck3/workspaceDiagnostics` notifications (server/background.ts): per-file counts and the
 * background run's state. The file decorations (file-decorations.ts) and the status bar
 * (statusBar.ts) read it. No VS Code import, so the store and its mappings are unit tested
 * without an editor.
 */

export interface Counts {
    errors: number;
    warnings: number;
    information: number;
}

export interface FileCounts extends Counts {
    uri: string;
}

/** A run state event (server/background.ts StateEvent). */
export interface StateEvent {
    state: 'running' | 'idle';
    done: number;
    total: number;
    limited: boolean;
    cancelled?: boolean;
    milliseconds?: number;
    firstFullResultMs?: number;
    maxRssKb?: number;
    pid?: number;
    longestFileMs?: number;
    longestFile?: string;
    filesValidated?: number;
}

export interface HealthSummary extends Counts {
    /** Files with at least one error or warning. */
    filesAffected: number;
    state: 'running' | 'idle' | 'unknown';
    done: number;
    total: number;
    limited: boolean;
    /** When the last uncancelled pass ended (client clock, ms since epoch). */
    lastFullPassAt?: number;
}

export type HealthChange = { kind: 'files'; keys: string[] } | { kind: 'state' };

/**
 * The key a URI is stored under: the URI with a Windows drive letter spelled as VS Code's
 * Uri.toString() spells it (`file:///c%3A/…`), whether the server sent `file:///C:/…`
 * (server/utils/uri.ts pathToFileUri) or the editor's own spelling.
 */
export function uriKey(uri: string): string {
    const match = /^file:\/\/\/([A-Za-z])(?::|%3A|%3a)(\/.*)?$/.exec(uri);
    if (!match) {
        return uri;
    }
    return `file:///${match[1].toLowerCase()}%3A${match[2] ?? ''}`;
}

function isFileCounts(value: unknown): value is FileCounts {
    const v = value as Partial<FileCounts> | undefined;
    return (
        typeof v === 'object' &&
        v !== null &&
        typeof v.uri === 'string' &&
        typeof v.errors === 'number' &&
        typeof v.warnings === 'number' &&
        typeof v.information === 'number'
    );
}

function isStateEvent(value: unknown): value is StateEvent {
    const v = value as Partial<StateEvent> | undefined;
    return (
        typeof v === 'object' &&
        v !== null &&
        (v.state === 'running' || v.state === 'idle') &&
        typeof v.done === 'number' &&
        typeof v.total === 'number'
    );
}

export class WorkspaceHealth {
    private readonly files = new Map<string, Counts>();
    private readonly listeners: Array<(change: HealthChange) => void> = [];
    private stateEvent: StateEvent | undefined;
    private lastFullPassAt: number | undefined;
    private firstFull: StateEvent | undefined;
    private readonly fullWaiters: Array<(event: StateEvent) => void> = [];

    constructor(
        private readonly keyOf: (uri: string) => string = uriKey,
        private readonly now: () => number = Date.now
    ) {}

    /** Apply one `ck3/workspaceDiagnostics` notification. */
    public apply(message: unknown): void {
        if (isFileCounts(message)) {
            const key = this.keyOf(message.uri);
            const counts = {
                errors: message.errors,
                warnings: message.warnings,
                information: message.information,
            };
            if (counts.errors + counts.warnings + counts.information === 0) {
                this.files.delete(key);
            } else {
                this.files.set(key, counts);
            }
            this.fire({ kind: 'files', keys: [key] });
            return;
        }
        if (isStateEvent(message)) {
            this.stateEvent = message;
            if (message.state === 'idle' && !message.cancelled && !message.limited) {
                this.lastFullPassAt = this.now();
            }
            if (
                message.state === 'idle' &&
                message.firstFullResultMs !== undefined &&
                this.firstFull === undefined
            ) {
                this.firstFull = message;
                for (const resolve of this.fullWaiters.splice(0)) {
                    resolve(message);
                }
            }
            this.fire({ kind: 'state' });
        }
    }

    /**
     * Forget everything (the server restarted). Pending whenFirstFullResult() calls wait for
     * the new server's first full pass.
     */
    public reset(): void {
        const keys = Array.from(this.files.keys());
        this.files.clear();
        this.stateEvent = undefined;
        this.firstFull = undefined;
        this.lastFullPassAt = undefined;
        if (keys.length > 0) {
            this.fire({ kind: 'files', keys });
        }
        this.fire({ kind: 'state' });
    }

    public countsOf(uri: string): Counts | undefined {
        return this.files.get(this.keyOf(uri));
    }

    /** Stored keys (URIs with problems). */
    public keys(): string[] {
        return Array.from(this.files.keys());
    }

    public summary(): HealthSummary {
        const s: HealthSummary = {
            errors: 0,
            warnings: 0,
            information: 0,
            filesAffected: 0,
            state: this.stateEvent?.state ?? 'unknown',
            done: this.stateEvent?.done ?? 0,
            total: this.stateEvent?.total ?? 0,
            limited: this.stateEvent?.limited ?? false,
            lastFullPassAt: this.lastFullPassAt,
        };
        for (const c of this.files.values()) {
            s.errors += c.errors;
            s.warnings += c.warnings;
            s.information += c.information;
            if (c.errors + c.warnings > 0) {
                s.filesAffected++;
            }
        }
        return s;
    }

    /** The last run state event from the server. */
    public get lastState(): StateEvent | undefined {
        return this.stateEvent;
    }

    /** Resolves with the idle event of the (current) server's first full pass. */
    public whenFirstFullResult(): Promise<StateEvent> {
        if (this.firstFull) {
            return Promise.resolve(this.firstFull);
        }
        return new Promise((resolve) => this.fullWaiters.push(resolve));
    }

    public onDidChange(listener: (change: HealthChange) => void): { dispose(): void } {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const i = this.listeners.indexOf(listener);
                if (i >= 0) {
                    this.listeners.splice(i, 1);
                }
            },
        };
    }

    private fire(change: HealthChange): void {
        for (const listener of this.listeners) {
            listener(change);
        }
    }
}

// ── file decorations (#87) ──────────────────────────────────────────────

/** What a file's Explorer decoration shows; undefined = no decoration. */
export interface DecorationSpec {
    /** Count of the highest severity present, at most two characters (`9+` above nine). */
    badge: string;
    /** Theme colour id: list.errorForeground (errors) or list.warningForeground. */
    color: 'list.errorForeground' | 'list.warningForeground';
    tooltip: string;
}

/** A count as a decoration badge: VS Code shows at most two characters. */
export function badgeText(count: number): string {
    return count > 9 ? '9+' : String(count);
}

export function countsTooltip(counts: Counts): string {
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    return `CK3: ${plural(counts.errors, 'error')}, ${plural(counts.warnings, 'warning')}, ${counts.information} information`;
}

/**
 * The decoration of a file: a badge with the count of the highest severity present and its
 * colour; nothing for a clean or information-only file.
 */
export function decorationFor(counts: Counts | undefined): DecorationSpec | undefined {
    if (!counts) {
        return undefined;
    }
    if (counts.errors > 0) {
        return {
            badge: badgeText(counts.errors),
            color: 'list.errorForeground',
            tooltip: countsTooltip(counts),
        };
    }
    if (counts.warnings > 0) {
        return {
            badge: badgeText(counts.warnings),
            color: 'list.warningForeground',
            tooltip: countsTooltip(counts),
        };
    }
    return undefined;
}

/**
 * The folders above a file URI, nearest first, up to and including `root` (a workspace
 * folder URI) when the file is under it, else up to the file system root.
 */
export function parentFolderUris(uri: string, roots: readonly string[] = []): string[] {
    const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]*)(\/.*)$/i.exec(uri);
    if (!match) {
        return [];
    }
    const [, authority, filePath] = match;
    const root = roots
        .map((r) => r.replace(/\/+$/, ''))
        .filter((r) => uri.startsWith(`${r}/`))
        .sort((a, b) => b.length - a.length)[0];
    const out: string[] = [];
    let current = filePath.replace(/\/+$/, '');
    for (let slash = current.lastIndexOf('/'); slash > 0; slash = current.lastIndexOf('/')) {
        current = current.slice(0, slash);
        const folder = `${authority}${current}`;
        out.push(folder);
        if (folder === root) {
            break;
        }
    }
    return out;
}
