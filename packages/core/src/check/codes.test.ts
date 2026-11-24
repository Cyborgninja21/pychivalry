/**
 * docs/checks.md is the registry of codes (its "How a code stays permanent"): every code the
 * core can emit has a row there with the same severity and the same evidence, and no code it
 * emits is retired. The evidence of each catalogue message is in the committed catalogue with
 * as many placeholders as the message is given values.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT, committedSpec } from '../spec/testing.js';
import {
    catalogueFromSpec,
    FINDING_KINDS,
    placeholderCount,
    severityOf,
    type FindingId,
} from '../syntax/findings.js';
import { clashMessageOf } from './definitions.js';
import { requiredFields } from './fields-missing-required-field.js';
import { CHECK_KINDS, type CheckCode } from './finding.js';

interface Row {
    readonly severity: string;
    readonly evidence: string;
    readonly section: string;
}

/** The rows of every table in docs/checks.md whose first cell is a code. */
function registry(): Map<string, Row> {
    const text = readFileSync(path.join(REPO_ROOT, 'docs', 'checks.md'), 'utf8');
    const rows = new Map<string, Row>();
    let section = '';
    for (const line of text.split('\n')) {
        if (line.startsWith('#')) {
            section = line;
            continue;
        }
        // A cell may hold an escaped `\|`, which is no cell boundary.
        const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
        const code = /^`([a-z]+\/[a-z0-9-]+)`$/.exec(cells[1] ?? '')?.[1];
        if (code === undefined || cells.length < 6) {
            continue;
        }
        if (!rows.has(code)) {
            rows.set(code, { severity: cells[2] ?? '', evidence: cells[4] ?? '', section });
        }
    }
    return rows;
}

const rows = registry();
const emitted: [string, string, string | null][] = [
    ...(Object.keys(CHECK_KINDS) as CheckCode[]).map((code): [string, string, string | null] => [
        code,
        CHECK_KINDS[code].severity,
        CHECK_KINDS[code].catalogue,
    ]),
    ...(Object.keys(FINDING_KINDS) as FindingId[]).map((id): [string, string, string | null] => [
        id,
        severityOf(id),
        FINDING_KINDS[id].catalogue,
    ]),
];

test('every code the core emits has its row in docs/checks.md, with its severity and evidence', () => {
    for (const [code, severity, catalogue] of emitted) {
        const row = rows.get(code);
        assert.ok(row !== undefined, `${code} has no row in docs/checks.md`);
        assert.equal(row.severity, severity, code);
        if (catalogue !== null) {
            assert.ok(
                row.evidence.includes(`\`${catalogue}\``),
                `${code}: the row names ${catalogue}`,
            );
        }
        const kind = (CHECK_KINDS as Partial<Record<string, (typeof CHECK_KINDS)[CheckCode]>>)[
            code
        ];
        for (const also of kind?.alsoCatalogue ?? []) {
            const tail = also.slice((catalogue ?? '').length);
            assert.ok(
                also.startsWith(catalogue ?? '') && row.evidence.includes(`\`${tail}\``),
                `${code}: the row names ${also}`,
            );
        }
    }
});

test('no code the core emits is retired', () => {
    for (const [code] of emitted) {
        assert.ok(!/retired/i.test(rows.get(code)?.section ?? ''), `${code} is retired`);
    }
});

test("each check's catalogue message is in the committed catalogue, with a placeholder per value", () => {
    const catalogue = catalogueFromSpec(committedSpec().data);
    for (const code of Object.keys(CHECK_KINDS) as CheckCode[]) {
        const kind = CHECK_KINDS[code];
        if (kind.advice === true) {
            // Advice, with no game evidence: the row says so.
            assert.ok(rows.get(code)?.evidence.startsWith('Advice'), code);
            continue;
        }
        if (kind.bestPractice === true) {
            // One of pychivalry's own best-practice rules (the family style), with no game
            // evidence: the row says so, with the base game's rate.
            assert.ok(code.startsWith('style/'), code);
            assert.ok(rows.get(code)?.evidence.startsWith('Best practice'), code);
            continue;
        }
        if (kind.catalogue === null) {
            const evidence = rows.get(code)?.evidence ?? '';
            if (kind.formattingRules === true) {
                // pychivalry's own formatting rules, by the owner's decision: the row says so.
                assert.ok(evidence.startsWith('Formatting rules'), code);
                continue;
            }
            if (kind.gameOutput !== undefined) {
                // Evidence of the game's own output, with no message: the row says so.
                assert.ok(evidence.startsWith('Game output'), code);
            } else if (kind.evidenceFrom === 'required-field') {
                assert.ok(evidence.startsWith('Required field'), code);
            } else if (kind.evidenceFrom === 'rules-row') {
                assert.ok(evidence.startsWith('Catalogue, named by the rules row'), code);
            } else {
                // No game evidence: the row says advice, and the code is no error or warning.
                assert.ok(evidence.startsWith('Advice'), code);
                assert.ok(kind.severity === 'information' || kind.severity === 'hint', code);
            }
            continue;
        }
        for (const id of [kind.catalogue, ...(kind.alsoCatalogue ?? [])]) {
            const text = catalogue.get(id);
            assert.ok(text !== undefined, `${id} is in the catalogue`);
            assert.equal(placeholderCount(text), kind.slots.length, code);
        }
    }
});

test('a code whose message depends on the place names, in its row, every message it can cite', () => {
    const spec = committedSpec();
    const catalogue = catalogueFromSpec(spec.data);
    // A required field's message: the catalogue entry whose text is its `required_evidence`.
    const required = rows.get('fields/missing-required-field')?.evidence ?? '';
    const fields = requiredFields(spec);
    assert.ok(fields.length > 0);
    for (const field of fields) {
        const entry = spec.data.errors.find((e) => e.text === field.field.required_evidence);
        assert.ok(
            entry !== undefined,
            `${field.directory} ${field.path.join('.')} has its message`,
        );
        assert.ok(required.includes(`\`${entry.id}\``), entry.id);
        assert.equal(placeholderCount(catalogue.get(entry.id) ?? ''), 1, entry.id);
    }
    // A clash's message: the catalogue entry of the rules row's duplicate message.
    const clash = rows.get('definitions/clash')?.evidence ?? '';
    const deciding = (spec.part('override_rules')?.rules ?? []).filter(
        (r) => r['resolve'] === 'priority' && typeof r['message'] === 'string',
    );
    assert.ok(deciding.length > 0);
    for (const rule of deciding) {
        const id = clashMessageOf(spec, String(rule['id']));
        assert.ok(id !== null, String(rule['id']));
        assert.ok(clash.includes(`\`${id}\``), id);
    }
});
