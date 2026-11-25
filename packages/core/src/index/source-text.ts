/**
 * The text of a file the index read, as the index read it (the agent server's `source` tool,
 * docs/PLAN.md item 9.8): the game's own script or localization, or the mod's, by its layer and
 * its path inside the layer, never by an address on disk an agent names.
 *
 * A file is found only in the listings the index was built from (`SourceListing`: the base
 * game's install folders and the mod), so only a script or localization file in a folder the
 * spec lists can be read, and only at the path the index knows it by. The listing never holds a
 * link (`walkFiles` does not follow one), and the file is looked at again when it is read: one
 * that has become a link since, or whose real address is outside its layer's real folder, is
 * refused. The bytes are decoded as the index decodes them (`WorkspaceIndex.decode`: UTF-8, its
 * byte-order mark removed, a file not valid UTF-8 read as the index reads it) and split into
 * lines where the index's positions split them (`LineIndex`: `\n`, `\r\n` or a lone `\r`), so
 * a line a result named is the line shown. Nothing is written.
 */

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Decoded } from '../syntax/decode.js';
import { LineIndex } from '../syntax/position.js';
import { foldCase, segmentsOf } from './paths.js';
import type { SourceFile, SourceListing } from './read-game.js';
import type { WorkspaceIndex } from './workspace.js';

/** Why a file cannot be read, in words an agent can act on. */
export class SourceRefused extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SourceRefused';
    }
}

/** A file of a listing, found by its layer and its path inside the layer. */
export interface ListedFile {
    readonly file: SourceFile;
    /** The folder its layer's paths are relative to, on disk: the file's real address must be inside it. */
    readonly root: string;
}

/** The text of a listed file, read and split as the index reads it. */
export interface SourceText {
    readonly layer: string;
    readonly path: string;
    /** Every line, without its line break; an empty file has one empty line. */
    readonly lines: readonly string[];
    readonly bom: boolean;
    readonly encoding: Decoded['encoding'];
    readonly validUtf8: boolean;
}

/**
 * The folder a listed file's path is relative to: its address on disk without its path's
 * segments (the install folder of its layer, a DLC pack's folder, or the mod's folder).
 */
export function rootOf(file: SourceFile): string {
    let root = file.disk;
    for (let i = segmentsOf(file.path).length; i > 0; i--) {
        root = path.dirname(root);
    }
    return root;
}

/**
 * A path as an agent gave it, checked before anything is looked up: a relative path with `/`,
 * no empty, `.` or `..` segment. Throws `SourceRefused` naming what is wrong.
 */
export function checkGivenPath(given: string): string {
    if (given === '') {
        throw new SourceRefused('the path is empty');
    }
    if (given.includes('\u0000')) {
        throw new SourceRefused('the path holds a NUL character');
    }
    if (given.startsWith('/') || given.startsWith('\\') || /^[A-Za-z]:/.test(given)) {
        throw new SourceRefused(
            'an absolute path is not a place; give the path inside its layer, as a result names it',
        );
    }
    if (given.includes('\\')) {
        throw new SourceRefused(
            'the path is written with \\; give it as a result names it, with /',
        );
    }
    const segments = given.split('/');
    if (segments.some((s) => s === '..' || s === '.' || s === '')) {
        throw new SourceRefused(
            'the path may hold no empty, . or .. part; give the path inside its layer, as a result names it',
        );
    }
    return given;
}

/**
 * The file of `listings` at `layer` and `given` (checked by `checkGivenPath`), or
 * `SourceRefused` naming why there is none: a layer no listing has, or a path the layer does not
 * list (with the listed path of the same letters in another case, when there is one).
 */
export function findListedFile(
    listings: readonly SourceListing[],
    layer: string,
    given: string,
): ListedFile {
    const wanted = checkGivenPath(given);
    let inLayer = false;
    let otherCase: string | null = null;
    for (const listing of listings) {
        for (const file of listing.files) {
            if (file.layer !== layer) {
                continue;
            }
            inLayer = true;
            if (file.path === wanted) {
                return { file, root: rootOf(file) };
            }
            if (otherCase === null && foldCase(file.path) === foldCase(wanted)) {
                otherCase = file.path;
            }
        }
    }
    if (!inLayer) {
        throw new SourceRefused(`no file of the layer ${layer} is read`);
    }
    throw new SourceRefused(
        otherCase === null
            ? `the layer ${layer} has no file ${wanted} that pychivalry reads (a script or localization file of a folder the game reads, at the path a result names)`
            : `the layer ${layer} has no file ${wanted}; it has ${otherCase}`,
    );
}

/** Whether `inner` is `outer` or inside it, both real addresses. */
function inside(outer: string, inner: string): boolean {
    const rel = path.relative(outer, inner);
    return (
        rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
    );
}

/**
 * The text of a listed file, decoded as `index` decodes it and split into its lines. Refused
 * (`SourceRefused`) when the file is gone, is a link, or its real address is outside its
 * layer's real folder.
 */
export function readListedFile(index: WorkspaceIndex, listed: ListedFile): SourceText {
    const { file, root } = listed;
    let real: string;
    try {
        if (lstatSync(file.disk).isSymbolicLink()) {
            throw new SourceRefused(`${file.path} is a link; source reads no link`);
        }
        real = realpathSync(file.disk);
    } catch (err) {
        if (err instanceof SourceRefused) {
            throw err;
        }
        throw new SourceRefused(`${file.path} can no longer be read: it was removed or moved`);
    }
    let realRoot: string;
    try {
        realRoot = realpathSync(root);
    } catch {
        throw new SourceRefused(`the folder of the layer ${file.layer} can no longer be read`);
    }
    if (!inside(realRoot, real)) {
        throw new SourceRefused(
            `${file.path} leads outside the folder of the layer ${file.layer}; source reads nothing outside it`,
        );
    }
    let bytes: Uint8Array;
    try {
        bytes = readFileSync(real);
    } catch {
        throw new SourceRefused(`${file.path} can no longer be read`);
    }
    const decoded = index.decode(bytes);
    const lines = new LineIndex(decoded.text);
    const out: string[] = [];
    for (let i = 0; i < lines.lineCount; i++) {
        const start = lines.lineStarts[i] ?? 0;
        const next = lines.lineStarts[i + 1];
        let end = next ?? decoded.text.length;
        if (next !== undefined) {
            end--;
            if (decoded.text.charCodeAt(end) === 10 && decoded.text.charCodeAt(end - 1) === 13) {
                end--;
            }
        }
        out.push(decoded.text.slice(start, end));
    }
    return {
        layer: file.layer,
        path: file.path,
        lines: out,
        bom: decoded.bom,
        encoding: decoded.encoding,
        validUtf8: decoded.validUtf8,
    };
}
