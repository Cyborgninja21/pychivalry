/**
 * The base game's index, from the cache when it answers for the installed game, otherwise
 * built from the local disk and saved (docs/PLAN.md items 3.5, 3.6a and 3.8). This is how a
 * server or the command line gets the base game; a mod is then indexed over it (`indexMod`).
 */

import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { FallbackEncoding } from '../syntax/decode.js';
import {
    CACHE_FORMAT,
    cacheFileName,
    loadIndex,
    saveIndex,
    type CacheKey,
    type CacheMiss,
} from './cache.js';
import type { FolderTable } from './folders.js';
import {
    indexFiles,
    installFolders,
    installLayersOf,
    listInstall,
    readGameBuild,
    setUnreadFilesOf,
    sourceManifestSha256,
    type SourceListing,
} from './read-game.js';
import { decidingRules, rulesDigest, type Platform, type RulesTable } from './rules.js';
import type { WorkspaceIndex } from './workspace.js';

export interface GameIndexOptions {
    /** The game's `game` folder. */
    readonly gameDir: string;
    readonly folders: FolderTable;
    readonly rules: RulesTable;
    readonly platform: Platform | undefined;
    /** The spec package's checksum (of its uncompressed bytes): part of the cache's key. */
    readonly specSha256: string;
    /** The cache folder (`defaultCacheDir()`), or null to neither read nor write a cache. */
    readonly cacheDir: string | null;
    readonly fallbackEncoding?: FallbackEncoding | undefined;
}

export interface GameIndex {
    readonly index: WorkspaceIndex;
    readonly listing: SourceListing;
    readonly key: CacheKey;
    /** The cache file, or null when no cache folder was given. */
    readonly cacheFile: string | null;
    /** True when the index came from the cache. */
    readonly fromCache: boolean;
    /**
     * True when the index is a fork of a base game another program had already open
     * (docs/shared-index.md): nothing was loaded or read for it but the listing of the game's
     * files that shows it is the same game.
     */
    readonly shared: boolean;
    /** Why the cache was not used, when it was not. */
    readonly miss: CacheMiss | null;
    /** Bytes written to the cache, when it was written. */
    readonly cacheBytes: number | null;
    /** Milliseconds: listing the files, building, saving, loading (0 for steps not taken). */
    readonly ms: {
        readonly list: number;
        readonly build: number;
        readonly save: number;
        readonly load: number;
    };
}

/** The cache key for a listing of the game's files. */
export function gameCacheKey(options: GameIndexOptions, listing: SourceListing): CacheKey {
    return {
        format: CACHE_FORMAT,
        spec_sha256: options.specSha256,
        rules_sha256: rulesDigest(options.rules),
        platform: options.platform ?? 'none',
        game_build: readGameBuild(options.gameDir),
        manifest_sha256: sourceManifestSha256(listing.files),
        fallback_encoding: options.fallbackEncoding ?? null,
    };
}

/** The base game's index: loaded from the cache when it is current, otherwise built and saved. */
export function openGameIndex(options: GameIndexOptions): GameIndex {
    const indexOptions = {
        folders: options.folders,
        rules: options.rules,
        platform: options.platform,
        fallbackEncoding: options.fallbackEncoding,
    };
    const rules =
        options.platform === undefined ? [] : decidingRules(options.rules, options.platform);
    let t = performance.now();
    const install = installFolders(options.gameDir);
    const listing = listInstall(install, options.folders, rules);
    const layers = installLayersOf(install, listing);
    const key = gameCacheKey(options, listing);
    const ms = { list: performance.now() - t, build: 0, save: 0, load: 0 };
    const cacheFile =
        options.cacheDir === null ? null : path.join(options.cacheDir, cacheFileName(key));
    let miss: CacheMiss | null = null;
    if (cacheFile !== null) {
        t = performance.now();
        const loaded = loadIndex(cacheFile, key, indexOptions);
        ms.load = performance.now() - t;
        if ('index' in loaded) {
            setUnreadFilesOf(loaded.index, listing, layers);
            return {
                index: loaded.index,
                listing,
                key,
                cacheFile,
                fromCache: true,
                shared: false,
                miss: null,
                cacheBytes: null,
                ms,
            };
        }
        miss = loaded.miss;
    }
    t = performance.now();
    const index = indexFiles(listing.files, indexOptions);
    setUnreadFilesOf(index, listing, layers);
    ms.build = performance.now() - t;
    let cacheBytes: number | null = null;
    if (cacheFile !== null) {
        t = performance.now();
        cacheBytes = saveIndex(index, cacheFile, key);
        ms.save = performance.now() - t;
    }
    return {
        index,
        listing,
        key,
        cacheFile,
        fromCache: false,
        shared: false,
        miss,
        cacheBytes,
        ms,
    };
}
