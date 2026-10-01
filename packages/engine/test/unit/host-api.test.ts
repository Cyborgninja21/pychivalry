/**
 * API added for hosts that embed the engine (the VS Code extension, Phase 4).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { isLocalizationFile, LocalizationIndex } from '../../src/index/localization';
import { pathToUri } from '../../src/index/workspace';
import { defaultSpec, loadSpec, packageRoot, setDefaultSpec } from '../../src/spec';

const VENDORED = path.join(packageRoot(), 'spec', 'ck3-spec-1.20.0.2.json.gz');

describe('Host API: setDefaultSpec', () => {
    it('makes the given spec the one defaultSpec() returns', () => {
        const previous = defaultSpec();
        const other = loadSpec(VENDORED);
        assert.notStrictEqual(other, previous);
        try {
            setDefaultSpec(other);
            assert.strictEqual(defaultSpec(), other);
        } finally {
            setDefaultSpec(previous);
        }
        assert.strictEqual(defaultSpec(), previous);
    });
});

describe('Host API: LocalizationIndex', () => {
    let dir: string;

    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-loc-'));
        fs.mkdirSync(path.join(dir, 'english'));
        fs.writeFileSync(
            path.join(dir, 'english', 'test_l_english.yml'),
            '\ufeffl_english:\n my_event.0001.t:0 "A Title"\n my_event.0001.desc: "no version"\n' +
                ' my_event.0001.a:1 "Option"\n'
        );
        fs.writeFileSync(path.join(dir, 'english', 'notes.yml'), 'l_english:\n other:0 "x"\n');
    });

    after(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('recognises localization file names', () => {
        assert.ok(isLocalizationFile('events_l_english.yml'));
        assert.ok(isLocalizationFile('x_l_simp_chinese.YML'));
        assert.ok(!isLocalizationFile('notes.yml'));
    });

    it('indexes keys with a version number, skips the BOM and other yml files', async () => {
        const index = new LocalizationIndex();
        const count = await index.scanDirectory(dir);
        assert.strictEqual(count, 2);
        assert.deepStrictEqual(index.getKeys().sort(), ['my_event.0001.a', 'my_event.0001.t']);
        const entry = index.findLocalization('my_event.0001.t');
        const file = path.join(dir, 'english', 'test_l_english.yml');
        assert.deepStrictEqual(entry, {
            key: 'my_event.0001.t',
            text: 'A Title',
            fileUri: pathToUri(file),
            filePath: file,
            line: 1,
        });
        assert.deepStrictEqual(
            index.entriesOf(pathToUri(file)).map((e) => e.key),
            ['my_event.0001.t', 'my_event.0001.a']
        );
    });

    it('replaces a file on re-index and clears it', () => {
        const index = new LocalizationIndex();
        const file = path.join(dir, 'english', 'test_l_english.yml');
        index.indexText(file, 'l_english:\n a:0 "1"\n b:0 "2"\n');
        index.indexText(file, 'l_english:\n b:0 "2"\n');
        assert.deepStrictEqual(index.getKeys(), ['b']);
        assert.strictEqual(index.size, 1);
        index.clearFile(pathToUri(file));
        assert.strictEqual(index.hasKey('b'), false);
        assert.strictEqual(index.size, 0);
    });
});
