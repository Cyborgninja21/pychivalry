/**
 * API added for hosts that embed the engine (the VS Code extension, Phase 4).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { contextAt } from '../../src/check/context';
import { diagnose, PluginContext } from '../../src/diagnostics';
import { isLocalizationFile, LocalizationIndex } from '../../src/index/localization';
import { pathToUri, Workspace } from '../../src/index/workspace';
import { Indexer, SymbolType } from '../../src/index/indexer';
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

describe('Host API: diagnose options and plug-in context', () => {
    const root = path.resolve('/virtual-ck3-mod');

    it('gives plug-ins the text and URI and indexes under the given URI', () => {
        const workspace = new Workspace(root);
        const file = path.join(root, 'events', 'p.txt');
        const text = 'p.1 = {\n\ttype = character_event\n}\n';
        let seen: PluginContext | undefined;
        const result = diagnose(workspace, file, {
            text,
            uri: 'file:///editor/spelling/p.txt',
            plugins: [
                (ctx) => {
                    seen = ctx;
                    return [
                        {
                            file: ctx.file,
                            range: {
                                start: { line: 0, character: 0 },
                                end: { line: 0, character: 3 },
                            },
                            severity: 'hint',
                            code: 'TEST-1',
                            message: 'from a plug-in',
                            source: 'engine',
                        },
                    ];
                },
            ],
        });
        assert.ok(seen);
        assert.strictEqual(seen.text, text);
        assert.strictEqual(seen.uri, 'file:///editor/spelling/p.txt');
        assert.strictEqual(seen.file, 'events/p.txt');
        const mine = result.find((d) => d.code === 'TEST-1');
        assert.strictEqual(mine?.source, 'plugin');
        assert.deepStrictEqual(workspace.index.getIndexedUris(), ['file:///editor/spelling/p.txt']);
    });
});

describe('Host API: index queries for the extension commands', () => {
    const parser = new CK3Parser();
    const A = [
        'namespace = chain',
        'chain.1 = {',
        '\ttype = character_event',
        '\ttitle = chain.1.t',
        '\tdesc = chain.1.desc',
        '\timmediate = { trigger_event = chain.2 }',
        '\toption = {',
        '\t\tname = chain.1.a',
        '\t\ttrigger_event = { id = chain.3 days = 2 }',
        '\t}',
        '}',
    ].join('\n');
    const B = 'chain.2 = {\n\ttype = character_event\n\ttitle = chain.2.t\n}\n';

    it('getEventChain lists the events an event triggers', () => {
        const index = new Indexer();
        index.indexSync('file:///m/events/a.txt', parser.parse(A).ast);
        assert.deepStrictEqual(index.getEventChain('chain.1').sort(), ['chain.2', 'chain.3']);
        assert.deepStrictEqual(index.getEventChain('nope.1'), []);
    });

    it('getLocalizationKeys collects the events keys', () => {
        const index = new Indexer();
        index.indexSync('file:///m/events/a.txt', parser.parse(A).ast);
        const keys = index.getLocalizationKeys();
        for (const key of ['chain.1.t', 'chain.1.desc', 'chain.1.a']) {
            assert.ok(keys.includes(key), `${key} in ${keys.join(', ')}`);
        }
    });

    it('getUndefinedReferences resolves late definitions and forgets removed files', () => {
        const index = new Indexer();
        index.indexSync('file:///m/events/a.txt', parser.parse(A).ast);
        const before = index.getUndefinedReferences().map((r) => r.name);
        assert.deepStrictEqual(before, ['chain.2', 'chain.3']);
        assert.strictEqual(index.getUndefinedReferences()[0].type, SymbolType.EVENT);
        index.indexSync('file:///m/events/b.txt', parser.parse(B).ast);
        assert.deepStrictEqual(
            index.getUndefinedReferences().map((r) => r.name),
            ['chain.3']
        );
        index.removeDocument('file:///m/events/a.txt');
        assert.deepStrictEqual(index.getUndefinedReferences(), []);
    });
});

describe('Host API: Spec.withOverlay and Workspace.useSpec', () => {
    const overlay = {
        source: 'Carnalitas',
        buckets: {
            effects: {
                carn_sex_scene_effect_v2: { doc: 'Trigger a sex scene with popup event' },
                add_gold: { doc: 'must not replace the engine entry' },
            },
            triggers: { carn_is_slave_trigger: { doc: 'Check if character is a slave' } },
        },
    };

    it('adds names to buckets without touching the base spec or the engine entries', () => {
        const base = defaultSpec();
        const spec = base.withOverlay(overlay);
        assert.ok(spec.has('carn_sex_scene_effect_v2', 'effects'));
        assert.ok(spec.has('carn_is_slave_trigger', 'triggers'));
        assert.ok(!spec.has('carn_is_slave_trigger', 'effects'));
        assert.strictEqual(
            spec.doc('carn_sex_scene_effect_v2'),
            'Trigger a sex scene with popup event'
        );
        assert.strictEqual(spec.sourceOf('carn_sex_scene_effect_v2'), 'Carnalitas');
        assert.strictEqual(spec.doc('add_gold', 'effects'), base.doc('add_gold', 'effects'));
        assert.strictEqual(spec.sourceOf('add_gold'), undefined);
        assert.ok(!base.has('carn_sex_scene_effect_v2', 'effects'));
        assert.strictEqual(spec.version(), base.version());
        assert.strictEqual(spec.schemaOf('events'), base.schemaOf('events'));
    });

    it('lets a workspace check against the overlaid spec', () => {
        const root = path.resolve('/virtual-ck3-mod');
        const workspace = new Workspace(root);
        const file = path.join(root, 'events', 'o.txt');
        const text =
            'o.1 = {\n\ttype = character_event\n\timmediate = {\n\t\tcarn_sex_scene_effect_v2 = yes\n\t}\n}\n';
        const before = diagnose(workspace, file, { text }).map((d) => d.code);
        assert.ok(before.includes('unknown_effect_X'), before.join(', '));
        workspace.useSpec(workspace.spec.withOverlay(overlay));
        const after = diagnose(workspace, file, { text }).map((d) => d.code);
        assert.ok(!after.includes('unknown_effect_X'), after.join(', '));
    });
});

describe('Host API: Spec.matchMessage (game log lines → catalogue ids)', () => {
    const spec = defaultSpec();

    it('maps a message to its catalogue id and placeholder values', () => {
        assert.deepStrictEqual(spec.matchMessage("Unknown effect 'give_super_powers'"), {
            id: 'unknown_effect_X',
            args: ['give_super_powers'],
        });
        assert.deepStrictEqual(spec.matchMessage('Expected } after arguments'), {
            id: 'expected_after_arguments',
            args: [],
        });
    });

    it('accepts a trailing location and prefers the template that contains one', () => {
        assert.strictEqual(
            spec.matchMessage("Unknown trigger 'add_gold' at events/x.txt:73")?.id,
            'unknown_trigger_X'
        );
        assert.deepStrictEqual(
            spec.matchMessage(
                "Unknown modifier type 'super_strength' at common/modifiers/m.txt:30"
            ),
            {
                id: 'unknown_modifier_type_X_at_X',
                args: ['super_strength', 'common/modifiers/m.txt:30'],
            }
        );
    });

    it('round-trips every catalogue text filled by message()', () => {
        for (const id of ['unknown_effect_X', 'casus_belli_X_missing_on_invalidated_desc']) {
            assert.strictEqual(spec.matchMessage(spec.message(id, 'abc_def'))?.id, id);
        }
    });

    it('returns undefined for text that is no catalogue message', () => {
        assert.strictEqual(spec.matchMessage('Loaded 12 events'), undefined);
    });
});
