/**
 * The fixes of the parse findings about braces:
 *
 * - `syntax/unexpected-closing-brace`: a `}` at the top level, where no block is open, taken
 *   away. Safe: the parser, as the game, reads the file without it, so taking it away changes
 *   nothing that is read.
 * - `syntax/missing-closing-brace`: a block left open at the end of the file (reported at its
 *   `{`). Where its `}` belongs is a choice the parser cannot make: a suggestion of two places.
 *   First, where the file's indentation says a block ends: after the last line of the first
 *   block (from the reported one inward) that holds a line indented no deeper than the block's
 *   own line before its closing brace. Second, the end of the file. Each is offered only when
 *   the file, parsed again with it, has the block closed and no new parse finding (a file that
 *   ends inside quoted text or a comment would take the `}` into it).
 *
 * Every fix here is the parser's own: it is offered only when the file parsed again with it
 * has one finding of its code fewer and no new one (`FixFile.parsesFixed`).
 */

import type { Block } from '../syntax/tree.js';
import type { FixableFinding, FixFile } from './file.js';
import { safeFix, suggestion, type FindingFix, type FixAlternative } from './fix.js';

export function unexpectedClosingBraceFix(
    finding: FixableFinding,
    file: FixFile,
): FindingFix | null {
    if (file.slice(finding.start, finding.end) !== '}') {
        return null;
    }
    const alternative = {
        title: "Remove the '}' that closes no block",
        edits: [file.replace(finding.start, finding.end, '')],
    };
    return file.parsesFixed(alternative, 'syntax/unexpected-closing-brace')
        ? safeFix('parser', alternative)
        : null;
}

/** The leading whitespace of a line, in columns: a tab counts as 4. */
function width(indent: string): number {
    let n = 0;
    for (const ch of indent) {
        n += ch === '\t' ? 4 : 1;
    }
    return n;
}

/**
 * Where indentation says the block opened at a line ends: the end of the last line before the
 * first later line (inside the block) indented no deeper than the opening line, when that line
 * is not the block's own `}`. Searched from `block` inward through the blocks of its last item.
 */
function indentedEnd(
    file: FixFile,
    block: Block,
): { readonly at: number; readonly block: Block } | null {
    let current: Block | undefined = block;
    while (current !== undefined) {
        const open = file.lines.positionAt(current.start).line;
        const own = width(file.indentAt(current.start));
        const last = file.lines.positionAt(current.end).line;
        let previous: number | null = null;
        for (let line = open + 1; line <= last && line < file.lines.lineCount; line++) {
            const start = file.lines.lineStarts[line] ?? 0;
            const end = file.lines.lineStarts[line + 1] ?? file.text.length;
            const text = file.text.slice(start, end).replace(/[\r\n]+$/, '');
            if (text.trim() === '' || text.trim().startsWith('#')) {
                continue;
            }
            if (width(/^[ \t]*/.exec(text)?.[0] ?? '') <= own) {
                if (text.trim().startsWith('}') || previous === null) {
                    break;
                }
                return { at: previous, block: current };
            }
            previous = start + text.length;
        }
        const inner: Block | undefined = current.items
            .filter((item) => item.kind !== 'comment')
            .map((item) =>
                item.kind === 'block'
                    ? item
                    : item.kind === 'pair' && item.value?.kind === 'block'
                      ? item.value
                      : undefined,
            )
            .filter((b): b is Block => b !== undefined)
            .at(-1);
        current = inner;
    }
    return null;
}

export function missingClosingBraceFix(finding: FixableFinding, file: FixFile): FindingFix | null {
    const block = file.blockAt(finding.start);
    if (block === undefined || block.closed) {
        return null;
    }
    const nl = file.newline;
    const alternatives: FixAlternative[] = [];
    const indented = indentedEnd(file, block);
    if (indented !== null) {
        const indent = file.indentAt(indented.block.start);
        const line = file.lines.positionAt(indented.at).line + 1;
        alternatives.push({
            title: `Close the block after line ${String(line)}, where its indentation ends`,
            edits: [file.insert(indented.at, `${nl}${indent}}`)],
        });
    }
    const end = file.text.length;
    const endsInBreak = /[\r\n]$/.test(file.text);
    alternatives.push({
        title: 'Close the block at the end of the file',
        edits: [file.insert(end, endsInBreak ? `}${nl}` : `${nl}}${nl}`)],
    });
    return suggestion(
        'parser',
        alternatives.filter((a) => file.parsesFixed(a, 'syntax/missing-closing-brace')),
    );
}
