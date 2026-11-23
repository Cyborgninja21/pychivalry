/**
 * A base game one program holds and lends to the others (docs/shared-index.md): its index,
 * frozen, and what makes it the base game a request asks for. A request's workspace is a fork of
 * it (`forkBaseSteps`), which shares every file, name and table of the base game and holds only
 * the mod's own; the base game is never changed by any of them.
 */

import path from 'node:path';
import { cacheKeysEqual } from '../index/cache.js';
import type { FolderTable } from '../index/folders.js';
import { gameCacheKey, type GameIndex } from '../index/game-index.js';
import { installFolders, listInstallSteps } from '../index/read-game.js';
import { decidingRules, type Platform, type RulesTable } from '../index/rules.js';
import type { Steps } from '../steps.js';
import type { FallbackEncoding } from '../syntax/decode.js';

/** What makes two base games the same, short of their files' listing. */
export interface BaseIdentity {
    /** The spec package's checksum (of its uncompressed bytes). */
    readonly specSha256: string;
    /** The game's `game` folder. */
    readonly gameDir: string;
    readonly platform: Platform | undefined;
    readonly fallbackEncoding: FallbackEncoding | undefined;
}

/** A base game lent: its identity and its index, frozen. */
export interface SharedBase extends BaseIdentity {
    readonly game: GameIndex;
}

/** The base game cannot stand for the one a request asks for: the request is worked alone. */
export class BaseRefused extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BaseRefused';
    }
}

/** A base game to lend, its index frozen from now on. */
export function shareBase(game: GameIndex, identity: BaseIdentity): SharedBase {
    game.index.freeze();
    return { ...identity, gameDir: path.resolve(identity.gameDir), game };
}

function sameFolder(a: string, b: string, platform: NodeJS.Platform): boolean {
    const x = path.resolve(a);
    const y = path.resolve(b);
    return platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** Why `base` cannot stand for the base game `wanted` names, or null when it can. */
export function baseMismatch(
    base: BaseIdentity,
    wanted: BaseIdentity,
    platform: NodeJS.Platform = process.platform,
): string | null {
    if (base.specSha256 !== wanted.specSha256) {
        return 'another spec package';
    }
    if (!sameFolder(base.gameDir, wanted.gameDir, platform)) {
        return 'another game folder';
    }
    if (base.platform !== wanted.platform) {
        return 'another platform';
    }
    if ((base.fallbackEncoding ?? null) !== (wanted.fallbackEncoding ?? null)) {
        return 'another fallback encoding';
    }
    return null;
}

/**
 * A fork of `base` for a request that asks for the base game `wanted`, after listing the game's
 * files to show it is still the game the base was read from: `BaseRefused` when it is another,
 * or the same one changed on disk since. The listing is the one thing done; nothing is loaded.
 */
export function* forkBaseSteps(
    base: SharedBase,
    wanted: BaseIdentity,
    folders: FolderTable,
    rules: RulesTable,
): Steps<GameIndex> {
    const mismatch = baseMismatch(base, wanted);
    if (mismatch !== null) {
        throw new BaseRefused(mismatch);
    }
    const started = performance.now();
    const deciding = wanted.platform === undefined ? [] : decidingRules(rules, wanted.platform);
    const listing = yield* listInstallSteps(installFolders(wanted.gameDir), folders, deciding);
    const key = gameCacheKey(
        {
            gameDir: wanted.gameDir,
            folders,
            rules,
            platform: wanted.platform,
            specSha256: wanted.specSha256,
            cacheDir: null,
            fallbackEncoding: wanted.fallbackEncoding,
        },
        listing,
    );
    if (!cacheKeysEqual(key, base.game.key)) {
        throw new BaseRefused("the game's files changed since the base game was read");
    }
    return {
        index: base.game.index.fork(),
        listing,
        key,
        cacheFile: base.game.cacheFile,
        fromCache: base.game.fromCache,
        shared: true,
        miss: null,
        cacheBytes: null,
        ms: { list: performance.now() - started, build: 0, save: 0, load: 0 },
    };
}
