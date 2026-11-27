/**
 * `analyze_log`: the game's own log read against the spec package's error catalogue and tied to
 * the files of the mod and the base game (docs/PLAN.md items 11.3, 11.4 and 11.6;
 * docs/game-log.md), the same answer as the command line's `log --json`.
 *
 * - **Which log.** A log file, or a folder whose `error.log` is read, inside one of the game's log
 *   folders the server found when it started (Windows' Documents and OneDrive's, Linux's
 *   `~/.local/share`, the Proton prefix: `logFolders`), a folder it was given (`--logs`), or the
 *   mod's own folder. With none given, the `error.log` of the first of those folders that holds
 *   one. Nothing else on the disk is read, and the log is only read.
 * - **Answered whole by message, as `lookup` answers by name.** The totals come every time; then
 *   each message of the catalogue the log holds, with every line of it and every place it ties
 *   to (each place says its layer, and outside the mod `read_with: "source"`), the messages
 *   about the mod first. Messages that do not fit one result are named in `not_answered`, to ask
 *   for with `messages`; there is no cursor. A message with more lines than one result holds is
 *   written smaller (`detail: "cut"`): its count whole, as many lines as fit, the rest counted.
 * - **Lines no message matches** are listed as they are, as many as fit, the rest counted;
 *   never guessed at.
 * - **No line prefix or place format is assumed** (no real log has been read): `line_prefix` and
 *   `location` give them, as regular expressions.
 */

import {
    analyzeLog,
    ERROR_LOG,
    logShape,
    LogShapeError,
    LONGEST_SHAPE,
    readableMessage,
    type LogMessage,
    type LogOccurrence,
    type LogReport,
    type LogTie,
} from '@pychivalry/core';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { placeOf } from '../places.js';
import { BadInput, RESULT_BUDGET, sizeOf, valueList } from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import { NOTES, PLACE, type Tool } from '../tool.js';

export interface AnalyzeLogArgs {
    readonly log?: string;
    readonly messages?: readonly string[];
    readonly unmatched?: boolean;
    readonly line_prefix?: string;
    readonly location?: string;
}

/** The most messages one call may ask for. */
export const MAX_MESSAGES = 50;

/** The largest log read, in bytes; a larger one is refused, not read in part. */
export const LARGEST_LOG = 64 * 1024 * 1024;

/** The most characters of an unmatched line, and of what precedes a message, shown. */
export const LINE_SHOWN = 300;

/** What `not_answered` says to do. */
export const ASK_AGAIN =
    'These messages did not fit in this result: ask analyze_log for them in another call, with messages set to these keys and the same log, line_prefix and location. analyze_log has no cursor and no pages: every message it answers is answered whole';

const COUNT: Schema = { type: 'integer', minimum: 0 };

function cut(text: string): string {
    return text.length <= LINE_SHOWN ? text : `${text.slice(0, LINE_SHOWN)}…`;
}

/** A tie as the tool writes it: its place, written as every place is, and what it is. */
function tieOf(t: LogTie): Record<string, unknown> {
    const out: Record<string, unknown> = { kind: t.kind, ...placeOf(t.layer, t.file, t.range) };
    if (t.kind === 'file') {
        out['line_from'] = t.line ?? 'not-known';
    }
    if (t.name !== null) {
        out['name'] = t.name;
    }
    if (t.database !== null) {
        out['database'] = t.database;
    }
    out['value'] = t.value + 1;
    out['from'] = t.from;
    return out;
}

/** An occurrence as the tool writes it. */
function occurrenceOf(o: LogOccurrence): Record<string, unknown> {
    const out: Record<string, unknown> = { line: o.line };
    if (o.end_line !== o.line) {
        out['end_line'] = o.end_line;
    }
    if (o.before !== '') {
        out['before'] = cut(o.before);
    }
    out['values'] = o.values.map(cut);
    if (o.split === 'unsure') {
        out['split'] = 'unsure';
    }
    if (o.starts_with_value) {
        out['starts_with_value'] = true;
    }
    if (o.inner !== null) {
        out['inner'] = {
            value: o.inner.value + 1,
            ids: o.inner.ids,
            values: o.inner.values.map(cut),
        };
    }
    out['ties'] = o.ties.map(tieOf);
    if (o.ties_not_listed > 0) {
        out['ties_not_listed'] = o.ties_not_listed;
    }
    return out;
}

/** A message with its first `shown` occurrences. */
function messageOf(m: LogMessage, shown: number): Record<string, unknown> {
    const listed = m.occurrences.slice(0, shown);
    const out: Record<string, unknown> = {
        key: m.key,
        ids: m.ids,
        message: readableMessage(m.text.trim(), []),
        subject: m.subject,
        script_facing: m.script_facing,
        checks: m.checks,
        count: m.count,
        occurrences: listed.map(occurrenceOf),
    };
    if (listed.length < m.occurrences.length) {
        out['not_listed'] = m.occurrences.length - listed.length;
        out['detail'] = 'cut';
    }
    return out;
}

/** A message that fits `room` characters: whole, or as many of its lines as fit. */
function fittedMessage(m: LogMessage, room: number): Record<string, unknown> {
    const whole = messageOf(m, m.occurrences.length);
    if (sizeOf(whole) <= room) {
        return whole;
    }
    let low = 0;
    let high = m.occurrences.length;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (sizeOf(messageOf(m, mid)) <= room) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return messageOf(m, low);
}

const TIE: Schema = {
    type: 'object',
    properties: {
        kind: {
            type: 'string',
            enum: ['file', 'definition', 'use'],
            description:
                'file: a file a value of the message names; definition: where a name the message names is defined; use: where the mod writes a name the message names that nothing defines',
        },
        ...PLACE.properties,
        line_from: {
            type: 'string',
            enum: ['message', 'location', 'not-known'],
            description:
                "file only: where its line came from, the message's own text (line N, file:N) or the location pattern given; not-known when neither gives one, and the place is then the file's first line",
        },
        name: { type: 'string', description: 'definition and use: the name' },
        database: { type: 'string', description: 'definition: its folder, or a language' },
        value: {
            type: 'integer',
            minimum: 1,
            description: "The message's value it was read from, counted from 1",
        },
        from: {
            type: 'string',
            enum: ['message', 'inner'],
            description: 'inner when the value is one of the message inside this one',
        },
    },
    required: ['kind', ...(PLACE.required ?? []), 'value', 'from'],
};

const OCCURRENCE: Schema = {
    type: 'object',
    properties: {
        line: {
            type: 'integer',
            minimum: 1,
            description: "The log's line it is on, counted from 1",
        },
        end_line: {
            type: 'integer',
            minimum: 1,
            description: 'For a message of several lines, its last',
        },
        before: {
            type: 'string',
            description:
                "What precedes the message on its line: the game's line prefix, not known in advance, or the prefix line_prefix took off",
        },
        values: {
            type: 'array',
            items: { type: 'string' },
            description: "The message's values, in order",
        },
        split: {
            type: 'string',
            enum: ['unsure'],
            description: 'Present when the line splits into the values in more than one way',
        },
        starts_with_value: {
            type: 'boolean',
            description:
                'Present when the message starts with a text value and no line_prefix was given: that first value holds the line prefix too',
        },
        inner: {
            type: 'object',
            properties: {
                value: { type: 'integer', minimum: 1 },
                ids: { type: 'array', items: { type: 'string' } },
                values: { type: 'array', items: { type: 'string' } },
            },
            required: ['value', 'ids', 'values'],
            description:
                'A catalogue message that is one of the values: the message the game wrapped',
        },
        ties: { type: 'array', items: TIE, description: 'The places it is about, the mod first' },
        ties_not_listed: COUNT,
    },
    required: ['line', 'values', 'ties'],
};

const MESSAGE: Schema = {
    type: 'object',
    properties: {
        key: {
            type: 'string',
            description:
                'The catalogue entry, or equally good entries joined by |: what messages takes',
        },
        ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Its catalogue entries: two or more when ambiguous',
        },
        message: { type: 'string', description: "The game's own text, each value written <value>" },
        subject: { type: 'string', description: "The catalogue's family of the message" },
        script_facing: { type: 'string', enum: ['yes', 'no', 'unknown'] },
        checks: {
            type: 'array',
            items: { type: 'string' },
            description:
                "pychivalry's codes whose evidence is this message: explain_code says what each finds",
        },
        count: COUNT,
        occurrences: {
            type: 'array',
            items: OCCURRENCE,
            description: 'Its lines in the log, in order',
        },
        not_listed: COUNT,
        detail: {
            type: 'string',
            enum: ['cut'],
            description: 'Present when its lines are listed in part',
        },
    },
    required: [
        'key',
        'ids',
        'message',
        'subject',
        'script_facing',
        'checks',
        'count',
        'occurrences',
    ],
};

/** A path the agent gave, as a log file inside a folder the server may read logs from. */
function logPath(session: Session, given: string | undefined): string {
    const allowed = [...session.logDirs, session.modDir];
    const inside = (file: string): boolean => {
        let real: string;
        try {
            real = realpathSync(file);
        } catch {
            return false;
        }
        return allowed.some((dir) => {
            let base: string;
            try {
                base = realpathSync(dir);
            } catch {
                return false;
            }
            const rel = path.relative(base, real);
            return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
        });
    };
    const where =
        session.logDirs.length === 0
            ? `no log folder of the game was found; the mod folder ${session.modDir} is the only one read`
            : `the folders read are ${valueList([...session.logDirs, session.modDir], 3_000)}`;
    if (given === undefined) {
        for (const dir of session.logDirs) {
            const file = path.join(dir, ERROR_LOG);
            if (existsSync(file) && statSync(file).isFile()) {
                return file;
            }
        }
        throw new BadInput(
            `log: none given and no ${ERROR_LOG} found in the game's log folders; ${where}`,
        );
    }
    let target = path.resolve(session.modDir, given);
    if (existsSync(target) && statSync(target).isDirectory()) {
        target = path.join(target, ERROR_LOG);
    }
    if (!existsSync(target)) {
        throw new BadInput(`log: no such file ${target}; ${where}`);
    }
    if (!inside(target)) {
        throw new BadInput(`log: ${target} is outside the folders analyze_log reads; ${where}`);
    }
    if (!statSync(target).isFile()) {
        throw new BadInput(`log: ${target} is not a file`);
    }
    if (statSync(target).size > LARGEST_LOG) {
        throw new BadInput(`log: ${target} is larger than ${String(LARGEST_LOG)} bytes: not read`);
    }
    return target;
}

export const analyzeLogTool: Tool<AnalyzeLogArgs> = {
    name: 'analyze_log',
    title: "Read the game's error log against the mod",
    description: [
        "The game's own log (error.log) read against the game's error catalogue: every line that is one of its messages, grouped by message, each tied to the places it is about (a file and line the message names, the definition of a name it names, or where the mod writes a name nothing defines), the messages about the mod first; and every line that is no message of the catalogue, listed as it is.",
        "With no log given it reads error.log in the game's log folder. Each message comes with the pychivalry codes whose evidence it is (explain_code says what they find) and its catalogue family.",
        'Every message is answered whole: those that do not fit one result are listed in not_answered, to ask for with messages; there is no cursor.',
        'No line prefix or place format is assumed, since how the game writes them is not yet known: line_prefix and location give them as regular expressions when you know them.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            log: {
                type: 'string',
                minLength: 1,
                description: `A log file, or a folder whose ${ERROR_LOG} is read, in the game's log folder or the mod's folder; by default the game's ${ERROR_LOG}`,
            },
            messages: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                maxItems: MAX_MESSAGES,
                description: `Only these messages, by the key an earlier result gave (not_answered); at most ${String(MAX_MESSAGES)}`,
            },
            unmatched: {
                type: 'boolean',
                default: true,
                description:
                    'List the lines that are no message of the catalogue (counted whatever this says)',
            },
            line_prefix: {
                type: 'string',
                minLength: 1,
                description: `What the game writes before each message on a line, as a regular expression matched at the line start, at most ${String(LONGEST_SHAPE)} characters; by default none is assumed`,
            },
            location: {
                type: 'string',
                minLength: 1,
                description: `How a message writes a place in a script file, as a regular expression with the group (?<file>...) and optionally (?<line>...) and (?<column>...), at most ${String(LONGEST_SHAPE)} characters; by default none is assumed`,
            },
        },
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            log: { type: 'string', description: 'The log read' },
            lines: {
                type: 'object',
                properties: { total: COUNT, empty: COUNT, not_utf8: COUNT },
                required: ['total', 'empty', 'not_utf8'],
            },
            spec: {
                type: 'object',
                properties: { version: { type: 'string' }, sha256: { type: 'string' } },
                required: ['version', 'sha256'],
            },
            shape: {
                type: 'object',
                properties: {
                    prefix: { type: ['string', 'null'] },
                    location: { type: ['string', 'null'] },
                },
                required: ['prefix', 'location'],
                description: 'The line prefix and place format used; null for none',
            },
            totals: {
                type: 'object',
                properties: {
                    matched: COUNT,
                    ambiguous: COUNT,
                    unmatched: COUNT,
                    tied_to_mod: COUNT,
                    tied_to_game: COUNT,
                    not_tied: COUNT,
                    messages: {
                        ...COUNT,
                        description: 'How many different messages the log holds',
                    },
                },
                required: [
                    'matched',
                    'ambiguous',
                    'unmatched',
                    'tied_to_mod',
                    'tied_to_game',
                    'not_tied',
                    'messages',
                ],
                description: 'Of the whole log, whatever was asked',
            },
            messages: {
                type: 'array',
                items: MESSAGE,
                description: 'The messages answered, whole, the mod first',
            },
            not_answered: {
                type: ['object', 'null'],
                properties: {
                    messages: { type: 'array', items: { type: 'string' } },
                    ask: { type: 'string' },
                },
                required: ['messages', 'ask'],
                description:
                    'The messages that did not fit, by key, and what to do; null when every one is answered',
            },
            unmatched: {
                type: 'object',
                properties: {
                    count: COUNT,
                    lines: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                line: { type: 'integer', minimum: 1 },
                                text: { type: 'string' },
                                why: { type: 'string', enum: ['no-message', 'too-long'] },
                            },
                            required: ['line', 'text', 'why'],
                        },
                    },
                    not_listed: COUNT,
                },
                required: ['count', 'lines', 'not_listed'],
                description:
                    'The lines that are no message of the catalogue, as many as fit (none when unmatched is false), the rest counted',
            },
            notes: NOTES,
        },
        required: [
            'log',
            'lines',
            'spec',
            'shape',
            'totals',
            'messages',
            'not_answered',
            'unmatched',
            'notes',
        ],
    },
    run(args: AnalyzeLogArgs, session: Session): Record<string, unknown> {
        let shape;
        try {
            shape = logShape({ prefix: args.line_prefix ?? null, location: args.location ?? null });
        } catch (err) {
            if (err instanceof LogShapeError) {
                throw new BadInput(
                    err.message
                        .replace(/^the line prefix/, 'line_prefix')
                        .replace(/^the place format/, 'location'),
                );
            }
            throw err;
        }
        const file = logPath(session, args.log);
        const workspace = session.workspace();
        const report: LogReport = session.remember(
            'analyze_log',
            JSON.stringify([
                file,
                statSync(file).mtimeMs,
                statSync(file).size,
                shape.prefix?.source,
                shape.location?.source,
            ]),
            () =>
                analyzeLog({
                    spec: session.spec,
                    index: workspace.index,
                    log: readFileSync(file),
                    shape,
                }),
        );
        const asked = args.messages === undefined ? null : [...new Set(args.messages)];
        const known = new Map(report.messages.map((m) => [m.key, m]));
        const notes = session.notes();
        if (asked !== null) {
            const unknown = asked.filter((k) => !known.has(k));
            if (unknown.length > 0) {
                notes.push(
                    `the log holds no message ${unknown.join(', ')}; its keys are ${valueList([...known.keys()], 2_000)}`,
                );
            }
        }
        const wanted = asked === null ? report.messages : asked.flatMap((k) => known.get(k) ?? []);
        const unmatchedWanted = args.unmatched ?? true;
        const build = (
            taken: readonly Record<string, unknown>[],
            left: readonly string[],
            unmatchedShown: number,
        ): Record<string, unknown> => ({
            log: file,
            lines: report.lines,
            spec: report.spec,
            shape: report.shape,
            totals: { ...report.totals, messages: report.messages.length },
            messages: taken,
            not_answered: left.length === 0 ? null : { messages: left, ask: ASK_AGAIN },
            unmatched: {
                count: report.unmatched.length,
                lines: report.unmatched
                    .slice(0, unmatchedShown)
                    .map((u) => ({ line: u.line, text: cut(u.text), why: u.why })),
                not_listed: report.unmatched.length - unmatchedShown,
            },
            notes,
        });
        // The messages first, whole, in order; a message that does not fit is named and the
        // ones after it are still tried. A first message too large alone is written smaller.
        const taken: Record<string, unknown>[] = [];
        const left: string[] = [];
        for (const [i, m] of wanted.entries()) {
            const rest = wanted.slice(i + 1).map((w) => w.key);
            const whole = messageOf(m, m.occurrences.length);
            if (sizeOf(build([...taken, whole], [...left, ...rest], 0)) <= RESULT_BUDGET) {
                taken.push(whole);
            } else if (taken.length === 0 && left.length === 0) {
                const room = RESULT_BUDGET - 500 - sizeOf(build([], rest, 0));
                taken.push(fittedMessage(m, room));
            } else {
                left.push(m.key);
            }
        }
        // Then as many unmatched lines as fit what is left.
        let shown = 0;
        if (unmatchedWanted) {
            let high = report.unmatched.length;
            while (shown < high) {
                const mid = (shown + high + 1) >> 1;
                if (sizeOf(build(taken, left, mid)) <= RESULT_BUDGET) {
                    shown = mid;
                } else {
                    high = mid - 1;
                }
            }
        }
        return build(taken, left, shown);
    },
};
