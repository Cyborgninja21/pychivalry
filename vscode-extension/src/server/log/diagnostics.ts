/**
 * Log Diagnostics Converter — turns LogAnalysisResults into LSP Diagnostics
 *
 * Resolves CK3 log-reported file paths against workspace roots, creates
 * Diagnostic objects with `source: "ck3-game-log"`, and publishes them
 * without overwriting the static-analysis diagnostics already on file.
 *
 * DIAGNOSTIC CODES:
 *   GAME_LOG_{CATEGORY}  (e.g. GAME_LOG_UNKNOWN_EFFECT)
 */

import { Diagnostic, DiagnosticSeverity, Connection } from 'vscode-languageserver/node';
import * as path from 'path';
import * as fs from 'fs';
import { LogAnalysisResult } from './analyzer';
import { serverLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_DIAGNOSTIC_SOURCE = 'ck3-game-log';

// ---------------------------------------------------------------------------
// LogDiagnosticConverter
// ---------------------------------------------------------------------------

export class LogDiagnosticConverter {
    private connection: Connection;
    private workspaceRoots: string[];

    /** Log-sourced diagnostics keyed by document URI */
    private logDiagnostics = new Map<string, Diagnostic[]>();

    constructor(connection: Connection, workspaceRoots: string[]) {
        this.connection = connection;
        this.workspaceRoots = workspaceRoots;
    }

    /** Update the set of workspace roots (e.g. when folders change). */
    setWorkspaceRoots(roots: string[]): void {
        this.workspaceRoots = roots;
    }

    // -----------------------------------------------------------------------
    // Conversion
    // -----------------------------------------------------------------------

    /**
     * Convert a single LogAnalysisResult to an LSP Diagnostic.
     * Returns null if the result lacks a resolvable source location.
     */
    convertToDiagnostic(result: LogAnalysisResult): Diagnostic | null {
        if (!result.sourceFile || result.lineNumber === undefined) {
            return null;
        }

        // LSP lines are 0-indexed; CK3 log lines are 1-indexed
        const line = Math.max(0, result.lineNumber - 1);
        const character = result.columnNumber ? Math.max(0, result.columnNumber - 1) : 0;

        const diag: Diagnostic = {
            severity: result.severity,
            range: {
                start: { line, character },
                end: { line, character: character + 1 },
            },
            message: `[Game Log] ${result.message}`,
            source: LOG_DIAGNOSTIC_SOURCE,
            code: `GAME_LOG_${result.category.toUpperCase()}`,
        };

        // Attach suggestions as related data
        if (result.suggestions.length > 0) {
            (diag as any).data = {
                suggestions: result.suggestions,
                category: result.category,
                actionType: result.codeActionType,
            };
        }

        return diag;
    }

    /**
     * Convert a batch of results, group by resolved URI, and publish.
     * Merges with (does not overwrite) existing static-analysis diagnostics.
     */
    convertAndPublish(results: LogAnalysisResult[]): void {
        // Group diagnostics by URI
        const byUri = new Map<string, Diagnostic[]>();

        for (const result of results) {
            const uri = this.resolveFileUri(result.sourceFile);
            if (!uri) continue;

            const diag = this.convertToDiagnostic(result);
            if (!diag) continue;

            let list = byUri.get(uri);
            if (!list) {
                list = [];
                byUri.set(uri, list);
            }
            list.push(diag);
        }

        // Publish per-URI
        for (const [uri, diags] of byUri) {
            this.publishDiagnostics(uri, diags);
        }
    }

    // -----------------------------------------------------------------------
    // Publishing
    // -----------------------------------------------------------------------

    /**
     * Publish log diagnostics for a URI, merging with any already-tracked
     * log diagnostics (additive within a session).
     */
    publishDiagnostics(uri: string, newDiags: Diagnostic[]): void {
        const existing = this.logDiagnostics.get(uri) ?? [];
        const merged = [...existing, ...newDiags];
        this.logDiagnostics.set(uri, merged);

        // Send to client — only the log-sourced set (the server sends
        // static diagnostics separately and the client merges by source).
        this.connection.sendDiagnostics({ uri, diagnostics: merged });
    }

    /** Clear log diagnostics for a single URI. */
    clearLogDiagnostics(uri: string): void {
        this.logDiagnostics.delete(uri);
        this.connection.sendDiagnostics({ uri, diagnostics: [] });
    }

    /** Clear all tracked log diagnostics across all files. */
    clearAllLogDiagnostics(): void {
        for (const uri of this.logDiagnostics.keys()) {
            this.connection.sendDiagnostics({ uri, diagnostics: [] });
        }
        this.logDiagnostics.clear();
    }

    /** Return a read-only view of active log diagnostics. */
    getActiveDiagnostics(): ReadonlyMap<string, Diagnostic[]> {
        return this.logDiagnostics;
    }

    // -----------------------------------------------------------------------
    // Path resolution
    // -----------------------------------------------------------------------

    /**
     * Resolve a file path from a CK3 log entry to a `file://` URI.
     *
     * Tries the path as-is first (absolute), then relative to each
     * workspace root.  Returns null if no valid file is found.
     */
    resolveFileUri(filePath: string | undefined): string | null {
        if (!filePath) return null;

        // Normalise separators
        const normalized = filePath.replace(/\\/g, '/');

        // 1. Absolute path
        if (path.isAbsolute(normalized)) {
            if (this.fileExists(normalized)) {
                return this.pathToUri(normalized);
            }
        }

        // 2. Relative to workspace roots
        for (const root of this.workspaceRoots) {
            const candidate = path.resolve(root, normalized);
            if (this.fileExists(candidate)) {
                return this.pathToUri(candidate);
            }
        }

        return null;
    }

    private fileExists(p: string): boolean {
        try {
            fs.accessSync(p, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    private pathToUri(p: string): string {
        const normalized = p.replace(/\\/g, '/');
        if (normalized.startsWith('/')) {
            return `file://${normalized}`;
        }
        return `file:///${normalized}`;
    }
}
