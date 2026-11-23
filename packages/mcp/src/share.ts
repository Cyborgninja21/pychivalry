/**
 * The agent server and the base game another program lends (docs/shared-index.md).
 *
 * - **Asking (`askForTool`).** Before a tool runs here, it is sent to the program that lends the
 *   base game of the server's spec package, when there is one: the tool, its arguments (already
 *   checked against its shape), the mod folder and the game folder the server was started with,
 *   and a session number of this process, under which that program keeps the server's mod
 *   between calls as this one would. Its answer is the tool's result, the same object this
 *   server would make. When no program answers, or it refuses or fails, the tool runs here; and
 *   while the other program answers, this server lets go of any base game it had loaded.
 * - **Answering (`McpHost`).** The program that lends the base game keeps a session per asking
 *   server, over a fork of the base game, and answers each call with the tool's own steps.
 */

import {
    askHost,
    BaseRefused,
    randomHex,
    sharingOff,
    type AskOptions,
    type HostReply,
    type HostRequest,
    type SharedBase,
    type Spec,
    type Steps,
} from '@pychivalry/core';
import { answerSteps, TOOLS } from './hosted.js';
import type { CallToolResult } from './result.js';
import { Session, type GameChoice } from './session.js';
import { VERSION } from './version.js';

/** What the agent server sends to the program that lends the base game. */
export interface McpRequest extends HostRequest {
    readonly kind: 'mcp';
    /** The agent server's version: a program of another version refuses it. */
    readonly version: string;
    /** The asking process's session: one per process. */
    readonly session: string;
    readonly pid: number;
    readonly specSha256: string;
    readonly modDir: string;
    readonly game: GameChoice;
    readonly tool: string;
    readonly args: Record<string, unknown>;
}

/** This process's session number, the same for every call it sends. */
const SESSION = randomHex();

/** How a request is sent: `askHost` by default; a test may give its own. */
export type Ask = (
    specSha256: string,
    request: HostRequest,
    options: AskOptions,
) => Promise<HostReply>;

function isCallToolResult(value: unknown): value is CallToolResult {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as { content?: unknown }).content)
    );
}

/**
 * The answer of the program that lends the base game to a call of `tool`, or null when there
 * is none to ask, or it does not answer: the tool then runs here.
 */
export async function askForTool(
    session: Session,
    tool: string,
    args: Record<string, unknown>,
    ask: Ask = askHost,
): Promise<CallToolResult | null> {
    const place = session.place;
    if (place === undefined || session.game.dir === null || sharingOff(place.env)) {
        return null;
    }
    const request: McpRequest = {
        kind: 'mcp',
        version: VERSION,
        session: SESSION,
        pid: process.pid,
        specSha256: session.spec.sha256,
        modDir: session.modDir,
        game: session.game,
        tool,
        args,
    };
    const reply = await ask(session.spec.sha256, request, place);
    if (!reply.answered || !isCallToolResult(reply.answer)) {
        return null;
    }
    if (session.holdsIndex) {
        session.release();
    }
    return reply.answer;
}

function isMcpRequest(value: HostRequest): value is McpRequest {
    const v = value as Partial<McpRequest>;
    const game = v.game as Partial<GameChoice> | undefined;
    return (
        v.kind === 'mcp' &&
        typeof v.version === 'string' &&
        typeof v.session === 'string' &&
        typeof v.pid === 'number' &&
        typeof v.specSha256 === 'string' &&
        typeof v.modDir === 'string' &&
        typeof v.tool === 'string' &&
        typeof v.args === 'object' &&
        typeof game === 'object' &&
        (game.dir === null || typeof game.dir === 'string')
    );
}

/** How long a session no call has used is kept, in milliseconds. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** True while the process `pid` runs. */
function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

/** What the program that answers for agent servers lends them. */
export interface McpLender {
    /** Its spec package: a request of another is refused. */
    readonly spec: Spec;
    readonly base: SharedBase;
    readonly cacheDir: string | null;
}

/**
 * The agent servers' sessions a lending program keeps: one per asking process and mod, each
 * over a fork of the base game, dropped when its process is gone or it is unused for
 * `SESSION_IDLE_MS`.
 */
export class McpHost {
    private readonly sessions = new Map<
        string,
        { readonly session: Session; readonly pid: number; used: number }
    >();

    constructor(private readonly lender: McpLender) {}

    /** The sessions kept. */
    get size(): number {
        return this.sessions.size;
    }

    /** Drop the sessions whose process is gone or that no call used for a while. */
    prune(now = Date.now()): void {
        for (const [key, entry] of this.sessions) {
            if (now - entry.used > SESSION_IDLE_MS || !alive(entry.pid)) {
                this.sessions.delete(key);
            }
        }
    }

    /**
     * Answer an agent server's call (`askForTool`) with the base game lent: `BaseRefused` when it
     * is not one, is of another version, or asks for another spec package or base game.
     */
    *serveSteps(request: HostRequest): Steps<CallToolResult> {
        if (!isMcpRequest(request)) {
            throw new BaseRefused('not an agent server request');
        }
        if (request.version !== VERSION) {
            throw new BaseRefused(`another version of the agent server (${request.version})`);
        }
        if (request.specSha256 !== this.lender.spec.sha256) {
            throw new BaseRefused('another spec package');
        }
        const tool = TOOLS.find((t) => t.name === request.tool);
        if (tool === undefined) {
            throw new BaseRefused(`no tool ${request.tool}`);
        }
        this.prune();
        const key = JSON.stringify([request.session, request.pid, request.modDir, request.game]);
        let entry = this.sessions.get(key);
        if (entry === undefined) {
            entry = {
                session: new Session({
                    spec: this.lender.spec,
                    modDir: request.modDir,
                    game: request.game,
                    cacheDir: this.lender.cacheDir,
                    base: this.lender.base,
                }),
                pid: request.pid,
                used: Date.now(),
            };
            this.sessions.set(key, entry);
        }
        entry.used = Date.now();
        try {
            return yield* answerSteps(tool, request.args, entry.session);
        } catch (err) {
            if (err instanceof BaseRefused) {
                this.sessions.delete(key);
            }
            throw err;
        }
    }
}
