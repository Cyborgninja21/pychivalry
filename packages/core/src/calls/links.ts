/**
 * The call links of one script file (docs/PLAN.md item 10.6): where a definition names another
 * definition that the game runs, read from the spec package alone. A link goes from the
 * definition the statement is written in (the caller) to the definition it names (the callee),
 * with the place the callee's name is written, the statement that writes it and the part of the
 * package that makes it a call. The core names no keyword and no folder here.
 *
 * **What makes a statement a call**, two parts of the package:
 *
 * 1. **A key read as a definition a mod can call by name.** The table `vanilla_indexed_dirs`
 *    (part C4) lists "the base game's folders whose definitions a mod can call by name"; the
 *    context reader (`check/context.ts`) reads a key in a trigger or effect block as a definition
 *    of one of them (`defined`) when the mod or the base game defines it there, and a key in a
 *    modifier block likewise. A scripted effect run from an effect block and a scripted trigger
 *    tested in a trigger block are such links (`callable`). A definition written inline in its
 *    own file (`scripted_trigger name = { }`) is no definition of the index and makes no link.
 * 2. **A value that names a definition the game fires.** Part D6 (`field_references`) says,
 *    field by field and parameter by parameter, which database a value names; a row is a call
 *    when its database is one whose definitions the game fires: the folders of part D4's
 *    `fire_condition` row (a record that "must pass [the condition] to fire": an event), and the
 *    on-action database (the one D6's vocabulary adds the package's on-actions bucket to). A
 *    trigger or an effect naming such a definition, a field of a record naming one (an on-action's
 *    `events`, its `on_actions`), are such links (`field-reference`). A row whose status is
 *    `confirmed` or `measured-only` is read, its status carried on the link: the plain form of
 *    the effect that fires an event (`keyword = id`) is measured only, and it is most of the base
 *    game's links. An `unknown` row and a `not-a-key` row make no link; nor does a row of a kind
 *    other than a field, a `.info` path, a parameter or a value (D6's `other`: a script
 *    parameter's value, whose definition is the call's).
 *
 * A value is read as `references/unknown-key` reads one: a plain name, never a scope chain, a
 * `$PARAM$`, an `@constant`, a link or a word of the row's `sentinels`.
 *
 * **The caller** is the innermost definition of the index whose text holds the place (an event, an
 * on-action, a decision, a scripted effect; a nested definition of part D3 before its parent). A
 * place in no definition, or in a file the index does not hold, makes no link.
 */

import type { FolderTable } from '../index/folders.js';
import type { Definition } from '../index/workspace.js';
import type { FieldReferenceRow } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import type { Range } from '../syntax/position.js';
import type { LineIndex } from '../syntax/position.js';
import { blockOf, type FileNode, type Scalar } from '../syntax/tree.js';
import { readContext, type DefinedNames, type FileReading } from '../check/context.js';
import { keywordRolesOf, roleConfirmed } from '../check/keyword-roles.js';
import { onActionPlaces } from '../check/names-unknown-on-action.js';
import { recordsOf } from '../check/records.js';
import {
    indexDatabase,
    isKeyValue,
    isPlaceholder,
    pairsAt,
    sentinelsOf,
    valuesOf,
    withAddedDatabases,
} from '../check/references-unknown-key.js';

/** One end of a link: a definition's name and the database the index files it under. */
export interface CallEnd {
    readonly name: string;
    readonly database: string;
}

/** A place in a file of the index. */
export interface CallPlace {
    readonly layer: string;
    readonly file: string;
    readonly start: number;
    readonly end: number;
    readonly range: Range;
}

/** What makes a link a call (see the head of this file). */
export type CallBasis =
    | {
          /** A key read as a definition of a folder of `vanilla_indexed_dirs`. */
          readonly kind: 'callable';
      }
    | {
          /** A value of a part D6 row whose database the game fires. */
          readonly kind: 'field-reference';
          /** The row's id (`effects::trigger_event.id`). */
          readonly row: string;
          readonly status: 'confirmed' | 'measured-only';
      };

/** One call link. */
export interface CallLink {
    /** The caller: the definition the statement is written in, at its key. */
    readonly from: CallEnd & CallPlace;
    /** The callee: the definition named. */
    readonly to: CallEnd & {
        /** Whether the mod or the base game defines it there, in a file the game reads or may read. */
        readonly defined: boolean;
    };
    /** Where the callee's name is written. */
    readonly at: CallPlace;
    /**
     * The statement, as written: the key itself for a definition called by name; the keyword
     * and its parameter (`trigger_event.id`), the keyword alone for its value, or the field's
     * path below the record (`events`, `random_events.<number>`), as the D6 row names it.
     */
    readonly via: string;
    readonly basis: CallBasis;
}

/** A D6 row that makes call links, with the index's databases for what it names. */
interface CallRow {
    readonly row: FieldReferenceRow;
    readonly status: 'confirmed' | 'measured-only';
    /** Every database the row names, as the index names them, in the row's order. */
    readonly databases: readonly string[];
    /** The first of them the game fires: the callee's database when none defines the name. */
    readonly fired: string;
    readonly sentinels: ReadonlySet<string>;
    /** The path below the record, or below the keyword's block. */
    readonly path: readonly string[];
}

/** The rows that make call links, by folder (fields) and by bucket and keyword. */
export interface CallRows {
    /** The databases the game fires (see the head of this file), as the index names them. */
    readonly fired: readonly string[];
    readonly fields: ReadonlyMap<string, readonly CallRow[]>;
    readonly keywords: ReadonlyMap<string, readonly CallRow[]>;
}

/** The D4 role of a record's condition to fire. */
const FIRE_CONDITION = 'fire_condition';

const READ_STATUSES = new Set(['confirmed', 'measured-only']);

const cache = new WeakMap<Spec, WeakMap<FolderTable, CallRows>>();

/** The databases whose definitions the game fires (see the head of this file). */
export function firedDatabases(spec: Spec, folders: FolderTable): string[] {
    const out: string[] = [];
    for (const row of keywordRolesOf(spec).withRoles(FIRE_CONDITION)) {
        if (
            row.parents.length > 0 ||
            row.directories === 'anywhere' ||
            !roleConfirmed(row, FIRE_CONDITION)
        ) {
            continue;
        }
        for (const directory of row.directories) {
            const database = indexDatabase(folders, directory);
            if (database !== null && !out.includes(database)) {
                out.push(database);
            }
        }
    }
    const onActions = onActionPlaces(spec).database;
    const database = onActions === null ? null : indexDatabase(folders, onActions);
    if (database !== null && !out.includes(database)) {
        out.push(database);
    }
    return out;
}

/** The rows of part D6 that make call links (see the head of this file). */
export function callRows(spec: Spec, folders: FolderTable): CallRows {
    let byTable = cache.get(spec);
    if (byTable === undefined) {
        byTable = new WeakMap();
        cache.set(spec, byTable);
    }
    const known = byTable.get(folders);
    if (known !== undefined) {
        return known;
    }
    const fired = firedDatabases(spec, folders);
    const fields = new Map<string, CallRow[]>();
    const keywords = new Map<string, CallRow[]>();
    for (const row of spec.part('field_references')?.fields ?? []) {
        if (!READ_STATUSES.has(row.status) || row.refers_to.length === 0) {
            continue;
        }
        const databases = withAddedDatabases(spec, row.refers_to)
            .map((db) => indexDatabase(folders, db))
            .filter((db): db is string => db !== null);
        const firedOne = databases.find((db) => fired.includes(db));
        if (firedOne === undefined) {
            continue;
        }
        const base = {
            row,
            status: row.status as CallRow['status'],
            databases,
            fired: firedOne,
            sentinels: sentinelsOf(row),
        };
        if (row.kind === 'field' && row.directory !== undefined) {
            const place = { ...base, path: row.path.split('.') };
            fields.set(row.directory, [...(fields.get(row.directory) ?? []), place]);
        } else if (row.kind === 'info' && row.directory !== undefined) {
            // The example record's own key first: the fields below it are the path.
            const path = row.path.split('/').slice(1);
            const last = path[path.length - 1] ?? '';
            if (path.length > 0 && !isPlaceholder(last)) {
                const place = { ...base, path };
                fields.set(row.directory, [...(fields.get(row.directory) ?? []), place]);
            }
        } else if ((row.kind === 'parameter' || row.kind === 'value') && row.bucket !== undefined) {
            const segments = row.path.split('.');
            const key = `${row.bucket}\u0000${segments[0] ?? ''}`;
            const place = { ...base, path: segments.slice(1) };
            keywords.set(key, [...(keywords.get(key) ?? []), place]);
        }
    }
    const out = { fired, fields, keywords };
    byTable.set(folders, out);
    return out;
}

/** What the links of one file are read from. */
export interface LinksInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's layer in the index and its path inside it. */
    readonly layer: string;
    readonly file: string;
    readonly tree: FileNode;
    readonly lines: LineIndex;
    /** The definitions the context reader sees: the index's own (`definedNamesOf`). */
    readonly names: DefinedNames;
    /** The index's definitions in the file (`WorkspaceIndex.definitionsIn`): the callers. */
    readonly definitions: readonly Definition[];
    /** The file's context reading, when the caller already has it. */
    readonly reading?: FileReading | undefined;
}

/** The innermost definition whose text holds an offset. */
function callerAt(definitions: readonly Definition[], offset: number): Definition | undefined {
    let found: Definition | undefined;
    for (const d of definitions) {
        if (d.start <= offset && offset < d.extentEnd) {
            if (found === undefined || d.start >= found.start) {
                found = d;
            }
        }
    }
    return found;
}

/** Every call link of a file, in the order of where each is written. */
export function callLinksOf(input: LinksInput): CallLink[] {
    const definitions = input.definitions.filter((d) => d.layer === input.layer);
    if (definitions.length === 0) {
        return [];
    }
    const reading =
        input.reading ??
        readContext({
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.tree,
            names: input.names,
        });
    const rows = callRows(input.spec, input.folders);
    const place = (span: { readonly start: number; readonly end: number }): CallPlace => ({
        layer: input.layer,
        file: input.file,
        start: span.start,
        end: span.end,
        range: input.lines.rangeOf(span.start, span.end),
    });
    const byPlace = new Map<string, CallLink>();
    const add = (scalar: Scalar, to: CallLink['to'], via: string, basis: CallBasis): void => {
        const caller = callerAt(definitions, scalar.start);
        if (caller === undefined) {
            return;
        }
        const key = `${String(scalar.start)}\u0000${to.database}\u0000${to.name}`;
        const known = byPlace.get(key);
        // One link per place: a confirmed row before a measured one, as the package ranks them;
        // between two of one status, the first read: a keyword's own row before a field's.
        if (
            known !== undefined &&
            !(
                known.basis.kind === 'field-reference' &&
                known.basis.status === 'measured-only' &&
                basis.kind === 'field-reference' &&
                basis.status === 'confirmed'
            )
        ) {
            return;
        }
        byPlace.set(key, {
            from: {
                name: caller.name,
                database: caller.database,
                layer: caller.layer,
                file: caller.file,
                start: caller.start,
                end: caller.end,
                range: caller.range,
            },
            to,
            at: place(scalar),
            via,
            basis,
        });
    };
    const judge = (scalar: Scalar, row: CallRow, via: string): void => {
        if (!isKeyValue(input.spec, scalar) || row.sentinels.has(scalar.text)) {
            return;
        }
        const name = scalar.text;
        const defined = row.databases.find((db) => input.names.isDefined(name, db));
        add(scalar, { name, database: defined ?? row.fired, defined: defined !== undefined }, via, {
            kind: 'field-reference',
            row: row.row.id,
            status: row.status,
        });
    };
    // Keys read as definitions a mod can call by name.
    for (const judged of reading.keys) {
        if (
            judged.reading.kind === 'defined' &&
            input.folders.get(judged.reading.database) !== undefined
        ) {
            const key = judged.pair.key;
            add(
                key,
                { name: key.text, database: judged.reading.database, defined: true },
                key.text,
                {
                    kind: 'callable',
                },
            );
        }
    }
    for (const judged of reading.modifiers) {
        if (
            judged.reading.kind === 'defined' &&
            input.folders.get(judged.reading.database) !== undefined
        ) {
            const key = judged.pair.key;
            add(
                key,
                { name: key.text, database: judged.reading.database, defined: true },
                key.text,
                {
                    kind: 'callable',
                },
            );
        }
    }
    // Parameters and values of the triggers and effects the context reader judged.
    for (const judged of reading.keys) {
        if (judged.reading.kind !== 'keyword') {
            continue;
        }
        const keyword = judged.folded ?? judged.pair.key.text;
        for (const row of rows.keywords.get(`${judged.reading.bucket}\u0000${keyword}`) ?? []) {
            if (row.row.kind === 'value') {
                for (const scalar of valuesOf(judged.pair, row.row.value_form)) {
                    judge(scalar, row, keyword);
                }
                continue;
            }
            const body = blockOf(judged.pair.value);
            if (body === undefined) {
                continue;
            }
            for (const pair of pairsAt(body, row.path)) {
                for (const scalar of valuesOf(pair, row.row.value_form)) {
                    judge(scalar, row, [keyword, ...row.path].join('.'));
                }
            }
        }
    }
    // Fields of the file's records.
    const fieldRows = reading.directory === null ? [] : (rows.fields.get(reading.directory) ?? []);
    if (fieldRows.length > 0) {
        const records = recordsOf(input.spec, input.folders, input.file, input.tree);
        for (const record of records.records) {
            for (const row of fieldRows) {
                for (const pair of pairsAt(record.body, row.path)) {
                    for (const scalar of valuesOf(pair, row.row.value_form)) {
                        judge(scalar, row, row.path.join('.'));
                    }
                }
            }
        }
    }
    return [...byPlace.values()].sort((a, b) => a.at.start - b.at.start);
}
