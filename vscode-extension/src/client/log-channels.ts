/**
 * Output channels for the game-log watcher (CK3L: …) and the handlers of the server's
 * log notifications. Moved out of extension.ts in Phase 4 without behaviour changes.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { logger } from '../logger';

interface LogBulkParams {
    lines: string[];
    log_file?: string;
}

interface LogSingleParams {
    message: string;
    raw_line?: string;
    log_file?: string;
}

interface PatternMatchResult {
    severity: number;
    message: string;
    source_file?: string;
    line_number?: number;
    suggestions?: string[];
    log_file?: string;
}

interface PatternBulkParams {
    results: PatternMatchResult[];
}

interface LogWatcherStartedParams {
    files?: string[];
}

const CHANNEL_NAMES = {
    combined: 'CK3L: Live Monitor',
    game: 'CK3L: game.log',
    error: 'CK3L: error.log',
    exceptions: 'CK3L: exceptions.log',
    system: 'CK3L: system.log',
    setup: 'CK3L: setup.log',
    patterns: 'CK3L: Script Errors',
} as const;

export type LogChannel = keyof typeof CHANNEL_NAMES;

/** The per-file channels of the bulk and single-line notifications. */
const FILE_CHANNELS: LogChannel[] = ['game', 'error', 'exceptions', 'system', 'setup'];

const channels = new Map<LogChannel, vscode.OutputChannel>();

/** The output channel of one log (created once, with ANSI colour support). */
export function getLogChannel(type: LogChannel): vscode.OutputChannel {
    let channel = channels.get(type);
    if (!channel) {
        channel = vscode.window.createOutputChannel(CHANNEL_NAMES[type], { log: true });
        channels.set(type, channel);
    }
    return channel;
}

/** Create every channel so that they appear in the Output menu. */
export function createLogChannels(): void {
    for (const type of Object.keys(CHANNEL_NAMES) as LogChannel[]) {
        getLogChannel(type);
    }
}

export function disposeLogChannels(): void {
    for (const channel of channels.values()) {
        channel.dispose();
    }
    channels.clear();
}

// ANSI color codes for log output
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',
    bgRed: '\x1b[41m',
};

export function colorizeLogLine(line: string): string {
    line = line.replace(/\[(\d{2}:\d{2}:\d{2})\]/g, `${COLORS.dim}[$1]${COLORS.reset}`);
    line = line.replace(
        /\[(game\.log|error\.log|exceptions\.log|system\.log|setup\.log)\]/g,
        (_match, file: string) => {
            const colorMap: Record<string, string> = {
                gameLog: COLORS.brightCyan,
                errorLog: COLORS.brightRed,
                exceptionsLog: COLORS.brightMagenta,
                systemLog: COLORS.brightYellow,
                setupLog: COLORS.brightGreen,
            };
            // Map the dotted file names to camelCase keys
            const fileKey = file.replace(/\./g, '').replace(/log$/, 'Log');
            return `${colorMap[fileKey] || COLORS.cyan}[${file}]${COLORS.reset}`;
        }
    );
    line = line.replace(/\[E\]/g, `${COLORS.brightRed}${COLORS.bright}[E]${COLORS.reset}`);
    line = line.replace(/\[W\]/g, `${COLORS.brightYellow}[W]${COLORS.reset}`);
    line = line.replace(/\[I\]/g, `${COLORS.brightBlue}[I]${COLORS.reset}`);
    line = line.replace(
        /^(\s*)Error:/gm,
        `$1${COLORS.brightRed}${COLORS.bright}Error:${COLORS.reset}`
    );
    line = line.replace(
        /(Script system error!)/g,
        `${COLORS.bgRed}${COLORS.brightWhite}$1${COLORS.reset}`
    );
    line = line.replace(/(file:\s+)([^\s]+)/g, `$1${COLORS.brightCyan}$2${COLORS.reset}`);
    line = line.replace(/\b(line:\s+)(\d+)/g, `$1${COLORS.brightYellow}$2${COLORS.reset}`);
    return line;
}

export function getSeverityIcon(severity: number): string {
    switch (severity) {
        case 1:
            return '❌';
        case 2:
            return '⚠️';
        case 3:
            return 'ℹ️';
        case 4:
            return '💡';
        default:
            return '📝';
    }
}

/** One pattern match (from the server's log analyzer) as coloured lines. */
function formatPattern(result: PatternMatchResult): string[] {
    const icon = getSeverityIcon(result.severity);
    const severityColor = result.severity === 1 ? COLORS.brightRed : COLORS.brightYellow;
    const lines = [
        `${severityColor}${icon}${COLORS.reset} ${COLORS.bright}${result.message}${COLORS.reset}`,
    ];
    if (result.source_file) {
        lines.push(
            `  ${COLORS.cyan}→${COLORS.reset} ${COLORS.brightCyan}${result.source_file}${COLORS.reset}:${COLORS.brightYellow}${result.line_number || '?'}${COLORS.reset}`
        );
    }
    if (result.suggestions && result.suggestions.length > 0) {
        lines.push(
            `  ${COLORS.brightGreen}💡 Suggestions:${COLORS.reset} ${COLORS.green}${result.suggestions.join(', ')}${COLORS.reset}`
        );
    }
    if (result.log_file) {
        const fileColor = result.log_file.includes('error')
            ? COLORS.brightRed
            : result.log_file.includes('exception')
              ? COLORS.brightMagenta
              : COLORS.brightCyan;
        lines.push(
            `  ${COLORS.dim}📁 From:${COLORS.reset} ${fileColor}${result.log_file}${COLORS.reset}`
        );
    }
    lines.push(''); // blank line for readability
    return lines;
}

/** Route the server's log, watcher and index notifications to the output channels. */
export function registerLogNotifications(client: LanguageClient): void {
    // Bulk notifications
    client.onNotification('ck3/logEntry/combined/bulk', (params: LogBulkParams) => {
        const sourceFile = params.log_file ? `[${params.log_file}]` : '';
        const output = params.lines
            .map((line) => colorizeLogLine(`${sourceFile} ${line}`.trim()))
            .join('\n');
        getLogChannel('combined').append(output + '\n');
    });
    for (const type of FILE_CHANNELS) {
        client.onNotification(`ck3/logEntry/${type}/bulk`, (params: LogBulkParams) => {
            getLogChannel(type).append(
                params.lines.map((line) => colorizeLogLine(line)).join('\n') + '\n'
            );
        });
    }
    client.onNotification('ck3/logEntry/pattern/bulk', (params: PatternBulkParams) => {
        getLogChannel('patterns').append(
            params.results.map((r) => formatPattern(r).join('\n')).join('\n')
        );
    });

    // Single-line notifications (kept for backward compatibility)
    client.onNotification('ck3/logEntry/combined', (params: LogSingleParams) => {
        const sourceFile = params.log_file ? `[${params.log_file}]` : '';
        getLogChannel('combined').appendLine(
            colorizeLogLine(`${sourceFile} ${params.message}`.trim())
        );
    });
    for (const type of FILE_CHANNELS) {
        client.onNotification(`ck3/logEntry/${type}`, (params: LogSingleParams) => {
            getLogChannel(type).appendLine(colorizeLogLine(params.raw_line || params.message));
        });
    }
    client.onNotification('ck3/logEntry/pattern', (params: PatternMatchResult) => {
        const channel = getLogChannel('patterns');
        formatPattern(params).forEach((line) => channel.appendLine(line));
    });

    // Watcher lifecycle
    client.onNotification('ck3/logWatcherStarted', (params: LogWatcherStartedParams) => {
        logger.logServer(`Log watcher started for ${params.files?.length || 0} files`);
    });
    client.onNotification('ck3/logWatcherStopped', () => logger.logServer('Log watcher stopped'));
    client.onNotification('ck3/logWatcherPaused', () => logger.logServer('Log watcher paused'));
    client.onNotification('ck3/logWatcherResumed', () => logger.logServer('Log watcher resumed'));

    // Workspace scanning and indexing output
    client.onNotification('ck3/indexLog', (params: { message: string }) => {
        logger.logServer(`[Index notification received] ${params.message}`);
        logger.logIndex(params.message);
    });
    client.onNotification('ck3/indexLog/bulk', (params: { lines: string[] }) => {
        logger.logServer(`[Index bulk notification received] ${params.lines.length} lines`);
        logger.appendIndexLines(params.lines);
    });
}
