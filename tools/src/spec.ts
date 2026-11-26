/**
 * The committed spec package (spec/README.md). `task spec:check` verifies, from the bytes:
 *
 * - the package file: exactly one `ck3-spec-<version>.json.gz` in `spec/`, the `.sha256` of
 *   its uncompressed bytes, package format 9, and the game version its manifest names;
 * - each companion the package file's `manifest.companions` lists: present beside it,
 *   gzipped, with the SHA-256 and size the package file states, its own `.sha256`, the same
 *   record under the package's key for it, and a header naming this package and version;
 *   no other spec file beside them;
 * - the schema `schema.format9.json`: it declares format 9, and the package file and every
 *   companion are valid against it;
 * - the format 4 copy of the same game version in `spec/legacy/`, which only release 2.3.0
 *   reads, for the baselines: its checksum, format 4 and its game version.
 *
 * Every committed spec file is gzipped deterministically: no file name, comment or time in
 * its header, so the same bytes give the same file (spec/README.md, "Compression").
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { isObject, sha256 } from './util.js';

/**
 * The package format the rebuild reads: 9 (docs/decisions.md). Formats 5, 7 and 8 are refused,
 * as the core's reader refuses them: the index and the checks read keys only format 9 carries
 * (which files of a directory are script, the root rule of a directory, the saves of a value,
 * the names the game saves from its own code, the scope values that are no scope type). Format
 * 4 is the legacy engine's.
 */
export const PACKAGE_FORMAT = 9;
/** The package's JSON Schema, from `pdx-parser-re` (`spec/package/schema.format9.json`). */
export const SCHEMA_FILE = 'schema.format9.json';
/** The folder of the format 4 copy that release 2.3.0 runs on for the baselines. */
export const LEGACY_DIR = 'legacy';
/** The format of that copy. */
export const LEGACY_PACKAGE_FORMAT = 4;

/** A companion file, as the package file records it in `manifest.companions`. */
export interface CompanionRef {
    /** The uncompressed file name, `ck3-spec-<version>.<name>.json`. */
    file: string;
    /** The part it holds (`C1`, `C2`, `C3`). */
    part: string;
    /** The package's top-level key that records it (`info_docs`, `gui`, `data_types`). */
    key: string;
    /** SHA-256 of its uncompressed bytes. */
    sha256: string;
    /** Size of its uncompressed bytes. */
    bytes: number;
}

export interface CommittedSpec {
    /** The game version in the file name, `ck3-spec-<version>.json.gz`. */
    version: string;
    /** The package file, relative to the spec folder. */
    file: string;
    compressed: boolean;
    /** SHA-256 of the uncompressed bytes, as the `.sha256` file states and the bytes confirm. */
    sha256: string;
    package_format: number;
    /** The companions the package file lists; checked only by a full check. */
    companions: CompanionRef[];
}

/** The format 4 copy in `spec/legacy/`. */
export interface LegacySpec {
    /** The game version in the file name, `ck3-spec-<version>.format4.json.gz`. */
    version: string;
    /** The file, relative to the spec folder (`legacy/...`). */
    file: string;
    /** SHA-256 of its uncompressed bytes. */
    sha256: string;
    package_format: number;
}

export interface SpecCheck {
    spec: CommittedSpec | undefined;
    problems: string[];
}

export interface LegacySpecCheck {
    legacy: LegacySpec | undefined;
    problems: string[];
}

const PACKAGE_NAME = /^ck3-spec-([0-9]+(?:\.[0-9]+)+)\.json\.gz$/;
const LEGACY_NAME = /^ck3-spec-([0-9]+(?:\.[0-9]+)+)\.format4\.json\.gz$/;
/** Any spec JSON file, compressed or not: the package, a companion, a stray copy. */
const SPEC_FILE = /^ck3-spec-.+\.json(\.gz)?$/;
const SHA256 = /^[0-9a-f]{64}$/;

/** The `.sha256` file beside `<name>.json`: `<name>.sha256`. */
export function checksumFileOf(jsonName: string): string {
    return jsonName.replace(/\.json$/, '.sha256');
}

/**
 * Problems with a gzip file's header that would make the same bytes compress to another file:
 * a stored file name, a comment, an extra field or a modification time (RFC 1952, 2.3).
 * `gzip -n -9` writes none of them.
 */
export function gzipHeaderProblems(name: string, raw: Uint8Array): string[] {
    if (raw.length < 10 || raw[0] !== 0x1f || raw[1] !== 0x8b || raw[2] !== 8) {
        return [`${name} is not a gzip file`];
    }
    const flags = raw[3] ?? 0;
    const mtime = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).readUInt32LE(4);
    const kept = [
        ...(flags & 0x08 ? ['a file name'] : []),
        ...(flags & 0x10 ? ['a comment'] : []),
        ...(flags & 0x04 ? ['an extra field'] : []),
        ...(mtime !== 0 ? ['a modification time'] : []),
    ];
    return kept.length === 0
        ? []
        : [
              `${name}: its gzip header stores ${kept.join(', ')}; compress it with gzip -n -9 so the committed bytes are reproducible`,
          ];
}

/** A gzipped spec file read and checked against its `.sha256`: its bytes and their hash. */
interface CheckedFile {
    bytes: Buffer;
    sha256: string;
}

/**
 * Read `dir/<jsonName>.gz`, check its gzip header, and check its uncompressed bytes against
 * `dir/<name>.sha256`, which must name `<jsonName>`. Undefined (with problems) when the file
 * cannot be read at all.
 */
function readChecked(dir: string, jsonName: string, problems: string[]): CheckedFile | undefined {
    const gz = `${jsonName}.gz`;
    const file = path.join(dir, gz);
    if (!existsSync(file)) {
        problems.push(`${gz} is missing`);
        return undefined;
    }
    const raw = readFileSync(file);
    problems.push(...gzipHeaderProblems(gz, raw));
    let bytes: Buffer;
    try {
        bytes = gunzipSync(raw);
    } catch (err) {
        problems.push(`${gz} is not valid gzip: ${(err as Error).message}`);
        return undefined;
    }
    const actual = sha256(bytes);
    const shaName = checksumFileOf(jsonName);
    const shaFile = path.join(dir, shaName);
    if (!existsSync(shaFile)) {
        problems.push(`${shaName} is missing`);
    } else {
        const [hash, name] = readFileSync(shaFile, 'utf8').trim().split(/\s+/);
        if (hash === undefined || !SHA256.test(hash.toLowerCase())) {
            problems.push(`${shaName} does not start with a SHA-256`);
        } else if (hash.toLowerCase() !== actual) {
            problems.push(
                `${gz}: the SHA-256 of the uncompressed bytes is ${actual}, ${shaName} says ${hash.toLowerCase()}`,
            );
        }
        if (name === undefined || name.replace(/^\*/, '') !== jsonName) {
            problems.push(
                `${shaName} names ${name ?? 'no file'}, not the uncompressed ${jsonName}`,
            );
        }
    }
    return { bytes, sha256: actual };
}

function parseJson(name: string, bytes: Buffer, problems: string[]): unknown {
    try {
        return JSON.parse(bytes.toString('utf8')) as unknown;
    } catch (err) {
        problems.push(`${name} is not valid JSON: ${(err as Error).message}`);
        return undefined;
    }
}

/** The `const` a package schema gives `package_format`, if it gives one. */
function declaredFormat(schema: unknown): number | undefined {
    if (!isObject(schema)) {
        return undefined;
    }
    const properties = schema['properties'];
    const format = isObject(properties) ? properties['package_format'] : undefined;
    const value = isObject(format) ? format['const'] : undefined;
    return typeof value === 'number' ? value : undefined;
}

/** The companions a package file lists in `manifest.companions`, with every problem of shape. */
function companionsOf(
    data: Record<string, unknown>,
    file: string,
    problems: string[],
): CompanionRef[] {
    const manifest = isObject(data['manifest']) ? data['manifest'] : {};
    const listed = manifest['companions'];
    if (!isObject(listed)) {
        problems.push(`${file} has no manifest.companions`);
        return [];
    }
    const out: CompanionRef[] = [];
    for (const [name, entry] of Object.entries(listed)) {
        const part = isObject(entry) ? entry['part'] : undefined;
        const key = isObject(entry) ? entry['key'] : undefined;
        const hash = isObject(entry) ? entry['sha256'] : undefined;
        const bytes = isObject(entry) ? entry['bytes'] : undefined;
        if (
            typeof part !== 'string' ||
            typeof key !== 'string' ||
            typeof hash !== 'string' ||
            !SHA256.test(hash) ||
            typeof bytes !== 'number' ||
            !Number.isInteger(bytes)
        ) {
            problems.push(`${file}: manifest.companions.${name} is not {part, key, sha256, bytes}`);
            continue;
        }
        out.push({ file: name, part, key, sha256: hash, bytes });
    }
    return out;
}

/** One line per schema error, at most `limit` of them. */
function schemaErrors(name: string, errors: readonly ErrorObject[], limit = 20): string[] {
    const lines = errors.slice(0, limit).map((e) => {
        const where = e.instancePath === '' ? '(root)' : e.instancePath;
        return `${name} is not valid against ${SCHEMA_FILE}: ${where} ${e.message ?? 'is invalid'}`;
    });
    if (errors.length > limit) {
        lines.push(`${name}: ${String(errors.length - limit)} more schema errors`);
    }
    return lines;
}

/**
 * The package schema compiled, and a validator for each companion, found by the
 * `properties.companion.const` its `$defs` entry declares. The schema is written for a
 * draft 2020-12 validator, not for Ajv's strict authoring rules, so those are relaxed except
 * the one that refuses an unknown keyword.
 */
function compileSchema(schema: Record<string, unknown>): {
    validate: ValidateFunction;
    companion: (name: string) => ValidateFunction | undefined;
} {
    const ajv = new Ajv2020({
        allErrors: true,
        strict: false,
        strictSchema: true,
        strictNumbers: true,
    });
    const id =
        typeof schema['$id'] === 'string' ? schema['$id'] : 'https://pychivalry.invalid/spec.json';
    ajv.addSchema({ ...schema, $id: id });
    const validate = ajv.getSchema(id);
    if (validate === undefined) {
        throw new Error(`${SCHEMA_FILE} did not compile`);
    }
    const defs = isObject(schema['$defs']) ? schema['$defs'] : {};
    return {
        validate,
        companion: (name: string) => {
            const def = Object.entries(defs).find(([, value]) => {
                const props = isObject(value) ? value['properties'] : undefined;
                const companion = isObject(props) ? props['companion'] : undefined;
                return isObject(companion) && companion['const'] === name;
            });
            return def === undefined ? undefined : ajv.getSchema(`${id}#/$defs/${def[0]}`);
        },
    };
}

/** The full check's part: every companion, the schema validation, no stray spec file. */
function checkCompanions(
    specDir: string,
    spec: CommittedSpec,
    data: Record<string, unknown>,
    schema: Record<string, unknown> | undefined,
    problems: string[],
): void {
    const compiled = schema === undefined ? undefined : compileSchema(schema);
    if (compiled !== undefined && !compiled.validate(data)) {
        problems.push(...schemaErrors(spec.file, compiled.validate.errors ?? []));
    }
    const packageJson = spec.file.replace(/\.gz$/, '');
    const expectedName = new RegExp(
        `^ck3-spec-${spec.version.replaceAll('.', '\\.')}\\.([a-z_]+)\\.json$`,
    );
    for (const companion of spec.companions) {
        const name = expectedName.exec(companion.file)?.[1];
        if (name === undefined) {
            problems.push(
                `manifest.companions names ${companion.file}, not a ck3-spec-${spec.version}.<name>.json`,
            );
            continue;
        }
        const read = readChecked(specDir, companion.file, problems);
        if (read === undefined) {
            continue;
        }
        if (read.sha256 !== companion.sha256) {
            problems.push(
                `${companion.file}.gz: the SHA-256 of the uncompressed bytes is ${read.sha256}, the package file's manifest.companions says ${companion.sha256}`,
            );
        }
        if (read.bytes.length !== companion.bytes) {
            problems.push(
                `${companion.file}.gz: ${String(read.bytes.length)} bytes uncompressed, the package file's manifest.companions says ${String(companion.bytes)}`,
            );
        }
        const part = data[companion.key];
        const record = isObject(part) && isObject(part['companion']) ? part['companion'] : {};
        if (
            record['file'] !== companion.file ||
            record['sha256'] !== companion.sha256 ||
            record['bytes'] !== companion.bytes
        ) {
            problems.push(
                `${spec.file}: ${companion.key}.companion does not record ${companion.file} with the sha256 and size of manifest.companions`,
            );
        }
        const content = parseJson(`${companion.file}.gz`, read.bytes, problems);
        if (!isObject(content)) {
            continue;
        }
        if (
            content['companion'] !== name ||
            content['package'] !== packageJson ||
            content['version'] !== spec.version ||
            content['package_format'] !== spec.package_format
        ) {
            problems.push(
                `${companion.file}.gz is not the ${name} companion of ${packageJson} (format ${String(spec.package_format)}, version ${spec.version})`,
            );
        }
        if (compiled !== undefined) {
            const validate = compiled.companion(name);
            if (validate === undefined) {
                problems.push(`${SCHEMA_FILE} has no definition for the companion ${name}`);
            } else if (!validate(content)) {
                problems.push(...schemaErrors(`${companion.file}.gz`, validate.errors ?? []));
            }
        }
    }
    const known = new Set([spec.file, ...spec.companions.map((c) => `${c.file}.gz`)]);
    for (const name of readdirSync(specDir).sort()) {
        if (SPEC_FILE.test(name) && !known.has(name)) {
            problems.push(
                `${name} is neither the package file nor a companion it lists; remove it (the format 4 copy belongs in ${LEGACY_DIR}/)`,
            );
        }
    }
}

/** What a check found, with the parsed package when it passed. */
interface PackageRead {
    check: SpecCheck;
    data: Record<string, unknown> | undefined;
}

function readPackage(specDir: string, full: boolean): PackageRead {
    const fail = (problems: string[]): PackageRead => ({
        check: { spec: undefined, problems },
        data: undefined,
    });
    if (!existsSync(specDir)) {
        return fail(['the spec folder is missing']);
    }
    const names = readdirSync(specDir);
    const packages = names.filter((name) => PACKAGE_NAME.test(name));
    if (packages.length !== 1) {
        const raw = names.filter((name) => /^ck3-spec-[0-9.]+[0-9]\.json$/.test(name));
        return fail([
            `the spec folder must hold exactly one ck3-spec-<version>.json.gz; it holds ${String(packages.length)}: ${packages.join(', ') || 'none'}${raw.length > 0 ? ` (and uncompressed ${raw.join(', ')}: the package is committed gzipped)` : ''}`,
        ]);
    }
    const problems: string[] = [];
    const file = packages[0] ?? '';
    const version = PACKAGE_NAME.exec(file)?.[1] ?? '';
    const read = readChecked(specDir, `ck3-spec-${version}.json`, problems);
    if (read === undefined) {
        return fail(problems);
    }
    const data = parseJson(file, read.bytes, problems);
    let packageFormat: number | undefined;
    let companions: CompanionRef[] = [];
    if (isObject(data)) {
        const format = data['package_format'];
        if (typeof format !== 'number' || !Number.isInteger(format)) {
            problems.push(`${file} has no integer package_format`);
        } else {
            packageFormat = format;
            if (format !== PACKAGE_FORMAT) {
                problems.push(
                    `${file} is package format ${String(format)}; the rebuild reads format ${String(PACKAGE_FORMAT)} only (format 4 is release 2.3.0's, in ${LEGACY_DIR}/)`,
                );
            }
        }
        const manifest = isObject(data['manifest']) ? data['manifest'] : {};
        if (manifest['version'] !== version) {
            problems.push(
                `${file} names game version ${JSON.stringify(manifest['version'])} in its manifest, not ${version}`,
            );
        }
        companions = companionsOf(data, file, problems);
    } else if (data !== undefined) {
        problems.push(`${file} is not a JSON object`);
    }

    const schemaFile = path.join(specDir, SCHEMA_FILE);
    let schema: Record<string, unknown> | undefined;
    if (!existsSync(schemaFile)) {
        problems.push(`${SCHEMA_FILE}, the package schema, is missing`);
    } else {
        const parsed = parseJson(SCHEMA_FILE, readFileSync(schemaFile), problems);
        if (isObject(parsed)) {
            schema = parsed;
            const declared = declaredFormat(parsed);
            if (declared === undefined) {
                problems.push(`${SCHEMA_FILE} does not declare package_format as a constant`);
            } else if (packageFormat !== undefined && declared !== packageFormat) {
                problems.push(
                    `${SCHEMA_FILE} is the schema of package format ${String(declared)}, but ${file} is format ${String(packageFormat)}`,
                );
            }
        }
    }

    if (packageFormat === undefined || !isObject(data) || problems.length > 0) {
        return fail(problems);
    }
    const spec: CommittedSpec = {
        version,
        file,
        compressed: true,
        sha256: read.sha256,
        package_format: packageFormat,
        companions,
    };
    if (full) {
        checkCompanions(specDir, spec, data, schema, problems);
        if (problems.length > 0) {
            return fail(problems);
        }
    }
    return { check: { spec, problems }, data };
}

/**
 * Find and verify the spec package in `specDir`. The default check is the package file's
 * own: its checksum, its format, its game version and the schema's format, which is what a
 * suite or the record check needs to name the spec. `full` adds the companions, the schema
 * validation of every file and the refusal of stray files: `task spec:check`.
 */
export function checkSpec(specDir: string, options: { full?: boolean } = {}): SpecCheck {
    return readPackage(specDir, options.full === true).check;
}

/**
 * The format 4 copy in `<specDir>/legacy/`: exactly one `ck3-spec-<version>.format4.json.gz`,
 * its `.format4.sha256`, package format 4 and the game version its name states. Only release
 * 2.3.0 reads it; nothing in the rebuild does.
 */
export function checkLegacySpec(specDir: string): LegacySpecCheck {
    const dir = path.join(specDir, LEGACY_DIR);
    if (!existsSync(dir)) {
        return { legacy: undefined, problems: [`${LEGACY_DIR}/, the format 4 copy, is missing`] };
    }
    const files = readdirSync(dir).filter((name) => LEGACY_NAME.test(name));
    if (files.length !== 1) {
        return {
            legacy: undefined,
            problems: [
                `${LEGACY_DIR}/ must hold exactly one ck3-spec-<version>.format4.json.gz; it holds ${String(files.length)}: ${files.join(', ') || 'none'}`,
            ],
        };
    }
    const problems: string[] = [];
    const file = files[0] ?? '';
    const version = LEGACY_NAME.exec(file)?.[1] ?? '';
    const read = readChecked(dir, `ck3-spec-${version}.format4.json`, problems);
    if (read === undefined) {
        return { legacy: undefined, problems: problems.map((p) => `${LEGACY_DIR}/${p}`) };
    }
    const data = parseJson(file, read.bytes, problems);
    const format = isObject(data) ? data['package_format'] : undefined;
    if (format !== LEGACY_PACKAGE_FORMAT) {
        problems.push(
            `${file} is package format ${JSON.stringify(format)}, not ${String(LEGACY_PACKAGE_FORMAT)}`,
        );
    }
    const manifest = isObject(data) && isObject(data['manifest']) ? data['manifest'] : {};
    if (manifest['version'] !== version) {
        problems.push(
            `${file} names game version ${JSON.stringify(manifest['version'])} in its manifest, not ${version}`,
        );
    }
    if (problems.length > 0) {
        return { legacy: undefined, problems: problems.map((p) => `${LEGACY_DIR}/${p}`) };
    }
    return {
        legacy: {
            version,
            file: `${LEGACY_DIR}/${file}`,
            sha256: read.sha256,
            package_format: LEGACY_PACKAGE_FORMAT,
        },
        problems,
    };
}

/**
 * Everything `task spec:check` verifies about the spec folder but the rules table: the full
 * check of the package, the format 4 copy, and that both are for the same game version.
 */
export function checkSpecFolder(specDir: string): {
    spec: CommittedSpec | undefined;
    legacy: LegacySpec | undefined;
    problems: string[];
} {
    const { spec, problems } = checkSpec(specDir, { full: true });
    const { legacy, problems: legacyProblems } = checkLegacySpec(specDir);
    const all = [...problems, ...legacyProblems];
    if (spec !== undefined && legacy !== undefined && spec.version !== legacy.version) {
        all.push(
            `${legacy.file} is for game ${legacy.version}, the package for ${spec.version}: the format 4 copy must be of the same game version`,
        );
    }
    return all.length === 0
        ? { spec, legacy, problems: all }
        : { spec: undefined, legacy: undefined, problems: all };
}
