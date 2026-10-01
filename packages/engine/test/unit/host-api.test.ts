/**
 * API added for hosts that embed the engine (the VS Code extension, Phase 4).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { contextAt } from '../../src/check/context';
import { isLocalizationFile, LocalizationIndex } from '../../src/index/localization';
import { pathToUri, Workspace } from '../../src/index/workspace';
import { CK3Parser } from '../../src/syntax/parser';
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

describe('Host API: contextAt (the context tracker)', () => {
    const root = path.resolve('/virtual-ck3-mod');
    const workspace = new Workspace(root);
    const parser = new CK3Parser({ spec: workspace.spec });

    function at(rel: string, lines: string[], line: number, character: number) {
        const ast = parser.parse(lines.join('\n')).ast;
        return contextAt(workspace, path.join(root, rel), ast, { line, character });
    }

    const EVENT = [
        'my_events.0001 = {', //            0
        '    type = character_event', //    1
        '    trigger = {', //               2
        '        is_adult = yes', //        3
        '        ', //                      4
        '    }', //                         5
        '    immediate = {', //             6
        '        every_vassal = {', //      7
        '            ', //                  8
        '        }', //                     9
        '        hidden_effect = {', //     10
        '            ', //                  11
        '        }', //                     12
        '        made_up_block = {', //     13
        '            ', //                  14
        '        }', //                     15
        '    }', //                         16
        '    ', //                          17
        '}', //                             18
    ];

    it('a trigger block is trigger context', () => {
        const c = at('events/e.txt', EVENT, 4, 8);
        assert.strictEqual(c.kind, 'trigger');
        assert.strictEqual(c.exact, true);
        assert.strictEqual(c.path[c.path.length - 1].key, 'trigger');
    });

    it('effect blocks, iterators and effect containers are effect context', () => {
        assert.strictEqual(at('events/e.txt', EVENT, 8, 12).kind, 'effect');
        assert.strictEqual(at('events/e.txt', EVENT, 11, 12).kind, 'effect');
    });

    it('a record body offers the directory schema fields', () => {
        const c = at('events/e.txt', EVENT, 17, 4);
        assert.strictEqual(c.kind, 'none');
        assert.strictEqual(c.directory?.path, 'events');
        assert.ok(c.fields && 'option' in c.fields && 'immediate' in c.fields);
    });

    it('the body of an unknown keyword falls back to the enclosing context', () => {
        const c = at('events/e.txt', EVENT, 14, 12);
        assert.strictEqual(c.exact, false);
        assert.strictEqual(c.kind, 'effect');
    });

    it('the top level is none without fields', () => {
        const c = at('events/e.txt', EVENT, 18, 1);
        assert.strictEqual(c.kind, 'none');
        assert.strictEqual(c.fields, undefined);
    });

    it('a common/modifiers record body is a modifier block', () => {
        const c = at('common/modifiers/m.txt', ['my_modifier = {', '    ', '}'], 1, 4);
        assert.strictEqual(c.kind, 'modifier');
    });
});
