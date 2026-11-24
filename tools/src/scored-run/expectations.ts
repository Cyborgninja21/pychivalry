/**
 * The part of grade two that code can check (docs/PLAN.md item 9.4): each expectation of a
 * request (`requests.ts`, `expect`) held against the result, through the workspace index the
 * checker built over it (grade one's `checkWorkspace`), the result's own files and the mod it
 * started as. Every expectation is met or not, on its own, and one that is not says why.
 *
 * Names are compared exactly, as the index holds them. A definition counts when the result's
 * own layer (`mod`) holds it; a name a `resolves` expectation follows may be defined by the mod
 * or by the base game. A `field` is a pair written directly in the definition's block; a `uses`
 * is a name the index lists as used between the start of the definition and the end of its
 * block.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
    blockOf,
    readScript,
    significantItems,
    type Definition,
    type Pair,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { describeExpectation, ENGLISH, type Expectation } from './requests.js';

/** One expectation, held against a result. */
export interface ExpectationResult {
    /** The expectation in words (`describeExpectation`). */
    readonly expectation: string;
    readonly met: boolean;
    /** Why it is not met; null when it is. */
    readonly problem: string | null;
}

/** The layer of the index that holds the result itself. */
const MOD = 'mod';

export interface ExpectationInput {
    /** The index the checker built: the result's files (layer `mod`) over the base game. */
    readonly index: WorkspaceIndex;
    /** The result: the trial's mod folder as the session left it. */
    readonly modDir: string;
    /** The mod it started as: the request's base. */
    readonly givenDir: string;
}

function modDefinitions(index: WorkspaceIndex, database: string, name: string): Definition[] {
    return index.definitions(name, { database }).filter((d) => d.layer === MOD);
}

/** The top-level pairs of a mod's file written with `key`. */
function topLevelPairs(modDir: string, file: string, key: string): Pair[] {
    const full = path.join(modDir, ...file.split('/'));
    if (!existsSync(full)) {
        return [];
    }
    const parsed = readScript(readFileSync(full));
    return parsed.file.items.filter(
        (item): item is Pair => item.kind === 'pair' && item.key.value === key,
    );
}

/** The pairs written directly in a definition's block with the key `field`. */
function fieldsOf(modDir: string, definition: Definition, field: string): Pair[] {
    const records = topLevelPairs(modDir, definition.file, definition.name);
    const record = records.find((p) => p.key.start === definition.start) ?? records[0];
    const block = record === undefined ? undefined : blockOf(record.value);
    if (block === undefined) {
        return [];
    }
    return significantItems(block).filter(
        (item): item is Pair => item.kind === 'pair' && item.key.value === field,
    );
}

/** The scalar value a pair holds, or null for a block or nothing. */
function scalarOf(pair: Pair): string | null {
    return pair.value?.kind === 'scalar' ? pair.value.value : null;
}

function usedInside(index: WorkspaceIndex, definition: Definition, name: string): boolean {
    return index
        .references(name)
        .some(
            (use) =>
                use.layer === MOD &&
                use.file === definition.file &&
                use.start >= definition.start &&
                use.start < definition.extentEnd,
        );
}

function holds(input: ExpectationInput, e: Expectation): string | null {
    const { index, modDir, givenDir } = input;
    switch (e.kind) {
        case 'file': {
            const files = index
                .allFiles()
                .filter((f) => f.layer === MOD && f.folder === e.folder)
                .filter(
                    (f) => e.new !== true || !existsSync(path.join(givenDir, ...f.path.split('/'))),
                );
            return files.length > 0
                ? null
                : `the mod has no ${e.new === true ? 'new ' : ''}file in ${e.folder}`;
        }
        case 'top-level': {
            const found = index
                .allFiles()
                .filter((f) => f.layer === MOD && f.folder === e.folder && f.kind === 'script')
                .some((f) =>
                    topLevelPairs(modDir, f.path, e.key).some((p) => scalarOf(p) === e.value),
                );
            return found ? null : `no file in ${e.folder} has ${e.key} = ${e.value} at its top`;
        }
        case 'defines':
            return modDefinitions(index, e.database, e.name).length > 0
                ? null
                : `the mod does not define ${e.name} in ${e.database}`;
        case 'field': {
            const definitions = modDefinitions(index, e.database, e.name);
            if (definitions.length === 0) {
                return `the mod does not define ${e.name} in ${e.database}`;
            }
            const counts = definitions.map((d) => {
                const pairs = fieldsOf(modDir, d, e.field);
                return e.value === undefined
                    ? pairs.length
                    : pairs.filter((p) => scalarOf(p) === e.value).length;
            });
            const ok = e.count === undefined ? counts.some((n) => n > 0) : counts.includes(e.count);
            if (ok) {
                return null;
            }
            const most = Math.max(...counts);
            if (e.count !== undefined) {
                return `${e.name} has ${e.field} ${String(most)} time${most === 1 ? '' : 's'}, not ${String(e.count)}`;
            }
            return e.value === undefined
                ? `${e.name} has no ${e.field}`
                : `${e.name} has no ${e.field} = ${e.value}`;
        }
        case 'uses':
        case 'resolves': {
            const definitions = modDefinitions(index, e.database, e.name);
            if (definitions.length === 0) {
                return `the mod does not define ${e.name} in ${e.database}`;
            }
            if (!definitions.some((d) => usedInside(index, d, e.uses))) {
                return `${e.name} does not use ${e.uses}`;
            }
            if (
                e.kind === 'resolves' &&
                index.definitions(e.uses, { database: e.to }).length === 0
            ) {
                return `${e.uses} is defined in ${e.to} by neither the mod nor the base game`;
            }
            return null;
        }
        case 'localization':
            return modDefinitions(index, ENGLISH, e.key).length > 0
                ? null
                : `the mod's English localization does not define ${e.key}`;
        case 'unchanged': {
            const given = path.join(givenDir, ...e.file.split('/'));
            const now = path.join(modDir, ...e.file.split('/'));
            if (!existsSync(now)) {
                return `${e.file} was removed`;
            }
            return Buffer.compare(readFileSync(given), readFileSync(now)) === 0
                ? null
                : `${e.file} was changed`;
        }
    }
}

/** Every expectation of a request held against a result, in the request's order. */
export function checkExpectations(
    input: ExpectationInput,
    expect: readonly Expectation[],
): ExpectationResult[] {
    return expect.map((e) => {
        const problem = holds(input, e);
        return { expectation: describeExpectation(e), met: problem === null, problem };
    });
}
