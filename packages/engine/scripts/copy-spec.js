#!/usr/bin/env node
/**
 * Build step: copy the CK3 spec package named in spec.config.json into dist/data/.
 *
 * spec.config.json is the one place that says which spec package the engine bundles.
 * By default it points at the vendored copy under spec/ (gzipped, because the
 * repository's pre-commit hook rejects files over 1 MB); it may instead point at an
 * uncompressed ck3-spec-<version>.json in a pdx-parser-re checkout. Either way the
 * output is dist/data/ck3-spec.json.gz, dist/data/ck3-spec.sha256 and
 * dist/data/schema.json, and the sha256 of the uncompressed JSON must match the
 * checksum file shipped beside it.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'spec.config.json'), 'utf8'));
const resolve = (p) => (path.isAbsolute(p) ? p : path.join(root, p));

const specPath = resolve(config.spec);
const shaPath = resolve(config.sha256);
const schemaPath = resolve(config.schema);

const raw = fs.readFileSync(specPath);
const json = specPath.endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
const expected = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0].toLowerCase();
const actual = crypto.createHash('sha256').update(json).digest('hex');
if (actual !== expected) {
    process.stderr.write(`copy-spec: sha256 mismatch for ${specPath}: ${actual} != ${expected}\n`);
    process.exit(1);
}

const out = path.join(root, 'dist', 'data');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
    path.join(out, 'ck3-spec.json.gz'),
    specPath.endsWith('.gz') ? raw : zlib.gzipSync(json, { level: 9 })
);
fs.copyFileSync(shaPath, path.join(out, 'ck3-spec.sha256'));
fs.copyFileSync(schemaPath, path.join(out, 'schema.json'));
fs.chmodSync(path.join(root, 'dist', 'cli.js'), 0o755);
process.stdout.write(`copy-spec: ${path.relative(root, specPath)} -> dist/data (sha256 ${actual})\n`);
