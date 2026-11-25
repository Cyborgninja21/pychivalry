/**
 * The base-game parse suite, `task game:parse` (docs/PLAN.md item 2.8). It parses every
 * script file in an explicit list of folders and extensions, each with the number of files
 * expected there, times the parse, and lists every parse error with its classification from
 * `tools/data/parse-classifications.json`. It also measures how every text file of the game
 * is encoded, which is the evidence behind docs/encoding.md.
 *
 * It passes when every folder holds the files expected, every file yields a tree, and every
 * error is classified as a defect of the game's own files: an error without a classification,
 * a classification that matches no error, and a pychivalry fault each fail it.
 *
 * Since build step 8 it also runs the formatter's round trip (item 8.3, `round-trip.ts`) over
 * every file it parses, and over the game's localization files: a file whose tree, tokens or
 * comments the formatter changes, or that a second format changes, fails it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
    decodeWindows1252,
    findingMessage,
    invalidUtf8,
    readScript,
    tokenize,
    type Finding,
    type FolderTable,
    type MessageCatalogue,
} from '@pychivalry/core';
import { RoundTrip, type RoundTripResults } from './round-trip.js';
import { CommandError, EXIT, isObject, readJson } from './util.js';

/** A folder of the game the suite reads, with the evidence that it holds script. */
export interface SuiteFolder {
    /** The folder, relative to the game folder, with `/`. */
    readonly folder: string;
    readonly extension: string;
    /** How many files the folder holds with that extension, less the excluded ones. */
    readonly expected: number;
    readonly why: string;
    /**
     * Files in the folder that are not script, each with the reason, beyond those the spec
     * package names (`runParseSuite`'s `notScript`): for a folder list written for a test.
     */
    readonly excluded?: readonly { readonly file: string; readonly why: string }[];
}

/**
 * What the suite reads in game 1.21.0.3. Evidence that a folder holds script the game loads:
 * the spec's directory list (`directories[].path`), the game's own `paths.settings` and
 * `checksum_manifest.txt`, and the DLC folders, which repeat the game's own layout. The files
 * of these folders that are not script are the spec package's to name (format 9,
 * `directories[].files.not_script`: `gfx/models/buildings/naming.txt`, `sound/GUIDs.txt`), and
 * the counts expected leave them out.
 */
export const BASE_GAME_FOLDERS: readonly SuiteFolder[] = [
    {
        folder: 'common',
        extension: '.txt',
        expected: 3035,
        why: 'Database records; release 2.3.0 read it; the spec lists 196 folders under it.',
    },
    {
        folder: 'events',
        extension: '.txt',
        expected: 610,
        why: 'Events; release 2.3.0 read it; in the spec.',
    },
    {
        folder: 'history',
        extension: '.txt',
        expected: 837,
        why: 'History; release 2.3.0 read it; the spec lists 10 folders under it.',
    },
    {
        folder: 'gfx',
        extension: '.txt',
        expected: 271,
        why: 'The spec lists 30 folders under it (coats of arms, court scenes, map styles, portraits and more); paths.settings points into it.',
    },
    {
        folder: 'map_data',
        extension: '.txt',
        expected: 8,
        why: "In the spec (map_data/geographical_regions) and in the game's checksum manifest.",
    },
    {
        folder: 'music',
        extension: '.txt',
        expected: 3,
        why: 'In the spec; paths.settings names music/music_player_categories.',
    },
    {
        folder: 'sound',
        extension: '.txt',
        expected: 8,
        why: 'In the spec; paths.settings names sound/map/ambience.',
    },
    {
        folder: 'dlc',
        extension: '.txt',
        expected: 44,
        why: "The DLC's own files, in the game's layout (dlc/<pack>/music, dlc/<pack>/gfx and so on).",
    },
    {
        folder: 'data_binding',
        extension: '.txt',
        expected: 22,
        why: "In the game's checksum manifest: data-binding macros, in script syntax.",
    },
    {
        folder: 'content_source/map_objects',
        extension: '.txt',
        expected: 16,
        why: 'paths.settings names content_source/map_objects/generators and masks.',
    },
];

/** Text files the suite does not parse, and why. Recorded so a reader sees the whole game. */
export const NOT_READ: readonly { readonly what: string; readonly why: string }[] = [
    { what: 'gui/**/*.gui', why: 'GUI syntax: its own parser and suite, build step 10.' },
    { what: 'localization/**/*.yml', why: 'Localization files: read by the index, build step 3.' },
    { what: '**/*.asset', why: '.asset files come after the MVP (docs/MVP.md, "Not in the MVP").' },
    {
        what: '**/*.info',
        why: "Paradox's documentation files: prose with examples, not loaded as script.",
    },
    { what: '**/*.shader, **/*.gfx, **/*.settings', why: 'Shaders and engine settings.' },
    { what: 'fonts/, licenses/, credits.txt', why: 'Licences and credits: prose.' },
    {
        what: 'tests/, tools/, notifications/, dlc_metadata/, content_source/TODO.txt, the other .txt files at the top of the game folder',
        why: 'Nothing in the spec or the game settings names them as script the game loads.',
    },
];

/** The extensions of the text files the encoding measurement covers. */
export const TEXT_EXTENSIONS: readonly string[] = [
    '.txt',
    '.gui',
    '.yml',
    '.info',
    '.asset',
    '.gfx',
    '.shader',
    '.settings',
    '.mod',
];

export type Classification = 'game-defect' | 'pychivalry-fault';

export interface ClassificationEntry {
    readonly file: string;
    readonly id: string;
    readonly line: number;
    readonly classification: Classification;
    readonly reason: string;
}

/** Read the classification file: a list of `{ file, id, line, classification, reason }`. */
export function readClassifications(file: string): ClassificationEntry[] {
    const data = readJson(file);
    const list = isObject(data) ? data['classifications'] : undefined;
    if (!Array.isArray(list)) {
        throw new CommandError(`${path.basename(file)} has no classifications list`, EXIT.usage);
    }
    return list.map((entry: unknown, n) => {
        if (
            !isObject(entry) ||
            typeof entry['file'] !== 'string' ||
            typeof entry['id'] !== 'string' ||
            typeof entry['line'] !== 'number' ||
            (entry['classification'] !== 'game-defect' &&
                entry['classification'] !== 'pychivalry-fault') ||
            typeof entry['reason'] !== 'string' ||
            entry['reason'] === ''
        ) {
            throw new CommandError(
                `${path.basename(file)}: classification ${String(n + 1)} is not { file, id, line, classification, reason }`,
                EXIT.usage,
            );
        }
        return {
            file: entry['file'],
            id: entry['id'],
            line: entry['line'],
            classification: entry['classification'],
            reason: entry['reason'],
        };
    });
}

/** Every regular file under `dir`, relative to `base` with `/`, sorted. */
function filesUnder(base: string, dir: string): string[] {
    const out: string[] = [];
    const walk = (at: string): void => {
        for (const entry of readdirSync(at, { withFileTypes: true })) {
            const full = path.join(at, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile()) {
                out.push(path.relative(base, full).split(path.sep).join('/'));
            }
        }
    };
    walk(dir);
    return out.sort();
}

function round(ms: number): number {
    return Math.round(ms);
}

export interface FolderResult {
    folder: string;
    extension: string;
    expected_files: number;
    files: number;
    trees: number;
    bom: number;
    not_utf8: number;
    errors: number;
    parse_ms: number;
    why: string;
    excluded: { file: string; why: string }[];
}

export interface ErrorResult {
    file: string;
    line: number;
    column: number;
    id: string;
    catalogue: string | null;
    message: string;
    classification: Classification | 'unclassified';
    reason: string;
}

export interface NoteResult {
    file: string;
    line: number;
    column: number;
    id: string;
    message: string;
}

export interface EncodingResult {
    extensions: string[];
    files: number;
    bom: number;
    utf16_bom: number;
    not_utf8: number;
    line_endings: { lf: number; crlf: number; cr: number; mixed: number; none: number };
    by_folder: {
        folder: string;
        extension: string;
        files: number;
        bom: number;
        not_utf8: number;
    }[];
    not_utf8_files: {
        file: string;
        invalid_bytes: number;
        first_line: number;
        in_comments: number;
        in_strings: number;
        elsewhere: number;
        valid_multibyte_sequences: number;
    }[];
}

export interface ParseSuiteResults {
    passed: boolean;
    failures: string[];
    files: number;
    trees: number;
    parse_ms: number;
    folders: FolderResult[];
    errors: ErrorResult[];
    notes: NoteResult[];
    not_read: { what: string; why: string }[];
    encoding: EncodingResult;
    /** The formatter's round trip over every file parsed (item 8.3). */
    round_trip: RoundTripResults;
    /** The same over the game's localization files. */
    round_trip_localization: RoundTripResults;
}

/** Where each invalid UTF-8 byte of a file sits: in a comment, quoted text, or elsewhere. */
function invalidByteSites(bytes: Uint8Array): {
    comments: number;
    strings: number;
    elsewhere: number;
    multibyte: number;
} {
    // Decoded as Windows-1252 every byte is one character, so offsets are byte offsets.
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const body = bom ? bytes.subarray(3) : bytes;
    const tokens = tokenize(decodeWindows1252(body));
    const bad: number[] = [];
    let multibyte = 0;
    for (let i = 0; i < body.length;) {
        const byte = body[i] ?? 0;
        if (byte < 0x80) {
            i++;
            continue;
        }
        // Reuse the decoder's own rules on a window: a valid sequence has no invalid bytes.
        const window = body.subarray(i, Math.min(body.length, i + 4));
        const invalid = invalidUtf8(window);
        if (invalid.first === 0) {
            bad.push(i);
            i++;
            continue;
        }
        multibyte++;
        i += byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : 2;
    }
    let comments = 0;
    let strings = 0;
    let t = 0;
    for (const at of bad) {
        while (t < tokens.length && (tokens[t]?.end ?? 0) <= at) {
            t++;
        }
        const token = tokens[t];
        if (token !== undefined && token.start <= at && at < token.end) {
            if (token.kind === 'comment') {
                comments++;
            } else if (token.kind === 'string') {
                strings++;
            }
        }
    }
    return { comments, strings, elsewhere: bad.length - comments - strings, multibyte };
}

/** How every text file of the game is encoded (docs/encoding.md). */
export function measureEncoding(gameDir: string): EncodingResult {
    const byFolder = new Map<string, { files: number; bom: number; not_utf8: number }>();
    const result: EncodingResult = {
        extensions: [...TEXT_EXTENSIONS],
        files: 0,
        bom: 0,
        utf16_bom: 0,
        not_utf8: 0,
        line_endings: { lf: 0, crlf: 0, cr: 0, mixed: 0, none: 0 },
        by_folder: [],
        not_utf8_files: [],
    };
    const strict = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    for (const rel of filesUnder(gameDir, gameDir)) {
        const extension = path.extname(rel).toLowerCase();
        if (!TEXT_EXTENSIONS.includes(extension)) {
            continue;
        }
        const top = rel.includes('/') ? (rel.split('/')[0] ?? '') : '(top level)';
        const key = `${top}\t${extension}`;
        const row = byFolder.get(key) ?? { files: 0, bom: 0, not_utf8: 0 };
        byFolder.set(key, row);
        const bytes = readFileSync(path.join(gameDir, ...rel.split('/')));
        result.files++;
        row.files++;
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
            result.bom++;
            row.bom++;
        }
        if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
            result.utf16_bom++;
        }
        let crlf = 0;
        let lf = 0;
        let cr = 0;
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] === 13) {
                if (bytes[i + 1] === 10) {
                    crlf++;
                    i++;
                } else {
                    cr++;
                }
            } else if (bytes[i] === 10) {
                lf++;
            }
        }
        const kinds = Number(crlf > 0) + Number(lf > 0) + Number(cr > 0);
        if (kinds === 0) {
            result.line_endings.none++;
        } else if (kinds > 1) {
            result.line_endings.mixed++;
        } else if (crlf > 0) {
            result.line_endings.crlf++;
        } else if (lf > 0) {
            result.line_endings.lf++;
        } else {
            result.line_endings.cr++;
        }
        const body =
            bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
        try {
            strict.decode(body);
        } catch {
            result.not_utf8++;
            row.not_utf8++;
            const invalid = invalidUtf8(body);
            const sites = invalidByteSites(bytes);
            const firstLine =
                body.subarray(0, invalid.first).reduce((n, b) => (b === 10 ? n + 1 : n), 0) + 1;
            result.not_utf8_files.push({
                file: rel,
                invalid_bytes: invalid.bytes,
                first_line: firstLine,
                in_comments: sites.comments,
                in_strings: sites.strings,
                elsewhere: sites.elsewhere,
                valid_multibyte_sequences: sites.multibyte,
            });
        }
    }
    result.by_folder = [...byFolder.entries()]
        .map(([key, row]) => {
            const [folder = '', extension = ''] = key.split('\t');
            return { folder, extension, ...row };
        })
        .sort((a, b) =>
            a.folder === b.folder
                ? a.extension.localeCompare(b.extension)
                : a.folder.localeCompare(b.folder),
        );
    return result;
}

/** Match an error to its classification by file, finding id and line. */
function classify(
    error: { file: string; id: string; line: number },
    classifications: readonly ClassificationEntry[],
): ClassificationEntry | undefined {
    return classifications.find(
        (c) => c.file === error.file && c.id === error.id && c.line === error.line,
    );
}

/**
 * Why the spec package says a file of the game folder is no script (format 9,
 * `directories[].files.not_script`, read with the folder table), in words a record can hold:
 * the entry's own `what`, the file or pattern it names and its status; or undefined.
 */
export function notScriptOf(folders: FolderTable): (file: string) => string | undefined {
    return (file) => {
        const status = folders.scriptStatus(file);
        if (status === undefined || status.script) {
            return undefined;
        }
        if (status.rule === null) {
            return `Not script: the spec package says the reader of ${status.folder} takes other extensions (directories[].files).`;
        }
        return `Not script, the spec package says (${status.folder}, not_script ${status.rule.written}, ${status.rule.status}): ${status.rule.what}`;
    };
}

/** Run the parse suite on a game folder. */
export function runParseSuite(
    gameDir: string,
    options: {
        catalogue: MessageCatalogue;
        classifications: readonly ClassificationEntry[];
        folders?: readonly SuiteFolder[];
        /**
         * Why the spec package says a file is no script (format 9, `directories[].files`), or
         * undefined when it does not: such a file is not parsed, and is listed as excluded.
         */
        notScript?: (file: string) => string | undefined;
    },
): ParseSuiteResults {
    const folders = options.folders ?? BASE_GAME_FOLDERS;
    const failures: string[] = [];
    const errors: ErrorResult[] = [];
    const notes: NoteResult[] = [];
    const folderResults: FolderResult[] = [];
    let files = 0;
    let trees = 0;
    let parseMs = 0;
    const roundTrip = new RoundTrip('script');
    for (const entry of folders) {
        const dir = path.join(gameDir, ...entry.folder.split('/'));
        const all = (
            statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true
                ? filesUnder(gameDir, dir)
                : []
        ).filter((rel) => path.extname(rel).toLowerCase() === entry.extension);
        const excludedList = [...(entry.excluded ?? [])];
        for (const rel of all) {
            const why = options.notScript?.(rel);
            if (why !== undefined && !excludedList.some((e) => e.file === rel)) {
                excludedList.push({ file: rel, why });
            }
        }
        const excluded = new Set(excludedList.map((e) => e.file));
        const list = all.filter((rel) => !excluded.has(rel));
        const row: FolderResult = {
            folder: entry.folder,
            extension: entry.extension,
            expected_files: entry.expected,
            files: list.length,
            trees: 0,
            bom: 0,
            not_utf8: 0,
            errors: 0,
            parse_ms: 0,
            why: entry.why,
            excluded: excludedList.map((e) => ({ file: e.file, why: e.why })),
        };
        if (list.length !== entry.expected) {
            failures.push(
                `${entry.folder} holds ${String(list.length)} ${entry.extension} files; ${String(entry.expected)} are expected`,
            );
        }
        for (const rel of list) {
            const bytes = readFileSync(path.join(gameDir, ...rel.split('/')));
            const started = performance.now();
            let findings: readonly Finding[];
            let parsed: ReturnType<typeof readScript>;
            try {
                const file = readScript(bytes, { catalogue: options.catalogue });
                findings = file.findings;
                row.trees++;
                parsed = file;
                if (file.bom) {
                    row.bom++;
                }
                if (!file.validUtf8) {
                    row.not_utf8++;
                }
            } catch (err) {
                failures.push(`${rel} yielded no tree: ${(err as Error).message}`);
                continue;
            } finally {
                row.parse_ms += performance.now() - started;
            }
            // The formatter's round trip, timed apart from the parse.
            roundTrip.add(rel, (parsed.bom ? '\uFEFF' : '') + parsed.text);
            for (const finding of findings) {
                const line = finding.range.start.line + 1;
                const column = finding.range.start.character + 1;
                const message = findingMessage(finding, { file: rel });
                if (finding.severity !== 'error') {
                    notes.push({ file: rel, line, column, id: finding.id, message });
                    continue;
                }
                row.errors++;
                const match = classify(
                    { file: rel, id: finding.id, line },
                    options.classifications,
                );
                errors.push({
                    file: rel,
                    line,
                    column,
                    id: finding.id,
                    catalogue: finding.evidence.kind === 'catalogue' ? finding.evidence.id : null,
                    message,
                    classification: match?.classification ?? 'unclassified',
                    reason: match?.reason ?? '',
                });
            }
        }
        files += row.files;
        trees += row.trees;
        parseMs += row.parse_ms;
        row.parse_ms = round(row.parse_ms);
        folderResults.push(row);
    }
    for (const error of errors) {
        if (error.classification === 'unclassified') {
            failures.push(`unclassified error: ${error.file}:${String(error.line)} ${error.id}`);
        } else if (error.classification === 'pychivalry-fault') {
            failures.push(`pychivalry fault: ${error.file}:${String(error.line)} ${error.id}`);
        }
    }
    for (const c of options.classifications) {
        if (!errors.some((e) => e.file === c.file && e.id === c.id && e.line === c.line)) {
            failures.push(`classification matches no error: ${c.file}:${String(c.line)} ${c.id}`);
        }
    }
    // The formatter's round trip, the parse timed apart from it.
    const round_trip = roundTrip.done();
    const localization = new RoundTrip('localization');
    const locDir = path.join(gameDir, 'localization');
    if (statSync(locDir, { throwIfNoEntry: false })?.isDirectory() === true) {
        for (const rel of filesUnder(gameDir, locDir)) {
            if (path.extname(rel).toLowerCase() === '.yml') {
                const bytes = readFileSync(path.join(gameDir, ...rel.split('/')));
                localization.add(rel, new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes));
            }
        }
    }
    const round_trip_localization = localization.done();
    failures.push(...round_trip.failures.map((f) => `round trip: ${f}`));
    failures.push(...round_trip_localization.failures.map((f) => `round trip: ${f}`));
    return {
        passed: failures.length === 0,
        failures,
        files,
        trees,
        parse_ms: round(parseMs),
        folders: folderResults,
        errors,
        notes,
        not_read: NOT_READ.map((n) => ({ what: n.what, why: n.why })),
        encoding: measureEncoding(gameDir),
        round_trip,
        round_trip_localization,
    };
}
