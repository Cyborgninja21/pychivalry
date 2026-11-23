/**
 * The local channel between pychivalry's own programs on one machine (docs/shared-index.md):
 * a Unix domain socket, a file in the user's own owner-only folder, or on Windows a named pipe
 * of this machine (`\\.\pipe\<name>`). Messages are JSON, one per line.
 *
 * This is the one file of pychivalry that imports Node's networking module, because it is the
 * only way Node opens a Unix domain socket or a named pipe (AGENTS.md, rule 12, and its test's
 * one exception). It binds and connects a path and nothing else: every address is checked by
 * `isLocalAddress` first, and the module is only ever called with `{ path }`, never a port, a
 * host name or an IP address, so no address it opens can be reached from another machine.
 */

import { rmSync } from 'node:fs';
import { connect, createServer, type Server, type Socket } from 'node:net';
import path from 'node:path';

/** A pipe of this machine: the name only, no server part but the dot. */
const WINDOWS_PIPE = /^\\\\\.\\pipe\\pychivalry-[0-9a-f]{32}$/;

/** A socket file of pychivalry's own: an absolute path ending `pychivalry-<32 hex>.sock`. */
const SOCKET_FILE = /^pychivalry-[0-9a-f]{32}\.sock$/;

/** The longest socket path every POSIX system accepts (its `sun_path` holds 104 bytes or more). */
export const MAX_SOCKET_PATH = 100;

/**
 * True when `address` is one this channel may bind or connect: on Windows a pipe of this
 * machine named `\\.\pipe\pychivalry-<32 hex>`; elsewhere an absolute path, short enough to
 * bind, of a file named `pychivalry-<32 hex>.sock`. Never a port, a host or an IP address.
 */
export function isLocalAddress(
    address: string,
    platform: NodeJS.Platform = process.platform,
): boolean {
    if (platform === 'win32') {
        return WINDOWS_PIPE.test(address);
    }
    return (
        path.posix.isAbsolute(address) &&
        !address.includes('\u0000') &&
        Buffer.byteLength(address) <= MAX_SOCKET_PATH &&
        SOCKET_FILE.test(path.posix.basename(address))
    );
}

/** The address of a new channel named by `random` (32 hex digits) in `folder` (POSIX). */
export function localAddress(
    folder: string,
    random: string,
    platform: NodeJS.Platform = process.platform,
): string {
    return platform === 'win32'
        ? `\\\\.\\pipe\\pychivalry-${random}`
        : path.posix.join(folder, `pychivalry-${random}.sock`);
}

function refuseAddress(address: string): void {
    if (!isLocalAddress(address)) {
        throw new Error(`not a local channel address: ${address}`);
    }
}

/** One connection: JSON messages, one per line, each way. */
export interface LocalConnection {
    send(message: unknown): void;
    /** Each message received, parsed. */
    onMessage(listener: (message: unknown) => void): void;
    /** The connection closed, or failed. Called once. */
    onClose(listener: (error: Error | null) => void): void;
    close(): void;
}

class LineConnection implements LocalConnection {
    private buffer = '';
    private closed = false;
    private readonly messageListeners: ((message: unknown) => void)[] = [];
    private readonly closeListeners: ((error: Error | null) => void)[] = [];
    private failure: Error | null = null;

    constructor(
        private readonly socket: Socket,
        private readonly maxMessageBytes: number,
    ) {
        socket.setEncoding('utf8');
        socket.on('data', (chunk: string) => {
            this.receive(chunk);
        });
        socket.on('error', (error) => {
            this.failure = error;
        });
        socket.on('close', () => {
            this.finish();
        });
    }

    private receive(chunk: string): void {
        this.buffer += chunk;
        if (this.buffer.length > this.maxMessageBytes) {
            this.failure = new Error('a message is larger than the channel takes');
            this.close();
            return;
        }
        let end = this.buffer.indexOf('\n');
        while (end >= 0 && !this.closed) {
            const line = this.buffer.slice(0, end);
            this.buffer = this.buffer.slice(end + 1);
            let message: unknown;
            try {
                message = JSON.parse(line) as unknown;
            } catch {
                this.failure = new Error('a message is not JSON');
                this.close();
                return;
            }
            for (const listener of this.messageListeners) {
                listener(message);
            }
            end = this.buffer.indexOf('\n');
        }
    }

    private finish(): void {
        if (this.closed && this.closeListeners.length === 0) {
            return;
        }
        this.closed = true;
        for (const listener of this.closeListeners.splice(0)) {
            listener(this.failure);
        }
    }

    send(message: unknown): void {
        if (!this.closed && this.socket.writable) {
            this.socket.write(`${JSON.stringify(message)}\n`);
        }
    }

    onMessage(listener: (message: unknown) => void): void {
        this.messageListeners.push(listener);
    }

    onClose(listener: (error: Error | null) => void): void {
        if (this.closed) {
            listener(this.failure);
            return;
        }
        this.closeListeners.push(listener);
    }

    close(): void {
        this.closed = true;
        this.socket.end();
        this.socket.destroySoon();
    }
}

/** A channel listening: its address, and how to stop it. */
export interface LocalServer {
    readonly address: string;
    close(): Promise<void>;
}

/**
 * Listen on a local address (`isLocalAddress`) and call `onConnection` for each program that
 * connects. On POSIX the socket file is made in the caller's folder, which must be owner-only,
 * and removed when the channel closes.
 */
export async function listenLocal(
    address: string,
    onConnection: (connection: LocalConnection) => void,
    maxMessageBytes = 4 * 1024 * 1024,
): Promise<LocalServer> {
    refuseAddress(address);
    const server: Server = createServer((socket) => {
        onConnection(new LineConnection(socket, maxMessageBytes));
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen({ path: address, readableAll: false, writableAll: false }, () => {
            server.off('error', reject);
            resolve();
        });
    });
    server.on('error', () => undefined);
    return {
        address,
        close: () =>
            new Promise<void>((resolve) => {
                server.close(() => {
                    if (process.platform !== 'win32') {
                        rmSync(address, { force: true });
                    }
                    resolve();
                });
            }),
    };
}

/**
 * Connect to a local address (`isLocalAddress`), giving up after `timeoutMs`. Rejects when
 * nothing listens there.
 */
export async function connectLocal(
    address: string,
    timeoutMs: number,
    maxMessageBytes = 256 * 1024 * 1024,
): Promise<LocalConnection> {
    refuseAddress(address);
    return new Promise<LocalConnection>((resolve, reject) => {
        const socket = connect({ path: address });
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('the connection took too long'));
        }, timeoutMs);
        socket.once('error', (error) => {
            clearTimeout(timer);
            socket.destroy();
            reject(error);
        });
        socket.once('connect', () => {
            clearTimeout(timer);
            socket.removeAllListeners('error');
            resolve(new LineConnection(socket, maxMessageBytes));
        });
    });
}
