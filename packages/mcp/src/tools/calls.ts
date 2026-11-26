/**
 * `call_graph`: for each name asked, where it is defined, what calls it and what it calls, in the
 * mod and the base game (docs/PLAN.md item 10.7), from the core's call graph (`CallGraph`,
 * docs/call-graph.md), the same answer as the command line's `calls --json`.
 *
 * A link is a call the spec package marks as one: an event triggering an event, a scripted effect
 * or trigger called by name, an on-action firing an event or another on-action, a decision firing
 * an event, and every other value that names a definition the game fires. Each link says its kind
 * (the caller's database and the callee's), the statement that writes it, what in the package
 * makes it a call, and where it is written, as every place is written (`placeOf`): its layer, and
 * outside the mod `read_with: "source"`.
 *
 * **Paged by name, as `lookup` is, with no cursor.** Every name is answered whole or named in
 * `not_answered`, in the order asked. A name whose whole answer would not fit one result alone is
 * written smaller (`detail: "cut"`): its counts by kind and layer whole, then as many links of each
 * side as fit, the mod's first, the rest counted (`not_listed`), with what to ask instead
 * (`direction` for one side alone). Nothing is cut without a word.
 *
 * The graph is made once per change of the mod (`Session.remember`): the files it reads to answer
 * (the files that use a name, the files that define it) are read once while the mod is unchanged.
 */

import {
    CallGraph,
    diskFileSource,
    linkKind,
    type CallAnswer,
    type CallLink,
    type SourceListing,
} from '@pychivalry/core';
import { placeOf } from '../places.js';
import { BadInput, RESULT_BUDGET, sizeOf } from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import { NOTES, PLACE, type Tool } from '../tool.js';

export type Direction = 'both' | 'callers' | 'callees';

export interface CallGraphArgs {
    readonly names: readonly string[];
    readonly direction?: Direction;
}

/** The most names one call may ask about. */
export const MAX_NAMES = 20;

/** The longest name asked: no name of the game or a mod is longer. */
export const MAX_NAME_LENGTH = 120;

/** The most definitions of a name listed; the rest are counted. */
export const DEFINITIONS_SHOWN = 5;

/** What `not_answered` says to do. */
export const ASK_AGAIN =
    'These names did not fit in this result: ask call_graph about them in another call, with the same direction. call_graph has no cursor and no pages: every name it answers is answered whole';

const COUNT: Schema = { type: 'integer', minimum: 0 };
const COUNTS: Schema = { type: 'object', additionalProperties: COUNT };

/** A link as the tool writes it, from the side of the name asked. */
const LINK: Schema = {
    type: 'object',
    properties: {
        ...PLACE.properties,
        name: {
            type: 'string',
            description:
                'The definition at the other end: the caller (for callers) or the callee (for callees)',
        },
        database: {
            type: 'string',
            description:
                'What kind of definition it is: the folder that holds it (events, common/on_action, common/scripted_effects...)',
        },
        defined: {
            type: 'boolean',
            description:
                'Callees only: false when nothing in the mod or the base game defines the callee there',
        },
        kind: {
            type: 'string',
            description:
                "The link's kind: the caller's database and the callee's (events -> events, common/on_action -> events, common/decisions -> common/scripted_effects...)",
        },
        via: {
            type: 'string',
            description:
                'The statement as written: the key itself for a scripted effect or trigger called by name; the keyword and its parameter (trigger_event.id), the keyword alone for its value, or the field (events, on_actions)',
        },
        basis: {
            type: 'string',
            enum: ['callable', 'field-reference'],
            description:
                'What in the spec package makes it a call: callable, a key read as a definition of a folder whose definitions a mod can call by name (vanilla_indexed_dirs); field-reference, a value of a part D6 row naming a definition the game fires',
        },
        row: { type: 'string', description: 'field-reference only: the part D6 row' },
        status: {
            type: 'string',
            enum: ['confirmed', 'measured-only'],
            description: "field-reference only: the row's status in the package",
        },
    },
    required: [...(PLACE.required ?? []), 'name', 'database', 'kind', 'via', 'basis'],
    description: 'A call, at the place it is written (layer, file, line, column)',
};

const SIDE: Schema = {
    type: 'object',
    properties: {
        count: COUNT,
        by_kind: { ...COUNTS, description: 'How many links of each kind' },
        by_layer: { ...COUNTS, description: 'How many links are written in each layer' },
        links: { type: 'array', items: LINK, description: "The links, the mod's first" },
        not_listed: {
            ...COUNT,
            description:
                "Links left out to keep the result small (detail cut), the base game's last",
        },
    },
    required: ['count', 'by_kind', 'by_layer', 'links', 'not_listed'],
};

const ANSWER: Schema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        definitions: {
            type: 'object',
            properties: {
                count: COUNT,
                first: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { ...PLACE.properties, database: { type: 'string' } },
                        required: [...(PLACE.required ?? []), 'database'],
                    },
                    description: `At most ${String(DEFINITIONS_SHOWN)}, the mod's first; find_definition lists every one`,
                },
            },
            required: ['count', 'first'],
            description:
                'Where the mod and the base game define the name as script: the definitions its callees are read from',
        },
        callers: { ...SIDE, description: 'What calls the name: every link that names it' },
        callees: {
            ...SIDE,
            description: 'What the name calls: every link written in its definitions',
        },
        detail: {
            type: 'string',
            enum: ['cut'],
            description:
                "Present when the name's whole answer would not fit one result: its links are listed in part, the counts whole; ask with direction callers or callees for one side alone",
        },
    },
    required: ['name', 'definitions'],
};

/** A link written from the side asked: the other end, its kind, how and where. */
function linkOf(link: CallLink, side: 'callers' | 'callees'): Record<string, unknown> {
    const other = side === 'callers' ? link.from : link.to;
    const out: Record<string, unknown> = {
        ...placeOf(link.at.layer, link.at.file, link.at.range),
        name: other.name,
        database: other.database,
    };
    if (side === 'callees') {
        out['defined'] = link.to.defined;
    }
    out['kind'] = linkKind(link);
    out['via'] = link.via;
    out['basis'] = link.basis.kind;
    if (link.basis.kind === 'field-reference') {
        out['row'] = link.basis.row;
        out['status'] = link.basis.status;
    }
    return out;
}

function countBy(links: readonly CallLink[], key: (l: CallLink) => string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const l of links) {
        out[key(l)] = (out[key(l)] ?? 0) + 1;
    }
    return out;
}

/** One side of an answer, its first `shown` links listed. */
function sideOf(
    links: readonly CallLink[],
    side: 'callers' | 'callees',
    shown: number,
): Record<string, unknown> {
    const listed = links.slice(0, shown);
    return {
        count: links.length,
        by_kind: countBy(links, linkKind),
        by_layer: countBy(links, (l) => l.at.layer),
        links: listed.map((l) => linkOf(l, side)),
        not_listed: links.length - listed.length,
    };
}

/** A name's answer, with at most `shown` links of each side asked listed. */
function answerOf(
    answer: CallAnswer,
    direction: Direction,
    shown: { readonly callers: number; readonly callees: number },
): Record<string, unknown> {
    const out: Record<string, unknown> = {
        name: answer.name,
        definitions: {
            count: answer.definitions.length,
            first: answer.definitions.slice(0, DEFINITIONS_SHOWN).map((d) => ({
                ...placeOf(d.layer, d.file, d.range),
                database: d.database,
            })),
        },
    };
    if (direction !== 'callees') {
        out['callers'] = sideOf(answer.callers, 'callers', shown.callers);
    }
    if (direction !== 'callers') {
        out['callees'] = sideOf(answer.callees, 'callees', shown.callees);
    }
    if (
        (direction !== 'callees' && shown.callers < answer.callers.length) ||
        (direction !== 'callers' && shown.callees < answer.callees.length)
    ) {
        out['detail'] = 'cut';
    }
    return out;
}

/**
 * A name's answer that fits `room` characters: whole when it fits, otherwise as many links of each
 * side as fit, the callers and the callees cut alike, the mod's first.
 */
function fittedAnswer(
    answer: CallAnswer,
    direction: Direction,
    room: number,
): Record<string, unknown> {
    const all = { callers: answer.callers.length, callees: answer.callees.length };
    const whole = answerOf(answer, direction, all);
    if (sizeOf(whole) <= room) {
        return whole;
    }
    const at = (n: number): Record<string, unknown> =>
        answerOf(answer, direction, {
            callers: Math.min(n, all.callers),
            callees: Math.min(n, all.callees),
        });
    let low = 0;
    let high = Math.max(all.callers, all.callees);
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (sizeOf(at(mid)) <= room) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return at(low);
}

/** The room a name written smaller is given: the budget less the result's frame and notes. */
const NAME_ROOM = RESULT_BUDGET - 2_000;

export const callGraphTool: Tool<CallGraphArgs> = {
    name: 'call_graph',
    title: 'Call graph of names',
    description: [
        'For each name, where it is defined, what calls it (callers) and what it calls (callees), in the mod and the base game: events triggering events, scripted effects and triggers called by name, on-actions firing events and on-actions, decisions firing events, and every other call the spec package marks.',
        "Each link says its kind (the caller's folder and the callee's), the statement that writes it, and its place; a callee nothing defines says defined false.",
        'Use it to see what a change to an effect, a trigger, an event or an on-action reaches, and what fires an event.',
        'Every name is answered whole: names that do not fit one result are listed in not_answered, to ask in another call; there is no cursor. A name with more links than one result holds comes with detail cut, its counts whole and its links listed in part; give direction callers or callees for one side.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            names: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                maxItems: MAX_NAMES,
                description: `The names: events (my_events.1), on-actions, scripted effects and triggers, decisions, any definition; at most ${String(MAX_NAMES)}`,
            },
            direction: {
                type: 'string',
                enum: ['both', 'callers', 'callees'],
                default: 'both',
                description:
                    'Which side: both by default, callers (what calls each name) or callees (what each name calls)',
            },
        },
        required: ['names'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            results: {
                type: 'array',
                items: ANSWER,
                description: 'Each name answered, whole, in the order asked',
            },
            not_answered: {
                type: ['object', 'null'],
                properties: {
                    names: { type: 'array', items: { type: 'string' } },
                    ask: { type: 'string' },
                },
                required: ['names', 'ask'],
                description:
                    'The names asked that did not fit in this result, and what to do. Null when every name is answered',
            },
            notes: NOTES,
        },
        required: ['results', 'not_answered', 'notes'],
    },
    run(args: CallGraphArgs, session: Session): Record<string, unknown> {
        const names = [...new Set(args.names)];
        for (const [i, name] of names.entries()) {
            if (name.length > MAX_NAME_LENGTH) {
                throw new BadInput(
                    `names[${String(i)}]: longer than ${String(MAX_NAME_LENGTH)} characters; no name of the game or a mod is that long`,
                );
            }
        }
        const direction = args.direction ?? 'both';
        const workspace = session.workspace();
        const graph = session.remember('call_graph', '', () => {
            const listings: SourceListing[] = [];
            if (workspace.game !== null) {
                listings.push(workspace.game.listing);
            }
            if (workspace.mod !== null) {
                listings.push(workspace.mod);
            }
            return new CallGraph({
                spec: session.spec,
                index: workspace.index,
                files: diskFileSource(listings),
            });
        });
        const notes = session.notes();
        const answers = names.map((name) => graph.answer(name));
        const build = (
            taken: readonly Record<string, unknown>[],
            left: readonly string[],
        ): Record<string, unknown> => ({
            results: taken,
            not_answered: left.length === 0 ? null : { names: left, ask: ASK_AGAIN },
            notes,
        });
        // Whole names, in the order asked: a name that does not fit is named, and the names
        // after it are still tried. A first name too large alone is written smaller.
        const taken: Record<string, unknown>[] = [];
        const left: string[] = [];
        for (const [i, answer] of answers.entries()) {
            const rest = names.slice(i + 1);
            const whole = answerOf(answer, direction, {
                callers: answer.callers.length,
                callees: answer.callees.length,
            });
            if (sizeOf(build([...taken, whole], [...left, ...rest])) <= RESULT_BUDGET) {
                taken.push(whole);
            } else if (taken.length === 0 && left.length === 0) {
                const room = NAME_ROOM - sizeOf(build([], rest));
                taken.push(fittedAnswer(answer, direction, room));
            } else {
                left.push(names[i] ?? '');
            }
        }
        return build(taken, left);
    },
};
