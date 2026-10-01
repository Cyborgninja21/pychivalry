/**
 * Unit Tests for Hover Provider (on the engine since Phase 4)
 *
 * The hand-written keyword and context-field hover texts are gone: a keyword shows the
 * spec package's engine doc string verbatim with its bucket, and a record field shows
 * what the directory schema records for it at that position.
 */

import * as assert from 'assert';
import * as path from 'path';
import { Hover, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, defaultSpec, Workspace } from 'pychivalry-engine';
import { HoverProvider } from '../../server/lsp/hover';
import { testUri } from './helpers/uri';

function text(hover: Hover | null): string {
    assert.ok(hover, 'expected a hover');
    const contents = hover.contents;
    return typeof contents === 'string' ? contents : 'value' in contents ? contents.value : '';
}

describe('HoverProvider', () => {
    let hoverProvider: HoverProvider;

    beforeEach(() => {
        const parser = new CK3Parser({ spec: defaultSpec() });
        hoverProvider = new HoverProvider(parser, new Workspace(path.resolve('/test')));
    });

    function createDocument(content: string, uri = testUri('/test/events/test.txt')): TextDocument {
        return TextDocument.create(uri, 'ck3', 1, content);
    }

    const EVENT = [
        'my_events.0001 = {', //                       0
        '\ttrigger = {', //                            1
        '\t\tis_adult = yes', //                       2
        '\t}', //                                      3
        '\timmediate = {', //                          4
        '\t\tif = { limit = { always = yes } }', //    5
        '\t\twhile = { count = 2 }', //               6
        '\t\telse = { add_gold = 50 }', //             7
        '\t\tevery_vassal = { add_gold = 1 }', //      8
        '\t\tcustom_tooltip = { text = x }', //        9
        '\t}', //                                      10
        '}', //                                        11
    ].join('\n');

    describe('keyword hover (engine doc strings)', () => {
        for (const [name, line, character, bucket] of [
            ['is_adult', 2, 4, 'triggers'],
            ['if', 5, 2, 'effects'],
            ['while', 6, 3, 'effects'],
            ['else', 7, 3, 'effects'],
        ] as const) {
            it(`shows the engine doc of "${name}" verbatim`, async () => {
                const value = text(
                    await hoverProvider.provideHover(
                        createDocument(EVENT),
                        Position.create(line, character)
                    )
                );
                const doc = defaultSpec().doc(name, bucket);
                assert.ok(doc, `the spec documents ${name}`);
                assert.ok(value.includes(doc), value);
            });
        }

        it('shows both buckets for a name registered as trigger and effect', async () => {
            const value = text(
                await hoverProvider.provideHover(createDocument(EVENT), Position.create(9, 5))
            );
            assert.ok(value.includes('*trigger*') && value.includes('*effect*'), value);
            assert.ok(value.includes('As trigger') && value.includes('As effect'), value);
        });

        it('shows the list doc for an iterator', async () => {
            const value = text(
                await hoverProvider.provideHover(createDocument(EVENT), Position.create(8, 5))
            );
            assert.ok(value.includes('vassal'), value);
            assert.ok(value.includes(defaultSpec().doc('vassal', 'lists') ?? '<none>'), value);
        });
    });

    describe('record field hover (directory schema)', () => {
        it('shows the events schema entry for "trigger"', async () => {
            const value = text(
                await hoverProvider.provideHover(createDocument(EVENT), Position.create(1, 3))
            );
            assert.ok(value.includes('Field of `events` records'), value);
            assert.ok(value.includes('trigger block'), value);
        });

        it('shows the decisions schema description for "is_shown"', async () => {
            const doc = createDocument(
                'my_decision = {\n\tis_shown = {\n\t\tis_ruler = yes\n\t}\n}',
                testUri('/test/common/decisions/d.txt')
            );
            const value = text(await hoverProvider.provideHover(doc, Position.create(1, 3)));
            assert.ok(value.includes('Field of `common/decisions` records'), value);
            assert.ok(value.includes('Conditions for decision to appear in UI'), value);
        });
    });

    describe('cache behavior', () => {
        it('should cache hover results', async () => {
            const doc = createDocument(EVENT);
            const hover1 = await hoverProvider.provideHover(doc, Position.create(2, 4));
            const hover2 = await hoverProvider.provideHover(doc, Position.create(2, 4));
            assert.deepStrictEqual(hover1, hover2);
        });

        it('should clear cache', async () => {
            const doc = createDocument(EVENT);
            await hoverProvider.provideHover(doc, Position.create(2, 4));
            hoverProvider.clearCache();
            const hover = await hoverProvider.provideHover(doc, Position.create(2, 4));
            assert.ok(hover, 'Should still return result after cache clear');
        });
    });

    describe('no hover for unknown tokens', () => {
        it('should return null for unknown identifiers', async () => {
            const doc = createDocument('zzz_unknown_xyz = 5');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 5));
            assert.strictEqual(hover, null);
        });

        it('should return null for empty position', async () => {
            const doc = createDocument('');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 0));
            assert.strictEqual(hover, null, 'Should return null for empty document');
        });
    });
});
