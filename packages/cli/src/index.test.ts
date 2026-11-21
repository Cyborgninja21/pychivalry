import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { builtOn, packageName } from './index.js';

interface Manifest {
    name: string;
    dependencies?: Record<string, string>;
}

const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest;

test('the exported package name is the one in package.json', () => {
    assert.equal(packageName, manifest.name);
});

test('the package is built on the workspace core', () => {
    assert.equal(builtOn, '@pychivalry/core');
    assert.ok(manifest.dependencies?.['@pychivalry/core'] !== undefined);
});
