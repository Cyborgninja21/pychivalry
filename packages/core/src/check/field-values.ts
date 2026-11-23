/**
 * What a field takes, as a finding about the field carries it (docs/PLAN.md, step 6;
 * tools/scored-run/README.md, proposal 3): the field's measured value type and the values the
 * base game writes in it, from the spec package's schema (part B1: `value_type`, `values`).
 * Both are measurements of the base game, not game rules: they say what the game's own files
 * do, so that a value is chosen from the game rather than guessed.
 */

import type { SchemaField } from '../spec/package.js';
import type { FindingData } from './finding.js';

/** The most base-game values a finding lists, the most written first. */
export const MAX_VALUES = 20;

const NUMBER = /^[-+]?[0-9]+(?:\.[0-9]+)?$/;

/** Two values in reading order: numbers by their value (2 before 10), other text as written. */
function compareValues(a: string, b: string): number {
    if (NUMBER.test(a) && NUMBER.test(b)) {
        return Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0);
    }
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A field's `value_type` and its base-game values (`values`, at most `MAX_VALUES`, the most
 * written first, then in reading order, and `values_total` when the package lists more), each
 * only where the schema gives it.
 */
export function fieldValueData(field: SchemaField | undefined): FindingData {
    if (field === undefined) {
        return {};
    }
    const values = [...(field.values ?? [])]
        .sort((a, b) => b.count - a.count || compareValues(a.value, b.value))
        .map((v) => v.value);
    return {
        ...(field.value_type === undefined ? {} : { value_type: field.value_type }),
        ...(values.length === 0 ? {} : { values: values.slice(0, MAX_VALUES) }),
        ...(values.length > MAX_VALUES ? { values_total: String(values.length) } : {}),
    };
}
