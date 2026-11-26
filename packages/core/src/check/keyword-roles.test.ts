/**
 * Part D4 as the one reader gives it (`keyword-roles.ts`), for the roles format 9 adds, which the
 * checks blocked on them read (docs/checks.md): `style/redundant-condition` and
 * `style/redundant-false-condition` (a condition that always holds or always fails, and what it
 * does to its block), and `style/option-without-ai-weight` (the AI weight of an event's option).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { keywordRolesOf, roleConfirmed } from './keyword-roles.js';

const roles = keywordRolesOf(committedSpec());

function row(keyword: string): ReturnType<typeof roles.withRoles>[number] {
    const found = roles.rows.find((r) => r.keyword === keyword);
    assert.ok(found, keyword);
    return found;
}

test('format 9, D4: 68 rows; the logical operators say how they combine their conditions', () => {
    assert.equal(roles.rows.length, 68);
    const combining = roles.withRoles('combines_conditions');
    assert.deepEqual(
        combining.map((r) => [r.keyword, r.combination, r.childAlwaysTrue, r.childAlwaysFalse]),
        [
            ['AND', 'all', 'neutral', 'makes_it_fail'],
            ['OR', 'any', 'makes_it_hold', 'neutral'],
            ['NOT', 'negation', null, null],
            ['NOR', 'none', 'makes_it_fail', 'neutral'],
            ['NAND', 'not_all', 'neutral', 'makes_it_hold'],
            ['all_false', 'none', 'makes_it_fail', 'neutral'],
            ['any_false', 'not_all', 'neutral', 'makes_it_hold'],
            ['calc_true_if', 'count', null, null],
            ['weighted_calc_true_if', 'weighted_count', null, null],
        ],
    );
    assert.ok(combining.every((r) => roleConfirmed(r, 'combines_conditions')));
});

test('format 9, D4: a condition that always holds, with the values that make it hold or fail', () => {
    const constant = roles.withRoles('constant_condition');
    assert.deepEqual(
        constant.map((r) => [r.keyword, r.holdsWith, r.failsWith]),
        [['always', 'yes', 'no']],
    );
    assert.ok(roleConfirmed(row('always'), 'constant_condition'));
});

test('format 9, D4: the keywords that weight an event option for the AI, and which one wins', () => {
    const weights = roles.withRoles('ai_weight');
    assert.deepEqual(weights.map((r) => r.keyword).sort(), ['ai_chance', 'ai_will_select']);
    assert.ok(weights.every((r) => roleConfirmed(r, 'ai_weight')));
    assert.ok(weights.every((r) => r.roles.has('mutually_exclusive')));
    assert.deepEqual(
        roles.withRoles('takes_precedence').map((r) => [r.keyword, r.pairsWith]),
        [['ai_will_select', ['ai_chance']]],
    );
});
