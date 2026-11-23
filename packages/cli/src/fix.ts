/**
 * `check --fix`: the safe fixes of the findings a check keeps (docs/PLAN.md item 8.7), applied
 * to the mod's files, the way an editor applies them; then the mod is checked again and
 * reported as `check` reports it. Only a safe fix is applied: one whose finding has one outcome
 * that can be right, checked by construction in the core (`fix/verify.ts`). A suggestion is
 * never applied: it is a choice.
 *
 * - **`--dry-run`** writes nothing and prints the edits: in text, each fix's file, place, code
 *   and title, then each edit's file, span and new text; with `--json`, a `{"fix": ...}` line
 *   per fix. The exit code is that of the check.
 * - **What is left alone:** a fix whose edits overlap one taken before it (the first in file
 *   order is taken; check again to fix the rest), and every fix of a file that is not valid
 *   UTF-8, whose bytes the decoder replaced: writing it back would lose them.
 * - **The files** keep their byte-order mark and line breaks; only the edited spans change.
 */

import {
    applyFixes,
    type FixAlternative,
    type FixEdit,
    type WorkspaceFinding,
} from '@pychivalry/core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** A safe fix to apply: the finding it is for, and its one alternative. */
export interface PlannedFix {
    readonly finding: WorkspaceFinding;
    readonly alternative: FixAlternative;
}

/** What `--fix` did or, with `--dry-run`, would do. */
export interface FixRun {
    readonly applied: readonly PlannedFix[];
    /** Safe fixes left for another run: their edits overlap one applied before them. */
    readonly skipped: number;
    /** Safe fixes of files that are not valid UTF-8, left alone. */
    readonly notUtf8: number;
    /** The files written (or that would be), by their path inside the mod, sorted. */
    readonly files: readonly string[];
    readonly dryRun: boolean;
}

/** The path of a file of the mod on disk. */
function onDisk(modDir: string, file: string): string {
    return path.join(modDir, ...file.split('/'));
}

/**
 * Apply the safe fixes of `findings` (those the filters keep) to the mod in `modDir`, or only
 * plan them (`dryRun`); `all` is every finding of the run, which says the files that are not
 * valid UTF-8.
 */
export function applySafeFixes(
    modDir: string,
    findings: readonly WorkspaceFinding[],
    dryRun: boolean,
    all: readonly WorkspaceFinding[] = findings,
): FixRun {
    const notUtf8 = new Set(all.filter((f) => f.code === 'encoding/not-utf8').map((f) => f.file));
    const planned: PlannedFix[] = [];
    let left = 0;
    for (const finding of findings) {
        const alternative =
            finding.fix?.safety === 'safe' ? finding.fix.alternatives[0] : undefined;
        if (alternative === undefined) {
            continue;
        }
        if (alternative.edits.some((e) => notUtf8.has(e.file))) {
            left++;
            continue;
        }
        planned.push({ finding, alternative });
    }
    const read = (file: string): string | null => {
        const at = onDisk(modDir, file);
        return existsSync(at) ? readFileSync(at, 'utf8') : null;
    };
    const { files, taken } = applyFixes(
        planned.map((p) => p.alternative),
        read,
    );
    const applied = planned.filter((p) => taken.includes(p.alternative));
    if (!dryRun) {
        for (const [file, text] of files) {
            const at = onDisk(modDir, file);
            mkdirSync(path.dirname(at), { recursive: true });
            writeFileSync(at, text);
        }
    }
    return {
        applied,
        skipped: planned.length - applied.length,
        notUtf8: left,
        files: [...files.keys()].sort(),
        dryRun,
    };
}

function span(edit: FixEdit): string {
    const r = edit.range;
    return `${String(r.start.line + 1)}:${String(r.start.character + 1)}-${String(r.end.line + 1)}:${String(r.end.character + 1)}`;
}

/** The planned edits as text: each fix, then each of its edits with the new text as JSON. */
export function renderPlan(run: FixRun): string {
    const lines: string[] = [];
    for (const { finding, alternative } of run.applied) {
        const at = `${String(finding.range.start.line + 1)}:${String(finding.range.start.character + 1)}`;
        lines.push(`${finding.file}:${at}  ${finding.code}  ${alternative.title}`);
        for (const edit of alternative.edits) {
            lines.push(
                `    ${edit.file} ${span(edit)}${edit.create === true ? ' (new file)' : ''} -> ${JSON.stringify(edit.new_text)}`,
            );
        }
    }
    lines.push(summaryLine(run));
    return `${lines.join('\n')}\n`;
}

/** One line saying what was applied, or would be. */
export function summaryLine(run: FixRun): string {
    const n = run.applied.length;
    const verb = run.dryRun ? 'would be applied (dry run: nothing written)' : 'applied';
    const rest: string[] = [];
    if (run.skipped > 0) {
        rest.push(
            `${String(run.skipped)} left for another run, their edits overlapping one applied`,
        );
    }
    if (run.notUtf8 > 0) {
        rest.push(`${String(run.notUtf8)} in files that are not valid UTF-8 left alone`);
    }
    return `${String(n)} safe fixes in ${String(run.files.length)} files ${verb}${rest.length === 0 ? '' : `; ${rest.join('; ')}`}`;
}

/** The planned fix as one JSON object, for `--json --dry-run`. */
export function plannedJson(fix: PlannedFix): Record<string, unknown> {
    return {
        fix: {
            file: fix.finding.file,
            range: fix.finding.range,
            code: fix.finding.code,
            title: fix.alternative.title,
            edits: fix.alternative.edits,
        },
    };
}

/** What `--fix` did, for the JSON summary. */
export function fixSummaryJson(run: FixRun): Record<string, unknown> {
    return {
        applied: run.applied.length,
        files: run.files,
        skipped: run.skipped,
        not_utf8: run.notUtf8,
        dry_run: run.dryRun,
    };
}
