/**
 * Files as the protocol names them (a `file:` URI) and as the core names them (a path inside
 * the mod, with `/`). File addresses are built with the platform's own functions, never by
 * joining strings (docs/MVP.md, "Lessons from 2.3.0"), and a path inside the mod is found
 * without regard to letter case where the platform's paths ignore it (Windows: a drive letter
 * the editor writes in lower case, a folder written in another case). Every function takes the
 * platform's flavour as a parameter, so the Windows cases are tested on any system.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Which system's paths: Windows, or every other. */
export interface Flavour {
    readonly windows: boolean;
}

export const THIS_SYSTEM: Flavour = { windows: process.platform === 'win32' };

function api(flavour: Flavour): path.PlatformPath {
    return flavour.windows ? path.win32 : path.posix;
}

/** The local path of a `file:` URI; null for another scheme or a URI that names no file. */
export function uriToPath(uri: string, flavour: Flavour = THIS_SYSTEM): string | null {
    if (!uri.toLowerCase().startsWith('file:')) {
        return null;
    }
    try {
        return fileURLToPath(uri, { windows: flavour.windows });
    } catch {
        return null;
    }
}

/** The `file:` URI of a local path. */
export function pathToUri(file: string, flavour: Flavour = THIS_SYSTEM): string {
    return pathToFileURL(file, { windows: flavour.windows }).href;
}

/**
 * The path of `file` inside the folder `dir`, with `/`, or null when it is not inside it.
 * Windows compares paths without regard to letter case, as its file system does.
 */
export function pathInside(
    dir: string,
    file: string,
    flavour: Flavour = THIS_SYSTEM,
): string | null {
    const p = api(flavour);
    const relative = p.relative(dir, file);
    if (
        relative === '' ||
        p.isAbsolute(relative) ||
        relative === '..' ||
        relative.startsWith(`..${p.sep}`)
    ) {
        return null;
    }
    return relative.split(p.sep).join('/');
}

/** The address on disk of a path inside `dir`, built with the platform's functions. */
export function pathOnDisk(dir: string, relative: string, flavour: Flavour = THIS_SYSTEM): string {
    return api(flavour).join(dir, ...relative.split('/').filter((s) => s !== ''));
}

/**
 * The one of `known` that `relative` names without regard to letter case, when it names none
 * exactly and exactly one that way; otherwise `relative` itself.
 */
export function knownPath(relative: string, known: Iterable<string>): string {
    const folded = relative.toLowerCase();
    let found: string | null = null;
    for (const candidate of known) {
        if (candidate === relative) {
            return relative;
        }
        if (candidate.toLowerCase() === folded) {
            if (found !== null) {
                return relative;
            }
            found = candidate;
        }
    }
    return found ?? relative;
}
