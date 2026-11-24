/**
 * `check <mod>`: every finding pychivalry reports on a mod, from the core's workspace runner
 * (`checkWorkspace`, the one code path every surface runs), as text in release 2.3.0's shape or
 * as JSON lines (docs/PLAN.md items 5.1 to 5.4 and 5.7).
 *
 * - **Text:** each file with findings, then one line per finding,
 *   `  <line>:<column>  <severity>  <code>  <message>` (both counted from 1), where the
 *   finding's data says what is valid there followed by it in parentheses
 *   (`  (add_county_modifier takes landed_title; from character: capital_county, ...)`, the
 *   core's `whatIsValid`), then a blank line; last, `<n> files checked: <e> errors, <w> warnings, <o> other`, the totals of every
 *   finding, `other` being information and hints. When the filters or the limit leave some
 *   findings out, ` (<s> shown)` follows. Notes about the run (no game found, a game of
 *   another build, files not checked) go to standard error.
 * - **JSON:** one object per finding with release 2.3.0's six fields, `file`, `range`,
 *   `severity`, `code`, `message` and `source` (always `engine`: every finding comes from the
 *   core), and beside them `evidence`, `fix` (the core's fix data: safe or a suggestion, its
 *   alternatives and their edits; null when the finding has no mechanical fix) and `data`;
 *   last, `{"summary": ...}`: the tool and its version,
 *   the spec's version and checksum, the game's build and how its index was had, the files
 *   checked and not checked, the counts of every finding by severity and by code, and how many
 *   findings matched the filters and how many were shown, and what the per-file cap dropped.
 * - **The per-file cap:** a file reports at most `MAX_FINDINGS_PER_FILE` findings, its most
 *   severe first (the core's runner); the counts are of the findings kept, and the findings the
 *   cap dropped are counted apart (`capped`, and a note with the text output).
 * - **Filters:** `--severity` and `--code` keep the findings they match; the exit code is
 *   that of the findings kept, so `--code syntax/*` exits 1 only for a syntax error.
 *   `--limit` shortens the listing only.
 * - **`--fix`** applies the safe fixes of the findings the filters keep, then checks again and
 *   reports what is left; `--fix --dry-run` writes nothing and prints the edits (`fix.ts`).
 * - **Unused keys:** `localization/unused-key` runs by default since the owner's word of
 *   2026-11-23 (replacing docs/decisions.md, decision 76); `--no-unused-keys` turns it off.
 * - **Exit codes:** 0 when no finding kept is an error, 1 when one is, 2 on bad usage, a mod
 *   that is not a folder, or a spec or game folder that cannot be read.
 * - **The base game's index** comes from the on-disk cache in the user's cache folder
 *   (`defaultCacheDir`) when it answers for the installed game, so a second run does not read
 *   the base game again.
 */

import {
    checkWorkspaceSteps,
    codesMatching,
    defaultCacheDir,
    drain,
    whatIsValid,
    type Severity,
    type Spec,
    type Steps,
    type WorkspaceCheck,
    type WorkspaceFinding,
} from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {
    InputError,
    listValues,
    oneValue,
    UsageError,
    type OptionSpec,
    type Parsed,
} from './args.js';
import { EXIT, type Command } from './command.js';
import {
    JSON_OPTION,
    NO_VANILLA_OPTION,
    readGameOption,
    readSpecOption,
    SPEC_OPTION,
    VANILLA_OPTION,
    type GameChoice,
} from './inputs.js';
import type { Io } from './io.js';
import {
    applySafeFixes,
    fixSummaryJson,
    plannedJson,
    renderPlan,
    summaryLine,
    type FixRun,
} from './fix.js';
import { TOOL, version } from './version.js';

/** The severities, most severe first. */
export const SEVERITIES: readonly Severity[] = ['error', 'warning', 'information', 'hint'];

const SEVERITY_OPTION: OptionSpec = {
    name: '--severity',
    value: '<severity>',
    repeat: true,
    help: 'keep only findings of these severities: error, warning, information, hint (comma-separated, or the option given again)',
};
const CODE_OPTION: OptionSpec = {
    name: '--code',
    value: '<code>',
    repeat: true,
    help: 'keep only findings of these codes: a code, <family>/* or * (comma-separated, or the option given again)',
};
const LIMIT_OPTION: OptionSpec = {
    name: '--limit',
    value: '<n>',
    help: 'show at most n findings; the summary still counts all of them',
};
const UNUSED_KEYS_OPTION: OptionSpec = {
    name: '--no-unused-keys',
    help: 'do not report localization keys nothing uses (localization/unused-key, on by default)',
};
const FIX_OPTION: OptionSpec = {
    name: '--fix',
    help: 'apply the safe fixes of the findings kept, then check again (a suggestion is never applied)',
};
const DRY_RUN_OPTION: OptionSpec = {
    name: '--dry-run',
    help: 'with --fix: write nothing, and print the edits the safe fixes would make',
};

/** The filters of a run. */
export interface Filters {
    /** The severities kept; null keeps all. */
    readonly severities: ReadonlySet<Severity> | null;
    /** The codes kept; null keeps all. */
    readonly codes: ReadonlySet<string> | null;
    readonly limit: number | null;
}

/** The filters given, each checked: a severity that exists, a code of this build, a number. */
export function readFilters(parsed: Parsed): Filters {
    const severityNames = listValues(parsed, '--severity');
    for (const s of severityNames) {
        if (!(SEVERITIES as readonly string[]).includes(s)) {
            throw new UsageError(
                `--severity: ${s} is not a severity; the severities are ${SEVERITIES.join(', ')}`,
            );
        }
    }
    const patterns = listValues(parsed, '--code');
    const codes = new Set<string>();
    for (const pattern of patterns) {
        const matched = codesMatching(pattern);
        if (matched.length === 0) {
            throw new UsageError(
                `--code: ${pattern} matches no code of this build (pychivalry explain '*' lists them)`,
            );
        }
        for (const code of matched) {
            codes.add(code);
        }
    }
    const limitText = oneValue(parsed, '--limit');
    if (limitText !== undefined && !/^[0-9]+$/.test(limitText)) {
        throw new UsageError(`--limit: ${limitText} is not a whole number`);
    }
    return {
        severities: severityNames.length === 0 ? null : new Set(severityNames as Severity[]),
        codes: patterns.length === 0 ? null : codes,
        limit: limitText === undefined ? null : Number(limitText),
    };
}

/** The findings the filters keep, and those of them shown. */
export function select(
    findings: readonly WorkspaceFinding[],
    filters: Filters,
): { matched: WorkspaceFinding[]; shown: WorkspaceFinding[] } {
    const matched = findings.filter(
        (f) =>
            (filters.severities === null || filters.severities.has(f.severity)) &&
            (filters.codes === null || filters.codes.has(f.code)),
    );
    const shown = filters.limit === null ? matched : matched.slice(0, filters.limit);
    return { matched, shown };
}

/** The counts of findings by severity (every severity named) and by code (sorted). */
export function countFindings(findings: readonly WorkspaceFinding[]): {
    by_severity: Record<Severity, number>;
    by_code: Record<string, number>;
} {
    const bySeverity: Record<Severity, number> = { error: 0, warning: 0, information: 0, hint: 0 };
    const byCode = new Map<string, number>();
    for (const f of findings) {
        bySeverity[f.severity]++;
        byCode.set(f.code, (byCode.get(f.code) ?? 0) + 1);
    }
    return {
        by_severity: bySeverity,
        by_code: Object.fromEntries([...byCode].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    };
}

/** The text output: each file with findings, a line per finding, then the summary line. */
export function renderText(run: WorkspaceCheck, shown: readonly WorkspaceFinding[]): string {
    const lines: string[] = [];
    let current: string | null = null;
    for (const f of shown) {
        if (f.file !== current) {
            if (current !== null) {
                lines.push('');
            }
            lines.push(f.file);
            current = f.file;
        }
        const at = `${String(f.range.start.line + 1)}:${String(f.range.start.character + 1)}`;
        const valid = whatIsValid(f);
        lines.push(
            `  ${at}  ${f.severity}  ${f.code}  ${f.message}${valid === null ? '' : `  (${valid})`}`,
        );
    }
    if (current !== null) {
        lines.push('');
    }
    const counts = countFindings(run.findings).by_severity;
    const other = counts.information + counts.hint;
    const suffix = shown.length < run.findings.length ? ` (${String(shown.length)} shown)` : '';
    lines.push(
        `${String(run.files.length)} files checked: ${String(counts.error)} errors, ${String(counts.warning)} warnings, ${String(other)} other${suffix}`,
    );
    return `${lines.join('\n')}\n`;
}

/** A finding as one JSON object: release 2.3.0's six fields, then the new ones. */
export function findingJson(f: WorkspaceFinding): Record<string, unknown> {
    return {
        file: f.file,
        range: f.range,
        severity: f.severity,
        code: f.code,
        message: f.message,
        source: 'engine',
        evidence: f.evidence,
        fix: f.fix,
        data: f.data,
    };
}

/** The summary object of the JSON output. */
export function summaryJson(
    run: WorkspaceCheck,
    spec: Spec,
    game: GameChoice,
    matched: number,
    shown: number,
): Record<string, unknown> {
    const notChecked = [...run.notChecked].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return {
        tool: TOOL,
        version,
        spec: { version: spec.version, sha256: spec.sha256 },
        game:
            run.game === null
                ? null
                : {
                      build: run.gameBuild,
                      dir: game.dir,
                      found_by: game.source,
                      from_cache: run.game.fromCache,
                      shared: run.game.shared,
                      ms: {
                          list: Math.round(run.game.ms.list),
                          build: Math.round(run.game.ms.build),
                          save: Math.round(run.game.ms.save),
                          load: Math.round(run.game.ms.load),
                      },
                  },
        files_checked: run.files.length,
        files_not_checked: {
            total: notChecked.reduce((n, [, count]) => n + count, 0),
            by_folder: Object.fromEntries(notChecked),
        },
        counts: countFindings(run.findings),
        capped: cappedJson(run),
        matched,
        shown,
    };
}

/** What the per-file cap dropped: the cap, the files it shortened, and the findings by code. */
export function cappedJson(run: WorkspaceCheck): Record<string, unknown> {
    const byCode = new Map<string, number>();
    for (const file of run.capped) {
        for (const row of file.droppedByCode) {
            byCode.set(row.code, (byCode.get(row.code) ?? 0) + row.count);
        }
    }
    return {
        max_per_file: run.maxFindingsPerFile,
        files: run.capped.map((c) => ({ file: c.file, found: c.found, dropped: c.dropped })),
        dropped: run.capped.reduce((n, c) => n + c.dropped, 0),
        by_code: Object.fromEntries([...byCode].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    };
}

/** The notes about a run that go to standard error with the text output. */
function notes(run: WorkspaceCheck, spec: Spec, game: GameChoice): string[] {
    const out: string[] = [];
    if (game.notFound) {
        out.push(
            'the game was not found in any Steam library and --vanilla was not given: names the game defines are not judged',
        );
    }
    if (run.gameBuild !== null && run.gameBuild !== spec.version) {
        out.push(
            `the game is build ${run.gameBuild}; the spec package is for ${spec.version}: names that changed between the two may be judged wrongly`,
        );
    }
    if (run.capped.length > 0) {
        const dropped = run.capped.reduce((n, c) => n + c.dropped, 0);
        out.push(
            `${String(dropped)} findings were dropped from ${String(run.capped.length)} files that had more than ${String(run.maxFindingsPerFile)} each; the most severe of each such file are kept (--json: summary.capped)`,
        );
    }
    const notChecked = [...run.notChecked].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (notChecked.length > 0) {
        const total = notChecked.reduce((n, [, count]) => n + count, 0);
        const folders = notChecked.map(([folder, count]) => `${folder} (${String(count)})`);
        out.push(
            `${String(total)} files in folders the game does not read as script were not checked: ${folders.join(', ')}`,
        );
    }
    return out;
}

function isDirectory(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory();
}

export const checkCommand: Command = {
    name: 'check',
    args: '<mod>',
    summary: 'Check a mod: every finding, file by file, then a summary',
    options: [
        VANILLA_OPTION,
        NO_VANILLA_OPTION,
        SPEC_OPTION,
        JSON_OPTION,
        SEVERITY_OPTION,
        CODE_OPTION,
        LIMIT_OPTION,
        UNUSED_KEYS_OPTION,
        FIX_OPTION,
        DRY_RUN_OPTION,
    ],
    positionals: { min: 1, max: 1 },
    run: (parsed: Parsed, io: Io): number => drain(checkSteps(parsed, io)),
    steps: checkSteps,
};

/** `check`, in steps: a pause after each file of the mod indexed and checked. */
function* checkSteps(parsed: Parsed, io: Io): Steps<number> {
    const filters = readFilters(parsed);
    const fix = parsed.flags.has('--fix');
    const dryRun = parsed.flags.has('--dry-run');
    if (dryRun && !fix) {
        throw new UsageError('--dry-run: only with --fix');
    }
    const modDir = path.resolve(io.cwd, parsed.positionals[0] ?? '');
    if (!isDirectory(modDir)) {
        throw new InputError(`not a folder: ${modDir}`);
    }
    const spec = readSpecOption(parsed, io);
    const game = readGameOption(parsed, io, spec);
    const checkMod = (): Steps<WorkspaceCheck> =>
        checkWorkspaceSteps({
            spec,
            modDir,
            gameDir: game.dir,
            cacheDir: defaultCacheDir(io.env, io.platform, io.home),
            unusedKeys: !parsed.flags.has('--no-unused-keys'),
            base: io.base,
        });
    let run = yield* checkMod();
    let fixed: FixRun | null = null;
    if (fix) {
        fixed = applySafeFixes(
            modDir,
            select(run.findings, { ...filters, limit: null }).matched,
            dryRun,
            run.findings,
        );
        if (!dryRun && fixed.files.length > 0) {
            run = yield* checkMod();
        }
    }
    const { matched, shown } = select(run.findings, filters);
    const json = parsed.flags.has('--json');
    if (fixed?.dryRun === true) {
        if (json) {
            const lines = fixed.applied.map((p) => JSON.stringify(plannedJson(p)));
            lines.push(
                JSON.stringify({
                    summary: {
                        ...summaryJson(run, spec, game, matched.length, 0),
                        fixes: fixSummaryJson(fixed),
                    },
                }),
            );
            io.stdout(`${lines.join('\n')}\n`);
        } else {
            io.stdout(renderPlan(fixed));
        }
    } else if (json) {
        const lines = shown.map((f) => JSON.stringify(findingJson(f)));
        lines.push(
            JSON.stringify({
                summary: {
                    ...summaryJson(run, spec, game, matched.length, shown.length),
                    ...(fixed === null ? {} : { fixes: fixSummaryJson(fixed) }),
                },
            }),
        );
        io.stdout(`${lines.join('\n')}\n`);
    } else {
        io.stdout(renderText(run, shown));
        if (fixed !== null) {
            io.stderr(`pychivalry: ${summaryLine(fixed)}\n`);
        }
        for (const note of notes(run, spec, game)) {
            io.stderr(`pychivalry: ${note}\n`);
        }
    }
    return matched.some((f) => f.severity === 'error') ? EXIT.found : EXIT.ok;
}
