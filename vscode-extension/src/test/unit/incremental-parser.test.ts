/**
 * Unit Tests for Incremental Parser
 */

import * as assert from 'assert';
import { IncrementalParser, ContentChange } from '../../server/core/incremental-parser';
import { NodeType } from '../../server/core/parser';

describe('IncrementalParser', () => {

    describe('initial parse', () => {
        it('parses a document and returns an AST', () => {
            const parser = new IncrementalParser();
            const result = parser.parse('key = value');
            assert.ok(result.ast, 'Should return an AST');
            assert.strictEqual(result.ast.type, NodeType.ROOT);
        });

        it('stores the AST for later incremental use', () => {
            const parser = new IncrementalParser();
            parser.parse('key = value');
            assert.ok(parser.getCurrentAst(), 'Should have stored AST');
        });
    });

    describe('incrementalParse', () => {
        it('falls back to full parse when no previous AST', () => {
            const parser = new IncrementalParser();
            const change: ContentChange = { text: 'key = value' };
            const result = parser.incrementalParse(change, 'key = value');
            assert.ok(result.ast);
        });

        it('falls back to full parse for full-document changes (no range)', () => {
            const parser = new IncrementalParser();
            parser.parse('key = old');
            const change: ContentChange = { text: 'key = new' };
            const result = parser.incrementalParse(change, 'key = new');
            assert.ok(result.ast);
            assert.strictEqual(result.ast.type, NodeType.ROOT);
        });

        it('handles a small range change', () => {
            const original = 'block = {\n\tkey = old_value\n}';
            const parser = new IncrementalParser();
            parser.parse(original);

            const newText = 'block = {\n\tkey = new_value\n}';
            const change: ContentChange = {
                range: {
                    start: { line: 1, character: 7 },
                    end: { line: 1, character: 16 },
                },
                text: 'new_value',
            };
            const result = parser.incrementalParse(change, newText);
            assert.ok(result.ast);
            assert.strictEqual(result.errors.length, 0);
        });
    });

    describe('invalidate', () => {
        it('clears the current AST', () => {
            const parser = new IncrementalParser();
            parser.parse('key = value');
            assert.ok(parser.getCurrentAst());
            parser.invalidate();
            assert.strictEqual(parser.getCurrentAst(), null);
        });
    });

    describe('extends CachingParser', () => {
        it('inherits content caching behaviour', () => {
            const parser = new IncrementalParser();
            const text = 'key = value';
            const r1 = parser.parse(text);
            const r2 = parser.parse(text);
            // Both calls should succeed (cache hit on second)
            assert.ok(r1.ast);
            assert.ok(r2.ast);
        });
    });
});
