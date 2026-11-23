import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { builtOn, packageName, version } from './index.js';

interface Manifest {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest;

test('the exported package name and version are the ones in package.json', () => {
    assert.equal(packageName, manifest.name);
    assert.equal(version, manifest.version);
});

test('the package is built on the workspace core and depends on nothing else', () => {
    assert.equal(builtOn, '@pychivalry/core');
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ['@pychivalry/core']);
    assert.deepEqual(Object.keys(manifest.devDependencies ?? {}), []);
});
