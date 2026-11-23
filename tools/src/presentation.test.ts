/**
 * The presentation data (`presentation/`, docs/PLAN.md item 8.8): every file is valid against
 * its JSON Schema, `presentation/presentation.schema.json`, and a file out of the format is
 * not. What the language server makes of the data, and that every name in it is the spec's, is
 * tested in `packages/lsp` beside its loader.
 */

import { Ajv2020 } from 'ajv/dist/2020.js';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { repoRoot } from './util.js';

const DIR = path.join(repoRoot(), 'presentation');
const SCHEMA = 'presentation.schema.json';

function dataFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir).sort()) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) {
            out.push(...dataFiles(file));
        } else if (name.endsWith('.json') && name !== SCHEMA) {
            out.push(file);
        }
    }
    return out;
}

function validator(): (data: unknown) => string | null {
    // As for the spec's schema (spec.ts): Ajv's strict authoring rules relaxed, but an unknown
    // keyword is refused.
    const ajv = new Ajv2020({ allErrors: true, strict: false, strictSchema: true });
    const validate = ajv.compile(
        JSON.parse(readFileSync(path.join(DIR, SCHEMA), 'utf8')) as object,
    );
    return (data) => (validate(data) ? null : ajv.errorsText(validate.errors, { separator: '\n' }));
}

test('every presentation file is valid against the schema', () => {
    const valid = validator();
    const files = dataFiles(DIR);
    assert.ok(files.length >= 20, String(files.length));
    for (const file of files) {
        const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        assert.equal(valid(data), null, path.relative(DIR, file));
        const relative = path.relative(DIR, file).split(path.sep).join('/');
        // A folder file sits at its folder's path; `_all.json` is the one for every folder.
        assert.equal(
            data['folder'],
            relative === '_all.json' ? '*' : relative.slice(0, -'.json'.length),
            relative,
        );
        // The schema each file names is the one beside the data.
        assert.equal(
            path.resolve(path.dirname(file), String(data['$schema'])),
            path.join(DIR, SCHEMA),
            relative,
        );
    }
});

test('a presentation file out of the format is not valid', () => {
    const valid = validator();
    for (const bad of [
        { folder: 'Events' },
        { folder: 'events', outline: { symbol: 'Thing', blocks: [] } },
        {
            folder: 'events',
            snippets: [{ label: 'x', description: 'x', at: 'field', body: ['x'] }],
        },
        {
            folder: 'events',
            snippets: [{ label: 'x', description: 'x', at: 'record', field: 'x', body: ['x'] }],
        },
        { folder: 'events', fieldOrder: [{ block: '', fields: ['a', 'a'] }] },
        { folder: 'events', hints: [{ kind: 'text', what: 'x' }] },
        { folder: '*', outline: { symbol: 'Event', blocks: [] } },
        { folder: 'events', unknown: true },
    ]) {
        assert.notEqual(valid(bad), null, JSON.stringify(bad));
    }
});
