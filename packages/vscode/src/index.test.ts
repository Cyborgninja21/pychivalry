import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { packageName, publisher } from './index.js';

interface Manifest {
    name: string;
    publisher: string;
}

const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest;

test('the extension identity is the one in package.json', () => {
    assert.equal(packageName, manifest.name);
    assert.equal(publisher, manifest.publisher);
});
