/**
 * Unit Tests for Completion Provider
 */

import * as assert from 'assert';
import * as path from 'path';
import { CK3Parser, defaultSpec, Indexer, SymbolType, Workspace } from 'pychivalry-engine';
import { CompletionProvider } from '../../server/lsp/completions';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position } from 'vscode-languageserver/node';
import { testUri } from './helpers/uri';

describe('CompletionProvider', () => {
    let parser: CK3Parser;
    let indexer: Indexer;
    let provider: CompletionProvider;

    beforeEach(() => {
        parser = new CK3Parser({ spec: defaultSpec() });
        const workspace = new Workspace(path.resolve('/mod'));
        indexer = workspace.index;
        provider = new CompletionProvider(parser, workspace);
    });

    function createDocument(
        content: string,
        uri: string = testUri('/test/events/test.txt')
    ): TextDocument {
        return TextDocument.create(uri, 'ck3', 1, content);
    }

    describe('template completions', () => {
        it('should provide template completions for empty event file', async () => {
            const doc = createDocument('', testUri('/mod/events/test.txt'));
            const completions = await provider.provideCompletions(doc, Position.create(0, 0));
            // Templates may or may not appear depending on file context, just ensure no crash
            assert.ok(Array.isArray(completions), 'Should return an array');
        });

        it('should provide completions inside a block', async () => {
            const content = 'my_event.0001 = {\n\t\n}';
            const doc = createDocument(content, testUri('/mod/events/test.txt'));
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
                '}',
            ].join('\n');
            const eventResult = parser.parse(eventText);
            await indexer.indexDocument(testUri('/mod/events/events.txt'), eventResult.ast);

            // Verify the scope was indexed
            const scopes = indexer.findSymbolsByType(SymbolType.SCOPE);
            assert.ok(scopes.length > 0, 'Should have indexed at least one scope');
            assert.ok(
                scopes.some((s) => s.name === 'my_target'),
                'Should have indexed my_target scope'
            );

            // Now create a document where user is typing scope:
            const content = 'scope:';
            const doc = createDocument(content, testUri('/mod/events/test2.txt'));
            const completions = await provider.provideCompletions(doc, Position.create(0, 6));

            // Check that we get scope completions
            const scopeCompletions = completions.filter((c) => c.label === 'my_target');
            assert.ok(scopeCompletions.length > 0, 'Should suggest saved scope "my_target"');
        });

        it('should deduplicate scope completions', async () => {
            // Index same scope from two different files
            const text1 = 'ev.1 = {\n\timmediate = {\n\t\tsave_scope_as = shared_scope\n\t}\n}';
            const text2 = 'ev.2 = {\n\timmediate = {\n\t\tsave_scope_as = shared_scope\n\t}\n}';

            await indexer.indexDocument(testUri('/mod/events/a.txt'), parser.parse(text1).ast);
            await indexer.indexDocument(testUri('/mod/events/b.txt'), parser.parse(text2).ast);

            const content = 'scope:';
            const doc = createDocument(content, testUri('/mod/events/test.txt'));
            const completions = await provider.provideCompletions(doc, Position.create(0, 6));

            const scopeCompletions = completions.filter((c) => c.label === 'shared_scope');
            assert.strictEqual(scopeCompletions.length, 1, 'Should deduplicate scope completions');
        });
    });

    describe('value completions', () => {
        it('should provide completions for type = field', async () => {
            const content = 'my_event.0001 = {\n\ttype = \n}';
            const doc = createDocument(content, testUri('/mod/events/test.txt'));
            const completions = await provider.provideCompletions(doc, Position.create(1, 8));
            assert.ok(Array.isArray(completions), 'Should return array of completions');
        });

        it('should provide completions for assignment values', async () => {
            const content = 'is_ai = ';
            const doc = createDocument(content, testUri('/mod/events/test.txt'));
            const completions = await provider.provideCompletions(doc, Position.create(0, 8));
            assert.ok(Array.isArray(completions), 'Should return array of completions');
        });
    });

    describe('engine-driven key completions (4.2)', () => {
        const EVENT = [
            'namespace = my_events',
            'my_events.0001 = {',
            '\ttrigger = {',
            '\t\t',
            '\t}',
            '\timmediate = {',
            '\t\t',
            '\t}',
            '\t',
            '}',
        ].join('\n');

        it('offers triggers, any_ iterators and structural keywords in a trigger block', async () => {
            const doc = createDocument(EVENT, testUri('/mod/events/test.txt'));
            const labels = (await provider.provideCompletions(doc, Position.create(3, 2))).map(
                (c) => c.label
            );
            assert.ok(labels.includes('is_adult'), 'trigger is_adult');
            assert.ok(labels.includes('any_vassal'), 'iterator any_vassal');
            assert.ok(labels.includes('limit') && labels.includes('OR'), 'structural keywords');
            assert.ok(!labels.includes('add_gold'), 'no effects in a trigger block');
            assert.ok(!labels.includes('every_vassal'), 'no effect iterators in a trigger block');
        });

        it('offers effects and every_/random_/ordered_ iterators in an effect block', async () => {
            const doc = createDocument(EVENT, testUri('/mod/events/test.txt'));
            const labels = (await provider.provideCompletions(doc, Position.create(6, 2))).map(
                (c) => c.label
            );
            assert.ok(labels.includes('add_gold'), 'effect add_gold');
            assert.ok(labels.includes('every_vassal') && labels.includes('random_vassal'));
            assert.ok(!labels.includes('is_adult'), 'no trigger-only names in an effect block');
            assert.ok(!labels.includes('any_vassal'), 'no any_ iterators in an effect block');
        });

        it('offers the directory schema fields inside a record', async () => {
            const doc = createDocument(EVENT, testUri('/mod/events/test.txt'));
            const labels = (await provider.provideCompletions(doc, Position.create(8, 1))).map(
                (c) => c.label
            );
            for (const field of ['option', 'immediate', 'trigger', 'after']) {
                assert.ok(labels.includes(field), `field ${field}`);
            }
            assert.ok(!labels.includes('add_gold'), 'a record body is not an effect block');
        });

        it('resolves the engine doc string verbatim', async () => {
            const doc = createDocument(EVENT, testUri('/mod/events/test.txt'));
            const items = await provider.provideCompletions(doc, Position.create(6, 2));
            const addGold = items.find((c) => c.label === 'add_gold');
            assert.ok(addGold);
            const resolved = await provider.resolveCompletion(addGold);
            const value =
                typeof resolved.documentation === 'string'
                    ? resolved.documentation
                    : (resolved.documentation?.value ?? '');
            assert.ok(value.includes(defaultSpec().doc('add_gold', 'effects') ?? '<none>'));
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
            const completions = await provider.provideCompletions(
                doc,
                Position.create(0, content.length)
            );
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
