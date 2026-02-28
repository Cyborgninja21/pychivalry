/**
 * Unit Tests for Call Hierarchy Provider
 *
 * Tests the LSP call hierarchy protocol handlers:
 * - prepareCallHierarchy: Identifies CK3 symbols at cursor
 * - incomingCalls: What triggers/calls a symbol
 * - outgoingCalls: What a symbol triggers/calls
 */

import * as assert from 'assert';
import { CallHierarchyProvider } from '../../server/lsp/call-hierarchy';
import { EnhancedIndexer } from '../../server/core/indexer-enhanced';
import { CK3Parser } from '../../server/core/parser';
import { SymbolType } from '../../server/core/indexer';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SymbolKind } from 'vscode-languageserver/node';

describe('CallHierarchyProvider', () => {
    let provider: CallHierarchyProvider;
    let indexer: EnhancedIndexer;
    let parser: CK3Parser;

    beforeEach(() => {
        indexer = new EnhancedIndexer();
        parser = new CK3Parser();
        provider = new CallHierarchyProvider(parser, indexer);
    });

    function createDocument(uri: string, content: string): TextDocument {
        return TextDocument.create(uri, 'ck3', 1, content);
    }

    async function indexDocument(uri: string, text: string): Promise<void> {
        const result = parser.parse(text);
        await indexer.indexDocumentEnhanced(uri, result.ast);
    }

    describe('prepareCallHierarchy', () => {
        it('should return a CallHierarchyItem for an event ID at cursor', async () => {
            const content = [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n');
            const uri = 'file:///mod/events/test.txt';
            const doc = createDocument(uri, content);
            await indexDocument(uri, content);

            // Position cursor on "my_mod.0001" (line 0, char 5)
            const result = provider.prepareCallHierarchy(doc, {
                textDocument: { uri },
                position: { line: 0, character: 5 },
            });

            assert.ok(result, 'Should return items');
            assert.strictEqual(result!.length, 1);
            assert.strictEqual(result![0].name, 'my_mod.0001');
            assert.strictEqual(result![0].kind, SymbolKind.Event);
        });

        it('should return null when cursor is on whitespace', async () => {
            const content = [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '}',
            ].join('\n');
            const uri = 'file:///mod/events/test.txt';
            const doc = createDocument(uri, content);
            await indexDocument(uri, content);

            // Position cursor on the '{' character which is not an identifier
            const result = provider.prepareCallHierarchy(doc, {
                textDocument: { uri },
                position: { line: 0, character: 14 },
            });

            // The '{' character is not an identifier, so this should be null
            assert.ok(!result || result.length === 0, 'Should return null or empty for non-identifier');
        });

        it('should return item for scripted effect name', async () => {
            const content = [
                'my_custom_effect = {',
                '\tadd_gold = 100',
                '}',
            ].join('\n');
            const uri = 'file:///mod/scripted_effects/my_effects.txt';
            const doc = createDocument(uri, content);
            await indexDocument(uri, content);

            // Position cursor on "my_custom_effect" (line 0, char 5)
            const result = provider.prepareCallHierarchy(doc, {
                textDocument: { uri },
                position: { line: 0, character: 5 },
            });

            assert.ok(result, 'Should return items for scripted effect');
            assert.strictEqual(result!.length, 1);
            assert.strictEqual(result![0].name, 'my_custom_effect');
            assert.strictEqual(result![0].kind, SymbolKind.Function);
        });
    });

    describe('incomingCalls', () => {
        it('should return callers of an event', async () => {
            // Event A triggers Event B
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
                'my_mod.0002 = {',
                '\ttype = character_event',
                '\ttrigger = { always = yes }',
                '}',
            ].join('\n'));

            const result = provider.incomingCalls({
                item: {
                    name: 'my_mod.0002',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0002', type: SymbolType.EVENT },
                },
            });

            assert.ok(result.length > 0, 'Should have incoming callers');
            assert.strictEqual(result[0].from.name, 'my_mod.0001');
            assert.ok(result[0].fromRanges.length > 0, 'Should have call site ranges');
        });

        it('should group multiple call sites from same caller', async () => {
            // Event A triggers Event B in two places
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '\tafter = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
                'my_mod.0002 = {',
                '\ttype = character_event',
                '\ttrigger = { always = yes }',
                '}',
            ].join('\n'));

            const result = provider.incomingCalls({
                item: {
                    name: 'my_mod.0002',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0002', type: SymbolType.EVENT },
                },
            });

            assert.strictEqual(result.length, 1, 'Should group into one incoming call entry');
            assert.strictEqual(result[0].from.name, 'my_mod.0001');
            assert.strictEqual(result[0].fromRanges.length, 2, 'Should have two call site ranges');
        });

        it('should return empty for event with no callers', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\ttrigger = { always = yes }',
                '}',
            ].join('\n'));

            const result = provider.incomingCalls({
                item: {
                    name: 'my_mod.0001',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0001', type: SymbolType.EVENT },
                },
            });

            assert.strictEqual(result.length, 0, 'Should have no incoming callers');
        });
    });

    describe('outgoingCalls', () => {
        it('should return events triggered by an event', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t\ttrigger_event = my_mod.0003',
                '\t}',
                '}',
            ].join('\n'));

            const result = provider.outgoingCalls({
                item: {
                    name: 'my_mod.0001',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0001', type: SymbolType.EVENT },
                },
            });

            assert.ok(result.length >= 2, 'Should have at least two outgoing calls');
            const names = result.map(r => r.to.name);
            assert.ok(names.includes('my_mod.0002'), 'Should include my_mod.0002');
            assert.ok(names.includes('my_mod.0003'), 'Should include my_mod.0003');
        });

        it('should return scripted effects called by an event', async () => {
            // Index scripted effect first
            await indexDocument('file:///mod/scripted_effects/my_effects.txt', [
                'my_custom_effect = {',
                '\tadd_gold = 100',
                '}',
            ].join('\n'));

            // Index event that uses it
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\tmy_custom_effect = yes',
                '\t}',
                '}',
            ].join('\n'));

            const result = provider.outgoingCalls({
                item: {
                    name: 'my_mod.0001',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0001', type: SymbolType.EVENT },
                },
            });

            const effectCall = result.find(r => r.to.name === 'my_custom_effect');
            assert.ok(effectCall, 'Should include scripted effect in outgoing calls');
        });

        it('should return empty for event with no outgoing calls', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\ttrigger = { always = yes }',
                '}',
            ].join('\n'));

            const result = provider.outgoingCalls({
                item: {
                    name: 'my_mod.0001',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0001', type: SymbolType.EVENT },
                },
            });

            assert.strictEqual(result.length, 0, 'Should have no outgoing calls');
        });
    });

    describe('edge cases', () => {
        it('should handle unresolved event targets gracefully', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\ttrigger_event = nonexistent.9999',
                '\t}',
                '}',
            ].join('\n'));

            const result = provider.outgoingCalls({
                item: {
                    name: 'my_mod.0001',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/test.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0001', type: SymbolType.EVENT },
                },
            });

            // Should still return the call, with a synthetic item
            const unresolvedCall = result.find(r => r.to.name === 'nonexistent.9999');
            assert.ok(unresolvedCall, 'Should include unresolved target as synthetic item');
            assert.strictEqual(unresolvedCall!.to.detail, '(unresolved)');
        });

        it('should handle cross-file call graphs', async () => {
            // Event in file A
            await indexDocument('file:///mod/events/a.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n'));

            // Event in file B
            await indexDocument('file:///mod/events/b.txt', [
                'my_mod.0002 = {',
                '\ttype = character_event',
                '\ttrigger = { always = yes }',
                '}',
            ].join('\n'));

            // Check incoming calls to event in file B
            const incoming = provider.incomingCalls({
                item: {
                    name: 'my_mod.0002',
                    kind: SymbolKind.Event,
                    uri: 'file:///mod/events/b.txt',
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                    data: { name: 'my_mod.0002', type: SymbolType.EVENT },
                },
            });

            assert.ok(incoming.length > 0, 'Should find cross-file callers');
            assert.strictEqual(incoming[0].from.name, 'my_mod.0001');
        });
    });
});
