/**
 * A game log analysed (docs/PLAN.md items 11.3 and 11.4; docs/game-log.md): each line matched to
 * the catalogue's messages (`matcher.ts`), each message tied to the files of the mod and the base
 * game (`tie.ts`), and every line no message matches listed as it is, never guessed at. The one
 * report every surface shows: the command line's `log`, the agent server's `analyze_log`, the
 * editor's log diagnostics.
 *
 * Messages are grouped by catalogue entry (or, where several entries match a line equally well,
 * by all of them together), each with the pychivalry codes whose evidence is that entry. The
 * messages about the mod come first.
 */

import { CHECK_KINDS } from '../check/finding.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import type { Spec } from '../spec/reader.js';
import { FINDING_KINDS } from '../syntax/findings.js';
import {
    logMatcher,
    UNKNOWN_SHAPE,
    type LineMatch,
    type LogMatcher,
    type LogShape,
    type TemplateMatch,
} from './matcher.js';
import { logLines, type LogLine } from './read.js';
import type { LogTemplate } from './templates.js';
import { tiesOf, type LogTie } from './tie.js';

/** The most places listed for one line's message; the rest are counted. */
export const TIES_PER_LINE = 10;

/** The longest line matched; a longer one is listed as unmatched, with why. */
export const LONGEST_LINE = 8_000;

/** A message found inside another one's value. */
export interface LogInner {
    /** The outer message's value it fills, counted from 0. */
    readonly value: number;
    /** Its catalogue entries: one, or every one that matches it equally well. */
    readonly ids: readonly string[];
    readonly values: readonly string[];
}

/** One line (or span of lines) of the log that is a message. */
export interface LogOccurrence {
    /** The line it is on, counted from 1, and the last line of a message of several. */
    readonly line: number;
    readonly end_line: number;
    /**
     * What is on its line before the message: the prefix the user's shape took off, or, with
     * none given, whatever text precedes it (the game's own line prefix, not known in advance).
     */
    readonly before: string;
    readonly values: readonly string[];
    /** `unsure` when the line can be split into the template's values in more than one way. */
    readonly split: 'one' | 'unsure';
    /**
     * True when the message starts with a text value and no line prefix was given: the first value
     * then holds whatever the game wrote before the message on its line, which is not known.
     */
    readonly starts_with_value: boolean;
    readonly inner: LogInner | null;
    readonly ties: readonly LogTie[];
    readonly ties_not_listed: number;
}

/** Every line of one catalogue message (or one set of equally good ones). */
export interface LogMessage {
    /** The entry's id, or the ids of equally good entries joined by `|`. */
    readonly key: string;
    readonly ids: readonly string[];
    /** The first entry's text, as the catalogue gives it. */
    readonly text: string;
    readonly subject: string;
    readonly script_facing: string;
    readonly category: string;
    /** The pychivalry codes whose evidence is one of its entries: the checks that find it. */
    readonly checks: readonly string[];
    readonly count: number;
    readonly occurrences: readonly LogOccurrence[];
}

/** A line no message of the catalogue matches. */
export interface UnmatchedLine {
    readonly line: number;
    readonly text: string;
    /** Why it was not matched: no template matches it, or it is too long to try. */
    readonly why: 'no-message' | 'too-long';
}

/** A log analysed. */
export interface LogReport {
    readonly spec: { readonly version: string; readonly sha256: string };
    /** The line prefix and place format the analysis was given, as written; null for none. */
    readonly shape: { readonly prefix: string | null; readonly location: string | null };
    readonly lines: {
        readonly total: number;
        readonly empty: number;
        /** Lines not valid UTF-8, read as Windows-1252. */
        readonly not_utf8: number;
    };
    readonly totals: {
        /** Lines (or spans) that are a message, every one of which is in `messages`. */
        readonly matched: number;
        /** Of them, those several entries match equally well. */
        readonly ambiguous: number;
        readonly unmatched: number;
        /** Matched lines tied to a file of the mod (they may tie to the base game as well). */
        readonly tied_to_mod: number;
        /** Matched lines tied to the base game only. */
        readonly tied_to_game: number;
        readonly not_tied: number;
    };
    readonly messages: readonly LogMessage[];
    readonly unmatched: readonly UnmatchedLine[];
}

/** What a log is analysed with. */
export interface AnalyzeOptions {
    readonly spec: Spec;
    /** The workspace index ties are read from; null to match without tying. */
    readonly index: WorkspaceIndex | null;
    readonly log: Uint8Array | string;
    readonly shape?: LogShape | undefined;
}

const codesByEntry = new Map<string, string[]>();

/** The pychivalry codes whose evidence is a catalogue entry (docs/checks.md). */
export function codesOfEntry(id: string): readonly string[] {
    if (codesByEntry.size === 0) {
        const add = (entry: string, code: string): void => {
            const list = codesByEntry.get(entry) ?? [];
            if (!list.includes(code)) {
                list.push(code);
            }
            codesByEntry.set(entry, list);
        };
        for (const [code, kind] of Object.entries(FINDING_KINDS)) {
            if (kind.catalogue !== null) {
                add(kind.catalogue, code);
            }
        }
        for (const [code, kind] of Object.entries(CHECK_KINDS)) {
            if (kind.catalogue !== null) {
                add(kind.catalogue, code);
            }
            for (const also of kind.alsoCatalogue ?? []) {
                add(also, code);
            }
        }
        for (const list of codesByEntry.values()) {
            list.sort();
        }
    }
    return codesByEntry.get(id) ?? [];
}

function sourceOf(re: RegExp | null): string | null {
    return re === null ? null : re.source;
}

/** A line's text matched: with the prefix taken off first when one is given. */
function matchText(
    matcher: LogMatcher,
    text: string,
    shape: LogShape,
): { match: LineMatch; prefix: string | null } {
    if (shape.prefix !== null) {
        const p = shape.prefix.exec(text);
        if (p?.index === 0) {
            return { match: matcher.match(text.slice(p[0].length), true), prefix: p[0] };
        }
    }
    return { match: matcher.match(text, false), prefix: null };
}

interface Found {
    readonly first: LogLine;
    readonly last: LogLine;
    readonly match: Extract<LineMatch, { kind: 'matched' }>;
    readonly prefix: string | null;
}

function occurrenceOf(
    found: Found,
    spec: Spec,
    index: WorkspaceIndex | null,
    shape: LogShape,
): LogOccurrence {
    const best: TemplateMatch = found.match.best;
    const inner = found.match.inner;
    const innerBest = inner?.match.kind === 'matched' ? inner.match : null;
    const ties = tiesOf(
        best,
        inner !== null && innerBest !== null ? { value: inner.value, match: innerBest.best } : null,
        { spec, index, shape, limit: TIES_PER_LINE },
    );
    return {
        line: found.first.number,
        end_line: found.last.number,
        before: found.prefix ?? best.before,
        values: best.values,
        split: best.split,
        starts_with_value: best.startsWithValue,
        inner:
            inner !== null && innerBest !== null
                ? {
                      value: inner.value,
                      ids: innerBest.candidates.map((c) => c.template.id),
                      values: innerBest.best.values,
                  }
                : null,
        ties: ties.ties,
        ties_not_listed: ties.notListed,
    };
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** A log analysed: every line a message, tied where it can be, or listed as unmatched. */
export function analyzeLog(options: AnalyzeOptions): LogReport {
    const shape = options.shape ?? UNKNOWN_SHAPE;
    const matcher = logMatcher(options.spec);
    const lines = logLines(options.log);
    const groups = new Map<string, { templates: LogTemplate[]; occurrences: LogOccurrence[] }>();
    const unmatched: UnmatchedLine[] = [];
    let empty = 0;
    let ambiguous = 0;
    let matched = 0;
    let toMod = 0;
    let toGame = 0;
    let notTied = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) {
            continue;
        }
        if (line.text.trim() === '') {
            empty++;
            continue;
        }
        if (line.text.length > LONGEST_LINE) {
            unmatched.push({ line: line.number, text: line.text, why: 'too-long' });
            continue;
        }
        let found: Found | null = null;
        // A message of several lines, when one of the catalogue's spans starts here.
        for (const span of matcher.spansStartingIn(line.text)) {
            const window = lines.slice(i, i + span);
            if (window.length < span) {
                continue;
            }
            const texts = window.map((l) => l.text);
            let prefix: string | null = null;
            if (shape.prefix !== null) {
                const p = shape.prefix.exec(texts[0] ?? '');
                if (p?.index === 0) {
                    prefix = p[0];
                    texts[0] = (texts[0] ?? '').slice(p[0].length);
                }
            }
            const m = matcher.matchSpan(texts, prefix !== null);
            const last = window[window.length - 1];
            if (m.kind === 'matched' && last !== undefined) {
                found = { first: line, last, match: m, prefix };
                i += span - 1;
                break;
            }
        }
        if (found === null) {
            const { match, prefix } = matchText(matcher, line.text, shape);
            if (match.kind === 'matched') {
                found = { first: line, last: line, match, prefix };
            }
        }
        if (found === null) {
            unmatched.push({ line: line.number, text: line.text, why: 'no-message' });
            continue;
        }
        matched++;
        const templates = found.match.candidates.map((c) => c.template);
        if (templates.length > 1) {
            ambiguous++;
        }
        const occurrence = occurrenceOf(found, options.spec, options.index, shape);
        if (occurrence.ties.some((t) => t.layer === 'mod')) {
            toMod++;
        } else if (occurrence.ties.length > 0) {
            toGame++;
        } else {
            notTied++;
        }
        const key = templates.map((t) => t.id).join('|');
        const group = groups.get(key) ?? { templates, occurrences: [] };
        group.occurrences.push(occurrence);
        groups.set(key, group);
    }
    const messages: LogMessage[] = [...groups.entries()].map(([key, g]) => {
        const first = g.templates[0];
        const checks = [...new Set(g.templates.flatMap((t) => codesOfEntry(t.id)))].sort();
        return {
            key,
            ids: g.templates.map((t) => t.id),
            text: first?.text ?? '',
            subject: first?.subject ?? '',
            script_facing: first?.scriptFacing ?? 'unknown',
            category: first?.category ?? '',
            checks,
            count: g.occurrences.length,
            occurrences: g.occurrences,
        };
    });
    const modCount = (m: LogMessage): number =>
        m.occurrences.filter((o) => o.ties.some((t) => t.layer === 'mod')).length;
    messages.sort(
        (a, b) => modCount(b) - modCount(a) || b.count - a.count || compare(a.key, b.key),
    );
    return {
        spec: { version: options.spec.version, sha256: options.spec.sha256 },
        shape: { prefix: sourceOf(shape.prefix), location: sourceOf(shape.location) },
        lines: {
            total: lines.length,
            empty,
            not_utf8: lines.filter((l) => l.notUtf8).length,
        },
        totals: {
            matched,
            ambiguous,
            unmatched: unmatched.length,
            tied_to_mod: toMod,
            tied_to_game: toGame,
            not_tied: notTied,
        },
        messages,
        unmatched,
    };
}

/** Why a shape cannot be used. */
export class LogShapeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LogShapeError';
    }
}

/** The longest prefix or place format accepted, in characters. */
export const LONGEST_SHAPE = 200;

/**
 * A shape from what the user wrote: the line prefix and the place format, each a regular
 * expression or nothing. A place format must name the group `file`; `line` and `column` may be
 * named too. Throws `LogShapeError` on one that cannot be used.
 */
export function logShape(given: {
    readonly prefix?: string | null;
    readonly location?: string | null;
}): LogShape {
    const compile = (what: string, source: string | null | undefined): RegExp | null => {
        if (source === undefined || source === null || source === '') {
            return null;
        }
        if (source.length > LONGEST_SHAPE) {
            throw new LogShapeError(`${what}: longer than ${String(LONGEST_SHAPE)} characters`);
        }
        try {
            return new RegExp(source);
        } catch (err) {
            throw new LogShapeError(`${what}: not a regular expression: ${(err as Error).message}`);
        }
    };
    const prefix = compile('the line prefix', given.prefix);
    const location = compile('the place format', given.location);
    if (location !== null && !location.source.includes('(?<file>')) {
        throw new LogShapeError(
            'the place format: it must name the group file, as (?<file>...), and may name line and column',
        );
    }
    return { prefix, location };
}
