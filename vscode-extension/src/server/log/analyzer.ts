/**
 * CK3 Log Analyzer — Pattern-based error detection for game logs
 *
 * Matches raw CK3 log lines against pre-defined regex patterns,
 * extracts source locations, generates fix suggestions via fuzzy matching,
 * and tracks per-category statistics.
 *
 * DIAGNOSTIC CODES (internal):
 *   LOGANAL-001: Pattern matching error
 *   LOGANAL-002: Location extraction failed
 *   LOGANAL-003: Suggestion generation error
 */

import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { findSimilar } from '../utils/fuzzy-match';
import { DataLoader } from '../data/loader';
import { serverLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorPattern {
    regex: RegExp;
    severity: DiagnosticSeverity;
    category: string;
    messageTemplate: string;
    actionType: string;
    extractLocation: boolean;
    suggestFix: boolean;
}

export interface LogAnalysisResult {
    severity: DiagnosticSeverity;
    category: string;
    message: string;
    rawLine: string;
    timestamp: number;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    extractedValues: Record<string, string>;
    suggestions: string[];
    codeActionType?: string;
}

export interface LogStatistics {
    totalLinesProcessed: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    errorsByCategory: Record<string, number>;
    mostCommonErrors: Array<[string, number]>;
    startTime: number;
    lastUpdate: number;
}

// ---------------------------------------------------------------------------
// Location-extraction regexes (compiled once)
// ---------------------------------------------------------------------------

const LOC_PATTERN_1 = /file\s+['"]([^'"]+)['"].*line\s+(\d+)/i;
const LOC_PATTERN_2 = /File:\s+([^,]+),.*Line:\s+(\d+)/i;
const LOC_PATTERN_3 = /([a-zA-Z0-9_/\\.-]+\.txt):(\d+)/;

// ---------------------------------------------------------------------------
// CK3LogAnalyzer
// ---------------------------------------------------------------------------

export class CK3LogAnalyzer {
    private patterns: ErrorPattern[] = [];
    private stats: LogStatistics;

    constructor() {
        this.stats = this.freshStats();
        this.registerDefaultPatterns();
        serverLogger.log(`CK3LogAnalyzer initialised with ${this.patterns.length} patterns`);
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /** Analyse a single log line. Returns null when no pattern matches. */
    analyzeLine(line: string, sourceFile: string): LogAnalysisResult | null {
        this.stats.totalLinesProcessed++;
        this.stats.lastUpdate = Date.now();

        for (const pattern of this.patterns) {
            const match = pattern.regex.exec(line);
            if (match) {
                const result = this.buildResult(pattern, match, line, sourceFile);
                this.updateStats(result);
                return result;
            }
        }
        return null;
    }

    /** Analyse a batch of lines (serial — Node is single-threaded). */
    analyzeBatch(lines: string[], sourceFile: string): LogAnalysisResult[] {
        const results: LogAnalysisResult[] = [];
        for (const line of lines) {
            const r = this.analyzeLine(line, sourceFile);
            if (r) results.push(r);
        }
        return results;
    }

    /** Register an additional error pattern at runtime. */
    registerPattern(pattern: ErrorPattern): void {
        this.patterns.push(pattern);
    }

    /** Return a snapshot of current statistics. */
    getStatistics(): LogStatistics {
        this.stats.mostCommonErrors = Object.entries(this.stats.errorsByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        return { ...this.stats, errorsByCategory: { ...this.stats.errorsByCategory } };
    }

    /** Reset all counters. */
    resetStatistics(): void {
        this.stats = this.freshStats();
    }

    // -----------------------------------------------------------------------
    // Default patterns (14 categories)
    // -----------------------------------------------------------------------

    private registerDefaultPatterns(): void {
        const E = DiagnosticSeverity.Error;
        const W = DiagnosticSeverity.Warning;

        const defs: Array<[string, DiagnosticSeverity, string, string, string]> = [
            [String.raw`\[E\].*Script system error!`,         E, 'script_system_error',  'CK3 Script System Error',                              'show_error_details'],
            [String.raw`Error:\s+(\w+)\s+effect\s+\[`,        E, 'effect_error',          "Error in effect '{0}'",                                 'suggest_similar_effect'],
            [String.raw`Failed to read key reference:\s+([^:]+):`, W, 'missing_key_reference', "Missing key reference '{0}'",                     'check_key_definition'],
            [String.raw`Unknown modifier\s+'([^']+)'`,        E, 'unknown_modifier',      "Unknown modifier '{0}'",                                'suggest_valid_modifiers'],
            [String.raw`Unknown effect:?\s+['"]?(\w+)['"]?`,  E, 'unknown_effect',        "Unknown effect '{0}'",                                  'suggest_similar_effect'],
            [String.raw`Unknown trigger:?\s+['"]?(\w+)['"]?`, E, 'unknown_trigger',       "Unknown trigger '{0}'",                                 'suggest_similar_trigger'],
            [String.raw`Invalid scope.*from\s+(\w+)\s+to\s+(\w+)`, E, 'scope_error',      'Invalid scope navigation from {0} to {1}',              'show_valid_scopes'],
            [String.raw`Event\s+([\w.]+)\s+not found`,        E, 'missing_event',         "Referenced event {0} doesn't exist",                    'create_event_stub'],
            [String.raw`Missing localization key:?\s+['"]?(\w+)['"]?`, W, 'missing_localization', "Localization key '{0}' not found",              'generate_loc_entry'],
            [String.raw`Variable\s+['"](\w+)['"].*not defined`, E, 'undefined_variable',  "Variable '{0}' used before definition",                 'add_variable_definition'],
            [String.raw`Script execution took\s+(\d+)ms.*in event\s+([\w.]+)`, W, 'performance', 'Event {1} took {0}ms (slow execution)',          'suggest_optimization'],
            [String.raw`Unexpected token\s+['"]([^'"]+)['"]`, E, 'syntax_error',          "Unexpected token '{0}'",                                'show_syntax_help'],
            [String.raw`File\s+['"]([^'"]+)['"].*not found`,  E, 'missing_file',          "File '{0}' not found",                                  'create_file_stub'],
            [String.raw`Duplicate.*definition.*['"](\w+)['"]`, W, 'duplicate_definition', "Duplicate definition of '{0}'",                         'show_other_definition'],
        ];

        for (const [regex, severity, category, template, action] of defs) {
            this.patterns.push({
                regex: new RegExp(regex, 'i'),
                severity,
                category,
                messageTemplate: template,
                actionType: action,
                extractLocation: true,
                suggestFix: true,
            });
        }
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    private buildResult(
        pattern: ErrorPattern,
        match: RegExpExecArray,
        line: string,
        sourceFile: string,
    ): LogAnalysisResult {
        const groups = match.slice(1);

        // Format message by substituting {0}, {1}, ...
        let message = pattern.messageTemplate;
        groups.forEach((g, i) => {
            message = message.replace(`{${i}}`, g ?? '');
        });

        const result: LogAnalysisResult = {
            severity: pattern.severity,
            category: pattern.category,
            message,
            rawLine: line.trim(),
            timestamp: Date.now(),
            extractedValues: {},
            suggestions: [],
            codeActionType: pattern.actionType,
        };

        // Store captured groups
        groups.forEach((g, i) => {
            if (g !== undefined) result.extractedValues[`group${i}`] = g;
        });

        // Extract source location
        if (pattern.extractLocation) {
            const loc = this.extractLocation(line);
            if (loc) {
                result.sourceFile = loc.file;
                result.lineNumber = loc.line;
                result.columnNumber = loc.column;
            }
        }

        // Generate fix suggestions
        if (pattern.suggestFix && groups.length > 0) {
            result.suggestions = this.generateSuggestions(pattern, groups);
        }

        return result;
    }

    private extractLocation(line: string): { file: string; line: number; column?: number } | null {
        let m = LOC_PATTERN_1.exec(line);
        if (m) return { file: m[1], line: parseInt(m[2], 10) };

        m = LOC_PATTERN_2.exec(line);
        if (m) return { file: m[1].trim(), line: parseInt(m[2], 10) };

        m = LOC_PATTERN_3.exec(line);
        if (m) return { file: m[1], line: parseInt(m[2], 10) };

        return null;
    }

    private generateSuggestions(pattern: ErrorPattern, groups: (string | undefined)[]): string[] {
        const value = groups[0];
        if (!value) return [];

        try {
            const dataLoader = DataLoader.getInstance();

            if (pattern.actionType === 'suggest_similar_effect') {
                const known = dataLoader.getEffects();
                return findSimilar(value, known.keys(), { max: 3 });
            }
            if (pattern.actionType === 'suggest_similar_trigger') {
                const known = dataLoader.getTriggers();
                return findSimilar(value, known.keys(), { max: 3 });
            }
        } catch {
            // DataLoader might not be initialised yet — silently skip
        }

        return [];
    }

    private updateStats(result: LogAnalysisResult): void {
        if (result.severity === DiagnosticSeverity.Error) this.stats.totalErrors++;
        else if (result.severity === DiagnosticSeverity.Warning) this.stats.totalWarnings++;
        else this.stats.totalInfo++;

        this.stats.errorsByCategory[result.category] =
            (this.stats.errorsByCategory[result.category] ?? 0) + 1;
    }

    private freshStats(): LogStatistics {
        return {
            totalLinesProcessed: 0,
            totalErrors: 0,
            totalWarnings: 0,
            totalInfo: 0,
            errorsByCategory: {},
            mostCommonErrors: [],
            startTime: Date.now(),
            lastUpdate: Date.now(),
        };
    }
}
