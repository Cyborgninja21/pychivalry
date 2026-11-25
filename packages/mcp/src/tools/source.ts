/**
 * `source`: the text around a place another result named, from the base game's own files or the
 * mod's, read-only (docs/PLAN.md item 9.8, the owner's decision of 2026-11-25).
 *
 * The expert requests' development run had one session want to see how the game itself writes an
 * effect: `lookup` had named the places the game uses it, a layer `game`, a file and a line, and
 * nothing could show that text but the session's own file tools, which in a scored trial must
 * not leave the mod (and could not find the game: it guessed a folder). This shows it.
 *
 * - **By place, never by address.** It takes a layer and a file's path inside that layer, as
 *   every place in a result is written (`places.ts`), and a line. Only a file the index read is
 *   shown (a script or localization file of a folder the game reads, of the base game the server
 *   was started with or of the mod), found in the listings the index was built from; an absolute
 *   path, a `..`, a link, or a file whose real address is outside its layer's folder is refused
 *   (`source-text.ts` of the core).
 * - **Bounded.** At most `MAX_LINES` lines: the place's lines and up to `context` lines before
 *   and after; a line longer than `MAX_LINE_CHARACTERS` is cut and said to be; and the whole
 *   result stays within a result's budget, lines left out at the end and said to be.
 * - **As the index reads it.** Decoded as the index decodes the file, split into lines where the
 *   index's positions split them, so the line a result named is the line shown.
 * - It writes nothing and calls nothing outside this machine.
 */

import {
    findListedFile,
    installFolders,
    readListedFile,
    SourceRefused,
    type SourceListing,
    type SourceText,
} from '@pychivalry/core';
import { MOD_LAYER, placeOf } from '../places.js';
import { BadInput, fit, valueList } from '../result.js';
import type { Session } from '../session.js';
import { NOTES, PLACE, type Tool } from '../tool.js';

export interface SourceArgs {
    readonly layer: string;
    readonly file: string;
    readonly line: number;
    readonly end_line?: number;
    readonly context?: number;
}

/** The most lines one result shows: the hard cap. */
export const MAX_LINES = 40;

/** The lines shown before and after the place by default, and at most. */
export const DEFAULT_CONTEXT = 10;
export const MAX_CONTEXT = 20;

/** The most characters of one line shown; a longer line is cut. */
export const MAX_LINE_CHARACTERS = 400;

/** The lines to show: the place's own and its context, within `MAX_LINES`. */
export function shownLines(
    line: number,
    endLine: number,
    context: number,
    count: number,
): { readonly from: number; readonly to: number; readonly placeCut: boolean } {
    const last = Math.min(endLine, count);
    if (last - line + 1 >= MAX_LINES) {
        return { from: line, to: line + MAX_LINES - 1, placeCut: last > line + MAX_LINES - 1 };
    }
    let before = Math.min(context, line - 1);
    let after = Math.min(context, count - last);
    while (before + after + (last - line + 1) > MAX_LINES) {
        if (after >= before) {
            after--;
        } else {
            before--;
        }
    }
    return { from: line - before, to: last + after, placeCut: false };
}

/**
 * The layers a session reads, the mod first: the install folders of its game (`game`, `jomini`,
 * `clausewitz`), its DLC packs, and any other layer its listings hold.
 */
function layersOf(listings: readonly SourceListing[], gameDir: string | null): string[] {
    const out = new Set<string>();
    if (gameDir !== null) {
        for (const folder of installFolders(gameDir)) {
            out.add(folder.layer);
        }
    }
    for (const listing of listings) {
        for (const pack of listing.packs) {
            out.add(pack.layer);
        }
        for (const file of listing.files) {
            out.add(file.layer);
        }
    }
    const all = [...out].sort();
    return [MOD_LAYER, ...all.filter((l) => l !== MOD_LAYER)];
}

/** A line as shown: its number, a tab, its text, cut when too long. */
function shownLine(n: number, text: string): { readonly shown: string; readonly cut: boolean } {
    const cut = text.length > MAX_LINE_CHARACTERS;
    return {
        shown: `${String(n)}\t${cut ? `${text.slice(0, MAX_LINE_CHARACTERS)}…` : text}`,
        cut,
    };
}

export const sourceTool: Tool<SourceArgs> = {
    name: 'source',
    title: 'Show the text around a place',
    description: [
        "The text of a file around a place another result named: the base game's own script or localization (to see how the game itself writes a name), or the mod's.",
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
        const endLine = args.end_line ?? args.line;
        if (endLine < args.line) {
            throw new BadInput(
                `end_line: ${String(endLine)} is before line ${String(args.line)}; give the last line of the place, or leave it out`,
            );
        }
        const workspace = session.workspace();
        const listings: SourceListing[] = [];
        if (workspace.mod !== null) {
            listings.push(workspace.mod);
        }
        if (workspace.game !== null) {
            listings.push(workspace.game.listing);
        }
        const layers = layersOf(listings, session.game.dir);
        if (!layers.includes(args.layer)) {
            throw new BadInput(
                session.game.dir === null
                    ? `layer: ${args.layer} is not a layer of this server, which runs without the base game; the only layer is mod`
                    : `layer: ${args.layer} is not a layer this server reads; the layers are ${valueList(layers, 2_000)}`,
            );
        }
        let text: SourceText;
        try {
            text = readListedFile(workspace.index, findListedFile(listings, args.layer, args.file));
        } catch (err) {
            if (err instanceof SourceRefused) {
                throw new BadInput(`file: ${err.message}`);
            }
            throw err;
        }
        const count = text.lines.length;
        if (args.line > count) {
            throw new BadInput(
                `line: ${String(args.line)} is past the end of ${args.file}, which has ${String(count)} lines`,
            );
        }
        const { from, to, placeCut } = shownLines(
            args.line,
            endLine,
            args.context ?? DEFAULT_CONTEXT,
            count,
        );
        const rows = text.lines.slice(from - 1, to).map((t, i) => ({
            n: from + i,
            ...shownLine(from + i, t),
            length: t.length,
        }));
        const notes = session.notes();
        if (placeCut) {
            notes.push(
                `the place is longer than ${String(MAX_LINES)} lines: lines ${String(from)} to ${String(to)} are shown; ask again with line ${String(to + 1)} for the rest`,
            );
        }
        if (endLine > count) {
            notes.push(
                `end_line ${String(endLine)} is past the end of the file, which has ${String(count)} lines`,
            );
        }
        const build = (taken: readonly (typeof rows)[number][]): Record<string, unknown> => {
            const last = taken.at(-1);
            const lastLine = last?.n ?? from;
            return {
                shown: placeOf(text.layer, text.path, {
                    start: { line: from - 1, character: 0 },
                    end: { line: lastLine - 1, character: last?.length ?? 0 },
                }),
                lines: taken.map((r) => r.shown),
                line_count: count,
                cut_lines: taken.filter((r) => r.cut).map((r) => r.n),
                encoding: text.validUtf8
                    ? 'utf-8'
                    : `not valid UTF-8, read as ${text.encoding === 'utf-8' ? 'UTF-8 with replacement characters' : text.encoding}`,
                notes:
                    taken.length < rows.length
                        ? [
                              ...notes,
                              `lines ${String(lastLine + 1)} to ${String(to)} are left out to keep the result small; ask again with line ${String(lastLine + 1)}`,
                          ]
                        : notes,
            };
        };
        const { output, taken } = fit(rows, build);
        if (taken === 0) {
            throw new Error('one line is larger than a whole result may be');
        }
        return output;
    },
};
