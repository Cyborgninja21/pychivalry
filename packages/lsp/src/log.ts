/**
 * The game's log shown against the mod's files (docs/PLAN.md item 11.7; docs/game-log.md): what
 * the language server answers the editor's two log requests with. The analysis is the core's
 * (`analyzeLog`), over the server's own index, the one report the command line and the agent
 * server give; this file only turns its places in the mod into diagnostics, apart from
 * pychivalry's own (the editor keeps them in a collection of their own).
 *
 * - **`pychivalry/logFolders`**: the game's log folders on this system (`logFolders`), each with
 *   whether it holds an `error.log`, so the editor can offer them; nothing is read but the
 *   folders' listing.
 * - **`pychivalry/log`**: one log read (only read) and analysed; a diagnostic for every place in
 *   the mod a message ties to, with the log's line and the game's own text; the totals, and the
 *   count of lines no message matches and of places in the base game, which are not shown.
 */

import {
    analyzeLog,
    ERROR_LOG,
    fillPlaceholders,
    logFolders,
    logShape,
    LogShapeError,
    type LogFolderSearch,
    type LogReport,
    type LogTie,
    type Spec,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** The request for the game's log folders. */
export const LOG_FOLDERS_REQUEST = 'pychivalry/logFolders';

/** The request that reads one log and answers its places in the mod. */
export const LOG_REQUEST = 'pychivalry/log';

/** The most diagnostics one log gives; the rest are counted. */
export const LOG_DIAGNOSTICS_LIMIT = 5_000;

/** The largest log read, in bytes. */
export const LARGEST_LOG = 256 * 1024 * 1024;

/** A log folder, as the editor is told it. */
export interface LogFolderAnswer {
    readonly dir: string;
    readonly kind: string;
    readonly basis: string;
    readonly how: string;
    /** The error log in it, or null when it holds none. */
    readonly errorLog: string | null;
}

/** What `pychivalry/log` takes; what it leaves out, the settings say (`log.*`). */
export interface LogParams {
    /** A log file, or a folder whose `error.log` is read. */
    readonly log?: string | null;
    /** The line prefix and the place format, as regular expressions; empty or absent for none. */
    readonly prefix?: string | null;
    readonly location?: string | null;
}

/** A place in the mod a message of the log is about. */
export interface LogDiagnostic {
    readonly uri: string;
    readonly range: {
        readonly start: { readonly line: number; readonly character: number };
        readonly end: { readonly line: number; readonly character: number };
    };
    /** The log's line, the game's own text, and what ties it here. */
    readonly message: string;
    /** The catalogue entry (or the equally good entries joined by `|`). */
    readonly code: string;
    /** The log's line it is from, counted from 1. */
    readonly line: number;
}

/** What `pychivalry/log` answers. */
export interface LogAnswer {
    /** The log read, or null when it could not be. */
    readonly log: string | null;
    /** Why it could not be read or analysed; null when it was. */
    readonly error: string | null;
    readonly totals: LogReport['totals'] | null;
    readonly diagnostics: readonly LogDiagnostic[];
    /** Places beyond `LOG_DIAGNOSTICS_LIMIT`, not shown. */
    readonly notShown: number;
    /** Places in the base game, which the editor does not show. */
    readonly inGame: number;
}

/** The log folders of this system, and the error log each holds. */
export function logFolderAnswers(search: LogFolderSearch): LogFolderAnswer[] {
    return logFolders(search).map((f) => {
        const file = path.join(f.dir, ERROR_LOG);
        return { ...f, errorLog: existsSync(file) ? file : null };
    });
}

/** Why a tie is where it is, in a few words. */
function why(t: LogTie): string {
    switch (t.kind) {
        case 'file':
            return t.line === null
                ? 'the file it names; the line is not known'
                : 'the place it names';
        case 'definition':
            return `the definition of ${t.name ?? ''}`;
        case 'use':
            return `where the mod writes ${t.name ?? ''}`;
    }
}

/**
 * One log read and analysed over the index, its places in the mod as diagnostics; `uriOf` gives
 * the URI of a file of the mod.
 */
export function logAnswer(
    params: LogParams,
    spec: Spec,
    index: WorkspaceIndex | null,
    uriOf: (file: string) => string | null,
): LogAnswer {
    const failed = (error: string, log: string | null = null): LogAnswer => ({
        log,
        error,
        totals: null,
        diagnostics: [],
        notShown: 0,
        inGame: 0,
    });
    let file = params.log ?? '';
    if (file === '') {
        return failed('no log given');
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
        file = path.join(file, ERROR_LOG);
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
        return failed(`no such log: ${file}`);
    }
    if (statSync(file).size > LARGEST_LOG) {
        return failed(`${file} is larger than ${String(LARGEST_LOG)} bytes: not read`, file);
    }
    let shape;
    try {
        shape = logShape({ prefix: params.prefix ?? null, location: params.location ?? null });
    } catch (err) {
        if (err instanceof LogShapeError) {
            return failed(err.message, file);
        }
        throw err;
    }
    const report = analyzeLog({ spec, index, log: readFileSync(file), shape });
    const diagnostics: LogDiagnostic[] = [];
    let notShown = 0;
    let inGame = 0;
    const name = path.basename(file);
    for (const m of report.messages) {
        for (const o of m.occurrences) {
            const text = fillPlaceholders(m.text.trim(), o.values);
            for (const t of o.ties) {
                if (t.layer !== 'mod') {
                    inGame++;
                    continue;
                }
                const uri = uriOf(t.file);
                if (uri === null) {
                    continue;
                }
                if (diagnostics.length >= LOG_DIAGNOSTICS_LIMIT) {
                    notShown++;
                    continue;
                }
                diagnostics.push({
                    uri,
                    range: t.range,
                    message: `${name} line ${String(o.line)}: ${text} (${why(t)})`,
                    code: m.key,
                    line: o.line,
                });
            }
        }
    }
    return { log: file, error: null, totals: report.totals, diagnostics, notShown, inGame };
}
