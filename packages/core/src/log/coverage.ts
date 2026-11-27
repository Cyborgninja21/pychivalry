/**
 * What the matcher makes of the catalogue itself (docs/game-log.md, "The matcher on the
 * catalogue"): which templates it matches and which it cannot, which are ambiguous, and, per
 * family of messages (the package's `subject`), what a message's values can be tied to. Measured
 * from the package and the matcher, never written by hand: the command line's `log --catalogue`
 * prints it, and a test holds docs/game-log.md to it.
 *
 * A template is tried on a line made from it: each value filled with a stand-in of its
 * conversion (`sampleLine`), after a stand-in prefix that no game writes. A template whose own
 * line another template matches better is shadowed; one whose own line others match as well is
 * ambiguous with them.
 */

import type { Spec } from '../spec/reader.js';
import { logMatcher, type LogMatcher } from './matcher.js';
import type { Conversion, LogTemplate } from './templates.js';

/** The stand-in value of a conversion, numbered so that values are told apart. */
function standIn(conversion: Conversion, n: number): string {
    switch (conversion) {
        case 'integer':
        case 'unsigned':
            return String(10 + n);
        case 'hex':
            return (160 + n).toString(16);
        case 'number':
            return `${String(n)}.5`;
        case 'char':
            return 'q';
        case 'pointer':
            return `0x${(4096 + n).toString(16)}`;
        case 'text':
            return `value${String(n)}`;
    }
}

/** A line made from a template: each value filled with a stand-in; `\n` where its text has one. */
export function sampleLine(template: LogTemplate): { text: string; values: string[] } {
    const values: string[] = [];
    let text = '';
    let n = 1;
    for (const part of template.parts) {
        if (part.kind === 'fixed') {
            text += part.text;
        } else {
            const v = standIn(part.conversion, n++);
            values.push(v);
            text += v;
        }
    }
    return { text, values };
}

/** The stand-in prefix a sample line is written after: no game writes it. */
export const STAND_IN_PREFIX = 'stand-in prefix | ';

/** How one template fares on its own sample line. */
export type SampleOutcome =
    | { readonly kind: 'alone' }
    | { readonly kind: 'ambiguous'; readonly with: readonly string[] }
    | { readonly kind: 'shadowed'; readonly by: readonly string[] }
    | { readonly kind: 'not-found' };

/** One family of messages: the catalogue's entries of one `subject`. */
export interface FamilyRow {
    readonly subject: string;
    readonly entries: number;
    /** Matched against log lines. */
    readonly matched: number;
    /** With a value the message's own text says is a line number. */
    readonly with_line: number;
    /** With a text value, which can name a file or a definition. */
    readonly with_text: number;
    /** That the package's reason says give a place in a script file (`script_position`). */
    readonly give_a_place: number;
    /** With no value at all: the message alone, nothing to tie. */
    readonly no_value: number;
}

/** The matcher on the catalogue. */
export interface CatalogueCoverage {
    readonly entries: number;
    /** Matched against log lines. */
    readonly matched: number;
    readonly notMatched: {
        readonly notAMessage: readonly string[];
        readonly tooLittleFixedText: readonly string[];
    };
    /** Matched templates found alone on their own line and on every other template's line. */
    readonly alone: number;
    /** Groups of templates that match one another's lines equally well. */
    readonly ambiguous: readonly (readonly string[])[];
    /** Templates whose own line another matches better, with those that do. */
    readonly shadowed: readonly { readonly id: string; readonly by: readonly string[] }[];
    /** Templates their own line does not find: none, when the matcher is right. */
    readonly notFound: readonly string[];
    /** Templates whose text spans more than one line. */
    readonly spans: readonly string[];
    readonly families: readonly FamilyRow[];
}

/** How one template fares on its own line, after the stand-in prefix. */
export function sampleOutcome(matcher: LogMatcher, template: LogTemplate): SampleOutcome {
    const { text } = sampleLine(template);
    const lines = (STAND_IN_PREFIX + text).split('\n');
    const m = lines.length > 1 ? matcher.matchSpan(lines) : matcher.match(lines[0] ?? '');
    if (m.kind !== 'matched') {
        return { kind: 'not-found' };
    }
    const ids = m.candidates.map((c) => c.template.id);
    if (!ids.includes(template.id)) {
        return { kind: 'shadowed', by: ids };
    }
    return ids.length === 1
        ? { kind: 'alone' }
        : { kind: 'ambiguous', with: ids.filter((id) => id !== template.id) };
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** The matcher on a package's whole catalogue. */
export function catalogueCoverage(spec: Spec): CatalogueCoverage {
    const matcher = logMatcher(spec);
    const notAMessage: string[] = [];
    const tooLittle: string[] = [];
    const shadowed: { id: string; by: string[] }[] = [];
    const notFound: string[] = [];
    const spans: string[] = [];
    const groups = new Map<string, string[]>();
    const aloneIds: string[] = [];
    const families = new Map<
        string,
        {
            entries: number;
            matched: number;
            with_line: number;
            with_text: number;
            give_a_place: number;
            no_value: number;
        }
    >();
    for (const t of matcher.templates) {
        const row = families.get(t.subject) ?? {
            entries: 0,
            matched: 0,
            with_line: 0,
            with_text: 0,
            give_a_place: 0,
            no_value: 0,
        };
        row.entries++;
        families.set(t.subject, row);
        if (t.notMatched === 'not-a-message') {
            notAMessage.push(t.id);
            continue;
        }
        if (t.notMatched === 'too-little-fixed-text') {
            tooLittle.push(t.id);
            continue;
        }
        row.matched++;
        const values = t.parts.flatMap((p) => (p.kind === 'value' ? [p] : []));
        if (values.some((v) => v.role === 'line')) {
            row.with_line++;
        }
        if (values.some((v) => v.conversion === 'text')) {
            row.with_text++;
        }
        if (t.reason.startsWith('script_position')) {
            row.give_a_place++;
        }
        if (values.length === 0) {
            row.no_value++;
        }
        if (t.lines > 1) {
            spans.push(t.id);
        }
        const outcome = sampleOutcome(matcher, t);
        switch (outcome.kind) {
            case 'alone':
                aloneIds.push(t.id);
                break;
            case 'ambiguous': {
                const ids = [t.id, ...outcome.with].sort(compare);
                groups.set(ids.join('|'), ids);
                break;
            }
            case 'shadowed':
                shadowed.push({ id: t.id, by: [...outcome.by] });
                break;
            case 'not-found':
                notFound.push(t.id);
                break;
        }
    }
    // A template alone on its own line may still be matched as well as another on the other's
    // line (`at%s` and `at %s`): it is ambiguous with it.
    const inGroups = new Set([...groups.values()].flat());
    const alone = aloneIds.filter((id) => !inGroups.has(id)).length;
    return {
        entries: matcher.templates.length,
        matched: matcher.templates.filter((t) => t.notMatched === null).length,
        notMatched: { notAMessage, tooLittleFixedText: tooLittle },
        alone,
        ambiguous: [...groups.values()].sort((a, b) => compare(a[0] ?? '', b[0] ?? '')),
        shadowed,
        notFound,
        spans,
        families: [...families.entries()]
            .map(([subject, r]) => ({ subject, ...r }))
            .sort((a, b) => b.entries - a.entries || compare(a.subject, b.subject)),
    };
}
