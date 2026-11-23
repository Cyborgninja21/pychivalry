/**
 * Places in the tools' results. The core counts lines and characters from 0, as the language
 * server protocol does; an agent reads files with line numbers that count from 1, as a text
 * editor and the command line's text output show them. Every place a tool returns is therefore
 * `line` and `column`, with `end_line` and `end_column`, all counted from 1; a column counts
 * UTF-16 code units, as the core's characters do (docs/encoding.md).
 */

import type { Position, Range } from '@pychivalry/core';

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
 * A value of the core's (a lookup answer) with every `range` in it written as a span: the
 * object holding the range gets `line`, `column`, `end_line` and `end_column` in its place.
 * Nothing else changes.
 */
export function withSpans(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(withSpans);
    }
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
        if (key === 'range' && isRange(inner)) {
            Object.assign(out, spanOf(inner));
        } else {
            out[key] = withSpans(inner);
        }
    }
    return out;
}
