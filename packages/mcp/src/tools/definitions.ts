/**
 * The tools that find where names are defined and used, in the mod and the base game, from the
 * workspace index (docs/PLAN.md step 3): `find_definition`, `find_references` and
 * `list_definitions`. Each lists the mod's places before the base game's, so that a page cut to
 * fit shows the agent its own files first.
 *
 * - `find_definition` takes a name, or a place in a file of the mod; it answers with the
 *   definitions of the name, by database, and which is in force by the override rules, as
 *   lookup does (where no rule decides, "winner not known": nothing is guessed).
 * - `find_references` lists where a name is written, a page at a time.
 * - `list_definitions` lists the definitions of one database of the index (its "kind": the
 *   folder that holds it, `common/scripted_effects`, `events`, or a localization language,
 *   `localization:l_english`), a page at a time, each with whether it is in force.
 */

import {
    inForceOf,
    lookup,
    type Definition,
    type DefinitionGroupAnswer,
    type Use,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { positionOf, spanOf, withSpans } from '../places.js';
import {
    BadInput,
    DEFAULT_LIMIT,
    fit,
    MAX_LIMIT,
    page,
    questionKey,
    readCursor,
    RESULT_BUDGET,
    valueList,
} from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import {
    NEXT_CURSOR,
    NOTES,
    pagedInput,
    PLACE,
    SPAN_PROPERTIES,
    SPAN_REQUIRED,
    type Tool,
} from '../tool.js';

const MOD = 'mod';

/** The mod's places first, then the base game's, each in the index's order. */
function modFirst<T extends { readonly layer: string }>(items: readonly T[]): T[] {
    return [...items.filter((i) => i.layer === MOD), ...items.filter((i) => i.layer !== MOD)];
}

function countByLayer(items: readonly { readonly layer: string }[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of items) {
        out[item.layer] = (out[item.layer] ?? 0) + 1;
    }
    return out;
}

const COUNT: Schema = { type: 'integer', minimum: 0 };
const BY_LAYER: Schema = {
    type: 'object',
    additionalProperties: COUNT,
    description: 'How many in each layer: mod, game, jomini, clausewitz, dlc:<pack>',
};
const IN_FORCE: Schema = {
    type: 'string',
    enum: ['yes', 'no', 'not-known'],
    description:
        "Whether it is the definition in force by the game's override rules; not-known where no rule decides",
};

// ─── find_definition ──────────────────────────────────────────────────────

export interface FindDefinitionArgs {
    readonly name?: string;
    readonly file?: string;
    readonly line?: number;
    readonly column?: number;
}

const FORMS_TEXT =
    'give either name, or file with line and column (a place in a file of the mod, counted from 1)';

/** The name an agent asked about, from the name or from a place in a file of the mod. */
function askedName(
    args: FindDefinitionArgs,
    session: Session,
    index: WorkspaceIndex,
): {
    readonly name: string | null;
    readonly at: Record<string, unknown> | null;
    readonly note: string | null;
} {
    const place = [args.file, args.line, args.column];
    const placeGiven = place.filter((v) => v !== undefined).length;
    if (args.name !== undefined) {
        if (placeGiven > 0) {
            throw new BadInput(`name and a place were both given; ${FORMS_TEXT}`);
        }
        return { name: args.name, at: null, note: null };
    }
    if (args.file === undefined || args.line === undefined || args.column === undefined) {
        throw new BadInput(
            placeGiven === 0
                ? `nothing to find; ${FORMS_TEXT}`
                : `a place needs all three of file, line and column; ${FORMS_TEXT}`,
        );
    }
    const target = session.modPath(args.file, 'file');
    if (target.kind !== 'file') {
        throw new BadInput(`file: ${args.file} is a folder; ${FORMS_TEXT}`);
    }
    const indexed = index.getFile(MOD, target.relative);
    if (indexed === undefined) {
        return {
            name: null,
            at: null,
            note: `${target.relative} is not a file the game reads as script or localization: no name is indexed in it`,
        };
    }
    if (args.line > indexed.lines) {
        throw new BadInput(
            `line: ${String(args.line)} is past the end of ${target.relative}, which has ${String(indexed.lines)} lines`,
        );
    }
    const found = index.nameAt(MOD, target.relative, positionOf(args.line, args.column));
    if (found === undefined) {
        return {
            name: null,
            at: null,
            note: `no name is written at line ${String(args.line)}, column ${String(args.column)} of ${target.relative}`,
        };
    }
    return {
        name: found.name,
        at: { file: target.relative, ...spanOf(found.range), written_as: found.kind },
        note: null,
    };
}

/** Definitions in force first, then the mod's, then the rest in the index's order. */
function ordered(group: DefinitionGroupAnswer): DefinitionGroupAnswer['definitions'][number][] {
    const rank = (d: DefinitionGroupAnswer['definitions'][number]): number =>
        d.inForce === 'yes' ? 0 : d.layer === MOD ? 1 : 2;
    return [...group.definitions].sort((a, b) => rank(a) - rank(b));
}

/**
 * The definition groups of a name, as lookup gives them, cut to the most definitions that fit
 * in `room` characters of what `build` makes of them: the groups with a definition of the mod
 * first, and in each group the one in force first, then the mod's, so that what is cut is the
 * base game's. Each group's places are written as spans; `build` is given the groups shown and
 * how many definitions were left out.
 */
export function fitDefinitions(
    groups: readonly DefinitionGroupAnswer[],
    build: (shown: readonly Record<string, unknown>[], notShown: number) => Record<string, unknown>,
    room = RESULT_BUDGET,
): Record<string, unknown> {
    const sorted = [...groups].sort(
        (a, b) =>
            Number(!a.definitions.some((d) => d.layer === MOD)) -
            Number(!b.definitions.some((d) => d.layer === MOD)),
    );
    const flat = sorted.flatMap((group, g) => ordered(group).map((d) => ({ g, d })));
    const shownOf = (taken: readonly (typeof flat)[number][]): Record<string, unknown>[] =>
        sorted
            .map((group, g) => ({
                database: group.database,
                container: group.container,
                inForce: withSpans(group.inForce),
                definitions: taken.filter((t) => t.g === g).map((t) => withSpans(t.d)),
            }))
            .filter((group) => group.definitions.length > 0);
    return fit(flat, (taken) => build(shownOf(taken), flat.length - taken.length), room).output;
}

export const findDefinitionTool: Tool<FindDefinitionArgs> = {
    name: 'find_definition',
    title: 'Find where a name is defined',
    description: [
        "Where a name is defined, in the mod and the base game, and which definition is in force by the game's override rules.",
        'Give the name, or a place in a file of the mod (file, line, column, counted from 1) to find the name written there.',
        'A name defined nowhere may be a keyword of the game: lookup says what it is.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1, description: 'The name' },
            file: {
                type: 'string',
                description:
                    "A file of the mod, relative to the mod's folder; with line and column",
            },
            line: { type: 'integer', minimum: 1, description: 'The line, counted from 1' },
            column: { type: 'integer', minimum: 1, description: 'The column, counted from 1' },
        },
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            name: {
                type: ['string', 'null'],
                description: 'The name, or null when none is written at the place',
            },
            at: {
                type: ['object', 'null'],
                properties: {
                    file: { type: 'string' },
                    ...SPAN_PROPERTIES,
                    written_as: {
                        type: 'string',
                        enum: ['definition', 'use'],
                        description: 'Whether the place defines the name or uses it',
                    },
                },
                required: ['file', ...SPAN_REQUIRED, 'written_as'],
                description: 'The name found at the place given, or null when a name was given',
            },
            definitions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        database: {
                            type: 'string',
                            description:
                                'What kind of definition: the folder that holds it, or a localization language',
                        },
                        container: { type: ['string', 'null'] },
                        inForce: {
                            type: 'object',
                            properties: { status: { type: 'string' } },
                            required: ['status'],
                            description:
                                'What the override rules say is in force: single, winner (with the rule), all, winner-not-known (with the reasons)...',
                        },
                        definitions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    ...PLACE.properties,
                                    form: { type: 'string' },
                                    inForce: IN_FORCE,
                                },
                                required: [...(PLACE.required ?? []), 'inForce'],
                            },
                        },
                    },
                    required: ['database', 'container', 'inForce', 'definitions'],
                },
            },
            not_shown: {
                ...COUNT,
                description: "Definitions left out to keep the result small, the base game's last",
            },
            notes: NOTES,
        },
        required: ['name', 'at', 'definitions', 'not_shown', 'notes'],
    },
    run(args: FindDefinitionArgs, session: Session): Record<string, unknown> {
        const workspace = session.workspace();
        const asked = askedName(args, session, workspace.index);
        const notes = session.notes();
        if (asked.note !== null) {
            notes.push(asked.note);
        }
        if (asked.name === null) {
            return { name: null, at: null, definitions: [], not_shown: 0, notes };
        }
        const answer = lookup(asked.name, {
            spec: session.spec,
            index: workspace.index,
            files: null,
            usesLimit: 0,
            suggestions: false,
        }).definitions;
        const groups = answer.status === 'read' ? answer.groups : [];
        if (groups.length === 0) {
            notes.push(
                `${asked.name} is defined nowhere in the mod or the base game; if it is a keyword of the game, lookup says what it is`,
            );
        }
        return fitDefinitions(groups, (shown, notShown) => ({
            name: asked.name,
            at: asked.at,
            definitions: shown,
            not_shown: notShown,
            notes,
        }));
    },
};

// ─── find_references ──────────────────────────────────────────────────────

export interface FindReferencesArgs {
    readonly name: string;
    readonly limit?: number;
    readonly cursor?: string;
}

function placeOf(use: Use | Definition): Record<string, unknown> {
    return { layer: use.layer, file: use.file, ...spanOf(use.range) };
}

export const findReferencesTool: Tool<FindReferencesArgs> = {
    name: 'find_references',
    title: 'Find where a name is used',
    description: [
        "Every place a name is written, other than where it is defined: the mod's places first, then the base game's.",
        'Returns the count by layer, then a page of places, then next_cursor for the next page.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1, description: 'The name' },
            ...pagedInput('places', DEFAULT_LIMIT, MAX_LIMIT),
        },
        required: ['name'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            count: COUNT,
            by_layer: BY_LAYER,
            references: { type: 'array', items: PLACE },
            next_cursor: NEXT_CURSOR,
            notes: NOTES,
        },
        required: ['name', 'count', 'by_layer', 'references', 'next_cursor', 'notes'],
    },
    run(args: FindReferencesArgs, session: Session): Record<string, unknown> {
        const key = questionKey('find_references', { name: args.name });
        const offset = readCursor(args.cursor, key);
        const workspace = session.workspace();
        const uses = modFirst(workspace.index.references(args.name));
        const notes = session.notes();
        if (uses.length === 0) {
            notes.push(`nothing in the mod or the base game writes ${args.name}`);
        }
        return page(uses, offset, args.limit ?? DEFAULT_LIMIT, key, (taken, nextCursor) => ({
            name: args.name,
            count: uses.length,
            by_layer: countByLayer(uses),
            references: taken.map(placeOf),
            next_cursor: nextCursor,
            notes,
        }));
    },
};

// ─── list_definitions ─────────────────────────────────────────────────────

export interface ListDefinitionsArgs {
    readonly kind: string;
    readonly limit?: number;
    readonly cursor?: string;
}

/** The databases the mod defines something in, sorted. */
function modDatabases(index: WorkspaceIndex): string[] {
    const out = new Set<string>();
    index.forEachDefinition((file, _form, database) => {
        if (file.layer === MOD) {
            out.add(database);
        }
    });
    return [...out].sort();
}

/** Bad input for a kind that holds no definition: the kinds close to it, the mod's, the rest. */
function unknownKind(kind: string, index: WorkspaceIndex): BadInput {
    const all = [...index.databases().keys()];
    const lower = kind.toLowerCase();
    const close = all.filter((d) => {
        const name = d.toLowerCase();
        return name !== lower && (name.endsWith(`/${lower}`) || name.includes(lower));
    });
    const mod = modDatabases(index);
    const rest = all.filter((d) => !mod.includes(d));
    const parts = [`kind: ${kind} holds no definition in the mod or the base game`];
    if (close.length > 0) {
        parts.push(`did you mean ${valueList(close, 1_000)}`);
    }
    parts.push(
        mod.length === 0
            ? 'the mod defines nothing'
            : `the kinds the mod defines are ${valueList(mod, 2_500)}`,
    );
    if (rest.length > 0) {
        parts.push(`the base game's other kinds are ${valueList(rest, 4_000)}`);
    }
    return new BadInput(parts.join('; '));
}

export const listDefinitionsTool: Tool<ListDefinitionsArgs> = {
    name: 'list_definitions',
    title: 'List the definitions of a kind',
    description: [
        "Every definition of one kind, in the mod and the base game: the mod's first.",
        'A kind is the folder that holds the definitions (common/scripted_effects, common/traits, events) or a localization language (localization:l_english).',
        'Returns the count by layer, then a page of definitions with whether each is in force, then next_cursor.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            kind: {
                type: 'string',
                minLength: 1,
                description:
                    'The kind: common/scripted_effects, events, localization:l_english... A kind that holds nothing gets the list of kinds',
            },
            ...pagedInput('definitions', DEFAULT_LIMIT, MAX_LIMIT),
        },
        required: ['kind'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            kind: { type: 'string' },
            count: COUNT,
            by_layer: BY_LAYER,
            definitions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        container: { type: ['string', 'null'] },
                        ...PLACE.properties,
                        in_force: IN_FORCE,
                    },
                    required: ['name', 'container', ...(PLACE.required ?? []), 'in_force'],
                },
            },
            next_cursor: NEXT_CURSOR,
            notes: NOTES,
        },
        required: ['kind', 'count', 'by_layer', 'definitions', 'next_cursor', 'notes'],
    },
    run(args: ListDefinitionsArgs, session: Session): Record<string, unknown> {
        const key = questionKey('list_definitions', { kind: args.kind });
        const offset = readCursor(args.cursor, key);
        const index = session.workspace().index;
        const definitions = modFirst(index.definitionsOf(args.kind));
        if (definitions.length === 0) {
            throw unknownKind(args.kind, index);
        }
        const limit = args.limit ?? DEFAULT_LIMIT;
        const inForce = new Map(
            definitions
                .slice(offset, offset + limit)
                .map((d) => [d, inForceOf(d, index.resolve(d.database, d.name, d.container))]),
        );
        const notes = session.notes();
        return page(definitions, offset, limit, key, (taken, nextCursor) => ({
            kind: args.kind,
            count: definitions.length,
            by_layer: countByLayer(definitions),
            definitions: taken.map((d) => ({
                name: d.name,
                container: d.container,
                ...placeOf(d),
                in_force: inForce.get(d) ?? 'not-known',
            })),
            next_cursor: nextCursor,
            notes,
        }));
    },
};
