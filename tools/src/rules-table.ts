/**
 * The override rules table (docs/PLAN.md item 3.1a): part D1 of the committed spec package,
 * `override_rules.data`, read out of the game's executables by the spec work. It retired the
 * stand-in table `spec/override-rules.json` (docs/decisions.md). `task spec:check` reads it
 * with the core's own reader, which refuses two rows that answer one question on one platform;
 * the package's JSON Schema, which the spec check validates the package against, covers the
 * rest of its shape.
 */

import path from 'node:path';
import {
    APPLIED_KINDS,
    decides,
    fileConditionRules,
    openSpec,
    PLATFORMS,
    rulesDigest,
    rulesFor,
    rulesFromSpec,
    RulesTableError,
    SpecError,
    type Platform,
    type RulesTable,
} from '@pychivalry/core';

/** Where the table is: the package's part D1. */
export const RULES_SOURCE = 'override_rules (part D1 of the spec package)';

export interface RulesCheck {
    /** The table, when it passes. */
    table: RulesTable | undefined;
    /** The core's digest of the table: the index cache's key and an index record's `rules.sha256`. */
    sha256: string | undefined;
    problems: string[];
}

/** Check the rules table of the spec package in the spec folder. */
export function checkRulesTable(specDir: string): RulesCheck {
    try {
        const table = rulesFromSpec(openSpec(specDir));
        return { table, sha256: rulesDigest(table), problems: [] };
    } catch (err) {
        if (err instanceof RulesTableError) {
            return {
                table: undefined,
                sha256: undefined,
                problems: err.problems.map((p) => `${RULES_SOURCE}: ${p}`),
            };
        }
        if (err instanceof SpecError) {
            return { table: undefined, sha256: undefined, problems: [err.message] };
        }
        throw err;
    }
}

/** The committed rules table, checked; throws when it fails. */
export function committedRules(root: string): { table: RulesTable; sha256: string } {
    const check = checkRulesTable(path.join(root, 'spec'));
    if (check.table === undefined || check.sha256 === undefined) {
        throw new Error(
            `the committed rules table fails its check:\n  ${check.problems.join('\n  ')}`,
        );
    }
    return { table: check.table, sha256: check.sha256 };
}

/** Per platform, how many rows the index applies, reads and skips, and leaves open. */
export interface RulesUse {
    platform: Platform;
    /** Rows of a kind the index applies, settled or derived: they decide. */
    applied: number;
    /** Rows of a kind the index applies that are partial or open: they decide nothing. */
    not_settled: number;
    /** Rows of an extension kind the index does not apply. */
    skipped: number;
    /** Rows whose `file_condition` the index applies, whatever their kind (format 8). */
    file_conditions: number;
}

/** How the index uses the table on each platform. */
export function rulesUse(table: RulesTable): RulesUse[] {
    return PLATFORMS.map((platform) => {
        const rows = rulesFor(table, platform);
        return {
            platform,
            applied: rows.filter(decides).length,
            not_settled: rows.filter((r) => APPLIED_KINDS.has(r.kind) && !decides(r)).length,
            skipped: rows.filter((r) => !APPLIED_KINDS.has(r.kind)).length,
            file_conditions: fileConditionRules(table, platform).length,
        };
    });
}
