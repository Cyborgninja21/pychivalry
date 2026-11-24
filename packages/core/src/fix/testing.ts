/**
 * Helpers for the fixes' tests: a fixture mod copied to a scratch folder, checked by the one
 * runner over a game stub, and a fix applied to the copy the way an editor or `check --fix`
 * applies it. Not part of the package's surface.
 */

import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkWorkspace, type WorkspaceCheck, type WorkspaceFinding } from '../check/workspace.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { decodeScript, type FallbackEncoding } from '../syntax/decode.js';
import { applyFixes } from './apply.js';
import type { FixAlternative } from './fix.js';

/** A scratch folder, removed when the process exits. */
export function scratch(prefix = 'pychivalry-fix-'): string {
    const dir = mkdtempSync(path.join(tmpdir(), prefix));
    process.on('exit', () => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A fixture under `fixtures/`, by its path there. */
export function fixturePath(relative: string): string {
    return path.join(REPO_ROOT, 'fixtures', ...relative.split('/'));
}

/** The game folder of a stub under `fixtures/game/`. */
export function stubGame(name: string): string {
    return fixturePath(`game/${name}/game`);
}

/** A copy of a mod in a scratch folder. */
export function copyMod(from: string): string {
    const to = path.join(scratch(), 'mod');
    cpSync(from, to, { recursive: true });
    return to;
}

/** A mod written from files given as text, in a scratch folder. */
export function writeMod(files: Readonly<Record<string, string>>): string {
    const dir = path.join(scratch(), 'mod');
    for (const [file, text] of Object.entries(files)) {
        const at = path.join(dir, ...file.split('/'));
        mkdirSync(path.dirname(at), { recursive: true });
        writeFileSync(at, text);
    }
    return dir;
}

/** The one runner's check of a mod over a game folder, with no cache. */
export function checkMod(modDir: string, gameDir: string | null): WorkspaceCheck {
    return checkWorkspace({
        spec: committedSpec(),
        modDir,
        gameDir,
        cacheDir: null,
        platform: 'linux',
    });
}

/**
 * The one runner's check of a fixture mod with no game and no cache, read with a fallback
 * encoding when one is given; `files` replaces files of it, by their path in the mod, in a copy.
 */
export function checkFixtureMod(
    modDir: string,
    fallbackEncoding?: FallbackEncoding,
    files?: Readonly<Record<string, Uint8Array>>,
): WorkspaceCheck {
    let dir = modDir;
    if (files !== undefined) {
        dir = copyMod(modDir);
        for (const [file, bytes] of Object.entries(files)) {
            writeFileSync(path.join(dir, ...file.split('/')), bytes);
        }
    }
    return checkWorkspace({
        spec: committedSpec(),
        modDir: dir,
        gameDir: null,
        cacheDir: null,
        platform: 'linux',
        fallbackEncoding,
    });
}

/** Apply alternatives to a mod on disk, as `check --fix` does; returns the files written. */
export function applyToMod(modDir: string, alternatives: readonly FixAlternative[]): string[] {
    const read = (file: string): string | null => {
        const at = path.join(modDir, ...file.split('/'));
        if (!existsSync(at)) {
            return null;
        }
        // As the runner reads it: a file that is not valid UTF-8 with U+FFFD for each stretch.
        const decoded = decodeScript(readFileSync(at));
        return `${decoded.bom ? '\ufeff' : ''}${decoded.text}`;
    };
    const { files } = applyFixes(alternatives, read);
    for (const [file, text] of files) {
        const at = path.join(modDir, ...file.split('/'));
        mkdirSync(path.dirname(at), { recursive: true });
        writeFileSync(at, text);
    }
    return [...files.keys()];
}

/** The errors and warnings of a run, counted by code. */
export function seriousByCode(findings: readonly WorkspaceFinding[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const f of findings) {
        if (f.severity === 'error' || f.severity === 'warning') {
            out.set(f.code, (out.get(f.code) ?? 0) + 1);
        }
    }
    return out;
}

/** Every finding of a run, counted by code. */
export function allByCode(findings: readonly WorkspaceFinding[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const f of findings) {
        out.set(f.code, (out.get(f.code) ?? 0) + 1);
    }
    return out;
}

/**
 * What applying one alternative of a finding's fix to a copy of the mod did: problems, empty
 * when its finding went (one fewer of its code) and no error or warning of any code came in.
 */
export function proveAlternative(
    modDir: string,
    gameDir: string | null,
    finding: WorkspaceFinding,
    alternative: FixAlternative,
    before: readonly WorkspaceFinding[],
): string[] {
    const copy = copyMod(modDir);
    applyToMod(copy, [alternative]);
    const after = checkMod(copy, gameDir).findings;
    const problems: string[] = [];
    const where = `${finding.file}:${String(finding.range.start.line + 1)} ${finding.code} "${alternative.title}"`;
    const was = allByCode(before).get(finding.code) ?? 0;
    const is = allByCode(after).get(finding.code) ?? 0;
    if (is >= was) {
        problems.push(`${where}: its finding stays (${String(was)} before, ${String(is)} after)`);
    }
    const serious = seriousByCode(before);
    const fixedSerious = finding.severity === 'error' || finding.severity === 'warning' ? 1 : 0;
    for (const [code, count] of seriousByCode(after)) {
        const allowed = (serious.get(code) ?? 0) - (code === finding.code ? fixedSerious : 0);
        if (count > allowed) {
            const added = after
                .filter((f) => f.code === code)
                .map((f) => `${f.file}:${String(f.range.start.line + 1)} ${f.message}`);
            problems.push(
                `${where}: ${code} ${String(count)} after, at most ${String(allowed)} allowed: ${added.join('; ')}`,
            );
        }
    }
    return problems;
}
