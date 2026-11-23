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

test('it depends on the core and the MCP library, pinned to an exact 2.x version, and nothing else', () => {
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), [
        '@modelcontextprotocol/server',
        '@pychivalry/core',
    ]);
    assert.match(
        manifest.dependencies?.['@modelcontextprotocol/server'] ?? '',
        /^2\.[0-9]+\.[0-9]+$/,
    );
});
