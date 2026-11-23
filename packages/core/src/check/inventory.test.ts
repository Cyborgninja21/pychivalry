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
    placeholderCount,
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
    SLOT_NAMES,
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
        text: "Unknown trigger '<trigger>'",
    });
    assert.equal(catalogue.get('unknown_trigger_X'), "Unknown trigger '%s'");
    assert.equal(trigger.message, "Unknown trigger '<trigger>'");
    const area = rowOf('names/modifier-outside-use-area');
    assert.equal(area.evidence.kind, 'game-output');
    assert.equal(
        area.message,
        "The modifier '<modifier name>' is used in a block read as <kind of block>, but its use areas are <use areas>.",
    );
    const string = rowOf('syntax/unterminated-string');
    assert.deepEqual(string.evidence, { kind: 'advice' });
    assert.equal(string.severity, 'information');
    assert.equal(string.message, "Unterminated string starting at '<file:line>'");
    assert.equal(rowOf('syntax/missing-closing-brace').message, 'Expected } after arguments');
});

test("a row's message shows each placeholder as a readable slot, named for what fills it", () => {
    // Item 6.11: explain_code showed "The %s is missing a field the spec package marks
    // required."; every message, the game's own included, is shown with named slots.
    assert.equal(
        rowOf('fields/missing-required-field').message,
        'The <record> is missing a field the spec package marks required.',
    );
    assert.equal(
        rowOf('fields/unknown-field').message,
        'Unknown <field> in <record>',
        "the game's own {} placeholders too",
    );
    for (const row of inventoryRows(catalogue)) {
        const raw =
            row.code in CHECK_KINDS
                ? row.evidence.kind === 'catalogue'
                    ? catalogue.get(row.evidence.id)
                    : CHECK_KINDS[row.code as CheckCode].text
                : row.evidence.kind === 'catalogue'
                  ? catalogue.get(row.evidence.id)
                  : FINDING_KINDS[row.code as FindingId].description;
        const count = raw === undefined ? 0 : placeholderCount(raw);
        assert.equal((SLOT_NAMES[row.code] ?? []).length, count, `${row.code}: a name per slot`);
        assert.equal(placeholderCount(row.message ?? ''), 0, `${row.code}: ${row.message ?? ''}`);
        if (row.evidence.kind === 'catalogue') {
            assert.equal(row.evidence.text, row.message, row.code);
        }
    }
});

test('no error or warning row is advice: a check whose message depends on the place says where it comes from', () => {
    for (const row of inventoryRows(catalogue)) {
        if (row.severity === 'error' || row.severity === 'warning') {
            assert.notEqual(row.evidence.kind, 'advice', row.code);
        }
    }
    assert.deepEqual(rowOf('fields/missing-required-field').evidence, {
        kind: 'per-place',
        from: 'required-field',
    });
    assert.deepEqual(rowOf('definitions/clash').evidence, { kind: 'per-place', from: 'rules-row' });
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
