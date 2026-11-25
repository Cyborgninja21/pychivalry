/**
 * `lookup`: for each name asked, what it is and where it is valid, answered whole in one call
 * (docs/PLAN.md item 9.8, the owner's decision of 2026-11-25).
 *
 * Each name's answer is the core's lookup (docs/PLAN.md item 4.8), the answer the command line's
 * `lookup --json` prints, written compactly (`lookup-answer.ts`): its readings first, every one
 * with its facts (what it is, the game's own description, its scopes, what it takes, its version,
 * its removal and replacement); then where the base game and the mod define it, with the rule
 * that decides which definition is in force; then how many places use it, by layer, and the
 * first few; for a name nothing knows, the names close to it.
 *
 * **No answer is ever cut inside a name, and there is no cursor.** Until schema version 4 the
 * answer was a list of parts paged by a cursor, each name's head (its definitions and its first
 * 20 uses, each a place) before its readings: in the expert requests' development run the first
 * `lookup` of every session asked for 2 to 20 names and got 1 to 3 on its first page, 78 of 101
 * answers with a next page were never continued, and 9 of the run's 12 tool errors were a cursor
 * given with other names (tools/scored-run/README.md). Now every name either is answered whole or
 * is named in `not_answered`, with what to do: look those names up in another call. A result holds
 * as many whole names as fit, in the order asked; every name fits a result alone, written smaller
 * when it must (`answerOf`).
 *
 * **The spec package's evidence, for one name, on request** (tool schema version 5, the owner's
 * decision of 2026-11-25): with `evidence` true and exactly one name, its answer also holds
 * `evidence`, the core's readings of the name whole, with the evidence behind each part, as the
 * command line's `lookup --json` prints them (`evidenceOf`): as many as fit the result, from the
 * first, the rest counted with the characters they hold and what to ask instead, never cut
 * silently. Off by default, so that no answer grows unless it is asked; refused with more than one
 * name, the text saying how to ask.
 */

import {
    diskFileSource,
    languageOf,
    lookup,
    type SourceListing,
    type WorkspaceIndex,
} from '@pychivalry/core';
import { BadInput, RESULT_BUDGET, sizeOf, valueList } from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import { NOTES, PLACE, type Tool } from '../tool.js';
import { answerOf, evidenceOf, FIELDS_IN_FULL, PLACES_SHOWN, USES_SHOWN } from './lookup-answer.js';

export interface LookupArgs {
    readonly names: readonly string[];
    readonly language?: string;
    readonly folder?: string;
    readonly evidence?: boolean;
}

/** The most names one call may ask about. */
export const MAX_NAMES = 20;

/** The longest name asked: no name of the game or a mod is longer. */
export const MAX_NAME_LENGTH = 120;

/** What `not_answered` says to do. */
export const ASK_AGAIN =
    'These names did not fit in this result: look them up in another call of lookup, with the same language and folder. lookup has no cursor and no pages: every name it answers is answered whole';

const COUNT: Schema = { type: 'integer', minimum: 0 };

/** The evidence of one name's readings, given only when asked (`evidenceOf`). */
const EVIDENCE: Schema = {
    type: 'object',
    properties: {
        spec: {
            type: 'object',
            properties: { version: { type: 'string' }, sha256: { type: 'string' } },
            required: ['version', 'sha256'],
            description: 'The spec package the evidence is from',
        },
        readings: {
            type: 'array',
            items: {
                type: 'object',
                properties: { kind: { type: 'string' } },
                required: ['kind'],
            },
            description:
                "The name's readings whole, in order, each with the spec package's evidence behind each part (its sources, counts and quotes), as the command line's lookup --json gives them; as many as fit this result",
        },
        readings_total: {
            ...COUNT,
            description:
                'How many readings the name has (with folder: in that folder, and those that are not fields)',
        },
        left_out: {
            type: ['object', 'null'],
            properties: {
                readings: COUNT,
                characters: COUNT,
                ask: { type: 'string' },
            },
            required: ['readings', 'characters', 'ask'],
            description:
                'The readings after those given, whose evidence did not fit this result: how many, the characters they hold, and what to ask instead. Null when every reading is given',
        },
    },
    required: ['spec', 'readings', 'readings_total', 'left_out'],
    description:
        "Only with evidence true: the spec package's evidence behind the readings of this one name",
};

const ANSWER: Schema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
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
                "Every reading of the name in the spec package (a trigger, an effect, a scope link, a modifier, a field of a folder, an iterator...): what it is, the game's own description, the scopes it is valid in (and leads to), what it takes, its version, its removal and replacement; a field's kind, value type and the values the base game writes",
        },
        fields_in_brief: {
            type: 'boolean',
            description: `True when the name is a field of more than ${String(FIELDS_IN_FULL)} folders and no folder was given: each field reading is in brief (its folder, path, kind and value type); lookup with folder gives the field of that folder in full`,
        },
        field_of: {
            type: 'array',
            items: { type: 'string' },
            description:
                'The folders the name is a field of, when its answer was written smaller (detail): lookup with folder gives the field of one folder in full',
        },
        fields_elsewhere: {
            ...COUNT,
            description:
                'How many field readings of other folders than the folder given were left out',
        },
        definitions: {
            type: 'object',
            properties: {
                count: COUNT,
                groups: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            database: { type: 'string' },
                            container: { type: ['string', 'null'] },
                            in_force: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    rule: { type: 'string' },
                                },
                                required: ['status'],
                            },
                            count: COUNT,
                            first: {
                                type: 'array',
                                items: PLACE,
                                description: `At most ${String(PLACES_SHOWN)} places, the one in force first; find_definition lists every one`,
                            },
                        },
                        required: ['database', 'container', 'in_force', 'count'],
                    },
                },
            },
            required: ['count', 'groups'],
            description:
                'Where the base game and the mod define it, by database, and what the override rules say is in force',
        },
        uses: {
            type: 'object',
            properties: {
                count: COUNT,
                by_layer: { type: 'object', additionalProperties: COUNT },
                first: {
                    type: 'array',
                    items: PLACE,
                    description: `At most ${String(USES_SHOWN)} places that use it; find_references lists every one, a page at a time`,
                },
            },
            required: ['count', 'by_layer'],
            description: 'How many places use it, by layer, and the first few',
        },
        did_you_mean: {
            type: 'array',
            items: { type: 'string' },
            description: 'For a name nothing knows: the names close to it',
        },
        evidence: EVIDENCE,
        detail: {
            type: 'string',
            enum: ['field-folders', 'counts'],
            description:
                "Present when the name's whole answer would not fit one result and it is written smaller: field-folders, its fields listed by folder (ask with folder for one in full); counts, also its definitions and uses as counts only (find_definition and find_references list them)",
        },
    },
    required: ['name', 'unknown', 'readings'],
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

/** The folders a `folder` may name: the spec package's folders and its record schemas'. */
function foldersOf(session: Session, index: WorkspaceIndex): string[] {
    return [
        ...new Set([
            ...index.folders.folders.map((f) => f.path),
            ...Object.keys(session.spec.data.schema),
        ]),
    ].sort();
}

export const lookupTool: Tool<LookupArgs> = {
    name: 'lookup',
    title: 'Look up names',
    description: [
        "What each name is, every name answered whole: every reading the spec package has of it (trigger, effect, scope link, modifier, on-action, field of a folder...), with the game's own description, the scopes it is valid in, what it takes and its removal or replacement;",
        `then where the base game and the mod define it, which definition is in force, and how many places use it with the first ${String(USES_SHOWN)} (find_references lists every use of one name);`,
        'for a name nothing knows, the names close to it. Use it before writing a keyword, and to understand a finding.',
        `A name that is a field of more than ${String(FIELDS_IN_FULL)} folders comes in brief: give folder (common/decisions, events...) to have its field in that folder in full, as when learning the fields of the folder you write in.`,
        'There is no cursor and no next page: names that do not fit one result are listed in not_answered; look them up in another call.',
        "To show where a reading comes from, give evidence true with one name: its readings come again whole in evidence, with the spec package's evidence behind each part, as many as fit, the rest counted.",
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
            folder: {
                type: 'string',
                minLength: 1,
                description:
                    'Only the field readings of this folder (common/decisions, events...), in full; the readings that are not fields are all kept',
            },
            evidence: {
                type: 'boolean',
                default: false,
                description:
                    "True with exactly one name: its answer also holds evidence, its readings whole with the spec package's evidence behind each part (sources, counts, quotes), as the command line's lookup --json gives them. Off by default; one name a call",
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
                    'The names asked that did not fit in this result, and what to do: look them up in another call. Null when every name is answered',
            },
            notes: NOTES,
        },
        required: ['results', 'not_answered', 'notes'],
    },
    run(args: LookupArgs, session: Session): Record<string, unknown> {
        const names = [...new Set(args.names)];
        for (const [i, name] of names.entries()) {
            if (name.length > MAX_NAME_LENGTH) {
                throw new BadInput(
                    `names[${String(i)}]: longer than ${String(MAX_NAME_LENGTH)} characters; no name of the game or a mod is that long`,
                );
            }
        }
        if (args.evidence === true && names.length > 1) {
            throw new BadInput(
                `evidence: given with ${String(names.length)} names, and it is given for one name a call. Ask lookup with that one name and evidence true, once for each name whose evidence you need, and look the other names up in one call without evidence`,
            );
        }
        const language = args.language ?? null;
        const folder = args.folder ?? null;
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
        if (folder !== null) {
            const folders = foldersOf(session, workspace.index);
            if (!folders.includes(folder)) {
                const close = folders.filter((f) => f.endsWith(`/${folder}`) || f.includes(folder));
                throw new BadInput(
                    `folder: ${folder} is not a folder the game reads${close.length > 0 ? `; did you mean ${valueList(close, 1_000)}` : ''}; give the folder's path from the mod's top (common/decisions, events, common/scripted_effects)`,
                );
            }
        }
        const listings: SourceListing[] = [];
        if (workspace.game !== null) {
            listings.push(workspace.game.listing);
        }
        if (workspace.mod !== null) {
            listings.push(workspace.mod);
        }
        const files = session.game.dir === null ? null : diskFileSource(listings);
        const notes = session.notes();
        const results = names.map((name) =>
            lookup(name, {
                spec: session.spec,
                index: workspace.index,
                files,
                language,
                usesLimit: USES_SHOWN,
            }),
        );
        const answers = results.map((result) => answerOf(result, folder, language).answer);
        const build = (
            taken: readonly Record<string, unknown>[],
            left: readonly string[],
        ): Record<string, unknown> => ({
            results: taken,
            not_answered: left.length === 0 ? null : { names: left, ask: ASK_AGAIN },
            notes,
        });
        const [only] = results;
        const [answer] = answers;
        if (args.evidence === true && only !== undefined && answer !== undefined) {
            // One name: its evidence as large as the rest of the result leaves room for.
            const evidence = evidenceOf(
                only,
                folder,
                (e) => sizeOf(build([{ ...answer, evidence: e }], [])) <= RESULT_BUDGET,
            );
            return build([{ ...answer, evidence }], []);
        }
        // Whole names, in the order asked: a name that does not fit is named, and the names
        // after it are still tried. The first name always fits (`NAME_ROOM`).
        const taken: Record<string, unknown>[] = [];
        const left: string[] = [];
        for (const [i, answer] of answers.entries()) {
            const rest = names.slice(i + 1);
            if (sizeOf(build([...taken, answer], [...left, ...rest])) <= RESULT_BUDGET) {
                taken.push(answer);
            } else {
                left.push(names[i] ?? '');
            }
        }
        if (taken.length === 0 && answers.length > 0) {
            throw new Error('no name of the call fits a result: NAME_ROOM is too large');
        }
        return build(taken, left);
    },
};
