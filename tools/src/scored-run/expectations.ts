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
 * block, or, with `through`, inside a definition of the mod in that database that the first
 * reaches through names used inside each, one after another (`reaches`), or, with `within`,
 * between the braces of a block of the definition written with that key, at any depth. A `kept`
 * definition is compared with the base's as text, from its name to the end of its block.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
    blockOf,
    readScript,
    significantItems,
    type Block,
    type Definition,
    type Pair,
    type ScriptFile,
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

/** A file of a mod, parsed; null when it is not there. */
function parsedFile(modDir: string, file: string): ScriptFile | null {
    const full = path.join(modDir, ...file.split('/'));
    return existsSync(full) ? readScript(readFileSync(full)) : null;
}

/** The top-level pairs of a parsed file written with `key`. */
function pairsOf(parsed: ScriptFile | null, key: string): Pair[] {
    return (parsed?.file.items ?? []).filter(
        (item): item is Pair => item.kind === 'pair' && item.key.value === key,
    );
}

/** The top-level pairs of a mod's file written with `key`. */
function topLevelPairs(modDir: string, file: string, key: string): Pair[] {
    return pairsOf(parsedFile(modDir, file), key);
}

/** The block of a definition's record, as its file holds it. */
function recordBlock(modDir: string, definition: Definition): Block | undefined {
    const records = topLevelPairs(modDir, definition.file, definition.name);
    const record = records.find((p) => p.key.start === definition.start) ?? records[0];
    return record === undefined ? undefined : blockOf(record.value);
}

/** The pairs written directly in a definition's block with the key `field`. */
function fieldsOf(modDir: string, definition: Definition, field: string): Pair[] {
    const block = recordBlock(modDir, definition);
    if (block === undefined) {
        return [];
    }
    return significantItems(block).filter(
        (item): item is Pair => item.kind === 'pair' && item.key.value === field,
    );
}

/** Every block inside `block`, at any depth, written as the value of a pair with `key`. */
function blocksKeyed(block: Block, key: string): Block[] {
    const out: Block[] = [];
    for (const item of significantItems(block)) {
        const inner =
            item.kind === 'pair' ? blockOf(item.value) : item.kind === 'block' ? item : undefined;
        if (inner === undefined) {
            continue;
        }
        if (item.kind === 'pair' && item.key.value === key) {
            out.push(inner);
        }
        out.push(...blocksKeyed(inner, key));
    }
    return out;
}

/** True when `name` is used between the braces of a block of `definition` keyed `within`. */
function usedWithin(
    index: WorkspaceIndex,
    modDir: string,
    definition: Definition,
    name: string,
    within: string,
): boolean {
    const record = recordBlock(modDir, definition);
    if (record === undefined) {
        return false;
    }
    const blocks = blocksKeyed(record, within);
    return index
        .references(name)
        .some(
            (use) =>
                use.layer === MOD &&
                use.file === definition.file &&
                blocks.some((b) => use.start > b.start && use.start < b.end),
        );
}

/** The script files of a folder of a mod, by their paths inside the mod, with `/`. */
function scriptFilesOf(modDir: string, folder: string): string[] {
    const walk = (dir: string, inside: string): string[] =>
        readdirSync(dir).flatMap((name) => {
            const full = path.join(dir, name);
            const at = `${inside}/${name}`;
            if (statSync(full).isDirectory()) {
                return walk(full, at);
            }
            return name.endsWith('.txt') ? [at] : [];
        });
    const top = path.join(modDir, ...folder.split('/'));
    return existsSync(top) && statSync(top).isDirectory() ? walk(top, folder).sort() : [];
}

/** The text of a definition's record, from its name to the end of its block. */
function recordText(parsed: ScriptFile, pair: Pair): string {
    return parsed.text.slice(pair.start, pair.end);
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

/** A definition's identity, for the walk of `reaches`. */
function keyOf(d: Definition): string {
    return `${d.file}\u0000${String(d.start)}`;
}

/**
 * True when `name` is used inside one of `from`, or, with `through` a database, inside a
 * definition of the mod in that database reached from them: each step a name used inside the
 * definition before it, defined by the mod in `through`.
 */
function reaches(
    index: WorkspaceIndex,
    from: readonly Definition[],
    name: string,
    through: string | undefined,
): boolean {
    const steps =
        through === undefined ? [] : index.definitionsOf(through).filter((d) => d.layer === MOD);
    const seen = new Set(from.map(keyOf));
    const queue = [...from];
    for (let d = queue.shift(); d !== undefined; d = queue.shift()) {
        if (usedInside(index, d, name)) {
            return true;
        }
        for (const next of steps) {
            if (!seen.has(keyOf(next)) && usedInside(index, d, next.name)) {
                seen.add(keyOf(next));
                queue.push(next);
            }
        }
    }
    return false;
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
        case 'defines': {
            const found = modDefinitions(index, e.database, e.name).length;
            if (found === 0) {
                return `the mod does not define ${e.name} in ${e.database}`;
            }
            return e.count === undefined || found === e.count
                ? null
                : `the mod defines ${e.name} in ${e.database} ${String(found)} time${found === 1 ? '' : 's'}, not ${String(e.count)}`;
        }
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
            if (e.within !== undefined) {
                const within = e.within;
                if (!definitions.some((d) => usedWithin(index, modDir, d, e.uses, within))) {
                    return `${e.name} does not use ${e.uses} inside ${within}`;
                }
            } else if (!reaches(index, definitions, e.uses, e.through)) {
                return e.through === undefined
                    ? `${e.name} does not use ${e.uses}`
                    : `${e.name} does not use ${e.uses}, directly or through the mod's ${e.through}`;
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
        case 'kept': {
            // Where the base has it: the first file of its folder that defines it.
            for (const file of scriptFilesOf(givenDir, e.database)) {
                const base = parsedFile(givenDir, file);
                const [was] = pairsOf(base, e.name);
                if (base === null || was === undefined) {
                    continue;
                }
                const result = parsedFile(modDir, file);
                if (result === null) {
                    return `${file}, which held ${e.name}, was removed`;
                }
                const now = pairsOf(result, e.name);
                if (now.length === 0) {
                    return `${e.name} is no longer in ${file}`;
                }
                return now.some((p) => recordText(result, p) === recordText(base, was))
                    ? null
                    : `${e.name} was changed in ${file}`;
            }
            return `the base does not define ${e.name} in ${e.database}`;
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
