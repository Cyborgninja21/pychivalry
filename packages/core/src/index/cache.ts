/**
 * The on-disk cache of the base game's index (docs/PLAN.md item 3.8; docs/MVP.md, "Speed").
 *
 * - **Where:** in the user's cache folder, never in a mod or the repository:
 *   `%LOCALAPPDATA%\pychivalry\Cache\index` on Windows, `$XDG_CACHE_HOME/pychivalry/index`
 *   (by default `~/.cache/pychivalry/index`) on Linux. A caller, and every test, may name
 *   another folder.
 * - **Key:** the cache's own format number, the spec package's checksum, the rules table's
 *   digest, the platform, the game's build, the manifest of the files the index reads and the
 *   fallback encoding they were decoded with. A
 *   cache whose key differs from the one asked for is not used: changing the spec, the rules,
 *   the game or the format forces a rebuild.
 * - **Written atomically:** to a temporary file in the same folder, then renamed over the old
 *   one, so a reader sees the old cache or the new one, never half of one.
 * - **Format:** a short header, then the index's strings and integer arrays as they are held
 *   in memory, little-endian, so that loading is reading one file.
 */

import { randomBytes } from 'node:crypto';
import {
    closeSync,
    existsSync,
    fsyncSync,
    mkdirSync,
    openSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    writeSync,
} from 'node:fs';
import { endianness, homedir } from 'node:os';
import path from 'node:path';
import { WorkspaceIndex, type IndexOptions, type IndexState } from './workspace.js';

/** The cache's format. A change to the layout raises it, and every older cache is rebuilt. */
export const CACHE_FORMAT = 4;

/** What a cache was built from. Two equal keys mean the cache answers for the same input. */
export interface CacheKey {
    readonly format: number;
    readonly spec_sha256: string;
    readonly rules_sha256: string;
    readonly platform: string;
    readonly game_build: string | null;
    readonly manifest_sha256: string;
    /** The fallback encoding files that are not valid UTF-8 were read with, or null. */
    readonly fallback_encoding: string | null;
}

const MAGIC = 'PYCHIDX\n';

function keysEqual(a: CacheKey, b: CacheKey): boolean {
    return (
        a.format === b.format &&
        a.spec_sha256 === b.spec_sha256 &&
        a.rules_sha256 === b.rules_sha256 &&
        a.platform === b.platform &&
        a.game_build === b.game_build &&
        a.manifest_sha256 === b.manifest_sha256 &&
        a.fallback_encoding === b.fallback_encoding
    );
}

/** The user's cache folder for the index, per platform. */
export function defaultCacheDir(
    env: Readonly<Record<string, string | undefined>> = process.env,
    platform: NodeJS.Platform = process.platform,
    home: string = homedir(),
): string {
    if (platform === 'win32') {
        const local = env['LOCALAPPDATA'];
        const base =
            local !== undefined && local !== '' ? local : path.win32.join(home, 'AppData', 'Local');
        return path.win32.join(base, 'pychivalry', 'Cache', 'index');
    }
    if (platform === 'darwin') {
        return path.posix.join(home, 'Library', 'Caches', 'pychivalry', 'index');
    }
    const xdg = env['XDG_CACHE_HOME'];
    const base =
        xdg !== undefined && path.posix.isAbsolute(xdg) ? xdg : path.posix.join(home, '.cache');
    return path.posix.join(base, 'pychivalry', 'index');
}

/** The file name of a cache: one per game build, platform and key, so several can coexist. */
export function cacheFileName(key: CacheKey): string {
    const build = key.game_build ?? 'unknown';
    const tag = `${key.spec_sha256.slice(0, 8)}${key.rules_sha256.slice(0, 8)}`;
    return `base-game-${build}-${key.platform}-${tag}.idx`;
}

interface Header {
    readonly key: CacheKey;
    readonly strings: number;
    readonly stringBytes: number;
    readonly replacePaths: readonly string[];
    readonly files: readonly {
        readonly layer: string;
        readonly path: string;
        readonly kind: 'script' | 'localization';
        readonly folder: string | null;
        readonly exactCase: boolean;
        readonly noDefinitions: string | null;
        readonly lengths: readonly [number, number, number, number, number, number, number];
    }[];
}

function pad4(n: number): number {
    return (4 - (n % 4)) % 4;
}

/**
 * Write an index to `file` atomically, under `key`. Returns the bytes written. Throws when the
 * host is not little-endian or a name holds a NUL character, which the format cannot store.
 */
export function saveIndex(index: WorkspaceIndex, file: string, key: CacheKey): number {
    if (endianness() !== 'LE') {
        throw new Error('the index cache is written on little-endian hosts only');
    }
    const state = index.state();
    if (state.strings.some((s) => s.includes('\u0000'))) {
        throw new Error('a name holds a NUL character; the index cannot be cached');
    }
    const strings = Buffer.from(state.strings.join('\u0000'), 'utf8');
    const header: Header = {
        key,
        strings: state.strings.length,
        stringBytes: strings.length,
        replacePaths: state.replacePaths,
        files: state.files.map((f) => ({
            layer: f.layer,
            path: f.path,
            kind: f.kind,
            folder: f.folder,
            exactCase: f.exactCase,
            noDefinitions: f.noDefinitions,
            lengths: [
                f.lineStarts.length,
                f.defs.length,
                f.uses.length,
                f.names.length,
                f.saves.length,
                f.reads.length,
                f.templates.length,
            ],
        })),
    };
    const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
    const prelude = Buffer.alloc(16);
    prelude.write(MAGIC, 0, 'ascii');
    prelude.writeUInt32LE(CACHE_FORMAT, 8);
    prelude.writeUInt32LE(headerBytes.length, 12);
    mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`;
    const fd = openSync(temp, 'w');
    let written = 0;
    const write = (bytes: Uint8Array): void => {
        let at = 0;
        while (at < bytes.length) {
            at += writeSync(fd, bytes, at, bytes.length - at);
        }
        written += bytes.length;
    };
    const zeros = Buffer.alloc(4);
    try {
        write(prelude);
        write(headerBytes);
        write(zeros.subarray(0, pad4(written)));
        write(strings);
        write(zeros.subarray(0, pad4(written)));
        for (const f of state.files) {
            const arrays = [f.lineStarts, f.defs, f.uses, f.names, f.saves, f.reads, f.templates];
            for (const array of arrays) {
                write(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
            }
        }
        fsyncSync(fd);
        closeSync(fd);
        renameSync(temp, file);
    } catch (err) {
        try {
            closeSync(fd);
        } catch {
            // Already closed.
        }
        rmSync(temp, { force: true });
        throw err;
    }
    return written;
}

/** Why a cache was not used. */
export type CacheMiss = 'absent' | 'not-a-cache' | 'format' | 'key' | 'corrupt' | 'endianness';

/**
 * Read an index from `file` if it was written under `key`; otherwise say why not. The rules,
 * folders and platform come from `options` and must be the ones the key names.
 */
export function loadIndex(
    file: string,
    key: CacheKey,
    options: IndexOptions,
): { index: WorkspaceIndex } | { miss: CacheMiss } {
    if (!existsSync(file) || !statSync(file).isFile()) {
        return { miss: 'absent' };
    }
    if (endianness() !== 'LE') {
        return { miss: 'endianness' };
    }
    const bytes = readFileSync(file);
    if (bytes.length < 16 || bytes.toString('ascii', 0, 8) !== MAGIC) {
        return { miss: 'not-a-cache' };
    }
    if (bytes.readUInt32LE(8) !== CACHE_FORMAT) {
        return { miss: 'format' };
    }
    try {
        const headerLength = bytes.readUInt32LE(12);
        const header = JSON.parse(bytes.toString('utf8', 16, 16 + headerLength)) as Header;
        if (!keysEqual(header.key, key)) {
            return { miss: 'key' };
        }
        let at = 16 + headerLength;
        at += pad4(at);
        const strings =
            header.strings === 0
                ? []
                : bytes.toString('utf8', at, at + header.stringBytes).split('\u0000');
        if (strings.length !== header.strings) {
            return { miss: 'corrupt' };
        }
        at += header.stringBytes;
        at += pad4(at);
        // The arrays are views of the file's bytes when they are aligned, as a large read is.
        const aligned = bytes.byteOffset % 4 === 0;
        const buffer = aligned ? bytes.buffer : new Uint8Array(bytes).buffer;
        const base = aligned ? bytes.byteOffset : 0;
        const take = (length: number): Int32Array => {
            if (at + length * 4 > bytes.length) {
                throw new RangeError('the cache ends early');
            }
            const array = new Int32Array(buffer, base + at, length);
            at += length * 4;
            return array;
        };
        const state: IndexState = {
            strings,
            replacePaths: header.replacePaths,
            files: header.files.map((f) => ({
                layer: f.layer,
                path: f.path,
                kind: f.kind,
                folder: f.folder,
                exactCase: f.exactCase,
                noDefinitions: f.noDefinitions,
                lineStarts: take(f.lengths[0]),
                defs: take(f.lengths[1]),
                uses: take(f.lengths[2]),
                names: take(f.lengths[3]),
                saves: take(f.lengths[4]),
                reads: take(f.lengths[5]),
                templates: take(f.lengths[6]),
            })),
        };
        if (at !== bytes.length) {
            return { miss: 'corrupt' };
        }
        return { index: WorkspaceIndex.fromState(state, options) };
    } catch {
        return { miss: 'corrupt' };
    }
}
