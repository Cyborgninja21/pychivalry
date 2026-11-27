/**
 * One capture of the game's logs (docs/PLAN.md item 11.1; the procedure,
 * docs/game-log-capture.md), as the spec work's launches did it (`pdx-parser-re`,
 * `research/oracle/1.21.0.3/README.md`), adapted to a mod list: prepared, never run without the
 * owner's word (`guard.ts`, checked first).
 *
 * 1. The guard: no owner's word recorded for a launch by the command that starts it
 *    (`game:capture-log`, or `scored:in-game-load` for its two captures), no launch, and nothing is
 *    touched.
 * 2. The mod list: `dlc_load.json` in the user's game folder is backed up byte for byte, with its
 *    time; each mod of the capture gets a descriptor of its own in the user's `mod/` folder
 *    (`pychivalry_capture_<n>.mod`, its `path` the mod's folder), refused when one of that name
 *    is already there; `enabled_mods` is set to those descriptors, its other keys kept.
 * 3. The launch: the game's executable started directly, with the options given (no launcher).
 * 4. The main menu is taken as reached when the logs go quiet: none of them changes for
 *    `quietSeconds` after the first change since the launch (30 s, as the spec work's 1.20.0.2
 *    launch measured it); the process ending by itself also ends the wait; past `timeoutSeconds`
 *    the capture stops and says so.
 * 5. The game is stopped, and every log it wrote or changed since the launch is copied out,
 *    each folder of this machine in it written as a placeholder (`scrub`), so that what is
 *    kept may be committed, with the count of each placeholder written.
 * 6. Always, whatever happened: the descriptors written are removed, `dlc_load.json` is written
 *    back byte for byte with its time, and its SHA-256 compared with the original's.
 * 7. A record of the capture: the game build, the executable's SHA-256, the options, the mods,
 *    how the wait ended, each log's size, SHA-256, lines and what was replaced in it, and the mod
 *    list restored. It holds no absolute path: the folders are written `<user dir>`, `<game dir>`
 *    and `<mod n>`.
 *
 * Nothing here is run by `task ci` but with a stand-in for the game (`capture.test.ts`).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { ownersWord, type LaunchCommand, type OwnersWord } from './guard.js';

/**
 * The record's format: 2 since each log kept lists what the scrubber replaced in it (decision
 * 202). No capture was made in format 1.
 */
export const CAPTURE_FORMAT = 2;

/** The descriptor name of the capture's `n`-th mod in the user's `mod/` folder. */
export function descriptorName(n: number): string {
    return `pychivalry_capture_${String(n)}.mod`;
}

/** What starts the game: its executable (or, for a test, the stand-in's program) and its arguments. */
export interface Start {
    readonly command: string;
    /** Arguments before the launch options: none for the game; the stand-in's script for a test. */
    readonly args: readonly string[];
}

export interface CaptureOptions {
    /** `PYCHIVALRY_OWNERS_WORD`, `decision <n>`: checked before anything else. */
    readonly ownersWord: string | undefined;
    /** The command this capture is started by, which that decision must name (decision 205). */
    readonly command: LaunchCommand;
    /** docs/decisions.md, where that decision is recorded. */
    readonly decisionsFile: string;
    /** The game's install folder, holding `launcher/` (for its build) and `binaries/`. */
    readonly installDir: string;
    readonly start: Start;
    /** The launch options, as given to the game (`-debug_mode`, ...). */
    readonly options: readonly string[];
    /** The user's game folder: `dlc_load.json`, `logs/` and `mod/`. */
    readonly userDir: string;
    /** The mods to load, in order: each a mod folder holding a `descriptor.mod`. */
    readonly mods: readonly string[];
    /** The home folder, written `<home>` in the logs kept. */
    readonly home?: string;
    /** Where the captured logs and the record are written: a new folder. */
    readonly outDir: string;
    /** The logs waited on for quiet. */
    readonly watched?: readonly string[];
    readonly quietSeconds?: number;
    readonly timeoutSeconds?: number;
    /** How often the logs are looked at, in milliseconds. */
    readonly pollMs?: number;
    readonly log?: (line: string) => void;
}

/** How the wait for the main menu ended. */
export type Ended = 'quiet' | 'exited' | 'timeout';

/** One log the capture holds. */
export interface CapturedLog {
    readonly name: string;
    /** Its size, SHA-256 and lines as kept, scrubbed. */
    readonly bytes: number;
    readonly sha256: string;
    readonly lines: number;
    /** What the scrubber wrote in it: each placeholder and how many times (`scrub`). */
    readonly replaced: Readonly<Record<string, number>>;
}

/** The record of one capture. */
export interface CaptureRecord {
    readonly capture_format: number;
    readonly owners_word: { readonly decision: number; readonly command: LaunchCommand };
    readonly started: string;
    readonly game: { readonly build: string | null; readonly executable_sha256: string };
    readonly options: readonly string[];
    readonly mods: readonly { readonly name: string; readonly descriptor: string }[];
    readonly ended: Ended;
    /** Seconds from the launch to the end of the wait. */
    readonly seconds: number;
    readonly exit_code: number | null;
    readonly logs: readonly CapturedLog[];
    readonly dlc_load: {
        readonly restored: boolean;
        readonly identical: boolean;
        readonly sha256: string;
    };
    readonly descriptors_removed: boolean;
}

/** A log as it is kept: its bytes scrubbed, and how many times each placeholder was written. */
export interface Scrub {
    readonly bytes: Buffer;
    /**
     * Each folder given (an empty one is not), by its placeholder, in the order given: how many
     * times it was found and written as the placeholder, 0 when never.
     */
    readonly replaced: Readonly<Record<string, number>>;
}

/**
 * A log's bytes with every folder of this machine written as a placeholder (the user's game
 * folder `<user dir>`, the install `<game dir>`, each mod `<mod n>`, the home folder `<home>`),
 * with either separator and in any letter case, and the count of each replacement, so that what
 * was taken out is on record (decision 202): what is kept of a log is what may be committed
 * (AGENTS.md: no home folder, no absolute path). Read as Latin-1, so every other byte is kept.
 */
export function scrub(bytes: Uint8Array, folders: readonly (readonly [string, string])[]): Scrub {
    let text = Buffer.from(bytes).toString('latin1');
    const replaced: Record<string, number> = {};
    for (const [dir, name] of folders) {
        if (dir !== '') {
            replaced[name] = 0;
        }
    }
    // The longest folder first, so a mod inside the user's folder is named as the mod.
    for (const [dir, name] of [...folders].sort((a, b) => b[0].length - a[0].length)) {
        if (dir === '') {
            continue;
        }
        for (const written of new Set([
            dir,
            dir.replaceAll('\\', '/'),
            dir.replaceAll('/', '\\'),
        ])) {
            const pattern = new RegExp(written.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            text = text.replace(pattern, () => {
                replaced[name] = (replaced[name] ?? 0) + 1;
                return name;
            });
        }
    }
    return { bytes: Buffer.from(text, 'latin1'), replaced };
}

/** A log's bytes scrubbed, as `scrub` writes them. */
export function scrubbed(
    bytes: Uint8Array,
    folders: readonly (readonly [string, string])[],
): Buffer {
    return scrub(bytes, folders).bytes;
}

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** The build the install's launcher names (`rawVersion`), or null. */
function buildOf(installDir: string): string | null {
    try {
        const settings = JSON.parse(
            readFileSync(
                path.join(installDir, 'launcher', 'launcher-settings.json'),
                'utf8',
            ).replace(/^\uFEFF/, ''),
        ) as { rawVersion?: unknown };
        return typeof settings.rawVersion === 'string' ? settings.rawVersion : null;
    } catch {
        return null;
    }
}

/** A mod's name, from its `descriptor.mod`. */
function modName(dir: string): string {
    const text = readFileSync(path.join(dir, 'descriptor.mod'), 'utf8');
    return /^\s*name\s*=\s*"([^"]*)"/m.exec(text)?.[1] ?? path.basename(dir);
}

/** Each log's size and time, by name. */
function snapshot(logs: string): Map<string, string> {
    const out = new Map<string, string>();
    if (!existsSync(logs)) {
        return out;
    }
    for (const name of readdirSync(logs)) {
        const s = statSync(path.join(logs, name));
        if (s.isFile()) {
            out.set(name, `${String(s.size)}:${String(s.mtimeMs)}`);
        }
    }
    return out;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One capture, as above; the record is also written to `<outDir>/capture.json`. */
export async function capture(options: CaptureOptions): Promise<CaptureRecord> {
    const word: OwnersWord = ownersWord(options.ownersWord, options.decisionsFile, options.command);
    const say = options.log ?? (() => undefined);
    const quietMs = (options.quietSeconds ?? 30) * 1000;
    const timeoutMs = (options.timeoutSeconds ?? 480) * 1000;
    const pollMs = options.pollMs ?? 1000;
    const watched = options.watched ?? ['error.log', 'debug.log', 'game.log'];
    const dlcLoad = path.join(options.userDir, 'dlc_load.json');
    const modFolder = path.join(options.userDir, 'mod');
    const logs = path.join(options.userDir, 'logs');
    if (!existsSync(options.start.command)) {
        throw new Error(`no such executable: ${options.start.command}`);
    }
    if (!existsSync(dlcLoad)) {
        throw new Error(
            `no dlc_load.json in the user's game folder: nothing to restore, so no launch`,
        );
    }
    if (existsSync(options.outDir) && readdirSync(options.outDir).length > 0) {
        throw new Error(`the capture folder is not empty: ${options.outDir}`);
    }
    for (const [n, dir] of options.mods.entries()) {
        if (!existsSync(path.join(dir, 'descriptor.mod'))) {
            throw new Error(`mod ${String(n)} has no descriptor.mod`);
        }
        if (existsSync(path.join(modFolder, descriptorName(n)))) {
            throw new Error(
                `the user's mod folder already holds ${descriptorName(n)}: not overwritten`,
            );
        }
    }
    mkdirSync(options.outDir, { recursive: true });
    const original = readFileSync(dlcLoad);
    const originalTime = statSync(dlcLoad);
    writeFileSync(path.join(options.outDir, 'dlc_load.json.backup'), original);
    const written: string[] = [];
    const running: { child: ChildProcess | null } = { child: null };
    let exitCode: number | null = null;
    let ended: Ended = 'timeout';
    let seconds = 0;
    const startedAt = new Date();
    const copied: CapturedLog[] = [];
    // What the capture did so far, kept in one place the callbacks and the clean-up share.
    const state = { exited: false, restored: false, identical: false, removed: false };
    try {
        mkdirSync(modFolder, { recursive: true });
        const descriptors = options.mods.map((dir, n) => {
            const file = path.join(modFolder, descriptorName(n));
            const name = modName(dir);
            writeFileSync(
                file,
                `version="1"\nname="${name}"\npath="${dir.replaceAll('\\', '/')}"\n`,
            );
            written.push(file);
            return { name, descriptor: `mod/${descriptorName(n)}` };
        });
        const list = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, '')) as Record<
            string,
            unknown
        >;
        writeFileSync(
            dlcLoad,
            JSON.stringify({ ...list, enabled_mods: descriptors.map((d) => d.descriptor) }),
        );
        const before = snapshot(logs);
        say(`launch: ${path.basename(options.start.command)} ${options.options.join(' ')}`);
        const launchedAt = Date.now();
        const child = spawn(options.start.command, [...options.start.args, ...options.options], {
            cwd: path.dirname(options.start.command),
            stdio: 'ignore',
            windowsHide: false,
        });
        running.child = child;
        child.on('exit', (code) => {
            state.exited = true;
            exitCode = code;
        });
        // The wait: quiet after the first change, the process gone, or the time up.
        let last = new Map(before);
        let changedAt: number | null = null;
        for (;;) {
            await wait(pollMs);
            const now = snapshot(logs);
            const changed = watched.some((name) => now.get(name) !== last.get(name));
            last = now;
            if (changed) {
                changedAt = Date.now();
            }
            if (state.exited) {
                ended = 'exited';
                break;
            }
            if (changedAt !== null && Date.now() - changedAt >= quietMs) {
                ended = 'quiet';
                break;
            }
            if (Date.now() - launchedAt >= timeoutMs) {
                ended = 'timeout';
                break;
            }
        }
        seconds = Math.round((Date.now() - launchedAt) / 1000);
        say(`wait ended: ${ended} after ${String(seconds)} s`);
        // The process ends while this waits: asked each time, not narrowed once.
        const gone = (): boolean => state.exited;
        if (!gone()) {
            child.kill();
            for (let i = 0; i < 100 && !gone(); i++) {
                await wait(100);
            }
            if (!gone()) {
                child.kill('SIGKILL');
            }
        }
        // Every log written or changed since the launch.
        const after = snapshot(logs);
        mkdirSync(path.join(options.outDir, 'logs'), { recursive: true });
        for (const [name, stamp] of [...after].sort(([a], [b]) => (a < b ? -1 : 1))) {
            if (before.get(name) === stamp) {
                continue;
            }
            const target = path.join(options.outDir, 'logs', name);
            const { bytes, replaced } = scrub(readFileSync(path.join(logs, name)), [
                [options.userDir, '<user dir>'],
                [options.installDir, '<game dir>'],
                ...options.mods.map((dir, n) => [dir, `<mod ${String(n)}>`] as const),
                [options.home ?? '', '<home>'],
            ]);
            writeFileSync(target, bytes);
            copied.push({
                name,
                bytes: bytes.length,
                sha256: sha256(bytes),
                lines:
                    bytes.length === 0
                        ? 0
                        : bytes.toString('latin1').split('\n').length -
                          (bytes[bytes.length - 1] === 0x0a ? 1 : 0),
                replaced,
            });
        }
        return finish();
    } finally {
        // A capture that failed part way still stops the game and puts the mod list back.
        if (running.child !== null && !state.exited) {
            running.child.kill('SIGKILL');
        }
        if (!state.restored) {
            restore();
        }
    }

    function restore(): void {
        for (const file of written) {
            rmSync(file, { force: true });
        }
        state.removed = written.every((f) => !existsSync(f));
        writeFileSync(dlcLoad, original);
        utimesSync(dlcLoad, originalTime.atime, originalTime.mtime);
        state.restored = true;
        state.identical = sha256(readFileSync(dlcLoad)) === sha256(original);
        say(
            `dlc_load.json restored: ${state.identical ? 'byte-identical to the original' : 'NOT identical'}`,
        );
    }

    function finish(): CaptureRecord {
        restore();
        const record: CaptureRecord = {
            capture_format: CAPTURE_FORMAT,
            owners_word: { decision: word.decision, command: word.command },
            started: startedAt.toISOString(),
            game: {
                build: buildOf(options.installDir),
                executable_sha256: sha256(readFileSync(options.start.command)),
            },
            options: [...options.options],
            mods: options.mods.map((dir, n) => ({
                name: modName(dir),
                descriptor: `mod/${descriptorName(n)}`,
            })),
            ended,
            seconds,
            exit_code: exitCode,
            logs: copied,
            dlc_load: {
                restored: state.restored,
                identical: state.identical,
                sha256: sha256(original),
            },
            descriptors_removed: state.removed,
        };
        writeFileSync(
            path.join(options.outDir, 'capture.json'),
            `${JSON.stringify(record, null, 4)}\n`,
        );
        return record;
    }
}
