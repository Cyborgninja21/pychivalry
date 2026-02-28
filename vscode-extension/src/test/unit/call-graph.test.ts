/**
 * Unit Tests for Call Graph
 *
 * Tests call edge creation for all five call patterns:
 * - trigger_event (inline and block forms)
 * - Scripted effect invocations
 * - Scripted trigger invocations
 * - On-action event listings
 * - Decision effect → event relationships
 *
 * Also tests clearDocument, circular reference detection, and edge indexing.
 */

import * as assert from 'assert';
import { CallGraph, CallKind, CallEdge } from '../../server/core/call-graph';
import { EnhancedIndexer } from '../../server/core/indexer-enhanced';
import { CK3Parser } from '../../server/core/parser';
import { SymbolType } from '../../server/core/indexer';

describe('CallGraph', () => {
    let indexer: EnhancedIndexer;
    let parser: CK3Parser;

    beforeEach(() => {
        indexer = new EnhancedIndexer();
        parser = new CK3Parser();
    });

    /**
     * Helper: parse text, index with EnhancedIndexer, then build call graph.
     * Uses the integrated call graph from EnhancedIndexer.
     */
    async function indexDocument(uri: string, text: string): Promise<void> {
        const result = parser.parse(text);
        await indexer.indexDocumentEnhanced(uri, result.ast);
    }

    function getCallGraph(): CallGraph {
        return indexer.getCallGraph();
    }

    describe('trigger_event edges', () => {
        it('should create an edge for trigger_event with block form { id = ... }', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = {',
                '\t\t\tid = my_mod.0002',
                '\t\t}',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            assert.ok(outgoing.length > 0, 'Should have outgoing calls');

            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0002');
            assert.ok(eventEdge, 'Should find edge to my_mod.0002');
            assert.strictEqual(eventEdge!.callKind, CallKind.TRIGGER_EVENT);
            assert.strictEqual(eventEdge!.fromType, SymbolType.EVENT);
            assert.strictEqual(eventEdge!.toType, SymbolType.EVENT);
        });

        it('should create an edge for trigger_event with inline event ID', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0002');
            assert.ok(eventEdge, 'Should find inline trigger_event edge');
        });

        it('should track the source range of the call site', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0002');
            assert.ok(eventEdge, 'Should find edge');
            assert.ok(eventEdge!.sourceRange, 'Edge should have a source range');
            assert.strictEqual(eventEdge!.sourceUri, 'file:///mod/events/test.txt');
        });

        it('should create edges for trigger_event in event options', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\toption = {',
                '\t\tname = my_mod.0001.a',
                '\t\ttrigger_event = my_mod.0003',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0003');
            assert.ok(eventEdge, 'Should find trigger_event edge from option');
        });

        it('should create edges for trigger_event in after block', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\tafter = {',
                '\t\ttrigger_event = my_mod.0004',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0004');
            assert.ok(eventEdge, 'Should find trigger_event edge from after block');
        });
    });

    describe('scripted effect edges', () => {
        it('should create an edge when a known scripted effect is invoked', async () => {
            // First, index the scripted effect definition
            await indexDocument('file:///mod/scripted_effects/my_effects.txt', [
                'my_custom_effect = {',
                '\tadd_gold = 100',
                '}',
            ].join('\n'));

            // Then index an event that uses it
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\tmy_custom_effect = yes',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const effectEdge = outgoing.find(e => e.toName === 'my_custom_effect');
            assert.ok(effectEdge, 'Should find scripted effect invocation edge');
            assert.strictEqual(effectEdge!.callKind, CallKind.SCRIPTED_EFFECT);
            assert.strictEqual(effectEdge!.toType, SymbolType.SCRIPTED_EFFECT);
        });

        it('should not create edges for built-in effects', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\tadd_gold = 100',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const goldEdge = outgoing.find(e => e.toName === 'add_gold');
            assert.ok(!goldEdge, 'Should not create edge for built-in effect add_gold');
        });
    });

    describe('scripted trigger edges', () => {
        it('should create an edge when a known scripted trigger is invoked', async () => {
            // Index the scripted trigger definition
            await indexDocument('file:///mod/scripted_triggers/my_triggers.txt', [
                'my_custom_trigger = {',
                '\tis_alive = yes',
                '}',
            ].join('\n'));

            // Index an event that uses it in its trigger block
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\ttrigger = {',
                '\t\tmy_custom_trigger = yes',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const triggerEdge = outgoing.find(e => e.toName === 'my_custom_trigger');
            assert.ok(triggerEdge, 'Should find scripted trigger invocation edge');
            assert.strictEqual(triggerEdge!.callKind, CallKind.SCRIPTED_TRIGGER);
            assert.strictEqual(triggerEdge!.toType, SymbolType.SCRIPTED_TRIGGER);
        });
    });

    describe('on-action edges', () => {
        it('should create edges from on-action to listed events', async () => {
            await indexDocument('file:///mod/on_actions/test.txt', [
                'on_birth = {',
                '\tevents = {',
                '\t\tmy_mod.0001',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('on_birth');
            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0001');
            assert.ok(eventEdge, 'Should find on-action to event edge');
            assert.strictEqual(eventEdge!.callKind, CallKind.ON_ACTION_EVENT);
            assert.strictEqual(eventEdge!.fromType, SymbolType.ON_ACTION);
        });
    });

    describe('decision edges', () => {
        it('should create edges from decision effect to triggered events', async () => {
            // Index the decision
            await indexDocument('file:///mod/decisions/test.txt', [
                'my_decision = {',
                '\teffect = {',
                '\t\ttrigger_event = my_mod.0001',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_decision');
            const eventEdge = outgoing.find(e => e.toName === 'my_mod.0001');
            assert.ok(eventEdge, 'Should find decision to event edge');
            assert.strictEqual(eventEdge!.callKind, CallKind.DECISION_EVENT);
        });
    });

    describe('incoming calls', () => {
        it('should return incoming calls for a target event', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const incoming = callGraph.getIncomingCalls('my_mod.0002');
            assert.ok(incoming.length > 0, 'Should have incoming calls');
            assert.strictEqual(incoming[0].fromName, 'my_mod.0001');
        });
    });

    describe('clearDocument', () => {
        it('should remove all edges from a document when cleared', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            assert.ok(callGraph.getOutgoingCalls('my_mod.0001').length > 0, 'Should have edges before clear');

            callGraph.clearDocument('file:///mod/events/test.txt');
            assert.strictEqual(callGraph.getOutgoingCalls('my_mod.0001').length, 0, 'Should have no edges after clear');
            assert.strictEqual(callGraph.getIncomingCalls('my_mod.0002').length, 0, 'Incoming should be cleared too');
        });

        it('should not affect edges from other documents', async () => {
            await indexDocument('file:///mod/events/a.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0003',
                '\t}',
                '}',
            ].join('\n'));

            await indexDocument('file:///mod/events/b.txt', [
                'character_event = {',
                '\tid = my_mod.0002',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0003',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            callGraph.clearDocument('file:///mod/events/a.txt');

            assert.strictEqual(callGraph.getOutgoingCalls('my_mod.0001').length, 0, 'Doc A edges should be gone');
            assert.ok(callGraph.getOutgoingCalls('my_mod.0002').length > 0, 'Doc B edges should remain');
        });
    });

    describe('circular reference detection', () => {
        it('should detect a direct cycle (A -> B -> A)', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
                'character_event = {',
                '\tid = my_mod.0002',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0001',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const result = callGraph.detectCircularReferences('my_mod.0001');
            assert.strictEqual(result.hasCircular, true, 'Should detect circular reference');
            assert.ok(result.cyclePath.length > 0, 'Should include cycle path');
        });

        it('should report no cycle when none exists', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const result = callGraph.detectCircularReferences('my_mod.0001');
            assert.strictEqual(result.hasCircular, false, 'Should not detect circular reference');
        });

        it('should detect an indirect cycle (A -> B -> C -> A)', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '}',
                'character_event = {',
                '\tid = my_mod.0002',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0003',
                '\t}',
                '}',
                'character_event = {',
                '\tid = my_mod.0003',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0001',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const result = callGraph.detectCircularReferences('my_mod.0001');
            assert.strictEqual(result.hasCircular, true, 'Should detect indirect circular reference');
        });
    });

    describe('multiple outgoing calls', () => {
        it('should track all outgoing calls from a single event', async () => {
            await indexDocument('file:///mod/events/test.txt', [
                'character_event = {',
                '\tid = my_mod.0001',
                '\timmediate = {',
                '\t\ttrigger_event = my_mod.0002',
                '\t}',
                '\toption = {',
                '\t\tname = my_mod.0001.a',
                '\t\ttrigger_event = my_mod.0003',
                '\t}',
                '\tafter = {',
                '\t\ttrigger_event = my_mod.0004',
                '\t}',
                '}',
            ].join('\n'));

            const callGraph = getCallGraph();
            const outgoing = callGraph.getOutgoingCalls('my_mod.0001');
            const targetNames = outgoing.map(e => e.toName);
            assert.ok(targetNames.includes('my_mod.0002'), 'Should include immediate target');
            assert.ok(targetNames.includes('my_mod.0003'), 'Should include option target');
            assert.ok(targetNames.includes('my_mod.0004'), 'Should include after target');
        });
    });
});
