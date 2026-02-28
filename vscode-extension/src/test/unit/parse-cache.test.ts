/**
 * Unit Tests for Parse Cache pattern
 *
 * Tests the LRU parse cache implementation used by the server.
 * Since the cache is private to CK3LanguageServer, we test the pattern independently.
 */

import * as assert from 'assert';
import { CK3Parser } from '../../server/core/parser';

/**
 * Standalone ParseCache that mirrors server.ts implementation
 */
class ParseCache {
    private cache: Map<string, { version: number; ast: any; errors: any[]; timestamp: number }> = new Map();
    private readonly maxSize: number;

    constructor(maxSize: number = 200) {
        this.maxSize = maxSize;
    }

    get(uri: string, version: number): { ast: any; errors: any[] } | null {
        const cached = this.cache.get(uri);
        if (cached && cached.version === version) {
            cached.timestamp = Date.now();
            return { ast: cached.ast, errors: cached.errors };
        }
        return null;
    }

    set(uri: string, version: number, ast: any, errors: any[]): void {
        if (this.cache.size >= this.maxSize) {
            // Evict oldest entry
            let oldestKey: string | null = null;
            let oldestTime = Infinity;
            for (const [key, entry] of this.cache) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(uri, { version, ast, errors, timestamp: Date.now() });
    }

    delete(uri: string): void {
        this.cache.delete(uri);
    }

    get size(): number {
        return this.cache.size;
    }

    clear(): void {
        this.cache.clear();
    }
}

describe('ParseCache', () => {
    let cache: ParseCache;
    let parser: CK3Parser;

    beforeEach(() => {
        cache = new ParseCache(5); // Small size for testing eviction
        parser = new CK3Parser();
    });

    describe('cache hit/miss', () => {
        it('should return null for cache miss', () => {
            const result = cache.get('file:///test.txt', 1);
            assert.strictEqual(result, null, 'Should return null for unknown URI');
        });

        it('should return cached result for matching version', () => {
            const parsed = parser.parse('test = yes');
            cache.set('file:///test.txt', 1, parsed.ast, parsed.errors);

            const result = cache.get('file:///test.txt', 1);
            assert.ok(result, 'Should return cached result');
            assert.strictEqual(result!.ast, parsed.ast, 'Should return same AST');
            assert.strictEqual(result!.errors, parsed.errors, 'Should return same errors');
        });

        it('should return null for version mismatch', () => {
            const parsed = parser.parse('test = yes');
            cache.set('file:///test.txt', 1, parsed.ast, parsed.errors);

            const result = cache.get('file:///test.txt', 2);
            assert.strictEqual(result, null, 'Should return null for different version');
        });

        it('should update cache on re-set with new version', () => {
            const parsed1 = parser.parse('test = yes');
            cache.set('file:///test.txt', 1, parsed1.ast, parsed1.errors);

            const parsed2 = parser.parse('test = no');
            cache.set('file:///test.txt', 2, parsed2.ast, parsed2.errors);

            const result1 = cache.get('file:///test.txt', 1);
            assert.strictEqual(result1, null, 'Old version should be gone');

            const result2 = cache.get('file:///test.txt', 2);
            assert.ok(result2, 'New version should be cached');
            assert.strictEqual(result2!.ast, parsed2.ast, 'Should return new AST');
        });
    });

    describe('LRU eviction', () => {
        it('should evict oldest entry when cache is full', () => {
            // Fill cache to max (5 entries)
            for (let i = 0; i < 5; i++) {
                const parsed = parser.parse(`val${i} = ${i}`);
                cache.set(`file:///test${i}.txt`, 1, parsed.ast, parsed.errors);
            }
            assert.strictEqual(cache.size, 5, 'Cache should be full');

            // Add one more — should evict the oldest
            const parsed = parser.parse('extra = yes');
            cache.set('file:///extra.txt', 1, parsed.ast, parsed.errors);

            assert.strictEqual(cache.size, 5, 'Cache should still be max size');

            // The first entry (test0) should have been evicted
            const evicted = cache.get('file:///test0.txt', 1);
            assert.strictEqual(evicted, null, 'Oldest entry should be evicted');

            // The extra entry should be present
            const extra = cache.get('file:///extra.txt', 1);
            assert.ok(extra, 'New entry should be present');
        });

        it('should update timestamp on access (LRU behavior)', async () => {
            // Fill cache
            for (let i = 0; i < 5; i++) {
                const parsed = parser.parse(`val${i} = ${i}`);
                cache.set(`file:///test${i}.txt`, 1, parsed.ast, parsed.errors);
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 5));
            }

            // Access test0 to refresh its timestamp
            cache.get('file:///test0.txt', 1);
            await new Promise(resolve => setTimeout(resolve, 5));

            // Add new entry — should evict test1 (now oldest), not test0
            const parsed = parser.parse('new = yes');
            cache.set('file:///new.txt', 1, parsed.ast, parsed.errors);

            const test0 = cache.get('file:///test0.txt', 1);
            assert.ok(test0, 'Recently accessed entry should survive eviction');

            const test1 = cache.get('file:///test1.txt', 1);
            assert.strictEqual(test1, null, 'Oldest unaccessed entry should be evicted');
        });
    });

    describe('delete and clear', () => {
        it('should delete specific entry', () => {
            const parsed = parser.parse('test = yes');
            cache.set('file:///test.txt', 1, parsed.ast, parsed.errors);

            cache.delete('file:///test.txt');
            const result = cache.get('file:///test.txt', 1);
            assert.strictEqual(result, null, 'Deleted entry should not be found');
            assert.strictEqual(cache.size, 0, 'Cache should be empty after delete');
        });

        it('should clear all entries', () => {
            for (let i = 0; i < 3; i++) {
                const parsed = parser.parse(`val${i} = ${i}`);
                cache.set(`file:///test${i}.txt`, 1, parsed.ast, parsed.errors);
            }

            cache.clear();
            assert.strictEqual(cache.size, 0, 'Cache should be empty after clear');
        });

        it('should handle delete of nonexistent entry', () => {
            cache.delete('file:///nonexistent.txt');
            assert.strictEqual(cache.size, 0, 'Should not crash on deleting nonexistent');
        });
    });

    describe('edge cases', () => {
        it('should handle cache size of 1', () => {
            const smallCache = new ParseCache(1);
            const parsed1 = parser.parse('a = 1');
            const parsed2 = parser.parse('b = 2');

            smallCache.set('file:///a.txt', 1, parsed1.ast, parsed1.errors);
            assert.strictEqual(smallCache.size, 1);

            smallCache.set('file:///b.txt', 1, parsed2.ast, parsed2.errors);
            assert.strictEqual(smallCache.size, 1, 'Should remain at max size');

            const a = smallCache.get('file:///a.txt', 1);
            assert.strictEqual(a, null, 'First entry should be evicted');

            const b = smallCache.get('file:///b.txt', 1);
            assert.ok(b, 'Second entry should be present');
        });

        it('should handle version 0', () => {
            const parsed = parser.parse('test = yes');
            cache.set('file:///test.txt', 0, parsed.ast, parsed.errors);

            const result = cache.get('file:///test.txt', 0);
            assert.ok(result, 'Should handle version 0');
        });
    });
});
