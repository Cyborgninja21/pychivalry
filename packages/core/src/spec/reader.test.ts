import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { dataTypesOf } from './data-types.js';
import { BUCKET_NAMES } from './package.js';
import {
    openSpec,
    readChecksumFile,
    readCompanion,
    readSpec,
    sha256Hex,
    SPEC_FORMAT,
    SpecError,
} from './reader.js';
import { committedSpec, REPO_ROOT } from './testing.js';

const specDir = path.join(REPO_ROOT, 'spec');

test('the committed package opens: format 5, game 1.21.0.3, the checksum its .sha256 states', () => {
    const spec = committedSpec();
    assert.equal(spec.data.package_format, SPEC_FORMAT);
    assert.equal(spec.version, '1.21.0.3');
    const stated = readChecksumFile(
        readFileSync(path.join(specDir, 'ck3-spec-1.21.0.3.sha256'), 'utf8'),
        'ck3-spec-1.21.0.3.json',
    );
    assert.equal(spec.sha256, stated);
    assert.equal(spec.dir, specDir);
});

test('the package is read once per process: a second open is the same object', () => {
    assert.equal(openSpec(specDir), committedSpec());
});

test('the typed package holds the counts docs/references/spec-package.md states', () => {
    const { data } = committedSpec();
    const counts = Object.fromEntries(
        BUCKET_NAMES.map((b) => [b, Object.keys(data.buckets[b]).length]),
    );
    assert.deepEqual(counts, {
        triggers: 1598,
        effects: 1105,
        links: 361,
        lists: 436,
        on_actions: 233,
        modifiers: 778,
    });
    assert.equal(data.errors.length, 2023);
    assert.equal(Object.keys(data.schema).length, 198);
    assert.equal(Object.keys(data.scope_types).length, 86);
    assert.equal(Object.keys(data.tables.data).length, 19);
    const takesNull = (['triggers', 'effects'] as const)
        .flatMap((b) => Object.values(data.buckets[b]))
        .filter((e) => e.takes === null).length;
    assert.equal(takesNull, 628);
    assert.ok(Object.values(data.buckets.modifiers).every((m) => m.use_areas !== undefined));
});

function tempDir(t: { after: (fn: () => void) => void }): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-spec-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A small format 5 package with the keys the reader checks. */
function smallPackage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        package_format: 5,
        manifest: { game: 'ck3', version: '9.9.9.9', companions: {} },
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
        ...overrides,
    };
}

test('a package whose uncompressed bytes do not match the stated checksum is refused', () => {
    const json = Buffer.from(JSON.stringify(smallPackage()));
    assert.throws(() => readSpec(gzipSync(json), '0'.repeat(64)), SpecError);
    const spec = readSpec(gzipSync(json), sha256Hex(json));
    assert.equal(spec.version, '9.9.9.9');
});

test('a package of another format, without the format 5 keys, or of another version is refused', () => {
    const four = Buffer.from(JSON.stringify(smallPackage({ package_format: 4 })));
    assert.throws(() => readSpec(gzipSync(four), sha256Hex(four)), /format 4/);
    const bare = Buffer.from(JSON.stringify({ package_format: 5, manifest: { version: '1' } }));
    assert.throws(() => readSpec(gzipSync(bare), sha256Hex(bare)), /not a format 5 package/);
    const json = Buffer.from(JSON.stringify(smallPackage()));
    assert.throws(
        () => readSpec(gzipSync(json), sha256Hex(json), { version: '1.0.0.0' }),
        /names game version 9\.9\.9\.9/,
    );
    assert.throws(() => readSpec(Buffer.from('not gzip'), sha256Hex(json)), /not valid gzip/);
});

test('a checksum file must name the uncompressed file it is for', () => {
    const hash = 'a'.repeat(64);
    assert.equal(readChecksumFile(`${hash}  x.json\n`, 'x.json'), hash);
    assert.throws(() => readChecksumFile(`${hash}  y.json\n`, 'x.json'), /names y\.json/);
    assert.throws(() => readChecksumFile('nothing', 'x.json'), /SHA-256/);
});

test('a companion opens on demand, checked against the package; its lookups return lists', () => {
    const spec = committedSpec();
    const info = spec.companion('info_docs');
    assert.equal(info.package, 'ck3-spec-1.21.0.3.json');
    assert.equal(info.part.key, 'info_docs');
    assert.equal(spec.companion('info_docs'), info);
    const types = dataTypesOf(spec);
    const player = types.global('GetPlayer');
    assert.ok(player.length >= 2, 'GetPlayer has several entries in the dump');
    assert.deepEqual(types.global('NoSuchGlobalAnywhere'), []);
    assert.deepEqual(types.member('NoSuchType', 'Anything'), []);
    assert.ok(types.counts.globals > 4000 && types.counts.types > 1000);
});

test('a companion whose bytes differ from the record the package keeps is refused', (t) => {
    const spec = committedSpec();
    const { file, record } = spec.companionRecord('gui');
    const altered = gzipSync(Buffer.from('{}'));
    assert.throws(() => readCompanion(altered, file, record, spec), /SHA-256/);
    const json = Buffer.from(JSON.stringify({ companion: 'gui', data: {} }));
    assert.throws(
        () =>
            readCompanion(gzipSync(json), file, { ...record, sha256: sha256Hex(json), bytes: json.length }, spec),
        /is not the gui companion/,
    );
    // A folder with the package and no companions: opening one says it is missing.
    const dir = tempDir(t);
    for (const name of ['ck3-spec-1.21.0.3.json.gz', 'ck3-spec-1.21.0.3.sha256']) {
        copyFileSync(path.join(specDir, name), path.join(dir, name));
    }
    const lone = openSpec(dir);
    assert.notEqual(lone, spec);
    assert.throws(() => lone.companion('data_types'), /is missing/);
});

test('a spec folder must hold exactly one package file and its checksum file', (t) => {
    const dir = tempDir(t);
    assert.throws(() => openSpec(dir), /exactly one/);
    writeFileSync(path.join(dir, 'ck3-spec-9.9.9.9.json.gz'), gzipSync('{}'));
    assert.throws(() => openSpec(dir), /sha256 is missing/);
    assert.throws(() => openSpec(path.join(dir, 'missing')), /missing/);
});
