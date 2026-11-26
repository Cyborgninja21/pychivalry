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
 *
 * Since format 9 each directory also says which of its files are script (`files`): the
 * extensions its reader takes (`script.extensions`) less the files it names as no script
 * (`not_script`, a file or a pattern). A file of a listed folder that the package says is no
 * script is not read as script (`FolderTable.scriptStatus`).
 */

import type { DeclarationRow, DirectoryFiles, NestedRow, NotScriptEntry } from '../spec/package.js';
import type { SaveRule } from '../spec/tables.js';

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
import { extensionOf, fileNameOf, foldCase, parentOf, segmentsOf } from './paths.js';

/**
 * Format 9: which files of a folder are script. `extensions` is the list the folder's reader
 * takes (lower case), or null when the package does not settle it; `notScript` the files and
 * patterns it names as no script, each with what it is and its status.
 */
/**
 * Format 9, a keyword of the table `variables`: as what it is registered (`kind`: `effect`,
 * `trigger`, `link`, `list`), what it does (`does`), the variable's `namespace` (`scope`,
 * `local`, `global`, `dead_character`) and `holds` (`value`, `list`, `map`), where the name is
 * written (`name_in`), and whether it gives the variable its name (`defines`: by the table's own
 * `consumer` text, `does: set` with `holds: value`, or `does: add_item` with a list or a map).
 */
export interface VariableRule {
    readonly kind: string;
    readonly does: string;
    readonly namespace: string;
    readonly holds: string;
    readonly nameIn: readonly string[];
    readonly defines: boolean;
}

/**
 * Format 9, part D9: the forms of localization text that read a saved scope or value by name:
 * the head of a chain (`heads`), and the functions whose argument at a position (from 0) is
 * such a name (`functions`); and the formatting suffix that makes a one-word expression a game
 * concept instead (`conceptSuffix`, the confirmed `bare_key` form of `game_concept`).
 */
export interface TextScopeForms {
    readonly heads: boolean;
    readonly functions: ReadonlyMap<string, number>;
    readonly conceptSuffix: string | null;
}

/** The table `variables`' words for what an entry does and holds (its `about.attributes`). */
const VARIABLE_SET = 'set';
const VARIABLE_ADD_ITEM = 'add_item';
const VARIABLE_VALUE = 'value';

/** Part D9's kinds of name that a script save gives (its `consumer` text). */
const SAVED_READS: ReadonlySet<string> = new Set([
    'saved_scope',
    'saved_value',
    'saved_scope_or_value',
]);

/** Part D9's kind of name of a game concept's key. */
const CONCEPT_READS = 'game_concept';

/** The statuses of a D9 form that advice may read: rank 1 to 3 evidence, or the measurement. */
const TEXT_FORM_STATUSES: ReadonlySet<string> = new Set(['confirmed', 'measured-only']);

export interface FolderFiles {
    readonly extensions: readonly string[] | null;
    readonly notScript: readonly NotScriptRule[];
}

/** A file, or a pattern of file names, that a folder holds and that is no script (format 9). */
export interface NotScriptRule {
    /** A path inside the folder (`GUIDs.txt`), in folded case; or null for a pattern. */
    readonly file: string | null;
    /** A pattern of file names (`*.info`), as a whole-name pattern; or null for a file. */
    readonly pattern: RegExp | null;
    /** The package's own words: the file, or the pattern. */
    readonly written: string;
    readonly what: string;
    readonly status: string;
}

/** Whether a file of a listed folder is read as script, and the package's reason when it is not. */
export type ScriptStatus =
    | { readonly script: true }
    | {
          readonly script: false;
          /** `not-script`: a `not_script` entry names it; `extension`: its reader takes no such extension. */
          readonly why: 'not-script' | 'extension';
          readonly folder: string;
          readonly rule: NotScriptRule | null;
      };

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
    /** Format 9: which of its files are script; null when the package does not say. */
    readonly files: FolderFiles | null;
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

/** A pattern of file names (`*.info`) as a whole-name pattern, in folded case. */
function fileNamePattern(pattern: string): RegExp {
    const parts = foldCase(pattern)
        .split('*')
        .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${parts.join('.*')}$`);
}

/** A directory's `files` (format 9), as the folder table reads it; null when it has none. */
export function folderFilesOf(files: DirectoryFiles | undefined): FolderFiles | null {
    if (files === undefined || !isJson(files) || !isJson(files.script)) {
        return null;
    }
    const written: unknown = files.script.extensions;
    const extensions = Array.isArray(written)
        ? written.filter((e): e is string => typeof e === 'string').map((e) => foldCase(e))
        : null;
    const notScript: NotScriptRule[] = [];
    const entries: readonly NotScriptEntry[] = Array.isArray(files.not_script)
        ? files.not_script
        : [];
    for (const entry of entries) {
        if (typeof entry.file === 'string' && entry.file !== '') {
            notScript.push({
                file: foldCase(segmentsOf(entry.file).join('/')),
                pattern: null,
                written: entry.file,
                what: entry.what,
                status: entry.status,
            });
        } else if (typeof entry.pattern === 'string' && entry.pattern !== '') {
            notScript.push({
                file: null,
                pattern: fileNamePattern(entry.pattern),
                written: entry.pattern,
                what: entry.what,
                status: entry.status,
            });
        }
    }
    return { extensions, notScript };
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
            files: folderFilesOf(entry['files'] as DirectoryFiles | undefined),
        });
    }
    return out;
}

/**
 * The keys that save something under a name `scope:x` then reads (`save_scope_as = x`,
 * `save_scope_value_as = { name = x value = 5 }`), each with its rule: the entries of the
 * package's hand-kept table `save_keys` (part C4), read by the trust rule of docs/decisions.md.
 * A confirmed entry is read; one with no evidence is read too, since a save only ever makes
 * `scope:x` not a finding; a contradicted entry is not. Since format 9 each entry says what it
 * saves (`saves`: a scope or a value) and where the name is written (`name_in`, a list:
 * `value`, the key's own value, or the key of the parameter of its block that holds the name).
 * Candidates are never entries.
 */
export function saveRulesFromSpec(specPackage: unknown): [string, SaveRule][] {
    if (!isJson(specPackage) || !isJson(specPackage['tables'])) {
        return [];
    }
    const data = specPackage['tables']['data'];
    const table = isJson(data) ? data['save_keys'] : undefined;
    const entries = isJson(table) && isJson(table['entries']) ? table['entries'] : {};
    const text = (value: unknown): string[] =>
        Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    return Object.entries(entries)
        .filter(
            ([, entry]) =>
                isJson(entry) &&
                (entry['evidence_status'] === 'confirmed' || entry['evidence_status'] === 'none'),
        )
        .map(([key, entry]): [string, SaveRule] => {
            const e = entry as Record<string, unknown>;
            return [
                key,
                {
                    saves: typeof e['saves'] === 'string' ? e['saves'] : '',
                    source: typeof e['source'] === 'string' ? e['source'] : null,
                    nameIn: text(e['name_in']),
                    temporary: typeof e['temporary'] === 'boolean' ? e['temporary'] : null,
                    parameterOf: text(e['parameter_of']),
                },
            ];
        })
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The keys of `saveRulesFromSpec`, sorted. */
export function saveKeysFromSpec(specPackage: unknown): string[] {
    return saveRulesFromSpec(specPackage).map(([key]) => key);
}

/**
 * Part O1 (format 9): the names the game's own code saves as scopes for script, with no script
 * statement (`scope:actor` in an interaction): a `scope:<name>` whose name is listed is defined.
 */
export function savedFromCodeFromSpec(specPackage: unknown): string[] {
    if (!isJson(specPackage)) {
        return [];
    }
    const names = partData(specPackage, 'saved_from_code')['names'];
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [];
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
/**
 * Format 9, the table `variables`: its confirmed entries, by key, each with what it does and on
 * what (`VariableRule`); sorted by key.
 */
export function variablesFromSpec(specPackage: unknown): [string, VariableRule][] {
    if (!isJson(specPackage) || !isJson(specPackage['tables'])) {
        return [];
    }
    const data = specPackage['tables']['data'];
    const table = isJson(data) ? data['variables'] : undefined;
    const entries = isJson(table) && isJson(table['entries']) ? table['entries'] : {};
    const out: [string, VariableRule][] = [];
    for (const [key, entry] of Object.entries(entries)) {
        if (!isJson(entry) || entry['evidence_status'] !== 'confirmed') {
            continue;
        }
        const { kind, does, holds, namespace } = entry;
        if (
            typeof kind !== 'string' ||
            typeof does !== 'string' ||
            typeof holds !== 'string' ||
            typeof namespace !== 'string'
        ) {
            continue;
        }
        const nameIn = Array.isArray(entry['name_in'])
            ? (entry['name_in'] as unknown[]).filter((v): v is string => typeof v === 'string')
            : [];
        const defines =
            (does === VARIABLE_SET && holds === VARIABLE_VALUE) ||
            (does === VARIABLE_ADD_ITEM && holds !== VARIABLE_VALUE);
        out.push([key, { kind, does, namespace, holds, nameIn, defines }]);
    }
    return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Format 9, part D9: the forms of localization text that read a scope or a value the script
 * saved under a name, as its `consumer` text lists them for "a check that a text reads a scope
 * saved too late" (the rows whose `reads` is `saved_scope`, `saved_value` or
 * `saved_scope_or_value`), whose status is `confirmed` or `measured-only`: the head of a chain
 * (`saved_scope_head`, confirmed), and each function whose argument at `name_arg` is such a name
 * (`TopScope.sC`, measured only). A form whose status is `unknown` is not read. What they read
 * feeds advice only (`scope/title-text-reads-scope-saved-late`).
 */
export function textScopeFormsFromSpec(specPackage: unknown): TextScopeForms {
    const none: TextScopeForms = { heads: false, functions: new Map(), conceptSuffix: null };
    if (!isJson(specPackage)) {
        return none;
    }
    const forms = partData(specPackage, 'localization_forms')['forms'];
    if (!Array.isArray(forms)) {
        return none;
    }
    let heads = false;
    let conceptSuffix: string | null = null;
    const functions = new Map<string, number>();
    for (const form of forms as unknown[]) {
        if (
            isJson(form) &&
            form['reads'] === CONCEPT_READS &&
            form['shape'] === 'bare_key' &&
            form['status'] === 'confirmed' &&
            typeof form['suffix'] === 'string'
        ) {
            conceptSuffix = form['suffix'];
        }
        if (
            !isJson(form) ||
            typeof form['reads'] !== 'string' ||
            !SAVED_READS.has(form['reads']) ||
            typeof form['status'] !== 'string' ||
            !TEXT_FORM_STATUSES.has(form['status'])
        ) {
            continue;
        }
        if (form['shape'] === 'head') {
            heads = true;
        } else if (form['shape'] === 'function' && typeof form['name_arg'] === 'number') {
            const names = Array.isArray(form['function']) ? form['function'] : [form['function']];
            for (const name of names as unknown[]) {
                if (typeof name === 'string') {
                    functions.set(name, form['name_arg']);
                }
            }
        }
    }
    return { heads, functions, conceptSuffix };
}

export function folderTableFromSpec(specPackage: unknown): FolderTable {
    return new FolderTable(
        foldersFromSpec(specPackage),
        constantScopeFromSpec(specPackage),
        saveRulesFromSpec(specPackage),
        scopeLinksFromSpec(specPackage),
        savedFromCodeFromSpec(specPackage),
        {
            variables: variablesFromSpec(specPackage),
            textScopeForms: textScopeFormsFromSpec(specPackage),
        },
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
     * The keys that save a scope or a value under the name they are given (`save_scope_as`,
     * `save_scope_value_as`), in lower case: the index records every save one of them makes, in
     * any case, as a save of the name (`saveRulesFromSpec`). Empty, the index records no saves.
     */
    readonly saveKeys: ReadonlySet<string>;
    /** Per key of `saveKeys` (lower case), what it saves and where its name is written (format 9). */
    readonly saveRules: ReadonlyMap<string, SaveRule>;
    /**
     * Part O1 (format 9): the names the game's own code saves as scopes for script, with no
     * script statement; a `scope:<name>` whose name is listed is defined. Empty when the package
     * gives none.
     */
    readonly savedFromCode: ReadonlySet<string>;
    /**
     * The links that read a saved scope (`scope:x`), in lower case: the index records the head
     * of every chain written with one of them, in any case, as a read of `x`
     * (`scopeLinksFromSpec`). Empty, the index records no reads.
     */
    readonly scopeLinks: ReadonlySet<string>;
    /**
     * Format 9, the table `variables`: per keyword (lower case), what it does and on what kind
     * of variable, and where the name is written (`variablesFromSpec`). Empty, the index records
     * no variable.
     */
    readonly variables: ReadonlyMap<string, VariableRule>;
    /**
     * Format 9, part D9: the forms of localization text that read a saved scope or value by
     * name (`textScopeFormsFromSpec`). With none, the index records no such read.
     */
    readonly textScopeForms: TextScopeForms;
    private readonly byFolded = new Map<string, SpecFolder>();

    constructor(
        folders: readonly SpecFolder[],
        constantScope: string | null = null,
        saveRules: readonly (readonly [string, SaveRule])[] = [],
        scopeLinks: readonly string[] = [],
        savedFromCode: readonly string[] = [],
        more: {
            readonly variables?: readonly (readonly [string, VariableRule])[];
            readonly textScopeForms?: TextScopeForms;
        } = {},
    ) {
        this.folders = folders;
        this.constantScope = constantScope;
        this.saveRules = new Map(saveRules.map(([key, rule]) => [key.toLowerCase(), rule]));
        this.saveKeys = new Set(this.saveRules.keys());
        this.scopeLinks = new Set(scopeLinks.map((k) => k.toLowerCase()));
        this.savedFromCode = new Set(savedFromCode);
        this.variables = new Map(
            (more.variables ?? []).map(([key, rule]) => [key.toLowerCase(), rule]),
        );
        this.textScopeForms = more.textScopeForms ?? {
            heads: false,
            functions: new Map(),
            conceptSuffix: null,
        };
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
     * Whether the index reads a script file (`.txt`) of a listed folder as script (format 9): not
     * when the folder's `not_script` names it (a file by its path inside the folder, or a pattern
     * of file names), nor when the folder's reader takes a list of extensions without its own.
     * A folder whose extensions the package does not settle (null), or that has no `files`, is
     * read as before. Matching ignores letter case: a file the package says is no script is not
     * read in any spelling. Undefined for a file no listed folder holds.
     */
    scriptStatus(relative: string): ScriptStatus | undefined {
        const match = this.classify(relative);
        if (match === undefined) {
            return undefined;
        }
        const files = match.folder.files;
        if (files === null) {
            return { script: true };
        }
        const inside = foldCase(relative.slice(match.folder.path.length + 1));
        const name = foldCase(fileNameOf(relative));
        for (const rule of files.notScript) {
            if (rule.file !== null ? rule.file === inside : rule.pattern?.test(name) === true) {
                return { script: false, why: 'not-script', folder: match.folder.path, rule };
            }
        }
        if (files.extensions !== null && !files.extensions.includes(extensionOf(relative))) {
            return { script: false, why: 'extension', folder: match.folder.path, rule: null };
        }
        return { script: true };
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
