/**
 * The folders the spec describes (docs/PLAN.md items 3.3 and 3.5): what a definition is comes
 * from the spec's folder list and record schemas, never from a list in the code. The spec
 * package's `directories[]` names every folder of the game that holds a database, with its
 * content type; `schema` gives a folder's record fields and how many records the base game
 * holds there. A file belongs to the deepest listed folder that holds it, matching whole
 * folder names, as the spec counts them: a folder's files are every file below it, except
 * those below a more specific listed folder.
 *
 * Every top-level key of a file in a listed folder is a definition of that folder's
 * database: the spec package's own wording for a database's keys is "a top-level key of a
 * file in the key database folder" (its `keyword_templates`). The index records how each is
 * written (`Form` in rules.ts). Parts D2 and D3 of the package draw the other lines, each
 * from a row whose status is `confirmed` (a row that rests on the measurement alone is not
 * read here):
 *
 * - D2, `declarations`: a top-level form that declares a namespace or a setting is no
 *   definition (`namespace = x` in an event file); an `@name` constant holds for its file
 *   when the row's scope is `file`.
 * - D3, `definitions`: keys inside a record that are themselves definitions (a landed title
 *   nested at any depth, the options of an activity type), and the folders whose records are
 *   named by their file (`history/cultures`). Since format 8 each row says where its name
 *   identifies the definition (`name_scope`): on its own, or only together with a parent
 *   (`scope_parent`); a scope that is not `confirmed` decides nothing (`NestedScope`).
 */

import type { DeclarationRow, NestedRow } from '../spec/package.js';

/**
 * Where a nested name identifies its definition (part D3, format 8), read from a row whose
 * `name_scope_status` is `confirmed`:
 *
 * - `global`: the name alone, among the definitions of its kind (`qualifier`: the key of the
 *   line that sets a second part of the key, a gene's `portrait_group`, or null);
 * - `parent`: only together with the block `depth` keys down from the top level (1, the
 *   record or the container key; more, the leading part of the path `scope_parent` names);
 * - `not-settled`: the scope is `unknown`, or rests on the measurement alone: it decides
 *   nothing, and the same name under two parents is "winner not known".
 */
export type NestedScope =
    | { readonly kind: 'global'; readonly qualifier: string | null }
    | { readonly kind: 'parent'; readonly depth: number }
    | { readonly kind: 'not-settled'; readonly status: string };
import { foldCase, parentOf, segmentsOf } from './paths.js';

/** A top-level form that part D2 says declares no name: `namespace = x`, a setting. */
export interface NotADefinition {
    readonly key: string;
    readonly match: DeclarationRow['match'];
    /** `value` (`key = value`) or `block` (`key = { }`). */
    readonly form: string;
    /** What the row says it declares: `namespace` or `setting`. */
    readonly declares: string;
}

/** How part D3 recognises a nested definition, with the database the index records it in. */
export interface NestedRule {
    /** The kind of definition (`landed_title`, `activity_option`). */
    readonly kind: string;
    /**
     * The index's database for it: the row's database when the kind is that folder's content
     * type (a nested landed title is a landed title), else `<database>#<kind>`, a database of
     * its own that no rule of the table covers.
     */
    readonly database: string;
    /** `parent-field`, `container-child`, `any-block-child`, `key-pattern` or `record-key`. */
    readonly type: string;
    /** The path from the top-level key, each segment a whole-key pattern (`*`: any key). */
    readonly path: readonly RegExp[];
    /** The forms the definitions take: `block`, `value`. */
    readonly forms: readonly string[];
    readonly pattern: RegExp | null;
    readonly except: ReadonlySet<string>;
    readonly field: string | null;
    /** Format 8: where the name identifies the definition. */
    readonly scope: NestedScope;
}

/** The scope a D3 row gives its names (format 8): confirmed scopes only decide. */
export function scopeOf(row: NestedRow): NestedScope {
    if (row.name_scope_status !== 'confirmed' || row.name_scope === 'unknown') {
        return { kind: 'not-settled', status: row.name_scope_status };
    }
    if (row.name_scope === 'global') {
        return { kind: 'global', qualifier: row.name_scope_qualifier?.statement ?? null };
    }
    const parent = row.scope_parent ?? '';
    if (parent === 'record' || parent === 'container') {
        return { kind: 'parent', depth: 1 };
    }
    // A leading part of the row's own path: the block at that path qualifies the name.
    const path = row.recognised_by.path.split('/');
    const segments = parent.split('/');
    const leading = segments.length <= path.length && segments.every((s, i) => s === path[i]);
    return leading
        ? { kind: 'parent', depth: segments.length }
        : { kind: 'not-settled', status: `scope_parent ${parent} is no leading part of the path` };
}

/** A key matcher of D2 and D3: the word itself, a whole-key pattern, or a prefix. */
export function keyMatcher(key: string, match: string): (text: string) => boolean {
    if (match === 'exact') {
        return (text) => text === key;
    }
    if (match === 'prefix') {
        return (text) => text.startsWith(key);
    }
    const pattern = wholeKey(key);
    return (text) => pattern.test(text);
}

/** A whole-key pattern of D3's paths and D2's rows; `*` is any key. */
function wholeKey(segment: string): RegExp {
    return segment === '*' ? /^.+$/s : new RegExp(`^(?:${segment})$`);
}

/** One folder of the spec's list. */
export interface SpecFolder {
    /** The folder, relative to the game folder, as the spec writes it. */
    readonly path: string;
    /** The spec's content type for the folder's records. */
    readonly contentType: string;
    /** True when the spec has a record schema for the folder. */
    readonly schema: boolean;
    /** How many fields that schema lists at the record's top level. */
    readonly schemaFields: number;
    /** The records the spec counted in the base game it was derived from, if it has a schema. */
    readonly specRecords: number | null;
    /** The files the spec counted there, if it has a schema. */
    readonly specFiles: number | null;
    /** Part D2: the top-level forms of its files that declare no name. */
    readonly notDefinitions: readonly NotADefinition[];
    /** Part D3: the keys inside its records that are definitions. */
    readonly nested: readonly NestedRule[];
    /** Part D3: true when its records are named by their file, the key being the file's stem. */
    readonly fileNamed: boolean;
}

/** Where a file belongs: its folder, and whether its path spells that folder in the same case. */
export interface FolderMatch {
    readonly folder: SpecFolder;
    /** False when the file's path writes the folder in other letter case than the spec. */
    readonly exactCase: boolean;
}

function isJson(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `data` of a built part of the package, or an empty object. */
function partData(specPackage: Record<string, unknown>, key: string): Record<string, unknown> {
    const part = specPackage[key];
    return isJson(part) && part['status'] === 'built' && isJson(part['data']) ? part['data'] : {};
}

/** The confirmed rows of D2 that make a top-level form of a folder no definition. */
function notDefinitionsOf(rows: unknown): NotADefinition[] {
    if (!Array.isArray(rows)) {
        return [];
    }
    return (rows as DeclarationRow[])
        .filter(
            (r) =>
                r.status === 'confirmed' &&
                (r.declares === 'namespace' || r.declares === 'setting') &&
                (r.form === 'value' || r.form === 'block'),
        )
        .map((r) => ({ key: r.key, match: r.match, form: r.form, declares: r.declares }));
}

/** The confirmed rows of D3 `nested` for a folder, with the index's database for each. */
function nestedOf(rows: unknown, contentTypes: ReadonlyMap<string, string>): NestedRule[] {
    if (!Array.isArray(rows)) {
        return [];
    }
    return (rows as NestedRow[])
        .filter((r) => r.status === 'confirmed' && r.database !== '')
        .map((r) => {
            const by = r.recognised_by;
            const own = contentTypes.get(r.database) === r.kind;
            return {
                kind: r.kind,
                database: own ? r.database : `${r.database}#${r.kind}`,
                type: by.type,
                path: by.path.split('/').map(wholeKey),
                forms: by.forms,
                pattern: by.pattern === undefined ? null : wholeKey(by.pattern),
                except: new Set(by.except ?? []),
                field: by.field ?? null,
                scope: scopeOf(r),
            };
        });
}

/** The scope part D2 gives an `@name` constant (`all_directories`), when a confirmed row gives one. */
export function constantScopeFromSpec(specPackage: unknown): string | null {
    if (!isJson(specPackage)) {
        return null;
    }
    const rows = partData(specPackage, 'declarations')['all_directories'];
    if (!Array.isArray(rows)) {
        return null;
    }
    const row = (rows as DeclarationRow[]).find(
        (r) => r.declares === 'constant' && r.status === 'confirmed',
    );
    return row?.scope ?? null;
}

/**
 * The folder list of a format 8 spec package: `directories[]` with `path` and
 * `content_type`, and `schema[path]` with `fields` and `vanilla.records` and `vanilla.files`;
 * from parts D2 and D3, what a folder's files define beyond their top-level keys. An entry
 * without a path or content type is skipped.
 */
export function foldersFromSpec(specPackage: unknown): SpecFolder[] {
    if (!isJson(specPackage) || !Array.isArray(specPackage['directories'])) {
        return [];
    }
    const schemas = isJson(specPackage['schema']) ? specPackage['schema'] : {};
    const declarations = partData(specPackage, 'declarations')['directories'];
    const definitions = partData(specPackage, 'definitions');
    const nested = isJson(definitions['nested']) ? definitions['nested'] : {};
    const fileNamed = isJson(definitions['file_named']) ? definitions['file_named'] : {};
    const contentTypes = new Map<string, string>();
    for (const entry of specPackage['directories'] as unknown[]) {
        if (
            isJson(entry) &&
            typeof entry['path'] === 'string' &&
            typeof entry['content_type'] === 'string'
        ) {
            contentTypes.set(entry['path'], entry['content_type']);
        }
    }
    const out: SpecFolder[] = [];
    for (const entry of specPackage['directories'] as unknown[]) {
        if (!isJson(entry)) {
            continue;
        }
        const folder = entry['path'];
        const contentType = entry['content_type'];
        if (typeof folder !== 'string' || folder === '' || typeof contentType !== 'string') {
            continue;
        }
        const schema = schemas[folder];
        const fields = isJson(schema) && isJson(schema['fields']) ? schema['fields'] : undefined;
        const vanilla = isJson(schema) && isJson(schema['vanilla']) ? schema['vanilla'] : undefined;
        const records = vanilla?.['records'];
        const files = vanilla?.['files'];
        const named = fileNamed[folder];
        out.push({
            path: segmentsOf(folder).join('/'),
            contentType,
            schema: isJson(schema),
            schemaFields: fields === undefined ? 0 : Object.keys(fields).length,
            specRecords: typeof records === 'number' ? records : null,
            specFiles: typeof files === 'number' ? files : null,
            notDefinitions: notDefinitionsOf(
                isJson(declarations) ? declarations[folder] : undefined,
            ),
            nested: nestedOf(nested[folder], contentTypes),
            fileNamed:
                isJson(named) &&
                named['status'] === 'confirmed' &&
                named['name_from'] === 'file-stem',
        });
    }
    return out;
}

/**
 * The keys that save the current scope under a name (`save_scope_as = x`, after which
 * `scope:x` reads it): the entries of the package's hand-kept table `save_keys` (part C4), read
 * by the trust rule of docs/decisions.md. A confirmed entry is read; one with no evidence is
 * read too, since a save only ever makes `scope:x` not a finding; a contradicted entry is not.
 */
export function saveKeysFromSpec(specPackage: unknown): string[] {
    if (!isJson(specPackage) || !isJson(specPackage['tables'])) {
        return [];
    }
    const data = specPackage['tables']['data'];
    const table = isJson(data) ? data['save_keys'] : undefined;
    const entries = isJson(table) && isJson(table['entries']) ? table['entries'] : {};
    return Object.entries(entries)
        .filter(
            ([, entry]) =>
                isJson(entry) &&
                (entry['evidence_status'] === 'confirmed' || entry['evidence_status'] === 'none'),
        )
        .map(([key]) => key)
        .sort();
}

/** Whether the package documents a link that is global and takes data (`scope:x`, `title:x`). */
function isGlobalDataLink(specPackage: Record<string, unknown>, name: string): boolean {
    const validity = specPackage['scope_validity'];
    const links = isJson(validity) && isJson(validity['links']) ? validity['links'] : {};
    const link = Object.prototype.hasOwnProperty.call(links, name) ? links[name] : undefined;
    const forms = isJson(link) && Array.isArray(link['forms']) ? (link['forms'] as unknown[]) : [];
    return forms.some((f) => isJson(f) && f['global_link'] === true && f['requires_data'] === true);
}

/**
 * The links that read a saved scope (`scope:x`), in lower case. The package says which in its
 * evidence for the save keys: the `.info` line it cites for a confirmed entry of `save_keys`
 * names the link beside the key ("`save_temporary_scope_as = name # Saves the current scope as
 * scope:name`"), and the link is one the game documents as global and taking data. On the
 * 1.21.0.3 package, one.
 */
export function scopeLinksFromSpec(specPackage: unknown): string[] {
    if (!isJson(specPackage) || !isJson(specPackage['tables'])) {
        return [];
    }
    const data = specPackage['tables']['data'];
    const table = isJson(data) ? data['save_keys'] : undefined;
    const entries = isJson(table) && isJson(table['entries']) ? table['entries'] : {};
    const out = new Set<string>();
    for (const [key, entry] of Object.entries(entries)) {
        if (!isJson(entry) || entry['evidence_status'] !== 'confirmed') {
            continue;
        }
        const evidence = Array.isArray(entry['evidence']) ? (entry['evidence'] as unknown[]) : [];
        for (const item of evidence) {
            const words = isJson(item) && item['kind'] === 'info' ? item['words'] : undefined;
            for (const word of Array.isArray(words) ? (words as unknown[]) : []) {
                if (
                    typeof word === 'string' &&
                    word !== key &&
                    isGlobalDataLink(specPackage, word)
                ) {
                    out.add(word.toLowerCase());
                }
            }
        }
    }
    return [...out].sort();
}

/**
 * The folder table of a spec package: its folders, the scope part D2 gives a constant, the
 * keys that save a scope and the links that read one.
 */
export function folderTableFromSpec(specPackage: unknown): FolderTable {
    return new FolderTable(
        foldersFromSpec(specPackage),
        constantScopeFromSpec(specPackage),
        saveKeysFromSpec(specPackage),
        scopeLinksFromSpec(specPackage),
    );
}

/** The spec's folders, for classifying a file by its relative path. */
export class FolderTable {
    readonly folders: readonly SpecFolder[];
    /**
     * Part D2: what an `@name` constant holds for: `file` (each file its own), or null when
     * no confirmed row says, and the index keeps every constant in one database.
     */
    readonly constantScope: string | null;
    /**
     * The keys that save a scope under the name they are given (`save_scope_as`), in lower
     * case: the index records every `key = name` with one of them, in any case, as a save of
     * `name` (`saveKeysFromSpec`). Empty, the index records no saves.
     */
    readonly saveKeys: ReadonlySet<string>;
    /**
     * The links that read a saved scope (`scope:x`), in lower case: the index records the head
     * of every chain written with one of them, in any case, as a read of `x`
     * (`scopeLinksFromSpec`). Empty, the index records no reads.
     */
    readonly scopeLinks: ReadonlySet<string>;
    private readonly byFolded = new Map<string, SpecFolder>();

    constructor(
        folders: readonly SpecFolder[],
        constantScope: string | null = null,
        saveKeys: readonly string[] = [],
        scopeLinks: readonly string[] = [],
    ) {
        this.folders = folders;
        this.constantScope = constantScope;
        this.saveKeys = new Set(saveKeys.map((k) => k.toLowerCase()));
        this.scopeLinks = new Set(scopeLinks.map((k) => k.toLowerCase()));
        for (const folder of folders) {
            this.byFolded.set(foldCase(folder.path), folder);
        }
    }

    /** The folder with this path, as the spec writes it. */
    get(folder: string): SpecFolder | undefined {
        const found = this.byFolded.get(foldCase(folder));
        return found?.path === folder ? found : undefined;
    }

    /**
     * The deepest listed folder that holds the file at `relative`, matching whole folder names
     * without regard to letter case; `exactCase` says whether the case matched too. Undefined
     * when no listed folder holds it.
     */
    classify(relative: string): FolderMatch | undefined {
        let dir = parentOf(relative);
        while (dir !== '') {
            const folder = this.byFolded.get(foldCase(dir));
            if (folder !== undefined) {
                return { folder, exactCase: relative.startsWith(`${folder.path}/`) };
            }
            dir = parentOf(dir);
        }
        return undefined;
    }

    /**
     * The folder to report a file under when no listed folder holds it: the first folder of
     * its path below the deepest listed folder above it, or its first folder, or `(top level)`.
     * `common/new_kind/a/b.txt` is reported as `common/new_kind`.
     */
    undescribedFolder(relative: string): string {
        const parts = segmentsOf(parentOf(relative));
        if (parts.length === 0) {
            return '(top level)';
        }
        for (let n = parts.length; n > 0; n--) {
            const prefix = parts.slice(0, n).join('/');
            const listed = this.folders.some((f) =>
                foldCase(f.path).startsWith(`${foldCase(prefix)}/`),
            );
            if (listed) {
                return parts.slice(0, Math.min(n + 1, parts.length)).join('/');
            }
        }
        return parts[0] ?? '(top level)';
    }
}
