/**
 * The position model (docs/PLAN.md item 2.2; docs/encoding.md, "Positions").
 *
 * Every node and finding holds two offsets into the text it was parsed from: `start`, the
 * first UTF-16 code unit, and `end`, one past the last. A position is a 0-based line and a
 * 0-based character counted in UTF-16 code units from the start of that line: the default
 * position encoding of the language-server protocol, and what VS Code shows. The byte-order
 * mark is never part of that text, so it is never counted. A line ends at `\n`, `\r\n` or a
 * lone `\r`, as in the language-server protocol.
 */

/** A 0-based line and a 0-based UTF-16 character within it. */
export interface Position {
    readonly line: number;
    readonly character: number;
}

/** From `start` up to, not including, `end`. */
export interface Range {
    readonly start: Position;
    readonly end: Position;
}

/** Converts between offsets and positions for one text. */
export class LineIndex {
    /** The offset at which each line starts; the first is always 0. */
    readonly lineStarts: readonly number[];
    /** The length of the text, in UTF-16 code units. */
    readonly length: number;
    private readonly text: string;

    constructor(text: string) {
        const starts = [0];
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code === 10) {
                starts.push(i + 1);
            } else if (code === 13) {
                if (text.charCodeAt(i + 1) === 10) {
                    i++;
                }
                starts.push(i + 1);
            }
        }
        this.lineStarts = starts;
        this.length = text.length;
        this.text = text;
    }

    /** How many lines the text has; an empty text has one. */
    get lineCount(): number {
        return this.lineStarts.length;
    }

    /** The position of an offset; an offset outside the text is clamped to it. */
    positionAt(offset: number): Position {
        const at = Math.max(0, Math.min(offset, this.length));
        let low = 0;
        let high = this.lineStarts.length - 1;
        while (low < high) {
            const mid = (low + high + 1) >> 1;
            if ((this.lineStarts[mid] ?? 0) <= at) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return { line: low, character: at - (this.lineStarts[low] ?? 0) };
    }

    /**
     * The offset of a position. A line past the end gives the end of the text; a character
     * past the end of its line gives the end of that line, before its line break, as the
     * language-server protocol defines.
     */
    offsetAt(position: Position): number {
        if (position.line < 0) {
            return 0;
        }
        if (position.line >= this.lineStarts.length) {
            return this.length;
        }
        const start = this.lineStarts[position.line] ?? 0;
        const next = this.lineStarts[position.line + 1];
        let end = next ?? this.length;
        if (next !== undefined) {
            // Stop before this line's break: `\n`, `\r` or `\r\n`.
            end--;
            if (this.text.charCodeAt(end) === 10 && this.text.charCodeAt(end - 1) === 13) {
                end--;
            }
        }
        return start + Math.max(0, Math.min(position.character, end - start));
    }

    /** The range from one offset to another. */
    rangeOf(start: number, end: number): Range {
        return { start: this.positionAt(start), end: this.positionAt(end) };
    }
}
