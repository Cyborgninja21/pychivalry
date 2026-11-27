/**
 * The in-game load, the authoring run's third grade (docs/MVP.md, "AI first", 4; docs/PLAN.md
 * item 11.8; docs/game-log-capture.md, "The in-game load"): designed and built, never run
 * without the owner's word (`guard.ts`, checked first). It sits beside the capture, not in
 * `scored-run/`, whose scripts start no program but Claude Code; the tools' `scored in-game-load`
 * runs it over a result the authoring run kept.
 *
 * For a result of the authoring run: its base mod is loaded in the game on the analysis machine
 * and the log captured (`capture.ts`); then the result, the same build, the same options; and the
 * two logs are compared. **The grade holds when the result's log adds no line that names one of
 * its files** (the files the session added or changed): for each such file, the lines of the
 * result's log that name it are counted, less those of the base mod's log that name it (a file
 * at the same path in the base mod or the base game is named in both). A line names a file when
 * it holds the file's path inside the mod, written with `/` or `\`, in any letter case (the
 * analysis machine is Windows, whose paths fold case). The added lines are kept, and each is read
 * against the catalogue (`analyzeLog`) to say which message it is.
 *
 * What the grade proves is "no new error at load that names the content's files"; whether the
 * game reports, at load, a defect in content that never runs is MVP.md's open question 2, which
 * the planted-defect capture answers (item 11.5): the measure is named for what that shows.
 */

import { analyzeLog, openSpec, type Spec } from '@pychivalry/core';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { capture, type CaptureRecord, type Start } from './capture.js';
import { ownersWord } from './guard.js';

/** The files of a result the session added or changed against its base mod, with `/`. */
export function contentFiles(baseDir: string, resultDir: string): string[] {
    const files = (dir: string, rel = ''): string[] =>
        readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
            const r = rel === '' ? e.name : `${rel}/${e.name}`;
            if (e.isDirectory()) {
                return e.name === '.claude' ? [] : files(dir, r);
            }
            return [r];
        });
    const digest = (file: string): string =>
        createHash('sha256').update(readFileSync(file)).digest('hex');
    return files(resultDir)
        .filter((r) => r !== 'descriptor.mod')
        .filter((r) => {
            const base = path.join(baseDir, ...r.split('/'));
            return (
                !existsSync(base) ||
                !statSync(base).isFile() ||
                digest(base) !== digest(path.join(resultDir, ...r.split('/')))
            );
        })
        .sort();
}

/** A line of a log that names a file of the content. */
export interface NamingLine {
    readonly file: string;
    /** Its line in the log, counted from 1. */
    readonly line: number;
    readonly text: string;
    /** The catalogue messages it is: one, several equally good, or none. */
    readonly messages: readonly string[];
}

/** The in-game load grade of one result. */
export interface LoadGrade {
    /** True when the result's log adds no line naming one of its files. */
    readonly held: boolean;
    readonly files: readonly string[];
    /** Per file: lines naming it in the base mod's log and in the result's, and how many more. */
    readonly counts: readonly {
        readonly file: string;
        readonly without: number;
        readonly with: number;
        readonly added: number;
    }[];
    /** The result's lines naming a file the base mod's log names fewer times. */
    readonly added: readonly NamingLine[];
}

/** The lines of a log, as text: Windows line breaks and a byte-order mark set aside. */
function lines(log: Uint8Array): string[] {
    const text = Buffer.from(log)
        .toString('utf8')
        .replace(/^\uFEFF/, '');
    const out = text.split('\n').map((l) => l.replace(/\r$/, ''));
    if (out[out.length - 1] === '') {
        out.pop();
    }
    return out;
}

/** Whether a line names a file: its path, either separator, any letter case. */
function names(line: string, file: string): boolean {
    return line.replaceAll('\\', '/').toLowerCase().includes(file.toLowerCase());
}

/** The grade, from the base mod's log, the result's log and the result's files. */
export function inGameLoadGrade(
    spec: Spec,
    without: Uint8Array,
    withContent: Uint8Array,
    files: readonly string[],
): LoadGrade {
    const before = lines(without);
    const after = lines(withContent);
    const report = analyzeLog({ spec, index: null, log: withContent });
    const messagesAt = new Map<number, string[]>();
    for (const m of report.messages) {
        for (const o of m.occurrences) {
            for (let l = o.line; l <= o.end_line; l++) {
                messagesAt.set(l, [...m.ids]);
            }
        }
    }
    const counts = files.map((file) => {
        const w = before.filter((l) => names(l, file)).length;
        const r = after.filter((l) => names(l, file)).length;
        return { file, without: w, with: r, added: Math.max(0, r - w) };
    });
    const added: NamingLine[] = [];
    for (const c of counts) {
        if (c.added === 0) {
            continue;
        }
        after.forEach((text, i) => {
            if (names(text, c.file)) {
                added.push({
                    file: c.file,
                    line: i + 1,
                    text,
                    messages: messagesAt.get(i + 1) ?? [],
                });
            }
        });
    }
    return { held: counts.every((c) => c.added === 0), files: [...files], counts, added };
}

export interface InGameLoadOptions {
    readonly ownersWord: string | undefined;
    readonly decisionsFile: string;
    readonly specDir: string;
    readonly installDir: string;
    readonly start: Start;
    readonly options: readonly string[];
    readonly userDir: string;
    /** The result's base mod and the result itself. */
    readonly baseDir: string;
    readonly resultDir: string;
    /** A new folder: the two captures go in `without/` and `with/`. */
    readonly outDir: string;
    readonly quietSeconds?: number;
    readonly timeoutSeconds?: number;
    readonly pollMs?: number;
    readonly log?: (line: string) => void;
}

/** One result through the in-game load: two captures, then the grade. */
export async function inGameLoad(options: InGameLoadOptions): Promise<{
    readonly grade: LoadGrade;
    readonly without: CaptureRecord;
    readonly with: CaptureRecord;
}> {
    // The guard first, before the two captures check it again.
    ownersWord(options.ownersWord, options.decisionsFile);
    const shared = {
        ownersWord: options.ownersWord,
        decisionsFile: options.decisionsFile,
        installDir: options.installDir,
        start: options.start,
        options: options.options,
        userDir: options.userDir,
        ...(options.quietSeconds === undefined ? {} : { quietSeconds: options.quietSeconds }),
        ...(options.timeoutSeconds === undefined ? {} : { timeoutSeconds: options.timeoutSeconds }),
        ...(options.pollMs === undefined ? {} : { pollMs: options.pollMs }),
        ...(options.log === undefined ? {} : { log: options.log }),
    };
    const without = await capture({
        ...shared,
        mods: [options.baseDir],
        outDir: path.join(options.outDir, 'without'),
    });
    const withContent = await capture({
        ...shared,
        mods: [options.resultDir],
        outDir: path.join(options.outDir, 'with'),
    });
    const read = (dir: string): Uint8Array => {
        const file = path.join(options.outDir, dir, 'logs', 'error.log');
        return existsSync(file) ? readFileSync(file) : new Uint8Array();
    };
    const grade = inGameLoadGrade(
        openSpec(options.specDir),
        read('without'),
        read('with'),
        contentFiles(options.baseDir, options.resultDir),
    );
    return { grade, without, with: withContent };
}
