/**
 * What a tool returns, and how it is kept small (docs/PLAN.md items 6.3 and 6.4).
 *
 * - **A result** is the tool's structured output, and the same as JSON text for a client that
 *   reads only text: the protocol's advice for a tool that declares an output shape.
 * - **Every result fits a context window.** Its JSON is at most `RESULT_BUDGET` characters, so
 *   the whole result, both copies, stays under 10,000 tokens even at three characters a token
 *   (JSON's usual rate; four is the rule of thumb for prose). Claude Code cuts a tool's result
 *   off at 25,000 tokens. A list longer than fits is cut to the most that fits: a paged list
 *   gives a cursor for the rest, any other names the items it left out.
 * - **A cursor** is a token for the next page of the same question. It holds where the page
 *   ends and a digest of the arguments it answers, so a cursor given with other arguments is
 *   bad input, not a wrong page.
 * - **Bad input** comes back as a result marked as an error whose text names the valid values,
 *   never as a protocol error.
 */

import type { CallToolResult } from '@modelcontextprotocol/server';

export type { CallToolResult };
import { createHash } from 'node:crypto';

/** The most characters a result's JSON may hold. */
export const RESULT_BUDGET = 14_000;

/** The most items a paged tool returns in one page, and how many by default. */
export const MAX_LIMIT = 200;
export const DEFAULT_LIMIT = 50;

/** The characters of a value's JSON. */
export function sizeOf(value: unknown): number {
    return JSON.stringify(value).length;
}

/** A result: the structured output, and its JSON as text. */
export function ok(output: Record<string, unknown>): CallToolResult {
    if (sizeOf(output) > RESULT_BUDGET) {
        throw new Error(
            `a result of ${String(sizeOf(output))} characters is over the budget of ${String(RESULT_BUDGET)}`,
        );
    }
    return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output };
}

/** Bad input: a result marked as an error, its text naming what is wrong and what is valid. */
export class BadInput extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BadInput';
    }
}

/** A bad-input result. */
export function bad(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Values named in a sentence, as many as fit in `room` characters: the rest counted.
 * `a, b, c` or `a, b and 40 more`.
 */
export function valueList(values: readonly string[], room = RESULT_BUDGET / 2): string {
    const shown: string[] = [];
    let used = 0;
    for (const v of values) {
        if (used + v.length + 2 > room) {
            break;
        }
        shown.push(v);
        used += v.length + 2;
    }
    const rest = values.length - shown.length;
    return rest === 0 ? shown.join(', ') : `${shown.join(', ')} and ${String(rest)} more`;
}

/**
 * The most of `items` (from the first) whose output, as `build` makes it, fits in `room`
 * characters (the budget by default): the output, and how many items it holds. At least none
 * are taken; `build` with none must fit.
 */
export function fit<T>(
    items: readonly T[],
    build: (taken: readonly T[]) => Record<string, unknown>,
    room = RESULT_BUDGET,
): { readonly output: Record<string, unknown>; readonly taken: number } {
    const all = build(items);
    if (sizeOf(all) <= room) {
        return { output: all, taken: items.length };
    }
    let low = 0;
    let high = items.length - 1;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (sizeOf(build(items.slice(0, mid))) <= room) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return { output: build(items.slice(0, low)), taken: low };
}

/** The digest of a question: the tool and the arguments that choose its list. */
export function questionKey(tool: string, args: Readonly<Record<string, unknown>>): string {
    const text = JSON.stringify([tool, Object.entries(args).sort(([a], [b]) => (a < b ? -1 : 1))]);
    return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** A cursor for the page that starts at `offset` of the list a question gives. */
export function encodeCursor(offset: number, key: string): string {
    return Buffer.from(`${String(offset)}:${key}`, 'utf8').toString('base64url');
}

/**
 * Where the page a cursor names starts: 0 without a cursor. A cursor this server did not give,
 * or gave for another question, is bad input. Its text says that a cursor only continues the
 * call it came from, repeated with that call's arguments, and that any other question leaves it
 * out: `arguments` names them in the tool's own words (lookup's: its names and language), since
 * the sessions of the second scored authoring run gave lookup the cursor of an earlier lookup
 * together with other names.
 */
export function readCursor(cursor: string | undefined, key: string, args = 'arguments'): number {
    if (cursor === undefined) {
        return 0;
    }
    const text = Buffer.from(cursor, 'base64url').toString('utf8');
    const match = /^([0-9]+):([0-9a-f]{12})$/.exec(text);
    if (match === null) {
        throw new BadInput(
            'cursor: not a cursor this server gave; give the next_cursor of the last result, or leave it out to start from the first',
        );
    }
    if (match[2] !== key) {
        throw new BadInput(
            `cursor: it was given for other ${args}. A cursor only continues the answer of the call that gave it, repeated with exactly the same ${args}; to ask anything else, call again without cursor`,
        );
    }
    return Number(match[1]);
}

/** One page of a list: from `offset`, at most `limit` items that fit the budget. */
export function page<T>(
    items: readonly T[],
    offset: number,
    limit: number,
    key: string,
    build: (taken: readonly T[], nextCursor: string | null) => Record<string, unknown>,
): Record<string, unknown> {
    const candidates = items.slice(offset, offset + limit);
    // The cursor's length does not depend on how many items are taken, so a stand-in of the
    // same length is used while fitting.
    const placeholder = encodeCursor(items.length, key);
    const { taken } = fit(candidates, (t) => build(t, placeholder));
    if (taken === 0 && candidates.length > 0) {
        throw new Error('one item of the list is larger than a whole result may be');
    }
    const next = offset + taken < items.length ? encodeCursor(offset + taken, key) : null;
    return build(candidates.slice(0, taken), next);
}
