import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { packageName } from './index.js';

interface Manifest {
    name: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    bundleDependencies?: string[];
}

const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest;

test('the exported package name is the one in package.json', () => {
    assert.equal(packageName, manifest.name);
});

test('the core has no runtime dependencies (docs/MVP.md: the core is dependency-free)', () => {
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.deepEqual(manifest.peerDependencies ?? {}, {});
    assert.deepEqual(manifest.optionalDependencies ?? {}, {});
    assert.deepEqual(manifest.bundleDependencies ?? [], []);
});
