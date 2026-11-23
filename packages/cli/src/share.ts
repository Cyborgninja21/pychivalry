/**
 * The command line and the base game another program lends (docs/shared-index.md).
 *
 * - **Asking (`runShared`).** A command that reads the base game (`check`, `lookup`, unless
 *   `--no-vanilla`) is first sent, whole, to the program that lends the base game of the
 *   command line's spec package, when there is one: its arguments, its working folder, the few
 *   variables of its environment it reads (`SHARED_ENVIRONMENT`), its home and its spec folder.
 *   That program runs this same command line and sends back what it printed and its exit code,
 *   which are printed here as they came. When no program answers, or it refuses or fails, the
 *   command runs here, as it always has; nothing was printed before, so nothing is printed
 *   twice.
 * - **Answering (`serveCliSteps`).** The program that lends the base game runs the command
 *   line's own `runSteps` for the request, with the base game lent (`Io.base`), its own spec
 *   package when the request's is the same one, and the request's folder and environment.
 */

import {
    askHost,
    BaseRefused,
    findGameFolders,
    sharedEnvironment,
    sharingOff,
    specChecksumIn,
    type AskOptions,
    type HostReply,
    type HostRequest,
    type SharedBase,
    type Spec,
    type Steps,
} from '@pychivalry/core';
import type { Io } from './io.js';
import { run, runSteps } from './run.js';
import { version } from './version.js';

/** What the command line sends to the program that lends the base game. */
export interface CliRequest extends HostRequest {
    readonly kind: 'cli';
    /** The command line's version: a program of another version refuses it. */
    readonly version: string;
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
    readonly home: string;
    readonly specDir: string;
}

/** What comes back: what the command printed and its exit code. */
export interface CliAnswer {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

/** True when the command reads the base game, so another program's copy could answer it. */
export function readsBaseGame(argv: readonly string[]): boolean {
    const [name, ...rest] = argv;
    return (
        (name === 'check' || name === 'lookup') &&
        !rest.includes('--no-vanilla') &&
        !rest.includes('--help') &&
        !rest.includes('-h')
    );
}

function isCliAnswer(value: unknown): value is CliAnswer {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (
        typeof v['code'] === 'number' &&
        typeof v['stdout'] === 'string' &&
        typeof v['stderr'] === 'string'
    );
}

/** How a request is sent: `askHost` by default; a test may give its own. */
export type Ask = (
    specSha256: string,
    request: HostRequest,
    options: AskOptions,
) => Promise<HostReply>;

/**
 * Run the command line on `argv`: by the program that lends the base game when one answers,
 * otherwise here. Returns the exit code.
 */
export async function runShared(
    argv: readonly string[],
    io: Io,
    ask: Ask = askHost,
): Promise<number> {
    if (readsBaseGame(argv) && !sharingOff(io.env)) {
        let specSha256: string | null = null;
        try {
            specSha256 = specChecksumIn(io.specDir);
        } catch {
            // No readable spec package beside the command line: run it here, which says so.
        }
        if (specSha256 !== null) {
            const request: CliRequest = {
                kind: 'cli',
                version,
                argv: [...argv],
                cwd: io.cwd,
                env: sharedEnvironment(io.env),
                home: io.home,
                specDir: io.specDir,
            };
            const reply = await ask(specSha256, request, {
                env: io.env,
                platform: io.platform,
                home: io.home,
            });
            if (reply.answered && isCliAnswer(reply.answer)) {
                io.stdout(reply.answer.stdout);
                io.stderr(reply.answer.stderr);
                return reply.answer.code;
            }
        }
    }
    return run(argv, io);
}

function isCliRequest(value: HostRequest): value is CliRequest {
    const v = value as Partial<CliRequest>;
    return (
        v.kind === 'cli' &&
        typeof v.version === 'string' &&
        Array.isArray(v.argv) &&
        v.argv.every((a) => typeof a === 'string') &&
        typeof v.cwd === 'string' &&
        typeof v.home === 'string' &&
        typeof v.specDir === 'string' &&
        typeof v.env === 'object' &&
        Object.values(v.env).every((e) => typeof e === 'string')
    );
}

/** What the program that answers for the command line lends it. */
export interface CliHost {
    /** Its spec package: used when the request's is the same one. */
    readonly spec: Spec;
    readonly base: SharedBase;
}

/**
 * Answer a command line's request (`runShared`) with the base game lent: `BaseRefused` when it
 * is not one, is of another version, or asks for another spec package or base game.
 */
export function* serveCliSteps(request: HostRequest, host: CliHost): Steps<CliAnswer> {
    if (!isCliRequest(request)) {
        throw new BaseRefused('not a command line request');
    }
    if (request.version !== version) {
        throw new BaseRefused(`another version of the command line (${request.version})`);
    }
    let stdout = '';
    let stderr = '';
    const env = request.env;
    const platform = process.platform;
    const io: Io = {
        stdout: (text) => {
            stdout += text;
        },
        stderr: (text) => {
            stderr += text;
        },
        cwd: request.cwd,
        env,
        platform,
        home: request.home,
        specDir: request.specDir,
        findGame: (gameId) =>
            findGameFolders(gameId, { env, platform, home: request.home })[0] ?? null,
        base: host.base,
        openSpec: (dir) => {
            if (specChecksumIn(dir) !== host.spec.sha256) {
                throw new BaseRefused('another spec package');
            }
            return host.spec;
        },
    };
    const code = yield* runSteps(request.argv, io);
    return { code, stdout, stderr };
}
