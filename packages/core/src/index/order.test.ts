/**
 * `sortByOrder`: a pool of definitions sorted as a `file-order` row reads their files, or
 * undefined when the row leaves two of them unordered. It finds that in n log n comparisons; a
 * test holds it to the plain reading, that some pair of the pool `compareFiles` does not order,
 * on pools of every kind of row.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareFiles, sortByOrder } from './order.js';
import type { FileOrderRule, LayerName } from './rules.js';

interface Def {
    readonly layer: string;
    readonly file: string;
    readonly start: number;
}

function rule(
    compare: FileOrderRule['compare'],
    subfolders: FileOrderRule['subfolders'],
    layers: FileOrderRule['layers'],
    layerOrder: readonly LayerName[],
): FileOrderRule {
    return {
        kind: 'file-order',
        id: 'test-order',
        overrides_rule: 4,
        title: 'test',
        platforms: ['linux', 'windows'],
        evidence: [],
        status: 'settled',
        platform_basis: {},
        compare,
        subfolders,
        layers,
        layer_order: layerOrder,
    };
}

/** A small generator of numbers, so every run sees the same pools. */
function numbers(seed: number): () => number {
    let x = seed;
    return () => {
        x = (x * 1103515245 + 12345) % 2147483648;
        return x / 2147483648;
    };
}

const LAYERS = ['game', 'mod', 'jomini', 'dlc:a', 'dlc:b', 'elsewhere'];
const PATHS = [
    'common/x/a.txt',
    'common/x/A.txt',
    'common/x/b.txt',
    'common/x/sub/a.txt',
    'common/x/sub/c.txt',
    'common/x//a.txt',
    'common/x/z.txt',
];

/** The plain reading: some pair of the pool that the row does not order. */
function somePairUnordered(pool: readonly Def[], order: FileOrderRule): boolean {
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const a = pool[i] as Def;
            const b = pool[j] as Def;
            if (
                compareFiles(
                    { layer: a.layer, path: a.file },
                    { layer: b.layer, path: b.file },
                    order,
                ) === undefined
            ) {
                return true;
            }
        }
    }
    return false;
}

const RULES: readonly FileOrderRule[] = (['bytes', 'case-insensitive'] as const).flatMap(
    (compare) =>
        (['by-path', 'files-first', 'folders-first'] as const).flatMap((subfolders) =>
            (['together', 'in-order'] as const).flatMap((layers) => [
                rule(compare, subfolders, layers, ['jomini', 'game', 'dlc', 'mod']),
                rule(compare, subfolders, layers, ['game', 'mod']),
            ]),
        ),
);

test('a pool is unordered exactly when some pair of it is, for every kind of row', () => {
    const next = numbers(7);
    let unordered = 0;
    let ordered = 0;
    for (const order of RULES) {
        for (let round = 0; round < 300; round++) {
            const size = 1 + Math.floor(next() * 7);
            const pool: Def[] = [];
            for (let i = 0; i < size; i++) {
                pool.push({
                    layer: LAYERS[Math.floor(next() * LAYERS.length)] ?? 'game',
                    file: PATHS[Math.floor(next() * PATHS.length)] ?? 'common/x/a.txt',
                    start: Math.floor(next() * 3),
                });
            }
            const sorted = sortByOrder(pool, order);
            const expected = size > 1 && somePairUnordered(pool, order);
            assert.equal(sorted === undefined, expected, JSON.stringify({ order, pool }));
            if (sorted === undefined) {
                unordered++;
                continue;
            }
            ordered++;
            assert.equal(sorted.length, pool.length);
            for (let i = 1; i < sorted.length; i++) {
                const a = sorted[i - 1] as Def;
                const b = sorted[i] as Def;
                const c = compareFiles(
                    { layer: a.layer, path: a.file },
                    { layer: b.layer, path: b.file },
                    order,
                );
                assert.ok(c !== undefined && (c < 0 || (c === 0 && a.start <= b.start)));
            }
        }
    }
    // Both answers are exercised.
    assert.ok(unordered > 100 && ordered > 100, `${String(unordered)} / ${String(ordered)}`);
});

test('one definition is in order whatever its layer; none is an empty order', () => {
    const order = rule('bytes', 'by-path', 'together', ['game', 'mod']);
    assert.deepEqual(sortByOrder([{ layer: 'elsewhere', file: 'a.txt', start: 0 }], order), [
        { layer: 'elsewhere', file: 'a.txt', start: 0 },
    ]);
    assert.deepEqual(sortByOrder([], order), []);
});

test('a pool of n definitions takes about n log n comparisons, not n squared', () => {
    // A check resolves a name once per definition; comparing every pair of a name's
    // definitions each time made a name defined in 300 files take 7.5 seconds. Counted, not
    // timed: eight times the pool may take at most 16 times the comparisons (n log n is about
    // 11.6 times here, n squared 64).
    const order = rule('bytes', 'by-path', 'together', ['game', 'mod']);
    const comparisons = (size: number): number => {
        let count = 0;
        const counting: typeof compareFiles = (a, b, r) => {
            count++;
            return compareFiles(a, b, r);
        };
        const pool: Def[] = Array.from({ length: size }, (_, i) => ({
            layer: 'mod',
            file: `common/x/many_${String((i * 7919) % size).padStart(4, '0')}.txt`,
            start: 0,
        }));
        assert.equal(sortByOrder(pool, order, counting)?.length, size);
        return count;
    };
    const few = comparisons(100);
    const many = comparisons(800);
    assert.ok(many < 16 * few, `${String(many)} comparisons for 800, ${String(few)} for 100`);
});
