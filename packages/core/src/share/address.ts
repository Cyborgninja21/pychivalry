/**
 * Where programs find the one that lends its base game (docs/shared-index.md): an address file
 * in the user's own cache folder, `<cache>/pychivalry/host/` (`hostFolder`), owner-only, named by
 * the spec package's checksum. It holds the channel's local address, a random token every request
 * must carry, and the lending program's process number. Only the user can read it, so only the
 * user's own programs know where to connect and what to send.
 */

import { randomBytes } from 'node:crypto';
import {
    chmodSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { defaultCacheDir } from '../index/cache.js';
import { isLocalAddress } from './channel.js';

/** The environment variable that turns sharing off: `PYCHIVALRY_SHARED_INDEX=off`. */
export const SHARING_VARIABLE = 'PYCHIVALRY_SHARED_INDEX';

/** True when the environment turns sharing off: the program neither lends nor asks. */
export function sharingOff(env: Readonly<Record<string, string | undefined>>): boolean {
    return (env[SHARING_VARIABLE] ?? '').trim().toLowerCase() === 'off';
}

/**
 * The variables of its environment the command line reads, sent with its request so that the
 * program that answers it reads the same: where Steam is (`find-game.ts`) and the cache folder
 * (`defaultCacheDir`). No other variable leaves the program.
 */
export const SHARED_ENVIRONMENT: readonly string[] = [
    'ProgramFiles(x86)',
    'ProgramFiles',
    'XDG_DATA_HOME',
    'XDG_CACHE_HOME',
    'LOCALAPPDATA',
];

/** The variables of `env` named in `SHARED_ENVIRONMENT`, those that are set. */
export function sharedEnvironment(
    env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of SHARED_ENVIRONMENT) {
        const value = env[name];
        if (value !== undefined) {
            out[name] = value;
        }
    }
    return out;
}

/** The folder of the address files, beside the index cache: `<cache>/pychivalry/host`. */
export function hostFolder(
    env: Readonly<Record<string, string | undefined>> = process.env,
    platform: NodeJS.Platform = process.platform,
    home: string = homedir(),
): string {
    const flavour = platform === 'win32' ? path.win32 : path.posix;
    return flavour.join(flavour.dirname(defaultCacheDir(env, platform, home)), 'host');
}

/**
 * Make `folder` if it is missing, owner-only, and say whether it is the user's own and no one
 * else's: on POSIX a real folder (not a link), owned by this user, with no permission for its
 * group or others (they are taken away if it has them). On Windows the user's local application
 * data folder is the user's own already. False means: do not use it.
 */
export function privateFolder(
    folder: string,
    create: boolean,
    platform: NodeJS.Platform = process.platform,
): boolean {
    try {
        if (!existsSync(folder)) {
            if (!create) {
                return false;
            }
            mkdirSync(folder, { recursive: true, mode: 0o700 });
        }
        const stat = lstatSync(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
            return false;
        }
        if (platform === 'win32') {
            return true;
        }
        if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
            return false;
        }
        if ((stat.mode & 0o077) !== 0) {
            chmodSync(folder, 0o700);
            return (lstatSync(folder).mode & 0o077) === 0;
        }
        return true;
    } catch {
        return false;
    }
}

/** The address file for a spec package's base game, in `folder`. */
export function addressFile(folder: string, specSha256: string): string {
    return path.join(folder, `index-${specSha256.slice(0, 16)}.json`);
}

/** What an address file holds. */
export interface AddressRecord {
    readonly format: 1;
    /** The lending program's process number. */
    readonly pid: number;
    /** The channel's local address (`isLocalAddress`). */
    readonly address: string;
    /** 32 hex digits every request must carry. */
    readonly token: string;
    /** When the program started lending, ISO 8601. */
    readonly started: string;
}

/** 32 random hex digits: a token, or the random part of an address. */
export function randomHex(): string {
    return randomBytes(16).toString('hex');
}

/** The record an address file holds, or null when it is missing or not one. */
export function readAddress(file: string): AddressRecord | null {
    try {
        const value = JSON.parse(readFileSync(file, 'utf8')) as Partial<AddressRecord>;
        if (
            value.format === 1 &&
            typeof value.pid === 'number' &&
            typeof value.address === 'string' &&
            isLocalAddress(value.address) &&
            typeof value.token === 'string' &&
            /^[0-9a-f]{32}$/.test(value.token) &&
            typeof value.started === 'string'
        ) {
            return value as AddressRecord;
        }
        return null;
    } catch {
        return null;
    }
}

/** Write an address file atomically, readable by its owner only. */
export function writeAddress(file: string, record: AddressRecord): void {
    const temp = `${file}.${String(process.pid)}.${randomHex()}.tmp`;
    try {
        writeFileSync(temp, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
        renameSync(temp, file);
    } catch (err) {
        rmSync(temp, { force: true });
        throw err;
    }
}

/** Remove an address file if it is still the one holding `token`. */
export function removeAddress(file: string, token: string): void {
    if (readAddress(file)?.token === token) {
        rmSync(file, { force: true });
    }
}
