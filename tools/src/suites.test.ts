import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { corpusRow, renderCorpusManifest } from './corpus.js';
import { checkRecord, compileRecordSchema, type Expected } from './records-check.js';
import { checkSpec } from './spec.js';
import { gameSuiteRecord, GAME_SUITES } from './suites.js';
import { fixtureGame, fixtureMod, tempDir, writeTree } from './testing.js';
import { CommandError, repoRoot, sha256 } from './util.js';

const root = repoRoot();
const validate = compileRecordSchema(path.join(root, 'records', 'record.schema.json'));
const spec = checkSpec(path.join(root, 'spec')).spec;

/** A corpus of one fixture mod, and a manifest file that pins it. */
function pinnedFixtureCorpus(dir: string): { corpus: string; manifest: string; sha: string } {
    const corpus = path.join(dir, 'corpus');
    fixtureMod(corpus, 'fixture-mod');
    const text = renderCorpusManifest([corpusRow(corpus, 'fixture-mod')]);
    const manifest = path.join(dir, 'MANIFEST.tsv');
    writeTree(dir, { 'MANIFEST.tsv': text });
    return { corpus, manifest, sha: sha256(text) };
}

test('every stub writes a valid, empty record made on the committed spec', (t) => {
    assert.ok(spec !== undefined);
    const dir = tempDir(t);
    const game = fixtureGame(path.join(dir, 'install'));
    const { corpus, manifest, sha } = pinnedFixtureCorpus(dir);
    const expected: Expected = {
        spec: { version: spec.version, sha256: spec.sha256 },
        corpusManifestSha256: sha,
    };
    for (const suite of GAME_SUITES) {
        const record = gameSuiteRecord(
            root,
            suite,
            { CK3_GAME_PATH: game, CK3_CORPUS: corpus },
            manifest,
        );
        assert.deepEqual(checkRecord(record, validate, expected), [], suite);
        assert.equal(record.suite, `game:${suite}`);
        assert.deepEqual(record.results, {});
        assert.equal(record.game.build, '1.21.0.3');
        if (suite === 'mods' || suite === 'bench') {
            assert.deepEqual(record.corpus, { manifest_sha256: sha, slugs: ['fixture-mod'] });
        } else {
            assert.equal(record.corpus, null);
        }
    }
});

test('a stub without CK3_GAME_PATH, or a corpus suite without CK3_CORPUS, is a usage error', (t) => {
    const game = fixtureGame(tempDir(t));
    const usage = (err: unknown): boolean => err instanceof CommandError && err.exitCode === 2;
    assert.throws(() => gameSuiteRecord(root, 'parse', {}), usage);
    assert.throws(() => gameSuiteRecord(root, 'mods', { CK3_GAME_PATH: game }), usage);
});

test('a corpus suite on a corpus that is not the pinned one fails its pass condition', (t) => {
    const dir = tempDir(t);
    const game = fixtureGame(path.join(dir, 'install'));
    const { corpus, manifest } = pinnedFixtureCorpus(dir);
    writeTree(corpus, { 'fixture-mod/events/new.txt': 'namespace = new\n' });
    assert.throws(
        () => gameSuiteRecord(root, 'mods', { CK3_GAME_PATH: game, CK3_CORPUS: corpus }, manifest),
        (err: unknown) =>
            err instanceof CommandError &&
            err.exitCode === 1 &&
            /not the pinned one/.test(err.message),
    );
});
