/**
 * The matcher (docs/PLAN.md item 11.3; docs/game-log.md): a log line's text against every
 * template of the spec package's error catalogue (`templates.ts`).
 *
 * - **No line prefix is assumed.** What the game writes before a message on a line (a time, a
 *   level, the source file of the executable) is not known until a real log is read; no shape
 *   of it is written here. A template therefore matches the end of a line, its message starting
 *   anywhere in it, and what comes before is returned as it is (`before`). When the person
 *   running it gives a prefix (`LogShape.prefix`), the line's prefix is taken off first and the
 *   template must match the whole rest.
 * - **Every template that matches is weighed.** The one that accounts for the most of the line,
 *   the most fixed characters, is the message; templates that tie with it are all named and the
 *   match is ambiguous: none is picked.
 * - **A value whose bounds the line does not settle** (a text value that could end at more than
 *   one place, because the fixed text after it also occurs inside it, or two values side by side
 *   with nothing between them) is marked `unsure`: the first split and the last split of the
 *   line give different values, or no line can say where one ends.
 * - **A message inside a message.** A text value that is itself a whole message of the catalogue
 *   (`Error: "<message>" in file: ...`) is matched too, and named (`inner`).
 *
 * A line no template matches is not guessed at: the caller lists it as unmatched.
 */

import type { Spec } from '../spec/reader.js';
import { messagePattern, templateOf, type LogTemplate } from './templates.js';

/** What a line's text is matched with, beside the catalogue: both are the user's, never guessed. */
export interface LogShape {
    /**
     * What the game writes before a message on each line, as a regular expression matched at
     * the line's start; null when not known (the default: no real log has been read).
     */
    readonly prefix: RegExp | null;
    /**
     * How the game writes a place in a script file inside a message (the `at {}` of many
     * messages): a regular expression with the named groups `file` and, optionally, `line` and
     * `column`; null when not known (the default).
     */
    readonly location: RegExp | null;
}

/** No prefix and no place format: what is known before a real log is read. */
export const UNKNOWN_SHAPE: LogShape = { prefix: null, location: null };

/** A template matched against a text. */
export interface TemplateMatch {
    readonly template: LogTemplate;
    /** The text before the message on its line; empty when the message starts the text. */
    readonly before: string;
    /** Its values, in order, as the line writes them. */
    readonly values: readonly string[];
    /** `unsure` when another split of the line gives other values. */
    readonly split: 'one' | 'unsure';
    /**
     * True when the message starts with a text value and its start on the line was not known
     * (no prefix given): that first value holds whatever came before the message on its line.
     */
    readonly startsWithValue: boolean;
}

/** A message found inside a text value of another. */
export interface InnerMessage {
    /** The value of the outer message it fills, counted from 0. */
    readonly value: number;
    readonly match: LineMatch;
}

/** What a text is: one message, several equally good, or none. */
export type LineMatch =
    | {
          readonly kind: 'matched';
          /** The best match; the others of `ambiguous` are as good. */
          readonly best: TemplateMatch;
          /** Every template as good as the best, the best among them, sorted by id; one when sure. */
          readonly candidates: readonly TemplateMatch[];
          readonly inner: InnerMessage | null;
      }
    | { readonly kind: 'unmatched' };

interface Compiled {
    readonly template: LogTemplate;
    /** Its fixed pieces, in order: a text that does not hold them all in order cannot match. */
    readonly pieces: readonly string[];
    lazy?: RegExp;
    greedy?: RegExp;
    whole?: RegExp;
    wholeGreedy?: RegExp;
}

/** The letter runs of three letters or more of a text: the words a line is looked up by. */
function lineWords(text: string): Set<string> {
    return new Set(text.match(/[A-Za-z]{3,}/g) ?? []);
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** True when a template starts with a text value, which may take in what comes before it. */
function leadingText(template: LogTemplate): boolean {
    const first = template.parts[0];
    return first?.kind === 'value' && first.conversion === 'text';
}

/** A text value long enough to hold a message of its own: two words or more. */
function mayHoldMessage(value: string): boolean {
    return (value.match(/[A-Za-z]{3,}/g) ?? []).length >= 2;
}

/** The matcher of one spec package's catalogue. */
export class LogMatcher {
    /** Every catalogue entry as a template, in the package's order. */
    readonly templates: readonly LogTemplate[];
    private readonly compiled: readonly Compiled[];
    /** The templates looked up by their rarest word. */
    private readonly byWord = new Map<string, Compiled[]>();
    /** Templates with no word a line can be looked up by: tried on every line. */
    private readonly always: Compiled[] = [];

    constructor(templates: readonly LogTemplate[]) {
        this.templates = templates;
        this.compiled = templates
            .filter((t) => t.notMatched === null)
            .map((template) => ({
                template,
                pieces: template.parts.flatMap((p) => (p.kind === 'fixed' ? [p.text] : [])),
            }));
        const count = new Map<string, number>();
        for (const c of this.compiled) {
            for (const w of new Set(c.template.words)) {
                count.set(w, (count.get(w) ?? 0) + 1);
            }
        }
        for (const c of this.compiled) {
            const words = [...new Set(c.template.words)];
            if (words.length === 0) {
                this.always.push(c);
                continue;
            }
            // The rarest word, the longest among equals, then the first in the text.
            let key = words[0] ?? '';
            for (const w of words) {
                const a = count.get(w) ?? 0;
                const b = count.get(key) ?? 0;
                if (a < b || (a === b && w.length > key.length)) {
                    key = w;
                }
            }
            const list = this.byWord.get(key) ?? [];
            list.push(c);
            this.byWord.set(key, list);
        }
    }

    /** The templates a text may be one of: those whose rarest word it holds. */
    private candidatesOf(text: string): Compiled[] {
        const out = new Set<Compiled>(this.always);
        for (const w of lineWords(text)) {
            for (const c of this.byWord.get(w) ?? []) {
                out.add(c);
            }
        }
        return [...out];
    }

    /** A template matched against a text whose start is not known (`whole` false) or is. */
    private matchOne(c: Compiled, text: string, whole: boolean): TemplateMatch | null {
        let from = 0;
        for (const piece of c.pieces) {
            const at = text.indexOf(piece, from);
            if (at < 0) {
                return null;
            }
            from = at + piece.length;
        }
        let lazy: RegExp;
        let greedy: RegExp;
        if (whole) {
            c.whole ??= new RegExp(`^${messagePattern(c.template, false)}$`);
            c.wholeGreedy ??= new RegExp(`^${messagePattern(c.template, true)}$`);
            lazy = c.whole;
            greedy = c.wholeGreedy;
        } else {
            c.lazy ??= new RegExp(`^([\\s\\S]*?)${messagePattern(c.template, false)}$`);
            c.greedy ??= new RegExp(`^([\\s\\S]*?)${messagePattern(c.template, true)}$`);
            lazy = c.lazy;
            greedy = c.greedy;
        }
        const first = lazy.exec(text);
        if (first === null) {
            return null;
        }
        const offset = whole ? 1 : 2;
        const values = first.slice(offset);
        const last = greedy.exec(text);
        const other = last === null ? values : last.slice(offset);
        const before = whole ? '' : (first[1] ?? '');
        const otherBefore = whole || last === null ? before : (last[1] ?? '');
        const same =
            !c.template.adjacentValues &&
            before === otherBefore &&
            values.every((v, i) => v === other[i]);
        return {
            template: c.template,
            before,
            values,
            split: same ? 'one' : 'unsure',
            startsWithValue: !whole && leadingText(c.template),
        };
    }

    /**
     * What a text is. `whole` says the text is the message alone (its prefix taken off, or a
     * value of another message); otherwise the message may start anywhere in it.
     */
    match(text: string, whole = false, depth = 0): LineMatch {
        const found: TemplateMatch[] = [];
        for (const c of this.candidatesOf(text)) {
            if (c.template.lines > 1) {
                continue;
            }
            const m = this.matchOne(c, text, whole);
            if (m !== null) {
                found.push(m);
            }
        }
        return this.weigh(found, depth);
    }

    /**
     * What several lines are, read as one message of a template whose text spans as many lines
     * (`LogTemplate.lines`); unmatched when no such template matches them all.
     */
    matchSpan(lines: readonly string[], whole = false): LineMatch {
        const text = lines.join('\n');
        const found: TemplateMatch[] = [];
        for (const c of this.candidatesOf(text)) {
            if (c.template.lines !== lines.length) {
                continue;
            }
            const m = this.matchOne(c, text, whole);
            if (m !== null) {
                found.push(m);
            }
        }
        return this.weigh(found, 0);
    }

    /** The templates of more than one line whose rarest word a text holds. */
    spansStartingIn(text: string): number[] {
        const out = new Set<number>();
        for (const c of this.candidatesOf(text)) {
            if (c.template.lines > 1) {
                out.add(c.template.lines);
            }
        }
        return [...out].sort((a, b) => b - a);
    }

    private weigh(found: readonly TemplateMatch[], depth: number): LineMatch {
        if (found.length === 0) {
            return { kind: 'unmatched' };
        }
        const most = Math.max(...found.map((m) => m.template.fixed));
        const candidates = found
            .filter((m) => m.template.fixed === most)
            .sort((a, b) => compare(a.template.id, b.template.id));
        const best = candidates[0];
        if (best === undefined) {
            return { kind: 'unmatched' };
        }
        let inner: InnerMessage | null = null;
        if (depth < 2) {
            for (const [i, part] of best.values.entries()) {
                if (!mayHoldMessage(part)) {
                    continue;
                }
                const m = this.match(part, true, depth + 1);
                if (m.kind === 'matched') {
                    inner = { value: i, match: m };
                    break;
                }
            }
        }
        return { kind: 'matched', best, candidates, inner };
    }
}

const matchers = new WeakMap<Spec, LogMatcher>();

/** The matcher of a spec package's catalogue, made once per package. */
export function logMatcher(spec: Spec): LogMatcher {
    let matcher = matchers.get(spec);
    if (matcher === undefined) {
        matcher = new LogMatcher(spec.data.errors.map(templateOf));
        matchers.set(spec, matcher);
    }
    return matcher;
}
