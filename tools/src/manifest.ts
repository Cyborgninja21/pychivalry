/**
 * File manifests: the list of every file under a folder, with its size and, where asked, the
 * SHA-256 of its bytes. records/README.md defines the text form and its hash; the game's
 * manifest and each corpus mod's hash are made here.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { sha256 } from './util.js';

export interface ManifestEntry {
    /** Relative to the manifest's folder, with forward slashes. */
    path: string;
    size: number;
    /** SHA-256 of the file's bytes, or null when the manifest does not hash this file. */
    sha256: string | null;
}

/** Compare two relative paths by their UTF-8 bytes, so the order is the same everywhere. */
export function comparePaths(a: string, b: string): number {
    return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Every regular file under `root`, sorted by `comparePaths`. Anything that is neither a
 * regular file nor a folder (a symbolic link, a device) stops the walk: a manifest that
 * silently skipped it would hash a different install than the one on disk.
 */
export function listFiles(root: string): Array<{ path: string; size: number }> {
    const out: Array<{ path: string; size: number }> = [];
    const walk = (dir: string, rel: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
            if (/[\t\n\r]/.test(relPath)) {
                throw new Error(
                    `a file name holds a tab or a line break: ${JSON.stringify(relPath)}`,
                );
            }
            if (entry.isDirectory()) {
                walk(full, relPath);
            } else if (entry.isFile()) {
                out.push({ path: relPath, size: statSync(full).size });
            } else {
                throw new Error(`not a regular file or folder: ${relPath}`);
            }
        }
    };
    walk(root, '');
    return out.sort((a, b) => comparePaths(a.path, b.path));
}

/** The manifest of `root`, hashing the files for which `hashed(path)` holds. */
export function fileManifest(root: string, hashed: (rel: string) => boolean): ManifestEntry[] {
    return listFiles(root).map((file) => ({
        ...file,
        sha256: hashed(file.path) ? sha256(readFileSync(path.join(root, file.path))) : null,
    }));
}

/** The text form: one line per file, `<path> TAB <size> TAB <sha256 or ->`, LF endings. */
export function renderManifest(entries: readonly ManifestEntry[]): string {
    return entries.map((e) => `${e.path}\t${String(e.size)}\t${e.sha256 ?? '-'}\n`).join('');
}

/** SHA-256 of the text form. */
export function manifestSha256(entries: readonly ManifestEntry[]): string {
    return sha256(renderManifest(entries));
}

/** What the game itself checksums, as its `checksum_manifest.txt` lists it. */
export interface ChecksumScope {
    directories: Array<{ name: string; recursive: boolean }>;
    files: string[];
}

/**
 * Read the game's `checksum_manifest.txt`: blocks that start with a line `directory` or
 * `file`, followed by `name = <path>` and, for a directory, `sub_directories = yes|no`.
 */
export function readChecksumManifest(text: string): ChecksumScope {
    const scope: ChecksumScope = { directories: [], files: [] };
    let kind: 'directory' | 'file' | undefined;
    let name: string | undefined;
    let recursive = false;
    const flush = (): void => {
        if (kind !== undefined && name !== undefined) {
            if (kind === 'directory') {
                scope.directories.push({ name, recursive });
            } else {
                scope.files.push(name);
            }
        }
        kind = undefined;
        name = undefined;
        recursive = false;
    };
    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        if (line === 'directory' || line === 'file') {
            flush();
            kind = line;
            continue;
        }
        const match = /^(\w+)\s*=\s*"?([^"]*?)"?$/.exec(line);
        if (match === null) {
            continue;
        }
        const [, key, value] = match;
        if (key === 'name' && value !== undefined) {
            name = value.replace(/\\/g, '/').replace(/\/+$/, '');
        } else if (key === 'sub_directories') {
            recursive = value === 'yes';
        }
    }
    flush();
    return scope;
}

/** Whether the game's checksum covers the file at `rel` (relative to the game folder). */
export function inChecksumScope(scope: ChecksumScope, rel: string): boolean {
    if (scope.files.includes(rel)) {
        return true;
    }
    return scope.directories.some((dir) =>
        dir.recursive ? rel.startsWith(`${dir.name}/`) : path.posix.dirname(rel) === dir.name,
    );
}
