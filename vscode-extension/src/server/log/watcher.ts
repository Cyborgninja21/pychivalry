/**
 * CK3 Log Watcher - TypeScript Implementation
 *
 * Monitors CK3 game log files for real-time error detection.
 * Uses Node.js native fs.watchFile for cross-platform compatibility.
 *
 * Monitored files:
 *   game.log, error.log, exceptions.log, system.log, setup.log
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/** Known CK3 log files to monitor */
const LOG_FILES = ['game.log', 'error.log', 'exceptions.log', 'system.log', 'setup.log'];

/** Default number of lines to read on initial scan */
const DEFAULT_INITIAL_LINES = 200;

/** Default polling interval for fs.watchFile in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 1000;

export interface LogWatcherConfig {
    debounceDelay?: number;
    maxLogSize?: number;
}

export interface LogEntry {
    file: string;
    lines: string[];
}

export interface LogWatcherCallbacks {
    onLogEntries: (entries: LogEntry) => void;
    onStarted: (files: string[]) => void;
    onStopped: () => void;
    onPaused: () => void;
    onResumed: () => void;
    onError: (message: string) => void;
}

export interface LogStatistics {
    totalLinesProcessed: number;
    errorsFound: number;
    warningsFound: number;
    filesWatched: number;
    isRunning: boolean;
    isPaused: boolean;
}

/**
 * Detect CK3 log directory based on platform
 */
export function detectLogPath(): string | null {
    const home = os.homedir();
    const pdxBase = 'Paradox Interactive/Crusader Kings III/logs';

    let candidates: string[];
    switch (process.platform) {
        case 'win32':
            candidates = [
                path.join(home, 'Documents', pdxBase),
                path.join(home, 'OneDrive/Documents', pdxBase),
            ];
            break;
        case 'darwin':
            candidates = [
                path.join(home, 'Documents', pdxBase),
            ];
            break;
        default: // linux
            candidates = [
                path.join(home, '.local/share', pdxBase),
            ];
            break;
    }

    for (const dir of candidates) {
        if (fs.existsSync(dir)) {
            return dir;
        }
    }
    return null;
}

/**
 * CK3 Log Watcher
 *
 * Watches CK3 log files for changes and sends new lines to callbacks.
 */
export class CK3LogWatcher {
    private logPath: string = '';
    private callbacks: LogWatcherCallbacks;
    private filePositions: Map<string, number> = new Map();
    private running: boolean = false;
    private paused: boolean = false;
    private pollInterval: number;
    private initialLineLimit: number;
    private stats: LogStatistics = {
        totalLinesProcessed: 0,
        errorsFound: 0,
        warningsFound: 0,
        filesWatched: 0,
        isRunning: false,
        isPaused: false,
    };

    constructor(callbacks: LogWatcherCallbacks, config?: LogWatcherConfig) {
        this.callbacks = callbacks;
        this.pollInterval = config?.debounceDelay ?? DEFAULT_POLL_INTERVAL_MS;
        this.initialLineLimit = config?.maxLogSize ?? DEFAULT_INITIAL_LINES;
    }

    /**
     * Start watching CK3 log files
     */
    public start(logPath?: string): { success: boolean; path?: string; watching?: string[]; message: string } {
        if (this.running) {
            return { success: false, message: 'Log watcher is already running' };
        }

        const resolvedPath = logPath || detectLogPath();
        if (!resolvedPath) {
            return { success: false, message: 'Could not detect CK3 log directory. Please set the log path manually.' };
        }

        if (!fs.existsSync(resolvedPath)) {
            return { success: false, message: `Log directory does not exist: ${resolvedPath}` };
        }

        this.logPath = resolvedPath;
        this.filePositions.clear();

        // Initial scan: read last N lines from existing files
        const watchedFiles: string[] = [];
        for (const file of LOG_FILES) {
            const filePath = path.join(this.logPath, file);
            if (fs.existsSync(filePath)) {
                watchedFiles.push(file);
                this.initialScan(filePath, file);
                this.startWatchingFile(filePath, file);
            }
        }

        this.running = true;
        this.paused = false;
        this.stats.isRunning = true;
        this.stats.isPaused = false;
        this.stats.filesWatched = watchedFiles.length;

        this.callbacks.onStarted(watchedFiles);

        return {
            success: true,
            path: this.logPath,
            watching: watchedFiles,
            message: `Watching ${watchedFiles.length} log files in ${this.logPath}`,
        };
    }

    /**
     * Stop watching all log files
     */
    public stop(): { success: boolean; message: string } {
        if (!this.running) {
            return { success: false, message: 'Log watcher is not running' };
        }

        for (const file of LOG_FILES) {
            const filePath = path.join(this.logPath, file);
            try {
                fs.unwatchFile(filePath);
            } catch {
                // Ignore errors from unwatching files that may not exist
            }
        }

        this.running = false;
        this.paused = false;
        this.stats.isRunning = false;
        this.stats.isPaused = false;
        this.filePositions.clear();

        this.callbacks.onStopped();

        return { success: true, message: 'Log watcher stopped' };
    }

    /**
     * Pause log processing (still monitoring, but not reading)
     */
    public pause(): { success: boolean; message: string } {
        if (!this.running) {
            return { success: false, message: 'Log watcher is not running' };
        }
        if (this.paused) {
            return { success: false, message: 'Log watcher is already paused' };
        }

        this.paused = true;
        this.stats.isPaused = true;
        this.callbacks.onPaused();

        return { success: true, message: 'Log watcher paused' };
    }

    /**
     * Resume log processing
     */
    public resume(): { success: boolean; message: string } {
        if (!this.running) {
            return { success: false, message: 'Log watcher is not running' };
        }
        if (!this.paused) {
            return { success: false, message: 'Log watcher is not paused' };
        }

        this.paused = false;
        this.stats.isPaused = false;
        this.callbacks.onResumed();

        return { success: true, message: 'Log watcher resumed' };
    }

    /**
     * Force refresh: read all watched files from current position
     */
    public forceRefresh(): { success: boolean; files_read: number; total_lines: number } {
        if (!this.running) {
            return { success: false, files_read: 0, total_lines: 0 };
        }

        let filesRead = 0;
        let totalLines = 0;

        for (const file of LOG_FILES) {
            const filePath = path.join(this.logPath, file);
            if (fs.existsSync(filePath)) {
                const lines = this.readNewLines(filePath, file);
                if (lines.length > 0) {
                    filesRead++;
                    totalLines += lines.length;
                    this.callbacks.onLogEntries({ file, lines });
                }
            }
        }

        return { success: true, files_read: filesRead, total_lines: totalLines };
    }

    /**
     * Get current statistics
     */
    public getStatistics(): LogStatistics {
        return { ...this.stats };
    }

    /**
     * Check if watcher is running
     */
    public isRunning(): boolean {
        return this.running;
    }

    // --- Private methods ---

    /**
     * Read the last N lines from a file for initial display
     */
    private initialScan(filePath: string, fileName: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const allLines = content.split('\n');
            const startIndex = Math.max(0, allLines.length - this.initialLineLimit);
            const lines = allLines.slice(startIndex).filter(l => l.trim().length > 0);

            // Set position to end of file for incremental reads
            const stat = fs.statSync(filePath);
            this.filePositions.set(filePath, stat.size);

            if (lines.length > 0) {
                this.stats.totalLinesProcessed += lines.length;
                this.countErrorsWarnings(lines);
                this.callbacks.onLogEntries({ file: fileName, lines });
            }
        } catch (err) {
            this.callbacks.onError(`Failed to read ${fileName}: ${err}`);
        }
    }

    /**
     * Start watching a single file for changes
     */
    private startWatchingFile(filePath: string, fileName: string): void {
        fs.watchFile(filePath, { interval: this.pollInterval }, (curr, prev) => {
            if (this.paused) return;

            // File was modified (size increased)
            if (curr.size > prev.size) {
                const lines = this.readNewLines(filePath, fileName);
                if (lines.length > 0) {
                    this.stats.totalLinesProcessed += lines.length;
                    this.countErrorsWarnings(lines);
                    this.callbacks.onLogEntries({ file: fileName, lines });
                }
            } else if (curr.size < prev.size) {
                // File was truncated/rotated — reset position
                this.filePositions.set(filePath, 0);
                const lines = this.readNewLines(filePath, fileName);
                if (lines.length > 0) {
                    this.stats.totalLinesProcessed += lines.length;
                    this.countErrorsWarnings(lines);
                    this.callbacks.onLogEntries({ file: fileName, lines });
                }
            }
        });
    }

    /**
     * Read new lines from a file starting at the tracked position
     */
    private readNewLines(filePath: string, fileName: string): string[] {
        try {
            const stat = fs.statSync(filePath);
            const currentPos = this.filePositions.get(filePath) || 0;

            if (stat.size <= currentPos) {
                return [];
            }

            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(stat.size - currentPos);
            fs.readSync(fd, buffer, 0, buffer.length, currentPos);
            fs.closeSync(fd);

            this.filePositions.set(filePath, stat.size);

            const newContent = buffer.toString('utf-8');
            return newContent.split('\n').filter(l => l.trim().length > 0);
        } catch (err) {
            this.callbacks.onError(`Failed to read ${fileName}: ${err}`);
            return [];
        }
    }

    /**
     * Count errors and warnings in log lines for statistics
     */
    private countErrorsWarnings(lines: string[]): void {
        for (const line of lines) {
            const lower = line.toLowerCase();
            if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) {
                this.stats.errorsFound++;
            } else if (lower.includes('warn')) {
                this.stats.warningsFound++;
            }
        }
    }
}
