/**
 * `format <file|folder>...`: the files of a mod formatted by pychivalry's rules
 * (docs/formatting.md; docs/PLAN.md item 8.9), the same text the editor's Format Document and the
 * agent server's `format` tool give.
 *
 * - **What is formatted:** a folder's script and localization files that the game reads (the
 *   `.txt` and `.yml` files of the folders the spec package lists, as `check` reads them), and
 *   each file named, which must be one of them. Links are not followed.
 * - **The mod:** `--mod <folder>`, or the nearest folder at or above the first path given that
 *   holds a `descriptor.mod`, otherwise the first path given when it is a folder, otherwise the
 *   working folder. Every path given must be inside it: nothing outside the mod is touched.
 * - **Left as it is:** a file with a parse error, or quoted text never closed, and a file that
 *   is not valid UTF-8 (writing it back would lose the bytes the decoder replaced); each is
 *   named on standard error with the reason.
 * - **Written in place** by default, the byte-order mark and the format's line breaks included;
 *   `--check` writes nothing and exits with 1 when a file would change; `--diff` writes nothing
 *   and prints what would change as a unified diff.
 *
 * Exit codes: 0, or 1 with `--check` when a file would change; 2 on bad usage, a path outside
 * the mod or that does not exist, or a file named that is not one the game reads.
 */

import {
    decodeScript,
    folderTableFromSpec,
    formatKindOf,
    formatText,
    leftMessage,
    listMod,
    type FormatEdit,
} from '@pychivalry/core';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { InputError, oneValue, type Parsed } from './args.js';
import { EXIT, type Command } from './command.js';
import { readSpecOption, SPEC_OPTION } from './inputs.js';
import type { Io } from './io.js';

/** The file a folder must hold to be taken as the mod. */
const DESCRIPTOR = 'descriptor.mod';

/** The nearest folder at or above `from` that holds a `descriptor.mod`, or null. */
function descriptorAbove(from: string): string | null {
    let dir = from;
    for (;;) {
        if (existsSync(path.join(dir, DESCRIPTOR))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

/** The mod: `--mod`, or found from the first path given (module comment). */
function modFolder(parsed: Parsed, io: Io, paths: readonly string[]): string {
    const given = oneValue(parsed, '--mod');
    if (given !== undefined) {
        const dir = path.resolve(io.cwd, given);
        if (!existsSync(dir) || !statSync(dir).isDirectory()) {
            throw new InputError(`--mod: ${dir} is not a folder`);
        }
        return realpathSync(dir);
    }
    const first = realpathSync(paths[0] ?? io.cwd);
    const folder = statSync(first).isDirectory();
    const found = descriptorAbove(folder ? first : path.dirname(first));
    if (found !== null) {
        return found;
    }
    return folder ? first : realpathSync(io.cwd);
}

/** The path of `file` inside `dir` with `/`, or null when it is not inside. */
function inside(dir: string, file: string): string | null {
    const rel = path.relative(dir, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

/** What became of one file. */
interface Outcome {
    readonly file: string;
    readonly state: 'formatted' | 'unchanged' | 'left';
    readonly reason?: string;
    readonly diff?: string;
}

/** The lines of a text, each without its line break, and where each starts. */
function lines(text: string): { lines: string[]; starts: number[] } {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === 10 || (c === 13 && text.charCodeAt(i + 1) !== 10)) {
            starts.push(i + 1);
        }
    }
    const out = starts.map((s, n) =>
        text.slice(s, starts[n + 1] ?? text.length).replace(/\r?\n$|\r$/, ''),
    );
    if (
        out.length > 1 &&
        out[out.length - 1] === '' &&
        (starts[starts.length - 1] ?? 0) === text.length
    ) {
        out.pop();
        starts.pop();
    }
    return { lines: out, starts };
}

/** The line (from 0) holding an offset. */
function lineAt(starts: readonly number[], offset: number): number {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if ((starts[mid] ?? 0) <= offset) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return low;
}

/** How many lines of context a diff's hunk shows around a change. */
const CONTEXT = 3;

/**
 * A unified diff of the formatter's change to one file, built from its edits (they say exactly
 * where the text changes). Lines are shown without their line breaks; a change of line break or
 * of the byte-order mark alone is said in a note.
 */
export function unifiedDiff(
    file: string,
    before: string,
    after: string,
    edits: readonly FormatEdit[],
): string {
    const a = lines(before);
    const b = lines(after);
    const spans: { a0: number; a1: number; b0: number; b1: number }[] = [];
    let delta = 0;
    for (const edit of edits) {
        if (edit.start === 0 && edit.end === 0 && edit.text === '\uFEFF') {
            // The mark: said in a note, it is no line.
            delta += 1;
            continue;
        }
        const a0 = lineAt(a.starts, edit.start);
        const a1 = lineAt(a.starts, Math.max(edit.start, edit.end - 1));
        const start = edit.start + delta;
        const b0 = lineAt(b.starts, start);
        const b1 = lineAt(b.starts, Math.max(start, start + edit.text.length - 1));
        delta += edit.text.length - (edit.end - edit.start);
        const last = spans[spans.length - 1];
        if (last !== undefined && a0 <= last.a1 + 2 * CONTEXT) {
            last.a1 = Math.max(last.a1, a1);
            last.b1 = Math.max(last.b1, b1);
        } else {
            spans.push({ a0, a1, b0, b1 });
        }
    }
    const out = [`--- a/${file}`, `+++ b/${file}`];
    if (before.startsWith('\uFEFF') !== after.startsWith('\uFEFF')) {
        out.push(
            after.startsWith('\uFEFF')
                ? '# the byte-order mark is added'
                : '# the byte-order mark is removed',
        );
    }
    for (const span of spans) {
        const from = Math.max(0, span.a0 - CONTEXT);
        const to = Math.min(a.lines.length - 1, span.a1 + CONTEXT);
        const bFrom = Math.max(0, span.b0 - (span.a0 - from));
        const bTo = Math.min(b.lines.length - 1, span.b1 + (to - span.a1));
        out.push(
            `@@ -${String(from + 1)},${String(to - from + 1)} +${String(bFrom + 1)},${String(bTo - bFrom + 1)} @@`,
        );
        for (let n = from; n < span.a0; n++) {
            out.push(` ${(a.lines[n] ?? '').replace(/^\uFEFF/, '')}`);
        }
        for (let n = span.a0; n <= span.a1; n++) {
            out.push(`-${(a.lines[n] ?? '').replace(/^\uFEFF/, '')}`);
        }
        for (let n = span.b0; n <= span.b1; n++) {
            out.push(`+${(b.lines[n] ?? '').replace(/^\uFEFF/, '')}`);
        }
        for (let n = span.a1 + 1; n <= to; n++) {
            out.push(` ${a.lines[n] ?? ''}`);
        }
    }
    return `${out.join('\n')}\n`;
}

/** Format one file of the mod: its outcome, and its new text written unless `dryRun`. */
function formatOne(modDir: string, file: string, dryRun: boolean, diff: boolean): Outcome {
    const kind = formatKindOf(file);
    const disk = path.join(modDir, ...file.split('/'));
    const bytes = readFileSync(disk);
    const decoded = decodeScript(bytes);
    if (kind === undefined) {
        return { file, state: 'left', reason: 'not a script or localization file' };
    }
    if (!decoded.validUtf8) {
        return {
            file,
            state: 'left',
            reason: 'left as it is: the file is not valid UTF-8, and writing it back would lose the bytes that were replaced',
        };
    }
    const text = (decoded.bom ? '\uFEFF' : '') + decoded.text;
    const result = formatText(text, kind);
    if (result.left !== null) {
        return { file, state: 'left', reason: leftMessage(result.left) };
    }
    if (!result.changed) {
        return { file, state: 'unchanged' };
    }
    if (!dryRun) {
        writeFileSync(disk, result.text);
    }
    return {
        file,
        state: 'formatted',
        ...(diff ? { diff: unifiedDiff(file, text, result.text, result.edits) } : {}),
    };
}

export const formatCommand: Command = {
    name: 'format',
    args: '<file|folder>...',
    summary:
        "Formats a mod's script and localization files by pychivalry's rules, in place, or checks them (--check)",
    options: [
        { name: '--check', help: 'write nothing; exit with 1 when a file would change' },
        { name: '--diff', help: 'write nothing; print what would change as a unified diff' },
        {
            name: '--mod',
            value: '<mod>',
            help: 'the mod folder; by default the folder holding descriptor.mod at or above the first path, or that path',
        },
        SPEC_OPTION,
    ],
    positionals: { min: 1, max: null },
    run(parsed: Parsed, io: Io): number {
        const check = parsed.flags.has('--check');
        const diff = parsed.flags.has('--diff');
        const given = parsed.positionals.map((p) => path.resolve(io.cwd, p));
        for (const p of given) {
            if (!existsSync(p)) {
                throw new InputError(`no such file or folder: ${p}`);
            }
        }
        const modDir = modFolder(parsed, io, given);
        const spec = readSpecOption(parsed, io);
        const listed = new Set(
            listMod(modDir, folderTableFromSpec(spec.data)).files.map((f) => f.path),
        );
        const chosen = new Set<string>();
        for (const p of given) {
            const real = realpathSync(p);
            const rel = inside(modDir, real);
            if (rel === null) {
                throw new InputError(
                    `${p} is outside the mod ${modDir}: nothing outside it is formatted`,
                );
            }
            if (statSync(real).isDirectory()) {
                for (const file of listed) {
                    if (rel === '' || file === rel || file.startsWith(`${rel}/`)) {
                        chosen.add(file);
                    }
                }
            } else if (listed.has(rel)) {
                chosen.add(rel);
            } else {
                throw new InputError(
                    `${rel} is not a script or localization file the game reads in this mod (a .txt file of a folder the spec package lists, or a .yml file under localization/)`,
                );
            }
        }
        const dryRun = check || diff;
        const outcomes = [...chosen].sort().map((f) => formatOne(modDir, f, dryRun, diff));
        const out: string[] = [];
        for (const o of outcomes) {
            if (o.state === 'left') {
                io.stderr(`${o.file}: ${o.reason ?? ''}\n`);
            } else if (o.state === 'formatted') {
                if (diff) {
                    out.push((o.diff ?? '').replace(/\n$/, ''));
                } else {
                    out.push(`${dryRun ? 'would change' : 'formatted'}  ${o.file}`);
                }
            }
        }
        const count = (state: Outcome['state']): number =>
            outcomes.filter((o) => o.state === state).length;
        const changed = count('formatted');
        const files = (n: number): string => `${String(n)} ${n === 1 ? 'file' : 'files'}`;
        out.push(
            `${files(changed)} ${dryRun ? 'would change' : 'formatted'}, ${files(count('unchanged'))} already formatted, ${files(count('left'))} left as ${count('left') === 1 ? 'it is' : 'they are'}`,
        );
        io.stdout(`${out.join('\n')}\n`);
        return check && changed > 0 ? EXIT.found : EXIT.ok;
    },
};
