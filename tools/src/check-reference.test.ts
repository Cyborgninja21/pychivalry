/**
 * The user guide's check reference (check-reference.ts): the committed page is the one the
 * core's check inventory gives, every code on it once, with its severity and evidence.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { catalogueFromSpec, inventoryRows, openSpec } from '@pychivalry/core';
import { CHECK_REFERENCE_PAGE, currentCheckReference, evidenceCell } from './check-reference.js';
import { repoRoot } from './util.js';

const root = repoRoot();

test('the committed check reference is the one the inventory gives (task docs:checks writes it)', () => {
    const committed = readFileSync(path.join(root, CHECK_REFERENCE_PAGE), 'utf8').replace(
        /\r\n/g,
        '\n',
    );
    assert.equal(committed, currentCheckReference(root));
});

test('every code of this build is on the page once, with its severity and evidence', () => {
    const rows = inventoryRows(catalogueFromSpec(openSpec(path.join(root, 'spec')).data));
    const page = currentCheckReference(root);
    for (const row of rows) {
        const lines = page.split('\n').filter((l) => l.startsWith(`| \`${row.code}\` |`));
        assert.equal(lines.length, 1, row.code);
        assert.ok(lines[0]?.startsWith(`| \`${row.code}\` | ${row.severity} |`), row.code);
    }
    const trigger = rows.find((r) => r.code === 'names/unknown-trigger');
    assert.ok(trigger !== undefined);
    assert.equal(
        evidenceCell(trigger),
        "The game's message `unknown_trigger_X`: \"Unknown trigger '%s'\"",
    );
});
