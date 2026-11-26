/**
 * Helpers for the index's tests: the committed spec package's folder list and rules table
 * (part D1), and an index built from a fixture game stub and a fixture mod. Not part of the
 * package's public surface.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpec } from '../spec/reader.js';
import { folderTableFromSpec, type FolderTable } from './folders.js';
import {
    indexFiles,
    indexMod,
    installFolders,
    installLayersOf,
    listInstall,
    setUnreadFilesOf,
} from './read-game.js';
import { decidingRules, rulesFromSpec, type Platform, type RulesTable } from './rules.js';
import type { WorkspaceIndex } from './workspace.js';

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
    folders ??= folderTableFromSpec(committedSpecPackage());
    return folders;
}

let rules: RulesTable | undefined;

/** The committed spec package's rules table (part D1), checked. */
export function packageRules(): RulesTable {
    rules ??= rulesFromSpec(openSpec(repoPath('spec')));
    return rules;
}

/** A row's base fields, for rows written by a test: they are no statement about the game. */
export const TEST_ROW = {
    platforms: ['linux', 'windows'],
    status: 'settled',
    platform_basis: {
        linux: { basis: 'read', text: 'a test' },
        windows: { basis: 'read', text: 'a test' },
    },
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
    const table = options.rules ?? packageRules();
    const platform = 'platform' in options ? options.platform : 'linux';
    const gameDir = repoPath(`fixtures/game/${stub}/game`);
    const install = installFolders(gameDir);
    const listing = listInstall(
        install,
        specFolders(),
        platform === undefined ? [] : decidingRules(table, platform),
    );
    const index = indexFiles(listing.files, { folders: specFolders(), rules: table, platform });
    setUnreadFilesOf(index, listing, installLayersOf(install, listing));
    return index;
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
