import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    corpusRow,
    corpusSlugs,
    parseCorpusManifest,
    readDescriptor,
    renderCorpusManifest,
    selectSlugs,
    verifyCorpus,
} from './corpus.js';
import { summarize } from './stats.js';
import { fixtureMod, tempDir, writeTree } from './testing.js';
import { CommandError } from './util.js';

test('the descriptor gives its top-level values and skips the tags block', () => {
    const values = readDescriptor(
        '\uFEFFversion="Beta_v2.1.0"\ntags={\n\t"Events"\n\tname="not top level"\n}\nname="Elf Destiny"\nsupported_version="1.21.*"\nremote_file_id="3114064450"\n',
    );
    assert.equal(values.get('name'), 'Elf Destiny');
    assert.equal(values.get('supported_version'), '1.21.*');
    assert.equal(values.get('remote_file_id'), '3114064450');
    assert.equal(values.get('version'), 'Beta_v2.1.0');
});

test('a corpus row is measured from the mod folder and its descriptor', (t) => {
    const corpus = tempDir(t);
    fixtureMod(corpus, 'fixture-mod', '42');
    const row = corpusRow(corpus, 'fixture-mod');
    assert.deepEqual(
        { ...row, sha256: row.sha256.length },
        {
            slug: 'fixture-mod',
            workshop_id: '42',
            name: 'Fixture fixture-mod',
            supported_version: '1.21.*',
            files: 2,
            sha256: 64,
        },
    );
    assert.deepEqual(corpusSlugs(corpus), ['fixture-mod']);
});

test('the manifest text parses back to the same rows', (t) => {
    const corpus = tempDir(t);
    fixtureMod(corpus, 'a-mod', '1');
    fixtureMod(corpus, 'b-mod', '2');
    const rows = corpusSlugs(corpus).map((slug) => corpusRow(corpus, slug));
    const text = renderCorpusManifest(rows);
    assert.match(text, /^# .*\nslug\tworkshop_id\tname\tsupported_version\tfiles\tsha256\n/);
    assert.deepEqual(parseCorpusManifest(text), rows);
});

test('a copy that differs from the pinned manifest is reported', (t) => {
    const corpus = tempDir(t);
    fixtureMod(corpus, 'a-mod');
    const rows = [corpusRow(corpus, 'a-mod')];
    assert.deepEqual(verifyCorpus(corpus, rows, ['a-mod']), []);
    writeTree(corpus, { 'a-mod/events/fixture_events.txt': 'namespace = changed\n' });
    assert.match(
        verifyCorpus(corpus, rows, ['a-mod']).join('\n'),
        /a-mod: the copy on disk .* is not the pinned one/,
    );
});

test('CK3_CORPUS_SLUGS selects mods of the manifest and refuses unknown ones', (t) => {
    const corpus = tempDir(t);
    fixtureMod(corpus, 'a-mod');
    fixtureMod(corpus, 'b-mod');
    const rows = ['a-mod', 'b-mod'].map((slug) => corpusRow(corpus, slug));
    assert.deepEqual(selectSlugs(rows, undefined), ['a-mod', 'b-mod']);
    assert.deepEqual(selectSlugs(rows, ' b-mod ,b-mod'), ['b-mod']);
    assert.throws(
        () => selectSlugs(rows, 'c-mod'),
        (err: unknown) => err instanceof CommandError && err.exitCode === 2,
    );
});

test('statistics: median of odd and even counts, min, max and spread', () => {
    assert.deepEqual(summarize([3, 1, 2]), {
        n: 3,
        median: 2,
        min: 1,
        max: 3,
        spread: 2,
        values: [3, 1, 2],
    });
    assert.equal(summarize([4, 1, 3, 2]).median, 2.5);
    assert.throws(() => summarize([]));
});
