/**
 * Helpers for the index's tests: the repository's committed spec folder list and stand-in
 * rules table, and an index built from a fixture game stub and a fixture mod. Not part of the
 * package's public surface.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpec } from '../spec/reader.js';
import { FolderTable, foldersFromSpec } from './folders.js';
import { indexFiles, indexMod, installFolders, listInstall } from './read-game.js';
import { readRulesTable, rulesFor, type Platform, type RulesTable } from './rules.js';
import { WorkspaceIndex } from './workspace.js';

/** The repository root: compiled tests live in `packages/core/dist/index/`. */
export const REPO = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

/** A path inside the repository, from `/`-separated parts. */
export function repoPath(relative: string): string {
    return path.join(REPO, ...relative.split('/'));
}

/**
 * The committed spec package file, parsed: `spec/ck3-spec-<version>.json.gz`, read and checked
 * by the spec reader once per test process.
 */
export function committedSpecPackage(): unknown {
    return openSpec(repoPath('spec')).data;
}

let folders: FolderTable | undefined;

/** The folder list of the committed spec package. */
export function specFolders(): FolderTable {
    folders ??= new FolderTable(foldersFromSpec(committedSpecPackage()));
    return folders;
}

/** The committed stand-in rules table, checked. */
export function standInRules(): RulesTable {
    return readRulesTable(JSON.parse(readFileSync(repoPath('spec/override-rules.json'), 'utf8')));
}

/** A row's base fields, for rows written by a test: they are no statement about the game. */
export const TEST_ROW = {
    platforms: ['linux', 'windows'],
    evidence: [
        {
            rank: 5,
            source: 'a test',
            where: 'packages/core/src/index',
            says: 'Written for a test of the table; no statement of how the game works.',
        },
    ],
} as const;

/** The base game of a fixture stub, indexed with a table and a platform. */
export function stubIndex(
    stub: string,
    options: { rules?: RulesTable; platform?: Platform | undefined } = {},
): WorkspaceIndex {
    const rules = options.rules ?? standInRules();
    const platform = 'platform' in options ? options.platform : 'linux';
    const gameDir = repoPath(`fixtures/game/${stub}/game`);
    const listing = listInstall(
        installFolders(gameDir),
        specFolders(),
        platform === undefined ? [] : rulesFor(rules, platform),
    );
    return indexFiles(listing.files, { folders: specFolders(), rules, platform });
}

/** A fixture mod indexed over a fixture stub. */
export function fixtureIndex(
    stub: string,
    mod: string,
    options: { rules?: RulesTable; platform?: Platform | undefined } = {},
): WorkspaceIndex {
    const index = stubIndex(stub, options);
    indexMod(index, repoPath(`fixtures/mods/${mod}`));
    return index;
}
