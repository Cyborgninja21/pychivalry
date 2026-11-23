/**
 * "Did you mean" (docs/MVP.md, "Lessons from 2.3.0": bound the work behind it; one file took
 * 6.9 seconds). The distance is right within its bound, and the work never passes the budget,
 * whatever the name's length or the number of candidates.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    boundedDistance,
    DEFAULT_SUGGESTION_BUDGET,
    defaultMaxDistance,
    suggest,
    type Candidate,
} from './suggest.js';

/** The plain edit distance, every cell filled: what the bounded one must agree with. */
function fullDistance(a: string, b: string): number {
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current.push(
                Math.min(
                    (previous[j - 1] ?? 0) + cost,
                    (previous[j] ?? 0) + 1,
                    (current[j - 1] ?? 0) + 1,
                ),
            );
        }
        previous = current;
    }
    return previous[b.length] ?? 0;
}

const ignore = (): void => undefined;

test('the bounded distance equals the full one up to the bound, and says "more" beyond it', () => {
    const words = [
        'has_trait',
        'has_trai',
        'hsa_trait',
        'has_traits',
        'is_adult',
        '',
        'a',
        'trait_has',
    ];
    for (const a of words) {
        for (const b of words) {
            const full = fullDistance(a, b);
            for (const max of [0, 1, 2, 3]) {
                const bounded = boundedDistance(a, b, max, ignore);
                assert.equal(
                    bounded,
                    full <= max ? full : max + 1,
                    `${a} / ${b} within ${String(max)}`,
                );
            }
        }
    }
});

test('the largest distance grows with the name, up to 3', () => {
    assert.equal(defaultMaxDistance(4), 1);
    assert.equal(defaultMaxDistance(8), 2);
    assert.equal(defaultMaxDistance(40), 3);
});

test('nearest first, letter case ignored, the name itself never suggested', () => {
    const candidates: Candidate[] = [
        'has_trait',
        'Has_Trait',
        'has_traits',
        'has_trai',
        'is_adult',
    ].map((name) => ({ name, from: 'package' }));
    const found = suggest('has_trai', candidates);
    assert.deepEqual(
        found.suggestions.map((s) => [s.name, s.distance]),
        [
            ['Has_Trait', 1],
            ['has_trait', 1],
            ['has_traits', 2],
        ],
    );
    assert.equal(found.complete, true);
    assert.equal(suggest('HAS_TRAIT', candidates).suggestions[0]?.distance, 0);
});

test('the work never passes the budget: many candidates', () => {
    function* many(): Generator<Candidate> {
        for (let i = 0; i < 2_000_000; i++) {
            yield { name: `fixture_name_${String(i)}`, from: 'workspace' };
        }
    }
    const budget = 100_000;
    const started = performance.now();
    const found = suggest('fixture_name_x', many(), { budget });
    const ms = performance.now() - started;
    assert.equal(found.complete, false);
    assert.ok(found.work <= budget, `${String(found.work)} <= ${String(budget)}`);
    assert.equal(found.budget, budget);
    assert.ok(found.suggestions.length > 0);
    // The default bound keeps one lookup's search well under a second on any machine CI runs.
    assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
});

test('the work never passes the budget: a very long name', () => {
    const name = 'x'.repeat(50_000);
    // Each as long as the name and the same but for its last ten characters: every comparison
    // fills its whole band before it can tell the distance is too large.
    const candidates: Candidate[] = Array.from({ length: 1000 }, (_, i) => ({
        name: `${'x'.repeat(49_990)}${String(i).padStart(10, '0')}`,
        from: 'package',
    }));
    const found = suggest(name, candidates);
    assert.ok(found.work <= DEFAULT_SUGGESTION_BUDGET);
    assert.equal(found.complete, false);
    // A name too long for even one comparison does no work at all.
    const none = suggest(name, candidates, { budget: 1000 });
    assert.deepEqual([none.work, none.complete, none.suggestions], [0, false, []]);
});

test('a candidate seen twice is suggested once', () => {
    const found = suggest('has_trai', [
        { name: 'has_trait', from: 'package' },
        { name: 'has_trait', from: 'workspace' },
    ]);
    assert.deepEqual(found.suggestions, [{ name: 'has_trait', distance: 1, from: 'package' }]);
});
