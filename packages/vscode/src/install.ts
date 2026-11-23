/**
 * The agent server's copy in the extension's global storage folder (docs/PLAN.md, item 7.1).
 *
 * VS Code installs each version of an extension in a folder named after it
 * (`cyborgninja21.pychivalry-0.1.0`) and removes the old folder after an update. An entry in
 * Claude Code's configuration that pointed into it would stop working at the first update. The
 * global storage folder is VS Code's per-extension folder that does not carry the version, so
 * the server and its spec package are copied there and every entry points at the copy. Until
 * the new version first activates, the old copy keeps answering; on activation it is replaced.
 *
 * The bundle's `manifest.json` lists every file with its SHA-256 and size. A copy whose
 * manifest is the same, with every file present at its size, is left alone; otherwise each file
 * is written beside its place and renamed over it, files the old manifest listed and the new one
 * does not are removed (a spec package of another game version, which the server would refuse
 * as a second package), and the manifest is written last. No VS Code import.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

/** The manifest's file name, in the bundle and in the copy. */
export const MANIFEST_FILE = 'manifest.json';

/** One file of the server folder. */
export interface BundleFile {
    /** Its path in the folder, written with `/`. */
    readonly path: string;
    readonly sha256: string;
    readonly size: number;
}

/** What the bundle's `manifest.json` holds. */
export interface BundleManifest {
    /** The extension version that built it. */
    readonly version: string;
    readonly files: readonly BundleFile[];
}

/** What an installation did. */
export interface InstallResult {
    /** The server folder every entry points at. */
    readonly dir: string;
    /** The version of the server now there. */
    readonly version: string;
    /** Whether any file was written or removed. */
    readonly changed: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A manifest read from text; an error naming what is wrong when it is not one. */
export function parseManifest(text: string): BundleManifest {
    const data: unknown = JSON.parse(text);
    if (!isObject(data) || typeof data['version'] !== 'string' || !Array.isArray(data['files'])) {
        throw new Error('the server manifest has no version or no files');
    }
    const files: BundleFile[] = [];
    for (const entry of data['files'] as unknown[]) {
        if (
            !isObject(entry) ||
            typeof entry['path'] !== 'string' ||
            typeof entry['sha256'] !== 'string' ||
            typeof entry['size'] !== 'number'
        ) {
            throw new Error('a server manifest entry is not {path, sha256, size}');
        }
        const rel = entry['path'];
        if (
            rel === '' ||
            rel.startsWith('/') ||
            rel.split('/').some((p) => p === '..' || p === '')
        ) {
            throw new Error(`a server manifest path leaves its folder: ${rel}`);
        }
        files.push({ path: rel, sha256: entry['sha256'], size: entry['size'] });
    }
    return { version: data['version'], files };
}

/** The manifest of the files in `dir`, each path given with `/`. */
export function manifestOf(dir: string, version: string, rels: readonly string[]): BundleManifest {
    return {
        version,
        files: [...rels].sort().map((rel) => {
            const bytes = readFileSync(path.join(dir, ...rel.split('/')));
            return {
                path: rel,
                sha256: createHash('sha256').update(bytes).digest('hex'),
                size: bytes.length,
            };
        }),
    };
}

function readManifestIn(dir: string): BundleManifest | null {
    const file = path.join(dir, MANIFEST_FILE);
    if (!existsSync(file)) {
        return null;
    }
    try {
        return parseManifest(readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function sameManifest(a: BundleManifest, b: BundleManifest): boolean {
    return (
        a.version === b.version &&
        a.files.length === b.files.length &&
        a.files.every((f, i) => {
            const g = b.files[i];
            return (
                g !== undefined && f.path === g.path && f.sha256 === g.sha256 && f.size === g.size
            );
        })
    );
}

/** Whether every file the manifest lists is in `dir` at its size. */
function complete(dir: string, manifest: BundleManifest): boolean {
    return manifest.files.every((f) => {
        const stat = statSync(path.join(dir, ...f.path.split('/')), { throwIfNoEntry: false });
        return stat?.isFile() === true && stat.size === f.size;
    });
}

/** Write `bytes` to `file` through a temporary file beside it, renamed over it. */
function replaceFile(file: string, bytes: Uint8Array): void {
    mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${String(process.pid)}-${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temp, bytes);
    try {
        renameSync(temp, file);
    } catch (err) {
        rmSync(temp, { force: true });
        throw err;
    }
}

/**
 * Copy the server folder `source` (the bundle, with its manifest) to `target` unless the copy
 * there is already the same; every file is checked against the manifest's SHA-256 on the way.
 */
export function installServer(source: string, target: string): InstallResult {
    const wanted = readManifestIn(source);
    if (wanted === null) {
        throw new Error(`the bundled agent server has no readable ${MANIFEST_FILE}: ${source}`);
    }
    const present = readManifestIn(target);
    if (present !== null && sameManifest(present, wanted) && complete(target, wanted)) {
        return { dir: target, version: wanted.version, changed: false };
    }
    for (const f of wanted.files) {
        const bytes = readFileSync(path.join(source, ...f.path.split('/')));
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (sha256 !== f.sha256 || bytes.length !== f.size) {
            throw new Error(`the bundled agent server's ${f.path} does not match its manifest`);
        }
        replaceFile(path.join(target, ...f.path.split('/')), bytes);
    }
    const keep = new Set(wanted.files.map((f) => f.path));
    for (const old of present?.files ?? []) {
        if (!keep.has(old.path)) {
            rmSync(path.join(target, ...old.path.split('/')), { force: true });
        }
    }
    replaceFile(
        path.join(target, MANIFEST_FILE),
        Buffer.from(`${JSON.stringify(wanted, null, 2)}\n`, 'utf8'),
    );
    return { dir: target, version: wanted.version, changed: true };
}
