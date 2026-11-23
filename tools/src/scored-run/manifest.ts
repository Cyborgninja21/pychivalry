/**
 * The planted-defect manifest, `fixtures/defects/manifest.json` (docs/PLAN.md item 6.7): each
 * defect planted in `fixtures/defects/mod/`, at least one per error and warning code, and each
 * line there that looks wrong and is not. The graders read it (item 6.9), and so does the scored run (item 6.8).
 *
 * The format (`manifest_format` 1). Lines are counted from 1 in `mod/`, files are paths inside
 * the mod with `/`:
 *
 * - `game`: the base game the mod is checked over, a game stub's `game` folder, from the
 *   repository root.
 * - `defects[]`: `code` (a check code: every error and warning code at least once, a code
 *   more than once where the mod plants it again), `file` and `line` (where the checker reports
 *   it), `text` (that line, exactly), `what` (the defect in words), `reported` (every place the
 *   checker reports it, when that is more than `file` and `line`: a clash is reported at each
 *   definition), and `fix`: where a fix may change the mod. Each entry of `fix` names a `file`
 *   and `lines` (`[first, last]`, the lines a fix may change or remove) or `insert`
 *   (`[after_first, after_last]`: a fix may add lines after any line of that range, 0 being
 *   before the first line), or both. Lines may also be added next to the `lines` of an entry
 *   that gives no `insert`: after any line from `first - 1` to `last`.
 * - `look_alikes[]`: `file`, `line`, `text` (exactly) and `why` it is right.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isObject } from '../util.js';

/** Where a fix may change a file of the mod. */
export interface FixRange {
    readonly file: string;
    /** The lines a fix may change or remove, from 1, inclusive; absent when none. */
    readonly lines?: readonly [number, number];
    /**
     * After which lines a fix may add lines (0: before the first), inclusive; by default
     * `[lines[0] - 1, lines[1]]`.
     */
    readonly insert?: readonly [number, number];
}

export interface Place {
    readonly file: string;
    readonly line: number;
}

export interface PlantedDefect {
    readonly code: string;
    readonly file: string;
    readonly line: number;
    readonly text: string;
    readonly what: string;
    readonly reported?: readonly Place[];
    readonly fix: readonly FixRange[];
}

export interface LookAlike {
    readonly file: string;
    readonly line: number;
    readonly text: string;
    readonly why: string;
}

export interface DefectManifest {
    readonly manifest_format: 1;
    readonly about: string;
    readonly game: string;
    readonly defects: readonly PlantedDefect[];
    readonly look_alikes: readonly LookAlike[];
}

/** The planted-defect fixture, from the repository root. */
export const DEFECTS_DIR = 'fixtures/defects';

/** The places a defect is reported at. */
export function reportedAt(defect: PlantedDefect): readonly Place[] {
    return defect.reported ?? [{ file: defect.file, line: defect.line }];
}

/** The lines after which an entry of `fix` lets a fix add lines, or null for none. */
export function insertRange(range: FixRange): readonly [number, number] | null {
    if (range.insert !== undefined) {
        return range.insert;
    }
    return range.lines === undefined ? null : [range.lines[0] - 1, range.lines[1]];
}

function isPair(value: unknown): value is [number, number] {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((n) => Number.isInteger(n) && (n as number) >= 0) &&
        (value[0] as number) <= (value[1] as number)
    );
}

function isText(value: unknown): value is string {
    return typeof value === 'string';
}

function isPlace(value: unknown): value is Place {
    return (
        isObject(value) &&
        isText(value['file']) &&
        Number.isInteger(value['line']) &&
        (value['line'] as number) >= 1
    );
}

/** The shape problems of a parsed manifest; empty when it is one. */
export function manifestShapeProblems(value: unknown): string[] {
    const problems: string[] = [];
    if (!isObject(value)) {
        return ['the manifest is not a JSON object'];
    }
    if (value['manifest_format'] !== 1) {
        problems.push('manifest_format is not 1');
    }
    for (const key of ['about', 'game'] as const) {
        if (!isText(value[key]) || value[key] === '') {
            problems.push(`${key} is not a text`);
        }
    }
    const defects = value['defects'];
    if (!Array.isArray(defects)) {
        problems.push('defects is not a list');
    } else {
        defects.forEach((d: unknown, i) => {
            const where = `defects[${String(i)}]`;
            if (!isObject(d) || !isPlace(d) || !isText(d['code']) || !isText(d['text'])) {
                problems.push(`${where}: needs code, file, line and text`);
                return;
            }
            if (!isText(d['what']) || d['what'] === '') {
                problems.push(`${where}: needs what`);
            }
            const reported = d['reported'];
            if (reported !== undefined && (!Array.isArray(reported) || !reported.every(isPlace))) {
                problems.push(`${where}: reported is not a list of places`);
            }
            const fix = d['fix'];
            if (!Array.isArray(fix) || fix.length === 0) {
                problems.push(`${where}: fix is not a list of ranges`);
                return;
            }
            fix.forEach((r: unknown, j) => {
                const ok =
                    isObject(r) &&
                    isText(r['file']) &&
                    (r['lines'] === undefined || isPair(r['lines'])) &&
                    (r['insert'] === undefined || isPair(r['insert'])) &&
                    (r['lines'] !== undefined || r['insert'] !== undefined) &&
                    (r['lines'] === undefined || (r['lines'] as number[])[0] !== 0);
                if (!ok) {
                    problems.push(
                        `${where}.fix[${String(j)}]: needs a file and lines [first, last] from 1 or insert [after_first, after_last] from 0`,
                    );
                }
            });
        });
    }
    const looks = value['look_alikes'];
    if (!Array.isArray(looks)) {
        problems.push('look_alikes is not a list');
    } else {
        looks.forEach((l: unknown, i) => {
            if (!isPlace(l) || !isText((l as unknown as LookAlike).text)) {
                problems.push(`look_alikes[${String(i)}]: needs file, line and text`);
            } else if (!isText((l as unknown as LookAlike).why)) {
                problems.push(`look_alikes[${String(i)}]: needs why`);
            }
        });
    }
    return problems;
}

/** Read and check the shape of a manifest; throws with every problem when it is not one. */
export function readManifest(file: string): DefectManifest {
    const value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const problems = manifestShapeProblems(value);
    if (problems.length > 0) {
        throw new Error(`${file} is not a defect manifest:\n  ${problems.join('\n  ')}`);
    }
    return value as DefectManifest;
}

/** The committed manifest, from the repository root. */
export function committedManifest(root: string): DefectManifest {
    return readManifest(path.join(root, DEFECTS_DIR, 'manifest.json'));
}

/**
 * A file's lines as the graders compare them: split at `\n` or `\r\n`, a last empty line (the
 * file's final newline) left out. A byte-order mark stays part of the first line.
 */
export function linesOf(text: string): string[] {
    const lines = text.split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}
