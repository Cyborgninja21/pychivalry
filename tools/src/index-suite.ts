/**
 * The base-game index suite, `task game:index` (docs/PLAN.md items 3.5 and 3.8; step 3's
 * "Done when" 3 and 4). It indexes every folder the spec lists in the whole base game (the
 * install's `clausewitz/`, `jomini/` and `game/` folders and the DLC packs), with the
 * committed spec and its override rules (part D1), saves the index to a cache in a temporary
 * folder, reloads it, and indexes each corpus mod over the base game.
 *
 * Each of those runs alone, in a fresh process (`index-worker.ts`), so that the time and the
 * peak memory it reports are its own: one heavy job at a time (AGENTS.md).
 *
 * It passes when the reloaded index answers as the fresh one (their digests are equal) and
 * came from the cache, and every mod indexed. What it measures is recorded, never judged: the
 * folders indexed, the definitions and uses counted, the folders the spec does not describe,
 * and the names defined more than once with no winner known, by the rule of
 * docs/overrides.md that leaves each open and by the reason.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FileQuestion, Resolution, UnknownReason, WorkspaceIndex } from '@pychivalry/core';
import { CommandError, EXIT } from './util.js';

/** What a worker does: build the base game's index, load it from the cache, or index a mod over it. */
export type WorkerTask =
    | {
          readonly mode: 'build' | 'load';
          readonly root: string;
          readonly gameDir: string;
          readonly cacheDir: string;
      }
    | {
          readonly mode: 'mod';
          readonly root: string;
          readonly gameDir: string;
          readonly cacheDir: string;
          readonly modDir: string;
          readonly slug: string;
      };

/** The rule of docs/overrides.md that leaves an unknown answer open, for each of its reasons. */
export function openRules(r: Extract<Resolution, { status: 'unknown' }>): number[] {
    const rules = new Set<number>();
    for (const reason of r.reasons) {
        for (const rule of rulesOfReason(reason)) {
            rules.add(rule);
        }
    }
    return [...rules].sort((a, b) => a - b);
}

const INSTALL = new Set(['clausewitz', 'jomini']);

function rulesOfQuestion(layer: string, q: FileQuestion): number {
    switch (q.kind) {
        case 'listing-depth':
            return 4;
        case 'path-case':
            return 9;
        case 'replace-path':
            return 8;
        case 'file-identity':
            return 2;
        case 'same-path': {
            if (q.caseDiffers) {
                return 9;
            }
            const layers = [layer, q.other.layer];
            if (layers.some((l) => l.startsWith('dlc:'))) {
                return 10;
            }
            return layers.some((l) => INSTALL.has(l)) ? 3 : 1;
        }
    }
}

function rulesOfReason(reason: UnknownReason): number[] {
    switch (reason.kind) {
        case 'no-order':
            return [4];
        case 'not-settled':
            return [reason.overrides_rule];
        case 'name-scope':
            // Whether a nested name is one name or several: a key defined again, rule 5.
            return [5];
        case 'file-unknown':
            return reason.questions.map((q) => rulesOfQuestion(reason.layer, q));
        case 'no-rule':
            if (reason.database.startsWith('localization')) {
                return [7];
            }
            if (reason.database.startsWith('history/')) {
                // A history folder with no row: rule 6's folders of their own.
                return [6];
            }
            return [5];
    }
}

/**
 * The reasons an unknown answer gives, as words: `no-rule` (no row answers for the database),
 * `not-settled:<row>` (the row that answers is partial or open), `no-order`, `name-scope` (part
 * D3 does not settle whether a nested name written under two parents is one name), and
 * `file-unknown:<question>` (whether the game reads a file that holds a definition is not
 * known: `listing-depth`, `same-path`, `path-case`, `replace-path`, `file-identity`).
 */
export function reasonsOf(r: Extract<Resolution, { status: 'unknown' }>): string[] {
    const out = new Set<string>();
    for (const reason of r.reasons) {
        switch (reason.kind) {
            case 'not-settled':
                out.add(`not-settled:${reason.rule}`);
                break;
            case 'file-unknown':
                for (const q of reason.questions) {
                    out.add(`file-unknown:${q.kind}`);
                }
                break;
            default:
                out.add(reason.kind);
        }
    }
    return [...out].sort();
}

/** Counts of the names defined more than once, by how each resolves. */
export interface DuplicateCounts {
    names: number;
    by_status: Record<string, number>;
    unknown_by_rule: { rule: number; names: number }[];
    unknown_by_reason: { reason: string; names: number }[];
    unknown_by_database: { database: string; names: number }[];
}

/** Every name defined more than once (optionally only those with a definition in `layer`). */
export function duplicates(index: WorkspaceIndex, layer?: string): DuplicateCounts {
    const byStatus = new Map<string, number>();
    const byRule = new Map<number, number>();
    const byReason = new Map<string, number>();
    const byDatabase = new Map<string, number>();
    let names = 0;
    for (const group of index.groups()) {
        const r = index.resolve(group.database, group.name, group.container);
        if (layer !== undefined && !r.definitions.some((d) => d.layer === layer)) {
            continue;
        }
        names++;
        byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
        if (r.status === 'unknown') {
            for (const rule of openRules(r)) {
                byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
            }
            for (const reason of reasonsOf(r)) {
                byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
            }
            const database = group.database.startsWith('localization:')
                ? 'localization'
                : group.database;
            byDatabase.set(database, (byDatabase.get(database) ?? 0) + 1);
        }
    }
    return {
        names,
        by_status: Object.fromEntries([...byStatus].sort(([a], [b]) => (a < b ? -1 : 1))),
        unknown_by_rule: [...byRule]
            .sort(([a], [b]) => a - b)
            .map(([rule, n]) => ({ rule, names: n })),
        unknown_by_reason: [...byReason]
            .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
            .map(([reason, n]) => ({ reason, names: n })),
        unknown_by_database: [...byDatabase]
            .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
            .map(([database, n]) => ({ database, names: n })),
    };
}

/** One worker's output. */
export interface WorkerResult {
    readonly mode: WorkerTask['mode'];
    readonly from_cache: boolean;
    readonly miss: string | null;
    readonly digest: string;
    readonly ms: {
        list: number;
        build: number;
        save: number;
        load: number;
        mod: number;
        report: number;
    };
    readonly peak_rss_kib: number;
    readonly heap_used_mib: number;
    readonly cache_bytes: number | null;
    readonly report: Record<string, unknown>;
}

const WORKER = fileURLToPath(new URL('./index-worker.js', import.meta.url));

/** Run one worker in a fresh process and read its result. */
export function runWorker(task: WorkerTask): WorkerResult {
    let out: string;
    try {
        out = execFileSync(process.execPath, [WORKER, JSON.stringify(task)], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'inherit'],
        });
    } catch (err) {
        throw new CommandError(
            `the index worker (${task.mode}) failed: ${(err as Error).message}`,
            EXIT.failed,
        );
    }
    return JSON.parse(out) as WorkerResult;
}

export interface IndexSuiteInput {
    readonly root: string;
    readonly gameDir: string;
    readonly corpus: { readonly dir: string; readonly slugs: readonly string[] } | null;
    readonly rulesSha256: string;
    readonly platform: string;
    /** Where to make the temporary cache folder; the system's temporary folder by default. */
    readonly tempParent?: string;
}

const round = (n: number): number => Math.round(n);

/** Run the suite and return the record's results. */
export function runIndexSuite(input: IndexSuiteInput): Record<string, unknown> {
    const failures: string[] = [];
    const cacheDir = mkdtempSync(
        path.join(input.tempParent ?? tmpdir(), 'pychivalry-index-suite-'),
    );
    try {
        const base = { root: input.root, gameDir: input.gameDir, cacheDir };
        const build = runWorker({ mode: 'build', ...base });
        const load = runWorker({ mode: 'load', ...base });
        if (build.from_cache) {
            failures.push('the first build was read from a cache: the cache folder was not empty');
        }
        if (!load.from_cache) {
            failures.push(`the reload did not use the cache (${String(load.miss)})`);
        }
        if (load.digest !== build.digest) {
            failures.push(
                'the reloaded index does not answer as the fresh one: their digests differ',
            );
        }
        const mods: Record<string, unknown>[] = [];
        for (const slug of input.corpus?.slugs ?? []) {
            const dir = input.corpus?.dir ?? '';
            const mod = runWorker({ mode: 'mod', ...base, modDir: path.join(dir, slug), slug });
            if (!mod.from_cache) {
                failures.push(
                    `${slug}: the base game was not read from the cache (${String(mod.miss)})`,
                );
            }
            mods.push({
                slug,
                ...mod.report,
                time_ms: {
                    load_base: round(mod.ms.load),
                    index_mod: round(mod.ms.mod),
                    report: round(mod.ms.report),
                },
                peak_rss_kib: mod.peak_rss_kib,
            });
        }
        return {
            passed: failures.length === 0,
            failures,
            platform: input.platform,
            rules: { sha256: input.rulesSha256 },
            base_game: {
                ...build.report,
                time_ms: {
                    list: round(build.ms.list),
                    build: round(build.ms.build),
                    save: round(build.ms.save),
                    report: round(build.ms.report),
                },
                peak_rss_kib: build.peak_rss_kib,
                heap_used_after_build_mib: build.heap_used_mib,
                cache: {
                    bytes: build.cache_bytes ?? 0,
                    reload_ms: round(load.ms.load),
                    reload_peak_rss_kib: load.peak_rss_kib,
                    reload_answers_as_fresh: load.digest === build.digest,
                },
            },
            mods,
        };
    } finally {
        rmSync(cacheDir, { recursive: true, force: true });
    }
}
