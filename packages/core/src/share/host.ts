/**
 * One program lends its base game, the others ask it (docs/shared-index.md).
 *
 * - **Asking (`askHost`).** A program reads the address file of its spec package's base game; if
 *   there is one, it connects (at most `connectMs`), sends one request with the file's token and
 *   waits for the answer. The lending program says it is still working every `HEARTBEAT_MS`; a
 *   silence of `silenceMs`, a closed connection, a refusal or any error, and the answer is "not
 *   answered", with the reason: the program then does the work itself. Nothing here waits
 *   without a bound.
 * - **Lending (`IndexHost`).** A program that holds a base game writes the address file when no
 *   other program lends one for the same spec package (or the one that did is gone), listens on
 *   a fresh local address, and answers each request with `handle`, one at a time, in the order
 *   they came. It looks again every `CLAIM_MS`: it takes the address over when the lender is
 *   gone, and stops lending when another program holds it. "Gone" is a program that does not
 *   answer a probe with the address file's token within `PROBE_MS`.
 * - **Off:** `PYCHIVALRY_SHARED_INDEX=off` (`sharingOff`) and a program neither lends nor asks.
 */

import { timingSafeEqual } from 'node:crypto';
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import {
    addressFile,
    hostFolder,
    privateFolder,
    randomHex,
    readAddress,
    removeAddress,
    sharingOff,
    writeAddress,
    type AddressRecord,
} from './address.js';
import { BaseRefused } from './base.js';
import {
    connectLocal,
    isLocalAddress,
    listenLocal,
    localAddress,
    type LocalConnection,
    type LocalServer,
} from './channel.js';

/** The version of the messages: a request of another is refused. */
export const PROTOCOL = 1;

/** How often the lending program says it is still working on a request, in milliseconds. */
export const HEARTBEAT_MS = 500;

/** How long a program waits to connect, and for a word from the lender, by default. */
export const CONNECT_MS = 1_000;
export const SILENCE_MS = 10_000;

/** How often a lending program, or one that would lend, looks at the address file. */
export const CLAIM_MS = 5_000;

/**
 * How long a program that would lend waits for the program an address file names to say it
 * lends, before it takes the address over. A lender says so at once, whatever it is working on:
 * the probe is answered as it arrives, never queued behind a request.
 */
export const PROBE_MS = 2_000;

/** How old a socket file no lender holds must be before a new lender removes it. */
const STALE_SOCKET_MS = 60_000;

/** Where the address files are: the user's environment, system and home. */
export interface Place {
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly platform: NodeJS.Platform;
    readonly home: string;
}

/** What a program asks: its kind (`cli`, `mcp`) and what that kind needs. */
export interface HostRequest {
    readonly kind: string;
    readonly [field: string]: unknown;
}

/** The answer, or why there is none. */
export type HostReply =
    | { readonly answered: true; readonly answer: unknown }
    | { readonly answered: false; readonly reason: string };

export interface AskOptions extends Place {
    readonly connectMs?: number | undefined;
    readonly silenceMs?: number | undefined;
}

function notAnswered(reason: string): HostReply {
    return { answered: false, reason };
}

/** A message from the lender, as received. */
interface Reply {
    readonly t?: unknown;
    readonly answer?: unknown;
    readonly reason?: unknown;
    readonly message?: unknown;
}

/**
 * Ask the program that lends the base game of the spec package `specSha256` to answer
 * `request`; "not answered" (never thrown) when there is none, or it cannot.
 */
export async function askHost(
    specSha256: string,
    request: HostRequest,
    options: AskOptions,
): Promise<HostReply> {
    if (sharingOff(options.env)) {
        return notAnswered('sharing is off');
    }
    const folder = hostFolder(options.env, options.platform, options.home);
    if (!privateFolder(folder, false, options.platform)) {
        return notAnswered('no program lends a base game');
    }
    const record = readAddress(addressFile(folder, specSha256));
    if (record === null) {
        return notAnswered('no program lends this base game');
    }
    let connection: LocalConnection;
    try {
        connection = await connectLocal(record.address, options.connectMs ?? CONNECT_MS);
    } catch (err) {
        return notAnswered(
            `the lending program does not answer: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    return new Promise<HostReply>((resolve) => {
        const silenceMs = options.silenceMs ?? SILENCE_MS;
        let settled = false;
        const settle = (reply: HostReply): void => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                connection.close();
                resolve(reply);
            }
        };
        let timer = setTimeout(() => {
            settle(notAnswered('the lending program fell silent'));
        }, silenceMs);
        connection.onMessage((message) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                settle(notAnswered('the lending program fell silent'));
            }, silenceMs);
            const reply = (typeof message === 'object' && message !== null ? message : {}) as Reply;
            if (reply.t === 'answer') {
                settle({ answered: true, answer: reply.answer });
            } else if (reply.t === 'refused') {
                settle(notAnswered(`refused: ${String(reply.reason)}`));
            } else if (reply.t === 'failed') {
                settle(notAnswered(`failed: ${String(reply.message)}`));
            }
        });
        connection.onClose((error) => {
            settle(
                notAnswered(
                    error === null
                        ? 'the lending program closed the connection'
                        : `the connection failed: ${error.message}`,
                ),
            );
        });
        connection.send({ v: PROTOCOL, token: record.token, request });
    });
}

/** What a lending program has done, for a status report and the tests. */
export interface HostStatus {
    /** True while it holds the address and listens. */
    readonly lending: boolean;
    /** Requests answered, by kind. */
    readonly answered: Readonly<Record<string, number>>;
    /** Requests refused (`BaseRefused`, a wrong token or version) and failed. */
    readonly refused: number;
    readonly failed: number;
}

export interface HostOptions extends Place {
    /** The checksum of the spec package the base game was read with. */
    readonly specSha256: string;
    /**
     * Answer one request: throw `BaseRefused` when the base game cannot stand for the one it
     * asks for; any other error is a failure. The asking program then works alone either way.
     */
    readonly handle: (request: HostRequest) => Promise<unknown>;
    /** Where to say what happens (a server's log); nothing is said without it. */
    readonly log?: ((text: string) => void) | undefined;
    /**
     * For the tests: how often to look at the address file, to say it is working, and how long
     * to wait for another program to say it lends (`PROBE_MS`).
     */
    readonly claimMs?: number | undefined;
    readonly heartbeatMs?: number | undefined;
    readonly probeMs?: number | undefined;
}

function sameToken(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

/** A program lending its base game, or waiting to. */
export class IndexHost {
    private readonly options: HostOptions;
    private readonly folder: string;
    private readonly file: string | null;
    private readonly token = randomHex();
    private server: LocalServer | null = null;
    private record: AddressRecord | null = null;
    private timer: NodeJS.Timeout | null = null;
    private stopped = false;
    private claiming = false;
    private queue: Promise<void> = Promise.resolve();
    private readonly answered: Record<string, number> = {};
    private refused = 0;
    private failed = 0;

    private constructor(options: HostOptions) {
        this.options = options;
        const folder = hostFolder(options.env, options.platform, options.home);
        this.folder = folder;
        this.file =
            sharingOff(options.env) || !privateFolder(folder, true, options.platform)
                ? null
                : addressFile(folder, options.specSha256);
    }

    /**
     * Lend the base game when no other program does, and keep looking every `CLAIM_MS` to take
     * the address over when the one that holds it is gone. Resolves once the first look is done.
     */
    static async start(options: HostOptions): Promise<IndexHost> {
        const host = new IndexHost(options);
        if (host.file !== null) {
            await host.claim();
            host.timer = setInterval(() => {
                void host.claim();
            }, options.claimMs ?? CLAIM_MS);
            host.timer.unref();
        } else {
            options.log?.('pychivalry: sharing the base game is off');
        }
        return host;
    }

    /** Read after an await: `stop` may have run meanwhile. */
    private isStopped(): boolean {
        return this.stopped;
    }

    get lending(): boolean {
        return this.server !== null;
    }

    status(): HostStatus {
        return {
            lending: this.lending,
            answered: { ...this.answered },
            refused: this.refused,
            failed: this.failed,
        };
    }

    /**
     * A fresh local address: a socket file in the address files' folder, or, when its path
     * would be too long to bind, in the user's runtime folder (`XDG_RUNTIME_DIR`); on Windows a
     * pipe with a random name.
     */
    private newAddress(): string {
        const random = randomHex();
        const platform = this.options.platform;
        const here = localAddress(this.folder, random, platform);
        if (platform === 'win32' || isLocalAddress(here, platform)) {
            return here;
        }
        const runtime = this.options.env['XDG_RUNTIME_DIR'];
        if (runtime !== undefined && path.isAbsolute(runtime)) {
            const folder = path.join(runtime, 'pychivalry');
            if (privateFolder(folder, true, platform)) {
                return localAddress(folder, random, platform);
            }
        }
        return here;
    }

    /**
     * True when another program lends on the address the file names: it answers a probe with the
     * file's token (`PROBE_MS`). A connection alone is no proof: a program being killed can
     * still take one on an address it held (on Windows, another instance of its named pipe that
     * the system has not closed yet; the flaky test of #156 and #157, "a lender that dies in the
     * middle of a request takes nothing with it"), and one that takes a connection and never
     * answers lends nothing either way.
     */
    private async otherLender(record: AddressRecord): Promise<boolean> {
        if (record.token === this.token) {
            return false;
        }
        let connection: LocalConnection;
        try {
            connection = await connectLocal(record.address, CONNECT_MS);
        } catch {
            return false;
        }
        return new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (lends: boolean): void => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    connection.close();
                    resolve(lends);
                }
            };
            const timer = setTimeout(() => {
                settle(false);
            }, this.options.probeMs ?? PROBE_MS);
            // Any word from it is an answer: "lending", or a refusal from a program of another
            // protocol, which is alive and holds the address all the same.
            connection.onMessage(() => {
                settle(true);
            });
            connection.onClose(() => {
                settle(false);
            });
            connection.send({ v: PROTOCOL, token: record.token, probe: true });
        });
    }

    private async claim(): Promise<void> {
        if (this.file === null || this.stopped || this.claiming) {
            return;
        }
        this.claiming = true;
        try {
            const held = readAddress(this.file);
            if (this.server !== null) {
                if (held?.token !== this.token) {
                    // Another program took the address: it lends now, not this one.
                    this.options.log?.('pychivalry: another program lends the base game now');
                    await this.unlisten();
                }
                return;
            }
            if (held !== null && (await this.otherLender(held))) {
                return;
            }
            const address = this.newAddress();
            const server = await listenLocal(address, (connection) => {
                this.accept(connection);
            });
            if (this.isStopped()) {
                await server.close();
                return;
            }
            const record: AddressRecord = {
                format: 1,
                pid: process.pid,
                address,
                token: this.token,
                started: new Date().toISOString(),
            };
            writeAddress(this.file, record);
            if (readAddress(this.file)?.token !== this.token) {
                await server.close();
                return;
            }
            this.server = server;
            this.record = record;
            this.options.log?.(`pychivalry: lending the base game at ${address}`);
            this.removeStaleSockets(address);
        } catch (err) {
            this.options.log?.(
                `pychivalry: cannot lend the base game: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            this.claiming = false;
        }
    }

    /**
     * Remove the socket files a program that lent before and stopped without closing left in
     * the folder (POSIX): any but `mine` older than `STALE_SOCKET_MS`. Only the lender that
     * holds the address listens there for longer; a program that lost it closes its own.
     */
    private removeStaleSockets(mine: string): void {
        if (this.options.platform === 'win32') {
            return;
        }
        try {
            for (const name of readdirSync(this.folder)) {
                const file = path.join(this.folder, name);
                if (
                    file !== mine &&
                    isLocalAddress(file, this.options.platform) &&
                    Date.now() - statSync(file).mtimeMs > STALE_SOCKET_MS
                ) {
                    rmSync(file, { force: true });
                }
            }
        } catch {
            // Nothing to tidy, or not now.
        }
    }

    private async unlisten(): Promise<void> {
        const server = this.server;
        this.server = null;
        if (this.file !== null && this.record !== null) {
            removeAddress(this.file, this.record.token);
        }
        this.record = null;
        await server?.close();
    }

    /** One connection: one request, answered in turn. */
    private accept(connection: LocalConnection): void {
        let gone = false;
        let heartbeat: NodeJS.Timeout | null = null;
        connection.onClose(() => {
            gone = true;
            if (heartbeat !== null) {
                clearInterval(heartbeat);
            }
        });
        connection.onMessage((message) => {
            const envelope = (typeof message === 'object' && message !== null ? message : {}) as {
                v?: unknown;
                token?: unknown;
                request?: unknown;
                probe?: unknown;
            };
            if (typeof envelope.token !== 'string' || !sameToken(envelope.token, this.token)) {
                this.refused++;
                connection.send({ t: 'refused', reason: 'a wrong token' });
                connection.close();
                return;
            }
            if (envelope.v !== PROTOCOL) {
                this.refused++;
                connection.send({
                    t: 'refused',
                    reason: `another protocol (${String(envelope.v)})`,
                });
                connection.close();
                return;
            }
            if (envelope.probe === true) {
                // Another program asks whether this one lends: it does, whatever it is working
                // on. Not a request: nothing is counted.
                connection.send({ t: 'lending' });
                connection.close();
                return;
            }
            const request = envelope.request as HostRequest | undefined;
            if (typeof request !== 'object' || typeof request.kind !== 'string') {
                this.refused++;
                connection.send({ t: 'refused', reason: 'no request' });
                connection.close();
                return;
            }
            connection.send({ t: 'working' });
            const beat = setInterval(() => {
                connection.send({ t: 'working' });
            }, this.options.heartbeatMs ?? HEARTBEAT_MS);
            beat.unref();
            heartbeat = beat;
            this.queue = this.queue.then(async () => {
                try {
                    if (gone) {
                        return;
                    }
                    const answer = await this.options.handle(request);
                    this.answered[request.kind] = (this.answered[request.kind] ?? 0) + 1;
                    connection.send({ t: 'answer', answer });
                } catch (err) {
                    if (err instanceof BaseRefused) {
                        this.refused++;
                        connection.send({ t: 'refused', reason: err.message });
                    } else {
                        this.failed++;
                        const text = err instanceof Error ? err.message : String(err);
                        this.options.log?.(`pychivalry: a ${request.kind} request failed: ${text}`);
                        connection.send({ t: 'failed', message: text });
                    }
                } finally {
                    clearInterval(beat);
                    connection.close();
                }
            });
        });
    }

    /** Stop lending: the address file is removed if it is still this program's. */
    async stop(): Promise<void> {
        this.stopped = true;
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.unlisten();
    }
}
