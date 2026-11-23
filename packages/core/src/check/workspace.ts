/**
 * Every check over a mod: the one code path the command line, the agent server and the
 * language server run, so that all three report the same findings for the same mod
 * (docs/MVP.md, definition of done 4). It reads the mod's files over the base game's index,
 * and runs on each script file the parser and every engine check (`checkFile`, which holds
 * the list of checks); no surface lists checks of its own.
 *
 * - **The files checked** are the mod's script files (`.txt`) in the folders the spec lists:
 *   the files the index reads (docs/decisions.md, step 3: a file in a folder the spec does not
 *   list is not read at all). Those in other folders are counted, by folder, and not checked.
 * - **The base game** is the index `openGameIndex` gives: loaded from the on-disk cache when
 *   it answers for the installed game, otherwise built and saved there (docs/PLAN.md item
 *   5.7), and the mod is indexed over it.
 * - **No game folder:** a name the mod does not define may be one the game defines, which
 *   nothing can tell without the game, so no check reports such a name unknown
 *   (docs/guide/settings.md, "No game folder"; a lesson of release 2.3.0). What does not
 *   depend on the game's files, a parse error or a name of the spec package's own, is still
 *   judged where the checks judge it.
 * - **Each finding** carries its rendered message, so every surface shows the same text.
 */

import { readFileSync } from 'node:fs';
import { folderTableFromSpec, type FolderTable } from '../index/folders.js';
import { openGameIndex, type GameIndex } from '../index/game-index.js';
import { compareCodePoints } from '../index/order.js';
import { indexMod, type ModListing } from '../index/read-game.js';
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
import { checkFile } from './index.js';
import type { Code } from './inventory.js';
import { definedNamesOf } from './names.js';

/** One finding on a file of a workspace, as every surface reports it. */
export interface WorkspaceFinding {
    /** The file's path inside the mod, with `/`. */
    readonly file: string;
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

export interface ScriptInput {
    readonly spec: Spec;
    /** The file's path inside its mod, with `/`. */
    readonly file: string;
    readonly bytes: Uint8Array;
    readonly names: DefinedNames;
    /**
     * The workspace index that holds the file, and the file's layer in it, for the checks of
     * definitions; without it they report nothing.
     */
    readonly index?: { readonly workspace: WorkspaceIndex; readonly layer: string } | undefined;
    readonly fallbackEncoding?: FallbackEncoding | undefined;
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
    for (const f of parsed.allFindings) {
        out.push({
            file: input.file,
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
    })) {
        out.push({
            file: input.file,
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
    /** The mod's folder. */
    readonly modDir: string;
}

export interface WorkspaceCheck {
    /** The mod's script files checked, by their path inside the mod, in code-point order. */
    readonly files: readonly string[];
    /** Every finding, file by file in that order, each file's by where they start. */
    readonly findings: readonly WorkspaceFinding[];
    /** Script and localization files in folders the spec does not list, by folder: not checked. */
    readonly notChecked: ReadonlyMap<string, number>;
    /** The base game's index, when a game folder was given. */
    readonly game: GameIndex | null;
    /** The game's build, from its launcher's settings; null without a game or when unknown. */
    readonly gameBuild: string | null;
    /** The index holding the mod, over the base game when one was given. */
    readonly index: WorkspaceIndex;
}

/** Every finding pychivalry reports on a mod. */
export function checkWorkspace(options: WorkspaceCheckOptions): WorkspaceCheck {
    const { index, game } = openWorkspace({ ...options, modDir: null });
    const listing = indexMod(index, options.modDir);
    const names = game === null ? GAME_NOT_LOADED : definedNamesOf(index);
    const scripts = listing.files
        .filter((f) => fileKindOf(f.path) === 'script')
        .sort((a, b) => compareCodePoints(a.path, b.path));
    const findings: WorkspaceFinding[] = [];
    for (const file of scripts) {
        findings.push(
            ...scriptFindings({
                spec: options.spec,
                file: file.path,
                bytes: readFileSync(file.disk),
                names,
                index: { workspace: index, layer: file.layer },
                fallbackEncoding: options.fallbackEncoding,
            }),
        );
    }
    return {
        files: scripts.map((f) => f.path),
        findings,
        notChecked: listing.notDescribed,
        game,
        gameBuild: game?.key.game_build ?? null,
        index,
    };
}
