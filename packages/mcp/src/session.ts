/**
 * What one server process works on: the spec package, one mod folder and the game folder,
 * chosen when the server starts (`args.ts`), and the workspace index over them, kept between
 * requests.
 *
 * - **The base game's index** is opened once, on the first request that needs it, by the
 *   core's `openWorkspace`: loaded from the on-disk cache in the user's cache folder when it
 *   answers for the installed game, and built and saved there only when it does not
 *   (docs/PLAN.md item 6.6). Each AI harness starts its own copy of the server, and every copy
 *   loads the same cache.
 * - **The mod** is brought up to date before every request (`syncMod`): an agent edits the
 *   mod's files between requests, and each answer is about the files as they are now.
 * - **What it reads and writes** (item 6.5): it reads the mod folder, the game folder, the spec
 *   package it ships with and the index cache; it writes nothing but the index cache, and that
 *   only when none answers for the installed game. A path an agent gives must be inside the mod
 *   folder.
 */

import {
    drain,
    openWorkspaceSteps,
    syncModSteps,
    type GameIndex,
    type Place,
    type SharedBase,
    type Spec,
    type Steps,
    type SyncedMod,
    type Workspace,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BadInput, valueList } from './result.js';

/** How the game folder was chosen. */
export interface GameChoice {
    /** The game's `game` folder, or null to work without the base game. */
    readonly dir: string | null;
    /** `vanilla` when the server was given it, `steam` when found in a Steam library. */
    readonly source: 'vanilla' | 'steam' | null;
    /** True when the game was looked for in Steam's libraries and not found. */
    readonly notFound: boolean;
}

export interface SessionOptions {
    readonly spec: Spec;
    /** The mod folder, absolute. */
    readonly modDir: string;
    readonly game: GameChoice;
    /** The index cache folder (`defaultCacheDir`), or null for none. */
    readonly cacheDir: string | null;
    /**
     * A base game another program lends (docs/shared-index.md): the session's workspace forks
     * it instead of loading the base game. Only the program that answers for agent servers
     * sets it.
     */
    readonly base?: SharedBase | undefined;
    /**
     * Where the program that lends the base game is looked for (the user's environment, system
     * and home), or undefined to answer every request here.
     */
    readonly place?: Place | undefined;
}

/** A path inside the mod: its path relative to the mod folder, with `/`; empty for the mod. */
export interface ModPath {
    readonly relative: string;
    readonly kind: 'file' | 'folder';
}

export class Session {
    readonly spec: Spec;
    readonly modDir: string;
    readonly game: GameChoice;
    readonly cacheDir: string | null;
    readonly base: SharedBase | undefined;
    readonly place: Place | undefined;
    private opened: { readonly index: WorkspaceIndex; readonly game: GameIndex | null } | null =
        null;
    private mod: SyncedMod | null = null;
    /** The last answer of each kind, and the state of the mod it was made on. */
    private readonly remembered = new Map<
        string,
        { key: string; generation: number; value: unknown }
    >();
    /** Counts the syncs that changed the index: an answer made on an earlier count is stale. */
    private generation = 0;

    constructor(options: SessionOptions) {
        this.spec = options.spec;
        this.modDir = options.modDir;
        this.game = options.game;
        this.cacheDir = options.cacheDir;
        this.base = options.base;
        this.place = options.place;
    }

    /** The workspace: the base game, opened once, and the mod as its folder is now. */
    workspace(): Workspace {
        return drain(this.workspaceSteps());
    }

    /** `workspace` in steps (`Steps`): a pause after each file of the mod read. */
    *workspaceSteps(): Steps<Workspace> {
        this.opened ??= yield* openWorkspaceSteps({
            spec: this.spec,
            gameDir: this.game.dir,
            cacheDir: this.cacheDir,
            modDir: null,
            base: this.base,
        });
        this.mod = yield* syncModSteps(this.opened.index, this.modDir, this.mod);
        if (this.mod.changed) {
            this.generation++;
        }
        return { index: this.opened.index, game: this.opened.game, mod: this.mod };
    }

    /**
     * Let go of the base game and the mod: the next request opens them again. Called when
     * another program answers this session's requests, so that this one holds no copy of its
     * own (docs/shared-index.md).
     */
    release(): void {
        this.opened = null;
        this.mod = null;
        this.remembered.clear();
    }

    /** True while the session holds a base game or a mod of its own. */
    get holdsIndex(): boolean {
        return this.opened !== null;
    }

    /**
     * An answer made once and kept while the mod is unchanged, so that the next page of the same
     * question does not do the work again: the last answer of each `kind`, for the same `key`,
     * made since the last sync that changed the mod. Call after `workspace()`.
     */
    remember<T>(kind: string, key: string, make: () => T): T {
        const kept = this.remembered.get(kind);
        if (kept?.key === key && kept.generation === this.generation) {
            return kept.value as T;
        }
        const value = make();
        this.remembered.set(kind, { key, generation: this.generation, value });
        return value;
    }

    /** `remember`, made in steps (`Steps`). */
    *rememberSteps<T>(kind: string, key: string, make: () => Steps<T>): Steps<T> {
        const kept = this.remembered.get(kind);
        if (kept?.key === key && kept.generation === this.generation) {
            return kept.value as T;
        }
        const value = yield* make();
        this.remembered.set(kind, { key, generation: this.generation, value });
        return value;
    }

    /** The base game's index once opened; null before the first request or without a game. */
    gameIndex(): GameIndex | null {
        return this.opened?.game ?? null;
    }

    /**
     * A path an agent gave, relative to the mod folder (or absolute inside it), as a path
     * inside the mod; bad input when it is outside the mod or does not exist, the text naming
     * what the mod's folder holds.
     */
    modPath(given: string, argument: string): ModPath {
        const resolved = path.resolve(this.modDir, given);
        const relative = path.relative(this.modDir, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new BadInput(
                `${argument}: ${given} is outside the mod; give a path inside the mod folder ${this.modDir}, relative to it`,
            );
        }
        if (!existsSync(resolved)) {
            throw new BadInput(
                `${argument}: the mod has no file or folder ${given}; its folder holds ${valueList(this.topLevel(), 2_000)}`,
            );
        }
        return {
            relative: relative.split(path.sep).join('/'),
            kind: statSync(resolved).isDirectory() ? 'folder' : 'file',
        };
    }

    /** What the mod folder holds at its top, folders with a `/`, sorted. */
    private topLevel(): string[] {
        return readdirSync(this.modDir, { withFileTypes: true })
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
            .sort();
    }

    /** Notes about the run every result that reads the workspace carries. */
    notes(): string[] {
        const out: string[] = [];
        if (this.game.notFound) {
            out.push(
                'the game was not found in any Steam library and the server was not given its folder: names the game defines are not judged',
            );
        } else if (this.game.dir === null) {
            out.push(
                'the server runs without the base game: names the game defines are not judged',
            );
        }
        const build = this.gameIndex()?.key.game_build ?? null;
        if (build !== null && build !== this.spec.version) {
            out.push(
                `the game is build ${build}; the spec package is for ${this.spec.version}: names that changed between the two may be judged wrongly`,
            );
        }
        return out;
    }
}
