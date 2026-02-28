/**
 * Unit Tests for Document Indexer
 */

import * as assert from 'assert';
import { DocumentIndexer, SymbolType, Symbol } from '../../server/core/indexer';
import { CK3Parser, ASTNode, NodeType } from '../../server/core/parser';

describe('DocumentIndexer', () => {
    let indexer: DocumentIndexer;
    let parser: CK3Parser;

    beforeEach(() => {
        indexer = new DocumentIndexer();
        parser = new CK3Parser();
    });

    function parseAndIndex(uri: string, text: string): Promise<void> {
        const result = parser.parse(text);
        return indexer.indexDocument(uri, result.ast);
    }

    describe('indexDocument()', () => {
        it('should index events from event files', async () => {
            await parseAndIndex('file:///mod/events/my_events.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\ttitle = my_mod.0001.t',
                '}',
            ].join('\n'));

            const symbols = indexer.getDocumentSymbols('file:///mod/events/my_events.txt');
            const events = symbols.filter(s => s.type === SymbolType.EVENT);
            assert.ok(events.length > 0, 'Should index at least one event');
            assert.strictEqual(events[0].name, 'my_mod.0001');
        });

        it('should index namespace from event IDs', async () => {
            await parseAndIndex('file:///mod/events/my_events.txt', [
                'my_mod.0001 = {',
                '\ttype = character_event',
                '}',
            ].join('\n'));

            const namespaces = indexer.findSymbolsByType(SymbolType.NAMESPACE);
            assert.ok(namespaces.some(s => s.name === 'my_mod'), 'Should extract namespace from event ID');
        });

        it('should index decisions from decision files', async () => {
            await parseAndIndex('file:///mod/decisions/my_decisions.txt', [
                'adopt_feudalism_decision = {',
                '\tis_shown = {',
                '\t\tis_ruler = yes',
                '\t}',
                '}',
            ].join('\n'));

            const decisions = indexer.findSymbolsByType(SymbolType.DECISION);
            assert.strictEqual(decisions.length, 1);
            assert.strictEqual(decisions[0].name, 'adopt_feudalism_decision');
        });

        it('should index scripted effects', async () => {
            await parseAndIndex('file:///mod/scripted_effects/my_effects.txt', [
                'my_custom_effect = {',
                '\tadd_gold = 100',
                '}',
            ].join('\n'));

            const effects = indexer.findSymbolsByType(SymbolType.SCRIPTED_EFFECT);
            assert.strictEqual(effects.length, 1);
            assert.strictEqual(effects[0].name, 'my_custom_effect');
        });

        it('should index scripted triggers', async () => {
            await parseAndIndex('file:///mod/scripted_triggers/my_triggers.txt', [
                'my_custom_trigger = {',
                '\tis_alive = yes',
                '}',
            ].join('\n'));

            const triggers = indexer.findSymbolsByType(SymbolType.SCRIPTED_TRIGGER);
            assert.strictEqual(triggers.length, 1);
            assert.strictEqual(triggers[0].name, 'my_custom_trigger');
        });

        it('should index on-actions', async () => {
            await parseAndIndex('file:///mod/on_actions/my_on_actions.txt', [
                'on_birth = {',
                '\tevents = {',
                '\t\tmy_mod.0001',
                '\t}',
                '}',
            ].join('\n'));

            const onActions = indexer.findSymbolsByType(SymbolType.ON_ACTION);
            assert.ok(onActions.length > 0);
            assert.strictEqual(onActions[0].name, 'on_birth');
        });

        it('should index character interactions', async () => {
            await parseAndIndex('file:///mod/character_interactions/my_interactions.txt', [
                'my_interaction = {',
                '\tis_shown = {',
                '\t\tis_alive = yes',
                '\t}',
                '}',
            ].join('\n'));

            const interactions = indexer.findSymbolsByType(SymbolType.CHARACTER_INTERACTION);
            assert.strictEqual(interactions.length, 1);
            assert.strictEqual(interactions[0].name, 'my_interaction');
        });

        it('should extract event detail (title)', async () => {
            await parseAndIndex('file:///mod/events/titled_events.txt', [
                'my_mod.0001 = {',
                '\ttitle = my_mod.0001.t',
                '\tdesc = my_mod.0001.desc',
                '}',
            ].join('\n'));

            const events = indexer.findSymbolsByType(SymbolType.EVENT);
            assert.ok(events.length > 0);
            assert.strictEqual(events[0].detail, 'my_mod.0001.t');
        });

        it('should extract decision detail (title)', async () => {
            await parseAndIndex('file:///mod/decisions/titled_decisions.txt', [
                'my_decision = {',
                '\ttitle = my_decision_title',
                '}',
            ].join('\n'));

            const decisions = indexer.findSymbolsByType(SymbolType.DECISION);
            assert.strictEqual(decisions[0].detail, 'my_decision_title');
        });
    });

    describe('nested symbol extraction', () => {
        it('should index save_scope_as variables', async () => {
            await parseAndIndex('file:///mod/events/scope_events.txt', [
                'my_mod.0001 = {',
                '\teffect = {',
                '\t\tsave_scope_as = my_saved_scope',
                '\t}',
                '}',
            ].join('\n'));

            const scopes = indexer.findSymbolsByType(SymbolType.SCOPE);
            assert.ok(scopes.some(s => s.name === 'my_saved_scope'));
        });

        it('should index set_variable names', async () => {
            await parseAndIndex('file:///mod/events/var_events.txt', [
                'my_mod.0001 = {',
                '\teffect = {',
                '\t\tset_variable = {',
                '\t\t\tname = my_var',
                '\t\t\tvalue = 10',
                '\t\t}',
                '\t}',
                '}',
            ].join('\n'));

            const variables = indexer.findSymbolsByType(SymbolType.VARIABLE);
            assert.ok(variables.some(s => s.name === 'my_var'));
        });
    });

    describe('removeDocument()', () => {
        it('should remove all symbols for a document', async () => {
            await parseAndIndex('file:///mod/events/test.txt', 'my_mod.0001 = { type = character_event }');

            assert.ok(indexer.getDocumentSymbols('file:///mod/events/test.txt').length > 0);

            indexer.removeDocument('file:///mod/events/test.txt');

            assert.strictEqual(indexer.getDocumentSymbols('file:///mod/events/test.txt').length, 0);
        });

        it('should remove from name index', async () => {
            await parseAndIndex('file:///mod/events/test.txt', 'my_mod.0001 = { type = character_event }');

            assert.ok(indexer.findSymbolsByName('my_mod.0001').length > 0);

            indexer.removeDocument('file:///mod/events/test.txt');

            assert.strictEqual(indexer.findSymbolsByName('my_mod.0001').length, 0);
        });

        it('should remove from type index', async () => {
            await parseAndIndex('file:///mod/events/test.txt', 'my_mod.0001 = { type = character_event }');

            const eventsBefore = indexer.findSymbolsByType(SymbolType.EVENT);
            const countBefore = eventsBefore.length;

            indexer.removeDocument('file:///mod/events/test.txt');

            const eventsAfter = indexer.findSymbolsByType(SymbolType.EVENT);
            assert.ok(eventsAfter.length < countBefore);
        });

        it('should be safe to call on non-existent document', () => {
            assert.doesNotThrow(() => {
                indexer.removeDocument('file:///nonexistent.txt');
            });
        });
    });

    describe('findSymbolsByName()', () => {
        it('should find symbols by exact name', async () => {
            await parseAndIndex('file:///mod/events/test.txt', [
                'my_mod.0001 = { type = character_event }',
                'my_mod.0002 = { type = character_event }',
            ].join('\n'));

            const results = indexer.findSymbolsByName('my_mod.0001');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].name, 'my_mod.0001');
        });

        it('should return empty for non-existent name', () => {
            const results = indexer.findSymbolsByName('nonexistent');
            assert.strictEqual(results.length, 0);
        });

        it('should find symbols across multiple documents', async () => {
            await parseAndIndex('file:///mod/events/file1.txt', 'test_event = { type = character_event }');
            await parseAndIndex('file:///mod/events/file2.txt', 'test_event = { type = letter_event }');

            const results = indexer.findSymbolsByName('test_event');
            assert.strictEqual(results.length, 2);
        });
    });

    describe('findSymbolsByType()', () => {
        it('should find all events', async () => {
            await parseAndIndex('file:///mod/events/test.txt', [
                'my_mod.0001 = { type = character_event }',
                'my_mod.0002 = { type = letter_event }',
            ].join('\n'));

            const events = indexer.findSymbolsByType(SymbolType.EVENT);
            assert.strictEqual(events.length, 2);
        });

        it('should not mix types', async () => {
            await parseAndIndex('file:///mod/events/test.txt', 'my_mod.0001 = { }');
            await parseAndIndex('file:///mod/decisions/test.txt', 'my_decision = { }');

            const events = indexer.findSymbolsByType(SymbolType.EVENT);
            const decisions = indexer.findSymbolsByType(SymbolType.DECISION);

            for (const e of events) {
                assert.strictEqual(e.type, SymbolType.EVENT);
            }
            for (const d of decisions) {
                assert.strictEqual(d.type, SymbolType.DECISION);
            }
        });
    });

    describe('searchSymbols()', () => {
        it('should find symbols by partial name', async () => {
            await parseAndIndex('file:///mod/events/test.txt', [
                'my_mod.0001 = { }',
                'my_mod.0002 = { }',
                'other_mod.0001 = { }',
            ].join('\n'));

            const results = indexer.searchSymbols('my_mod');
            assert.ok(results.length >= 2, 'Should find at least 2 my_mod symbols');
        });

        it('should be case-insensitive', async () => {
            await parseAndIndex('file:///mod/events/test.txt', 'MyEvent = { }');

            const results = indexer.searchSymbols('myevent');
            assert.ok(results.length >= 1, 'Search should be case-insensitive');
        });

        it('should return empty for no matches', () => {
            const results = indexer.searchSymbols('zzz_nonexistent_zzz');
            assert.strictEqual(results.length, 0);
        });
    });

    describe('getDocumentSymbols()', () => {
        it('should return all symbols for a document', async () => {
            await parseAndIndex('file:///mod/events/test.txt', [
                'my_mod.0001 = { type = character_event }',
                'my_mod.0002 = { type = letter_event }',
            ].join('\n'));

            const symbols = indexer.getDocumentSymbols('file:///mod/events/test.txt');
            assert.ok(symbols.length >= 2, 'Should have at least 2 symbols');
        });

        it('should return empty for unknown document', () => {
            const symbols = indexer.getDocumentSymbols('file:///unknown.txt');
            assert.strictEqual(symbols.length, 0);
        });
    });

    describe('getStatistics()', () => {
        it('should count documents and symbols', async () => {
            await parseAndIndex('file:///mod/events/test1.txt', 'my_mod.0001 = { }');
            await parseAndIndex('file:///mod/events/test2.txt', 'my_mod.0002 = { }');

            const stats = indexer.getStatistics();
            assert.strictEqual(stats.totalDocuments, 2);
            assert.ok(stats.totalSymbols >= 2);
        });

        it('should report empty stats for fresh indexer', () => {
            const stats = indexer.getStatistics();
            assert.strictEqual(stats.totalDocuments, 0);
            assert.strictEqual(stats.totalSymbols, 0);
        });
    });

    describe('re-indexing', () => {
        it('should update symbols when a document is re-indexed', async () => {
            await parseAndIndex('file:///mod/events/test.txt', 'my_mod.0001 = { }');
            assert.ok(indexer.findSymbolsByName('my_mod.0001').length > 0);

            // Re-index with different content
            await parseAndIndex('file:///mod/events/test.txt', 'my_mod.0099 = { }');

            assert.strictEqual(indexer.findSymbolsByName('my_mod.0001').length, 0);
            assert.ok(indexer.findSymbolsByName('my_mod.0099').length > 0);
        });
    });
});
