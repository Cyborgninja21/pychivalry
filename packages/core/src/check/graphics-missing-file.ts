/**
 * `graphics/missing-file` (docs/checks.md, item 10.5): a texture a field names that is a file of
 * neither the mod nor the base game: not in the install's `game/`, `jomini/` or `clausewitz/`
 * folder, nor in a DLC pack the index reads. A warning on the catalogue's
 * `failed_to_load_texture_X_file_not_found` ("Failed to load texture %s - file not found").
 *
 * **Which fields hold a file path** is the spec package's, never a list here: a field or sub-field
 * of a folder's record schema whose `.info` type is a file path (part C1, `info_type`: Paradox's
 * own documentation writes the value `<file path>`, `string path` or `path string`) and whose
 * measured value type (part B1, `value_type`) has the value group of paths, so that the base game
 * writes paths there as well. On 1.21.0.3, 13 fields of 8 folders. A field the package measures
 * as a path but documents with no type, or with another (`common/buildings`' `type_icon`, a file
 * name inside the folder its define names), is not read: the package does not say its value is a
 * path from the top of the game's folders (docs/graphics-check.md, the request to the spec work).
 *
 * **Which values are judged.** A value naming a texture: its file name ends in one of
 * `TEXTURE_EXTENSIONS`, the three kinds of file docs/MVP.md gives the check. A value of another
 * kind (a video, `.bk2`) is not this check's. Of a texture, only a path from the top of the
 * game's folders, its segments joined by `/`, is looked up; every other form is left undecided
 * (`NotDecided`), because neither the package nor the base game says how the game reads it:
 *
 * - a bare file name, with no folder (`my_picture.dds`): every one of the base game's values in
 *   these fields names a folder;
 * - a path with a `..` or `.` segment, or an empty one: whether the game resolves them, or refuses
 *   a path that leaves its folders, is not said;
 * - a path that starts with `/`, with a drive, or written with `\`;
 * - a value built from a `$PARAMETER$`, known only where the script is called, or holding `[`;
 * - an `@constant` whose value the file does not set at its top level (part D2: a constant holds
 *   for its file; one set inside a block, by a reader action or in `reader_export/` is not
 *   followed). One set there to a path is judged at the field that names the constant.
 *
 * **Where a file is looked for:** the files of the mod and of every layer of the base game the
 * index reads, its textures among them (`WorkspaceIndex.unreadFilesAt`). A path that matches a
 * file only in other letter case is decided by the rules table's `path-case` row for the
 * platform (part D1): found where the row folds case, missing where it compares paths exactly
 * (the finding names the file's own spelling), undecided where no row decides. A mod's
 * `replace_path` is not applied: a texture the game would find under it is counted as found.
 *
 * **Silent when no game folder is set:** without the base game's files a texture the mod lacks may
 * be the game's, which nothing can tell; so the check reports nothing until the index holds the
 * files of a layer of the base game.
 */

import type { SchemaField } from '../spec/package.js';
import type { Spec } from '../spec/reader.js';
import type { FileNode, Pair, Scalar } from '../syntax/tree.js';
import type { FolderTable } from '../index/folders.js';
import type { DefinedNames } from './context.js';
import type { CheckFinding } from './finding.js';
import type { WorkspaceNames } from './names.js';
import { recordsOf } from './records.js';
import { finding, type CheckContext } from './report.js';

export const CODE = 'graphics/missing-file';

/** The kinds of graphics file the check looks for (docs/MVP.md, "Graphics-file check"). */
export const TEXTURE_EXTENSIONS: readonly string[] = ['.dds', '.png', '.tga'];

/** The `.info` type of a value that is a file path (part C1, `info_type`). */
const FILE_PATH_TYPE = 'file_path';

/** The value group of a measured path (part B1, `value_type`). */
const PATH_GROUP = 'path';

/** The layer of a mod's files in the index. */
const MOD_LAYER = 'mod';

/** A field the package says holds a file path: its folder and its keys below the record. */
export interface PathField {
    readonly directory: string;
    readonly path: readonly string[];
}

const fieldCache = new WeakMap<Spec, ReadonlyMap<string, readonly PathField[]>>();

/** True when the package documents a field's value as a file path and measures paths there. */
function holdsFilePath(field: SchemaField): boolean {
    return (
        (field.info_type ?? []).includes(FILE_PATH_TYPE) &&
        (field.value_type ?? '').split('|').includes(PATH_GROUP)
    );
}

/** Every field the package says holds a file path, by folder (see the head of this file). */
export function pathFields(spec: Spec): ReadonlyMap<string, readonly PathField[]> {
    const known = fieldCache.get(spec);
    if (known !== undefined) {
        return known;
    }
    const out = new Map<string, PathField[]>();
    const walk = (
        directory: string,
        fields: Readonly<Record<string, SchemaField>>,
        path: readonly string[],
    ): void => {
        for (const [key, field] of Object.entries(fields)) {
            const at = [...path, key];
            if (holdsFilePath(field)) {
                out.set(directory, [...(out.get(directory) ?? []), { directory, path: at }]);
            }
            if (field.fields !== undefined) {
                walk(directory, field.fields, at);
            }
        }
    };
    for (const [directory, schema] of Object.entries(spec.data.schema)) {
        walk(directory, schema.fields, []);
    }
    fieldCache.set(spec, out);
    return out;
}

/** Why a texture value is not looked up (see the head of this file). */
export type NotDecided =
    | 'no-folder'
    | 'parent-segment'
    | 'empty-segment'
    | 'from-root'
    | 'backslash'
    | 'parameter'
    | 'bracket'
    | 'constant-not-followed';

/** What a value is, for this check. */
export type PathReading =
    | { readonly kind: 'texture'; readonly path: string }
    | { readonly kind: 'not-texture' }
    | { readonly kind: 'not-decided'; readonly why: NotDecided };

/** True when a value names a file of one of `TEXTURE_EXTENSIONS`, in any letter case. */
export function isTextureName(value: string): boolean {
    const lower = value.toLowerCase();
    return TEXTURE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** How a value written in a file-path field reads (see the head of this file). */
export function texturePathOf(value: string): PathReading {
    if (!isTextureName(value)) {
        return { kind: 'not-texture' };
    }
    if (value.includes('$')) {
        return { kind: 'not-decided', why: 'parameter' };
    }
    if (value.includes('[') || value.includes(']')) {
        return { kind: 'not-decided', why: 'bracket' };
    }
    if (value.includes('\\')) {
        return { kind: 'not-decided', why: 'backslash' };
    }
    if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) {
        return { kind: 'not-decided', why: 'from-root' };
    }
    const segments = value.split('/');
    if (segments.length < 2) {
        return { kind: 'not-decided', why: 'no-folder' };
    }
    if (segments.some((s) => s === '.' || s === '..')) {
        return { kind: 'not-decided', why: 'parent-segment' };
    }
    if (segments.some((s) => s === '')) {
        return { kind: 'not-decided', why: 'empty-segment' };
    }
    return { kind: 'texture', path: value };
}

/** The pairs at a path below a block (`a`, `b`: the `b` pairs inside each `a` block). */
function pairsAt(items: readonly Pair[], path: readonly string[]): Pair[] {
    let level: readonly Pair[] = items;
    let pairs: Pair[] = [];
    path.forEach((segment, i) => {
        pairs = level.filter((p) => p.key.text === segment);
        if (i < path.length - 1) {
            level = pairs.flatMap((p) =>
                p.value?.kind === 'block'
                    ? p.value.items.filter((x): x is Pair => x.kind === 'pair')
                    : [],
            );
        }
    });
    return pairs;
}

/** The values of a file's top-level `@name = value` lines, by name: part D2's constants. */
function constantsOf(tree: FileNode): ReadonlyMap<string, Scalar> {
    const out = new Map<string, Scalar>();
    for (const item of tree.items) {
        if (
            item.kind === 'pair' &&
            item.key.type === 'constant' &&
            item.value?.kind === 'scalar' &&
            !out.has(item.key.text)
        ) {
            out.set(item.key.text, item.value);
        }
    }
    return out;
}

/** What the check reads beside the file's tree. */
export interface MissingFileInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    readonly file: string;
    readonly tree: FileNode;
    readonly names: DefinedNames & Partial<WorkspaceNames>;
}

/** What one value read in a file-path field names, and where it is written. */
export interface TexturePlace {
    /** The value as written in the field (an `@constant` when the path is the constant's). */
    readonly scalar: Scalar;
    /** The field's keys below its record. */
    readonly field: readonly string[];
    readonly reading: PathReading;
    /** The constant it was read through, when it is one. */
    readonly constant: string | null;
}

/** Every value of a file's file-path fields, each read (see the head of this file). */
export function texturePlaces(input: Omit<MissingFileInput, 'names'>): TexturePlace[] {
    const records = recordsOf(input.spec, input.folders, input.file, input.tree);
    const fields =
        records.folder === null ? [] : (pathFields(input.spec).get(records.folder.path) ?? []);
    if (fields.length === 0) {
        return [];
    }
    let constants: ReadonlyMap<string, Scalar> | undefined;
    const out: TexturePlace[] = [];
    for (const record of records.records) {
        const items = record.body.items.filter((i): i is Pair => i.kind === 'pair');
        for (const field of fields) {
            for (const pair of pairsAt(items, field.path)) {
                const scalar = pair.value?.kind === 'scalar' ? pair.value : undefined;
                if (scalar === undefined || scalar.type === 'arithmetic') {
                    continue;
                }
                if (scalar.type === 'constant') {
                    constants ??= constantsOf(input.tree);
                    const value = constants.get(scalar.text);
                    const reading: PathReading =
                        value === undefined
                            ? { kind: 'not-decided', why: 'constant-not-followed' }
                            : texturePathOf(value.value);
                    out.push({ scalar, field: field.path, reading, constant: scalar.text });
                    continue;
                }
                out.push({
                    scalar,
                    field: field.path,
                    reading: texturePathOf(scalar.value),
                    constant: null,
                });
            }
        }
    }
    return out;
}

/** What the check asks the index: the files no script names, and how letter case compares. */
type FileNames = Pick<WorkspaceNames, 'unreadFilesAt' | 'unreadLayers' | 'pathCase'>;

/**
 * The names' files, when they hold the files of a layer of the base game: only then can a file be
 * missing. Undefined otherwise, and the check reports nothing.
 */
function baseGameFiles(names: Partial<WorkspaceNames>): FileNames | undefined {
    const { baseGame, unreadFilesAt, unreadLayers, pathCase } = names;
    return baseGame === true &&
        unreadFilesAt !== undefined &&
        unreadLayers !== undefined &&
        pathCase !== undefined &&
        unreadLayers.some((layer) => layer !== MOD_LAYER)
        ? { unreadFilesAt, unreadLayers, pathCase }
        : undefined;
}

export function missingFiles(context: CheckContext, input: MissingFileInput): CheckFinding[] {
    const names = baseGameFiles(input.names);
    if (names === undefined) {
        return [];
    }
    const out: CheckFinding[] = [];
    for (const place of texturePlaces(input)) {
        if (place.reading.kind !== 'texture') {
            continue;
        }
        const path = place.reading.path;
        const found = names.unreadFilesAt(path);
        if (found.some((f) => f.path === path)) {
            continue;
        }
        const otherCase = [...new Set(found.map((f) => f.path))].sort();
        if (otherCase.length > 0 && names.pathCase !== 'exact') {
            // Found where the platform folds case; undecided where no row says.
            continue;
        }
        const data: Record<string, string | readonly string[]> = {
            path,
            field: place.field.join('/'),
            ...(place.constant === null ? {} : { constant: place.constant }),
            ...(otherCase.length > 0 ? { other_case: otherCase } : {}),
        };
        out.push(finding(CODE, place.scalar, [path], data, context));
    }
    return out;
}
