/**
 * The mod corpus (records/corpus/README.md): five workshop mods copied into `CK3_CORPUS`, one
 * folder per slug, pinned by `records/corpus/MANIFEST.tsv`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileManifest, manifestSha256 } from './manifest.js';
import { CommandError, EXIT } from './util.js';

export interface CorpusRow {
    slug: string;
    workshop_id: string;
    name: string;
    supported_version: string;
    files: number;
    /** SHA-256 of the mod folder's file manifest, every file hashed (records/README.md). */
    sha256: string;
}

export const MANIFEST_COLUMNS = [
    'slug',
    'workshop_id',
    'name',
    'supported_version',
    'files',
    'sha256',
] as const;

const MANIFEST_COMMENT =
    '# The pinned mod corpus: see records/corpus/README.md. Written by task corpus:manifest.';

/** Top-level `key="value"` and `key=value` lines of a mod's `descriptor.mod`. */
export function readDescriptor(text: string): Map<string, string> {
    const values = new Map<string, string>();
    let depth = 0;
    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '');
        if (depth === 0) {
            const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|([^\s{]+))\s*$/.exec(
                line,
            );
            if (match?.[1] !== undefined) {
                values.set(match[1], match[2] ?? match[3] ?? '');
            }
        }
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    }
    return values;
}

/** One manifest row, measured from `<corpusDir>/<slug>`. */
export function corpusRow(corpusDir: string, slug: string): CorpusRow {
    const modDir = path.join(corpusDir, slug);
    const descriptorFile = path.join(modDir, 'descriptor.mod');
    if (!existsSync(descriptorFile)) {
        throw new CommandError(`corpus mod ${slug} has no descriptor.mod`, EXIT.usage);
    }
    const descriptor = readDescriptor(readFileSync(descriptorFile, 'utf8'));
    const field = (key: string): string => {
        const value = descriptor.get(key);
        if (value === undefined || value === '' || /[\t\n\r]/.test(value)) {
            throw new CommandError(
                `corpus mod ${slug}: descriptor.mod has no usable ${key}`,
                EXIT.usage,
            );
        }
        return value;
    };
    const entries = fileManifest(modDir, () => true);
    return {
        slug,
        workshop_id: field('remote_file_id'),
        name: field('name'),
        supported_version: field('supported_version'),
        files: entries.length,
        sha256: manifestSha256(entries),
    };
}

/** Every slug folder in the corpus folder, sorted. */
export function corpusSlugs(corpusDir: string): string[] {
    return readdirSync(corpusDir)
        .filter((name) => statSync(path.join(corpusDir, name)).isDirectory())
        .sort();
}

/** The TSV text: a comment line, the header, one row per mod, LF endings. */
export function renderCorpusManifest(rows: readonly CorpusRow[]): string {
    const lines = [MANIFEST_COMMENT, MANIFEST_COLUMNS.join('\t')];
    for (const row of rows) {
        lines.push(MANIFEST_COLUMNS.map((column) => String(row[column])).join('\t'));
    }
    return `${lines.join('\n')}\n`;
}

/** Parse the TSV text; lines that start with `#` are comments. */
export function parseCorpusManifest(text: string): CorpusRow[] {
    const lines = text.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('#'));
    const header = lines.shift()?.split('\t') ?? [];
    if (header.join('\t') !== MANIFEST_COLUMNS.join('\t')) {
        throw new Error(`MANIFEST.tsv: the header must be ${MANIFEST_COLUMNS.join(', ')}`);
    }
    return lines.map((line, i) => {
        const cells = line.split('\t');
        const [slug, workshopId, name, supportedVersion, files, sha] = cells;
        if (
            cells.length !== MANIFEST_COLUMNS.length ||
            slug === undefined ||
            workshopId === undefined ||
            name === undefined ||
            supportedVersion === undefined ||
            files === undefined ||
            sha === undefined ||
            !/^[0-9]+$/.test(files) ||
            !/^[0-9a-f]{64}$/.test(sha)
        ) {
            throw new Error(`MANIFEST.tsv: row ${String(i + 1)} is malformed`);
        }
        return {
            slug,
            workshop_id: workshopId,
            name,
            supported_version: supportedVersion,
            files: Number(files),
            sha256: sha,
        };
    });
}

/** Check that `CK3_CORPUS` is set and is a folder. */
export function requireCorpusDir(corpusDir: string | undefined): string {
    if (corpusDir === undefined || corpusDir === '') {
        throw new CommandError(
            'CK3_CORPUS is not set: point it at the corpus folder (records/corpus/README.md)',
            EXIT.usage,
        );
    }
    const dir = path.resolve(corpusDir);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
        throw new CommandError('CK3_CORPUS is not a folder', EXIT.usage);
    }
    return dir;
}

/**
 * The slugs a run reads: every row of the manifest, or those `CK3_CORPUS_SLUGS` names
 * (comma-separated), each of which must be in the manifest.
 */
export function selectSlugs(rows: readonly CorpusRow[], wanted: string | undefined): string[] {
    const known = rows.map((row) => row.slug);
    if (wanted === undefined || wanted.trim() === '') {
        return known;
    }
    const slugs = wanted
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    const unknown = slugs.filter((s) => !known.includes(s));
    if (unknown.length > 0) {
        throw new CommandError(
            `CK3_CORPUS_SLUGS names mods that are not in the corpus manifest: ${unknown.join(', ')} (known: ${known.join(', ')})`,
            EXIT.usage,
        );
    }
    return [...new Set(slugs)];
}

/**
 * Compare the mods on disk with the committed manifest: each selected slug must have the
 * pinned file count and hash. Returns one line per difference.
 */
export function verifyCorpus(
    corpusDir: string,
    rows: readonly CorpusRow[],
    slugs: readonly string[],
): string[] {
    const problems: string[] = [];
    for (const slug of slugs) {
        const pinned = rows.find((row) => row.slug === slug);
        if (pinned === undefined) {
            problems.push(`${slug}: not in the corpus manifest`);
            continue;
        }
        if (!existsSync(path.join(corpusDir, slug))) {
            problems.push(`${slug}: missing from the corpus folder`);
            continue;
        }
        const actual = corpusRow(corpusDir, slug);
        if (actual.files !== pinned.files || actual.sha256 !== pinned.sha256) {
            problems.push(
                `${slug}: the copy on disk (${String(actual.files)} files, ${actual.sha256}) is not the pinned one (${String(pinned.files)} files, ${pinned.sha256})`,
            );
        }
    }
    return problems;
}
