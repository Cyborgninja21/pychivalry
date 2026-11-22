/**
 * One run of the index suite (index-suite.ts), alone in a fresh process: build the base
 * game's index and save it to the cache, load it from the cache, or load it and index one mod
 * over it. Prints one JSON object, a `WorkerResult`, on standard output.
 *
 * The peak memory it reports is read right after the build (or the load, or the mod), before
 * the digest and the report are worked out, so it is the index's own.
 */

import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
    currentPlatform,
    FolderTable,
    foldersFromSpec,
    indexMod,
    openGameIndex,
    type IndexedFile,
    type ModListing,
    type SourceListing,
    type WorkspaceIndex,
    openSpec,
} from '@pychivalry/core';
import { duplicates, type WorkerResult, type WorkerTask } from './index-suite.js';
import { committedSpec } from './record.js';
import { committedRules } from './rules-table.js';

const MIB = 1024 * 1024;

function layerKind(layer: string): string {
    return layer.startsWith('dlc:') ? 'dlc' : layer;
}

function counts(map: Map<string, number>): { key: string; files: number }[] {
    return [...map]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, files]) => ({ key, files }));
}

/** The first folder of each spec folder: where a folder the spec does not describe sits beside listed ones. */
function specRoots(folders: FolderTable): Set<string> {
    return new Set(folders.folders.map((f) => f.path.split('/')[0] ?? ''));
}

function notDescribed(listing: SourceListing, folders: FolderTable): Record<string, unknown>[] {
    const roots = specRoots(folders);
    return counts(listing.notDescribed).map(({ key, files }) => ({
        folder: key,
        files,
        beside_spec_folders: roots.has(key.split('/')[0] ?? ''),
    }));
}

function layers(
    files: readonly IndexedFile[],
    defined: Map<string, number>,
): Record<string, unknown>[] {
    const out = new Map<
        string,
        { files: number; definitions: number; uses: number; uses_of_defined_names: number }
    >();
    for (const file of files) {
        const kind = layerKind(file.layer);
        const row = out.get(kind) ?? {
            files: 0,
            definitions: 0,
            uses: 0,
            uses_of_defined_names: 0,
        };
        row.files++;
        row.definitions += file.definitions;
        row.uses += file.uses;
        out.set(kind, row);
    }
    for (const [layer, n] of defined) {
        const row = out.get(layerKind(layer));
        if (row !== undefined) {
            row.uses_of_defined_names += n;
        }
    }
    const order = ['clausewitz', 'jomini', 'game', 'dlc', 'mod'];
    return [...out]
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
        .map(([layer, row]) => ({ layer, ...row }));
}

function describeBase(index: WorkspaceIndex, listing: SourceListing): Record<string, unknown> {
    const files = index.allFiles();
    const totals = index.totals();
    const defined = index.usesOfDefinedNames();
    const byForm = new Map<string, number>();
    const byFolder = new Map<
        string,
        { files: number; definitions: number; forms: Map<string, number> }
    >();
    for (const file of files) {
        if (file.folder !== null) {
            const row = byFolder.get(file.folder) ?? {
                files: 0,
                definitions: 0,
                forms: new Map<string, number>(),
            };
            row.files++;
            byFolder.set(file.folder, row);
        }
    }
    index.forEachDefinition((file, form) => {
        byForm.set(form, (byForm.get(form) ?? 0) + 1);
        if (file.folder !== null) {
            const row = byFolder.get(file.folder);
            if (row !== undefined) {
                row.definitions++;
                row.forms.set(form, (row.forms.get(form) ?? 0) + 1);
            }
        }
    });
    const folders = index.folders.folders
        .filter((f) => byFolder.has(f.path))
        .map((f) => {
            const row = byFolder.get(f.path);
            return {
                folder: f.path,
                content_type: f.contentType,
                files: row?.files ?? 0,
                definitions: row?.definitions ?? 0,
                by_form: Object.fromEntries([...(row?.forms ?? new Map<string, number>())].sort()),
                spec_schema: f.schema,
                spec_files: f.specFiles,
                spec_records: f.specRecords,
            };
        });
    return {
        layers: layers(files, defined),
        packs: listing.packs.length,
        files: totals.files,
        lines: totals.lines,
        definitions: totals.definitions,
        uses: totals.uses,
        uses_of_defined_names: [...defined.values()].reduce((a, b) => a + b, 0),
        names: totals.names,
        definitions_by_form: Object.fromEntries([...byForm].sort()),
        folders_indexed: folders.length,
        folders,
        spec_folders_without_files: index.folders.folders
            .filter((f) => !byFolder.has(f.path))
            .map((f) => f.path),
        not_described: notDescribed(listing, index.folders),
        not_read: counts(listing.notRead).map(({ key, files: n }) => ({
            extension: key,
            files: n,
        })),
        defined_more_than_once: duplicates(index),
    };
}

function describeMod(index: WorkspaceIndex, listing: ModListing): Record<string, unknown> {
    const files = index.allFiles();
    const mod = files.filter((f) => f.layer === 'mod');
    const defined = index.usesOfDefinedNames();
    let replaced = 0;
    let hidden = 0;
    let unknownBase = 0;
    for (const file of files) {
        const status = index.fileStatus(file.layer, file.path);
        if (file.layer !== 'mod') {
            if (status?.replacedBy?.layer === 'mod') {
                replaced++;
            }
            if (status?.hiddenBy !== null && status?.hiddenBy !== undefined) {
                hidden++;
            }
            if (
                status?.read === 'unknown' &&
                status.questions.some((q) => q.kind !== 'same-path' || q.other.layer === 'mod')
            ) {
                unknownBase++;
            }
        }
    }
    const unknownMod = mod.filter(
        (f) => index.fileStatus(f.layer, f.path)?.read === 'unknown',
    ).length;
    return {
        files: mod.length,
        definitions: mod.reduce((n, f) => n + f.definitions, 0),
        uses: mod.reduce((n, f) => n + f.uses, 0),
        uses_of_defined_names: defined.get('mod') ?? 0,
        replace_paths: listing.replacePaths,
        game_files_replaced: replaced,
        game_files_hidden: hidden,
        game_files_read_unknown: unknownBase,
        mod_files_read_unknown: unknownMod,
        not_described: notDescribed(listing, index.folders),
        not_read_files: [...listing.notRead.values()].reduce((a, b) => a + b, 0),
        defined_more_than_once: duplicates(index, 'mod'),
    };
}

function main(): void {
    const task = JSON.parse(process.argv[2] ?? '{}') as WorkerTask;
    const root = task.root;
    const folders = new FolderTable(foldersFromSpec(openSpec(path.join(root, 'spec')).data));
    const rules = committedRules(root).table;
    const game = openGameIndex({
        gameDir: task.gameDir,
        folders,
        rules,
        platform: currentPlatform(),
        specSha256: committedSpec(root).sha256,
        cacheDir: task.cacheDir,
    });
    let modMs = 0;
    let listing: ModListing | undefined;
    if (task.mode === 'mod') {
        const started = performance.now();
        listing = indexMod(game.index, task.modDir);
        modMs = performance.now() - started;
    }
    const peak = process.resourceUsage().maxRSS;
    const heap = process.memoryUsage().heapUsed / MIB;
    const started = performance.now();
    let report: Record<string, unknown> = {};
    if (task.mode === 'build') {
        report = describeBase(game.index, game.listing);
    } else if (listing !== undefined) {
        report = describeMod(game.index, listing);
    }
    const digest = task.mode === 'mod' ? '' : game.index.digest();
    const result: WorkerResult = {
        mode: task.mode,
        from_cache: game.fromCache,
        miss: game.miss,
        digest,
        ms: { ...game.ms, mod: modMs, report: performance.now() - started },
        peak_rss_kib: peak,
        heap_used_mib: Math.round(heap),
        cache_bytes: game.cacheBytes,
        report,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
