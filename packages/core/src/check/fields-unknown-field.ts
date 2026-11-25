/**
 * `fields/unknown-field` (docs/checks.md, item 4.5): a field in a record that its folder's
 * field list does not have. A warning on the catalogue's `unknown_X_in_X` ("Unknown {} in {}"),
 * as release 2.3.0 gave it (the owner kept it a warning: docs/decisions.md, row 50; where the
 * executable keeps the message is docs/checks.md's question 6).
 *
 * The records and their fields are `check/records.ts`'s; only a key in a block the context
 * reader reads as record fields (`none`) is judged, so a trigger or an effect in a trigger or
 * effect block, a modifier in a modifier block and an operation in a script value are never
 * fields here. A folder with no schema, and a folder whose records are trigger or effect
 * blocks (`record_body`), is not judged. A key is a field of its block when:
 *
 * - the schema lists it there (by name, or by the placeholder of its kind: `<date>`,
 *   `<number>`), or, in a record's body, among the fields the wiki-era seeds named that the
 *   base game does not set (`unconfirmed`);
 * - Paradox's own `.info` files of the folder document a field of that name (companion C1,
 *   `info_docs`: the names in each field fact's path), opened only when a key is not in the
 *   schema;
 * - it is not a field at all, and so not judged: a key that is not a plain name (an
 *   `@constant`, a `$PARAM$` of a macro, a number, a date, quoted text), a scope chain or a link
 *   written as a key, an iterator over a list, a keyword part D4 gives a role in the folder
 *   (`keyword_roles`), a top-level form part D2 names (`declarations`), or a definition of its
 *   own that part D3 finds by its place (`definitions`);
 * - a name of another database, where the directory's schema says its records' own keys are such
 *   names (format 9, `open_keys`: an ethnicity's keys are genes), at any status, the row's
 *   `except` keys and value forms read: whether the name is a key of that database is a
 *   reference, not a field, and a mod's own gene is as valid as the base game's.
 *
 * - a key that differs from a field the list has only in letter case (read as that field,
 *   as the context reader reads keywords: nothing says the game's readers tell the cases
 *   apart, and a warning needs that evidence);
 * - in a block part D7 has a row for, at any status (`modifier_block_areas`: the block holds
 *   modifiers), a modifier: a name of the modifiers bucket or one that fills a modifier
 *   template. The context reader reads only a confirmed row's block as a modifier block, for
 *   the checks of names; a block whose row rests on the measurement alone stays record fields
 *   here, and its modifiers are not fields to be reported.
 *
 * Only the keys of a record's own body are judged, never a field's sub-fields: the base game
 * shows that the schema's field kinds do not say every block that holds triggers or effects
 * (`can_construct` of `common/domiciles/buildings` is measured a plain block, and holds
 * scripted triggers), so a sub-field list is only the keys the base game writes there. A
 * field whose kind the spec work marks `kind suspect:` is a field all the same.
 */

import type { Spec } from '../spec/reader.js';
import { vocabularyOf } from '../spec/vocabulary.js';
import type { FileNode } from '../syntax/tree.js';
import type { FolderTable } from '../index/folders.js';
import type { DirectorySchema, ModifierBlockAreaRow } from '../spec/package.js';
import { modifierAreaRow, type FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import {
    isDeclaration,
    isNestedDefinition,
    recordsOf,
    walkFields,
    type FieldSite,
    type FileRecords,
} from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'fields/unknown-field';

/** What the check reads beside the file's reading. */
export interface UnknownFieldInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
}

const infoNames = new WeakMap<Spec, Map<string, ReadonlySet<string>>>();

/**
 * The field names Paradox's `.info` files document for a folder: every name of every field
 * fact's path (an example record's own key among them: a `.info` file writes fields inside an
 * example record or on their own). Read from the `.info` companion, once per package and
 * folder.
 */
export function infoFieldNames(spec: Spec, folder: string): ReadonlySet<string> {
    let byFolder = infoNames.get(spec);
    if (byFolder === undefined) {
        byFolder = new Map();
        infoNames.set(spec, byFolder);
    }
    const known = byFolder.get(folder);
    if (known !== undefined) {
        return known;
    }
    const names = new Set<string>();
    const directories = spec.companion('info_docs').data['directories'];
    const entry =
        typeof directories === 'object' && directories !== null
            ? (directories as Record<string, unknown>)[folder]
            : undefined;
    const files =
        typeof entry === 'object' && entry !== null
            ? (entry as Record<string, unknown>)['files']
            : undefined;
    for (const info of typeof files === 'object' && files !== null ? Object.values(files) : []) {
        const facts = (info as { facts?: { fields?: unknown } }).facts?.fields;
        for (const fact of Array.isArray(facts) ? (facts as unknown[]) : []) {
            const path = (fact as { path?: unknown }).path;
            if (Array.isArray(path)) {
                for (const name of path as unknown[]) {
                    if (typeof name === 'string') {
                        names.add(name);
                    }
                }
            }
        }
    }
    byFolder.set(folder, names);
    return names;
}

/** True when part D4 gives the keyword a role in the folder, or anywhere. */
export function hasKeywordRole(spec: Spec, folder: string, key: string): boolean {
    return (spec.part('keyword_roles')?.keywords ?? []).some(
        (row) =>
            row.keyword === key &&
            (row.where.directories === 'anywhere' || row.where.directories.includes(folder)),
    );
}

const folded = new WeakMap<Readonly<Record<string, unknown>>, ReadonlySet<string>>();

/** The names of a field list in lower case, built once per list. */
function foldedNames(fields: Readonly<Record<string, unknown>>): ReadonlySet<string> {
    let names = folded.get(fields);
    if (names === undefined) {
        names = new Set(Object.keys(fields).map((name) => name.toLowerCase()));
        folded.set(fields, names);
    }
    return names;
}

const areaRows = new WeakMap<Spec, ReadonlyMap<string, readonly ModifierBlockAreaRow[]>>();

/** Part D7's rows by folder, at every status. */
function areaRowsOf(spec: Spec, folder: string): readonly ModifierBlockAreaRow[] {
    let rows = areaRows.get(spec);
    if (rows === undefined) {
        const byFolder = new Map<string, ModifierBlockAreaRow[]>();
        for (const row of spec.part('modifier_block_areas')?.fields ?? []) {
            byFolder.set(row.directory, [...(byFolder.get(row.directory) ?? []), row]);
        }
        rows = byFolder;
        areaRows.set(spec, rows);
    }
    return rows.get(folder) ?? [];
}

/**
 * True when the directory's schema says the record's own keys at a site are names of another
 * database (format 9, `open_keys` whose `recognised_by.path` is `*`, the record's direct
 * children), the key not among the row's `except`, written in one of the row's `forms`.
 */
export function isOpenKey(schema: DirectorySchema | undefined, site: FieldSite): boolean {
    if (schema?.open_keys === undefined || site.path.length !== 1) {
        return false;
    }
    const key = site.pair.key.text;
    const form = site.pair.value?.kind === 'block' ? 'block' : 'value';
    return schema.open_keys.some((row) => {
        const by = row.recognised_by;
        return (
            by !== undefined &&
            by.path === '*' &&
            !(by.except ?? []).includes(key) &&
            by.forms.includes(form)
        );
    });
}

/** True when the key at a site is a field of its block, or no field at all (see above). */
function isAccepted(spec: Spec, records: FileRecords, site: FieldSite): boolean {
    const folder = records.folder;
    if (folder === null) {
        return true;
    }
    const key = site.pair.key.text;
    const vocabulary = vocabularyOf(spec);
    if (foldedNames(site.fields).has(key.toLowerCase())) {
        return true;
    }
    if (
        modifierAreaRow(areaRowsOf(spec, folder.path), site.path.slice(0, -1)) !== null &&
        (vocabulary.has('modifiers', key) || vocabulary.modifierTemplateMatch(key).kind !== 'none')
    ) {
        return true;
    }
    if (
        site.path.length === 1 &&
        records.schema?.unconfirmed !== undefined &&
        Object.prototype.hasOwnProperty.call(records.schema.unconfirmed, key)
    ) {
        return true;
    }
    if (vocabulary.has('links', key) || vocabulary.has('links', key.toLowerCase())) {
        return true;
    }
    if (isOpenKey(records.schema, site)) {
        return true;
    }
    const iterator = vocabulary.iteratorOf(key);
    if (iterator !== undefined && vocabulary.has('lists', iterator.base)) {
        return true;
    }
    if (
        hasKeywordRole(spec, folder.path, key) ||
        isDeclaration(spec, folder.path, key) ||
        isNestedDefinition(folder, [site.record.pair.key.text, ...site.path])
    ) {
        return true;
    }
    return infoFieldNames(spec, folder.path).has(key);
}

export function unknownFields(
    reading: FileReading,
    context: CheckContext,
    input: UnknownFieldInput,
): CheckFinding[] {
    const out: CheckFinding[] = [];
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    const schema = records.schema;
    if (schema === undefined || schema.record_body !== undefined) {
        return out;
    }
    for (const record of records.records) {
        if (reading.blocks.get(record.body) !== 'none') {
            continue;
        }
        walkFields(
            input.spec,
            records,
            record,
            reading,
            (site) => {
                const key = site.pair.key;
                if (
                    site.kind !== 'none' ||
                    site.field !== undefined ||
                    key.type !== 'name' ||
                    key.text.includes('$') ||
                    isAccepted(input.spec, records, site)
                ) {
                    return;
                }
                const where = `${schema.content_type} '${record.pair.key.text}'`;
                out.push(
                    finding(
                        CODE,
                        key,
                        [`'${key.text}'`, where],
                        {
                            name: key.text,
                            record: record.pair.key.text,
                            path: site.path,
                            ...(records.folder === null ? {} : { folder: records.folder.path }),
                        },
                        context,
                    ),
                );
            },
            false,
        );
    }
    return out;
}
