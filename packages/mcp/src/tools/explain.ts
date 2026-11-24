/**
 * `explain_code`: what a finding's code means, from the core's check inventory
 * (`inventoryRows`), as the command line's `explain --json` prints it: its family and
 * severity, what it finds, the game's evidence for it with the game's own message (each value
 * a readable slot, `Unknown trigger '<trigger>'`), and whether it is off by default. A code may be written as a pattern, `<family>/*` or `*`.
 */

import { catalogueFromSpec, codeMatches, inventoryRows, type InventoryRow } from '@pychivalry/core';
import { BadInput, fit } from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import type { Tool } from '../tool.js';
import { validCodesText } from './codes.js';

export interface ExplainArgs {
    readonly codes: readonly string[];
}

/** A row as `explain_code` returns it, the command line's `explain --json` object. */
export function rowOutput(row: InventoryRow): Record<string, unknown> {
    return {
        code: row.code,
        family: row.family,
        severity: row.severity,
        finds: row.finds,
        evidence: row.evidence,
        message: row.message,
        off_by_default: row.offByDefault,
        can_turn_off: row.canTurnOff,
    };
}

const ROW: Schema = {
    type: 'object',
    properties: {
        code: { type: 'string' },
        family: { type: 'string' },
        severity: { type: 'string', enum: ['error', 'warning', 'information', 'hint'] },
        finds: { type: 'string', description: 'What the finding means' },
        evidence: {
            type: 'object',
            properties: { kind: { type: 'string' } },
            required: ['kind'],
            description:
                "The game's evidence that it raises this: its catalogue message (catalogue), its own output (game-output), the message of the place (per-place); advice has none, and neither has a best-practice rule of the family style (best-practice)",
        },
        message: {
            type: ['string', 'null'],
            description:
                "The message text, each value a readable slot such as <trigger>; the game's own for a catalogue message. Where the evidence is per-place, the message of a place with none of its own",
        },
        off_by_default: {
            type: 'boolean',
            description: 'True when check reports it only when asked',
        },
        can_turn_off: {
            type: 'boolean',
            description:
                "True when check reports it by default and can be told not to (check's unused_keys: false)",
        },
    },
    required: [
        'code',
        'family',
        'severity',
        'finds',
        'evidence',
        'message',
        'off_by_default',
        'can_turn_off',
    ],
};

export const explainTool: Tool<ExplainArgs> = {
    name: 'explain_code',
    title: "Explain a finding's code",
    description:
        "What a finding's code means: its severity, what it finds, and the game's evidence for it with the game's own message. Codes may be written as a family (names/*) or * for all.",
    input: {
        type: 'object',
        properties: {
            codes: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                description: 'Codes (names/unknown-trigger), families (names/*) or *',
            },
        },
        required: ['codes'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            codes: { type: 'array', items: ROW },
            unknown: {
                type: 'array',
                items: { type: 'string' },
                description: 'What was asked that matches no code of this build',
            },
            not_shown: {
                type: 'array',
                items: { type: 'string' },
                description: 'Codes left out to keep the result small: ask for them again',
            },
        },
        required: ['codes', 'unknown', 'not_shown'],
    },
    run(args: ExplainArgs, session: Session): Record<string, unknown> {
        const rows = inventoryRows(catalogueFromSpec(session.spec.data));
        const shown: InventoryRow[] = [];
        const unknown: string[] = [];
        for (const pattern of args.codes) {
            const matched = rows.filter((r) => codeMatches(pattern, r.code));
            if (matched.length === 0) {
                unknown.push(pattern);
            }
            for (const row of matched) {
                if (!shown.includes(row)) {
                    shown.push(row);
                }
            }
        }
        if (shown.length === 0) {
            throw new BadInput(
                `codes: ${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} no code of this build; ${validCodesText()}`,
            );
        }
        return fit(shown, (taken) => ({
            codes: taken.map(rowOutput),
            unknown,
            not_shown: shown.slice(taken.length).map((r) => r.code),
        })).output;
    },
};
