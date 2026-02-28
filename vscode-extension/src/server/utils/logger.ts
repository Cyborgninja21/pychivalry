/**
 * Shared logger for the language server process.
 * Routes messages to the LSP connection when available, falls back to console.
 */

interface LogSink {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

function formatArgs(args: any[]): string {
    return args.map(a => typeof a === 'string' ? a : String(a)).join(' ');
}

class ServerLogger {
    private connection: LogSink | null = null;

    /** Set the LSP connection to route logs to the VS Code output channel */
    setConnection(conn: { console: LogSink }): void {
        this.connection = conn.console;
    }

    log(...args: any[]): void {
        const msg = formatArgs(args);
        if (this.connection) {
            this.connection.log(msg);
        } else {
            console.log(msg);
        }
    }

    warn(...args: any[]): void {
        const msg = formatArgs(args);
        if (this.connection) {
            this.connection.warn(msg);
        } else {
            console.warn(msg);
        }
    }

    error(...args: any[]): void {
        const msg = formatArgs(args);
        if (this.connection) {
            this.connection.error(msg);
        } else {
            console.error(msg);
        }
    }
}

export const serverLogger = new ServerLogger();
