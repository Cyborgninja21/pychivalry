/**
 * The spec package loader and its typed API.
 *
 * One Spec per workspace, constructed once. Every lookup the checks make is O(1) on maps
 * built at load time; the modifier templates are compiled into one anchored regular
 * expression.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

import {
    BUCKETS,
    Bucket,
    BucketEntry,
    DirectoryEntry,
    ErrorEntry,
    IteratorMatch,
    ModifierMatch,
    RetiredEntry,
    SchemaEntry,
    SpecPackage,
} from './types';
import { validateSpecPackage } from './validate';

/** printf-style and fmt-style placeholders the catalogue texts use, in order of appearance. */
const PLACEHOLDER = /%\.\*s|%[sdiuxXf]|\{\}/g;

export class UnknownMessageError extends Error {
    constructor(id: string) {
        super(`Unknown message id '${id}' (not in the spec package's error catalogue)`);
        this.name = 'UnknownMessageError';
    }
}

export class Spec {
    public readonly data: SpecPackage;
    /** Where the package was loaded from (for diagnostics and the CLI). */
    public readonly source: string;

    private readonly buckets = new Map<string, Map<Bucket, BucketEntry>>();
    private readonly directoriesByPath = new Map<string, DirectoryEntry>();
    private readonly errors = new Map<string, ErrorEntry>();
    private readonly retiredByName = new Map<string, RetiredEntry>();
    private readonly prefixes: string[];
    private readonly templateRegex: RegExp | undefined;
    private readonly multi = new Map<string, Bucket[]>();

    constructor(data: SpecPackage, source = '<memory>') {
        this.data = data;
        this.source = source;

        for (const bucket of BUCKETS) {
            for (const [name, entry] of Object.entries(data.buckets[bucket])) {
                let byBucket = this.buckets.get(name);
                if (!byBucket) {
                    byBucket = new Map();
                    this.buckets.set(name, byBucket);
                }
                byBucket.set(bucket, entry);
            }
        }
        for (const [name, list] of Object.entries(data.multi_bucket)) {
            this.multi.set(name, list);
        }
        for (const dir of data.directories) {
            this.directoriesByPath.set(dir.path, dir);
        }
        for (const err of data.errors) {
            this.errors.set(err.id, err);
        }
        for (const r of data.retired) {
            this.retiredByName.set(r.name, r);
        }
        // Longest prefix first so 'ordered_' never loses to a shorter overlapping prefix.
        this.prefixes = [...data.iterator_prefixes].sort((a, b) => b.length - a.length);

        const alternatives = data.modifier_templates.map((t) =>
            t
                .split('%s')
                .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('[a-z0-9_]+')
        );
        this.templateRegex =
            alternatives.length > 0 ? new RegExp(`^(?:${alternatives.join('|')})$`) : undefined;
    }

    /** CK3 version the package describes, e.g. "1.20.0.2". */
    public version(): string {
        return this.data.manifest.version;
    }

    /** Is `name` registered in `bucket`? */
    public has(name: string, bucket: Bucket): boolean {
        return this.buckets.get(name)?.has(bucket) ?? false;
    }

    /** Every bucket `name` is registered in (empty when it is in none). */
    public bucketsOf(name: string): Bucket[] {
        const byBucket = this.buckets.get(name);
        return byBucket ? Array.from(byBucket.keys()) : [];
    }

    /** Names registered in more than one bucket, as the package lists them. */
    public multiBucket(name: string): Bucket[] | undefined {
        return this.multi.get(name);
    }

    /** The engine's built-in documentation for `name` (first bucket found when none given). */
    public doc(name: string, bucket?: Bucket): string | undefined {
        const byBucket = this.buckets.get(name);
        if (!byBucket) {
            return undefined;
        }
        if (bucket) {
            return byBucket.get(bucket)?.doc;
        }
        for (const entry of byBucket.values()) {
            return entry.doc;
        }
        return undefined;
    }

    /** All names of one bucket. */
    public names(bucket: Bucket): string[] {
        return Object.keys(this.data.buckets[bucket]);
    }

    /**
     * `any_vassal` → { prefix: 'any_', base: 'vassal' } when the base is a registered list.
     * Bases are the lists bucket only, never links.
     */
    public isIterator(name: string): IteratorMatch | undefined {
        const prefix = this.iteratorPrefix(name);
        if (!prefix) {
            return undefined;
        }
        const base = name.slice(prefix.length);
        return this.has(base, 'lists') ? { prefix, base } : undefined;
    }

    /** The iterator prefix `name` starts with, whether or not its base is a list. */
    public iteratorPrefix(name: string): string | undefined {
        for (const prefix of this.prefixes) {
            if (name.startsWith(prefix) && name.length > prefix.length) {
                return prefix;
            }
        }
        return undefined;
    }

    /** Base list name of an iterator (`every_vassal` → `vassal`), when it is one. */
    public listBase(iterator: string): string | undefined {
        return this.isIterator(iterator)?.base;
    }

    /** 'static' when in the modifier table, 'template' when it fills a %s template. */
    public isModifier(name: string): ModifierMatch | undefined {
        if (this.has(name, 'modifiers')) {
            return 'static';
        }
        if (this.templateRegex && this.templateRegex.test(name)) {
            return 'template';
        }
        return undefined;
    }

    /**
     * The registered directory a mod-relative path lives in (longest-prefix match).
     * `relPath` uses '/' or '\\'; a leading './' is ignored.
     */
    public directoryOf(relPath: string): DirectoryEntry | undefined {
        const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
        const parts = normalized.split('/');
        // Try every directory prefix from longest to shortest; the file name itself is excluded.
        for (let i = parts.length - 1; i >= 1; i--) {
            const candidate = parts.slice(0, i).join('/');
            const dir = this.directoriesByPath.get(candidate);
            if (dir) {
                return dir;
            }
        }
        return undefined;
    }

    /** Per-directory record schema, by directory path or entry. */
    public schemaOf(directory: string | DirectoryEntry): SchemaEntry | undefined {
        const key = typeof directory === 'string' ? directory : directory.path;
        return this.data.schema[key];
    }

    /** Catalogue entry for a message id. */
    public errorEntry(id: string): ErrorEntry | undefined {
        return this.errors.get(id);
    }

    public hasMessage(id: string): boolean {
        return this.errors.has(id);
    }

    /**
     * The engine's message text for `id` with its placeholders (%s, %d, %.*s, {}) filled
     * in order from `args`. Throws UnknownMessageError for an id not in the catalogue.
     */
    public message(id: string, ...args: Array<string | number>): string {
        const entry = this.errors.get(id);
        if (!entry) {
            throw new UnknownMessageError(id);
        }
        return fillPlaceholders(entry.text, args);
    }

    /** The retirement record for a name removed from the engine, if any. */
    public retired(name: string): RetiredEntry | undefined {
        return this.retiredByName.get(name);
    }

    /**
     * Per-keyword supported scopes. The package's scope_validity is empty until an oracle
     * run fills it (review issue S1), so this returns undefined for every name today.
     */
    public scopeValidity(name: string): unknown {
        return Object.prototype.hasOwnProperty.call(this.data.scope_validity, name)
            ? this.data.scope_validity[name]
            : undefined;
    }
}

/** Substitute catalogue placeholders positionally; missing arguments become ''. */
export function fillPlaceholders(text: string, args: Array<string | number>): string {
    let i = 0;
    return text.replace(PLACEHOLDER, () => {
        const value = i < args.length ? args[i] : '';
        i++;
        return String(value);
    });
}

function readJsonBytes(file: string): Buffer {
    const raw = fs.readFileSync(file);
    return file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
}

/** The checksum file next to a package: `x.json(.gz)` → `x.sha256`. */
function checksumPathFor(file: string): string {
    return file.replace(/\.json(\.gz)?$/, '.sha256');
}

export interface LoadSpecOptions {
    /** Verify the sha256 of the JSON against the `.sha256` file beside it (default true). */
    verifyChecksum?: boolean;
}

/**
 * Read, verify and validate a spec package (`.json` or gzipped `.json.gz`).
 */
export function loadSpec(file: string, options: LoadSpecOptions = {}): Spec {
    const bytes = readJsonBytes(file);
    const shaFile = checksumPathFor(file);
    if (options.verifyChecksum !== false && shaFile !== file && fs.existsSync(shaFile)) {
        const expected = fs.readFileSync(shaFile, 'utf8').trim().split(/\s+/)[0].toLowerCase();
        const actual = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actual !== expected) {
            throw new Error(`Spec package ${file}: sha256 ${actual} does not match ${shaFile}`);
        }
    }
    const data: unknown = JSON.parse(bytes.toString('utf8'));
    return new Spec(validateSpecPackage(data), file);
}

/** Directory holding package.json of pychivalry-engine, found by walking up from here. */
export function packageRoot(): string {
    let dir = __dirname;
    for (;;) {
        const pkg = path.join(dir, 'package.json');
        if (fs.existsSync(pkg)) {
            const parsed: unknown = JSON.parse(fs.readFileSync(pkg, 'utf8'));
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'name' in parsed &&
                parsed.name === 'pychivalry-engine'
            ) {
                return dir;
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error('pychivalry-engine: package root not found');
        }
        dir = parent;
    }
}

/**
 * Path of the bundled spec package: dist/data/ck3-spec.json.gz after a build, otherwise
 * the file spec.config.json names.
 */
export function defaultSpecPath(): string {
    const root = packageRoot();
    const built = path.join(root, 'dist', 'data', 'ck3-spec.json.gz');
    if (fs.existsSync(built)) {
        return built;
    }
    const config: unknown = JSON.parse(
        fs.readFileSync(path.join(root, 'spec.config.json'), 'utf8')
    );
    if (
        typeof config === 'object' &&
        config !== null &&
        'spec' in config &&
        typeof config.spec === 'string'
    ) {
        return path.isAbsolute(config.spec) ? config.spec : path.join(root, config.spec);
    }
    throw new Error('pychivalry-engine: spec.config.json has no "spec" path');
}

let cachedDefault: Spec | undefined;

/** The bundled spec, loaded once per process. */
export function defaultSpec(): Spec {
    if (!cachedDefault) {
        cachedDefault = loadSpec(defaultSpecPath());
    }
    return cachedDefault;
}
