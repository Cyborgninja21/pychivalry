/**
 * The text of a file the index read, as the index read it: the game's own script or
 * localization, or the mod's, by its layer and its path inside the layer, never by an address on
 * disk an agent or a person names. One reading for two surfaces (docs/PLAN.md item 9.8): the
 * agent server's `source` tool and the command line's `pychivalry source` both call `readSource`,
 * so that they show the same lines, refuse the same places and keep to the same limits.
 *
 * A file is found only in the listings the index is built from (`SourceListing`: the base
 * game's install folders and the mod), so only a script or localization file in a folder the
 * spec lists can be read, and only at the path the index knows it by. The listing never holds a
 * link (`walkFiles` does not follow one), and the file is looked at again when it is read: one
 * that has become a link since, or whose real address is outside its layer's real folder, is
 * refused. The bytes are decoded as the index decodes them (`WorkspaceIndex.decode`: UTF-8, its
 * byte-order mark removed, a file not valid UTF-8 read as the index reads it) and split into
 * lines where the index's positions split them (`LineIndex`: `\n`, `\r\n` or a lone `\r`), so
 * a line a result named is the line shown. Nothing is written.
 *
 * The limits: at most `SOURCE_MAX_LINES` lines, the place's own and up to `context` lines before
 * and after it (`SOURCE_DEFAULT_CONTEXT`, at most `SOURCE_MAX_CONTEXT`); a line longer than
 * `SOURCE_MAX_LINE_CHARACTERS` cut and said to be; and the lines shown, written as JSON strings,
 * within `SOURCE_TEXT_ROOM` characters, the lines after left out and said to be. A refusal is a
 * `SourceRefused` that names the argument it is about and whether its form is wrong (`form`:
 * no installed game or mod could make it a place) or no such place is read (`place`).
 */

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Decoded } from '../syntax/decode.js';
import { LineIndex } from '../syntax/position.js';
import { foldCase, segmentsOf } from './paths.js';
import { installFolders, type SourceFile, type SourceListing } from './read-game.js';

/** The layer of the mod's own files. */
export const SOURCE_MOD_LAYER = 'mod';

/** The most lines one answer shows: the hard cap. */
export const SOURCE_MAX_LINES = 40;

/** The lines shown before and after the place by default, and at most. */
export const SOURCE_DEFAULT_CONTEXT = 10;
export const SOURCE_MAX_CONTEXT = 20;

/** The most characters of one line shown; a longer line is cut and marked `…`. */
export const SOURCE_MAX_LINE_CHARACTERS = 400;

/**
 * The most characters the lines shown take, each written as a JSON string (so that quotes and
 * other escaped characters count as they will be sent): the lines after are left out and said
 * to be. It keeps the agent server's whole result within its budget (`RESULT_BUDGET`, 14,000),
 * and the command line shows the same lines.
 */
export const SOURCE_TEXT_ROOM = 12_000;

/** The argument a refusal is about, by the agent server's names of them. */
export type SourceArgument = 'layer' | 'file' | 'line' | 'end_line' | 'context';

/**
 * What kind of refusal: `form`, an argument no installed game or mod could make a place (an
 * absolute path, a `..`, a line before 1); `place`, a place of the right form that is not read
 * here (a layer not read, a file the layer does not list, a link, a line past the end).
 */
export type SourceRefusalKind = 'form' | 'place';

/** Why a file cannot be read, in words an agent or a person can act on. */
export class SourceRefused extends Error {
    readonly argument: SourceArgument;
    readonly kind: SourceRefusalKind;

    constructor(
        message: string,
        argument: SourceArgument = 'file',
        kind: SourceRefusalKind = 'place',
    ) {
        super(message);
        this.name = 'SourceRefused';
        this.argument = argument;
        this.kind = kind;
    }
}

/** A file of a listing, found by its layer and its path inside the layer. */
export interface ListedFile {
    readonly file: SourceFile;
    /** The folder its layer's paths are relative to, on disk: the file's real address must be inside it. */
    readonly root: string;
}

/** How the files are decoded: as the index that reads them decodes them (`WorkspaceIndex`). */
export interface SourceDecoder {
    decode(bytes: Uint8Array): Decoded;
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
 * A path as it was given, checked before anything is looked up: a relative path with `/`, no
 * empty, `.` or `..` segment. Throws `SourceRefused` (of the kind `form`) naming what is wrong.
 */
export function checkGivenPath(given: string): string {
    const refuse = (message: string): never => {
        throw new SourceRefused(message, 'file', 'form');
    };
    if (given === '') {
        refuse('the path is empty');
    }
    if (given.includes('\u0000')) {
        refuse('the path holds a NUL character');
    }
    if (given.startsWith('/') || given.startsWith('\\') || /^[A-Za-z]:/.test(given)) {
        refuse(
            'an absolute path is not a place; give the path inside its layer, as a result names it',
        );
    }
    if (given.includes('\\')) {
        refuse('the path is written with \\; give it as a result names it, with /');
    }
    const segments = given.split('/');
    if (segments.some((s) => s === '..' || s === '.' || s === '')) {
        refuse(
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
 * The text of a listed file, decoded as `decoder` (the index) decodes it and split into its
 * lines. Refused (`SourceRefused`) when the file is gone, is a link, or its real address is
 * outside its layer's real folder.
 */
export function readListedFile(decoder: SourceDecoder, listed: ListedFile): SourceText {
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
    const decoded = decoder.decode(bytes);
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

// ─── One reading for every surface ─────────────────────────────────────────

/**
 * What a surface reads places from: the listings the index is (or would be) built from, the base
 * game's folder, whether a mod is read, and how the index decodes a file. The agent server makes
 * it from its workspace (`workspaceSources`), the command line by listing the folders alone
 * (`openSources`); the same folders give the same set.
 */
export interface SourceSet {
    readonly listings: readonly SourceListing[];
    /** The game's `game` folder, or null when no base game is read. */
    readonly gameDir: string | null;
    /** True when a mod is read: its layer `mod` is then read, even when it lists no file. */
    readonly mod: boolean;
    readonly decoder: SourceDecoder;
}

/** A place to show: its layer, its file's path inside the layer, its lines counted from 1. */
export interface SourcePlace {
    readonly layer: string;
    readonly file: string;
    readonly line: number;
    /** The place's last line; `line` when left out. */
    readonly endLine?: number | undefined;
    /** The lines shown before and after the place; `SOURCE_DEFAULT_CONTEXT` when left out. */
    readonly context?: number | undefined;
}

/** The lines shown around a place, as every surface gives them. */
export interface SourceExcerpt {
    readonly layer: string;
    /** The file's path inside its layer. */
    readonly file: string;
    /** The first and the last line shown, counted from 1. */
    readonly from: number;
    readonly to: number;
    /** The length of the last line shown, whole (UTF-16 code units): where the lines shown end. */
    readonly lastLength: number;
    /** Each line shown: its number, a tab, then its text, cut and marked `…` when too long. */
    readonly lines: readonly string[];
    /** How many lines the file has (the line after its last line break counts). */
    readonly lineCount: number;
    /** The lines whose text was cut after `SOURCE_MAX_LINE_CHARACTERS` characters. */
    readonly cutLines: readonly number[];
    /** How the file was read: `utf-8`, or how a file that is not valid UTF-8 was read. */
    readonly encoding: string;
    /** What to know about the lines shown: a place cut, a place past the end, lines left out. */
    readonly notes: readonly string[];
}

/** Values in a sentence, as many as fit in `room` characters, the rest counted. */
function listed(values: readonly string[], room = 2_000): string {
    const shown: string[] = [];
    let used = 0;
    for (const v of values) {
        if (used + v.length + 2 > room) {
            break;
        }
        shown.push(v);
        used += v.length + 2;
    }
    const rest = values.length - shown.length;
    return rest === 0 ? shown.join(', ') : `${shown.join(', ')} and ${String(rest)} more`;
}

/**
 * The layers a set reads, the mod's first: the install folders of its game (`game`, `jomini`,
 * `clausewitz`), its DLC packs, and any other layer its listings hold.
 */
export function sourceLayers(set: SourceSet): string[] {
    const out = new Set<string>();
    if (set.gameDir !== null) {
        for (const folder of installFolders(set.gameDir)) {
            out.add(folder.layer);
        }
    }
    for (const listing of set.listings) {
        for (const pack of listing.packs) {
            out.add(pack.layer);
        }
        for (const file of listing.files) {
            out.add(file.layer);
        }
    }
    const others = [...out].filter((l) => l !== SOURCE_MOD_LAYER).sort();
    return set.mod ? [SOURCE_MOD_LAYER, ...others] : others;
}

/**
 * The lines to show of a file of `count` lines: the place's own (`line` to `endLine`) and its
 * context, within `SOURCE_MAX_LINES`, the context shrunk from the longer side first; a place
 * longer than the cap is shown from its first line and said to be cut (`placeCut`).
 */
export function shownLines(
    line: number,
    endLine: number,
    context: number,
    count: number,
): { readonly from: number; readonly to: number; readonly placeCut: boolean } {
    const last = Math.min(endLine, count);
    if (last - line + 1 >= SOURCE_MAX_LINES) {
        return {
            from: line,
            to: line + SOURCE_MAX_LINES - 1,
            placeCut: last > line + SOURCE_MAX_LINES - 1,
        };
    }
    let before = Math.min(context, line - 1);
    let after = Math.min(context, count - last);
    while (before + after + (last - line + 1) > SOURCE_MAX_LINES) {
        if (after >= before) {
            after--;
        } else {
            before--;
        }
    }
    return { from: line - before, to: last + after, placeCut: false };
}

/** A line as shown: its number, a tab, its text, cut when too long. */
function shownLine(n: number, text: string): { readonly shown: string; readonly cut: boolean } {
    const cut = text.length > SOURCE_MAX_LINE_CHARACTERS;
    return {
        shown: `${String(n)}\t${cut ? `${text.slice(0, SOURCE_MAX_LINE_CHARACTERS)}…` : text}`,
        cut,
    };
}

/** True for a whole number. */
function isWhole(n: number): boolean {
    return Number.isInteger(n);
}

/** Refuse an argument whose form is wrong. */
function badForm(argument: SourceArgument, message: string): never {
    throw new SourceRefused(message, argument, 'form');
}

/**
 * Why `layer` is not read by `set`, in words: the base game or the mod not read, or the layers
 * that are.
 */
function layerRefusal(set: SourceSet, layer: string, layers: readonly string[]): string {
    const what = layers.length === 0 ? 'nothing is read' : `the layers are ${listed(layers)}`;
    if (layer === SOURCE_MOD_LAYER && !set.mod) {
        return `mod is not a layer read here: no mod is read; ${what}`;
    }
    if (layer !== SOURCE_MOD_LAYER && set.gameDir === null) {
        return set.mod
            ? `${layer} is not a layer read here: the base game is not read, so the only layer is mod`
            : `${layer} is not a layer read here: neither the base game nor a mod is read`;
    }
    return `${layer} is not a layer read here; ${what}`;
}

/**
 * The lines around a place of a file `set` reads, as every surface shows them: checked (each
 * argument's form first, then the layer, the file and the line), read and decoded as the index
 * reads the file, bounded by the limits above. Throws `SourceRefused` naming the argument and
 * the kind of refusal.
 */
export function readSource(set: SourceSet, place: SourcePlace): SourceExcerpt {
    const { line } = place;
    const endLine = place.endLine ?? line;
    const context = place.context ?? SOURCE_DEFAULT_CONTEXT;
    if (!isWhole(line) || line < 1) {
        badForm('line', `${String(line)} is not a line number; give a whole number from 1`);
    }
    if (!isWhole(endLine) || endLine < 1) {
        badForm('end_line', `${String(endLine)} is not a line number; give a whole number from 1`);
    }
    if (!isWhole(context) || context < 0 || context > SOURCE_MAX_CONTEXT) {
        badForm(
            'context',
            `${String(context)} is not a number of lines from 0 to ${String(SOURCE_MAX_CONTEXT)}`,
        );
    }
    if (endLine < line) {
        badForm(
            'end_line',
            `${String(endLine)} is before line ${String(line)}; give the last line of the place, or leave it out`,
        );
    }
    checkGivenPath(place.file);
    const layers = sourceLayers(set);
    if (!layers.includes(place.layer)) {
        throw new SourceRefused(layerRefusal(set, place.layer, layers), 'layer', 'place');
    }
    const text = readListedFile(set.decoder, findListedFile(set.listings, place.layer, place.file));
    const count = text.lines.length;
    if (line > count) {
        throw new SourceRefused(
            `${String(line)} is past the end of ${place.file}, which has ${String(count)} lines`,
            'line',
            'place',
        );
    }
    const { from, to, placeCut } = shownLines(line, endLine, context, count);
    const rows = text.lines.slice(from - 1, to).map((t, i) => ({
        n: from + i,
        ...shownLine(from + i, t),
        length: t.length,
    }));
    // As many lines as fit the room, written as JSON strings in an array; at least one, which a
    // line cut after `SOURCE_MAX_LINE_CHARACTERS` always is.
    let used = 2;
    let taken = 0;
    for (const row of rows) {
        const size = JSON.stringify(row.shown).length + (taken === 0 ? 0 : 1);
        if (taken > 0 && used + size > SOURCE_TEXT_ROOM) {
            break;
        }
        used += size;
        taken++;
    }
    const kept = rows.slice(0, taken);
    const last = kept.at(-1);
    const shownTo = last?.n ?? from;
    const notes: string[] = [];
    if (placeCut) {
        notes.push(
            `the place is longer than ${String(SOURCE_MAX_LINES)} lines: lines ${String(from)} to ${String(to)} are shown; ask again with line ${String(to + 1)} for the rest`,
        );
    }
    if (endLine > count) {
        notes.push(
            `the place ends at line ${String(endLine)}, past the end of the file, which has ${String(count)} lines`,
        );
    }
    if (taken < rows.length) {
        notes.push(
            `lines ${String(shownTo + 1)} to ${String(to)} are left out to keep the result small; ask again with line ${String(shownTo + 1)}`,
        );
    }
    return {
        layer: text.layer,
        file: text.path,
        from,
        to: shownTo,
        lastLength: last?.length ?? 0,
        lines: kept.map((r) => r.shown),
        lineCount: count,
        cutLines: kept.filter((r) => r.cut).map((r) => r.n),
        encoding: text.validUtf8
            ? 'utf-8'
            : `not valid UTF-8, read as ${text.encoding === 'utf-8' ? 'UTF-8 with replacement characters' : text.encoding}`,
        notes,
    };
}
