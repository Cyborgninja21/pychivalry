/**
 * The check suites (docs/PLAN.md item 4.10): `task game:check`, every check on the base game's
 * own files, and `task game:mods`, every check on each corpus mod over the base game. Both run
 * the core's one runner, `checkWorkspace`, the code path of the command line's `check`, so a
 * record holds what the command line reports.
 *
 * Each check runs alone in a fresh process (`check-worker.ts`), so the time and the peak memory
 * it reports are its own: one heavy job at a time (AGENTS.md). `game:check` builds the base
 * game's index in its process and checks every file of it; `game:mods` builds the index once
 * into a cache in a temporary folder, then checks each mod in a process that loads it from
 * there, as a second run of the command line does.
 *
 * Every error the base game raises, and every warning, is classified in
 * `tools/data/check-classifications.json`; every error a corpus mod raises, in
 * `tools/data/mods-classifications.json` (`classifyFindings`). A suite fails on a finding with
 * no entry, on an entry that matches no finding, on a pychivalry fault, and, for the mods, on
 * an error whose entry says it is not shown to be a real defect (`unclassified`). A failed run
 * still writes its record.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandError, EXIT, isObject, readJson } from './util.js';

// ─── The worker ────────────────────────────────────────────────────────────

/** What a worker does: check the base game, build its index into the cache, or check a mod. */
export type CheckWorkerTask =
    | {
          readonly mode: 'game' | 'prepare';
          readonly root: string;
          readonly gameDir: string;
          readonly cacheDir: string | null;
      }
    | {
          readonly mode: 'mod';
          readonly root: string;
          readonly gameDir: string;
          readonly cacheDir: string | null;
          readonly modDir: string;
          readonly slug: string;
      };

/** An error or a warning, as the worker reports it. */
export interface WorkerFinding {
    readonly file: string;
    readonly layer: string;
    readonly line: number;
    readonly column: number;
    readonly code: string;
    readonly severity: string;
    readonly message: string;
    /** The name the finding is about (`data.name` or `data.key`), when it has one. */
    readonly name: string | null;
    readonly data: Record<string, unknown>;
}

/** What the scope checks judged (core `ScopeMeasure`), as a record states it. */
export interface ScopeFigures {
    readonly keyword_uses: number;
    readonly keyword_uses_known_scope: number;
    readonly keyword_uses_judged: number;
    readonly findings: number;
    readonly unjudged_by_reason: readonly { readonly reason: string; readonly uses: number }[];
    readonly link_steps_judged: number;
    readonly link_findings: number;
}

/** What the per-file cap dropped (core `WorkspaceCheck.capped`), as a record states it. */
export interface CappedFigures {
    readonly max_per_file: number;
    /** The files the cap shortened. */
    readonly files: number;
    readonly dropped: number;
    readonly dropped_by_code: readonly {
        readonly code: string;
        readonly severity: string;
        readonly count: number;
    }[];
}

/** One worker's output. */
export interface CheckWorkerResult {
    readonly mode: CheckWorkerTask['mode'];
    readonly from_cache: boolean;
    readonly ms: {
        readonly list: number;
        readonly build: number;
        readonly save: number;
        readonly load: number;
        readonly check: number;
        readonly total: number;
    };
    readonly peak_rss_kib: number;
    /** What the check found; null for `prepare`. */
    readonly check: {
        readonly files: number;
        readonly files_by_layer: readonly { readonly layer: string; readonly files: number }[];
        readonly not_checked: readonly { readonly folder: string; readonly files: number }[];
        readonly by_code: readonly {
            readonly code: string;
            readonly severity: string;
            readonly count: number;
        }[];
        /** Every error and warning. */
        readonly listed: readonly WorkerFinding[];
        readonly capped: CappedFigures;
        readonly scope: ScopeFigures;
    } | null;
}

const WORKER = fileURLToPath(new URL('./check-worker.js', import.meta.url));

/** Run one worker in a fresh process and read its result. */
export function runCheckWorker(task: CheckWorkerTask): CheckWorkerResult {
    let out: string;
    try {
        out = execFileSync(process.execPath, [WORKER, JSON.stringify(task)], {
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'inherit'],
        });
    } catch (err) {
        throw new CommandError(
            `the check worker (${task.mode}) failed: ${(err as Error).message}`,
            EXIT.failed,
        );
    }
    return JSON.parse(out) as CheckWorkerResult;
}

// ─── Classifications ───────────────────────────────────────────────────────

/** What a base-game finding is: a defect of the game's files, of the spec package, or ours. */
export const GAME_CLASSES = ['game-defect', 'spec-package-fault', 'pychivalry-fault'] as const;
/**
 * What a corpus mod's error is: a real defect of the mod, a spec-package fault, a pychivalry
 * fault, or not shown either way (`unclassified`, with the reason it could not be shown).
 */
export const MOD_CLASSES = [
    'real-defect',
    'spec-package-fault',
    'pychivalry-fault',
    'unclassified',
] as const;

export type GameClass = (typeof GAME_CLASSES)[number];
export type ModClass = (typeof MOD_CLASSES)[number];

/** One entry of a classification file: the findings of one code at the lines listed. */
export interface CheckClassification {
    /** The corpus mod, in the mods' file; absent in the base game's. */
    readonly slug?: string;
    readonly file: string;
    /** The base game's layer (`game` when absent); a mod's files are all in `mod`. */
    readonly layer?: string;
    readonly code: string;
    readonly lines: readonly number[];
    readonly classification: string;
    readonly reason: string;
}

/** Read a classification file: `{ about, classifications: [...] }`, each entry checked. */
export function readCheckClassifications(
    file: string,
    classes: readonly string[],
): CheckClassification[] {
    const data = readJson(file);
    const list = isObject(data) ? data['classifications'] : undefined;
    if (!Array.isArray(list)) {
        throw new CommandError(`${path.basename(file)} has no classifications list`, EXIT.usage);
    }
    return list.map((entry: unknown, n): CheckClassification => {
        const at = `${path.basename(file)}: classification ${String(n + 1)}`;
        if (
            !isObject(entry) ||
            typeof entry['file'] !== 'string' ||
            typeof entry['code'] !== 'string' ||
            !Array.isArray(entry['lines']) ||
            entry['lines'].length === 0 ||
            !entry['lines'].every((l) => Number.isInteger(l) && (l as number) > 0) ||
            typeof entry['classification'] !== 'string' ||
            !classes.includes(entry['classification']) ||
            typeof entry['reason'] !== 'string' ||
            entry['reason'] === '' ||
            (entry['slug'] !== undefined && typeof entry['slug'] !== 'string') ||
            (entry['layer'] !== undefined && typeof entry['layer'] !== 'string')
        ) {
            throw new CommandError(
                `${at} is not { file, code, lines, classification (${classes.join(', ')}), reason }`,
                EXIT.usage,
            );
        }
        return {
            ...(typeof entry['slug'] === 'string' ? { slug: entry['slug'] } : {}),
            ...(typeof entry['layer'] === 'string' ? { layer: entry['layer'] } : {}),
            file: entry['file'],
            code: entry['code'],
            lines: entry['lines'] as number[],
            classification: entry['classification'],
            reason: entry['reason'],
        };
    });
}

/** A finding as a record lists it, with its classification when it is classified. */
export interface RecordedFinding {
    readonly file: string;
    readonly layer?: string;
    readonly line: number;
    readonly column: number;
    readonly code: string;
    readonly message: string;
    readonly classification?: string;
    readonly reason?: string;
}

/**
 * Classify findings by their entries: an entry covers the findings of its code in its file
 * (and layer, and mod) at each of its lines. Returns each finding with its classification
 * (`unclassified` when no entry covers it) and the lines of entries that cover nothing.
 */
export function classifyFindings(
    findings: readonly WorkerFinding[],
    entries: readonly CheckClassification[],
    where: { readonly slug?: string; readonly layered: boolean },
): { readonly findings: RecordedFinding[]; readonly unmatched: string[] } {
    const keyOf = (layer: string, file: string, code: string, line: number): string =>
        `${layer}\u0000${file}\u0000${code}\u0000${String(line)}`;
    const byKey = new Map<string, CheckClassification>();
    const used = new Set<string>();
    for (const entry of entries) {
        if (entry.slug !== where.slug) {
            continue;
        }
        for (const line of entry.lines) {
            byKey.set(keyOf(entry.layer ?? 'game', entry.file, entry.code, line), entry);
        }
    }
    const out = findings.map((f): RecordedFinding => {
        const layer = where.layered ? f.layer : 'game';
        const key = keyOf(layer, f.file, f.code, f.line);
        const entry = byKey.get(key);
        if (entry !== undefined) {
            used.add(key);
        }
        return {
            file: f.file,
            ...(where.layered ? { layer: f.layer } : {}),
            line: f.line,
            column: f.column,
            code: f.code,
            message: f.message,
            classification: entry?.classification ?? 'unclassified',
            ...(entry === undefined ? {} : { reason: entry.reason }),
        };
    });
    const unmatched = [...byKey]
        .filter(([key]) => !used.has(key))
        .map(([key, entry]) => {
            const line = key.slice(key.lastIndexOf('\u0000') + 1);
            const mod = entry.slug === undefined ? '' : `${entry.slug}: `;
            return `${mod}${entry.file}:${line} ${entry.code}`;
        });
    return { findings: out, unmatched };
}

/** How many findings have each classification, every class named. */
export function classCounts(
    findings: readonly RecordedFinding[],
    classes: readonly string[],
): Record<string, number> {
    const counts: Record<string, number> = Object.fromEntries(
        [...classes, 'unclassified'].map((c) => [c, 0]),
    );
    for (const f of findings) {
        const c = f.classification ?? 'unclassified';
        counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
}

// ─── Release 2.3.0's results ───────────────────────────────────────────────

/** An error of release 2.3.0's result baselines, where it is. */
interface BaselineError {
    readonly file: string;
    readonly line: number;
}

/** The errors of 2.3.0 and of this run at the same file and line, and those of only one. */
export function compareErrors(
    ours: readonly { readonly file: string; readonly line: number }[],
    theirs: readonly BaselineError[],
): { errors_at_same_line: number; errors_only_2_3_0: number; errors_only_here: number } {
    const at = (e: { file: string; line: number }): string => `${e.file}:${String(e.line)}`;
    const mine = new Set(ours.map(at));
    const old = new Set(theirs.map(at));
    return {
        errors_at_same_line: ours.filter((e) => old.has(at(e))).length,
        errors_only_2_3_0: theirs.filter((e) => !mine.has(at(e))).length,
        errors_only_here: ours.filter((e) => !old.has(at(e))).length,
    };
}

function errorList(value: unknown): BaselineError[] {
    return Array.isArray(value)
        ? value.filter(isObject).map((e) => ({ file: String(e['file']), line: Number(e['line']) }))
        : [];
}

// ─── The suites ────────────────────────────────────────────────────────────

const SEVERITIES = ['error', 'warning', 'information', 'hint'] as const;

function bySeverity(
    byCode: readonly { severity: string; count: number }[],
): Record<string, number> {
    const out: Record<string, number> = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
    for (const row of byCode) {
        out[row.severity] = (out[row.severity] ?? 0) + row.count;
    }
    return out;
}

/** The record's `by_code`: most first within a severity, the severities in order. */
function byCodeRows(
    byCode: readonly { code: string; severity: string; count: number }[],
): { code: string; severity: string; count: number }[] {
    const rank = (s: string): number => (SEVERITIES as readonly string[]).indexOf(s);
    return [...byCode].sort(
        (a, b) =>
            rank(a.severity) - rank(b.severity) ||
            b.count - a.count ||
            (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    );
}

const round = (n: number): number => Math.round(n);

export interface CheckSuiteInput {
    readonly root: string;
    readonly gameDir: string;
    /** The classification file of the base game's errors and warnings. */
    readonly classificationsFile: string;
}

/** `task game:check`: every check on the base game's own files. */
export function runCheckSuite(input: CheckSuiteInput): Record<string, unknown> {
    const entries = readCheckClassifications(input.classificationsFile, GAME_CLASSES);
    const run = runCheckWorker({
        mode: 'game',
        root: input.root,
        gameDir: input.gameDir,
        cacheDir: null,
    });
    const check = run.check;
    if (check === null) {
        throw new CommandError('the check worker reported no check', EXIT.failed);
    }
    const errors = check.listed.filter((f) => f.severity === 'error');
    const warnings = check.listed.filter((f) => f.severity === 'warning');
    const classifiedErrors = classifyFindings(errors, entries, { layered: true });
    const classifiedWarnings = classifyFindings(warnings, entries, { layered: true });
    const listed = [...classifiedErrors.findings, ...classifiedWarnings.findings];
    const failures: string[] = [];
    for (const f of listed) {
        if (f.classification === 'unclassified') {
            failures.push(`unclassified: ${f.layer ?? ''}/${f.file}:${String(f.line)} ${f.code}`);
        } else if (f.classification === 'pychivalry-fault') {
            failures.push(
                `a pychivalry fault to fix: ${f.layer ?? ''}/${f.file}:${String(f.line)} ${f.code}`,
            );
        }
    }
    // An entry matches nothing only if neither list used it.
    const unmatched = classifiedErrors.unmatched.filter((u) =>
        classifiedWarnings.unmatched.includes(u),
    );
    for (const u of unmatched) {
        failures.push(`classification matches no finding: ${u}`);
    }
    const baseline = readJson(
        path.join(input.root, 'records', 'baseline-2.3.0', 'results-base-game.json'),
    );
    const base =
        isObject(baseline) && isObject(baseline['results'])
            ? baseline['results']['base_game']
            : undefined;
    const oldCheck = isObject(base) && isObject(base['check']) ? base['check'] : {};
    const oldScope = isObject(base) && isObject(base['scope']) ? base['scope'] : {};
    return {
        passed: failures.length === 0,
        failures,
        files: check.files,
        files_by_layer: check.files_by_layer,
        by_severity: bySeverity(check.by_code),
        by_code: byCodeRows(check.by_code),
        errors: errors.length,
        error_list: classifiedErrors.findings,
        warnings: warnings.length,
        warning_list: classifiedWarnings.findings,
        classified: classCounts(listed, GAME_CLASSES),
        capped: check.capped,
        scope: check.scope,
        baseline_2_3_0: {
            errors: errorList(oldCheck['error_list']).length,
            ...compareErrors(errors, errorList(oldCheck['error_list'])),
            keyword_uses: Number(oldScope['keyword_uses'] ?? 0),
            keyword_uses_judged: Number(oldScope['keyword_uses_judged'] ?? 0),
        },
        time_ms: {
            list: round(run.ms.list),
            build: round(run.ms.build),
            check: round(run.ms.check),
            total: round(run.ms.total),
        },
        peak_rss_kib: run.peak_rss_kib,
    };
}

export interface ModsSuiteInput {
    readonly root: string;
    readonly gameDir: string;
    readonly corpus: { readonly dir: string; readonly slugs: readonly string[] };
    /** The classification file of the corpus mods' errors. */
    readonly classificationsFile: string;
    /** Where to make the temporary cache folder; the system's temporary folder by default. */
    readonly tempParent?: string;
}

/** `task game:mods`: every check on each corpus mod, over the base game. */
export function runModsSuite(input: ModsSuiteInput): Record<string, unknown> {
    const entries = readCheckClassifications(input.classificationsFile, MOD_CLASSES);
    const failures: string[] = [];
    const cacheDir = mkdtempSync(path.join(input.tempParent ?? tmpdir(), 'pychivalry-mods-'));
    const baseline = readJson(
        path.join(input.root, 'records', 'baseline-2.3.0', 'results-mods.json'),
    );
    const oldMods =
        isObject(baseline) &&
        isObject(baseline['results']) &&
        Array.isArray(baseline['results']['mods'])
            ? baseline['results']['mods'].filter(isObject)
            : [];
    try {
        const base = { root: input.root, gameDir: input.gameDir, cacheDir };
        const prepare = runCheckWorker({ mode: 'prepare', ...base });
        const mods: Record<string, unknown>[] = [];
        for (const slug of input.corpus.slugs) {
            const run = runCheckWorker({
                mode: 'mod',
                ...base,
                modDir: path.join(input.corpus.dir, slug),
                slug,
            });
            const check = run.check;
            if (check === null) {
                throw new CommandError(`${slug}: the check worker reported no check`, EXIT.failed);
            }
            if (!run.from_cache) {
                failures.push(`${slug}: the base game was not read from the cache`);
            }
            const errors = check.listed.filter((f) => f.severity === 'error');
            const warnings = check.listed.filter((f) => f.severity === 'warning');
            const classified = classifyFindings(errors, entries, { slug, layered: false });
            for (const f of classified.findings) {
                if (f.classification === 'unclassified') {
                    failures.push(
                        `${slug}: an error not shown to be a real defect: ${f.file}:${String(f.line)} ${f.code}`,
                    );
                } else if (f.classification === 'pychivalry-fault') {
                    failures.push(
                        `${slug}: a pychivalry fault to fix: ${f.file}:${String(f.line)} ${f.code}`,
                    );
                }
            }
            for (const u of classified.unmatched) {
                failures.push(`classification matches no error: ${u}`);
            }
            const old = oldMods.find((m) => m['slug'] === slug);
            const oldErrors = errorList(old?.['error_list']);
            mods.push({
                slug,
                files: check.files,
                not_checked: check.not_checked,
                by_severity: bySeverity(check.by_code),
                by_code: byCodeRows(check.by_code),
                errors: errors.length,
                error_list: classified.findings,
                warnings: warnings.length,
                warning_list: warnings.map((f) => ({
                    file: f.file,
                    line: f.line,
                    column: f.column,
                    code: f.code,
                    message: f.message,
                })),
                classified: classCounts(classified.findings, MOD_CLASSES.slice(0, 3)),
                capped: check.capped,
                scope: check.scope,
                // Null for a mod release 2.3.0's result baseline did not run.
                baseline_2_3_0:
                    old === undefined
                        ? null
                        : {
                              files: Number(old['files'] ?? 0),
                              by_severity: old['by_severity'],
                              errors: oldErrors.length,
                              ...compareErrors(errors, oldErrors),
                          },
                time_ms: {
                    load_base: round(run.ms.list + run.ms.load),
                    check: round(run.ms.check),
                    total: round(run.ms.total),
                },
                peak_rss_kib: run.peak_rss_kib,
            });
        }
        // Entries for a mod the run did not read are not checked against anything.
        for (const entry of entries) {
            if (entry.slug === undefined) {
                failures.push(
                    `classification without a mod: ${entry.file} ${entry.code} (every entry of the mods' file names its slug)`,
                );
            }
        }
        return {
            passed: failures.length === 0,
            failures,
            base_game_cache: {
                build_ms: round(prepare.ms.list + prepare.ms.build + prepare.ms.save),
                peak_rss_kib: prepare.peak_rss_kib,
            },
            mods,
        };
    } finally {
        rmSync(cacheDir, { recursive: true, force: true });
    }
}
