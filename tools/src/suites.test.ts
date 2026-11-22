import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { corpusRow, renderCorpusManifest } from './corpus.js';
import { checkRecord, compileRecordSchema, type Expected } from './records-check.js';
import { committedRules } from './rules-table.js';
import { checkSpec } from './spec.js';
import { gameSuiteRecord, GAME_SUITES, specGameNote, type SuiteOptions } from './suites.js';
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

test('every suite writes a valid record made on the committed spec; the stubs, empty results', (t) => {
    assert.ok(spec !== undefined);
    const dir = tempDir(t);
    const game = fixtureGame(path.join(dir, 'install'));
    const { corpus, manifest, sha } = pinnedFixtureCorpus(dir);
    writeTree(dir, { 'classifications.json': '{ "classifications": [] }' });
    const options: SuiteOptions = {
        manifestFile: manifest,
        parseFolders: [{ folder: 'common', extension: '.txt', expected: 1, why: 'The fixture.' }],
        classificationsFile: path.join(dir, 'classifications.json'),
    };
    const expected: Expected = {
        spec: { version: spec.version, sha256: spec.sha256 },
        corpusManifestSha256: sha,
        rulesSha256: committedRules(root).sha256,
    };
    for (const suite of GAME_SUITES) {
        const record = gameSuiteRecord(
            root,
            suite,
            { CK3_GAME_PATH: game, CK3_CORPUS: corpus },
            options,
        );
        assert.deepEqual(checkRecord(record, validate, expected), [], suite);
        assert.equal(record.suite, `game:${suite}`);
        if (suite === 'parse') {
            assert.equal(record.results['passed'], true);
            assert.equal(record.results['files'], 1);
            assert.equal(record.results['trees'], 1);
        } else if (suite === 'index') {
            assert.equal(record.results['passed'], true);
            assert.equal((record.results['base_game'] as { definitions: number }).definitions, 1);
            assert.deepEqual(
                (record.results['mods'] as { slug: string }[]).map((m) => m.slug),
                ['fixture-mod'],
            );
        } else {
            assert.deepEqual(record.results, {});
        }
        assert.equal(record.game.build, '1.21.0.3');
        if (suite === 'mods' || suite === 'bench' || suite === 'index') {
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
        () =>
            gameSuiteRecord(
                root,
                'mods',
                { CK3_GAME_PATH: game, CK3_CORPUS: corpus },
                { manifestFile: manifest },
            ),
        (err: unknown) =>
            err instanceof CommandError &&
            err.exitCode === 1 &&
            /not the pinned one/.test(err.message),
    );
});

test("the index record's note says whether the spec is for the game build installed", () => {
    assert.match(
        specGameNote('1.21.0.3', '1.21.0.3'),
        /^The spec is for game 1\.21\.0\.3, the build installed\./,
    );
    assert.match(
        specGameNote('1.21.0.3', '1.22.0.1'),
        /^The spec is for game 1\.21\.0\.3 and the game is 1\.22\.0\.1: a folder the newer game adds/,
    );
});
