/**
 * The override rules table (docs/PLAN.md item 3.1a): `spec/override-rules.json`, the stand-in
 * that carries the rules docs/overrides.md marks settled until the spec package carries the
 * table, and its schema `spec/override-rules.schema.json`. `task spec:check` validates the
 * table against the schema and with the core's own reader, which also refuses two rows that
 * answer one question.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import { readRulesTable, rulesDigest, RulesTableError, type RulesTable } from '@pychivalry/core';

export const RULES_FILE = 'override-rules.json';
export const RULES_SCHEMA_FILE = 'override-rules.schema.json';

export interface RulesCheck {
    /** The table, when it passes. */
    table: RulesTable | undefined;
    /** The core's digest of the table: the index cache's key and an index record's `rules.sha256`. */
    sha256: string | undefined;
    problems: string[];
}

function describe(error: ErrorObject): string {
    const where = error.instancePath === '' ? '(root)' : error.instancePath;
    return `${where}: ${error.message ?? 'is invalid'}`;
}

/** Check the rules table in the spec folder. */
export function checkRulesTable(specDir: string): RulesCheck {
    const file = path.join(specDir, RULES_FILE);
    const schemaFile = path.join(specDir, RULES_SCHEMA_FILE);
    const problems: string[] = [];
    if (!existsSync(file)) {
        return { table: undefined, sha256: undefined, problems: [`${RULES_FILE} is missing`] };
    }
    if (!existsSync(schemaFile)) {
        return {
            table: undefined,
            sha256: undefined,
            problems: [`${RULES_SCHEMA_FILE} is missing`],
        };
    }
    let data: unknown;
    try {
        data = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    } catch (err) {
        return {
            table: undefined,
            sha256: undefined,
            problems: [`${RULES_FILE} is not valid JSON: ${(err as Error).message}`],
        };
    }
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(JSON.parse(readFileSync(schemaFile, 'utf8')) as object);
    if (!validate(data)) {
        problems.push(...(validate.errors ?? []).map((e) => `${RULES_FILE} ${describe(e)}`));
    }
    let table: RulesTable | undefined;
    try {
        table = readRulesTable(data);
    } catch (err) {
        if (err instanceof RulesTableError) {
            problems.push(...err.problems.map((p) => `${RULES_FILE}: ${p}`));
        } else {
            throw err;
        }
    }
    if (problems.length > 0 || table === undefined) {
        return { table: undefined, sha256: undefined, problems };
    }
    return { table, sha256: rulesDigest(table), problems };
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
