import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { copyFileSync } from 'node:fs';
import { checkRulesTable, RULES_FILE, RULES_SCHEMA_FILE } from './rules-table.js';
import { checkSpec, SUPPORTED_PACKAGE_FORMATS } from './spec.js';
import { tempDir, writeTree } from './testing.js';
import { repoRoot, sha256 } from './util.js';

/** A spec folder holding a small package of `format`, with a schema of `schemaFormat`. */
function specFolder(
    dir: string,
    options: { format?: number; schemaFormat?: number; checksum?: string; gzip?: boolean } = {},
): string {
    const format = options.format ?? 4;
    const json = Buffer.from(JSON.stringify({ package_format: format, manifest: {} }));
    const name = options.gzip === false ? 'ck3-spec-1.21.0.3.json' : 'ck3-spec-1.21.0.3.json.gz';
    writeTree(dir, {
        [name]: options.gzip === false ? json : gzipSync(json),
        'ck3-spec-1.21.0.3.sha256': `${options.checksum ?? sha256(json)}  ck3-spec-1.21.0.3.json\n`,
        'schema.json': JSON.stringify({
            properties: { package_format: { const: options.schemaFormat ?? format } },
        }),
    });
    return dir;
}

test('the committed spec package passes its check', () => {
    const check = checkSpec(path.join(repoRoot(), 'spec'));
    assert.deepEqual(check.problems, []);
    assert.ok(check.spec !== undefined);
    assert.ok(SUPPORTED_PACKAGE_FORMATS.includes(check.spec.package_format));
});

test('a compressed and an uncompressed package both pass', (t) => {
    assert.deepEqual(checkSpec(specFolder(tempDir(t))).problems, []);
    const raw = checkSpec(specFolder(tempDir(t), { gzip: false }));
    assert.deepEqual(raw.problems, []);
    assert.ok(raw.spec !== undefined);
    assert.equal(raw.spec.compressed, false);
    assert.equal(raw.spec.version, '1.21.0.3');
});

test('a wrong checksum fails', (t) => {
    const check = checkSpec(specFolder(tempDir(t), { checksum: '0'.repeat(64) }));
    assert.equal(check.spec, undefined);
    assert.match(check.problems.join('\n'), /the checksum file says 0{64}/);
});

test('an unsupported package format fails', (t) => {
    const check = checkSpec(specFolder(tempDir(t), { format: 3 }));
    assert.equal(check.spec, undefined);
    assert.match(check.problems.join('\n'), /package format 3; this repository supports 4, 5/);
});

test('a schema of another format than the package fails', (t) => {
    const check = checkSpec(specFolder(tempDir(t), { format: 5, schemaFormat: 4 }));
    assert.equal(check.spec, undefined);
    assert.match(check.problems.join('\n'), /schema of package format 4, but .* is format 5/);
});

test('two packages in the folder fail', (t) => {
    const dir = specFolder(tempDir(t));
    writeTree(dir, { 'ck3-spec-1.20.0.2.json': '{}' });
    const check = checkSpec(dir);
    assert.equal(check.spec, undefined);
    assert.match(check.problems.join('\n'), /exactly one/);
});

test('the committed rules table passes its schema and the core', () => {
    const check = checkRulesTable(path.join(repoRoot(), 'spec'));
    assert.deepEqual(check.problems, []);
    assert.equal(check.table?.status, 'stand-in');
    assert.match(check.sha256 ?? '', /^[0-9a-f]{64}$/);
});

test('a rules table that fails its schema or the core fails the spec check', (t) => {
    const dir = tempDir(t);
    copyFileSync(
        path.join(repoRoot(), 'spec', RULES_SCHEMA_FILE),
        path.join(dir, RULES_SCHEMA_FILE),
    );
    const row = {
        id: 'a',
        overrides_rule: 5,
        title: 'A row',
        kind: 'key-resolution',
        databases: ['common/traits'],
        resolve: 'all',
        platforms: ['linux'],
        evidence: [{ rank: 4, source: 's', where: 'w', says: 'x' }],
    };
    const table = (rules: unknown[]): string =>
        JSON.stringify({
            rules_format: 1,
            status: 'stand-in',
            game_build: '1.21.0.3',
            source: 's',
            rules,
        });
    writeTree(dir, { [RULES_FILE]: table([row]) });
    assert.deepEqual(checkRulesTable(dir).problems, []);
    writeTree(dir, { [RULES_FILE]: table([{ ...row, kind: 'guess' }]) });
    assert.ok(checkRulesTable(dir).problems.length > 0);
    // Two rows answering one question pass the schema; the core refuses them.
    writeTree(dir, { [RULES_FILE]: table([row, { ...row, id: 'b' }]) });
    assert.match(checkRulesTable(dir).problems.join('\n'), /rows a and b both answer/);
    writeTree(dir, { [RULES_FILE]: '{' });
    assert.match(checkRulesTable(dir).problems.join('\n'), /not valid JSON/);
    assert.match(checkRulesTable(tempDir(t)).problems.join('\n'), /override-rules.json is missing/);
});
