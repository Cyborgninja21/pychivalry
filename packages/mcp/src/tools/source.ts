/**
 * `source`: the text around a place another result named, from the base game's own files or the
 * mod's, read-only (docs/PLAN.md item 9.8, the owner's decision of 2026-11-25).
 *
 * The expert requests' development run had one session want to see how the game itself writes an
 * effect: `lookup` had named the places the game uses it, a layer `game`, a file and a line, and
 * nothing could show that text but the session's own file tools, which in a scored trial must
 * not leave the mod (and could not find the game: it guessed a folder). This shows it.
 *
 * The reading is the core's (`readSource` of `source-text.ts`), the one the command line's
 * `pychivalry source` calls too, so the two show the same lines, refuse the same places and keep
 * the same limits; this tool only writes the place shown by the one place writer (`placeOf`) and
 * adds the session's notes.
 *
 * - **By place, never by address.** It takes a layer and a file's path inside that layer, as
 *   every place in a result is written (`places.ts`), and a line. Only a file the index read is
 *   shown (a script, localization or GUI file of a folder the game reads, of the base game the server
 *   was started with or of the mod), found in the listings the index was built from; an absolute
 *   path, a `..`, a link, or a file whose real address is outside its layer's folder is refused.
 * - **Bounded.** At most `MAX_LINES` lines: the place's lines and up to `context` lines before
 *   and after; a line longer than `MAX_LINE_CHARACTERS` is cut and said to be; and the lines
 *   within the core's room for them (`SOURCE_TEXT_ROOM`), which keeps the result within its
 *   budget, lines left out at the end and said to be.
 * - **As the index reads it.** Decoded as the index decodes the file, split into lines where the
 *   index's positions split them, so the line a result named is the line shown.
 * - It writes nothing and calls nothing outside this machine.
 */

import {
    readSource,
    SOURCE_DEFAULT_CONTEXT,
    SOURCE_MAX_CONTEXT,
    SOURCE_MAX_LINE_CHARACTERS,
    SOURCE_MAX_LINES,
    SourceRefused,
    workspaceSources,
    type SourceExcerpt,
} from '@pychivalry/core';
import { placeOf } from '../places.js';
import { BadInput } from '../result.js';
import type { Session } from '../session.js';
import { NOTES, PLACE, type Tool } from '../tool.js';

export interface SourceArgs {
    readonly layer: string;
    readonly file: string;
    readonly line: number;
    readonly end_line?: number;
    readonly context?: number;
}

/** The core's limits (`source-text.ts`), which the command line's `source` keeps too. */
export const MAX_LINES = SOURCE_MAX_LINES;
export const DEFAULT_CONTEXT = SOURCE_DEFAULT_CONTEXT;
export const MAX_CONTEXT = SOURCE_MAX_CONTEXT;
export const MAX_LINE_CHARACTERS = SOURCE_MAX_LINE_CHARACTERS;

export const sourceTool: Tool<SourceArgs> = {
    name: 'source',
    title: 'Show the text around a place',
    description: [
        "The text of a file around a place another result named: the base game's own script, localization or GUI files (to see how the game itself writes a name), or the mod's.",
        'Give the place as results write it: its layer (game, jomini, clausewitz, dlc:<pack>, or mod), its file (the path inside that layer, with /) and its line; end_line for a place of several lines.',
        `Returns at most ${String(MAX_LINES)} lines, each as its number, a tab and its text: the place's lines and up to context lines (default ${String(DEFAULT_CONTEXT)}) before and after.`,
        'A place whose layer is not mod is in the installed game, outside the mod: read it with source, never with your own file tools, which cannot reach it. Only files pychivalry reads are shown, by their place; never an address on disk. Reads only; writes nothing.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            layer: {
                type: 'string',
                minLength: 1,
                description:
                    'The layer of the place, as a result names it: game, jomini, clausewitz, dlc:<pack> (the base game) or mod',
            },
            file: {
                type: 'string',
                minLength: 1,
                description:
                    "The file's path inside its layer, with /, exactly as a result names it (common/scripted_effects/00_example.txt); never an absolute path or ..",
            },
            line: {
                type: 'integer',
                minimum: 1,
                description: 'The line of the place, counted from 1',
            },
            end_line: {
                type: 'integer',
                minimum: 1,
                description:
                    'The last line of the place, for a place of several lines; line when left out',
            },
            context: {
                type: 'integer',
                minimum: 0,
                maximum: MAX_CONTEXT,
                default: DEFAULT_CONTEXT,
                description: `How many lines to show before and after the place, at most ${String(MAX_CONTEXT)}; fewer when the ${String(MAX_LINES)} lines a result shows would be passed`,
            },
        },
        required: ['layer', 'file', 'line'],
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            shown: {
                ...PLACE,
                description:
                    'The lines shown, as a place: from line to end_line of the file (end_column is just after the last line shown)',
            },
            lines: {
                type: 'array',
                items: { type: 'string' },
                description: "Each line shown: its number, a tab, then the line's text",
            },
            line_count: {
                type: 'integer',
                minimum: 1,
                description: 'How many lines the file has',
            },
            cut_lines: {
                type: 'array',
                items: { type: 'integer' },
                description: `The lines whose text was cut after ${String(MAX_LINE_CHARACTERS)} characters (marked …)`,
            },
            encoding: {
                type: 'string',
                description:
                    'How the file was read: utf-8, or how a file that is not valid UTF-8 was read',
            },
            notes: NOTES,
        },
        required: ['shown', 'lines', 'line_count', 'cut_lines', 'encoding', 'notes'],
    },
    run(args: SourceArgs, session: Session): Record<string, unknown> {
        const workspace = session.workspace();
        let excerpt: SourceExcerpt;
        try {
            excerpt = readSource(workspaceSources(workspace, session.game.dir), {
                layer: args.layer,
                file: args.file,
                line: args.line,
                endLine: args.end_line,
                context: args.context,
            });
        } catch (err) {
            if (err instanceof SourceRefused) {
                throw new BadInput(`${err.argument}: ${err.message}`);
            }
            throw err;
        }
        return {
            shown: placeOf(excerpt.layer, excerpt.file, {
                start: { line: excerpt.from - 1, character: 0 },
                end: { line: excerpt.to - 1, character: excerpt.lastLength },
            }),
            lines: excerpt.lines,
            line_count: excerpt.lineCount,
            cut_lines: excerpt.cutLines,
            encoding: excerpt.encoding,
            notes: [...session.notes(), ...excerpt.notes],
        };
    },
};
