/**
 * The inventory rows the core exposes (inventory.ts): one per code it emits, each with the
 * severity and evidence of its finding, the game's message from the committed catalogue, and
 * the code patterns the command line's `--code` and `explain` take.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    FINDING_KINDS,
    catalogueFromSpec,
    severityOf,
    type FindingId,
} from '../syntax/findings.js';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS, type CheckCode } from './finding.js';
import {
    codeMatches,
    codesMatching,
    familyOf,
    inventoryRows,
    type InventoryRow,
} from './inventory.js';

const catalogue = catalogueFromSpec(committedSpec().data);

test('every code the core emits has one row, sorted, with its severity', () => {
    const rows = inventoryRows(catalogue);
    const codes = rows.map((r) => r.code);
    const emitted = [...Object.keys(FINDING_KINDS), ...Object.keys(CHECK_KINDS)].sort();
    assert.deepEqual(codes, emitted);
    for (const row of rows) {
        const severity =
            row.code in CHECK_KINDS
                ? CHECK_KINDS[row.code as CheckCode].severity
                : severityOf(row.code as FindingId);
        assert.equal(row.severity, severity, row.code);
        assert.equal(row.family, row.code.split('/')[0]);
        assert.ok(row.finds.length > 0, row.code);
    }
});

function rowOf(code: string, withCatalogue = true): InventoryRow {
    const row = inventoryRows(withCatalogue ? catalogue : undefined).find((r) => r.code === code);
    assert.ok(row !== undefined, code);
    return row;
}

test('a row cites its evidence: the catalogue message with its text, the game output, or advice', () => {
    const trigger = rowOf('names/unknown-trigger');
    assert.deepEqual(trigger.evidence, {
        kind: 'catalogue',
        id: 'unknown_trigger_X',
        text: "Unknown trigger '%s'",
    });
    assert.equal(trigger.message, "Unknown trigger '%s'");
    const area = rowOf('names/modifier-outside-use-area');
    assert.equal(area.evidence.kind, 'game-output');
    assert.equal(area.message, CHECK_KINDS['names/modifier-outside-use-area'].text);
    const string = rowOf('syntax/unterminated-string');
    assert.deepEqual(string.evidence, { kind: 'advice' });
    assert.equal(string.severity, 'information');
    assert.equal(string.message, "Unterminated string starting at '%s'");
    assert.equal(rowOf('syntax/missing-closing-brace').message, 'Expected } after arguments');
});

test('without the catalogue a row names its entry and has no message text', () => {
    const row = rowOf('names/unknown-effect', false);
    assert.deepEqual(row.evidence, { kind: 'catalogue', id: 'unknown_effect_X', text: null });
    assert.equal(row.message, null);
});

test('a pattern is a code, a family with /*, or *', () => {
    assert.ok(codeMatches('names/unknown-trigger', 'names/unknown-trigger'));
    assert.ok(!codeMatches('names/unknown-trigger', 'names/unknown-effect'));
    assert.ok(codeMatches('names/*', 'names/unknown-effect'));
    assert.ok(!codeMatches('names/*', 'syntax/missing-value'));
    assert.ok(!codeMatches('name/*', 'names/unknown-effect'));
    assert.ok(codeMatches('*', 'encoding/not-utf8'));
    assert.deepEqual(codesMatching('encoding/*'), ['encoding/not-utf8']);
    assert.deepEqual(codesMatching('names/no-such-check'), []);
    assert.ok(codesMatching('syntax/*').every((c) => familyOf(c) === 'syntax'));
    assert.equal(codesMatching('*').length, inventoryRows().length);
    assert.equal(familyOf('names/unknown-link'), 'names');
});
