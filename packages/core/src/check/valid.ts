/**
 * What is valid where a finding is, in words, from the data the finding carries: for the scope
 * findings, what the keyword or link takes and the links that lead there
 * (`check/scope-links.ts`); for a missing field or a value of the wrong kind, what the field
 * takes and the values the base game writes in it (`check/field-values.ts`). The command line
 * shows it after the game's message, which stays as the game writes it; the agent server
 * returns the data itself.
 */

import type { FindingData } from './finding.js';

function list(data: FindingData, key: string): readonly string[] {
    const value = data[key];
    return Array.isArray(value) ? (value as readonly string[]) : [];
}

function text(data: FindingData, key: string): string | null {
    const value = data[key];
    return typeof value === 'string' ? value : null;
}

/** A list in words, with how many more there are when it was cut (`<key>_total`). */
function listed(data: FindingData, key: string): string {
    const shown = list(data, key);
    const total = Number(text(data, `${key}_total`) ?? shown.length);
    const more = total > shown.length ? `, and ${String(total - shown.length)} more` : '';
    return `${shown.join(', ')}${more}`;
}

/** A measured value type in words: `word|block` is "word or block". */
function typeWords(type: string): string {
    return type.split('|').join(' or ');
}

function way(data: FindingData): string {
    const scope = text(data, 'scope');
    return list(data, 'links_from_scope').length === 0 || scope === null
        ? ''
        : `; from ${scope}: ${listed(data, 'links_from_scope')}`;
}

function values(data: FindingData): string {
    return list(data, 'values').length === 0
        ? ''
        : `the base game writes ${listed(data, 'values')}`;
}

/** What is valid at a finding, in words, or null when its data does not say. */
export function whatIsValid(finding: {
    readonly code: string;
    readonly data: FindingData;
}): string | null {
    const data = finding.data;
    switch (finding.code) {
        case 'scope/wrong-scope-for-trigger':
        case 'scope/wrong-scope-for-effect':
        case 'scope/link-on-wrong-scope': {
            const name = text(data, finding.code === 'scope/link-on-wrong-scope' ? 'link' : 'name');
            const expected = list(data, 'expected');
            if (name === null || expected.length === 0) {
                return null;
            }
            const verb = finding.code === 'scope/link-on-wrong-scope' ? 'starts from' : 'takes';
            return `${name} ${verb} ${expected.join(', ')}${way(data)}`;
        }
        case 'fields/missing-required-field': {
            const field = text(data, 'field');
            const type = text(data, 'value_type');
            if (field === null || type === null) {
                return null;
            }
            const seen = values(data);
            return `${field} takes ${typeWords(type)}${seen === '' ? '' : `; ${seen}`}`;
        }
        case 'fields/wrong-kind-of-value': {
            const seen = values(data);
            return seen === '' ? null : seen;
        }
        default:
            return null;
    }
}
