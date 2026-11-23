/**
 * The typed spec reader (docs/PLAN.md item 4.2). It reads the committed package file, a
 * gzipped JSON file with the SHA-256 of its uncompressed bytes beside it (spec/README.md),
 * checks that checksum and the package format, and exposes the package as typed data: the
 * keys of format 5 and the eight parts of formats 6 and 7 (D1 to D8, `part`). The three
 * companions (Paradox's `.info` files, the GUI vocabulary, the data-types dump) are opened
 * only when a feature asks for one, each checked against the checksum and size the package
 * file records for it.
 *
 * The core has no runtime dependencies: decompression is Node's own `zlib`, the checksum its
 * own `crypto`. A package is read once per process: `openSpec` keeps what it read, keyed by
 * the file and its size and time, so every caller in a process shares one parse.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
    BUCKET_NAMES,
    PART_KEYS,
    type CompanionRecord,
    type PartData,
    type PartKey,
    type SpecData,
} from './package.js';

/**
 * The package format the rebuild reads: 7 (docs/decisions.md). Format 5 is refused: the index's
 * override rules and the checks of item 4.2 need the parts only format 7 carries, and a
 * format 5 package would leave them silently without. Format 4 is release 2.3.0's.
 */
export const SPEC_FORMAT = 7;

/** The package file in a spec folder: `ck3-spec-<version>.json.gz`, never a companion. */
const PACKAGE_FILE = /^ck3-spec-([0-9]+(?:\.[0-9]+)+)\.json\.gz$/;
const SHA256 = /^[0-9a-f]{64}$/;

/** Why a package or a companion could not be read: a wrong checksum, format or shape. */
export class SpecError extends Error {
    override name = 'SpecError';
}

/** The SHA-256 of some bytes, in lower-case hex. */
export function sha256Hex(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** The checksum a `.sha256` file states for the file it names (`sha256sum` form). */
export function readChecksumFile(text: string, expectedName: string): string {
    const [hash, name] = text.trim().split(/\s+/);
    if (hash === undefined || !SHA256.test(hash.toLowerCase())) {
        throw new SpecError('the checksum file does not start with a SHA-256');
    }
    if (name === undefined || name.replace(/^\*/, '') !== expectedName) {
        throw new SpecError(
            `the checksum file names ${name ?? 'no file'}, not the uncompressed ${expectedName}`,
        );
    }
    return hash.toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Uncompress gzipped bytes and check their SHA-256 against the one stated. */
function checkedBytes(gz: Uint8Array, expected: string, what: string): Buffer {
    let bytes: Buffer;
    try {
        bytes = gunzipSync(gz);
    } catch (err) {
        throw new SpecError(`${what} is not valid gzip: ${(err as Error).message}`);
    }
    const actual = sha256Hex(bytes);
    if (actual !== expected.toLowerCase()) {
        throw new SpecError(
            `${what}: the SHA-256 of the uncompressed bytes is ${actual}, the checksum stated is ${expected.toLowerCase()}`,
        );
    }
    return bytes;
}

function parseObject(bytes: Buffer, what: string): Record<string, unknown> {
    let data: unknown;
    try {
        data = JSON.parse(bytes.toString('utf8'));
    } catch (err) {
        throw new SpecError(`${what} is not valid JSON: ${(err as Error).message}`);
    }
    if (!isObject(data)) {
        throw new SpecError(`${what} is not a JSON object`);
    }
    return data;
}

/**
 * The keys of format 7 the core reads, checked for their shape so a wrong package fails here
 * rather than as a missing name in a check. The package's full schema is checked by
 * `task spec:check` in the tools.
 */
function checkShape(data: Record<string, unknown>, what: string): void {
    const problems: string[] = [];
    const buckets = data['buckets'];
    if (!isObject(buckets)) {
        problems.push('no buckets');
    } else {
        for (const name of BUCKET_NAMES) {
            if (!isObject(buckets[name])) {
                problems.push(`no buckets.${name}`);
            }
        }
    }
    for (const key of [
        'manifest',
        'schema',
        'scope_validity',
        'scope_types',
        'multi_bucket',
        'modifier_template_marks',
        'tables',
    ]) {
        if (!isObject(data[key])) {
            problems.push(`no ${key} object`);
        }
    }
    for (const key of [
        'directories',
        'errors',
        'retired',
        'iterator_prefixes',
        'keyword_templates',
        'modifier_templates',
        'parts',
    ]) {
        if (!Array.isArray(data[key])) {
            problems.push(`no ${key} list`);
        }
    }
    const tables = data['tables'];
    if (isObject(tables) && !isObject(tables['data'])) {
        problems.push('no tables.data');
    }
    const tags = data['modifier_template_tags'];
    if (!isObject(tags) || !isObject(tags['data'])) {
        problems.push('no modifier_template_tags.data');
    }
    for (const key of PART_KEYS) {
        const part = data[key];
        if (!isObject(part)) {
            problems.push(`no ${key} part`);
        } else if (part['status'] === 'built') {
            if (!isObject(part['data'])) {
                problems.push(`${key} is built but has no data`);
            }
        } else if (part['status'] !== 'not_built' || typeof part['reason'] !== 'string') {
            problems.push(`${key} is neither built nor not_built with a reason`);
        }
    }
    const manifest = data['manifest'];
    if (isObject(manifest) && !isObject(manifest['companions'])) {
        problems.push('no manifest.companions');
    }
    if (problems.length > 0) {
        throw new SpecError(
            `${what} is not a format ${String(SPEC_FORMAT)} package: ${problems.join('; ')}`,
        );
    }
}

/** The three companions, by the package key that records each. */
export type CompanionKey = 'info_docs' | 'gui' | 'data_types';

/** A companion file, parsed: its header and its `data`. */
export interface Companion {
    readonly companion: string;
    readonly package: string;
    readonly package_format: number;
    readonly version: string;
    readonly part: { readonly id: string; readonly key: string; readonly title: string };
    readonly data: Readonly<Record<string, unknown>>;
}

/** The spec package, read and checked. */
export class Spec {
    /** The package file, parsed and typed. */
    readonly data: SpecData;
    /** The game version the package is for (`manifest.version`). */
    readonly version: string;
    /** The SHA-256 of the package file's uncompressed bytes. */
    readonly sha256: string;
    /** The folder the package came from, where its companions are; null for bytes given. */
    readonly dir: string | null;
    private readonly companions = new Map<CompanionKey, Companion>();

    constructor(data: SpecData, sha256: string, dir: string | null) {
        this.data = data;
        this.version = data.manifest.version;
        this.sha256 = sha256;
        this.dir = dir;
    }

    /** The package file's own name, uncompressed: `ck3-spec-<version>.json`. */
    get fileName(): string {
        return `ck3-spec-${this.version}.json`;
    }

    /**
     * The data of a part of formats 6 and 7 (D1 to D8), or null when the package says it is
     * not built. Read with the package, once per process.
     */
    part<K extends PartKey>(key: K): PartData[K] | null {
        const part = this.data[key];
        return part.status === 'built' ? (part.data as PartData[K]) : null;
    }

    /** The record of a companion in `manifest.companions`, and its file name. */
    companionRecord(key: CompanionKey): { readonly file: string; readonly record: CompanionRecord } {
        for (const [file, record] of Object.entries(this.data.manifest.companions)) {
            if (record.key === key) {
                return { file, record };
            }
        }
        throw new SpecError(`the package lists no companion for ${key}`);
    }

    /**
     * A companion, opened the first time it is asked for: its gzipped file beside the package,
     * checked against the SHA-256 and size `manifest.companions` states and against its own
     * header (the companion's name, the package, the version and the format).
     */
    companion(key: CompanionKey): Companion {
        const cached = this.companions.get(key);
        if (cached !== undefined) {
            return cached;
        }
        if (this.dir === null) {
            throw new SpecError(`the package was read from bytes: no folder to open ${key} from`);
        }
        const { file, record } = this.companionRecord(key);
        const disk = path.join(this.dir, `${file}.gz`);
        if (!existsSync(disk)) {
            throw new SpecError(`${file}.gz, the companion the package lists for ${key}, is missing`);
        }
        const companion = readCompanion(readFileSync(disk), file, record, this);
        this.companions.set(key, companion);
        return companion;
    }
}

/**
 * A companion's bytes, checked against the record the package file keeps of it and against
 * its own header.
 */
export function readCompanion(
    gz: Uint8Array,
    file: string,
    record: CompanionRecord,
    spec: Spec,
): Companion {
    const bytes = checkedBytes(gz, record.sha256, `${file}.gz`);
    if (bytes.length !== record.bytes) {
        throw new SpecError(
            `${file}.gz: ${String(bytes.length)} bytes uncompressed, the package records ${String(record.bytes)}`,
        );
    }
    const data = parseObject(bytes, `${file}.gz`);
    const part = data['part'];
    if (
        data['package'] !== spec.fileName ||
        data['version'] !== spec.version ||
        data['package_format'] !== SPEC_FORMAT ||
        !isObject(part) ||
        part['key'] !== record.key ||
        !isObject(data['data'])
    ) {
        throw new SpecError(
            `${file}.gz is not the ${record.key} companion of ${spec.fileName} (format ${String(SPEC_FORMAT)}, version ${spec.version})`,
        );
    }
    return data as unknown as Companion;
}

/**
 * A package file from its gzipped bytes and the SHA-256 its `.sha256` file states for the
 * uncompressed bytes. `version`, when given, is the version its file name states, which its
 * manifest must name too. `dir` is where its companions are, if anywhere.
 */
export function readSpec(
    gz: Uint8Array,
    sha256: string,
    options: { readonly version?: string; readonly dir?: string | null } = {},
): Spec {
    const what = options.version === undefined ? 'the spec package' : `ck3-spec-${options.version}.json.gz`;
    const bytes = checkedBytes(gz, sha256, what);
    const data = parseObject(bytes, what);
    if (data['package_format'] !== SPEC_FORMAT) {
        throw new SpecError(
            `${what} is package format ${JSON.stringify(data['package_format'])}; the rebuild reads format ${String(SPEC_FORMAT)} only`,
        );
    }
    checkShape(data, what);
    const manifest = data['manifest'] as Record<string, unknown>;
    if (typeof manifest['version'] !== 'string') {
        throw new SpecError(`${what} names no game version in its manifest`);
    }
    if (options.version !== undefined && manifest['version'] !== options.version) {
        throw new SpecError(
            `${what} names game version ${manifest['version']} in its manifest, not ${options.version}`,
        );
    }
    return new Spec(data as unknown as SpecData, sha256.toLowerCase(), options.dir ?? null);
}

/** The package file a spec folder holds: exactly one `ck3-spec-<version>.json.gz`. */
export function packageFileIn(dir: string): { readonly file: string; readonly version: string } {
    if (!existsSync(dir)) {
        throw new SpecError('the spec folder is missing');
    }
    const files = readdirSync(dir).filter((name) => PACKAGE_FILE.test(name));
    const file = files[0];
    if (files.length !== 1 || file === undefined) {
        throw new SpecError(
            `the spec folder must hold exactly one ck3-spec-<version>.json.gz; it holds ${String(files.length)}`,
        );
    }
    return { file, version: PACKAGE_FILE.exec(file)?.[1] ?? '' };
}

const opened = new Map<string, Spec>();

/**
 * The package in a spec folder, read once per process: its gzipped file, checked against the
 * `.sha256` beside it that names the uncompressed file, package format 7, and the version its
 * name and its manifest state. A second call for the same unchanged file returns the same
 * object.
 */
export function openSpec(dir: string): Spec {
    const folder = path.resolve(dir);
    const { file, version } = packageFileIn(folder);
    const disk = path.join(folder, file);
    const stat = statSync(disk);
    const key = `${disk}\u0000${String(stat.size)}\u0000${String(stat.mtimeMs)}`;
    const known = opened.get(key);
    if (known !== undefined) {
        return known;
    }
    const json = `ck3-spec-${version}.json`;
    const shaFile = path.join(folder, `ck3-spec-${version}.sha256`);
    if (!existsSync(shaFile)) {
        throw new SpecError(`ck3-spec-${version}.sha256 is missing`);
    }
    const sha256 = readChecksumFile(readFileSync(shaFile, 'utf8'), json);
    const spec = readSpec(readFileSync(disk), sha256, { version, dir: folder });
    opened.set(key, spec);
    return spec;
}
