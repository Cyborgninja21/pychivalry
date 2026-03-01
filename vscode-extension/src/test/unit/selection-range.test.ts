/**
 * Unit Tests for Selection Range Provider
 *
 * Tests the LSP selection range protocol for smart expand/shrink selection
 * that understands CK3 script block structure.
 */

import * as assert from 'assert';
import { SelectionRangeProvider } from '../../server/lsp/selection-range';
import { CK3Parser } from '../../server/core/parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SelectionRange, Position, Range } from 'vscode-languageserver/node';

describe('SelectionRangeProvider', () => {
    let provider: SelectionRangeProvider;
    let parser: CK3Parser;

    beforeEach(() => {
        parser = new CK3Parser();
        provider = new SelectionRangeProvider(parser);
    });

    function createDocument(content: string): TextDocument {
        return TextDocument.create('file:///test.txt', 'ck3', 1, content);
    }

    /** Collect the full chain of ranges from innermost to outermost */
    function collectChain(sr: SelectionRange): Range[] {
        const result: Range[] = [];
        let current: SelectionRange | undefined = sr;
        while (current) {
            result.push(current.range);
            current = current.parent;
        }
        return result;
    }

    /** Helper to create a Position */
    function pos(line: number, character: number): Position {
        return { line, character };
    }

    /** Helper to check a range matches expected values */
    function assertRange(range: Range, startLine: number, startChar: number, endLine: number, endChar: number, label?: string): void {
        const msg = label ? ` (${label})` : '';
        assert.strictEqual(range.start.line, startLine, `start.line${msg}`);
        assert.strictEqual(range.start.character, startChar, `start.character${msg}`);
        assert.strictEqual(range.end.line, endLine, `end.line${msg}`);
        assert.strictEqual(range.end.character, endChar, `end.character${msg}`);
    }

    describe('simple assignment', () => {
        it('should expand from value to assignment to root', () => {
            const content = 'is_alive = yes';
            const doc = createDocument(content);

            // Cursor on "yes" (character 11)
            const results = provider.provideSelectionRanges(doc, [pos(0, 11)]);
            assert.strictEqual(results.length, 1);

            const chain = collectChain(results[0]);
            // Should have at least: value range, assignment range, root range
            assert.ok(chain.length >= 2, `Expected at least 2 levels, got ${chain.length}`);

            // Innermost should be the value "yes"
            assertRange(chain[0], 0, 11, 0, 14, 'value');
        });

        it('should start at assignment when cursor is on key', () => {
            const content = 'is_alive = yes';
            const doc = createDocument(content);

            // Cursor on "is_alive" (character 3)
            const results = provider.provideSelectionRanges(doc, [pos(0, 3)]);
            assert.strictEqual(results.length, 1);

            const chain = collectChain(results[0]);
            // Innermost should be the full assignment (no sub-value range)
            assertRange(chain[0], 0, 0, 0, 14, 'assignment');
        });
    });

    describe('nested block', () => {
        it('should expand through block inner content and full block', () => {
            const content = [
                'trigger = {',
                '\tis_alive = yes',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor on "yes" (line 1, char 12)
            const results = provider.provideSelectionRanges(doc, [pos(1, 12)]);
            assert.strictEqual(results.length, 1);

            const chain = collectChain(results[0]);
            // Should include: value -> assignment -> block inner -> block full -> root
            assert.ok(chain.length >= 4, `Expected at least 4 levels, got ${chain.length}`);
        });

        it('should include inner brace content as an expansion level', () => {
            const content = [
                'trigger = {',
                '\tis_alive = yes',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor on "is_alive" (line 1, char 2)
            const results = provider.provideSelectionRanges(doc, [pos(1, 2)]);
            const chain = collectChain(results[0]);

            // One of the ranges should be the inner brace content
            // which starts after '{' on line 0 and ends before '}' on line 2
            const hasInnerRange = chain.some(r =>
                r.start.line === 0 && r.start.character === 11 &&
                r.end.line === 2 && r.end.character === 0
            );
            assert.ok(hasInnerRange, 'Should have inner brace content range');
        });
    });

    describe('deeply nested blocks', () => {
        it('should expand through all nesting levels', () => {
            const content = [
                'every_vassal = {',
                '\tlimit = {',
                '\t\tis_alive = yes',
                '\t}',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor on "yes" (line 2, char 13)
            const results = provider.provideSelectionRanges(doc, [pos(2, 13)]);
            const chain = collectChain(results[0]);

            // Should have many levels: value -> assignment -> limit inner -> limit full ->
            // every_vassal inner -> every_vassal full -> root
            assert.ok(chain.length >= 5, `Expected at least 5 levels for deep nesting, got ${chain.length}`);
        });
    });

    describe('comparison node', () => {
        it('should expand from value to comparison to parent', () => {
            const content = [
                'trigger = {',
                '\tage >= 16',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor on "16" (line 1, char 8)
            const results = provider.provideSelectionRanges(doc, [pos(1, 8)]);
            const chain = collectChain(results[0]);

            assert.ok(chain.length >= 2, `Expected at least 2 levels, got ${chain.length}`);
        });
    });

    describe('LIST node', () => {
        it('should expand from value through list inner to list full', () => {
            const content = [
                'random_list = {',
                '\t10 = { add_gold = 50 }',
                '\t20 = { add_gold = 100 }',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor inside the list (line 1, char 2)
            const results = provider.provideSelectionRanges(doc, [pos(1, 2)]);
            const chain = collectChain(results[0]);

            assert.ok(chain.length >= 3, `Expected at least 3 levels, got ${chain.length}`);
        });
    });

    describe('comment nodes', () => {
        it('should handle cursor on a single comment', () => {
            const content = [
                '# This is a comment',
                'is_alive = yes',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor on comment (line 0, char 5)
            const results = provider.provideSelectionRanges(doc, [pos(0, 5)]);
            const chain = collectChain(results[0]);

            assert.ok(chain.length >= 1, 'Should have at least comment range');
        });

        it('should group consecutive comments', () => {
            const content = [
                '# Comment line 1',
                '# Comment line 2',
                '# Comment line 3',
                'is_alive = yes',
            ].join('\n');
            const doc = createDocument(content);

            // Cursor on middle comment (line 1, char 5)
            const results = provider.provideSelectionRanges(doc, [pos(1, 5)]);
            const chain = collectChain(results[0]);

            // Should have: single comment -> comment group -> root
            const hasGroupRange = chain.some(r =>
                r.start.line === 0 && r.end.line === 2
            );
            assert.ok(hasGroupRange, 'Should have comment group range spanning all 3 comments');
        });
    });

    describe('empty block', () => {
        it('should handle empty blocks gracefully', () => {
            const content = 'trigger = { }';
            const doc = createDocument(content);

            // Cursor inside empty block (line 0, char 12)
            const results = provider.provideSelectionRanges(doc, [pos(0, 12)]);
            const chain = collectChain(results[0]);

            // Should still produce valid ranges
            assert.ok(chain.length >= 1, 'Should have at least one range');
        });
    });

    describe('multiple positions', () => {
        it('should return a selection range for each requested position', () => {
            const content = [
                'is_alive = yes',
                'age = 25',
            ].join('\n');
            const doc = createDocument(content);

            const results = provider.provideSelectionRanges(doc, [
                pos(0, 11), // on "yes"
                pos(1, 6),  // on "25"
            ]);

            assert.strictEqual(results.length, 2, 'Should return one range per position');
        });
    });

    describe('chain structure', () => {
        it('should have strictly expanding ranges from innermost to outermost', () => {
            const content = [
                'every_vassal = {',
                '\tlimit = {',
                '\t\tis_alive = yes',
                '\t}',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            const results = provider.provideSelectionRanges(doc, [pos(2, 13)]);
            const chain = collectChain(results[0]);

            // Each range in the chain should be strictly contained in its parent
            for (let i = 0; i < chain.length - 1; i++) {
                const inner = chain[i];
                const outer = chain[i + 1];

                const innerStartsBefore =
                    outer.start.line < inner.start.line ||
                    (outer.start.line === inner.start.line && outer.start.character <= inner.start.character);
                const innerEndsAfter =
                    outer.end.line > inner.end.line ||
                    (outer.end.line === inner.end.line && outer.end.character >= inner.end.character);

                assert.ok(
                    innerStartsBefore && innerEndsAfter,
                    `Range ${i} should be contained within range ${i + 1}`,
                );
            }
        });

        it('should have no duplicate ranges in the chain', () => {
            const content = [
                'trigger = {',
                '\tis_alive = yes',
                '}',
            ].join('\n');
            const doc = createDocument(content);

            const results = provider.provideSelectionRanges(doc, [pos(1, 12)]);
            const chain = collectChain(results[0]);

            for (let i = 0; i < chain.length; i++) {
                for (let j = i + 1; j < chain.length; j++) {
                    const a = chain[i];
                    const b = chain[j];
                    const same = a.start.line === b.start.line &&
                        a.start.character === b.start.character &&
                        a.end.line === b.end.line &&
                        a.end.character === b.end.character;
                    assert.ok(!same, `Ranges ${i} and ${j} should not be identical`);
                }
            }
        });
    });
});
