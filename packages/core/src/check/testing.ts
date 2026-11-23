/**
 * Helpers for the checks' tests: a fixture mod indexed on its own and every engine check run
 * on each of its script files, with the committed spec. Not part of the package's surface.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { folderTableFromSpec, type FolderTable } from '../index/folders.js';
import { readLocalization } from '../index/localization.js';
import { indexMod, unreadWords } from '../index/read-game.js';
import { rulesFromSpec } from '../index/rules.js';
import { stubIndex } from '../index/testing.js';
import { WorkspaceIndex } from '../index/workspace.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { catalogueFromSpec, type MessageCatalogue } from '../syntax/findings.js';
import { parse } from '../syntax/parser.js';
import { readScript } from '../syntax/read.js';
import { checkMessage, type CheckFinding } from './finding.js';
import { checkFile, checkLocalizationFile } from './index.js';
import { definedNamesOf, type WorkspaceNames } from './names.js';

/** A finding as a fixture's `expected.json` writes it. */
export interface WrittenFinding {
    readonly file: string;
    readonly line: number;
    readonly column: number;
    readonly code: string;
    readonly severity: string;
    readonly message: string;
    readonly data: CheckFinding['data'];
}

let folders: FolderTable | undefined;
let catalogue: MessageCatalogue | undefined;

/** The committed spec's folder list and catalogue, built once. */
export function specContext(): { folders: FolderTable; catalogue: MessageCatalogue } {
    folders ??= folderTableFromSpec(committedSpec().data);
    catalogue ??= catalogueFromSpec(committedSpec().data);
    return { folders, catalogue };
}

/**
 * The game stub under `fixtures/game/` a check pair is read over, by the pair's name (its code
 * with `/` written as `-`): the checks that stay silent without a base game. A pair not listed
 * is read with none.
 */
export const PAIR_GAMES: Readonly<Record<string, string>> = {
    'scope-undefined-event-target': 'event-targets-and-localization',
    'localization-missing-key': 'event-targets-and-localization',
    'localization-unused-key': 'event-targets-and-localization',
};

/**
 * A fixture mod under `fixtures/mods/`, with every check run on each of its script and
 * localization files: indexed on its own, or over a game stub under `fixtures/game/` (`game`),
 * which the checks that need a base game read as the base game. The checks off by default run
 * only with `unusedKeys`, as in the runner.
 */
export function checkFixture(
    mod: string,
    options: { readonly game?: string; readonly unusedKeys?: boolean } = {},
): WrittenFinding[] {
    const spec = committedSpec();
    const { folders: table, catalogue: messages } = specContext();
    const rules = rulesFromSpec(spec);
    const index =
        options.game === undefined
            ? new WorkspaceIndex({ folders: table, rules, platform: 'linux' })
            : stubIndex(options.game);
    const modDir = path.join(REPO_ROOT, 'fixtures', 'mods', mod);
    const listing = indexMod(index, modDir);
    const names = definedNamesOf(index, { unreadWords: unreadWords(modDir, index) });
    const out: WrittenFinding[] = [];
    for (const file of listing.files) {
        const bytes = readFileSync(file.disk);
        const found = file.path.endsWith('.yml')
            ? checkLocalizationFile({
                  spec,
                  folders: table,
                  file: file.path,
                  parsed: readLocalization(bytes),
                  names,
                  catalogue: messages,
                  unusedKeys: options.unusedKeys,
              })
            : checkFile({
                  spec,
                  folders: table,
                  file: file.path,
                  parsed: readScript(bytes, { catalogue: messages }),
                  names,
                  catalogue: messages,
                  index: { workspace: index, layer: 'mod' },
              });
        for (const f of found) {
            out.push({
                file: file.path,
                line: f.range.start.line + 1,
                column: f.range.start.character + 1,
                code: f.code,
                severity: f.severity,
                message: checkMessage(f, { file: file.path }),
                data: f.data,
            });
        }
    }
    return out.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
    );
}

/** The findings a fixture's `expected.json` lists. */
export function expectedFindings(mod: string): WrittenFinding[] {
    const file = path.join(REPO_ROOT, 'fixtures', 'mods', mod, 'expected.json');
    return (JSON.parse(readFileSync(file, 'utf8')) as { findings: WrittenFinding[] }).findings;
}

/**
 * Every check run on text given in a test, as if it were the file at `file` in a mod; `more`
 * gives the checks that need the base game what the index would (`WorkspaceNames`).
 */
export function checkText(
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
    more: Partial<WorkspaceNames> = {},
): CheckFinding[] {
    const spec = committedSpec();
    const { folders: table, catalogue: messages } = specContext();
    const names = {
        isDefined: (name: string, database: string): boolean =>
            defined[database]?.includes(name) ?? false,
        ...more,
    };
    return checkFile({
        spec,
        folders: table,
        file,
        parsed: parse(text),
        names,
        catalogue: messages,
    });
}
