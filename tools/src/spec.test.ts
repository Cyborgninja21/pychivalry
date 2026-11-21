import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
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
