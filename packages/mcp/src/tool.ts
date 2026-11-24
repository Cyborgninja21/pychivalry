/**
 * A tool of the agent server: its name, what it is for, the shapes of what it takes and
 * returns, and what it does. Every tool but one only reads (docs/PLAN.md item 6.2): it is
 * declared read-only, never destructive, and the same arguments on the same files give the same
 * answer. The one that writes, `apply_format` (item 9.8), says so (`writes`): it is declared not
 * read-only, and still never destructive and the same on a second call, since it only writes a
 * file of the mod in pychivalry's format.
 */

import { drain, type Steps } from '@pychivalry/core';
import type { Schema } from './schema.js';
import type { Session } from './session.js';

export interface Tool<Args = Record<string, unknown>> {
    /** Lower case with underscores. */
    readonly name: string;
    readonly title: string;
    /** What it does and when to use it, for the agent. */
    readonly description: string;
    /** The shape of its arguments, checked before it runs (`schema.ts`). */
    readonly input: Schema;
    /** The shape of its result, checked before it is sent. */
    readonly output: Schema;
    /** True for the one tool that writes a file of the mod; every other tool only reads. */
    readonly writes?: true | undefined;
    /**
     * The result, as structured data that fits the budget (`result.ts`); throws `BadInput`
     * for arguments the shape cannot rule out, its text naming the valid values.
     */
    run(args: Args, session: Session): Record<string, unknown>;
    /**
     * The same work in steps (`Steps`), for a tool that reads the whole mod: what `run` does,
     * pausing after each file, so that a program that answers for the agent server can keep
     * answering its own (docs/shared-index.md).
     */
    readonly steps?: ((args: Args, session: Session) => Steps<Record<string, unknown>>) | undefined;
}

/** A tool as the server lists it: its arguments' type erased, since its shape checks them. */
export interface ListedTool {
    readonly name: string;
    readonly title: string;
    readonly description: string;
    readonly input: Schema;
    readonly output: Schema;
    /** True when the tool writes a file of the mod (`Tool.writes`). */
    readonly writes: boolean;
    /** `run`, with arguments its input shape has already checked. */
    readonly call: (args: Record<string, unknown>, session: Session) => Record<string, unknown>;
    /** `call` in steps: the tool's own steps, or its `run` as one step. */
    readonly callSteps: (
        args: Record<string, unknown>,
        session: Session,
    ) => Steps<Record<string, unknown>>;
}

/** A tool for the server's list. */
export function listed<Args>(tool: Tool<Args>): ListedTool {
    return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        input: tool.input,
        output: tool.output,
        writes: tool.writes === true,
        // The library checks the arguments against `input` before this runs (`schema.ts`).
        call: (args, session) =>
            tool.steps === undefined
                ? tool.run(args as Args, session)
                : drain(tool.steps(args as Args, session)),
        callSteps: function* (args, session) {
            if (tool.steps === undefined) {
                return tool.run(args as Args, session);
            }
            return yield* tool.steps(args as Args, session);
        },
    };
}

// ─── Shapes several tools share ────────────────────────────────────────────

/** A whole number counted from 1. */
const fromOne: Schema = { type: 'integer', minimum: 1 };

/** The four numbers of a span (`places.ts`), as properties of an object. */
export const SPAN_PROPERTIES: Readonly<Record<string, Schema>> = {
    line: { ...fromOne, description: 'The line it starts on, counted from 1' },
    column: { ...fromOne, description: 'The column it starts at, counted from 1' },
    end_line: { ...fromOne, description: 'The line it ends on' },
    end_column: { ...fromOne, description: 'The column just after its end' },
};

export const SPAN_REQUIRED: readonly string[] = ['line', 'column', 'end_line', 'end_column'];

/** A place in a file of a layer: the mod (`mod`) or the base game (`game`, `dlc:<pack>`, ...). */
export const PLACE: Schema = {
    type: 'object',
    properties: {
        layer: {
            type: 'string',
            description:
                '`mod` for the mod; `game`, `jomini`, `clausewitz` or `dlc:<pack>` for the base game',
        },
        file: { type: 'string', description: "The file's path inside its layer, with /" },
        ...SPAN_PROPERTIES,
    },
    required: ['layer', 'file', ...SPAN_REQUIRED],
};

/** The limit and cursor of a paged tool. */
export function pagedInput(
    what: string,
    defaultLimit: number,
    maxLimit: number,
): Record<string, Schema> {
    return {
        limit: {
            type: 'integer',
            minimum: 1,
            maximum: maxLimit,
            default: defaultLimit,
            description: `The most ${what} to return; fewer when more would not fit in one result`,
        },
        cursor: {
            type: 'string',
            description:
                'Only for the next page of one answer: the next_cursor that answer gave, with exactly the same arguments as the call that gave it. Leave it out for the first page and for any other question',
        },
    };
}

/** The cursor of a paged result. */
export const NEXT_CURSOR: Schema = {
    type: ['string', 'null'],
    description:
        'Give it as cursor, with exactly the same arguments, for the next page of this answer only; null on the last',
};

/** The notes about the run: no game found, a game of another build. */
export const NOTES: Schema = {
    type: 'array',
    items: { type: 'string' },
    description: 'What to know about this answer: no game found, a game of another build',
};
