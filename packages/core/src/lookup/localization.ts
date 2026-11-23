/**
 * Localization text for lookup, read through the index: the index says where a key is defined
 * (database `localization:<language>`) and which copy is in force; the text is read from the
 * file itself, through a file source the caller gives (the command line and the servers read
 * the game's and the mod's folders; an editor may hand over the text of an open file).
 */

import { readFileSync } from 'node:fs';
import { localizationDatabase } from '../index/extract.js';
import {
    parseLocalization,
    readLocalization,
    type LocalizationFile,
} from '../index/localization.js';
import type { SourceListing } from '../index/read-game.js';
import type { Definition, Resolution, WorkspaceIndex } from '../index/workspace.js';
import type { LocalizationTextAnswer } from './types.js';

/** The content of an indexed file, by its layer and path; undefined when it cannot be read. */
export type FileSource = (layer: string, path: string) => Uint8Array | string | undefined;

/** A file source over the files of the listings an index was built from, read from disk. */
export function diskFileSource(listings: readonly SourceListing[]): FileSource {
    const disk = new Map<string, string>();
    for (const listing of listings) {
        for (const file of listing.files) {
            disk.set(`${file.layer}\u0000${file.path}`, file.disk);
        }
    }
    return (layer, path) => {
        const at = disk.get(`${layer}\u0000${path}`);
        if (at === undefined) {
            return undefined;
        }
        try {
            return readFileSync(at);
        } catch {
            return undefined;
        }
    };
}

const DATABASE_PREFIX = localizationDatabase('');

/** The language of a localization database (`localization:l_english`), or null for another. */
export function languageOf(database: string): string | null {
    if (database === localizationDatabase(null)) {
        return '';
    }
    return database.startsWith(DATABASE_PREFIX) ? database.slice(DATABASE_PREFIX.length) : null;
}

/** Whether two definitions are the same one: the same layer, file and place. */
function same(a: Definition, b: Definition): boolean {
    return a.layer === b.layer && a.file === b.file && a.start === b.start;
}

/** Whether a definition is the one in force, by what the index resolved for its group. */
export function inForceOf(
    definition: Definition,
    resolution: Resolution,
): 'yes' | 'no' | 'not-known' {
    switch (resolution.status) {
        case 'single':
        case 'winner':
            return same(resolution.winner, definition) ? 'yes' : 'no';
        case 'all':
        case 'statements':
            return definition.read === 'no' ? 'no' : 'yes';
        case 'not-read':
        case 'not-defined':
            return 'no';
        case 'clash':
        case 'unknown':
            return definition.read === 'no' ? 'no' : 'not-known';
    }
}

/** Reads localization files for one lookup, each file once. */
export class LocalizationReader {
    private readonly files: FileSource;
    private readonly parsed = new Map<string, LocalizationFile | null>();

    constructor(files: FileSource) {
        this.files = files;
    }

    private fileOf(layer: string, path: string): LocalizationFile | null {
        const key = `${layer}\u0000${path}`;
        const known = this.parsed.get(key);
        if (known !== undefined) {
            return known;
        }
        const content = this.files(layer, path);
        const file =
            content === undefined
                ? null
                : typeof content === 'string'
                  ? parseLocalization(content)
                  : readLocalization(content);
        this.parsed.set(key, file);
        return file;
    }

    /** The text of a localization definition, between its quotes; null when it cannot be read. */
    textOf(definition: Definition): string | null {
        const file = this.fileOf(definition.layer, definition.file);
        const entry = file?.entries.find(
            (e) => e.start === definition.start && e.key === definition.name,
        );
        return entry === undefined || file === null
            ? null
            : file.text.slice(entry.textStart, entry.textEnd);
    }

    /**
     * Every definition of a localization key in the index, in every language or in the one
     * given (as its file's header names it, `l_english`), with its text and whether it is the
     * copy in force.
     */
    texts(index: WorkspaceIndex, key: string, language: string | null): LocalizationTextAnswer[] {
        const out: LocalizationTextAnswer[] = [];
        const byDatabase = new Map<string, Definition[]>();
        for (const definition of index.definitions(key)) {
            const lang = languageOf(definition.database);
            if (lang === null || (language !== null && lang !== language)) {
                continue;
            }
            byDatabase.set(definition.database, [
                ...(byDatabase.get(definition.database) ?? []),
                definition,
            ]);
        }
        for (const [database, definitions] of byDatabase) {
            const resolution = index.resolve(database, key, null);
            for (const definition of definitions) {
                out.push({
                    language: languageOf(database) ?? '',
                    text: this.textOf(definition),
                    layer: definition.layer,
                    file: definition.file,
                    range: definition.range,
                    inForce: inForceOf(definition, resolution),
                });
            }
        }
        return out;
    }
}
