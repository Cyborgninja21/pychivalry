import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storedZip } from './editor/vsix.js';
import { unwanted, zipEntries } from './zip-listing.js';

test("a zip archive's entries are read from its central directory, names and sizes", () => {
    const zip = storedZip([
        { name: 'extension/package.json', data: Buffer.from('{}\n') },
        { name: 'extension/dist/bundle/a é.cjs', data: Buffer.alloc(1000, 1) },
    ]);
    assert.deepEqual(zipEntries(zip), [
        { name: 'extension/package.json', stored: 3, size: 3 },
        { name: 'extension/dist/bundle/a é.cjs', stored: 1000, size: 1000 },
    ]);
    assert.throws(
        () => zipEntries(Buffer.from('not a zip at all, not even close to one')),
        /no end/,
    );
});

test('the .vsix may hold the manifest, the README, the licence, the three bundles, the spec and the skills only', () => {
    const entry = (name: string) => ({ name, stored: 1, size: 1 });
    const fine = [
        '[Content_Types].xml',
        'extension.vsixmanifest',
        'extension/package.json',
        'extension/readme.md',
        'extension/LICENSE.txt',
        'extension/dist/bundle/extension.cjs',
        'extension/dist/bundle/lsp/pychivalry-lsp.mjs',
        'extension/dist/bundle/lsp/presentation/events.json',
        'extension/dist/bundle/lsp/presentation/common/activities/activity_types.json',
        'extension/dist/bundle/server/pychivalry-mcp.mjs',
        'extension/dist/bundle/server/pychivalry-cli.mjs',
        'extension/dist/bundle/server/manifest.json',
        'extension/dist/bundle/server/spec/ck3-spec-1.21.0.3.json.gz',
        'extension/dist/bundle/server/spec/ck3-spec-1.21.0.3.sha256',
        'extension/dist/bundle/server/spec/ck3-spec-1.21.0.3.data_types.json.gz',
        'extension/dist/bundle/skills/pychivalry-write-content/SKILL.md',
    ];
    assert.deepEqual(unwanted(fine.map(entry)), []);
    const bad = [
        'extension/legacy/README.md',
        'extension/src/extension.ts',
        'extension/dist/extension.js',
        'extension/dist/bundle/extension.cjs.map',
        'extension/dist/test-bundle/suite.cjs',
        'extension/fixtures/mods/x/descriptor.mod',
        'extension/node_modules/vscode-languageclient/package.json',
        'extension/dist/bundle/server/spec/../../../../x',
        'extension/dist/bundle/lsp/presentation/README.md',
        'extension/dist/bundle/lsp/presentation/../../../x.json',
        'extension/dist/bundle/skills/Not_A_Skill_Name/SKILL.md',
        'extension/dist/bundle/skills/pychivalry-write-content/notes.txt',
        'extension/dist/bundle/skills/SKILL.md',
    ];
    assert.deepEqual(unwanted(bad.map(entry)), bad);
});
