/**
 * What a field takes, as a finding carries it (field-values.ts): its measured value type and
 * the values the base game writes, the most written first, numbers in their order, bounded.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SchemaField } from '../spec/package.js';
import { committedSpec } from '../spec/testing.js';
import { fieldValueData, MAX_VALUES } from './field-values.js';

const BASE: SchemaField = { kind: 'value', provenance: 'vanilla', required: false };

test("an interaction category's index: an integer, and the base game's values in order", () => {
    const index =
        committedSpec().data.schema['common/character_interaction_categories']?.fields['index'];
    const data = fieldValueData(index);
    assert.equal(data['value_type'], 'integer');
    assert.deepEqual(data['values']?.slice(0, 4), ['0', '1', '2', '3']);
});

test('the most written values first, at most MAX_VALUES, with the count when cut', () => {
    const values = Array.from({ length: 25 }, (_, i) => ({ value: `v${String(i)}`, count: i }));
    const data = fieldValueData({ ...BASE, value_type: 'word', values });
    const listed = data['values'] as readonly string[];
    assert.equal(listed.length, MAX_VALUES);
    assert.equal(listed[0], 'v24');
    assert.equal(data['values_total'], '25');
    assert.deepEqual(fieldValueData({ ...BASE }), {});
    assert.deepEqual(fieldValueData(undefined), {});
    assert.deepEqual(
        fieldValueData({
            ...BASE,
            values: [
                { value: '10', count: 1 },
                { value: '2', count: 1 },
            ],
        }),
        { values: ['2', '10'] },
    );
});
