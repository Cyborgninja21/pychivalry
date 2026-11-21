/**
 * The committed spec package (spec/README.md): exactly one `ck3-spec-<version>.json` or
 * `.json.gz`, a `.sha256` of its uncompressed bytes, and the package's `schema.json`.
 * `task spec:check` verifies the checksum and that the package's format is one this
 * repository supports.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isObject, sha256 } from './util.js';

/**
 * Package formats this repository accepts. 4 is the format of the 1.20.0.2 package that
 * release 2.3.0 shipped, committed as a stand-in; 5 is the format the rebuild's spec reader
 * (docs/PLAN.md, item 4.2) is written against.
 */
export const SUPPORTED_PACKAGE_FORMATS: readonly number[] = [4, 5];

export interface CommittedSpec {
    /** The game version in the file name, `ck3-spec-<version>.json`. */
    version: string;
    /** The package file, relative to the spec folder. */
    file: string;
    compressed: boolean;
    /** SHA-256 of the uncompressed bytes, as the `.sha256` file states and the bytes confirm. */
    sha256: string;
    package_format: number;
}

export interface SpecCheck {
    spec: CommittedSpec | undefined;
    problems: string[];
}

const PACKAGE_NAME = /^ck3-spec-([0-9]+(?:\.[0-9]+)+)\.json(\.gz)?$/;

/** Find and verify the spec package in `specDir`. */
export function checkSpec(specDir: string): SpecCheck {
    const problems: string[] = [];
    if (!existsSync(specDir)) {
        return { spec: undefined, problems: ['the spec folder is missing'] };
    }
    const packages = readdirSync(specDir).filter((name) => PACKAGE_NAME.test(name));
    if (packages.length !== 1) {
        return {
            spec: undefined,
            problems: [
                `the spec folder must hold exactly one ck3-spec-<version>.json[.gz]; it holds ${String(packages.length)}: ${packages.join(', ') || 'none'}`,
            ],
        };
    }
    const file = packages[0] ?? '';
    const match = PACKAGE_NAME.exec(file);
    const version = match?.[1] ?? '';
    const compressed = match?.[2] !== undefined;

    const shaFile = path.join(specDir, `ck3-spec-${version}.sha256`);
    let expected: string | undefined;
    if (!existsSync(shaFile)) {
        problems.push(`ck3-spec-${version}.sha256 is missing`);
    } else {
        const [hash, name] = readFileSync(shaFile, 'utf8').trim().split(/\s+/);
        if (hash === undefined || !/^[0-9a-f]{64}$/i.test(hash)) {
            problems.push(`ck3-spec-${version}.sha256 does not start with a SHA-256`);
        } else {
            expected = hash.toLowerCase();
        }
        if (name !== undefined && name.replace(/^\*/, '') !== `ck3-spec-${version}.json`) {
            problems.push(
                `ck3-spec-${version}.sha256 names ${name}, not the uncompressed ck3-spec-${version}.json`,
            );
        }
    }

    const raw = readFileSync(path.join(specDir, file));
    let bytes: Buffer;
    try {
        bytes = compressed ? gunzipSync(raw) : raw;
    } catch (err) {
        return {
            spec: undefined,
            problems: [...problems, `${file} is not valid gzip: ${(err as Error).message}`],
        };
    }
    const actual = sha256(bytes);
    if (expected !== undefined && actual !== expected) {
        problems.push(
            `${file}: the SHA-256 of the uncompressed bytes is ${actual}, the checksum file says ${expected}`,
        );
    }

    let packageFormat: number | undefined;
    try {
        const data = JSON.parse(bytes.toString('utf8')) as unknown;
        const format = isObject(data) ? data['package_format'] : undefined;
        if (typeof format !== 'number' || !Number.isInteger(format)) {
            problems.push(`${file} has no integer package_format`);
        } else {
            packageFormat = format;
            if (!SUPPORTED_PACKAGE_FORMATS.includes(format)) {
                problems.push(
                    `${file} is package format ${String(format)}; this repository supports ${SUPPORTED_PACKAGE_FORMATS.join(', ')}`,
                );
            }
        }
    } catch (err) {
        problems.push(`${file} is not valid JSON: ${(err as Error).message}`);
    }

    const schemaFile = path.join(specDir, 'schema.json');
    if (!existsSync(schemaFile)) {
        problems.push('schema.json, the package schema, is missing');
    } else if (packageFormat !== undefined) {
        const declared = declaredFormat(JSON.parse(readFileSync(schemaFile, 'utf8')) as unknown);
        if (declared === undefined) {
            problems.push('schema.json does not declare package_format as a constant');
        } else if (declared !== packageFormat) {
            problems.push(
                `schema.json is the schema of package format ${String(declared)}, but ${file} is format ${String(packageFormat)}`,
            );
        }
    }

    if (expected === undefined || packageFormat === undefined || problems.length > 0) {
        return { spec: undefined, problems };
    }
    return {
        spec: { version, file, compressed, sha256: actual, package_format: packageFormat },
        problems,
    };
}

/** The `const` the package schema gives `package_format`, if it gives one. */
function declaredFormat(schema: unknown): number | undefined {
    if (!isObject(schema)) {
        return undefined;
    }
    const properties = schema['properties'];
    const format = isObject(properties) ? properties['package_format'] : undefined;
    const value = isObject(format) ? format['const'] : undefined;
    return typeof value === 'number' ? value : undefined;
}

/**
 * The committed spec package, parsed, once it passes its check. Build step 2 reads only its
 * error catalogue (`errors`), for the evidence of parse findings; the spec reader proper is
 * item 4.2.
 */
export function readSpecPackage(specDir: string): unknown {
    const check = checkSpec(specDir);
    if (check.spec === undefined) {
        throw new Error(
            `the committed spec package fails its check:\n  ${check.problems.join('\n  ')}`,
        );
    }
    const raw = readFileSync(path.join(specDir, check.spec.file));
    const bytes = check.spec.compressed ? gunzipSync(raw) : raw;
    return JSON.parse(bytes.toString('utf8')) as unknown;
}
