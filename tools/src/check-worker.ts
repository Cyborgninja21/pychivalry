/**
 * One run of the check suites (check-suite.ts), alone in a fresh process: check the base game
 * itself (`game`), build the base game's index into the cache (`prepare`), or check one mod
 * over it (`mod`). Each check is the core's one runner, `checkWorkspace`, the code path the
 * command line runs. Prints one JSON object, a `CheckWorkerResult`, on standard output.
 *
 * The peak memory it reports is the process's own, read when the check has finished.
 */

import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
    checkWorkspace,
    newScopeMeasure,
    openSpec,
    openWorkspace,
    type ScopeMeasure,
    type WorkspaceCheck,
    type WorkspaceFinding,
} from '@pychivalry/core';
import type {
    CappedFigures,
    CheckWorkerResult,
    CheckWorkerTask,
    ScopeFigures,
    WorkerFinding,
} from './check-suite.js';

/** The severities a record lists one by one; the others it counts by code. */
const LISTED: ReadonlySet<string> = new Set(['error', 'warning']);

function scopeFigures(measure: ScopeMeasure): ScopeFigures {
    return {
        keyword_uses: measure.keywordUses,
        keyword_uses_known_scope: measure.knownScope,
        keyword_uses_judged: measure.judged,
        findings: measure.findings,
        unjudged_by_reason: [...measure.unjudged]
            .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
            .map(([reason, uses]) => ({ reason, uses })),
        link_steps_judged: measure.linkStepsJudged,
        link_findings: measure.linkFindings,
    };
}

function nameOf(f: WorkspaceFinding): string | null {
    for (const key of ['name', 'key'] as const) {
        const value = (f.data as Record<string, unknown>)[key];
        if (typeof value === 'string') {
            return value;
        }
    }
    return null;
}

function listed(f: WorkspaceFinding): WorkerFinding {
    return {
        file: f.file,
        layer: f.layer,
        line: f.range.start.line + 1,
        column: f.range.start.character + 1,
        code: f.code,
        severity: f.severity,
        message: f.message,
        name: nameOf(f),
        data: f.data,
    };
}

/** What the per-file cap dropped: the files it shortened, and the findings by code. */
function cappedFigures(run: WorkspaceCheck): CappedFigures {
    const byCode = new Map<string, { code: string; severity: string; count: number }>();
    let dropped = 0;
    for (const file of run.capped) {
        dropped += file.dropped;
        for (const row of file.droppedByCode) {
            const key = `${row.code}\u0000${row.severity}`;
            const sum = byCode.get(key) ?? { code: row.code, severity: row.severity, count: 0 };
            sum.count += row.count;
            byCode.set(key, sum);
        }
    }
    return {
        max_per_file: run.maxFindingsPerFile,
        files: run.capped.length,
        dropped,
        dropped_by_code: [...byCode]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([, row]) => row),
    };
}

function describe(run: WorkspaceCheck, measure: ScopeMeasure): CheckWorkerResult['check'] {
    // One row per code and severity: a code can raise two (`localization/missing-key`).
    const byCode = new Map<string, { code: string; severity: string; count: number }>();
    for (const f of run.findings) {
        const key = `${f.code}\u0000${f.severity}`;
        const row = byCode.get(key) ?? { code: f.code, severity: f.severity, count: 0 };
        row.count++;
        byCode.set(key, row);
    }
    const byLayer = new Map<string, number>();
    for (const file of run.checked) {
        const layer = file.layer.startsWith('dlc:') ? 'dlc' : file.layer;
        byLayer.set(layer, (byLayer.get(layer) ?? 0) + 1);
    }
    return {
        files: run.checked.length,
        files_by_layer: [...byLayer].map(([layer, files]) => ({ layer, files })),
        not_checked: [...run.notChecked]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([folder, files]) => ({ folder, files })),
        by_code: [...byCode].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, row]) => row),
        // The `style/` family is counted by code, not listed: it rests on pychivalry's own
        // formatting rules, not on the game, and classifies nothing (docs/formatting.md).
        listed: run.findings
            .filter((f) => LISTED.has(f.severity) && !f.code.startsWith('style/'))
            .map(listed),
        capped: cappedFigures(run),
        scope: scopeFigures(measure),
    };
}

function main(): void {
    const task = JSON.parse(process.argv[2] ?? '{}') as CheckWorkerTask;
    const spec = openSpec(path.join(task.root, 'spec'));
    const start = performance.now();
    if (task.mode === 'prepare') {
        const opened = openWorkspace({
            spec,
            gameDir: task.gameDir,
            cacheDir: task.cacheDir,
            modDir: null,
        });
        const game = opened.game;
        const result: CheckWorkerResult = {
            mode: task.mode,
            from_cache: game?.fromCache ?? false,
            ms: {
                list: game?.ms.list ?? 0,
                build: game?.ms.build ?? 0,
                save: game?.ms.save ?? 0,
                load: game?.ms.load ?? 0,
                check: 0,
                total: performance.now() - start,
            },
            peak_rss_kib: process.resourceUsage().maxRSS,
            check: null,
        };
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    const measure = newScopeMeasure();
    const run = checkWorkspace({
        spec,
        gameDir: task.gameDir,
        cacheDir: task.cacheDir,
        modDir: task.mode === 'mod' ? task.modDir : null,
        measure,
    });
    const total = performance.now() - start;
    const peak = process.resourceUsage().maxRSS;
    const game = run.game;
    const ms = {
        list: game?.ms.list ?? 0,
        build: game?.ms.build ?? 0,
        save: game?.ms.save ?? 0,
        load: game?.ms.load ?? 0,
    };
    const result: CheckWorkerResult = {
        mode: task.mode,
        from_cache: game?.fromCache ?? false,
        ms: {
            ...ms,
            check: total - ms.list - ms.build - ms.save - ms.load,
            total,
        },
        peak_rss_kib: peak,
        check: describe(run, measure),
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

main();
