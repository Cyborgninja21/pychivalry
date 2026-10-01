/**
 * Server-side wiring of the game-log subsystem: the watcher, the analyzer and the
 * diagnostic converter behind the ck3.*LogWatcher commands. Moved out of server.ts in
 * Phase 4 without behaviour changes.
 */

import { Connection } from 'vscode-languageserver/node';
import { CK3LogWatcher, LogEntry, LogWatcherConfig } from './watcher';
import { CK3LogAnalyzer } from './analyzer';
import { LogDiagnosticConverter } from './diagnostics';

export interface LogWatcherSettings {
    debounceDelay: number;
    maxLogSize: number;
}

export class LogWatcherController {
    private watcher: CK3LogWatcher | null = null;
    private analyzer: CK3LogAnalyzer | null = null;
    private converter: LogDiagnosticConverter | null = null;

    constructor(
        private connection: Connection,
        private workspaceRoots: () => string[],
        private settings: () => LogWatcherSettings
    ) {}

    public start(): ReturnType<CK3LogWatcher['start']> {
        if (!this.analyzer) {
            this.analyzer = new CK3LogAnalyzer();
        }
        if (!this.converter) {
            this.converter = new LogDiagnosticConverter(this.connection, this.workspaceRoots());
        }
        if (!this.watcher) {
            const { debounceDelay, maxLogSize } = this.settings();
            const config: LogWatcherConfig = { debounceDelay, maxLogSize };
            this.watcher = new CK3LogWatcher(
                {
                    onLogEntries: (entry: LogEntry) => this.onLogEntries(entry),
                    onStarted: (files: string[]) =>
                        this.connection.sendNotification('ck3/logWatcherStarted', { files }),
                    onStopped: () => this.connection.sendNotification('ck3/logWatcherStopped', {}),
                    onPaused: () => this.connection.sendNotification('ck3/logWatcherPaused', {}),
                    onResumed: () => this.connection.sendNotification('ck3/logWatcherResumed', {}),
                    onError: (message: string) =>
                        this.connection.console.error(`Log watcher error: ${message}`),
                },
                config
            );
        }
        return this.watcher.start();
    }

    private onLogEntries(entry: LogEntry): void {
        // Per-file and combined channels
        this.connection.sendNotification(`ck3/logEntry/${entry.file.replace('.log', '')}/bulk`, {
            lines: entry.lines,
            log_file: entry.file,
        });
        this.connection.sendNotification('ck3/logEntry/combined/bulk', {
            lines: entry.lines,
            log_file: entry.file,
        });

        // Analyse the lines and publish diagnostics
        if (this.analyzer && this.converter) {
            const results = this.analyzer.analyzeBatch(entry.lines, entry.file);
            if (results.length > 0) {
                this.converter.convertAndPublish(results);
                this.connection.sendNotification('ck3/logEntry/pattern/bulk', {
                    patterns: results.map((r) => ({
                        message: r.message,
                        severity: r.severity,
                        category: r.category,
                        sourceFile: r.sourceFile,
                        lineNumber: r.lineNumber,
                        suggestions: r.suggestions,
                    })),
                });
            }
        }
    }

    public stop(): { success: boolean; message: string } {
        if (!this.watcher) {
            return { success: false, message: 'Log watcher was never initialized' };
        }
        return this.watcher.stop();
    }

    public pause(): { success: boolean; message: string } {
        if (!this.watcher) {
            return { success: false, message: 'Log watcher was never initialized' };
        }
        return this.watcher.pause();
    }

    public resume(): { success: boolean; message: string } {
        if (!this.watcher) {
            return { success: false, message: 'Log watcher was never initialized' };
        }
        return this.watcher.resume();
    }

    public forceRefresh(): { success: boolean; files_read: number; total_lines: number } {
        if (!this.watcher) {
            return { success: false, files_read: 0, total_lines: 0 };
        }
        return this.watcher.forceRefresh();
    }

    /** Clear log diagnostics, reset the analyzer and stop the watcher. */
    public clear(): { success: boolean; message: string } {
        this.converter?.clearAllLogDiagnostics();
        this.analyzer?.resetStatistics();
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
        return { success: true, message: 'Game logs cleared' };
    }

    /** Stop watching (server shutdown). */
    public dispose(): void {
        if (this.watcher) {
            this.watcher.stop();
            this.watcher = null;
        }
    }

    public statistics(): Record<string, unknown> {
        const watcherStats = this.watcher ? this.watcher.getStatistics() : null;
        const analyzerStats = this.analyzer ? this.analyzer.getStatistics() : null;
        return {
            success: true,
            statistics: {
                total_lines_processed:
                    analyzerStats?.totalLinesProcessed ?? watcherStats?.totalLinesProcessed ?? 0,
                total_errors: analyzerStats?.totalErrors ?? watcherStats?.errorsFound ?? 0,
                total_warnings: analyzerStats?.totalWarnings ?? watcherStats?.warningsFound ?? 0,
                total_info: 0,
                errors_by_category: analyzerStats?.errorsByCategory ?? {},
                most_common_errors: analyzerStats?.mostCommonErrors ?? [],
                slow_events: {},
                files_watched: watcherStats?.filesWatched ?? 0,
                is_running: watcherStats?.isRunning ?? false,
                is_paused: watcherStats?.isPaused ?? false,
            },
        };
    }
}
