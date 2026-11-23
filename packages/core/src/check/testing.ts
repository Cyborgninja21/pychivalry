/**
 * Helpers for the checks' tests: a fixture mod indexed on its own and every engine check run
 * on each of its script files, with the committed spec. Not part of the package's surface.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { folderTableFromSpec, type FolderTable } from '../index/folders.js';
import { indexMod } from '../index/read-game.js';
import { rulesFromSpec } from '../index/rules.js';
import { WorkspaceIndex } from '../index/workspace.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { catalogueFromSpec, type MessageCatalogue } from '../syntax/findings.js';
import { parse } from '../syntax/parser.js';
import { readScript } from '../syntax/read.js';
import { checkMessage, type CheckFinding } from './finding.js';
import { checkFile } from './index.js';
import { definedNamesOf } from './names.js';

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

/** A fixture mod under `fixtures/mods/`, indexed on its own, with every check run on it. */
export function checkFixture(mod: string): WrittenFinding[] {
    const spec = committedSpec();
    const { folders: table, catalogue: messages } = specContext();
    const rules = rulesFromSpec(spec);
    const index = new WorkspaceIndex({ folders: table, rules, platform: 'linux' });
    const listing = indexMod(index, path.join(REPO_ROOT, 'fixtures', 'mods', mod));
    const names = definedNamesOf(index);
    const out: WrittenFinding[] = [];
    for (const file of listing.files) {
        if (!file.path.endsWith('.txt')) {
            continue;
        }
        const parsed = readScript(readFileSync(file.disk), { catalogue: messages });
        for (const f of checkFile({
            spec,
            folders: table,
            file: file.path,
            parsed,
            names,
            catalogue: messages,
        })) {
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

/** Every check run on text given in a test, as if it were the file at `file` in a mod. */
export function checkText(
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
): CheckFinding[] {
    const spec = committedSpec();
    const { folders: table, catalogue: messages } = specContext();
    const names = {
        isDefined: (name: string, database: string): boolean =>
            defined[database]?.includes(name) ?? false,
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
