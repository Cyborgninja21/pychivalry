/**
 * `log [<log>]`: the game's own log read against the spec package's error catalogue and tied to
 * the mod's files (docs/PLAN.md items 11.3, 11.4 and 11.6; docs/game-log.md), as text for a
 * person or as one JSON object, the core's `LogReport` as it is. Every line is a catalogue
 * message, tied where its values say, or listed as unmatched; nothing is guessed.
 *
 * - **Which log.** A log file, or a folder whose `error.log` is read; by default the `error.log`
 *   of the first log folder of the game found on this system (`logFolders`: Windows' Documents,
 *   OneDrive's, Linux's `~/.local/share`, the Proton prefix). It is only read.
 * - **What it is tied to.** `--mod` indexes a mod over the base game (`--vanilla`,
 *   `--no-vanilla`, or Steam's libraries) as `calls` does; without either, lines are matched and
 *   nothing is tied.
 * - **The line's shape.** No line prefix and no place format are assumed, since no real log has
 *   been read (docs/game-log.md): `--prefix` and `--location` give them, as regular expressions.
 * - **`--catalogue`** reads no log: it prints what the matcher makes of the catalogue itself,
 *   the templates it matches and cannot, the ambiguous ones, and per family what can be tied.
 *
 * Exit codes: 0 when no message is tied to the mod; 1 when one is; 2 on bad usage.
 */

import {
    analyzeLog,
    catalogueCoverage,
    defaultCacheDir,
    drain,
    ERROR_LOG,
    logFolders,
    logShape,
    LogShapeError,
    openWorkspaceSteps,
    readableMessage,
    type CatalogueCoverage,
    type LogReport,
    type LogTie,
    type Steps,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { InputError, oneValue, type OptionSpec, type Parsed } from './args.js';
import { EXIT, type Command } from './command.js';
import {
    JSON_OPTION,
    NO_VANILLA_OPTION,
    readGameOption,
    readSpecOption,
    SPEC_OPTION,
    VANILLA_OPTION,
} from './inputs.js';
import type { Io } from './io.js';

const MOD_OPTION: OptionSpec = {
    name: '--mod',
    value: '<mod>',
    help: "a mod folder, indexed over the base game, whose files the log's messages are tied to",
};
const PREFIX_OPTION: OptionSpec = {
    name: '--prefix',
    value: '<pattern>',
    help: 'what the game writes before each message on a line, as a regular expression; by default none is assumed',
};
const LOCATION_OPTION: OptionSpec = {
    name: '--location',
    value: '<pattern>',
    help: 'how a message writes a place in a script file, as a regular expression naming (?<file>...) and optionally (?<line>...) and (?<column>...); by default none is assumed',
};
const CATALOGUE_OPTION: OptionSpec = {
    name: '--catalogue',
    help: 'read no log: what the matcher makes of the catalogue (matched, ambiguous, not matched, what each family can be tied to)',
};

/** The most bytes of a log read: a larger one is refused, not read in part. */
export const LARGEST_LOG = 256 * 1024 * 1024;

function isDirectory(p: string): boolean {
    return existsSync(p) && statSync(p).isDirectory();
}

function count(n: number): string {
    return n.toLocaleString('en-US');
}

/** Where a tie is: `<layer> <file>:<line>:<column>`, both counted from 1, or `<layer> <file>`. */
function tieText(t: LogTie): string {
    const where =
        t.kind === 'file' && t.line === null
            ? `${t.layer} ${t.file} (line not known)`
            : `${t.layer} ${t.file}:${String(t.range.start.line + 1)}:${String(t.range.start.character + 1)}`;
    switch (t.kind) {
        case 'file':
            return `file${t.line === 'location' ? ' (line from --location)' : ''}: ${where}`;
        case 'definition':
            return `definition of ${t.name ?? ''} (${t.database ?? ''}): ${where}`;
        case 'use':
            return `use of ${t.name ?? ''}: ${where}`;
    }
}

/** A report as text. */
export function logText(file: string, report: LogReport): string {
    const t = report.totals;
    const lines = [
        `${file}: ${count(report.lines.total)} lines, ${count(t.matched)} messages (${count(t.ambiguous)} ambiguous), ${count(t.unmatched)} unmatched; tied to the mod ${count(t.tied_to_mod)}, to the base game only ${count(t.tied_to_game)}, not tied ${count(t.not_tied)}`,
        `spec ${report.spec.version}; line prefix: ${report.shape.prefix ?? 'none given'}; place format: ${report.shape.location ?? 'none given'}`,
    ];
    if (report.lines.not_utf8 > 0) {
        lines.push(`${count(report.lines.not_utf8)} lines not UTF-8, read as Windows-1252`);
    }
    for (const m of report.messages) {
        const about = [m.subject, ...m.checks].join('; ');
        lines.push(
            '',
            `${m.ids.join(' or ')} (${about}): ${readableMessage(m.text.trim(), [])} (${count(m.count)} ${m.count === 1 ? 'line' : 'lines'})`,
        );
        for (const o of m.occurrences) {
            const span =
                o.end_line === o.line
                    ? `line ${String(o.line)}`
                    : `lines ${String(o.line)}-${String(o.end_line)}`;
            const notes = [
                o.split === 'unsure' ? 'values split two ways' : '',
                o.starts_with_value ? 'the first value holds the line prefix' : '',
            ].filter((n) => n !== '');
            lines.push(
                `  ${span}: ${o.values.map((v) => JSON.stringify(v)).join(', ')}${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`,
            );
            if (o.inner !== null) {
                lines.push(
                    `    inside value ${String(o.inner.value + 1)}: ${o.inner.ids.join(' or ')}`,
                );
            }
            for (const tie of o.ties) {
                lines.push(`    ${tieText(tie)}`);
            }
            if (o.ties_not_listed > 0) {
                lines.push(`    and ${count(o.ties_not_listed)} more places`);
            }
        }
    }
    if (report.unmatched.length > 0) {
        lines.push('', `unmatched ${count(report.unmatched.length)}:`);
        for (const u of report.unmatched) {
            lines.push(
                `  line ${String(u.line)}${u.why === 'too-long' ? ' (too long to match)' : ''}: ${u.text}`,
            );
        }
    }
    return lines.join('\n');
}

/** What the matcher makes of the catalogue, as text. */
export function catalogueText(version: string, c: CatalogueCoverage): string {
    const inGroups = c.ambiguous.reduce((n, g) => n + g.length, 0);
    const lines = [
        `the catalogue of spec ${version}: ${count(c.entries)} messages`,
        `  matched against log lines: ${count(c.matched)} (${count(c.alone)} alone; ${count(inGroups)} in ${count(c.ambiguous.length)} ambiguous groups; ${count(c.shadowed.length)} shadowed; ${count(c.notFound.length)} not found on their own line)`,
        `  not matched: ${count(c.notMatched.notAMessage.length)} the package marks as no message (--json lists them); ${count(c.notMatched.tooLittleFixedText.length)} with too little fixed text`,
        `  of more than one line: ${c.spans.join(', ')}`,
        '',
        'ambiguous (several entries match one line equally well):',
        ...c.ambiguous.map((g) => `  ${g.join(' | ')}`),
        '',
        'too little fixed text (fewer than two words of three letters):',
        ...c.notMatched.tooLittleFixedText.map((id) => `  ${id}`),
        '',
        'per family (subject): entries, matched, with a line, with a text value, give a place (script_position), no value',
        ...c.families.map(
            (f) =>
                `  ${f.subject}: ${count(f.entries)}, ${count(f.matched)}, ${count(f.with_line)}, ${count(f.with_text)}, ${count(f.give_a_place)}, ${count(f.no_value)}`,
        ),
    ];
    return lines.join('\n');
}

/** The log a positional names, or the error log of the first log folder found. */
function logFile(parsed: Parsed, io: Io, gameDir: string | null): string {
    const given = parsed.positionals[0];
    if (given !== undefined) {
        const target = path.resolve(io.cwd, given);
        if (isDirectory(target)) {
            const inside = path.join(target, ERROR_LOG);
            if (!existsSync(inside)) {
                throw new InputError(`${target} holds no ${ERROR_LOG}`);
            }
            return inside;
        }
        if (!existsSync(target)) {
            throw new InputError(`no such log: ${target}`);
        }
        return target;
    }
    const search = {
        env: io.env,
        platform: io.platform,
        home: io.home,
        gameFolders: () => (gameDir === null ? [] : [gameDir]),
    };
    for (const folder of logFolders(search)) {
        const file = path.join(folder.dir, ERROR_LOG);
        if (existsSync(file)) {
            return file;
        }
    }
    const looked = logFolders(search, true).map((f) => f.dir);
    throw new InputError(
        `no ${ERROR_LOG} found: give a log file or folder; looked in ${looked.join(', ')}`,
    );
}

export const logCommand: Command = {
    name: 'log',
    args: '[<log>]',
    summary:
        "The game's error log read against the error catalogue: every line a catalogue message tied to the mod's files, or listed as unmatched",
    options: [
        MOD_OPTION,
        VANILLA_OPTION,
        NO_VANILLA_OPTION,
        PREFIX_OPTION,
        LOCATION_OPTION,
        CATALOGUE_OPTION,
        SPEC_OPTION,
        JSON_OPTION,
    ],
    positionals: { min: 0, max: 1 },
    run: (parsed: Parsed, io: Io): number => drain(logSteps(parsed, io)),
    steps: logSteps,
};

/** `log`, in steps: a pause after each file of the mod indexed. */
function* logSteps(parsed: Parsed, io: Io): Steps<number> {
    const json = parsed.flags.has('--json');
    const spec = readSpecOption(parsed, io);
    if (parsed.flags.has('--catalogue')) {
        if (parsed.positionals.length > 0) {
            throw new InputError('--catalogue reads no log: leave out the log');
        }
        const coverage = catalogueCoverage(spec);
        io.stdout(`${json ? JSON.stringify(coverage) : catalogueText(spec.version, coverage)}\n`);
        return EXIT.ok;
    }
    let shape;
    try {
        shape = logShape({
            prefix: oneValue(parsed, '--prefix') ?? null,
            location: oneValue(parsed, '--location') ?? null,
        });
    } catch (err) {
        if (err instanceof LogShapeError) {
            throw new InputError(err.message);
        }
        throw err;
    }
    const given = oneValue(parsed, '--mod');
    const modDir = given === undefined ? null : path.resolve(io.cwd, given);
    if (modDir !== null && !isDirectory(modDir)) {
        throw new InputError(`--mod: not a folder: ${modDir}`);
    }
    const game = readGameOption(parsed, io, spec);
    const file = logFile(parsed, io, game.dir);
    if (statSync(file).size > LARGEST_LOG) {
        throw new InputError(`${file} is larger than ${count(LARGEST_LOG)} bytes: not read`);
    }
    let index: WorkspaceIndex | null = null;
    if (game.dir !== null || modDir !== null) {
        const workspace = yield* openWorkspaceSteps({
            spec,
            modDir,
            gameDir: game.dir,
            cacheDir: defaultCacheDir(io.env, io.platform, io.home),
            base: io.base,
        });
        index = workspace.index;
    }
    const report = analyzeLog({ spec, index, log: readFileSync(file), shape });
    io.stdout(`${json ? JSON.stringify({ log: file, ...report }) : logText(file, report)}\n`);
    if (!json && game.notFound) {
        io.stderr(
            'pychivalry: the game was not found in any Steam library and --vanilla was not given: only the mod was read\n',
        );
    }
    return report.totals.tied_to_mod > 0 ? EXIT.found : EXIT.ok;
}
