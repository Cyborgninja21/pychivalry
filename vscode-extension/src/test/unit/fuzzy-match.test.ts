/**
 * Unit Tests for fuzzy-match utilities
 */

import * as assert from 'assert';
import { levenshteinDistance, similarityRatio, findSimilar } from '../../server/utils/fuzzy-match';

describe('Fuzzy Match Utilities', () => {

    describe('levenshteinDistance()', () => {
        it('returns 0 for identical strings', () => {
            assert.strictEqual(levenshteinDistance('hello', 'hello'), 0);
        });

        it('returns length of non-empty string when other is empty', () => {
            assert.strictEqual(levenshteinDistance('abc', ''), 3);
            assert.strictEqual(levenshteinDistance('', 'xyz'), 3);
        });

        it('returns 0 for two empty strings', () => {
            assert.strictEqual(levenshteinDistance('', ''), 0);
        });

        it('computes single insertion', () => {
            assert.strictEqual(levenshteinDistance('cat', 'cats'), 1);
        });

        it('computes single deletion', () => {
            assert.strictEqual(levenshteinDistance('cats', 'cat'), 1);
        });

        it('computes single substitution', () => {
            assert.strictEqual(levenshteinDistance('cat', 'cut'), 1);
        });

        it('computes complex difference', () => {
            assert.strictEqual(levenshteinDistance('kitten', 'sitting'), 3);
        });

        it('is commutative', () => {
            assert.strictEqual(
                levenshteinDistance('abc', 'xyz'),
                levenshteinDistance('xyz', 'abc'),
            );
        });
    });

    describe('similarityRatio()', () => {
        it('returns 1.0 for identical strings', () => {
            assert.strictEqual(similarityRatio('hello', 'hello'), 1.0);
        });

        it('returns 0.0 for completely different strings of equal length', () => {
            // "abc" vs "xyz" → distance 3, maxLen 3 → 1 - 3/3 = 0
            assert.strictEqual(similarityRatio('abc', 'xyz'), 0);
        });

        it('returns 1.0 for two empty strings', () => {
            assert.strictEqual(similarityRatio('', ''), 1.0);
        });

        it('returns a value between 0 and 1', () => {
            const r = similarityRatio('add_gold', 'add_glod');
            assert.ok(r > 0 && r < 1, `Expected ratio between 0 and 1, got ${r}`);
        });
    });

    describe('findSimilar()', () => {
        const haystack = ['add_gold', 'add_prestige', 'add_piety', 'add_trait', 'remove_trait'];

        it('finds close matches for a typo', () => {
            const results = findSimilar('add_glod', haystack);
            assert.ok(results.includes('add_gold'), 'Should suggest add_gold');
        });

        it('returns empty array for no matches', () => {
            const results = findSimilar('zzzzzzzzz', haystack);
            assert.strictEqual(results.length, 0);
        });

        it('respects max option', () => {
            const results = findSimilar('add', haystack, { max: 2, threshold: 0.3 });
            assert.ok(results.length <= 2);
        });

        it('respects threshold option', () => {
            const results = findSimilar('add_gold', haystack, { threshold: 0.99 });
            // Only exact match would pass 0.99
            assert.ok(results.length <= 1);
        });
    });
});
