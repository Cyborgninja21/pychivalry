/**
 * The graders of the scored agent-use run (docs/PLAN.md item 6.9; docs/MVP.md, "AI tests"): a
 * trial's result, the copy of `fixtures/defects/mod/` the agent edited, is graded five ways,
 * each on its own, against the untouched `mod/` and the manifest. A trial passes when all five
 * pass.
 *
 * 1. `zero-errors`: the checker reports no error on the result. The checker is the core's one
 *    runner, `checkWorkspace`, over the manifest's game stub, as every surface runs it, with
 *    its defaults: `localization/unused-key` off, as the agent server's `check` answers by
 *    default. The planted mod has no unused key either way (defects.test.ts).
 * 2. `defects-gone`: the checker reports no finding of any planted defect's code, anywhere.
 * 3. `only-planted-lines`: nothing changed outside the planted lines. Every line of `mod/` a
 *    fix removed or changed is in a `fix` range of a defect, every line it added is where a
 *    `fix` range lets lines be added, and no file was added or removed.
 * 4. `look-alikes-untouched`: every look-alike line is still there, unchanged.
 * 5. `nothing-deleted`: no content was deleted. Every file of `mod/` is still there, and no
 *    change to it lost words: in each run of lines a fix removed and added between two kept
 *    lines, the lines added hold at least as many words as the lines removed. A line removed
 *    whose text, less its indentation, a fix added again elsewhere in the file was moved, not
 *    deleted. A word is a run of characters that are not white space, a brace, an operator
 *    (`= < > ! ?`) or a quote, or a quoted text as a whole, outside a comment. A fix changes
 *    words, or adds them; deleting a line or a block, or commenting it out, loses them. Braces
 *    are not words, so removing a stray brace deletes nothing.
 *
 * Lines are compared exactly, except that `\r\n` counts as `\n` and a file's final newline is
 * not a line (`linesOf`).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { checkWorkspace, type Spec, type WorkspaceFinding } from '@pychivalry/core';
import { lineDiff, type LineDiff } from './diff.js';
import { insertRange, linesOf, reportedAt, type DefectManifest } from './manifest.js';

export const GRADERS = [
    'zero-errors',
    'defects-gone',
    'only-planted-lines',
    'look-alikes-untouched',
    'nothing-deleted',
] as const;

export type GraderName = (typeof GRADERS)[number];

export interface GraderResult {
    readonly name: GraderName;
    readonly passed: boolean;
    /** What failed, in words, with paths inside the mod: at most `MAX_PROBLEMS`, then a count. */
    readonly problems: readonly string[];
}

/** The most problems a grader lists; the rest are counted in one more line. */
export const MAX_PROBLEMS = 20;

/** A finding as the graders read it. */
export interface GradedFinding {
    readonly file: string;
    /** From 1. */
    readonly line: number;
    readonly code: string;
    readonly severity: string;
}

/** Every file under `dir`, as paths inside it with `/`, sorted. */
export function filesIn(dir: string): string[] {
    const out: string[] = [];
    const walk = (at: string, rel: string): void => {
        for (const name of readdirSync(at).sort()) {
            const full = path.join(at, name);
            const inside = rel === '' ? name : `${rel}/${name}`;
            if (statSync(full).isDirectory()) {
                walk(full, inside);
            } else {
                out.push(inside);
            }
        }
    };
    walk(dir, '');
    return out;
}

/**
 * The checker's findings on a mod over a game folder: the core's one runner, no cache, with its
 * defaults, as the agent server's `check` answers by default: `localization/unused-key` off
 * unless `unusedKeys` is given (docs/decisions.md, decision 76).
 */
export function checkMod(
    spec: Spec,
    gameDir: string,
    modDir: string,
    options: { readonly unusedKeys?: boolean } = {},
): GradedFinding[] {
    return checkWorkspace({
        spec,
        gameDir,
        cacheDir: null,
        modDir,
        unusedKeys: options.unusedKeys,
    }).findings.map((f: WorkspaceFinding) => ({
        file: f.file,
        line: f.range.start.line + 1,
        code: f.code,
        severity: f.severity,
    }));
}

/** The text with its comments removed: from a `#` outside quotes to the end of its line. */
function withoutComments(text: string): string {
    let out = '';
    let quoted = false;
    let comment = false;
    for (const ch of text.replace(/^\uFEFF/, '')) {
        if (ch === '\n') {
            comment = false;
            quoted = false;
            out += ch;
        } else if (comment) {
            continue;
        } else if (ch === '"') {
            quoted = !quoted;
            out += ch;
        } else if (ch === '#' && !quoted) {
            comment = true;
        } else {
            out += ch;
        }
    }
    return out;
}

/** The words of a file's text, as `nothing-deleted` counts them. */
export function contentWords(text: string): string[] {
    return withoutComments(text).match(/"[^"\n]*"?|[^\s{}=<>!?"]+/g) ?? [];
}

/**
 * The changes of one file that lost words (`nothing-deleted`): per run of changes, the words of
 * the lines removed against those of the lines added, a line moved within the file counting as
 * neither.
 */
function wordsLost(
    file: string,
    old: readonly string[],
    now: readonly string[],
    diff: LineDiff,
): string[] {
    const removedTexts = new Map<string, number>();
    for (const line of diff.removed) {
        const key = (old[line - 1] ?? '').trim();
        removedTexts.set(key, (removedTexts.get(key) ?? 0) + 1);
    }
    const addedTexts = new Map<string, number>();
    for (const { line } of diff.added) {
        const key = (now[line - 1] ?? '').trim();
        addedTexts.set(key, (addedTexts.get(key) ?? 0) + 1);
    }
    const moved = new Map<string, number>();
    for (const [key, count] of removedTexts) {
        moved.set(key, Math.min(count, addedTexts.get(key) ?? 0));
    }
    const movedOut = new Map(moved);
    const movedIn = new Map(moved);
    const take = (left: Map<string, number>, key: string): boolean => {
        const n = left.get(key) ?? 0;
        if (n > 0) {
            left.set(key, n - 1);
            return true;
        }
        return false;
    };
    const lost: string[] = [];
    for (const hunk of diff.hunks) {
        const gone = hunk.removed.filter((l) => !take(movedOut, (old[l - 1] ?? '').trim()));
        const come = hunk.added.filter((l) => !take(movedIn, (now[l - 1] ?? '').trim()));
        const was = gone.reduce((s, l) => s + contentWords(old[l - 1] ?? '').length, 0);
        const is = come.reduce((s, l) => s + contentWords(now[l - 1] ?? '').length, 0);
        if (is < was) {
            const first = hunk.removed[0] ?? 0;
            const last = hunk.removed[hunk.removed.length - 1] ?? 0;
            lost.push(
                `${file}:${String(first)}${last > first ? `-${String(last)}` : ''}: ${String(was - is)} of ${String(was)} words gone`,
            );
        }
    }
    return lost;
}

function graded(name: GraderName, problems: readonly string[]): GraderResult {
    const shown =
        problems.length > MAX_PROBLEMS
            ? [
                  ...problems.slice(0, MAX_PROBLEMS),
                  `and ${String(problems.length - MAX_PROBLEMS)} more`,
              ]
            : [...problems];
    return { name, passed: problems.length === 0, problems: shown };
}

function where(f: GradedFinding): string {
    return `${f.file}:${String(f.line)} ${f.severity} ${f.code}`;
}

export interface GradeInput {
    readonly manifest: DefectManifest;
    /** The untouched mod: `fixtures/defects/mod/`. */
    readonly original: string;
    /** The mod to grade. */
    readonly result: string;
    /** The checker's findings on `result` (`checkMod`). */
    readonly findings: readonly GradedFinding[];
}

/** The five grades of a result, in the order of `GRADERS`. */
export function grade(input: GradeInput): GraderResult[] {
    const { manifest, findings } = input;
    const before = new Map(
        filesIn(input.original).map((f) => [
            f,
            readFileSync(path.join(input.original, ...f.split('/')), 'utf8'),
        ]),
    );
    const after = new Map(
        filesIn(input.result).map((f) => [
            f,
            readFileSync(path.join(input.result, ...f.split('/')), 'utf8'),
        ]),
    );
    const diffs = new Map(
        [...before]
            .filter(([file]) => after.has(file))
            .map(([file, text]) => [file, lineDiff(linesOf(text), linesOf(after.get(file) ?? ''))]),
    );

    const zeroErrors = findings.filter((f) => f.severity === 'error').map(where);

    const defectsLeft: string[] = [];
    for (const defect of manifest.defects) {
        for (const f of findings.filter((x) => x.code === defect.code)) {
            const planted = reportedAt(defect)
                .map((p) => `${p.file}:${String(p.line)}`)
                .join(', ');
            defectsLeft.push(`${where(f)} (planted at ${planted})`);
        }
    }

    const outside: string[] = [];
    for (const file of after.keys()) {
        if (!before.has(file)) {
            outside.push(`${file}: a file added`);
        }
    }
    for (const file of before.keys()) {
        if (!after.has(file)) {
            outside.push(`${file}: a file removed`);
        }
    }
    for (const [file, diff] of diffs) {
        const ranges = manifest.defects.flatMap((d) => d.fix).filter((r) => r.file === file);
        const original = linesOf(before.get(file) ?? '');
        for (const line of diff.removed) {
            if (
                !ranges.some(
                    (r) => r.lines !== undefined && r.lines[0] <= line && line <= r.lines[1],
                )
            ) {
                outside.push(
                    `${file}:${String(line)}: changed or removed, outside the planted lines (${JSON.stringify(original[line - 1])})`,
                );
            }
        }
        const changed = linesOf(after.get(file) ?? '');
        for (const add of diff.added) {
            const allowed = ranges.some((r) => {
                const range = insertRange(r);
                return range !== null && range[0] <= add.after && add.after <= range[1];
            });
            if (!allowed) {
                outside.push(
                    `${file}: a line added after line ${String(add.after)}, outside the planted lines (${JSON.stringify(changed[add.line - 1])})`,
                );
            }
        }
    }

    const touched: string[] = [];
    for (const look of manifest.look_alikes) {
        const diff = diffs.get(look.file);
        if (diff === undefined || (diff.keptAs[look.line - 1] ?? 0) === 0) {
            touched.push(`${look.file}:${String(look.line)}: ${JSON.stringify(look.text)}`);
        }
    }

    const deleted: string[] = [];
    for (const [file, text] of before) {
        const now = after.get(file);
        const diff = diffs.get(file);
        if (now === undefined || diff === undefined) {
            deleted.push(`${file}: removed`);
            continue;
        }
        deleted.push(...wordsLost(file, linesOf(text), linesOf(now), diff));
    }

    return [
        graded('zero-errors', zeroErrors),
        graded('defects-gone', defectsLeft),
        graded('only-planted-lines', outside),
        graded('look-alikes-untouched', touched),
        graded('nothing-deleted', deleted),
    ];
}

/** Check a result with the checker over the manifest's game stub, and grade it. */
export function gradeMod(options: {
    readonly root: string;
    readonly spec: Spec;
    readonly manifest: DefectManifest;
    readonly original: string;
    readonly result: string;
}): { readonly findings: GradedFinding[]; readonly grades: GraderResult[] } {
    const gameDir = path.join(options.root, ...options.manifest.game.split('/'));
    const findings = checkMod(options.spec, gameDir, options.result);
    return {
        findings,
        grades: grade({
            manifest: options.manifest,
            original: options.original,
            result: options.result,
            findings,
        }),
    };
}
