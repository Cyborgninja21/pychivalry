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
 * - **A file that is not valid UTF-8** is fixed only together with its own `style/not-utf8`
 *   fix, which is applied first: that fix replaces every stretch the decoder read as U+FFFD with
 *   its Windows-1252 letters and writes the file as UTF-8 with a byte-order mark, so no byte is
 *   lost; the file's other safe fixes apply to the same text. Without it (when it is not safe,
 *   or the filters leave it out), every fix of such a file is left alone: writing it back would
 *   lose the bytes the decoder replaced.
 * - **What is left alone:** a fix whose edits overlap one taken before it (the first in file
 *   order is taken; check again to fix the rest).
 * - **The files** keep their byte-order mark and line breaks; only the edited spans change.
 * - **Formatting:** a file's `style/not-formatted` fix formats the whole file, which is every
 *   other formatting fix of the file at once: when it is applied, those are not applied apart.
 *   The best-practice fixes of `style/` are not formatting: a file's conversion to UTF-8 comes
 *   first, and one that overlaps the whole file's formatting waits for another run.
 */

import {
    applyFixes,
    decodeScript,
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
    /** Safe fixes of files that are not valid UTF-8 and are not converted in the run, left alone. */
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
    const notUtf8 = new Set(
        all
            .filter((f) => f.code === 'encoding/not-utf8' || f.code === 'style/not-utf8')
            .map((f) => f.file),
    );
    // A file formatted whole needs none of its other formatting fixes.
    const formatted = new Set(
        findings
            .filter((f) => f.code === 'style/not-formatted' && f.fix?.safety === 'safe')
            .map((f) => f.file),
    );
    const safe = findings.flatMap((finding) => {
        const alternative =
            finding.fix?.safety === 'safe' ? finding.fix.alternatives[0] : undefined;
        return alternative === undefined ? [] : [{ finding, alternative }];
    });
    // A file's conversion to UTF-8 first, so it is always taken; the files it converts.
    const conversions = safe.filter((p) => p.finding.code === 'style/not-utf8');
    const converted = new Set(conversions.map((p) => p.finding.file));
    const planned: PlannedFix[] = [...conversions];
    let left = 0;
    for (const p of safe) {
        if (p.finding.code === 'style/not-utf8') {
            continue;
        }
        if (p.alternative.edits.some((e) => notUtf8.has(e.file) && !converted.has(e.file))) {
            left++;
            continue;
        }
        if (
            p.finding.evidence.kind === 'formatting-rules' &&
            p.finding.code !== 'style/not-formatted' &&
            formatted.has(p.finding.file)
        ) {
            continue;
        }
        planned.push(p);
    }
    const read = (file: string): string | null => {
        const at = onDisk(modDir, file);
        if (!existsSync(at)) {
            return null;
        }
        if (!converted.has(file)) {
            return readFileSync(at, 'utf8');
        }
        // As the runner read it, so the fixes' places hold: U+FFFD for each invalid stretch.
        const decoded = decodeScript(readFileSync(at));
        return `${decoded.bom ? '\ufeff' : ''}${decoded.text}`;
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
