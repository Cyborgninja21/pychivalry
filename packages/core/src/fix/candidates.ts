/**
 * The names a "did you mean" fix chooses from (`fix/near-name.ts`): those that are valid at
 * the place a finding is, from the spec package and the workspace index, never from a list in
 * the code. Two sets for each place:
 *
 * - **valid**: names that may stand there; the only names a fix offers.
 * - **pool**: those and the other names the readers accept there in some block (an iterator's
 *   parameters, a block's parameters), which a fix never offers but which count against "only
 *   one name is near": a name near a parameter and a keyword is no safe fix.
 *
 * Names the index defines are read only with the base game in the index: without it, any name
 * may be one the game defines, nothing is complete, and no such fix is safe.
 */

import { isLocalizationDatabase, withBaseGame, type WorkspaceNames } from '../check/names.js';
import type { Context, DefinedNames } from '../check/context.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import type { BucketName } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import { tablesOf } from '../spec/tables.js';

/** The names of a place: those a fix may offer, and the wider pool that decides "only one". */
export interface Candidates {
    readonly valid: readonly string[];
    readonly pool: readonly string[];
}

/** The names of one bucket of the package, sorted. */
const bucketNames = new WeakMap<Spec, Map<BucketName, readonly string[]>>();

export function namesOfBucket(spec: Spec, bucket: BucketName): readonly string[] {
    let byBucket = bucketNames.get(spec);
    if (byBucket === undefined) {
        byBucket = new Map();
        bucketNames.set(spec, byBucket);
    }
    let names = byBucket.get(bucket);
    if (names === undefined) {
        names = Object.keys(spec.data.buckets[bucket]).sort();
        byBucket.set(bucket, names);
    }
    return names;
}

/**
 * The directories whose definitions other script calls by name in a trigger or an effect
 * block: the directories of the table `vanilla_indexed_dirs` whose records are trigger or
 * effect blocks (their schema's `record_body`), as the context reader reads them.
 */
export function callableDirectories(spec: Spec, context: Context): readonly string[] {
    const body = context === 'trigger' ? 'trigger_block' : 'effect_block';
    return [...tablesOf(spec).vanillaIndexedDirs]
        .filter((dir) => spec.data.schema[dir]?.record_body === body)
        .sort();
}

/** The iterator prefixes part D8 confirms belong in a block of the context. */
export function iteratorPrefixes(spec: Spec, context: Context): readonly string[] {
    return (spec.part('iterator_kinds')?.prefixes ?? [])
        .filter((row) => row.status === 'confirmed' && row.kind === context)
        .map((row) => row.prefix)
        .sort();
}

/** What the index defines, by database, once per state of the definitions a run sees. */
const defined = new WeakMap<object, Map<string, readonly string[]>>();

/**
 * The names the index defines in a database, in files the game reads or may read, each once,
 * sorted; null without the base game in the index (any name may be the game's) and for a
 * database of localization keys (hundreds of thousands of them: not a list to search).
 * Kept per `names` object: every surface makes a new one when the index changes.
 */
export function definedIn(
    names: DefinedNames & Partial<WorkspaceNames>,
    index: WorkspaceIndex | undefined,
    database: string,
): readonly string[] | null {
    if (index === undefined || withBaseGame(names) === undefined) {
        return null;
    }
    if (isLocalizationDatabase(database)) {
        return null;
    }
    let byDatabase = defined.get(names);
    if (byDatabase === undefined) {
        byDatabase = new Map();
        defined.set(names, byDatabase);
    }
    let found = byDatabase.get(database);
    if (found === undefined) {
        found = [
            ...new Set(
                index
                    .definitionsOf(database)
                    .filter((d) => d.read !== 'no')
                    .map((d) => d.name),
            ),
        ].sort();
        byDatabase.set(database, found);
    }
    return found;
}

/** The parameter names of every iterator and every block the tables give parameters to. */
const parameterNames = new WeakMap<Spec, readonly string[]>();

function parametersOf(spec: Spec): readonly string[] {
    let names = parameterNames.get(spec);
    if (names === undefined) {
        const tables = tablesOf(spec);
        const all = new Set<string>(tables.iteratorParams.keys());
        for (const params of tables.blockParams.values()) {
            for (const name of params.keys()) {
                all.add(name);
            }
        }
        for (const rule of tables.containers.values()) {
            for (const name of [...rule.params.keys(), ...rule.caseParams.keys()]) {
                all.add(name);
            }
        }
        names = [...all].sort();
        parameterNames.set(spec, names);
    }
    return names;
}

/**
 * The names valid as a key of a trigger or an effect block: the context's keywords, the
 * links, the structural names and scope heads, the iterators over the package's lists with the
 * prefixes part D8 gives the context, and the scripted triggers or effects the index defines.
 * Null when the index's part is not known (no base game).
 */
export function keywordCandidates(
    spec: Spec,
    names: DefinedNames & Partial<WorkspaceNames>,
    index: WorkspaceIndex | undefined,
    context: Context,
): Candidates | null {
    const scripted: string[] = [];
    for (const dir of callableDirectories(spec, context)) {
        const found = definedIn(names, index, dir);
        if (found === null) {
            return null;
        }
        scripted.push(...found);
    }
    const tables = tablesOf(spec);
    const lists = namesOfBucket(spec, 'lists');
    const iterators = iteratorPrefixes(spec, context).flatMap((prefix) =>
        lists.map((list) => `${prefix}${list}`),
    );
    const valid = [
        ...namesOfBucket(spec, context === 'trigger' ? 'triggers' : 'effects'),
        ...namesOfBucket(spec, 'links'),
        ...tables.structural.keys(),
        ...tables.scopeHeads,
        ...iterators,
        ...scripted,
    ];
    return { valid, pool: [...valid, ...parametersOf(spec)] };
}

/** The names valid in a database the index holds; null when it cannot say (no base game). */
export function databaseCandidates(
    names: DefinedNames & Partial<WorkspaceNames>,
    index: WorkspaceIndex | undefined,
    database: string,
): Candidates | null {
    const found = definedIn(names, index, database);
    return found === null ? null : { valid: found, pool: found };
}

/** Names that are valid where nothing else is: a fixed list the finding's data gives. */
export function listCandidates(values: readonly string[]): Candidates {
    return { valid: values, pool: values };
}
