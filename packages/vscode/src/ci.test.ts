/**
 * Public CI's cache of the VS Code the editor tests download is keyed by the release they pin:
 * a new release pinned without a new key would restore the old one and download the new one on
 * every run, saving nothing.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { VSCODE_VERSION } from './editor/version.js';

const REPO = path.resolve(fileURLToPath(new URL('../', import.meta.url)), '..', '..');

test("the editor-test job's cache key names the pinned VS Code", () => {
    const workflow = readFileSync(path.join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8');
    const keys = [...workflow.matchAll(/key: vscode-test-\$\{\{ runner\.os \}\}-(\S+)/g)].map(
        (m) => m[1],
    );
    assert.deepEqual(keys, [VSCODE_VERSION]);
});
