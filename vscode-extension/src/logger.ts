import * as vscode from 'vscode';

/**
 * Categories for output channel routing
 */
export enum LogCategory {
    Server = 'Server',
    Debug = 'Debug',
    Commands = 'Commands',
    Trace = 'Trace',
    Performance = 'Performance',
    GameLogs = 'GameLogs',
}

/**
 * Multi-channel logger for the CK3 Language Server extension.
 * Routes messages to appropriate output channels for better debugging.
 */
export class CK3Logger {
    private channels: Map<LogCategory, vscode.OutputChannel> = new Map();
    private context: vscode.ExtensionContext | undefined;

    constructor() {}

    /**
     * Initialize the logger with the extension context.
     * Creates the primary output channels.
     */
    initialize(context: vscode.ExtensionContext): void {
        this.context = context;

        // Create primary channels (always created)
        this.createChannel(LogCategory.Server, 'CK3: Server');
        this.createChannel(LogCategory.Commands, 'CK3: Commands');

        // Create trace channel (will be used when tracing enabled)
        this.createChannel(LogCategory.Trace, 'CK3: Trace');
    }

    /**
     * Enable debug mode - creates Debug and Performance channels.
     * Called automatically when logLevel is 'debug'.
     */
    enableDebugMode(): void {
        if (!this.channels.has(LogCategory.Debug)) {
            this.createChannel(LogCategory.Debug, 'CK3: Debug');
        }
        if (!this.channels.has(LogCategory.Performance)) {
            this.createChannel(LogCategory.Performance, 'CK3: Performance');
        }
    }

    /**
     * Check if debug mode is enabled.
     */
    hasDebugChannel(): boolean {
        return this.channels.has(LogCategory.Debug);
    }

    /**
     * Create an output channel and register it for disposal.
     */
    private createChannel(category: LogCategory, name: string): vscode.OutputChannel {
        const channel = vscode.window.createOutputChannel(name);
        this.channels.set(category, channel);
        this.context?.subscriptions.push(channel);
        return channel;
    }

    /**
     * Enable performance logging by creating the performance channel.
     * Called when the user enables performance logging in settings.
     */
    enablePerformanceLogging(): vscode.OutputChannel {
        if (!this.channels.has(LogCategory.Performance)) {
            this.createChannel(LogCategory.Performance, 'CK3: Performance');
        }
        return this.channels.get(LogCategory.Performance)!;
    }

    /**
     * Check if performance logging is enabled.
     */
    hasPerformanceChannel(): boolean {
        return this.channels.has(LogCategory.Performance);
    }

    /**
     * Enable debug logging by creating the debug channel.
     */
    enableDebugLogging(): vscode.OutputChannel {
        if (!this.channels.has(LogCategory.Debug)) {
            this.createChannel(LogCategory.Debug, 'CK3: Debug');
        }
        return this.channels.get(LogCategory.Debug)!;
    }

    /**
     * Log a message to a specific category channel.
     */
    log(category: LogCategory, message: string): void {
        const channel = this.channels.get(category);
        if (channel) {
            const timestamp = new Date().toISOString().substring(11, 23);
            channel.appendLine(`[${timestamp}] ${message}`);
        }
    }

    /**
     * Log a message to the Server channel.
     * Use for lifecycle events (start, stop, config changes).
     */
    logServer(message: string): void {
        this.log(LogCategory.Server, message);
    }

    /**
     * Log a message to the Debug channel (if enabled).
     * Use for detailed debug information.
     */
    logDebug(message: string): void {
        if (this.channels.has(LogCategory.Debug)) {
            this.log(LogCategory.Debug, message);
        }
    }

    /**
     * Log a message to the Commands channel.
     * Use for command execution results.
     */
    logCommand(message: string): void {
        this.log(LogCategory.Commands, message);
    }

    /**
     * Log a message to the Performance channel (if enabled).
     * Use for timing and cache metrics.
     */
    logPerformance(message: string): void {
        if (this.channels.has(LogCategory.Performance)) {
            this.log(LogCategory.Performance, message);
        }
    }

    /**
     * Append a line without timestamp (for multi-line output).
     */
    appendLine(category: LogCategory, message: string): void {
        const channel = this.channels.get(category);
        if (channel) {
            channel.appendLine(message);
        }
    }

    /**
     * Append multiple lines to Commands channel (for formatted output like stats).
     */
    appendCommandLines(lines: string[]): void {
        const channel = this.channels.get(LogCategory.Commands);
        if (channel) {
            lines.forEach((line) => channel.appendLine(line));
        }
    }

    /**
     * Get a specific output channel.
     */
    getChannel(category: LogCategory): vscode.OutputChannel | undefined {
        return this.channels.get(category);
    }

    /**
     * Show a specific output channel.
     */
    showChannel(category: LogCategory): void {
        this.channels.get(category)?.show();
    }

    /**
     * Get all available channel categories.
     */
    getAvailableCategories(): LogCategory[] {
        return Array.from(this.channels.keys());
    }

    /**
     * Dispose is handled by context.subscriptions
     */
    dispose(): void {
        // Channels are disposed via context.subscriptions
    }
}

// Singleton instance
export const logger = new CK3Logger();
