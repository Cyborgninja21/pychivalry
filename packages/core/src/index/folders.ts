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
 * written (`Form` in rules.ts) and draws no other line between them.
 */

import { foldCase, parentOf, segmentsOf } from './paths.js';

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

/**
 * The folder list of a spec package (formats 4 and 5): `directories[]` with `path` and
 * `content_type`, and `schema[path]` with `fields` and `vanilla.records`. An entry without a
 * path or content type is skipped.
 */
export function foldersFromSpec(specPackage: unknown): SpecFolder[] {
    if (!isJson(specPackage) || !Array.isArray(specPackage['directories'])) {
        return [];
    }
    const schemas = isJson(specPackage['schema']) ? specPackage['schema'] : {};
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
        out.push({
            path: segmentsOf(folder).join('/'),
            contentType,
            schema: isJson(schema),
            schemaFields: fields === undefined ? 0 : Object.keys(fields).length,
            specRecords: typeof records === 'number' ? records : null,
            specFiles: typeof files === 'number' ? files : null,
        });
    }
    return out;
}

/** The spec's folders, for classifying a file by its relative path. */
export class FolderTable {
    readonly folders: readonly SpecFolder[];
    private readonly byFolded = new Map<string, SpecFolder>();

    constructor(folders: readonly SpecFolder[]) {
        this.folders = folders;
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
