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
import { catalogueFromSpec, findingMessage, type MessageCatalogue } from '../syntax/findings.js';
import { parse } from '../syntax/parser.js';
import { readScript } from '../syntax/read.js';
import {
    CHECK_KINDS,
    checkMessage,
    isAdvice,
    type CheckCode,
    type CheckFinding,
} from './finding.js';
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
 * True for a finding of the family `style`, pychivalry's own best-practice rules: like the
 * advice checks, they are tested on their own fixture pairs, so the helpers below leave them out
 * of every other check's findings unless asked (`style: true`); the runner's own tests keep them.
 */
export function isStyle(code: string): boolean {
    return code.startsWith('style/');
}

/**
 * A fixture mod under `fixtures/mods/`, with every check run on each of its script and
 * localization files: indexed on its own, or over a game stub under `fixtures/game/` (`game`),
 * which the checks that need a base game read as the base game. `localization/unused-key` runs
 * unless `unusedKeys` is false, as in the runner; the best-practice rules of the family `style`
 * only with `style` (`isStyle`).
 */
export function checkFixture(
    mod: string,
    options: {
        readonly game?: string;
        readonly unusedKeys?: boolean;
        readonly style?: boolean;
    } = {},
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
        const script = file.path.endsWith('.yml')
            ? null
            : readScript(bytes, { catalogue: messages });
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
                  parsed: script ?? readScript(bytes, { catalogue: messages }),
                  names,
                  catalogue: messages,
                  index: { workspace: index, layer: 'mod' },
                  invalid:
                      script?.allFindings.find((n) => n.id === 'encoding/not-utf8')?.invalid ?? [],
              });
        // The decoder's note on a file that is not valid UTF-8, as the runner reports it.
        for (const note of script?.allFindings.filter((n) => n.id === 'encoding/not-utf8') ?? []) {
            out.push({
                file: file.path,
                line: note.range.start.line + 1,
                column: note.range.start.character + 1,
                code: note.id,
                severity: note.severity,
                message: findingMessage(note, { file: file.path }),
                data: {},
            });
        }
        for (const f of found.filter((x) => options.style === true || !isStyle(x.code))) {
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

/**
 * A best-practice rule's fixture pair as its `expected.json` lists it: the findings of the
 * family `style` and of every check with the game's evidence, the advice checks of item 4.7
 * left out (each is tested on its own pair), as the runner's pair test keeps them.
 */
export function styleFixture(
    mod: string,
    options: { readonly game?: string } = {},
): WrittenFinding[] {
    return checkFixture(mod, { ...options, style: true }).filter(
        (f) => !(f.code in CHECK_KINDS && isAdvice(f.code as CheckCode)),
    );
}

/** The findings a fixture's `expected.json` lists. */
export function expectedFindings(mod: string): WrittenFinding[] {
    const file = path.join(REPO_ROOT, 'fixtures', 'mods', mod, 'expected.json');
    return (JSON.parse(readFileSync(file, 'utf8')) as { findings: WrittenFinding[] }).findings;
}

/**
 * Every check run on text given in a test, as if it were the file at `file` in a mod; `more`
 * gives the checks that need the base game what the index would (`WorkspaceNames`). The
 * best-practice rules of the family `style` only with `style`, as in `checkFixture`.
 */
export function checkText(
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
    more: Partial<WorkspaceNames> = {},
    options: { readonly style?: boolean } = {},
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
    }).filter((f) => options.style === true || !isStyle(f.code));
}
