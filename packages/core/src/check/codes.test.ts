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
        if (kind.catalogue === null) {
            // Evidence of the game's own output, with no message: the row says so.
            assert.ok(rows.get(code)?.evidence.startsWith('Game output'), code);
            continue;
        }
        const text = catalogue.get(kind.catalogue);
        assert.ok(text !== undefined, `${kind.catalogue} is in the catalogue`);
        assert.equal(placeholderCount(text), kind.slots.length, code);
    }
});
