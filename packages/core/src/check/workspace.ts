/**
 * Every check over a mod: the one code path the command line, the agent server and the
 * language server run, so that all three report the same findings for the same mod
 * (docs/MVP.md, definition of done 4). It reads the mod's files over the base game's index,
 * and runs on each script file the parser and every engine check (`checkFile`, which holds
 * the list of checks); no surface lists checks of its own.
 *
 * - **The files checked** are the mod's script files (`.txt`) and localization files (`.yml`)
 *   in the folders the spec lists: the files the index reads (docs/decisions.md, step 3: a
 *   file in a folder the spec does not list is not read at all). Those in other folders are
 *   counted, by folder, and not checked. A localization file is read as the index reads it,
 *   and its engine checks are those of item 4.6 (`checkLocalizationFile`).
 * - **The base game** is the index `openGameIndex` gives: loaded from the on-disk cache when
 *   it answers for the installed game, otherwise built and saved there (docs/PLAN.md item
 *   5.7), and the mod is indexed over it.
 * - **No game folder:** a name the mod does not define may be one the game defines, which
 *   nothing can tell without the game, so no check reports such a name unknown
 *   (docs/guide/settings.md, "No game folder"; a lesson of release 2.3.0). What does not
 *   depend on the game's files, a parse error or a name of the spec package's own, is still
 *   judged where the checks judge it.
 * - **The base game itself** is checked the same way when no mod is given (`modDir: null`):
 *   every file of the base game's listing, each over the index in its own layer. The
 *   game-file suite `task game:check` runs it so; a surface checks a mod.
 * - **At most `MAX_FINDINGS_PER_FILE` findings per file** (docs/MVP.md, "Lessons from 2.3.0";
 *   docs/PLAN.md item 4.11): past the cap a file keeps its most severe findings first (errors,
 *   then warnings, information, hints; by position within a severity), and what the cap drops
 *   is counted, by code (`WorkspaceCheck.capped`), never lost without a word.
 * - **Each finding** carries its rendered message, so every surface shows the same text.
 * - **Off by default:** `localization/unused-key` runs only with `unusedKeys` (docs/decisions.md,
 *   decision 76); every other check always runs.
 * - **A server** that keeps one workspace open between requests passes it (`workspace`), its
 *   mod brought up to date with `syncMod`, and may check only some of the mod's files (`only`):
 *   every file is still indexed, so a file's findings are those of a whole run.
 */

import { readFileSync } from 'node:fs';
import { folderTableFromSpec, type FolderTable } from '../index/folders.js';
import { openGameIndex, type GameIndex } from '../index/game-index.js';
import { compareCodePoints } from '../index/order.js';
import { readLocalization } from '../index/localization.js';
import { indexMod, unreadWords, type ModListing, type SourceListing } from '../index/read-game.js';
import { currentPlatform, rulesFromSpec, type Platform, type RulesTable } from '../index/rules.js';
import { fileKindOf, WorkspaceIndex } from '../index/workspace.js';
import type { Spec } from '../spec/reader.js';
import type { FallbackEncoding } from '../syntax/decode.js';
import {
    catalogueFromSpec,
    findingMessage,
    type Evidence,
    type MessageCatalogue,
    type Severity,
} from '../syntax/findings.js';
import type { Range } from '../syntax/position.js';
import { readScript } from '../syntax/read.js';
import type { DefinedNames } from './context.js';
import { checkMessage, type FindingData } from './finding.js';
import { checkFile, checkLocalizationFile } from './index.js';
import type { Code } from './inventory.js';
import type { ScopeMeasure } from './measure.js';
import { definedNamesOf, type WorkspaceNames } from './names.js';

/** One finding on a file of a workspace, as every surface reports it. */
export interface WorkspaceFinding {
    /** The file's path inside the mod (or inside its base-game layer), with `/`. */
    readonly file: string;
    /**
     * The index layer the file is in: `mod` for a mod's file; the base game's own layer
     * (`game`, `jomini`, `clausewitz`, `dlc:<pack>`) when the base game itself is checked.
     */
    readonly layer: string;
    readonly code: Code;
    readonly severity: Severity;
    readonly range: Range;
    /** Offsets into the file's decoded text. */
    readonly start: number;
    readonly end: number;
    /** The message, rendered from the spec's catalogue or from the row's own text. */
    readonly message: string;
    readonly evidence: Evidence;
    /** The values and lists the finding is about; empty for a parse finding. */
    readonly data: FindingData;
}

/**
 * The definitions the checks see when no game folder is given: every name may be one the game
 * defines, so none is unknown.
 */
export const GAME_NOT_LOADED: DefinedNames = { isDefined: () => true };

/** What the spec gives every run: its folders, its override rules and its catalogue. */
interface SpecContext {
    readonly folders: FolderTable;
    readonly rules: RulesTable;
    readonly catalogue: MessageCatalogue;
}

const contexts = new WeakMap<Spec, SpecContext>();

function specContext(spec: Spec): SpecContext {
    let context = contexts.get(spec);
    if (context === undefined) {
        context = {
            folders: folderTableFromSpec(spec.data),
            rules: rulesFromSpec(spec),
            catalogue: catalogueFromSpec(spec.data),
        };
        contexts.set(spec, context);
    }
    return context;
}

function compareFindings(a: WorkspaceFinding, b: WorkspaceFinding): number {
    return a.start - b.start || a.end - b.end || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
}

/**
 * The most findings one file reports. Release 2.3.0's editor capped the diagnostics of a file
 * at the same number, the most severe first, so that a file full of hints never hides an
 * error.
 */
export const MAX_FINDINGS_PER_FILE = 1000;

/** The severities, most severe first: the order the cap keeps them in. */
const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
    error: 0,
    warning: 1,
    information: 2,
    hint: 3,
};

/** A file the cap shortened: how many findings it had and what was dropped. */
export interface CappedFile {
    readonly file: string;
    readonly layer: string;
    /** Every finding the checks raised on the file. */
    readonly found: number;
    /** The findings the cap dropped, in all, by severity, and by code and severity. */
    readonly dropped: number;
    readonly droppedBySeverity: Readonly<Record<Severity, number>>;
    readonly droppedByCode: readonly {
        readonly code: Code;
        readonly severity: Severity;
        readonly count: number;
    }[];
}

/**
 * One file's findings under the cap: all of them when they fit, otherwise the `max` most
 * severe (by position within a severity), in the order of where each starts; and what was
 * dropped, or null when nothing was.
 */
export function capFindings(
    findings: readonly WorkspaceFinding[],
    max: number,
): { readonly kept: WorkspaceFinding[]; readonly capped: CappedFile | null } {
    const first = findings[0];
    if (findings.length <= max || first === undefined) {
        return { kept: [...findings], capped: null };
    }
    const ranked = [...findings].sort(
        (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || compareFindings(a, b),
    );
    const kept = ranked.slice(0, max).sort(compareFindings);
    const droppedBySeverity: Record<Severity, number> = {
        error: 0,
        warning: 0,
        information: 0,
        hint: 0,
    };
    const droppedByCode = new Map<string, { code: Code; severity: Severity; count: number }>();
    for (const f of ranked.slice(max)) {
        droppedBySeverity[f.severity]++;
        const key = `${f.code}\u0000${f.severity}`;
        const row = droppedByCode.get(key) ?? { code: f.code, severity: f.severity, count: 0 };
        row.count++;
        droppedByCode.set(key, row);
    }
    return {
        kept,
        capped: {
            file: first.file,
            layer: first.layer,
            found: findings.length,
            dropped: findings.length - max,
            droppedBySeverity,
            droppedByCode: [...droppedByCode.values()],
        },
    };
}

/** The layer of a mod's files in the index (`indexMod`). */
const MOD_LAYER = 'mod';

export interface ScriptInput {
    readonly spec: Spec;
    /** The file's path inside its mod, with `/`. */
    readonly file: string;
    readonly bytes: Uint8Array;
    /**
     * The definitions the checks see (`definedNamesOf`); with the base game, also what the
     * checks of item 4.6 ask the index (`WorkspaceNames`).
     */
    readonly names: DefinedNames & Partial<WorkspaceNames>;
    /**
     * The workspace index that holds the file, and the file's layer in it, for the checks of
     * definitions; without it they report nothing.
     */
    readonly index?: { readonly workspace: WorkspaceIndex; readonly layer: string } | undefined;
    readonly fallbackEncoding?: FallbackEncoding | undefined;
    /** Where to count what the scope checks judged; nothing is counted without it. */
    readonly measure?: ScopeMeasure | undefined;
}

/**
 * Every finding on one script file: the decoder's and the parser's, and every engine
 * check's, in the order of where each starts.
 */
export function scriptFindings(input: ScriptInput): WorkspaceFinding[] {
    const { folders, catalogue } = specContext(input.spec);
    const parsed = readScript(input.bytes, {
        catalogue,
        fallbackEncoding: input.fallbackEncoding,
    });
    const out: WorkspaceFinding[] = [];
    const layer = input.index?.layer ?? MOD_LAYER;
    for (const f of parsed.allFindings) {
        out.push({
            file: input.file,
            layer,
            code: f.id,
            severity: f.severity,
            range: f.range,
            start: f.start,
            end: f.end,
            message: findingMessage(f, { file: input.file }),
            evidence: f.evidence,
            data: {},
        });
    }
    for (const f of checkFile({
        spec: input.spec,
        folders,
        file: input.file,
        parsed,
        names: input.names,
        catalogue,
        index: input.index,
        measure: input.measure,
    })) {
        out.push({
            file: input.file,
            layer,
            code: f.code,
            severity: f.severity,
            range: f.range,
            start: f.start,
            end: f.end,
            message: checkMessage(f, { file: input.file }),
            evidence: f.evidence,
            data: f.data,
        });
    }
    return out.sort(compareFindings);
}

export interface LocalizationInput {
    readonly spec: Spec;
    /** The file's path inside its mod, with `/`. */
    readonly file: string;
    /** The file's layer in the index: `mod` by default. */
    readonly layer?: string | undefined;
    readonly bytes: Uint8Array;
    readonly names: DefinedNames & Partial<WorkspaceNames>;
    readonly fallbackEncoding?: FallbackEncoding | undefined;
    /** Run `localization/unused-key`, off by default. */
    readonly unusedKeys?: boolean | undefined;
}

/** Every finding of the engine checks on one localization file, in the order of where each starts. */
export function localizationFindings(input: LocalizationInput): WorkspaceFinding[] {
    const { folders, catalogue } = specContext(input.spec);
    const parsed = readLocalization(input.bytes, { fallbackEncoding: input.fallbackEncoding });
    return checkLocalizationFile({
        spec: input.spec,
        folders,
        file: input.file,
        parsed,
        names: input.names,
        catalogue,
        unusedKeys: input.unusedKeys,
    })
        .map((f): WorkspaceFinding => ({
            file: input.file,
            layer: input.layer ?? MOD_LAYER,
            code: f.code,
            severity: f.severity,
            range: f.range,
            start: f.start,
            end: f.end,
            message: checkMessage(f, { file: input.file }),
            evidence: f.evidence,
            data: f.data,
        }))
        .sort(compareFindings);
}

export interface WorkspaceOptions {
    readonly spec: Spec;
    /** The game's `game` folder, or null for no base game. */
    readonly gameDir: string | null;
    /** Where the base game's index is cached (`defaultCacheDir()`), or null for no cache. */
    readonly cacheDir: string | null;
    /** The platform whose override rules apply; by default this one. */
    readonly platform?: Platform | undefined;
    readonly fallbackEncoding?: FallbackEncoding | undefined;
}

/** A workspace opened: the base game's index, with a mod indexed over it when one is given. */
export interface Workspace {
    /** The index holding the mod, over the base game when one was given. */
    readonly index: WorkspaceIndex;
    /** The base game's index, when a game folder was given. */
    readonly game: GameIndex | null;
    /** The mod's files, when a mod was given. */
    readonly mod: ModListing | null;
}

/**
 * The base game's index, from the on-disk cache when it answers for the installed game, and a
 * mod's files indexed over it: what every surface checks and looks names up in.
 */
export function openWorkspace(
    options: WorkspaceOptions & { readonly modDir: string | null },
): Workspace {
    const { folders, rules } = specContext(options.spec);
    const platform = 'platform' in options ? options.platform : currentPlatform();
    let game: GameIndex | null = null;
    let index: WorkspaceIndex;
    if (options.gameDir === null) {
        index = new WorkspaceIndex({
            folders,
            rules,
            platform,
            fallbackEncoding: options.fallbackEncoding,
        });
    } else {
        game = openGameIndex({
            gameDir: options.gameDir,
            folders,
            rules,
            platform,
            specSha256: options.spec.sha256,
            cacheDir: options.cacheDir,
            fallbackEncoding: options.fallbackEncoding,
        });
        index = game.index;
    }
    const mod = options.modDir === null ? null : indexMod(index, options.modDir);
    return { index, game, mod };
}

export interface WorkspaceCheckOptions extends WorkspaceOptions {
    /**
     * The mod's folder; null to check the base game itself (`gameDir` must then be given):
     * every file of its listing, in its own layer.
     */
    readonly modDir: string | null;
    /** Where to count what the scope checks judged (`newScopeMeasure`); nothing is counted without it. */
    readonly measure?: ScopeMeasure | undefined;
    /** The most findings a file reports; `MAX_FINDINGS_PER_FILE` by default. */
    readonly maxFindingsPerFile?: number | undefined;
    /**
     * Also run the checks that are off by default: `localization/unused-key` (docs/decisions.md,
     * decision 76). False by default.
     */
    readonly unusedKeys?: boolean | undefined;
    /**
     * Check only the files this keeps, by their path inside the mod (or the base-game layer);
     * every file is still indexed, so each file kept has the findings of a whole run.
     */
    readonly only?: ((file: string) => boolean) | undefined;
    /**
     * A workspace already opened with `openWorkspace` on the same spec, game folder and mod, the
     * mod's files brought up to date (`syncMod`): checked as it is, instead of opening the base
     * game again and indexing the mod into it. A server keeps one between requests.
     */
    readonly workspace?: Workspace | undefined;
}

/** A file checked, and its layer. */
export interface CheckedFile {
    readonly layer: string;
    /** Its path inside the mod or inside its base-game layer, with `/`. */
    readonly file: string;
}

export interface WorkspaceCheck {
    /**
     * The mod's script and localization files checked, by their path inside the mod, in
     * code-point order (for the base game, a path can be listed once per layer that has it).
     */
    readonly files: readonly string[];
    /** The same files, each with its layer. */
    readonly checked: readonly CheckedFile[];
    /**
     * Every finding the cap keeps, file by file in that order, each file's by where they
     * start.
     */
    readonly findings: readonly WorkspaceFinding[];
    /** The most findings a file reports in this run. */
    readonly maxFindingsPerFile: number;
    /** The files the cap shortened, in the order checked, with what it dropped. */
    readonly capped: readonly CappedFile[];
    /** Script and localization files in folders the spec does not list, by folder: not checked. */
    readonly notChecked: ReadonlyMap<string, number>;
    /** The base game's index, when a game folder was given. */
    readonly game: GameIndex | null;
    /** The game's build, from its launcher's settings; null without a game or when unknown. */
    readonly gameBuild: string | null;
    /** The index holding the mod, over the base game when one was given. */
    readonly index: WorkspaceIndex;
}

/**
 * Every finding pychivalry reports on a mod; with `modDir: null`, on the base game's own
 * files.
 */
export function checkWorkspace(options: WorkspaceCheckOptions): WorkspaceCheck {
    const { index, game } = options.workspace ?? openWorkspace({ ...options, modDir: null });
    const modDir = options.modDir;
    let listing: SourceListing;
    let names: DefinedNames & Partial<WorkspaceNames>;
    if (modDir !== null) {
        if (options.workspace === undefined) {
            listing = indexMod(index, modDir);
        } else if (options.workspace.mod !== null) {
            listing = options.workspace.mod;
        } else {
            throw new Error('checkWorkspace: the workspace given holds no mod');
        }
        // With the base game, the words of the mod's files the index does not read (its
        // interface files) count as uses of a localization key (`localization/unused-key`).
        names =
            game === null
                ? GAME_NOT_LOADED
                : definedNamesOf(index, { unreadWords: unreadWords(modDir, index) });
    } else if (game !== null) {
        listing = game.listing;
        names = definedNamesOf(index);
    } else {
        throw new Error('checkWorkspace: neither a mod nor a game folder to check');
    }
    const only = options.only;
    const checked = listing.files
        .filter((f) => fileKindOf(f.path) !== undefined && (only === undefined || only(f.path)))
        .sort((a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.layer, b.layer));
    const max = options.maxFindingsPerFile ?? MAX_FINDINGS_PER_FILE;
    const findings: WorkspaceFinding[] = [];
    const capped: CappedFile[] = [];
    for (const file of checked) {
        const input = {
            spec: options.spec,
            file: file.path,
            layer: file.layer,
            bytes: readFileSync(file.disk),
            names,
            fallbackEncoding: options.fallbackEncoding,
            unusedKeys: options.unusedKeys,
        };
        const found =
            fileKindOf(file.path) === 'localization'
                ? localizationFindings(input)
                : scriptFindings({
                      ...input,
                      index: { workspace: index, layer: file.layer },
                      measure: options.measure,
                  });
        const cap = capFindings(found, max);
        findings.push(...cap.kept);
        if (cap.capped !== null) {
            capped.push(cap.capped);
        }
    }
    return {
        files: checked.map((f) => f.path),
        checked: checked.map((f) => ({ layer: f.layer, file: f.path })),
        findings,
        maxFindingsPerFile: max,
        capped,
        notChecked: listing.notDescribed,
        game,
        gameBuild: game?.key.game_build ?? null,
        index,
    };
}
