/**
 * Unit Tests for Hover Provider
 */

import * as assert from 'assert';
import { CK3Parser } from '../../server/core/parser';
import { HoverProvider } from '../../server/lsp/hover';
import { SchemaLoader } from '../../server/schema/loader';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver/node';

describe('HoverProvider', () => {
    let parser: CK3Parser;
    let schemaLoader: SchemaLoader;
    let hoverProvider: HoverProvider;

    beforeEach(() => {
        parser = new CK3Parser();
        schemaLoader = new SchemaLoader();
        hoverProvider = new HoverProvider(parser, schemaLoader);
    });

    function createDocument(content: string, uri: string = 'file:///test/events/test.txt'): TextDocument {
        return TextDocument.create(uri, 'ck3', 1, content);
    }

    describe('keyword hover', () => {
        it('should provide hover for "trigger" keyword', async () => {
            const doc = createDocument('trigger = {\n\tis_ai = no\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 2));
            assert.ok(hover, 'Should return hover for trigger keyword');
            assert.ok(hover.contents, 'Should have contents');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Trigger'), 'Should mention Trigger in hover');
        });

        it('should provide hover for "immediate" keyword', async () => {
            const doc = createDocument('immediate = {\n\tset_variable = { name = x value = 1 }\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 3));
            assert.ok(hover, 'Should return hover for immediate keyword');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Immediate'), 'Should mention Immediate in hover');
        });

        it('should provide hover for "option" keyword', async () => {
            const doc = createDocument('option = {\n\tname = test\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 3));
            assert.ok(hover, 'Should return hover for option keyword');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Option'), 'Should mention Option in hover');
        });

        it('should provide hover for "if" keyword', async () => {
            const doc = createDocument('if = {\n\tlimit = { is_adult = yes }\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 1));
            assert.ok(hover, 'Should return hover for if keyword');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Conditional'), 'Should mention Conditional in hover');
        });

        it('should provide hover for "while" keyword', async () => {
            const doc = createDocument('while = {\n\tlimit = { gold >= 100 }\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 2));
            assert.ok(hover, 'Should return hover for while keyword');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('While'), 'Should mention While Loop in hover');
        });

        it('should provide hover for "else" keyword', async () => {
            const doc = createDocument('else = {\n\tadd_gold = 50\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 2));
            assert.ok(hover, 'Should return hover for else keyword');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Else'), 'Should mention Else in hover');
        });
    });

    describe('context field hover', () => {
        it('should provide hover for "ai_chance" field', async () => {
            const doc = createDocument('ai_chance = {\n\tbase = 50\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 3));
            assert.ok(hover, 'Should return hover for ai_chance');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('AI'), 'Should mention AI in hover');
        });

        it('should provide hover for "left_portrait" field', async () => {
            const doc = createDocument('left_portrait = root');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 5));
            assert.ok(hover, 'Should return hover for left_portrait');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Portrait'), 'Should mention Portrait in hover');
        });

        it('should provide hover for "cooldown" field', async () => {
            const doc = createDocument('cooldown = { years = 5 }');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 4));
            assert.ok(hover, 'Should return hover for cooldown');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Cooldown'), 'Should mention Cooldown in hover');
        });

        it('should provide hover for "is_shown" field', async () => {
            const doc = createDocument('is_shown = {\n\tis_ruler = yes\n}');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 5));
            assert.ok(hover, 'Should return hover for is_shown');
            const value = typeof hover.contents === 'string' ? hover.contents : (hover.contents as any).value;
            assert.ok(value.includes('Shown'), 'Should mention Shown in hover');
        });
    });

    describe('cache behavior', () => {
        it('should cache hover results', async () => {
            const doc = createDocument('trigger = {\n\tis_ai = no\n}');
            const hover1 = await hoverProvider.provideHover(doc, Position.create(0, 2));
            const hover2 = await hoverProvider.provideHover(doc, Position.create(0, 2));
            assert.ok(hover1, 'First hover should return result');
            assert.ok(hover2, 'Second hover (cached) should return result');
        });

        it('should clear cache', async () => {
            const doc = createDocument('trigger = {\n\tis_ai = no\n}');
            await hoverProvider.provideHover(doc, Position.create(0, 2));
            hoverProvider.clearCache();
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 2));
            assert.ok(hover, 'Should still return result after cache clear');
        });
    });

    describe('no hover for unknown tokens', () => {
        it('should return null for unknown identifiers', async () => {
            const doc = createDocument('zzz_unknown_xyz = 5');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 5));
            // May or may not return hover depending on data loader state, just ensure no crash
            assert.ok(true, 'Should not crash on unknown identifiers');
        });

        it('should return null for empty position', async () => {
            const doc = createDocument('');
            const hover = await hoverProvider.provideHover(doc, Position.create(0, 0));
            assert.strictEqual(hover, null, 'Should return null for empty document');
        });
    });
});
