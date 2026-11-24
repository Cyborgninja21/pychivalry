/**
 * `lookup`: for each name, everything the core's lookup (docs/PLAN.md item 4.8) answers, the
 * answer the command line's `lookup --json` prints: every reading the spec package has of the
 * name, with its description, scopes, what it takes, its version and its removal; where the
 * base game and the mod define and use it, and which definition is in force; and, for a name
 * nothing knows, the names close to it. Its places are written as every tool writes them
 * (`places.ts`).
 *
 * One name can have many readings: `trait` is a trigger, an effect, a link, a list, a field of
 * nine folders and a scope type, about 21,000 characters in all. To fit one result the answer
 * is a list of parts, each name's head (everything but its readings) and then its readings one
 * by one, paged like every long list: a page holds the parts that fit, and `next_cursor` gives
 * the rest. A name whose readings go on to the next page says `readings_total`; its next part
 * comes back as `{ name, continued: true, readings }`. The uses a head lists are cut from 20 to
 * 5 and then to none when the head alone would not fit (their count stays whole).
 */

import {
    DEFAULT_USES_LIMIT,
    diskFileSource,
    languageOf,
    lookup,
    type LookupResult,
    type SourceListing,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { withSpans } from '../places.js';
import {
    BadInput,
    page,
    questionKey,
    readCursor,
    RESULT_BUDGET,
    sizeOf,
    valueList,
} from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import { NEXT_CURSOR, NOTES, type Tool } from '../tool.js';
import { fitDefinitions } from './definitions.js';

export interface LookupArgs {
    readonly names: readonly string[];
    readonly language?: string;
    readonly cursor?: string;
}

/** The most names one call may ask about. */
export const MAX_NAMES = 20;

/** The uses listed per name, tried in turn until a head fits. */
const USES_LIMITS: readonly number[] = [DEFAULT_USES_LIMIT, 5, 0];

/** The room a head may take of a result: the rest is for the list around it. */
const HEAD_ROOM = RESULT_BUDGET - 1_000;

const STATUS: Schema = {
    type: 'object',
    properties: { status: { type: 'string' } },
    required: ['status'],
};

const ANSWER: Schema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        continued: {
            type: 'boolean',
            description: 'True for the rest of a name begun on an earlier page: its readings only',
        },
        spec: {
            type: 'object',
            properties: { version: { type: 'string' }, sha256: { type: 'string' } },
            required: ['version', 'sha256'],
        },
        unknown: {
            type: 'boolean',
            description: 'True when the spec package has no reading of the name',
        },
        readings: {
            type: 'array',
            items: {
                type: 'object',
                properties: { kind: { type: 'string' } },
                required: ['kind'],
            },
            description:
                'The readings of the name in the spec package on this page (a trigger, an effect, a field of a folder, a scope type...), each with its description, scopes and what it takes',
        },
        readings_total: {
            type: 'integer',
            minimum: 0,
            description: 'How many readings the name has in all, on this page and others',
        },
        definitions: {
            ...STATUS,
            description:
                'Where the base game and the mod define it, by database, and which definition is in force',
        },
        uses: {
            ...STATUS,
            description: 'How many uses, by layer, and the first of them (limit says how many)',
        },
        dataTypes: STATUS,
        suggestions: { ...STATUS, description: 'For a name nothing knows: the names close to it' },
    },
    required: ['name', 'readings', 'readings_total'],
};

/** The languages the workspace's localization is in (`l_english`), sorted. */
function languagesOf(index: WorkspaceIndex): string[] {
    const out = new Set<string>();
    for (const database of index.databases().keys()) {
        const language = languageOf(database);
        if (language !== null && language !== '') {
            out.add(language);
        }
    }
    return [...out].sort();
}

/** One part of the answer: a name's head, or one of its readings. */
interface Part {
    readonly name: string;
    readonly total: number;
    readonly head: Record<string, unknown> | null;
    readonly reading: unknown;
}

/** A name's answer without its readings, its places as spans, small enough for one result. */
function headOf(answer: (usesLimit: number) => LookupResult): Record<string, unknown> {
    const headFrom = (result: LookupResult): Record<string, unknown> => ({
        name: result.name,
        spec: result.spec,
        unknown: result.unknown,
        definitions: withSpans(result.definitions),
        uses: withSpans(result.uses),
        dataTypes: result.dataTypes,
        suggestions: result.suggestions,
    });
    let result: LookupResult | null = null;
    for (const usesLimit of USES_LIMITS) {
        result = answer(usesLimit);
        if (sizeOf(headFrom(result)) <= HEAD_ROOM) {
            return headFrom(result);
        }
    }
    // Still too large: a name defined in very many places. Its definitions are cut to fit,
    // the count of those left out given; find_definition and list_definitions list them.
    result ??= answer(0);
    const head = headFrom(result);
    if (result.definitions.status !== 'read') {
        return head;
    }
    return fitDefinitions(
        result.definitions.groups,
        (groups, notShown) => ({
            ...head,
            definitions: { status: 'read', groups, not_shown: notShown },
        }),
        HEAD_ROOM,
    );
}

/** The parts of a page as results: a name's parts together, its head first when it is there. */
function resultsOf(parts: readonly Part[]): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    let current: { name: string; readings: unknown[]; result: Record<string, unknown> } | null =
        null;
    for (const part of parts) {
        if (current === null || current.name !== part.name || part.head !== null) {
            const readings: unknown[] = [];
            const result: Record<string, unknown> =
                part.head === null
                    ? { name: part.name, continued: true, readings, readings_total: part.total }
                    : {
                          name: part.head['name'],
                          spec: part.head['spec'],
                          unknown: part.head['unknown'],
                          readings,
                          readings_total: part.total,
                          definitions: part.head['definitions'],
                          uses: part.head['uses'],
                          dataTypes: part.head['dataTypes'],
                          suggestions: part.head['suggestions'],
                      };
            current = { name: part.name, readings, result };
            out.push(result);
        }
        if (part.head === null) {
            current.readings.push(part.reading);
        }
    }
    return out;
}

export const lookupTool: Tool<LookupArgs> = {
    name: 'lookup',
    title: 'Look up names',
    description: [
        "What each name is: every reading the spec package has of it (trigger, effect, scope link, modifier, on-action, field of a folder...), with the game's own description, the scopes it is valid in and what it takes;",
        'where the base game and the mod define and use it, and which definition is in force; for a name nothing knows, the names close to it.',
        'Use it before writing a keyword, and to understand a finding. Most answers fit in one result, with next_cursor null; when one does not, call lookup again with exactly the same names and language and that next_cursor for the rest. A lookup of other names never takes a cursor.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            names: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                maxItems: MAX_NAMES,
                description: `The names to look up, at most ${String(MAX_NAMES)}`,
            },
            language: {
                type: 'string',
                description:
                    "Only this language's localization text, as its files' header names it (l_english); every language when left out",
            },
            cursor: {
                type: 'string',
                description:
                    'Only for the rest of one answer: the next_cursor that answer gave, with exactly the same names and language. Leave it out to look up other names',
            },
        },
        required: ['names'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            results: { type: 'array', items: ANSWER },
            next_cursor: NEXT_CURSOR,
            notes: NOTES,
        },
        required: ['results', 'next_cursor', 'notes'],
    },
    run(args: LookupArgs, session: Session): Record<string, unknown> {
        const names = [...new Set(args.names)];
        const language = args.language ?? null;
        const key = questionKey('lookup', { names, language });
        const offset = readCursor(args.cursor, key, 'names or language');
        const workspace = session.workspace();
        if (language !== null) {
            const languages = languagesOf(workspace.index);
            if (!languages.includes(language)) {
                throw new BadInput(
                    languages.length === 0
                        ? 'language: no localization is read in the mod or the base game, so there is no language to choose; leave it out'
                        : `language: ${language} is not a language of the mod or the base game; the languages are ${valueList(languages, 2_000)}`,
                );
            }
        }
        // The next page of the same question, on an unchanged mod, does not look up again.
        const parts = session.remember('lookup', key, () => {
            const listings: SourceListing[] = [];
            if (workspace.game !== null) {
                listings.push(workspace.game.listing);
            }
            if (workspace.mod !== null) {
                listings.push(workspace.mod);
            }
            const files = session.game.dir === null ? null : diskFileSource(listings);
            const out: Part[] = [];
            for (const name of names) {
                const answer = (usesLimit: number): LookupResult =>
                    lookup(name, {
                        spec: session.spec,
                        index: workspace.index,
                        files,
                        language,
                        usesLimit,
                    });
                const readings = answer(0).readings.map(withSpans);
                out.push({ name, total: readings.length, head: headOf(answer), reading: null });
                for (const reading of readings) {
                    out.push({ name, total: readings.length, head: null, reading });
                }
            }
            return out;
        });
        const notes = session.notes();
        return page(parts, offset, parts.length, key, (taken, nextCursor) => ({
            results: resultsOf(taken),
            next_cursor: nextCursor,
            notes,
        }));
    },
};
