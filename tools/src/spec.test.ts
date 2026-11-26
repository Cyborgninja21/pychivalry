import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { rmSync } from 'node:fs';
import { BUCKET_NAMES, openSpec, PART_KEYS } from '@pychivalry/core';
import { checkRulesTable, rulesUse } from './rules-table.js';
import {
    checkLegacySpec,
    checkSpec,
    checkSpecFolder,
    gzipHeaderProblems,
    PACKAGE_FORMAT,
    SCHEMA_FILE,
} from './spec.js';
import { tempDir, writeTree } from './testing.js';
import { repoRoot, sha256 } from './util.js';

const VERSION = '1.21.0.3';
const PACKAGE = `ck3-spec-${VERSION}.json`;
const INFO = `ck3-spec-${VERSION}.info.json`;
const LEGACY = `ck3-spec-${VERSION}.format4.json`;

interface FolderOptions {
    format?: number;
    schemaFormat?: number;
    /** What the package's manifest says of the companion, over what it really is. */
    companionRecord?: Partial<{ sha256: string; bytes: number }>;
    /** The companion's own header, over the right one. */
    companionHeader?: Record<string, unknown>;
    legacyFormat?: number;
    legacyVersion?: string;
}

/** A small, valid spec folder: a format 9 package, one companion, the schema, the format 4 copy. */
function specFolder(dir: string, options: FolderOptions = {}): string {
    const companion = Buffer.from(
        JSON.stringify({
            companion: 'info',
            package: PACKAGE,
            package_format: 9,
            version: VERSION,
            data: {},
            ...options.companionHeader,
        }),
    );
    const record = {
        sha256: sha256(companion),
        bytes: companion.length,
        ...options.companionRecord,
    };
    const json = Buffer.from(
        JSON.stringify({
            package_format: options.format ?? 9,
            manifest: {
                version: VERSION,
                companions: { [INFO]: { part: 'C1', key: 'info_docs', ...record } },
            },
            info_docs: { status: 'built', companion: { file: INFO, ...record } },
        }),
    );
    const legacy = Buffer.from(
        JSON.stringify({
            package_format: options.legacyFormat ?? 4,
            manifest: { version: options.legacyVersion ?? VERSION },
        }),
    );
    writeTree(dir, {
        [`${PACKAGE}.gz`]: gzipSync(json),
        [`ck3-spec-${VERSION}.sha256`]: `${sha256(json)}  ${PACKAGE}\n`,
        [`${INFO}.gz`]: gzipSync(companion),
        [`ck3-spec-${VERSION}.info.sha256`]: `${sha256(companion)}  ${INFO}\n`,
        [SCHEMA_FILE]: JSON.stringify({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $id: 'https://example.invalid/schema.format9.json',
            type: 'object',
            required: ['package_format', 'manifest'],
            properties: { package_format: { const: options.schemaFormat ?? 9 } },
            $defs: {
                companionInfo: {
                    type: 'object',
                    required: ['companion', 'data'],
                    properties: { companion: { const: 'info' }, data: { type: 'object' } },
                },
            },
        }),
        [`legacy/${LEGACY}.gz`]: gzipSync(legacy),
        [`legacy/ck3-spec-${VERSION}.format4.sha256`]: `${sha256(legacy)}  ${LEGACY}\n`,
    });
    return dir;
}

test('the committed spec folder passes the full check: the package, its companions, the schema, the format 4 copy', () => {
    const check = checkSpecFolder(path.join(repoRoot(), 'spec'));
    assert.deepEqual(check.problems, []);
    assert.equal(check.spec?.package_format, PACKAGE_FORMAT);
    assert.equal(check.spec.version, check.legacy?.version);
    assert.deepEqual(
        check.spec.companions.map((c) => c.key),
        ['data_types', 'gui', 'info_docs'],
    );
    assert.equal(check.legacy?.package_format, 4);
    assert.equal(check.legacy.file, `legacy/ck3-spec-${check.spec.version}.format4.json.gz`);
});

test("the committed package reads as format 9 through the core's spec reader, the one the suites use", () => {
    const spec = openSpec(path.join(repoRoot(), 'spec'));
    assert.equal(spec.data.package_format, 9);
    assert.equal(spec.sha256, checkSpec(path.join(repoRoot(), 'spec')).spec?.sha256);
    assert.ok(Array.isArray(spec.data.directories));
    assert.ok(Array.isArray(spec.data.errors));
});

test('a small valid folder passes, and the default check leaves the companions alone', (t) => {
    const dir = specFolder(tempDir(t));
    assert.deepEqual(checkSpecFolder(dir).problems, []);
    rmSync(path.join(dir, `${INFO}.gz`));
    assert.deepEqual(checkSpec(dir).problems, []);
    assert.match(checkSpec(dir, { full: true }).problems.join('\n'), /\.info\.json\.gz is missing/);
});

test('a wrong checksum of the package fails', (t) => {
    const dir = specFolder(tempDir(t));
    writeTree(dir, { [`ck3-spec-${VERSION}.sha256`]: `${'0'.repeat(64)}  ${PACKAGE}\n` });
    const check = checkSpec(dir);
    assert.equal(check.spec, undefined);
    assert.match(check.problems.join('\n'), /ck3-spec-1\.21\.0\.3\.sha256 says 0{64}/);
});

test('a package of format 4, 5, 7 or 8 fails: the rebuild reads format 9 only', (t) => {
    for (const format of [4, 5, 7, 8]) {
        const check = checkSpec(specFolder(tempDir(t), { format, schemaFormat: format }));
        assert.equal(check.spec, undefined);
        assert.match(
            check.problems.join('\n'),
            new RegExp(`package format ${String(format)}; the rebuild reads format 9 only`),
        );
    }
});

test('a schema of another format than the package fails', (t) => {
    const check = checkSpec(specFolder(tempDir(t), { schemaFormat: 5 }));
    assert.match(check.problems.join('\n'), /schema of package format 5, but .* is format 9/);
});

test('two packages, or a package committed uncompressed, fail', (t) => {
    const dir = specFolder(tempDir(t));
    writeTree(dir, { 'ck3-spec-1.20.0.2.json.gz': gzipSync('{}') });
    assert.match(checkSpec(dir).problems.join('\n'), /exactly one/);
    const raw = specFolder(tempDir(t));
    rmSync(path.join(raw, `${PACKAGE}.gz`));
    writeTree(raw, { [PACKAGE]: '{}' });
    assert.match(checkSpec(raw).problems.join('\n'), /the package is committed gzipped/);
});

test('a companion whose checksum or size is not what the package states fails', (t) => {
    const wrongSha = checkSpec(
        specFolder(tempDir(t), { companionRecord: { sha256: 'e'.repeat(64) } }),
        { full: true },
    );
    assert.match(wrongSha.problems.join('\n'), /manifest\.companions says e{64}/);
    const wrongSize = checkSpec(specFolder(tempDir(t), { companionRecord: { bytes: 1 } }), {
        full: true,
    });
    assert.match(
        wrongSize.problems.join('\n'),
        /bytes uncompressed, the package file's manifest\.companions says 1/,
    );
});

test("a companion without its .sha256, or another package's companion, fails", (t) => {
    const dir = specFolder(tempDir(t));
    rmSync(path.join(dir, `ck3-spec-${VERSION}.info.sha256`));
    assert.match(
        checkSpec(dir, { full: true }).problems.join('\n'),
        /ck3-spec-1\.21\.0\.3\.info\.sha256 is missing/,
    );
    const other = checkSpec(
        specFolder(tempDir(t), { companionHeader: { package: 'ck3-spec-1.20.0.2.json' } }),
        { full: true },
    );
    assert.match(
        other.problems.join('\n'),
        /is not the info companion of ck3-spec-1\.21\.0\.3\.json/,
    );
});

test('a companion that fails the schema, and a stray spec file, fail', (t) => {
    const invalid = checkSpec(specFolder(tempDir(t), { companionHeader: { data: 'none' } }), {
        full: true,
    });
    assert.match(invalid.problems.join('\n'), /is not valid against schema\.format9\.json: \/data/);
    const dir = specFolder(tempDir(t));
    writeTree(dir, { 'ck3-spec-1.21.0.3.extra.json.gz': gzipSync('{}') });
    assert.match(
        checkSpec(dir, { full: true }).problems.join('\n'),
        /extra\.json\.gz is neither the package file nor a companion it lists/,
    );
});

test('a gzip file that stores a name or a time fails: the committed bytes must be reproducible', () => {
    const plain = gzipSync('{}');
    assert.deepEqual(gzipHeaderProblems('a.json.gz', plain), []);
    const named = Buffer.from(plain);
    named[3] = 0x08;
    named.writeUInt32LE(1_700_000_000, 4);
    assert.match(
        gzipHeaderProblems('a.json.gz', named).join('\n'),
        /stores a file name, a modification time; compress it with gzip -n -9/,
    );
    assert.match(gzipHeaderProblems('a.json.gz', Buffer.from('{}')).join('\n'), /not a gzip file/);
});

test('the format 4 copy must exist, pass its checksum, be format 4 and be of the same game version', (t) => {
    const missing = specFolder(tempDir(t));
    rmSync(path.join(missing, 'legacy'), { recursive: true });
    assert.match(
        checkLegacySpec(missing).problems.join('\n'),
        /legacy\/, the format 4 copy, is missing/,
    );
    const wrongSha = specFolder(tempDir(t));
    writeTree(wrongSha, {
        [`legacy/ck3-spec-${VERSION}.format4.sha256`]: `${'1'.repeat(64)}  ${LEGACY}\n`,
    });
    assert.match(checkLegacySpec(wrongSha).problems.join('\n'), /^legacy\/.* says 1{64}/);
    assert.match(
        checkLegacySpec(specFolder(tempDir(t), { legacyFormat: 5 })).problems.join('\n'),
        /is package format 5, not 4/,
    );
    const otherVersion = specFolder(tempDir(t));
    const legacy = Buffer.from(
        JSON.stringify({ package_format: 4, manifest: { version: '1.20.0.2' } }),
    );
    rmSync(path.join(otherVersion, 'legacy'), { recursive: true });
    writeTree(otherVersion, {
        'legacy/ck3-spec-1.20.0.2.format4.json.gz': gzipSync(legacy),
        'legacy/ck3-spec-1.20.0.2.format4.sha256': `${sha256(legacy)}  ck3-spec-1.20.0.2.format4.json\n`,
    });
    assert.deepEqual(checkLegacySpec(otherVersion).problems, []);
    assert.match(
        checkSpecFolder(otherVersion).problems.join('\n'),
        /is for game 1\.20\.0\.2, the package for 1\.21\.0\.3/,
    );
});

test("the committed package's rules table (part D1) reads with the core's reader", () => {
    const check = checkRulesTable(path.join(repoRoot(), 'spec'));
    assert.deepEqual(check.problems, []);
    assert.equal(check.table?.rules.length, 95);
    assert.match(check.sha256 ?? '', /^[0-9a-f]{64}$/);
    for (const use of rulesUse(check.table)) {
        assert.equal(use.applied + use.not_settled + use.skipped > 0, true, use.platform);
        // msg-localization-missing-bom: a skipped kind whose file_condition is applied.
        assert.equal(use.file_conditions, 1, use.platform);
    }
});

/** A small package the core's reader opens, with a rules table of its own. */
function corePackage(dir: string, rules: unknown): void {
    const json = Buffer.from(
        JSON.stringify({
            package_format: 9,
            manifest: { game: 'ck3', version: VERSION, companions: {} },
            parts: [],
            buckets: Object.fromEntries(BUCKET_NAMES.map((b) => [b, {}])),
            multi_bucket: {},
            iterator_prefixes: [],
            keyword_templates: [],
            modifier_templates: [],
            modifier_template_marks: {},
            directories: [],
            schema: {},
            errors: [],
            retired: [],
            scope_validity: { triggers: {}, effects: {}, lists: {}, on_actions: {}, links: {} },
            scope_types: {},
            tables: { status: 'built', data: {} },
            modifier_template_tags: { status: 'built', data: {} },
            ...Object.fromEntries(PART_KEYS.map((k) => [k, { status: 'built', data: {} }])),
            saved_from_code: { status: 'built', data: { names: [] } },
            not_scope_types: { status: 'built', data: { values: {} } },
            override_rules: rules,
        }),
    );
    writeTree(dir, {
        [`${PACKAGE}.gz`]: gzipSync(json),
        [`ck3-spec-${VERSION}.sha256`]: `${sha256(json)}  ${PACKAGE}\n`,
    });
}

test('a rules table the core refuses fails the spec check', (t) => {
    const row = {
        id: 'a',
        overrides_rule: 5,
        title: 'A row',
        kind: 'key-resolution',
        databases: ['common/traits'],
        resolve: 'all',
        status: 'settled',
        platforms: ['linux'],
        platform_basis: { linux: { basis: 'read', text: 'a test' } },
        evidence: [{ rank: 4, source: 's', where: 'w', says: 'x' }],
    };
    const table = (rules: unknown[]): unknown => ({
        status: 'built',
        data: { format: 1, game_build: VERSION, rules },
    });
    const ok = tempDir(t);
    corePackage(ok, table([row]));
    assert.deepEqual(checkRulesTable(ok).problems, []);
    const kind = tempDir(t);
    corePackage(kind, table([{ ...row, kind: 'guess' }]));
    assert.ok(checkRulesTable(kind).problems.length > 0);
    // Two rows answering one question: the core refuses them.
    const overlap = tempDir(t);
    corePackage(overlap, table([row, { ...row, id: 'b' }]));
    assert.match(checkRulesTable(overlap).problems.join('\n'), /rows a and b both answer/);
    const none = tempDir(t);
    corePackage(none, { status: 'not_built', reason: 'a test' });
    assert.match(checkRulesTable(none).problems.join('\n'), /does not carry part D1/);
    assert.match(checkRulesTable(tempDir(t)).problems.join('\n'), /exactly one/);
});
