import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { installServer, MANIFEST_FILE, manifestOf, parseManifest } from './install.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-vscode-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A bundle of version `version` with the given files, and its manifest. */
function bundle(dir: string, version: string, files: Record<string, string>): string {
    for (const [rel, text] of Object.entries(files)) {
        const file = path.join(dir, ...rel.split('/'));
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, text);
    }
    const manifest = manifestOf(dir, version, Object.keys(files));
    writeFileSync(path.join(dir, MANIFEST_FILE), JSON.stringify(manifest));
    return dir;
}

test('the bundle is copied to the storage folder, with its manifest', (t) => {
    const root = scratch(t);
    const source = bundle(path.join(root, 'ext-0.1.0'), '0.1.0', {
        'pychivalry-mcp.mjs': 'server 1',
        'spec/ck3-spec-1.json.gz': 'spec 1',
    });
    const target = path.join(root, 'storage', 'agent-server');
    assert.deepEqual(installServer(source, target), {
        dir: target,
        version: '0.1.0',
        changed: true,
    });
    assert.equal(readFileSync(path.join(target, 'pychivalry-mcp.mjs'), 'utf8'), 'server 1');
    assert.equal(readFileSync(path.join(target, 'spec', 'ck3-spec-1.json.gz'), 'utf8'), 'spec 1');
    assert.equal(
        parseManifest(readFileSync(path.join(target, MANIFEST_FILE), 'utf8')).version,
        '0.1.0',
    );
    // Activated again: nothing to do.
    assert.equal(installServer(source, target).changed, false);
});

test('an update replaces the copy, removes what the new version no longer has, and survives the old folder going', (t) => {
    const root = scratch(t);
    const v1 = bundle(path.join(root, 'ext-0.1.0'), '0.1.0', {
        'pychivalry-mcp.mjs': 'server 1',
        'spec/ck3-spec-1.21.json.gz': 'old spec',
    });
    const target = path.join(root, 'storage', 'agent-server');
    installServer(v1, target);
    const v2 = bundle(path.join(root, 'ext-0.2.0'), '0.2.0', {
        'pychivalry-mcp.mjs': 'server 2',
        'spec/ck3-spec-1.22.json.gz': 'new spec',
    });
    rmSync(v1, { recursive: true });
    assert.deepEqual(installServer(v2, target), { dir: target, version: '0.2.0', changed: true });
    assert.equal(readFileSync(path.join(target, 'pychivalry-mcp.mjs'), 'utf8'), 'server 2');
    assert.ok(existsSync(path.join(target, 'spec', 'ck3-spec-1.22.json.gz')));
    assert.ok(
        !existsSync(path.join(target, 'spec', 'ck3-spec-1.21.json.gz')),
        'a second spec package would make the server refuse to start',
    );
});

test('a damaged or incomplete copy is written again, a file the user put there is left alone', (t) => {
    const root = scratch(t);
    const source = bundle(path.join(root, 'ext'), '0.1.0', { 'pychivalry-mcp.mjs': 'server' });
    const target = path.join(root, 'storage');
    installServer(source, target);
    writeFileSync(path.join(target, 'notes.txt'), 'mine');
    rmSync(path.join(target, 'pychivalry-mcp.mjs'));
    assert.equal(installServer(source, target).changed, true);
    assert.equal(readFileSync(path.join(target, 'pychivalry-mcp.mjs'), 'utf8'), 'server');
    writeFileSync(path.join(target, 'pychivalry-mcp.mjs'), 'a different length');
    assert.equal(installServer(source, target).changed, true);
    assert.equal(readFileSync(path.join(target, 'pychivalry-mcp.mjs'), 'utf8'), 'server');
    assert.equal(readFileSync(path.join(target, 'notes.txt'), 'utf8'), 'mine');
});

test('a bundle whose file does not match its manifest is not copied', (t) => {
    const root = scratch(t);
    const source = bundle(path.join(root, 'ext'), '0.1.0', { 'pychivalry-mcp.mjs': 'server' });
    writeFileSync(path.join(source, 'pychivalry-mcp.mjs'), 'tampered');
    assert.throws(
        () => installServer(source, path.join(root, 'storage')),
        /does not match its manifest/,
    );
    assert.throws(
        () => installServer(path.join(root, 'none'), path.join(root, 'storage')),
        /no readable manifest/,
    );
});

test('a manifest path that leaves its folder is refused', () => {
    for (const p of ['../x', '/etc/x', 'a/../../x', '', 'a//b']) {
        assert.throws(
            () =>
                parseManifest(
                    JSON.stringify({ version: '1', files: [{ path: p, sha256: 'x', size: 1 }] }),
                ),
            /leaves its folder/,
            p,
        );
    }
    assert.throws(() => parseManifest('{}'), /no version or no files/);
});
