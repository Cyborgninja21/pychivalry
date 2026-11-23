/**
 * `explain <code>...`: what a finding's code means, from the check inventory's row the core
 * exposes (`inventoryRows`): its severity, what it finds and its evidence, with the game's own
 * message text from the spec's catalogue (docs/PLAN.md item 5.5). A code may be written as a
 * pattern, `<family>/*` or `*`, as `--code` takes it.
 *
 * Exit codes: 0 when every code given is one of this build, 1 when one is not (it is listed
 * as unknown), 2 on bad usage.
 */

import { catalogueFromSpec, codeMatches, inventoryRows, type InventoryRow } from '@pychivalry/core';
import type { Parsed } from './args.js';
import { EXIT, type Command } from './command.js';
import { JSON_OPTION, readSpecOption, SPEC_OPTION } from './inputs.js';
import type { Io } from './io.js';

/** The evidence of a row, in a sentence. */
export function evidenceText(row: InventoryRow): string {
    const evidence = row.evidence;
    if (evidence.kind === 'catalogue') {
        const text = evidence.text === null ? '' : `: "${evidence.text}"`;
        return `the game's own message ${evidence.id}${text}`;
    }
    if (evidence.kind === 'game-output') {
        return `the game's own output, with no message of its own: ${evidence.source}`;
    }
    if (evidence.kind === 'per-place') {
        return evidence.from === 'required-field'
            ? "the game's own message for the field that is missing, which the spec package gives with each field it marks required"
            : "the game's own message for the duplicate, a catalogue entry the rules table's row for the clash names";
    }
    if (evidence.kind === 'required-field') {
        return `the game's own message for the missing field ${evidence.field}: "${evidence.text}"`;
    }
    return "none: this is pychivalry's own advice, never an error or a warning";
}

/** A row as text: the code and its severity, what it finds, its evidence, whether it is off. */
export function rowText(row: InventoryRow): string {
    return [
        `${row.code}  ${row.severity}`,
        `  Finds: ${row.finds}`,
        `  Evidence: ${evidenceText(row)}`,
        ...(row.offByDefault ? ['  Off by default: check --unused-keys turns it on'] : []),
    ].join('\n');
}

/** A row as one JSON object. */
export function rowJson(row: InventoryRow): Record<string, unknown> {
    return {
        code: row.code,
        known: true,
        family: row.family,
        severity: row.severity,
        finds: row.finds,
        evidence: row.evidence,
        message: row.message,
        off_by_default: row.offByDefault,
    };
}

export const explainCommand: Command = {
    name: 'explain',
    args: '<code>...',
    summary: "What a finding's code means: its severity, what it finds and its evidence",
    options: [SPEC_OPTION, JSON_OPTION],
    positionals: { min: 1, max: null },
    run(parsed: Parsed, io: Io): number {
        const spec = readSpecOption(parsed, io);
        const rows = inventoryRows(catalogueFromSpec(spec.data));
        const shown = new Set<string>();
        const json = parsed.flags.has('--json');
        const out: string[] = [];
        let unknown = 0;
        for (const pattern of parsed.positionals) {
            const matched = rows.filter((r) => codeMatches(pattern, r.code));
            if (matched.length === 0) {
                unknown++;
                if (json) {
                    out.push(JSON.stringify({ code: pattern, known: false }));
                } else {
                    io.stderr(`pychivalry: ${pattern} is no code of this build\n`);
                }
                continue;
            }
            for (const row of matched) {
                if (shown.has(row.code)) {
                    continue;
                }
                shown.add(row.code);
                out.push(json ? JSON.stringify(rowJson(row)) : rowText(row));
            }
        }
        if (out.length > 0) {
            io.stdout(`${out.join(json ? '\n' : '\n\n')}\n`);
        }
        return unknown > 0 ? EXIT.found : EXIT.ok;
    },
};
