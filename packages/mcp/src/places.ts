/**
 * Places in the tools' results, written by one writer (`placeOf`) so that every tool names a
 * place the same way.
 *
 * - **Lines and columns count from 1.** The core counts lines and characters from 0, as the
 *   language server protocol does; an agent reads files with line numbers that count from 1, as
 *   a text editor and the command line's text output show them. Every place a tool returns is
 *   therefore `line` and `column`, with `end_line` and `end_column`, all counted from 1; a column
 *   counts UTF-16 code units, as the core's characters do (docs/encoding.md).
 * - **Every place says its layer.** `mod` is a file of the mod, its path inside the mod's folder,
 *   which an agent's own file tools can open. Every other layer (`game`, `jomini`, `clausewitz`,
 *   `dlc:<pack>`) is a file of the installed game, outside the mod, its path inside that layer's
 *   folder: an agent's own file tools cannot reach it, and in a scored test session must not try.
 *   Such a place says so (`read_with: "source"`): the `source` tool shows its text. The expert
 *   requests' development run had one session read a game place as if it were under its mod, a
 *   folder it guessed (tools/scored-run/README.md).
 */

import type { Position, Range } from '@pychivalry/core';

/** The layer of the mod's own files. */
export const MOD_LAYER = 'mod';

/** What a place of a layer other than the mod says to read it with: the `source` tool. */
export const READ_WITH = 'source';

/** A span as the tools return it: lines and columns counted from 1. */
export interface Span {
    readonly line: number;
    readonly column: number;
    readonly end_line: number;
    readonly end_column: number;
}

/** A range of the core as a span of the tools. */
export function spanOf(range: Range): Span {
    return {
        line: range.start.line + 1,
        column: range.start.character + 1,
        end_line: range.end.line + 1,
        end_column: range.end.character + 1,
    };
}

/** A line and a column counted from 1 as a position of the core. */
export function positionOf(line: number, column: number): Position {
    return { line: line - 1, character: column - 1 };
}

/**
 * A place as every tool writes it: its layer, its file's path inside the layer, its span, and,
 * for a layer other than the mod, `read_with: "source"`.
 */
export function placeOf(layer: string, file: string, range: Range): Record<string, unknown> {
    const place: Record<string, unknown> = { layer, file, ...spanOf(range) };
    if (layer !== MOD_LAYER) {
        place['read_with'] = READ_WITH;
    }
    return place;
}

/** A place of the mod's own files. */
export function modPlaceOf(file: string, range: Range): Record<string, unknown> {
    return placeOf(MOD_LAYER, file, range);
}

function isRange(value: unknown): value is Range {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const r = value as { start?: unknown; end?: unknown };
    const isPosition = (p: unknown): boolean =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Position).line === 'number' &&
        typeof (p as Position).character === 'number';
    return isPosition(r.start) && isPosition(r.end);
}

/**
 * A value of the core's (a definition, a fix) with every place in it written by `placeOf`: an
 * object holding a `range` and a `file` gets its layer (its own `layer`, or `layer` when it has
 * none: a fix's edits are always the mod's), its file, its span and, outside the mod,
 * `read_with`, its other fields kept after them. An object with a range and no file gets its span
 * only. Nothing else changes.
 */
export function withPlaces(value: unknown, layer: string = MOD_LAYER): unknown {
    if (Array.isArray(value)) {
        return value.map((v) => withPlaces(v, layer));
    }
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    const o = value as Record<string, unknown>;
    const range = o['range'];
    const file = o['file'];
    if (isRange(range) && typeof file === 'string') {
        const own = typeof o['layer'] === 'string' ? o['layer'] : layer;
        const out: Record<string, unknown> = placeOf(own, file, range);
        for (const [key, inner] of Object.entries(o)) {
            if (key !== 'range' && key !== 'file' && key !== 'layer') {
                out[key] = withPlaces(inner, layer);
            }
        }
        return out;
    }
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(o)) {
        if (key === 'range' && isRange(inner)) {
            Object.assign(out, spanOf(inner));
        } else {
            out[key] = withPlaces(inner, layer);
        }
    }
    return out;
}
