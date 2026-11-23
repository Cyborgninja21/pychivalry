/**
 * The user guide's check reference, `docs/guide/checks.md`: every code this build reports, with
 * its severity, what it finds and the game's evidence for it, written from the core's own
 * inventory rows (`inventoryRows`, the data `pychivalry explain` prints), never by hand. `task
 * docs:checks` writes it; a test holds the committed page to the inventory, so a code added,
 * re-graded or re-worded in the core is a page that must be written again.
 */

import path from 'node:path';
import {
    catalogueFromSpec,
    inventoryRows,
    MAX_FINDINGS_PER_FILE,
    openSpec,
    type InventoryRow,
    type Severity,
} from '@pychivalry/core';
import { writeText } from './util.js';

/** Where the page lives, relative to the repository's root. */
export const CHECK_REFERENCE_PAGE = path.join('docs', 'guide', 'checks.md');

const SEVERITIES: readonly Severity[] = ['error', 'warning', 'information', 'hint'];

/** Text for a Markdown table cell: no line break, `|` escaped. */
function cell(text: string): string {
    return text.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|');
}

/** A row's evidence, in words. */
export function evidenceCell(row: InventoryRow): string {
    const e = row.evidence;
    switch (e.kind) {
        case 'catalogue':
            return e.text === null
                ? `The game's message \`${e.id}\``
                : `The game's message \`${e.id}\`: "${e.text}"`;
        case 'game-output':
            return `The game's own output, with no message of its own: ${e.source}`;
        case 'per-place':
            return e.from === 'required-field'
                ? "The game's own message for the field that is missing, which the spec package gives with each field it marks required"
                : "The game's own message for the duplicate: the catalogue entry the rules table's row for the clash names";
        case 'required-field':
            return `The game's message for the missing field ${e.field}`;
        case 'advice':
            return "Advice: pychivalry's own, with no game message";
    }
}

/** The page, from the rows of the inventory and the spec package's version. */
export function checkReferencePage(rows: readonly InventoryRow[], specVersion: string): string {
    const count = (s: Severity): number => rows.filter((r) => r.severity === s).length;
    const advice = rows.filter((r) => r.evidence.kind === 'advice').length;
    const lines = [
        '# Checks',
        '',
        "<!-- Written by `task docs:checks` from the core's check inventory; do not edit by hand. -->",
        '',
        'Every finding pychivalry reports has a code, a family and a name such as',
        '`names/unknown-trigger`. This page lists every code this build reports: its severity, what',
        "it finds and the game's evidence for it, with the game's own message as the spec package's",
        `catalogue for game ${specVersion} gives it. \`pychivalry explain <code>\` prints the same for one`,
        'code ([Commands](commands.md)).',
        '',
        `${String(rows.length)} codes: ${String(count('error'))} errors, ${String(count('warning'))} warnings, ${String(count('information'))} information and ${String(count('hint'))} hints. ${String(rows.length - advice)} rest on the game's own evidence; ${String(advice)} are advice.`,
        '',
        '- An **error** or a **warning** is something the game itself rejects or complains about, and',
        "  rests on the game's own evidence: a message of the game, the game's own output, or a",
        "  field the spec package marks required with the game's message for it.",
        '- **Information** and **hints** without such evidence are advice: usually right, not',
        '  something the game enforces.',
        `- A file reports at most ${MAX_FINDINGS_PER_FILE.toLocaleString('en-US')} findings, its most severe first; the command line says how`,
        '  many it left out.',
        '',
        'The full inventory, with the checks still to come and those retired, the release 2.3.0',
        'check each replaces and how each was proved on the base game, is the',
        '[check inventory](../checks.md).',
    ];
    const families = [...new Set(rows.map((r) => r.family))];
    for (const family of families) {
        lines.push('', `## ${family}`, '', '| Code | Severity | What it finds | Evidence |');
        lines.push('| --- | --- | --- | --- |');
        for (const row of rows.filter((r) => r.family === family)) {
            lines.push(
                `| \`${row.code}\` | ${row.severity} | ${cell(row.finds)} | ${cell(evidenceCell(row))} |`,
            );
        }
    }
    return `${lines.join('\n')}\n`;
}

/** The page as the committed spec package and this build's inventory give it. */
export function currentCheckReference(root: string): string {
    const spec = openSpec(path.join(root, 'spec'));
    const rows = inventoryRows(catalogueFromSpec(spec.data)).sort(
        (a, b) =>
            (a.family < b.family ? -1 : a.family > b.family ? 1 : 0) ||
            SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
            (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    );
    return checkReferencePage(rows, spec.version);
}

/** `task docs:checks`: write the page. */
export function writeCheckReference(root: string): string {
    const file = path.join(root, CHECK_REFERENCE_PAGE);
    writeText(file, currentCheckReference(root));
    return file;
}
