/**
 * What is valid at a finding, in words (valid.ts), from its data: what the command line shows
 * after the game's message.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { whatIsValid } from './valid.js';

test('a scope finding: what the keyword or link takes, and the links from the scope', () => {
    assert.equal(
        whatIsValid({
            code: 'scope/wrong-scope-for-effect',
            data: {
                name: 'add_county_modifier',
                scope: 'character',
                expected: ['landed_title'],
                links_from_scope: ['capital_county', 'primary_title'],
            },
        }),
        'add_county_modifier takes landed_title; from character: capital_county, primary_title',
    );
    assert.equal(
        whatIsValid({
            code: 'scope/link-on-wrong-scope',
            data: {
                link: 'holder',
                scope: 'character',
                expected: ['landed_title'],
                links_from_scope: ['a', 'b'],
                links_from_scope_total: '5',
            },
        }),
        'holder starts from landed_title; from character: a, b, and 3 more',
    );
    assert.equal(
        whatIsValid({
            code: 'scope/wrong-scope-for-trigger',
            data: { name: 'tier', scope: 'culture', expected: ['landed_title'] },
        }),
        'tier takes landed_title',
    );
});

test('a field finding: what the field takes and what the base game writes', () => {
    assert.equal(
        whatIsValid({
            code: 'fields/missing-required-field',
            data: { record: 'x', field: 'index', value_type: 'integer', values: ['0', '1'] },
        }),
        'index takes integer; the base game writes 0, 1',
    );
    assert.equal(
        whatIsValid({
            code: 'fields/missing-required-field',
            data: { record: 'x', field: 'on_invalidated_desc', value_type: 'word|block' },
        }),
        'on_invalidated_desc takes word or block',
    );
    assert.equal(
        whatIsValid({ code: 'fields/wrong-kind-of-value', data: { values: ['yes'] } }),
        'the base game writes yes',
    );
    assert.equal(whatIsValid({ code: 'fields/wrong-kind-of-value', data: {} }), null);
    assert.equal(whatIsValid({ code: 'names/unknown-trigger', data: { name: 'x' } }), null);
});
