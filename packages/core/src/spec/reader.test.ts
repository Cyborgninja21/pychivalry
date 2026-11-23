import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { dataTypesOf } from './data-types.js';
import { BUCKET_NAMES, PART_KEYS } from './package.js';
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

test('the committed package opens: format 8, game 1.21.0.3, the checksum its .sha256 states', () => {
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
    assert.equal(data.directories.length, 239);
});

test('the eight parts of formats 6 to 8 are built, typed, each row with its status and evidence', () => {
    const spec = committedSpec();
    const built = spec.data.parts.filter((p) => /^D[1-8]$/.test(p.id) && p.status === 'built');
    assert.equal(built.length, 8);
    const rules = spec.part('override_rules');
    assert.equal(rules?.rules.length, 95);
    assert.equal(rules.coverage.length, 239);
    const declarations = spec.part('declarations');
    assert.equal(declarations?.directories['events']?.[0]?.declares, 'namespace');
    const definitions = spec.part('definitions');
    const nested = Object.values(definitions?.nested ?? {}).flat();
    assert.equal(nested.length, 41);
    // Format 8: every nested row says the scope of its name; a gene's has a qualifier.
    const scopes = new Map<string, number>();
    for (const row of nested) {
        scopes.set(row.name_scope, (scopes.get(row.name_scope) ?? 0) + 1);
    }
    assert.deepEqual(Object.fromEntries(scopes), { parent: 20, global: 19, unknown: 2 });
    const track = definitions?.nested['common/traits']?.[0];
    assert.deepEqual([track?.kind, track?.name_scope, track?.scope_parent], ['trait_track', 'parent', 'record']);
    const gene = definitions?.nested['common/genes']?.[1];
    assert.equal(gene?.name_scope_qualifier?.statement, 'portrait_group');
    // Format 8: an alias line in D2, and the D1 fields that say a decision as data.
    const alias = declarations.directories['common/coat_of_arms/coat_of_arms']?.[1];
    assert.deepEqual(alias?.alias, { of: 'value', rule: 'coat-of-arms-alias' });
    const byId = new Map(rules.rules.map((r) => [r['id'], r]));
    assert.ok(byId.get('special-genes-container')?.['entries'] !== undefined);
    assert.ok(byId.get('coat-of-arms-alias')?.['alias'] !== undefined);
    assert.ok(byId.get('msg-localization-missing-bom')?.['file_condition'] !== undefined);
    assert.equal(spec.part('keyword_roles')?.keywords.length, 61);
    const loc = Object.values(spec.part('implicit_loc_keys')?.directories ?? {}).flat();
    assert.equal(loc.length, 710);
    assert.equal(spec.part('field_references')?.fields.length, 922);
    assert.equal(spec.part('modifier_block_areas')?.fields.length, 208);
    const kinds = Object.fromEntries(
        (spec.part('iterator_kinds')?.prefixes ?? []).map((p) => [p.prefix, p.kind]),
    );
    assert.deepEqual(kinds, { any_: 'trigger', every_: 'effect', random_: 'effect', ordered_: 'effect' });
    assert.equal(spec.part('iterator_kinds')?.departures.length, 146);
    // Every row of every part carries a status and its evidence.
    const rows = [
        ...rules.rules,
        ...Object.values(declarations.directories).flat(),
        ...nested,
        ...(spec.part('keyword_roles')?.keywords ?? []),
        ...loc,
        ...(spec.part('field_references')?.fields ?? []),
        ...(spec.part('modifier_block_areas')?.fields ?? []),
        ...(spec.part('iterator_kinds')?.prefixes ?? []),
    ];
    for (const row of rows) {
        assert.equal(typeof row.status, 'string');
        assert.ok(Array.isArray(row.evidence));
    }
    // Read once per process: the same object every time.
    assert.equal(spec.part('override_rules'), rules);
});

function tempDir(t: { after: (fn: () => void) => void }): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-spec-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A small format 8 package with the keys the reader checks. */
function smallPackage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        package_format: 8,
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
        modifier_template_tags: { status: 'built', data: {} },
        ...Object.fromEntries(PART_KEYS.map((k) => [k, { status: 'built', data: {} }])),
        ...overrides,
    };
}

test('a package whose uncompressed bytes do not match the stated checksum is refused', () => {
    const json = Buffer.from(JSON.stringify(smallPackage()));
    assert.throws(() => readSpec(gzipSync(json), '0'.repeat(64)), SpecError);
    const spec = readSpec(gzipSync(json), sha256Hex(json));
    assert.equal(spec.version, '9.9.9.9');
});

test('a package of another format, without the format 8 keys, or of another version is refused', () => {
    const four = Buffer.from(JSON.stringify(smallPackage({ package_format: 4 })));
    assert.throws(() => readSpec(gzipSync(four), sha256Hex(four)), /format 4/);
    // Formats 5 and 7 are refused: the index reads keys only format 8 carries.
    for (const format of [5, 7]) {
        const old = Buffer.from(JSON.stringify(smallPackage({ package_format: format })));
        assert.throws(
            () => readSpec(gzipSync(old), sha256Hex(old)),
            new RegExp(`format ${String(format)}; the rebuild reads format 8 only`),
        );
    }
    const bare = Buffer.from(JSON.stringify({ package_format: 8, manifest: { version: '1' } }));
    assert.throws(() => readSpec(gzipSync(bare), sha256Hex(bare)), /not a format 8 package/);
    // A nested row of D3 without the scope of its name is format 7's shape.
    const unscoped = Buffer.from(
        JSON.stringify(
            smallPackage({
                definitions: {
                    status: 'built',
                    data: { nested: { 'common/a': [{ kind: 'a', status: 'confirmed', evidence: [] }] } },
                },
            }),
        ),
    );
    assert.throws(
        () => readSpec(gzipSync(unscoped), sha256Hex(unscoped)),
        /definitions\.data\.nested\.common\/a\[0\] has no name_scope/,
    );
    const noPart = Buffer.from(JSON.stringify(smallPackage({ iterator_kinds: undefined })));
    assert.throws(() => readSpec(gzipSync(noPart), sha256Hex(noPart)), /no iterator_kinds part/);
    const unbuilt = Buffer.from(
        JSON.stringify(smallPackage({ keyword_roles: { status: 'not_built', reason: 'a test' } })),
    );
    assert.equal(readSpec(gzipSync(unbuilt), sha256Hex(unbuilt)).part('keyword_roles'), null);
    const empty = Buffer.from(JSON.stringify(smallPackage({ keyword_roles: { status: 'built' } })));
    assert.throws(() => readSpec(gzipSync(empty), sha256Hex(empty)), /keyword_roles is built but has no data/);
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
