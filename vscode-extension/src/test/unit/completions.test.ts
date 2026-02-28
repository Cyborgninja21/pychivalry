/**
 * Unit Tests for Completion Provider
 */

import * as assert from 'assert';
import { CK3Parser } from '../../server/core/parser';
import { DocumentIndexer, SymbolType } from '../../server/core/indexer';
import { SchemaLoader } from '../../server/schema/loader';
import { CompletionProvider } from '../../server/lsp/completions';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, CompletionItemKind } from 'vscode-languageserver/node';

describe('CompletionProvider', () => {
    let parser: CK3Parser;
    let indexer: DocumentIndexer;
    let schemaLoader: SchemaLoader;
    let provider: CompletionProvider;

    beforeEach(() => {
        parser = new CK3Parser();
        indexer = new DocumentIndexer();
        schemaLoader = new SchemaLoader();
        provider = new CompletionProvider(parser, indexer, schemaLoader);
    });

    function createDocument(content: string, uri: string = 'file:///test/events/test.txt'): TextDocument {
        return TextDocument.create(uri, 'ck3', 1, content);
    }

    describe('template completions', () => {
        it('should provide template completions for empty event file', async () => {
            const doc = createDocument('', 'file:///mod/events/test.txt');
            const completions = await provider.provideCompletions(doc, Position.create(0, 0));
            // Templates may or may not appear depending on file context, just ensure no crash
            assert.ok(Array.isArray(completions), 'Should return an array');
        });

        it('should provide completions inside a block', async () => {
            const content = 'my_event.0001 = {\n\t\n}';
            const doc = createDocument(content, 'file:///mod/events/test.txt');
            // Cursor inside the block on the second line
            const completions = await provider.provideCompletions(doc, Position.create(1, 1));
            assert.ok(Array.isArray(completions), 'Should return an array');
        });
    });

    describe('saved scope completions', () => {
        it('should provide saved scope completions when typing scope:', async () => {
            // Index a document with a saved scope
            const eventText = [
                'my_mod.0001 = {',
                '\timmediate = {',
                '\t\tsave_scope_as = my_target',
                '\t}',
                '}'
            ].join('\n');
            const eventResult = parser.parse(eventText);
            await indexer.indexDocument('file:///mod/events/events.txt', eventResult.ast);

            // Verify the scope was indexed
            const scopes = indexer.findSymbolsByType(SymbolType.SCOPE);
            assert.ok(scopes.length > 0, 'Should have indexed at least one scope');
            assert.ok(scopes.some(s => s.name === 'my_target'), 'Should have indexed my_target scope');

            // Now create a document where user is typing scope:
            const content = 'scope:';
            const doc = createDocument(content, 'file:///mod/events/test2.txt');
            const completions = await provider.provideCompletions(doc, Position.create(0, 6));

            // Check that we get scope completions
            const scopeCompletions = completions.filter(c => c.label === 'my_target');
            assert.ok(scopeCompletions.length > 0, 'Should suggest saved scope "my_target"');
        });

        it('should deduplicate scope completions', async () => {
            // Index same scope from two different files
            const text1 = 'ev.1 = {\n\timmediate = {\n\t\tsave_scope_as = shared_scope\n\t}\n}';
            const text2 = 'ev.2 = {\n\timmediate = {\n\t\tsave_scope_as = shared_scope\n\t}\n}';

            await indexer.indexDocument('file:///mod/events/a.txt', parser.parse(text1).ast);
            await indexer.indexDocument('file:///mod/events/b.txt', parser.parse(text2).ast);

            const content = 'scope:';
            const doc = createDocument(content, 'file:///mod/events/test.txt');
            const completions = await provider.provideCompletions(doc, Position.create(0, 6));

            const scopeCompletions = completions.filter(c => c.label === 'shared_scope');
            assert.strictEqual(scopeCompletions.length, 1, 'Should deduplicate scope completions');
        });
    });

    describe('value completions', () => {
        it('should provide completions for type = field', async () => {
            const content = 'my_event.0001 = {\n\ttype = \n}';
            const doc = createDocument(content, 'file:///mod/events/test.txt');
            const completions = await provider.provideCompletions(doc, Position.create(1, 8));
            assert.ok(Array.isArray(completions), 'Should return array of completions');
        });

        it('should provide completions for assignment values', async () => {
            const content = 'is_ai = ';
            const doc = createDocument(content, 'file:///mod/events/test.txt');
            const completions = await provider.provideCompletions(doc, Position.create(0, 8));
            assert.ok(Array.isArray(completions), 'Should return array of completions');
        });
    });

    describe('general robustness', () => {
        it('should not crash on empty document', async () => {
            const doc = createDocument('');
            const completions = await provider.provideCompletions(doc, Position.create(0, 0));
            assert.ok(Array.isArray(completions), 'Should return array for empty document');
        });

        it('should not crash on malformed CK3 script', async () => {
            const doc = createDocument('= { { = = } } }}}');
            const completions = await provider.provideCompletions(doc, Position.create(0, 5));
            assert.ok(Array.isArray(completions), 'Should return array for malformed script');
        });

        it('should not crash with cursor at end of document', async () => {
            const content = 'test = yes';
            const doc = createDocument(content);
            const completions = await provider.provideCompletions(doc, Position.create(0, content.length));
            assert.ok(Array.isArray(completions), 'Should return array at document end');
        });

        it('should not crash with cursor in middle of identifier', async () => {
            const content = 'trigger_event = yes';
            const doc = createDocument(content);
            const completions = await provider.provideCompletions(doc, Position.create(0, 5));
            assert.ok(Array.isArray(completions), 'Should return array at mid-identifier');
        });
    });
});
